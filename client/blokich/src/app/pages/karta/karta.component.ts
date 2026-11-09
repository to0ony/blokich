/// <reference types="geojson" />
import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { GeoJSONSource, Map as MapaLibre } from 'maplibre-gl';
import { KartaService, StajalisteKarta, VoziloKarta } from '../../services/karta.service';
import {
  Kretanje,
  sljedeceStajaliste,
  stajalistaNaTrasi,
} from '../../components/karta/kretanje';
import { kasniZnatno, opisKasnjenja } from '../../components/vozac/vozac.model';

const STIL = 'https://tiles.openfreemap.org/styles/positron';
const INTERVAL_MS = 10_000;
/** Animacija ne treba više od ~30 sličica u sekundi. */
const FRAME_MS = 33;
/** Visina kartice s detaljima – odabrano vozilo se centrira iznad nje. */
const PADDING_KARTICE = 330;
/** Pozicija starija od ovoga se prikazuje izblijedjelo. */
const STARO_S = 90;

interface Rezultat {
  vrsta: 'linija' | 'vozilo';
  naslov: string;
  opis: string;
  linija?: string;
  vozilo?: VoziloKarta;
}

export function bojaKasnjenja(s: number | null): string {
  if (s === null) return '#94a3b8';
  if (s <= -60) return '#2563eb';
  if (!kasniZnatno(s)) return '#16a34a';
  if (s < 300) return '#f59e0b';
  return '#dc2626';
}

function bezKvacica(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');
}

function ucitajCss(): void {
  if (document.getElementById('maplibre-css')) return;
  const l = document.createElement('link');
  l.id = 'maplibre-css';
  l.rel = 'stylesheet';
  l.href = 'maplibre.css';
  document.head.appendChild(l);
}

/** Strelica smjera (SDF – boja se zadaje u sloju), iznad kruga vozila. */
function strelica(): ImageData {
  const n = 72;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.beginPath();
  g.moveTo(36, 1);
  g.lineTo(27, 14);
  g.lineTo(45, 14);
  g.closePath();
  g.fill();
  return g.getImageData(0, 0, n, n);
}

/** Karta uživo: sva vozila ZET-a, za AP Podsused i vozač i bus. */
@Component({
  selector: 'app-karta',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './karta.component.html',
  styleUrl: './karta.component.scss',
})
export class KartaComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapa', { static: true }) mapaEl!: ElementRef<HTMLDivElement>;

  private readonly servis = inject(KartaService);
  private readonly zone = inject(NgZone);

  vozila: VoziloKarta[] = [];
  odabrano: VoziloKarta | null = null;
  vrijemeFeeda: string | null = null;
  ucitano = false;
  greska = false;
  trazi = '';
  samoPodsused = false;
  filterLinija: string | null = null;
  prati = true;
  /** Otkucava svake sekunde – za "prije X s". */
  sad = Date.now();

  readonly opisKasnjenja = opisKasnjenja;
  readonly bojaKasnjenja = bojaKasnjenja;

  private mapa: MapaLibre | null = null;
  private spremna = false;
  private readonly kretanje = new Kretanje();
  private trazeneTrase = new Set<string>();
  /** Stajališta po trasi – dohvaćaju se tek kad se vozilo odabere. */
  private stajalista = new Map<string, StajalisteKarta[]>();
  private trazenaStajalista = new Set<string>();
  private udaljenostiStajalista = new Map<string, number[]>();
  private prikazaniSljedeci = -1;
  private prviPut = true;
  private timer: ReturnType<typeof setInterval> | null = null;
  private sat: ReturnType<typeof setInterval> | null = null;
  private frame = 0;
  private zadnjiFrame = 0;
  private unisten = false;

  async ngAfterViewInit(): Promise<void> {
    ucitajCss();
    const maplibregl = (await import('maplibre-gl')).default;
    if (this.unisten) return;

    this.zone.runOutsideAngular(() => {
      const mapa = new maplibregl.Map({
        container: this.mapaEl.nativeElement,
        style: STIL,
        center: [15.93, 45.81],
        zoom: 11.3,
        dragRotate: false,
        pitchWithRotate: false,
        attributionControl: { compact: true },
      });
      mapa.touchZoomRotate.disableRotation();
      mapa.on('load', () => this.postaviSlojeve(mapa));
      mapa.on('dragstart', () => {
        if (this.odabrano && this.prati) this.zone.run(() => (this.prati = false));
      });
      mapa.on('click', (e) => {
        const p = e.point;
        const f = mapa.queryRenderedFeatures(
          [
            [p.x - 14, p.y - 14],
            [p.x + 14, p.y + 14],
          ],
          { layers: ['vozila-krug'] },
        );
        const id = f[0]?.properties?.['id'] as string | undefined;
        this.zone.run(() => {
          const v = id ? this.vozila.find((x) => x.id === id) : undefined;
          if (v) this.odaberi(v, false);
          else this.zatvori();
        });
      });
      this.mapa = mapa;
    });

    this.osvjezi();
    this.timer = setInterval(() => {
      if (!document.hidden) this.osvjezi();
    }, INTERVAL_MS);
    this.sat = setInterval(() => {
      this.sad = Date.now();
      this.osvjeziSljedece();
    }, 1000);
  }

  ngOnDestroy(): void {
    this.unisten = true;
    if (this.timer) clearInterval(this.timer);
    if (this.sat) clearInterval(this.sat);
    cancelAnimationFrame(this.frame);
    this.mapa?.remove();
  }

  // ---------- Podaci ----------

  private osvjezi(): void {
    this.servis.vozila().subscribe({
      next: (res) => {
        this.greska = false;
        this.ucitano = true;
        this.vrijemeFeeda = res.vrijeme;
        this.vozila = res.vozila ?? [];
        this.kretanje.azuriraj(this.vozila, Date.now());
        if (this.odabrano) {
          this.odabrano = this.vozila.find((v) => v.id === this.odabrano!.id) ?? null;
          this.prikaziTrasu();
        }
        this.dohvatiTrase();
        if (this.prviPut && this.spremna) this.pocetniPogled();
      },
      error: () => {
        this.greska = true;
        this.ucitano = true;
      },
    });
  }

  private dohvatiTrase(): void {
    const nove = [
      ...new Set(
        this.vozila
          .map((v) => v.oblik)
          .filter((o): o is string => !!o && !this.kretanje.imaTrasu(o) && !this.trazeneTrase.has(o)),
      ),
    ];
    for (let i = 0; i < nove.length; i += 150) {
      const dio = nove.slice(i, i + 150);
      dio.forEach((o) => this.trazeneTrase.add(o));
      this.servis.oblici(dio).subscribe({
        next: (res) => {
          for (const [id, tocke] of Object.entries(res.oblici ?? {})) {
            this.kretanje.dodajTrasu(id, tocke);
          }
          this.prikaziTrasu();
        },
        // Neuspjelo se pokušava opet kod sljedećeg osvježavanja.
        error: () => dio.forEach((o) => this.trazeneTrase.delete(o)),
      });
    }
  }

  // ---------- Prikaz ----------

  get prikazana(): VoziloKarta[] {
    return this.vozila.filter(
      (v) =>
        (!this.samoPodsused || v.podsused) &&
        (!this.filterLinija || v.linija === this.filterLinija),
    );
  }

  get brojPodsused(): number {
    return this.vozila.filter((v) => v.podsused).length;
  }

  /** Koliko je star ZET-ov feed, u sekundama. */
  get starostFeeda(): number | null {
    return this.vrijemeFeeda
      ? Math.max(0, Math.round((this.sad - Date.parse(this.vrijemeFeeda)) / 1000))
      : null;
  }

  starost(v: VoziloKarta): number {
    return Math.max(0, Math.round(this.sad / 1000 - v.ts));
  }

  opisStarosti(s: number): string {
    if (s < 60) return `prije ${s} s`;
    return `prije ${Math.floor(s / 60)} min ${s % 60} s`;
  }

  get rezultati(): Rezultat[] {
    const q = bezKvacica(this.trazi.trim());
    if (!q) return [];
    const rez: Rezultat[] = [];

    const linije = new Map<string, number>();
    for (const v of this.vozila) {
      if (v.linija && bezKvacica(v.linija).startsWith(q)) {
        linije.set(v.linija, (linije.get(v.linija) ?? 0) + 1);
      }
    }
    [...linije]
      .sort((a, b) => a[0].length - b[0].length || a[0].localeCompare(b[0], 'hr', { numeric: true }))
      .slice(0, 4)
      .forEach(([l, n]) =>
        rez.push({ vrsta: 'linija', naslov: `Linija ${l}`, opis: `${n} na karti`, linija: l }),
      );

    for (const v of this.vozila) {
      const ime = v.vozac?.ime ? bezKvacica(v.vozac.ime) : '';
      if ((ime && ime.includes(q)) || v.id.startsWith(q)) {
        rez.push({
          vrsta: 'vozilo',
          naslov: v.vozac?.ime ?? `Vozilo ${v.id}`,
          opis: `${v.linija ?? '?'}${v.vr ? ' · V.R. ' + v.vr : ''} · ${v.id}`,
          vozilo: v,
        });
      }
      if (rez.length >= 10) break;
    }
    return rez;
  }

  odaberiRezultat(r: Rezultat): void {
    this.trazi = '';
    if (r.vrsta === 'linija' && r.linija) {
      this.postaviLiniju(r.linija);
    } else if (r.vozilo) {
      this.odaberi(r.vozilo, true);
    }
  }

  postaviLiniju(l: string | null): void {
    this.filterLinija = l;
    this.zatvori();
    if (l) this.prilagodiPogled(this.prikazana);
  }

  prebaciPodsused(): void {
    this.samoPodsused = !this.samoPodsused;
    if (this.odabrano && !this.prikazana.includes(this.odabrano)) this.zatvori();
  }

  odaberi(v: VoziloKarta, priblizi: boolean): void {
    this.odabrano = v;
    this.prati = true;
    this.prikaziTrasu();
    const p = this.kretanje.pozicija(v.id, Date.now());
    if (p && this.mapa) {
      // Vozilo iznad kartice s detaljima, ne iza nje.
      this.mapa.easeTo({
        center: [p.lon, p.lat],
        zoom: priblizi ? Math.max(this.mapa.getZoom(), 14.5) : this.mapa.getZoom(),
        padding: { top: 0, left: 0, right: 0, bottom: PADDING_KARTICE },
        duration: 600,
      });
    }
  }

  zatvori(): void {
    if (this.odabrano) this.mapa?.easeTo({ padding: { top: 0, left: 0, right: 0, bottom: 0 }, duration: 300 });
    this.odabrano = null;
    this.prikaziTrasu();
  }

  pratiOpet(): void {
    this.prati = true;
  }

  private pocetniPogled(): void {
    if (!this.vozila.length) return;
    this.prviPut = false;
    const podsused = this.vozila.filter((v) => v.podsused);
    this.prilagodiPogled(podsused.length >= 2 ? podsused : this.vozila, 0);
  }

  private prilagodiPogled(vozila: VoziloKarta[], trajanje = 700): void {
    if (!this.mapa || !vozila.length) return;
    let [w, s, e, n] = [180, 90, -180, -90];
    for (const v of vozila) {
      w = Math.min(w, v.lon);
      e = Math.max(e, v.lon);
      s = Math.min(s, v.lat);
      n = Math.max(n, v.lat);
    }
    this.mapa.fitBounds(
      [
        [w, s],
        [e, n],
      ],
      { padding: { top: 120, bottom: 60, left: 40, right: 40 }, maxZoom: 14, duration: trajanje },
    );
  }

  // ---------- MapLibre ----------

  private postaviSlojeve(mapa: MapaLibre): void {
    mapa.addImage('strelica', strelica(), { sdf: true, pixelRatio: 2 });
    mapa.addSource('trasa', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    mapa.addSource('vozila', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

    mapa.addLayer({
      id: 'trasa-rub',
      type: 'line',
      source: 'trasa',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': 0.9 },
    });
    mapa.addLayer({
      id: 'trasa-linija',
      type: 'line',
      source: 'trasa',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#2563eb', 'line-width': 4, 'line-opacity': 0.75 },
    });

    // Stajališta na trasi odabranog vozila: bijele točke s plavim rubom.
    mapa.addSource('stajalista', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    mapa.addLayer({
      id: 'stajalista-tocka',
      type: 'circle',
      source: 'stajalista',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          11,
          ['case', ['get', 'sljedece'], 4.5, 2.5],
          14,
          ['case', ['get', 'sljedece'], 7, 4.5],
          17,
          ['case', ['get', 'sljedece'], 9, 6.5],
        ],
        'circle-color': ['case', ['get', 'sljedece'], '#2563eb', '#ffffff'],
        'circle-stroke-color': '#2563eb',
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 11, 1.5, 15, 2.5],
      },
    });
    mapa.addLayer({
      id: 'stajalista-naziv',
      type: 'symbol',
      source: 'stajalista',
      minzoom: 14,
      layout: {
        'text-field': ['get', 'naziv'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11.5,
        'text-anchor': 'left',
        'text-offset': [0.9, 0],
        'text-optional': true,
      },
      paint: { 'text-color': '#1e3a8a', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
    });

    const velicina = (podsused: number, ostali: number) =>
      ['case', ['get', 'podsused'], podsused, ostali] as any;

    mapa.addLayer({
      id: 'vozila-strelica',
      type: 'symbol',
      source: 'vozila',
      minzoom: 12,
      layout: {
        'icon-image': 'strelica',
        'icon-rotate': ['get', 'smjer'],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.9, 15, 1.35],
      },
      paint: { 'icon-color': ['get', 'boja'], 'icon-opacity': ['get', 'opacity'] },
    });
    mapa.addLayer({
      id: 'vozila-krug',
      type: 'circle',
      source: 'vozila',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10,
          velicina(4.5, 3),
          12,
          velicina(8, 5.5),
          15,
          velicina(12, 10),
        ],
        'circle-color': ['get', 'boja'],
        'circle-opacity': ['get', 'opacity'],
        'circle-stroke-color': ['case', ['get', 'odabrano'], '#0f172a', '#ffffff'],
        'circle-stroke-width': ['case', ['get', 'odabrano'], 3, 1.5],
        'circle-stroke-opacity': ['get', 'opacity'],
      },
    });
    mapa.addLayer({
      id: 'vozila-tekst',
      type: 'symbol',
      source: 'vozila',
      minzoom: 12,
      layout: {
        'text-field': ['get', 'linija'],
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 12, 8, 15, 11],
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: { 'text-color': '#ffffff', 'text-opacity': ['get', 'opacity'] },
    });
    mapa.addLayer({
      id: 'vozila-ime',
      type: 'symbol',
      source: 'vozila',
      minzoom: 14.5,
      filter: ['has', 'ime'],
      layout: {
        'text-field': ['get', 'ime'],
        'text-font': ['Noto Sans Bold'],
        'text-size': 11,
        'text-offset': [0, 1.6],
        'text-anchor': 'top',
        'text-optional': true,
      },
      paint: { 'text-color': '#0f172a', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
    });

    this.spremna = true;
    if (this.prviPut && this.vozila.length) this.zone.run(() => this.pocetniPogled());
    this.prikaziTrasu();
    this.petlja();
  }

  private prikaziTrasu(): void {
    const izvor = this.mapa?.getSource('trasa') as GeoJSONSource | undefined;
    if (!izvor) return;
    const t = this.odabrano ? this.kretanje.trasa(this.odabrano.oblik) : undefined;
    izvor.setData({
      type: 'FeatureCollection',
      features: t
        ? [
            {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: t.tocke.map(([lat, lon]) => [lon, lat]) },
            },
          ]
        : [],
    });
    this.prikaziStajalista();
  }

  /** Stajališta trase odabranog vozila (bez odabira se ne prikazuju). */
  private prikaziStajalista(): void {
    const izvor = this.mapa?.getSource('stajalista') as GeoJSONSource | undefined;
    if (!izvor) return;
    const oblik = this.odabrano?.oblik ?? null;
    const lista = oblik ? this.stajalista.get(oblik) : undefined;

    if (oblik && !lista && !this.trazenaStajalista.has(oblik)) {
      this.trazenaStajalista.add(oblik);
      this.servis.stajalista(oblik).subscribe({
        next: (res) => {
          this.stajalista.set(oblik, res.stajalista ?? []);
          if (this.odabrano?.oblik === oblik) this.prikaziStajalista();
        },
        error: () => this.trazenaStajalista.delete(oblik),
      });
    }

    const sljedeci = this.sljedece?.indeks ?? -1;
    this.prikazaniSljedeci = sljedeci;
    izvor.setData({
      type: 'FeatureCollection',
      features: (lista ?? []).map((s, i) => ({
        type: 'Feature',
        properties: { naziv: s.naziv, sljedece: i === sljedeci },
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
      })),
    });
  }

  /** Udaljenosti stajališta po trasi – računa se jednom po trasi. */
  private udaljenostiZa(oblik: string): number[] | null {
    const gotovo = this.udaljenostiStajalista.get(oblik);
    if (gotovo) return gotovo;
    const t = this.kretanje.trasa(oblik);
    const lista = this.stajalista.get(oblik);
    if (!t || !lista?.length) return null;
    const u = stajalistaNaTrasi(t, lista);
    this.udaljenostiStajalista.set(oblik, u);
    return u;
  }

  /** Sljedeće stajalište odabranog vozila, iz njegove pozicije na trasi. */
  get sljedece(): { indeks: number; naziv: string; naStajalistu: boolean; zatim: string | null } | null {
    const v = this.odabrano;
    if (!v?.oblik) return null;
    const u = this.udaljenostiZa(v.oblik);
    const d = this.kretanje.naTrasi(v.id, this.sad);
    const lista = this.stajalista.get(v.oblik);
    if (!u || d === null || !lista) return null;
    const s = sljedeceStajaliste(u, d);
    if (!s) return null;
    // Na stajalištu: sljedeće je ono iza njega.
    const zatim = lista[s.indeks + 1]?.naziv ?? null;
    return { indeks: s.indeks, naziv: lista[s.indeks].naziv, naStajalistu: s.naStajalistu, zatim };
  }

  /** Svake sekunde: ako se sljedeće stajalište promijenilo, istakni ga na karti. */
  private osvjeziSljedece(): void {
    if (!this.odabrano) return;
    if ((this.sljedece?.indeks ?? -1) !== this.prikazaniSljedeci) this.prikaziStajalista();
  }

  /** requestAnimationFrame izvan Angulara – bez change detectiona svaki frame. */
  private petlja(): void {
    const korak = (t: number) => {
      this.frame = requestAnimationFrame(korak);
      if (document.hidden || t - this.zadnjiFrame < FRAME_MS) return;
      this.zadnjiFrame = t;
      this.nacrtaj();
    };
    this.zone.runOutsideAngular(() => (this.frame = requestAnimationFrame(korak)));
  }

  private nacrtaj(): void {
    const izvor = this.mapa?.getSource('vozila') as GeoJSONSource | undefined;
    if (!izvor) return;
    const sad = Date.now();
    const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
    let odabranaPozicija: [number, number] | null = null;

    for (const v of this.prikazana) {
      const p = this.kretanje.pozicija(v.id, sad);
      if (!p) continue;
      const odabrano = this.odabrano?.id === v.id;
      if (odabrano) odabranaPozicija = [p.lon, p.lat];
      const props: Record<string, unknown> = {
        id: v.id,
        linija: v.linija ?? '',
        smjer: p.smjer,
        boja: bojaKasnjenja(v.kasnjenje),
        opacity: sad / 1000 - v.ts > STARO_S ? 0.45 : 1,
        podsused: v.podsused,
        odabrano,
      };
      if (v.vozac?.ime) props['ime'] = v.vozac.ime;
      features.push({
        type: 'Feature',
        properties: props,
        geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      });
    }
    // Odabrano vozilo se crta zadnje – iznad ostalih.
    features.sort((a, b) => Number(a.properties!['odabrano']) - Number(b.properties!['odabrano']));
    izvor.setData({ type: 'FeatureCollection', features });

    if (odabranaPozicija && this.prati && this.mapa && !this.mapa.isMoving()) {
      this.mapa.setCenter(odabranaPozicija);
    }
  }
}
