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
  LinijaKarta,
  ManevarKarta,
  StajalisteKarta,
} from '../../services/karta.service';
import { Pracenje, Status, smjerIzmedu, trasaOdgovara, udaljenost } from '../../components/karta/pracenje';
import {
  Trasa,
  napraviTrasu,
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
/** Ručni zoom vrijedi ovoliko, pa se vraća na optimalni. */
const ZOOM_POVRATAK_MS = 6000;
/** Koliko često (ms) najviše tražiti drugi smjer linije kad trenutni ne odgovara. */
const PROVJERA_DRUGIH_MS = 3000;
/** Probna vožnja: osnovna brzina (m/s, ~35 km/h) i stajanje na stajalištu (s). */
const PROBA_BRZINA = 9.7;
const PROBA_STAJANJE_S = 4;
/** Najave: manevar unaprijed i neposredno prije, stajalište unaprijed. */
const NAJAVA_DALEKO_M = 250;
const NAJAVA_BLIZU_M = 45;
const NAJAVA_STAJALISTA_M = 180;

/** Ono što slijedi na ruti: skretanje ili stajalište, s udaljenošću. */
export type Dogadaj =
  | { vrsta: 'skretanje'; d: number; do: number; manevar: ManevarKarta }
  | { vrsta: 'stajaliste'; d: number; do: number; naziv: string; zadnje: boolean };

/** Glasovne najave: sve, samo skretanja ili ništa. */
export type Glas = 'sve' | 'skretanja' | 'ne';

interface Postavke {
  treceD: boolean;
  glas: Glas;
}

function ucitajPostavke(): Postavke {
  try {
    const p = JSON.parse(localStorage.getItem(POSTAVKE_KEY) ?? '{}');
    // Starije postavke: glas je bio true/false.
    const glas: Glas =
      p.glas === 'sve' || p.glas === 'skretanja' || p.glas === 'ne' ? p.glas : p.glas === false ? 'ne' : 'sve';
    return { treceD: p.treceD !== false, glas };
  } catch {
    return { treceD: true, glas: 'sve' };
  }
}

/** Vrh strelice skretanja (SDF – boja i rub se zadaju u sloju), pokazuje prema gore. */
function vrhStrelice(): ImageData {
  const n = 64;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.beginPath();
  g.moveTo(32, 8);
  g.lineTo(54, 46);
  g.lineTo(10, 46);
  g.closePath();
  g.fill();
  return g.getImageData(0, 0, n, n);
}

/** Strelica skretanja: ovoliko trase prije i poslije raskrižja. */
const STRELICA_PRIJE_M = 30;
const STRELICA_POSLIJE_M = 22;

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
  /** Trasa i smjer koji se sad prate – mijenjaju se na okretištu ili kod krivog smjera. */
  oblikTrenutni: string | null;
  cilj: string | null;
  /** Oba smjera linije (za automatski prelazak); prazno ako linija nije poznata. */
  private smjeroviLinije: LinijaKarta['smjerovi'] = [];
  private traseSmjerova = new Map<string, Trasa>();
  private zadnjaProvjeraDrugih = 0;
  /** Praćenje GPS-a po trasi i njegov zadnji status. */
  private pracenje: Pracenje | null = null;
  status: Status = 'slab-signal';
  netocnost = 0;
  /** Kad vozač nije na ruti: udaljenost i kut strelice prema ruti (na ekranu). */
  doRute: { m: number; kut: number } | null = null;
  private doRuteTocka: { lat: number; lon: number } | null = null;
  /** Kratka obavijest gore (npr. "Prebačeno na smjer …"). */
  obavijest: string | null = null;
  private obavijestDo = 0;
  nacin: Nacin;
  treceD: boolean;
  glas: Glas;
  izborGlasa = false;
  readonly opcijeGlasa: { vrijednost: Glas; naziv: string; opis: string }[] = [
    { vrijednost: 'sve', naziv: 'Skretanja i stajališta', opis: 'Najavljuje skretanja i sljedeće stajalište' },
    { vrijednost: 'skretanja', naziv: 'Samo skretanja', opis: 'Bez najave stajališta' },
    { vrijednost: 'ne', naziv: 'Isključeno', opis: 'Bez glasa' },
  ];
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

  /** Dvije kartice gore: sljedeće skretanje ili stajalište, i ono iza njega. */
  dogadaji: Dogadaj[] = [];

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
  /** Zadnji dobar GPS fiks i oznaka vozača koja mu se glatko primiče. */
  private gpsTocka: { lat: number; lon: number } | null = null;
  private prikazGps: { lat: number; lon: number } | null = null;
  private smjer = 0;
  private stajanjeDo = 0;
  /** Indeks prvog skretanja ispred vozača kad su strelice zadnji put nacrtane. */
  private prikazaniPrvi = -1;
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
    this.oblikTrenutni = this.oblik;
    this.linija = q.get('linija');
    this.cilj = q.get('cilj');
    this.nacin = q.get('proba') ? 'proba' : 'gps';
    if (this.nacin === 'proba') this.status = 'na-ruti';
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
        // Izvor karte piše sitno ispod donje trake (.nv-izvor).
        attributionControl: false,
      });
      mapa.on('style.load', () => this.postaviSlojeve(mapa));
      // Vozač pomakne kartu → prestani pratiti dok ne stisne "Centriraj".
      mapa.on('dragstart', () => this.zone.run(() => (this.pratim = false)));
      // Zumiranje prstima: kao + i − – privremeno, pa natrag na optimalni zoom.
      mapa.on('zoomend', (e) => {
        if (!(e as { originalEvent?: unknown }).originalEvent) return;
        this.zoomPomak = Math.max(-4, Math.min(2, mapa.getZoom() - this.optimalniZoom));
        this.zoomPomakDo = performance.now() + ZOOM_POVRATAK_MS;
      });
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
        this.postaviTrasuVoznje(oblik, napraviTrasu(tocke), stajalista.stajalista ?? []);
        this.ucitano = true;
        this.smjer = tockaNa(this.trasa!, 20).smjer;
        // GPS tek kad vozač potvrdi upozorenje.
        if (this.nacin === 'gps' && this.upozorenjePrihvaceno) this.pokreniGps();
        this.petlja();
      },
      error: () => (this.greska = 'Trasa se ne može učitati.'),
    });
    // Oba smjera linije – za prelazak na okretištu ili kad vozač ide suprotno.
    if (this.linija) {
      this.servis.linija(this.linija).subscribe({
        next: (l) => (this.smjeroviLinije = l?.smjerovi ?? []),
        error: () => {},
      });
    }
  }

  /** Nova trasa za praćenje: stajališta, skretanja, praćenje GPS-a ispočetka. */
  private postaviTrasuVoznje(oblik: string, trasa: Trasa, stajalista: StajalisteKarta[], d = 0): void {
    this.oblikTrenutni = oblik;
    this.trasa = trasa;
    this.stajalista = stajalista;
    this.udaljenosti = stajalistaNaTrasi(trasa, stajalista);
    this.pracenje = new Pracenje(trasa);
    this.d = this.dCilj = d;
    this.kraj = false;
    this.izgovoreno.clear();
    this.manevri = [];
    this.prikazaniPrvi = -1;
    this.postaviTrasu();
    this.crtajStrelice();
    // Skretanja stižu zasebno – bez njih navigacija radi sa stajalištima.
    this.servis.navigacija(oblik).subscribe({
      next: (n) => {
        if (this.oblikTrenutni !== oblik) return;
        this.manevri = n.manevri ?? [];
        this.izvorSkretanja = n.izvor;
        this.prikazaniPrvi = -1;
        this.crtajStrelice();
      },
      error: () => {},
    });
  }

  /**
   * Trenutna trasa ne odgovara (krivi smjer, okretište, nešto drugo): ima li
   * drugi smjer linije koji ide ovdje i u smjeru vožnje? Ako ima, prijeđi na njega.
   */
  private probajDrugiSmjer(lat: number, lon: number): void {
    const sad = performance.now();
    if (sad - this.zadnjaProvjeraDrugih < PROVJERA_DRUGIH_MS) return;
    this.zadnjaProvjeraDrugih = sad;
    const kretanje = this.pracenje?.smjerKretanja ?? null;
    for (const sm of this.smjeroviLinije) {
      if (sm.oblik === this.oblikTrenutni || sm.tocke.length < 2) continue;
      let t = this.traseSmjerova.get(sm.oblik);
      if (!t) this.traseSmjerova.set(sm.oblik, (t = napraviTrasu(sm.tocke)));
      const k = trasaOdgovara(t, lat, lon, kretanje);
      if (!k) continue;
      this.zone.run(() => {
        this.cilj = sm.cilj;
        this.postaviTrasuVoznje(sm.oblik, t!, sm.stajalista, k.d);
        this.pracenje!.fiks(lat, lon, 10);
        this.status = 'na-ruti';
        this.sirovo = null;
        this.izvanRute = false;
        this.doRute = null;
        const poruka = sm.cilj ? `Nastavljam u smjeru ${sm.cilj}.` : 'Nastavljam u drugom smjeru.';
        this.pokaziObavijest(poruka);
        this.reci(poruka);
      });
      return;
    }
  }

  private pokaziObavijest(tekst: string): void {
    this.obavijest = tekst;
    this.obavijestDo = performance.now() + 5000;
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
    if (!this.trasa || !this.pracenje) return;
    if (this.cekamGps || this.gpsGreska) {
      this.zone.run(() => {
        this.cekamGps = false;
        this.gpsGreska = null;
      });
    }
    const { latitude: lat, longitude: lon, speed, heading, accuracy } = p.coords;
    const bioNaRuti = this.status === 'na-ruti';
    const s = this.pracenje.fiks(lat, lon, accuracy ?? 999, heading ?? null, speed ?? null);
    this.netocnost = Math.round(s.netocnost);
    this.status = s.status;
    // Loš fiks ne pomiče prikaz.
    if (!(s.netocnost <= 40)) return;
    this.gpsTocka = { lat, lon };

    if (s.status === 'na-ruti' && s.d !== null) {
      this.sirovo = null;
      // Prvi položaj ili veliki skok: odmah tamo, inače glatko (vidi pomakni).
      if (!bioNaRuti || Math.abs(s.d - this.d) > 400) this.d = s.d;
      this.dCilj = s.d;
    } else {
      this.sirovo = { lat, lon };
    }
    this.doRuteTocka = s.doRute ? { lat: s.doRute.lat, lon: s.doRute.lon } : null;
    this.izvanRute = s.status === 'izvan-rute';
    this.brzina = typeof speed === 'number' && speed > 0.5 ? speed : 0;
    this.zadnjiFix = performance.now();

    // Trasa ne odgovara ili je vožnja gotova → možda je drugi smjer linije.
    const kraj = this.trasa && s.d !== null && s.d >= this.trasa.duljina - 30;
    if (s.status === 'suprotan-smjer' || s.status === 'izvan-rute' || kraj) this.probajDrugiSmjer(lat, lon);
  }

  // ---------- Probna vožnja ----------

  prebaciPauzu(): void {
    this.pauza = !this.pauza;
  }

  postaviUbrzanje(u: number): void {
    this.ubrzanje = u;
  }

  /**
   * Upozorenje prije navigacije: gledaj cestu, ne diraj telefon u vožnji,
   * navigacija nije uvijek točna. Prikazuje se pri svakom pokretanju.
   */
  upozorenjePrihvaceno = false;

  prihvatiUpozorenje(): void {
    this.upozorenjePrihvaceno = true;
    if (this.ucitano && this.watchId === null) this.pokreniGps();
    // Dodir je i dopuštenje za glas (iOS ne govori bez dodira korisnika).
    if (this.glas !== 'ne') this.reci('Navigacija je pokrenuta. Pazi na cestu.');
  }

  /** Bez GPS-a (ili kod kuće): ista trasa kao probna vožnja. */
  probnaVoznja(): void {
    this.upozorenjePrihvaceno = true;
    this.zaustaviGps();
    this.nacin = 'proba';
    this.gpsGreska = null;
    this.cekamGps = false;
    this.izvanRute = false;
    this.sirovo = null;
    this.ispocetka();
  }

  ispocetka(): void {
    if (this.nacin === 'proba') this.status = 'na-ruti';
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

  prebaciIzborGlasa(): void {
    this.izborGlasa = !this.izborGlasa;
  }

  postaviGlas(g: Glas): void {
    this.glas = g;
    this.izborGlasa = false;
    this.spremi();
    try {
      speechSynthesis.cancel();
    } catch {}
    if (g === 'sve') this.reci('Najavljujem skretanja i stajališta.');
    if (g === 'skretanja') this.reci('Najavljujem samo skretanja.');
  }

  /**
   * Gumbi + i − (i zumiranje prstima): privremeni pomak od optimalnog zooma.
   * Nakon nekoliko sekundi bez dodira zoom se glatko vrati na optimalni.
   */
  private zoomPomak = 0;
  private zoomPomakDo = 0;
  private optimalniZoom = 17.2;

  zumiraj(smjer: 1 | -1): void {
    this.zoomPomak = Math.max(-4, Math.min(2, this.zoomPomak + smjer));
    this.zoomPomakDo = performance.now() + ZOOM_POVRATAK_MS;
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
    if (this.glas === 'ne' || typeof speechSynthesis === 'undefined') return;
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
    if (this.nacin === 'gps' && this.status !== 'na-ruti') return;
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
    if (this.glas !== 'sve') return;
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
    if (this.obavijest && performance.now() > this.obavijestDo) this.obavijest = null;
    if (this.status === 'izvan-rute' && this.sirovo && this.doRuteTocka) {
      const m = udaljenost(this.sirovo, this.doRuteTocka);
      const smjer = smjerIzmedu(this.sirovo, this.doRuteTocka);
      const karta = this.mapa?.getBearing() ?? 0;
      this.doRute = { m, kut: smjer - karta };
    } else {
      this.doRute = null;
    }
    const m = this.manevri.find((x) => x.d > this.d + 5) ?? null;
    this.sljedeciManevar = m;
    this.doManevra = m ? m.d - this.d : 0;
    const i = this.udaljenosti.findIndex((u) => u > this.d + 10);
    this.sljedeceStajaliste = i >= 0 ? this.stajalista[i].naziv : null;
    this.doStajalista = i >= 0 ? this.udaljenosti[i] - this.d : 0;
    this.zatimStajaliste = i >= 0 ? (this.stajalista[i + 1]?.naziv ?? null) : null;
    this.kraj = (this.nacin === 'proba' || this.status === 'na-ruti') && this.d >= this.trasa.duljina - 15;

    // Skretanja i stajališta ispred, po udaljenosti – prva dva idu u kartice.
    const ispred: Dogadaj[] = [];
    for (const m of this.manevri) {
      if (m.d > this.d + 5) ispred.push({ vrsta: 'skretanje', d: m.d, do: m.d - this.d, manevar: m });
      if (ispred.length >= 2) break;
    }
    let dodano = 0;
    this.udaljenosti.forEach((u, j) => {
      if (u > this.d + 10 && dodano < 2) {
        dodano++;
        ispred.push({
          vrsta: 'stajaliste',
          d: u,
          do: u - this.d,
          naziv: this.stajalista[j].naziv,
          zadnje: j === this.stajalista.length - 1,
        });
      }
    });
    this.dogadaji = ispred.sort((a, b) => a.d - b.d).slice(0, 2);

    this.crtajStrelice();
    this.najave();
  }

  // ---------- MapLibre ----------

  private postaviSlojeve(mapa: MapaLibre): void {
    const b = BOJE[this.tema];
    const prazno: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
    if (!mapa.hasImage('vozilo')) mapa.addImage('vozilo', oznakaVozila(), { sdf: true, pixelRatio: 2 });
    for (const izvor of ['ispred', 'iza', 'stajalista', 'ja', 'do-rute']) {
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
      id: 'do-rute',
      type: 'line',
      source: 'do-rute',
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': b.trasa, 'line-width': 4, 'line-dasharray': [1, 1.5] },
    });
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

    // Strelice na svakom sljedećem skretanju: bijela s tamnim rubom, vrh u smjeru izlaza.
    if (!mapa.hasImage('vrh')) mapa.addImage('vrh', vrhStrelice(), { sdf: true, pixelRatio: 2 });
    for (const izvor of ['strelice', 'strelice-vrh']) {
      if (!mapa.getSource(izvor)) mapa.addSource(izvor, { type: 'geojson', data: prazno });
    }
    const rubStrelice = this.tema === 'tamna' ? '#0b1220' : '#1e3a8a';
    mapa.addLayer({
      id: 'strelice-rub',
      type: 'line',
      source: 'strelice',
      layout: { 'line-join': 'round', 'line-cap': 'butt' },
      paint: { 'line-color': rubStrelice, 'line-width': ['case', ['get', 'prvi'], 13, 10] },
    });
    mapa.addLayer({
      id: 'strelice',
      type: 'line',
      source: 'strelice',
      layout: { 'line-join': 'round', 'line-cap': 'butt' },
      paint: { 'line-color': '#ffffff', 'line-width': ['case', ['get', 'prvi'], 7, 5] },
    });
    mapa.addLayer({
      id: 'strelice-vrh',
      type: 'symbol',
      source: 'strelice-vrh',
      layout: {
        'icon-image': 'vrh',
        'icon-rotate': ['get', 'smjer'],
        'icon-rotation-alignment': 'map',
        'icon-pitch-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-size': ['case', ['get', 'prvi'], 0.85, 0.65],
      },
      paint: { 'icon-color': '#ffffff', 'icon-halo-color': rubStrelice, 'icon-halo-width': 2 },
    });
    this.prikazaniPrvi = -1;
    this.crtajStrelice();
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

  /**
   * Strelice na skretanjima ispred vozača: komad trase oko raskrižja i vrh u
   * smjeru izlaza. Prođena skretanja nestaju; najbliže je malo veće.
   */
  private crtajStrelice(): void {
    const mapa = this.mapa;
    const t = this.trasa;
    const linije = mapa?.getSource('strelice') as GeoJSONSource | undefined;
    const vrhovi = mapa?.getSource('strelice-vrh') as GeoJSONSource | undefined;
    if (!t || !linije || !vrhovi) return;

    const ispred = this.manevri.filter((m) => m.d > this.d + 5);
    const prvi = ispred[0] ? this.manevri.indexOf(ispred[0]) : this.manevri.length;
    if (prvi === this.prikazaniPrvi) return;
    this.prikazaniPrvi = prvi;

    const crte: GeoJSON.Feature[] = [];
    const vrh: GeoJSON.Feature[] = [];
    ispred.forEach((m, i) => {
      const od = Math.max(this.d, m.d - STRELICA_PRIJE_M);
      const doo = Math.min(t.duljina, m.d + STRELICA_POSLIJE_M);
      if (doo - od < 10) return;
      const koordinate: [number, number][] = [];
      for (let x = od; x < doo; x += 4) {
        const p = tockaNa(t, x);
        koordinate.push([p.lon, p.lat]);
      }
      const kraj = tockaNa(t, doo);
      koordinate.push([kraj.lon, kraj.lat]);
      const svojstva = { prvi: i === 0 };
      crte.push({ type: 'Feature', properties: svojstva, geometry: { type: 'LineString', coordinates: koordinate } });
      // Vrh: smjer zadnjih metara strelice.
      const prije = tockaNa(t, doo - 6);
      const smjer =
        ((Math.atan2((kraj.lon - prije.lon) * Math.cos((kraj.lat * Math.PI) / 180), kraj.lat - prije.lat) * 180) /
          Math.PI +
          360) %
        360;
      vrh.push({
        type: 'Feature',
        properties: { ...svojstva, smjer },
        geometry: { type: 'Point', coordinates: [kraj.lon, kraj.lat] },
      });
    });
    linije.setData({ type: 'FeatureCollection', features: crte });
    vrhovi.setData({ type: 'FeatureCollection', features: vrh });
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

    // Točka na trasi (napredak) i smjer trase tamo.
    const naTrasi = tockaNa(t, this.d);
    const ispredT = tockaNa(t, Math.min(t.duljina, this.d + 25));
    const smjerTrase = smjerIzmedu(naTrasi, ispredT);
    const kretanje = this.pracenje?.smjerKretanja ?? null;
    const vozi = this.brzina > 1.5;

    let lat: number;
    let lon: number;
    let ciljSmjer: number | null;
    if (this.nacin === 'gps' && this.gpsTocka) {
      // Oznaka na stvarnoj GPS poziciji (ZET-ova crta zna biti pokraj ceste),
      // glatko i malo procijenjena brzinom da ne kasni za busom.
      let cilj = this.gpsTocka;
      if (vozi && kretanje !== null) {
        const m = this.brzina * Math.min(1.5, (performance.now() - this.zadnjiFix) / 1000);
        const r = (kretanje * Math.PI) / 180;
        cilj = {
          lat: cilj.lat + (m * Math.cos(r)) / 110_540,
          lon: cilj.lon + (m * Math.sin(r)) / (111_320 * Math.cos((cilj.lat * Math.PI) / 180)),
        };
      }
      if (!this.prikazGps || udaljenost(this.prikazGps, cilj) > 150) {
        this.prikazGps = { ...cilj };
      } else {
        const k = Math.min(1, dt * 4);
        this.prikazGps = {
          lat: this.prikazGps.lat + (cilj.lat - this.prikazGps.lat) * k,
          lon: this.prikazGps.lon + (cilj.lon - this.prikazGps.lon) * k,
        };
      }
      ({ lat, lon } = this.prikazGps);
      // Smjer: kamo stvarno vozi; kad stoji, smjer trase (ako je na njoj).
      ciljSmjer = vozi && kretanje !== null ? kretanje : this.status === 'na-ruti' ? smjerTrase : kretanje;
    } else {
      // Probna vožnja (ili još bez GPS-a): po trasi.
      lat = naTrasi.lat;
      lon = naTrasi.lon;
      ciljSmjer = udaljenost(naTrasi, ispredT) > 0.1 ? smjerTrase : null;
    }
    if (ciljSmjer !== null) {
      this.smjer = (this.smjer + razlikaKuta(this.smjer, ciljSmjer) * Math.min(1, dt * 2.5) + 360) % 360;
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

    const doRute = mapa.getSource('do-rute') as GeoJSONSource | undefined;
    doRute?.setData({
      type: 'FeatureCollection',
      features:
        this.sirovo && this.doRuteTocka && this.status === 'izvan-rute'
          ? [
              {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: [
                    [lon, lat],
                    [this.doRuteTocka.lon, this.doRuteTocka.lat],
                  ],
                },
              },
            ]
          : [],
    });

    // Trasa: prijeđeni dio blijedo, ostatak jako.
    const idx = t.d.findIndex((x) => x > this.d);
    const rez = idx < 0 ? t.tocke.length : idx;
    // Granica prijeđenog dijela je na trasi, ne na GPS oznaci (koja zna biti pokraj crte).
    const tu = [naTrasi.lon, naTrasi.lat];
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
      this.optimalniZoom = kmh > 45 ? 16 : kmh > 25 ? 16.6 : 17.2;
      const rucno = performance.now() < this.zoomPomakDo;
      if (!rucno) this.zoomPomak = 0;
      const zoom = this.optimalniZoom + this.zoomPomak;
      // Ručna promjena brzo, povratak na optimalni polako i glatko.
      const brzinaZooma = rucno ? 4 : 1;
      const h = this.mapaEl.nativeElement.clientHeight;
      mapa.jumpTo({
        center: [lon, lat],
        bearing: this.smjer,
        pitch: this.treceD ? 55 : 0,
        zoom: mapa.getZoom() + (zoom - mapa.getZoom()) * Math.min(1, dt * brzinaZooma),
        // Vozilo u donjem dijelu ekrana – više se vidi ispred.
        padding: { top: h * 0.42, bottom: 90, left: 0, right: 0 },
      });
    }
  }
}
