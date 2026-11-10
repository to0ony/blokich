/// <reference types="geojson" />
import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import type { GeoJSONSource, Map as MapaLibre } from 'maplibre-gl';
import {
  KartaService,
  LinijaKarta,
  StajalisteKarta,
  VoziloKarta,
} from '../../../services/karta.service';
import { Kretanje, sljedeceStajaliste, stajalistaNaTrasi } from '../../karta/kretanje';
import { BOJE, STIL, Tema, oznakaVozila, ucitajCss, ucitajPostavke } from '../../karta/karta-stil';
import { DanRasporeda, Sluzba, blokZa, minutaDo, uSmjeniSad } from '../vozac.model';

/** Bus koji preuzimam prati se tek 60 min prije mog nastupa (kao na kartici Danas). */
const CEKANJE_MIN = 60;
const INTERVAL_MS = 5_000;
const FRAME_MS = 33;

/** 'gotovo' samo u kompaktnoj kartici (dvije linije): linija je za danas odvožena. */
type Vrsta = 'vozim' | 'cekam' | 'kasnije' | 'gotovo';

/**
 * Karta ispod kartice "Danas": trasa linije koju vozač danas vozi, a dok vozi
 * (ili čeka bus koji preuzima) i taj bus uživo. Dodir otvara punu kartu.
 */
@Component({
  selector: 'app-moja-karta',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './moja-karta.component.html',
  styleUrl: './moja-karta.component.scss',
})
export class MojaKartaComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() dan: DanRasporeda | undefined;
  /** Samo ova linija (kad vozač danas vozi dvije, svaka ima svoju kartu). */
  @Input() linija: string | null = null;
  /** Uska kartica (dvije jedna pored druge). */
  @Input() kompaktno = false;
  private mapaEl?: ElementRef<HTMLDivElement>;

  /** Element karte postoji samo dok ima što prikazati – karta se radi i miče s njim. */
  @ViewChild('mapa') set mapaRef(el: ElementRef<HTMLDivElement> | undefined) {
    this.mapaEl = el;
    if (el && !this.mapa && !this.stvaram) void this.napraviMapu();
    if (!el && this.mapa) {
      this.mapa.remove();
      this.mapa = null;
      this.spremna = false;
      this.prikazanaTrasa = null;
    }
  }
  private stvaram = false;

  private readonly servis = inject(KartaService);
  private readonly zone = inject(NgZone);
  private readonly router = inject(Router);

  /** Dio službe koji se prikazuje: onaj u tijeku ili sljedeći danas. */
  dio: Sluzba | null = null;
  vrsta: Vrsta | null = null;
  vozilo: VoziloKarta | null = null;
  ruta: LinijaKarta | null = null;
  sad = Date.now();

  /** Profil je svijetao – tamna karta samo ako ju je vozač izabrao na punoj karti. */
  private readonly tema: Tema = ucitajPostavke().tema ?? 'svijetla';
  private mapa: MapaLibre | null = null;
  private spremna = false;
  private readonly kretanje = new Kretanje();
  private stajalista = new Map<string, StajalisteKarta[]>();
  private udaljenosti = new Map<string, number[]>();
  private trazeno = new Set<string>();
  private prikazanaTrasa: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private sat: ReturnType<typeof setInterval> | null = null;
  private frame = 0;
  private zadnjiFrame = 0;
  private unisten = false;

  ngOnChanges(): void {
    this.odrediDio();
  }

  ngAfterViewInit(): void {
    this.sat = setInterval(() => {
      this.sad = Date.now();
      this.odrediDio();
    }, 1000);
    this.timer = setInterval(() => this.osvjezi(), INTERVAL_MS);
    this.osvjezi();
    this.petlja();
  }

  ngOnDestroy(): void {
    this.unisten = true;
    if (this.timer) clearInterval(this.timer);
    if (this.sat) clearInterval(this.sat);
    cancelAnimationFrame(this.frame);
    this.mapa?.remove();
  }

  // ---------- Što se prikazuje ----------

  /** Služba u tijeku → vozim; sljedeća unutar sat vremena → čekam bus; kasnije → samo ruta. */
  private odrediDio(): void {
    const sluzbe = (this.dan?.sluzbe ?? []).filter(
      (s) => blokZa(s) && s.linija && (!this.linija || s.linija === this.linija),
    );
    const sad = sluzbe.find((s) => uSmjeniSad(s.od, s.do));
    const sljedeca = sad
      ? undefined
      : sluzbe
          .map((s) => ({ s, za: minutaDo(s.od) }))
          .filter((x) => x.za !== null)
          .sort((a, b) => a.za! - b.za!)[0];

    // U kompaktnoj kartici linija koja je gotova ostaje (s trasom), da se raspored ne pomiče.
    const gotova = !sad && !sljedeca && this.kompaktno ? (sluzbe[sluzbe.length - 1] ?? null) : null;
    const dio = sad ?? sljedeca?.s ?? gotova;
    const vrsta: Vrsta | null = sad
      ? 'vozim'
      : sljedeca
        ? sljedeca.za! <= CEKANJE_MIN
          ? 'cekam'
          : 'kasnije'
        : gotova
          ? 'gotovo'
          : null;

    const promjena = dio !== this.dio || vrsta !== this.vrsta;
    this.dio = dio;
    this.vrsta = vrsta;
    if (!promjena) return;

    if (vrsta === 'kasnije' || vrsta === 'gotovo' || !dio) {
      this.vozilo = null;
      this.kretanje.azuriraj([], Date.now());
    }
    if (dio?.linija && this.ruta?.broj !== dio.linija) this.ucitajRutu(dio.linija);
    this.prikazi();
  }

  get blok(): string | null {
    return this.dio ? blokZa(this.dio) : null;
  }

  // ---------- Podaci ----------

  private osvjezi(): void {
    if (typeof document !== 'undefined' && document.hidden) return;
    const blok = this.blok;
    if (!blok || (this.vrsta !== 'vozim' && this.vrsta !== 'cekam')) return;
    this.servis.vozila([blok]).subscribe({
      next: (res) => {
        const v = (res.vozila ?? [])[0] ?? null;
        this.vozilo = v;
        this.kretanje.azuriraj(v ? [v] : [], Date.now());
        if (v?.oblik) this.ucitajTrasu(v.oblik);
        this.prikazi();
      },
      error: () => {},
    });
  }

  private ucitajRutu(broj: string): void {
    this.servis.linija(broj).subscribe({
      next: (r) => {
        this.ruta = r?.smjerovi?.length ? r : null;
        this.prikazi();
      },
      error: () => (this.ruta = null),
    });
  }

  /** Trasa i stajališta vožnje kojom bus sad ide. */
  private ucitajTrasu(oblik: string): void {
    if (this.trazeno.has(oblik)) return;
    this.trazeno.add(oblik);
    this.servis.oblici([oblik]).subscribe({
      next: (res) => {
        const t = res.oblici?.[oblik];
        if (t) this.kretanje.dodajTrasu(oblik, t);
        this.prikazi();
      },
      error: () => this.trazeno.delete(oblik),
    });
    this.servis.stajalista(oblik).subscribe({
      next: (res) => {
        this.stajalista.set(oblik, res.stajalista ?? []);
        this.prikazi();
      },
      error: () => {},
    });
  }

  // ---------- Tekst ispod karte ----------

  /** Smjer: odredište vožnje busa, inače prvog smjera rute. */
  get smjer(): string | null {
    return this.vozilo?.cilj ?? this.ruta?.smjerovi[0]?.cilj ?? null;
  }

  get sljedece(): string | null {
    const v = this.vozilo;
    if (!v?.oblik) return null;
    const lista = this.stajalista.get(v.oblik);
    const t = this.kretanje.trasa(v.oblik);
    const d = this.kretanje.naTrasi(v.id);
    if (!lista?.length || !t || d === null) return null;
    let u = this.udaljenosti.get(v.oblik);
    if (!u) this.udaljenosti.set(v.oblik, (u = stajalistaNaTrasi(t, lista)));
    const s = sljedeceStajaliste(u, d);
    return s ? (s.naStajalistu ? `na stajalištu ${lista[s.indeks].naziv}` : lista[s.indeks].naziv) : null;
  }

  otvori(): void {
    const queryParams: Record<string, string> = {};
    if (this.vozilo) queryParams['vozilo'] = this.vozilo.id;
    if (this.dio?.linija) queryParams['linija'] = this.dio.linija;
    this.router.navigate(['/karta'], { queryParams });
  }

  // ---------- Karta ----------

  private async napraviMapu(): Promise<void> {
    if (!this.mapaEl) return;
    this.stvaram = true;
    ucitajCss();
    const maplibregl = (await import('maplibre-gl')).default;
    this.stvaram = false;
    if (this.unisten || !this.mapaEl || this.mapa) return;

    this.zone.runOutsideAngular(() => {
      const mapa = new maplibregl.Map({
        container: this.mapaEl!.nativeElement,
        style: STIL[this.tema],
        center: [15.93, 45.81],
        zoom: 11,
        interactive: false,
        // Na maloj karti izvor ide sitno u kut (vidi .mk-izvor), ne preko pola karte.
        attributionControl: false,
      });
      mapa.on('style.load', () => this.postaviSlojeve(mapa));
      this.mapa = mapa;
    });
  }

  private postaviSlojeve(mapa: MapaLibre): void {
    const b = BOJE[this.tema];
    const prazno: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
    if (!mapa.hasImage('vozilo')) mapa.addImage('vozilo', oznakaVozila(), { sdf: true, pixelRatio: 2 });
    for (const izvor of ['trasa', 'stajalista', 'vozilo']) {
      if (!mapa.getSource(izvor)) mapa.addSource(izvor, { type: 'geojson', data: prazno });
    }
    mapa.addLayer({
      id: 'trasa',
      type: 'line',
      source: 'trasa',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': b.trasa, 'line-width': 4, 'line-opacity': 0.85 },
    });
    mapa.addLayer({
      id: 'stajalista',
      type: 'circle',
      source: 'stajalista',
      paint: {
        'circle-radius': 3,
        'circle-color': b.stajalisteIspuna,
        'circle-stroke-color': b.trasa,
        'circle-stroke-width': 1.5,
      },
    });
    mapa.addLayer({
      id: 'vozilo',
      type: 'symbol',
      source: 'vozilo',
      layout: {
        'icon-image': 'vozilo',
        'icon-rotate': ['get', 'smjer'],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-size': 0.8,
        'text-field': ['get', 'linija'],
        'text-font': ['Noto Sans Bold'],
        'text-size': 9.5,
        'text-allow-overlap': true,
      },
      paint: {
        'icon-color': b.odabrano,
        'icon-halo-color': b.rub,
        'icon-halo-width': 1.6,
        'text-color': '#ffffff',
      },
    });
    this.spremna = true;
    this.prikazi();
  }

  /** Trasa: vožnja busa ako ga imamo, inače prvi smjer rute linije. */
  private prikazi(): void {
    if (!this.spremna || !this.mapa) return;
    const oblik = this.vozilo?.oblik ?? null;
    const t = oblik ? this.kretanje.trasa(oblik) : undefined;
    const smjer = this.ruta?.smjerovi[0];
    const tocke = t?.tocke ?? smjer?.tocke ?? null;
    const stajalista = (oblik ? this.stajalista.get(oblik) : undefined) ?? (t ? [] : (smjer?.stajalista ?? []));
    const kljuc = t ? `o:${oblik}` : smjer ? `r:${this.ruta!.broj}` : null;

    (this.mapa.getSource('trasa') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: tocke
        ? [
            {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: tocke.map(([lat, lon]) => [lon, lat]) },
            },
          ]
        : [],
    });
    (this.mapa.getSource('stajalista') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: stajalista.map((s) => ({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
      })),
    });

    // Cijela trasa u kadru – samo kad se trasa promijeni.
    if (tocke?.length && kljuc !== this.prikazanaTrasa) {
      this.prikazanaTrasa = kljuc;
      let [w, s, e, n] = [180, 90, -180, -90];
      for (const [lat, lon] of tocke) {
        w = Math.min(w, lon);
        e = Math.max(e, lon);
        s = Math.min(s, lat);
        n = Math.max(n, lat);
      }
      this.mapa.fitBounds(
        [
          [w, s],
          [e, n],
        ],
        { padding: this.kompaktno ? 14 : 22, maxZoom: 15, duration: 0 },
      );
    }
    if (!this.vozilo) {
      (this.mapa.getSource('vozilo') as GeoJSONSource).setData({ type: 'FeatureCollection', features: [] });
    }
  }

  private petlja(): void {
    const korak = (t: number) => {
      this.frame = requestAnimationFrame(korak);
      if (!this.vozilo || !this.spremna || document.hidden || t - this.zadnjiFrame < FRAME_MS) return;
      this.zadnjiFrame = t;
      const p = this.kretanje.pozicija(this.vozilo.id, Date.now());
      const izvor = this.mapa?.getSource('vozilo') as GeoJSONSource | undefined;
      if (!p || !izvor) return;
      izvor.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { smjer: p.smjer, linija: this.vozilo.linija ?? '' },
            geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
          },
        ],
      });
    };
    this.zone.runOutsideAngular(() => (this.frame = requestAnimationFrame(korak)));
  }
}
