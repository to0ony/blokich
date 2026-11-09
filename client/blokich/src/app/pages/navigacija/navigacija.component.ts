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
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import type { GeoJSONSource, Map as MapaLibre } from 'maplibre-gl';
import {
  KartaService,
  ManevarKarta,
  StajalisteKarta,
} from '../../services/karta.service';
import {
  Trasa,
  napraviTrasu,
  projiciraj,
  stajalistaNaTrasi,
  tockaNa,
} from '../../components/karta/kretanje';
import { BOJE, STIL, Tema, oznakaVozila, temaKarte, ucitajCss } from '../../components/karta/karta-stil';
import {
  govorManevra,
  kutStrelice,
  opisManevra,
  opisUdaljenosti,
} from '../../components/karta/navigacija-tekst';

type Nacin = 'gps' | 'proba';

const POSTAVKE_KEY = 'navigacija-postavke';
/** Dalje od trase od ovoga = vozač nije na ruti. */
const IZVAN_RUTE_M = 60;
/** Probna vožnja: osnovna brzina (m/s, ~35 km/h) i stajanje na stajalištu (s). */
const PROBA_BRZINA = 9.7;
const PROBA_STAJANJE_S = 4;
/** Najave: manevar unaprijed i neposredno prije, stajalište unaprijed. */
const NAJAVA_DALEKO_M = 250;
const NAJAVA_BLIZU_M = 45;
const NAJAVA_STAJALISTA_M = 180;

interface Postavke {
  treceD: boolean;
  glas: boolean;
}

function ucitajPostavke(): Postavke {
  try {
    const p = JSON.parse(localStorage.getItem(POSTAVKE_KEY) ?? '{}');
    return { treceD: p.treceD !== false, glas: p.glas !== false };
  } catch {
    return { treceD: true, glas: true };
  }
}

function razlikaKuta(a: number, b: number): number {
  return ((b - a + 540) % 360) - 180;
}

/**
 * Navigacija po trasi linije: prava lokacija telefona (ili probna vožnja),
 * karta okrenuta u smjeru vožnje, 2D/3D, skretanja i stajališta s glasom.
 */
@Component({
  selector: 'app-navigacija',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navigacija.component.html',
  styleUrl: './navigacija.component.scss',
})
export class NavigacijaComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapa', { static: true }) mapaEl!: ElementRef<HTMLDivElement>;

  private readonly servis = inject(KartaService);
  private readonly zone = inject(NgZone);
  private readonly lokacija = inject(Location);

  readonly oblik: string | null;
  readonly linija: string | null;
  readonly cilj: string | null;
  nacin: Nacin;
  treceD: boolean;
  glas: boolean;
  readonly tema: Tema = temaKarte();

  ucitano = false;
  greska: string | null = null;
  gpsGreska: string | null = null;
  cekamGps = false;
  izvanRute = false;
  pratim = true;
  kraj = false;
  izvorSkretanja: 'osrm' | 'geometrija' | null = null;

  // Probna vožnja
  pauza = false;
  ubrzanje = 4;
  readonly ubrzanja = [1, 4, 8];

  // Prikaz (osvježava se ~3× u sekundi, ne svaki frame)
  sljedeciManevar: ManevarKarta | null = null;
  doManevra = 0;
  sljedeceStajaliste: string | null = null;
  doStajalista = 0;
  zatimStajaliste: string | null = null;
  readonly opisManevra = opisManevra;
  readonly opisUdaljenosti = opisUdaljenosti;
  readonly kutStrelice = kutStrelice;

  private mapa: MapaLibre | null = null;
  private trasa: Trasa | null = null;
  private stajalista: StajalisteKarta[] = [];
  private udaljenosti: number[] = [];
  private manevri: ManevarKarta[] = [];

  /** Prikazana pozicija po trasi (m) i ona prema kojoj se ide. */
  private d = 0;
  private dCilj = 0;
  private brzina = 0;
  private zadnjiFix = 0;
  /** Sirova GPS pozicija kad vozač nije na ruti. */
  private sirovo: { lat: number; lon: number } | null = null;
  private smjer = 0;
  private stajanjeDo = 0;
  private izgovoreno = new Set<string>();

  private watchId: number | null = null;
  private wakeLock: { release(): Promise<void> } | null = null;
  private frame = 0;
  private zadnjiFrame = 0;
  private uiTimer: ReturnType<typeof setInterval> | null = null;
  private unisten = false;
  private readonly naVidljivost = () => {
    if (document.visibilityState === 'visible') void this.zakljucajEkran();
  };

  constructor() {
    const q = inject(ActivatedRoute).snapshot.queryParamMap;
    this.oblik = q.get('oblik');
    this.linija = q.get('linija');
    this.cilj = q.get('cilj');
    this.nacin = q.get('proba') ? 'proba' : 'gps';
    const p = ucitajPostavke();
    this.treceD = p.treceD;
    this.glas = p.glas;
  }

  async ngAfterViewInit(): Promise<void> {
    if (!this.oblik) {
      this.greska = 'Nije odabrana trasa.';
      return;
    }
    this.ucitajPodatke(this.oblik);
    ucitajCss();
    const maplibregl = (await import('maplibre-gl')).default;
    if (this.unisten) return;
    this.zone.runOutsideAngular(() => {
      const mapa = new maplibregl.Map({
        container: this.mapaEl.nativeElement,
        style: STIL[this.tema],
        center: [15.93, 45.81],
        zoom: 15,
        pitch: this.treceD ? 55 : 0,
        attributionControl: { compact: true },
      });
      mapa.on('style.load', () => this.postaviSlojeve(mapa));
      // Vozač pomakne kartu → prestani pratiti dok ne stisne "Centriraj".
      mapa.on('dragstart', () => this.zone.run(() => (this.pratim = false)));
      this.mapa = mapa;
    });

    document.addEventListener('visibilitychange', this.naVidljivost);
    void this.zakljucajEkran();
    this.uiTimer = setInterval(() => this.osvjeziPrikaz(), 300);
  }

  ngOnDestroy(): void {
    this.unisten = true;
    this.zaustaviGps();
    cancelAnimationFrame(this.frame);
    if (this.uiTimer) clearInterval(this.uiTimer);
    document.removeEventListener('visibilitychange', this.naVidljivost);
    void this.wakeLock?.release().catch(() => {});
    try {
      speechSynthesis.cancel();
    } catch {}
    this.mapa?.remove();
  }

  // ---------- Podaci ----------

  private ucitajPodatke(oblik: string): void {
    forkJoin({
      oblici: this.servis.oblici([oblik]),
      stajalista: this.servis.stajalista(oblik),
    }).subscribe({
      next: ({ oblici, stajalista }) => {
        const tocke = oblici.oblici?.[oblik];
        if (!tocke?.length) {
          this.greska = 'Trasa nije pronađena.';
          return;
        }
        this.trasa = napraviTrasu(tocke);
        this.stajalista = stajalista.stajalista ?? [];
        this.udaljenosti = stajalistaNaTrasi(this.trasa, this.stajalista);
        this.ucitano = true;
        this.smjer = tockaNa(this.trasa, 20).smjer;
        this.postaviTrasu();
        if (this.nacin === 'gps') this.pokreniGps();
        this.petlja();
      },
      error: () => (this.greska = 'Trasa se ne može učitati.'),
    });
    // Skretanja stižu zasebno – bez njih navigacija radi sa stajalištima.
    this.servis.navigacija(oblik).subscribe({
      next: (n) => {
        this.manevri = n.manevri ?? [];
        this.izvorSkretanja = n.izvor;
      },
      error: () => {},
    });
  }

  // ---------- GPS ----------

  private pokreniGps(): void {
    if (!('geolocation' in navigator)) {
      this.gpsGreska = 'Ovaj uređaj ne daje lokaciju.';
      return;
    }
    this.cekamGps = true;
    this.watchId = navigator.geolocation.watchPosition(
      (p) => this.zone.runOutsideAngular(() => this.naLokaciju(p)),
      (e) =>
        this.zone.run(() => {
          this.cekamGps = false;
          this.gpsGreska =
            e.code === e.PERMISSION_DENIED
              ? 'Lokacija nije dopuštena. Uključi je u postavkama preglednika.'
              : 'Lokacija trenutno nije dostupna.';
        }),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20_000 },
    );
  }

  private zaustaviGps(): void {
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
  }

  private naLokaciju(p: GeolocationPosition): void {
    if (!this.trasa) return;
    if (this.cekamGps || this.gpsGreska) {
      this.zone.run(() => {
        this.cekamGps = false;
        this.gpsGreska = null;
      });
    }
    const { latitude: lat, longitude: lon, speed } = p.coords;
    const prvi = this.zadnjiFix === 0;
    const proj = projiciraj(this.trasa, lat, lon, prvi ? undefined : this.dCilj);
    const izvan = proj.razmak > IZVAN_RUTE_M;
    if (izvan !== this.izvanRute) this.zone.run(() => (this.izvanRute = izvan));

    if (izvan) {
      this.sirovo = { lat, lon };
    } else {
      this.sirovo = null;
      // GPS na mjestu šeta – ne vraćaj se unatrag za malo.
      const d = proj.d < this.dCilj && this.dCilj - proj.d < 25 ? this.dCilj : proj.d;
      if (prvi || Math.abs(d - this.d) > 400) this.d = d; // prvi fiks ili veliki skok
      this.dCilj = d;
    }
    this.brzina = typeof speed === 'number' && speed > 0.5 ? speed : 0;
    this.zadnjiFix = performance.now();
  }

  // ---------- Probna vožnja ----------

  prebaciPauzu(): void {
    this.pauza = !this.pauza;
  }

  postaviUbrzanje(u: number): void {
    this.ubrzanje = u;
  }

  /** Bez GPS-a (ili kod kuće): ista trasa kao probna vožnja. */
  probnaVoznja(): void {
    this.zaustaviGps();
    this.nacin = 'proba';
    this.gpsGreska = null;
    this.cekamGps = false;
    this.izvanRute = false;
    this.sirovo = null;
    this.ispocetka();
  }

  ispocetka(): void {
    this.d = this.dCilj = 0;
    this.kraj = false;
    this.pauza = false;
    this.izgovoreno.clear();
    this.stajanjeDo = 0;
  }

  // ---------- Postavke ----------

  private spremi(): void {
    try {
      localStorage.setItem(POSTAVKE_KEY, JSON.stringify({ treceD: this.treceD, glas: this.glas }));
    } catch {}
  }

  prebaciTreceD(): void {
    this.treceD = !this.treceD;
    this.spremi();
    this.mapa?.easeTo({ pitch: this.treceD ? 55 : 0, duration: 500 });
    if (this.mapa?.getLayer('zgrade-3d')) {
      this.mapa.setLayoutProperty('zgrade-3d', 'visibility', this.treceD ? 'visible' : 'none');
    }
  }

  prebaciGlas(): void {
    this.glas = !this.glas;
    this.spremi();
    if (!this.glas) {
      try {
        speechSynthesis.cancel();
      } catch {}
    } else {
      this.reci('Glasovne najave uključene.');
    }
  }

  centriraj(): void {
    this.pratim = true;
  }

  izadi(): void {
    this.lokacija.back();
  }

  private async zakljucajEkran(): Promise<void> {
    try {
      const wl = (navigator as any).wakeLock;
      if (wl && !this.unisten) this.wakeLock = await wl.request('screen');
    } catch {
      // Nije podržano ili odbijeno – ekran se može ugasiti.
    }
  }

  // ---------- Glas ----------

  private reci(tekst: string): void {
    if (!this.glas || typeof speechSynthesis === 'undefined') return;
    try {
      const u = new SpeechSynthesisUtterance(tekst);
      u.lang = 'hr-HR';
      const hr = speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith('hr'));
      if (hr) u.voice = hr;
      u.rate = 1.05;
      speechSynthesis.speak(u);
    } catch {}
  }

  /** Jednom po događaju: manevar daleko/blizu, sljedeće stajalište, kraj. */
  private najave(): void {
    if (this.izvanRute) return;
    const m = this.manevri.find((x) => x.d > this.d + 5);
    if (m) {
      const do_ = m.d - this.d;
      const k = `m${m.d}`;
      if (do_ <= NAJAVA_BLIZU_M && !this.izgovoreno.has(k + 'b')) {
        this.izgovoreno.add(k + 'b').add(k + 'd');
        this.reci(govorManevra(m, null));
      } else if (do_ <= NAJAVA_DALEKO_M && do_ > NAJAVA_BLIZU_M * 2 && !this.izgovoreno.has(k + 'd')) {
        this.izgovoreno.add(k + 'd');
        this.reci(govorManevra(m, do_));
      }
    }
    const i = this.udaljenosti.findIndex((u) => u > this.d + 10);
    if (i >= 0 && this.udaljenosti[i] - this.d <= NAJAVA_STAJALISTA_M && !this.izgovoreno.has(`s${i}`)) {
      this.izgovoreno.add(`s${i}`);
      const zadnje = i === this.stajalista.length - 1;
      this.reci(`${zadnje ? 'Zadnje stajalište' : 'Sljedeće stajalište'}: ${this.stajalista[i].naziv}.`);
    }
  }

  // ---------- Prikaz ----------

  private osvjeziPrikaz(): void {
    if (!this.trasa) return;
    const m = this.manevri.find((x) => x.d > this.d + 5) ?? null;
    this.sljedeciManevar = m;
    this.doManevra = m ? m.d - this.d : 0;
    const i = this.udaljenosti.findIndex((u) => u > this.d + 10);
    this.sljedeceStajaliste = i >= 0 ? this.stajalista[i].naziv : null;
    this.doStajalista = i >= 0 ? this.udaljenosti[i] - this.d : 0;
    this.zatimStajaliste = i >= 0 ? (this.stajalista[i + 1]?.naziv ?? null) : null;
    this.kraj = this.d >= this.trasa.duljina - 15;
    this.najave();
  }

  // ---------- MapLibre ----------

  private postaviSlojeve(mapa: MapaLibre): void {
    const b = BOJE[this.tema];
    const prazno: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
    if (!mapa.hasImage('vozilo')) mapa.addImage('vozilo', oznakaVozila(), { sdf: true, pixelRatio: 2 });
    for (const izvor of ['ispred', 'iza', 'stajalista', 'ja']) {
      if (!mapa.getSource(izvor)) mapa.addSource(izvor, { type: 'geojson', data: prazno });
    }

    // 3D zgrade iz podloge (OpenMapTiles), samo u 3D načinu.
    if (mapa.getSource('openmaptiles')) {
      mapa.addLayer({
        id: 'zgrade-3d',
        type: 'fill-extrusion',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 14,
        layout: { visibility: this.treceD ? 'visible' : 'none' },
        paint: {
          'fill-extrusion-color': this.tema === 'tamna' ? '#1f2937' : '#dfe3e8',
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.75,
        },
      });
    }

    mapa.addLayer({
      id: 'iza',
      type: 'line',
      source: 'iza',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': b.trasa, 'line-width': 7, 'line-opacity': 0.3 },
    });
    mapa.addLayer({
      id: 'ispred-rub',
      type: 'line',
      source: 'ispred',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': b.rub, 'line-width': 12 },
    });
    mapa.addLayer({
      id: 'ispred',
      type: 'line',
      source: 'ispred',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': b.trasa, 'line-width': 8 },
    });
    mapa.addLayer({
      id: 'stajalista',
      type: 'circle',
      source: 'stajalista',
      paint: {
        'circle-radius': 6,
        'circle-color': b.stajalisteIspuna,
        'circle-stroke-color': b.trasa,
        'circle-stroke-width': 3,
        'circle-pitch-alignment': 'map',
      },
    });
    mapa.addLayer({
      id: 'stajalista-naziv',
      type: 'symbol',
      source: 'stajalista',
      layout: {
        'text-field': ['get', 'naziv'],
        'text-font': ['Noto Sans Bold'],
        'text-size': 13,
        'text-anchor': 'left',
        'text-offset': [1, 0],
        'text-optional': true,
      },
      paint: { 'text-color': b.stajalisteNaziv, 'text-halo-color': b.stajalisteIspuna, 'text-halo-width': 2 },
    });
    mapa.addLayer({
      id: 'ja',
      type: 'symbol',
      source: 'ja',
      layout: {
        'icon-image': 'vozilo',
        'icon-rotate': ['get', 'smjer'],
        'icon-rotation-alignment': 'map',
        'icon-pitch-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-size': 1.15,
      },
      paint: { 'icon-color': b.odabrano, 'icon-halo-color': '#ffffff', 'icon-halo-width': 2.5 },
    });
    this.postaviTrasu();
  }

  /** Stajališta (jednom) – trasa ispred/iza se crta u svakom frameu. */
  private postaviTrasu(): void {
    const izvor = this.mapa?.getSource('stajalista') as GeoJSONSource | undefined;
    if (!izvor || !this.trasa) return;
    izvor.setData({
      type: 'FeatureCollection',
      features: this.stajalista.map((s) => ({
        type: 'Feature',
        properties: { naziv: s.naziv },
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
      })),
    });
    if (this.mapa && !this.zadnjiFix) {
      const p = tockaNa(this.trasa, 0);
      this.mapa.jumpTo({ center: [p.lon, p.lat], bearing: p.smjer, zoom: 16.5 });
    }
  }

  private petlja(): void {
    let prije = performance.now();
    const korak = (t: number) => {
      this.frame = requestAnimationFrame(korak);
      if (document.hidden || t - this.zadnjiFrame < 33) return;
      const dt = Math.min(0.2, (t - prije) / 1000);
      prije = t;
      this.zadnjiFrame = t;
      this.pomakni(dt, t);
      this.nacrtaj(dt);
    };
    this.zone.runOutsideAngular(() => (this.frame = requestAnimationFrame(korak)));
  }

  /** Napredovanje po trasi: GPS (glatko prema zadnjem fiksu) ili probna vožnja. */
  private pomakni(dt: number, t: number): void {
    if (!this.trasa) return;
    if (this.nacin === 'proba') {
      if (this.pauza || this.kraj) return;
      if (t < this.stajanjeDo) return;
      const prije = this.d;
      this.d = Math.min(this.trasa.duljina, this.d + PROBA_BRZINA * this.ubrzanje * dt);
      // Kratko stani na svakom stajalištu.
      const st = this.udaljenosti.find((u) => u > prije && u <= this.d);
      if (st !== undefined && st > 5) {
        this.d = st;
        this.stajanjeDo = t + (PROBA_STAJANJE_S * 1000) / this.ubrzanje;
      }
      this.dCilj = this.d;
      return;
    }
    // GPS: fiks dolazi ~1× u sekundi; između njih procijeni brzinom, pa se glatko primakni.
    const odFiksa = Math.min(2, (t - this.zadnjiFix) / 1000);
    const cilj = this.dCilj + this.brzina * odFiksa;
    this.d += (cilj - this.d) * Math.min(1, dt * 3);
  }

  private nacrtaj(dt: number): void {
    const mapa = this.mapa;
    const t = this.trasa;
    if (!mapa || !t || !mapa.getSource('ja')) return;

    let lat: number;
    let lon: number;
    if (this.sirovo) {
      ({ lat, lon } = this.sirovo);
    } else {
      const p = tockaNa(t, this.d);
      lat = p.lat;
      lon = p.lon;
      // Smjer kamere: trasa malo ispred, glatko – bez trzanja na lomovima.
      const ispred = tockaNa(t, Math.min(t.duljina, this.d + 25));
      const cilj = Math.atan2((ispred.lon - lon) * Math.cos((lat * Math.PI) / 180), ispred.lat - lat);
      const smjer = ((cilj * 180) / Math.PI + 360) % 360;
      if (Math.abs(ispred.lat - lat) + Math.abs(ispred.lon - lon) > 1e-6) {
        this.smjer = (this.smjer + razlikaKuta(this.smjer, smjer) * Math.min(1, dt * 2.5) + 360) % 360;
      }
    }

    (mapa.getSource('ja') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { smjer: this.smjer },
          geometry: { type: 'Point', coordinates: [lon, lat] },
        },
      ],
    });

    // Trasa: prijeđeni dio blijedo, ostatak jako.
    const idx = t.d.findIndex((x) => x > this.d);
    const rez = idx < 0 ? t.tocke.length : idx;
    const tu = [lon, lat];
    const iza = [...t.tocke.slice(0, rez).map(([a, o]) => [o, a]), tu];
    const ispred = [tu, ...t.tocke.slice(rez).map(([a, o]) => [o, a])];
    (mapa.getSource('iza') as GeoJSONSource).setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: iza },
    });
    (mapa.getSource('ispred') as GeoJSONSource).setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: ispred },
    });

    if (this.pratim && !mapa.isMoving()) {
      // Brže = šira slika ispred.
      const kmh = (this.nacin === 'proba' ? PROBA_BRZINA * Math.min(this.ubrzanje, 2) : this.brzina) * 3.6;
      const zoom = kmh > 45 ? 16 : kmh > 25 ? 16.6 : 17.2;
      const h = this.mapaEl.nativeElement.clientHeight;
      mapa.jumpTo({
        center: [lon, lat],
        bearing: this.smjer,
        pitch: this.treceD ? 55 : 0,
        zoom: mapa.getZoom() + (zoom - mapa.getZoom()) * Math.min(1, dt),
        // Vozilo u donjem dijelu ekrana – više se vidi ispred.
        padding: { top: h * 0.42, bottom: 0, left: 0, right: 0 },
      });
    }
  }
}
