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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { GeoJSONSource, Map as MapaLibre } from 'maplibre-gl';
import {
  KartaService,
  LinijaKarta,
  RutaKarta,
  StajalisteKarta,
  VoziloKarta,
} from '../../services/karta.service';
import {
  Kretanje,
  sljedeceStajaliste,
  stajalistaNaTrasi,
} from '../../components/karta/kretanje';
import { kasniZnatno, opisKasnjenja } from '../../components/vozac/vozac.model';
import {
  BOJE,
  POSTAVKE_KEY,
  PostavkeKarte,
  STIL,
  Tema,
  oznakaVozila,
  sustavTamna,
  ucitajCss,
  ucitajPostavke,
  slobodnaKamera,
} from '../../components/karta/karta-stil';

/** Dohvat svakih 5 s – nova pozicija brže stigne, kretanje je mirnije. */
const INTERVAL_MS = 5_000;
/** Animacija ne treba više od ~30 sličica u sekundi. */
const FRAME_MS = 33;
/** Visina kartice s detaljima – odabrano vozilo se centrira iznad nje. */
const PADDING_KARTICE = 330;
/** Spuštena kartica pokazuje samo zaglavlje (ručka + linija + smjer). */
const VIRI_KARTICA = 92;
/** Pozicija starija od ovoga se prikazuje izblijedjelo. */
const STARO_S = 90;

interface Rezultat {
  vrsta: 'linija' | 'vozilo';
  naslov: string;
  opis: string;
  linija?: string;
  vozilo?: VoziloKarta;
}

function bezKvacica(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
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
  private readonly router = inject(Router);
  /** false dok vozač dira kartu – tada je kamera ne smije pomicati. */
  private kameraSlobodna: () => boolean = () => false;
  /**
   * Otvaranje s kartice vozača: ?vozilo=374 odabere bus čim stigne u
   * podatke; ako ga nema, ?linija=137 pokaže rutu linije.
   */
  private ciljVozilo: string | null = null;
  private ciljLinija: string | null = null;
  private pokusajaVozila = 0;

  vozila: VoziloKarta[] = [];
  odabrano: VoziloKarta | null = null;
  vrijemeFeeda: string | null = null;
  ucitano = false;
  greska = false;
  trazi = '';
  samoPodsused: boolean;
  tramvaji: boolean;
  tema: Tema;
  filterLinija: string | null = null;
  /** Ruta linije odabrane u pretrazi i koji je smjer prikazan. */
  ruta: LinijaKarta | null = null;
  smjerRute = 0;
  ucitavaRutu = false;
  private sveRute: RutaKarta[] = [];
  prati = true;
  /** Otkucava svake sekunde – za "prije X s". */
  sad = Date.now();

  readonly opisKasnjenja = opisKasnjenja;

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
  private petljaPokrenuta = false;
  private unisten = false;

  constructor() {
    const p = ucitajPostavke();
    this.samoPodsused = p.samoPodsused;
    this.tramvaji = p.tramvaji;
    this.tema = p.tema ?? (sustavTamna() ? 'tamna' : 'svijetla');

    const q = inject(ActivatedRoute).snapshot.queryParamMap;
    this.ciljVozilo = q.get('vozilo');
    this.ciljLinija = q.get('linija');
    // Filteri ne smiju sakriti traženo vozilo.
    if (this.ciljVozilo || this.ciljLinija) this.prviPut = false;
  }

  /** Nakon svakog dohvata: odaberi traženo vozilo ili, ako ga nema, pokaži liniju. */
  private ispuniCilj(): void {
    if (!this.ciljVozilo) return;
    const v = this.vozila.find((x) => x.id === this.ciljVozilo);
    if (v && this.spremna) {
      this.ciljVozilo = null;
      this.ciljLinija = null;
      this.samoPodsused = false;
      this.tramvaji = true;
      this.odaberi(v, true);
    } else if (!v && ++this.pokusajaVozila >= 4) {
      this.ciljVozilo = null;
      this.prikaziCiljLiniju();
    }
  }

  private prikaziCiljLiniju(): void {
    const l = this.ciljLinija;
    this.ciljLinija = null;
    if (l) this.postaviLiniju(l);
  }

  async ngAfterViewInit(): Promise<void> {
    ucitajCss();
    const maplibregl = (await import('maplibre-gl')).default;
    if (this.unisten) return;

    this.zone.runOutsideAngular(() => {
      const mapa = new maplibregl.Map({
        container: this.mapaEl.nativeElement,
        style: STIL[this.tema],
        center: [15.93, 45.81],
        zoom: 11.3,
        dragRotate: false,
        pitchWithRotate: false,
        attributionControl: { compact: true },
      });
      mapa.touchZoomRotate.disableRotation();
      // I kod promjene teme – novi stil briše naše slojeve.
      mapa.on('style.load', () => this.postaviSlojeve(mapa));
      this.kameraSlobodna = slobodnaKamera(mapa);
      mapa.on('dragstart', () => {
        if (this.odabrano && this.prati) this.zone.run(() => (this.prati = false));
      });
      mapa.on('click', (e) => {
        const p = e.point;
        const f = mapa.getLayer('vozila-oznaka')
          ? mapa.queryRenderedFeatures(
              [
                [p.x - 14, p.y - 14],
                [p.x + 14, p.y + 14],
              ],
              { layers: ['vozila-oznaka'] },
            )
          : [];
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
    this.servis.rute().subscribe({
      next: (res) => (this.sveRute = res.rute ?? []),
      error: () => {},
    });
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
        this.ispuniCilj();
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

  // ---------- Filteri i postavke ----------

  private spremiPostavke(): void {
    try {
      const p: PostavkeKarte = { samoPodsused: this.samoPodsused, tramvaji: this.tramvaji, tema: this.tema };
      localStorage.setItem(POSTAVKE_KEY, JSON.stringify(p));
    } catch {}
  }

  get prikazana(): VoziloKarta[] {
    return this.vozila.filter(
      (v) =>
        (!this.samoPodsused || v.podsused) &&
        (this.tramvaji || v.tip !== 'tramvaj') &&
        (!this.filterLinija || v.linija === this.filterLinija),
    );
  }

  get brojPodsused(): number {
    return this.vozila.filter((v) => v.podsused).length;
  }

  get brojTramvaja(): number {
    return this.vozila.filter((v) => v.tip === 'tramvaj').length;
  }

  prebaciPodsused(): void {
    this.samoPodsused = !this.samoPodsused;
    this.spremiPostavke();
    this.zatvoriAkoSkriveno();
  }

  prebaciTramvaje(): void {
    this.tramvaji = !this.tramvaji;
    this.spremiPostavke();
    this.zatvoriAkoSkriveno();
  }

  private zatvoriAkoSkriveno(): void {
    if (this.odabrano && !this.prikazana.some((v) => v.id === this.odabrano!.id)) this.zatvori();
  }

  prebaciTemu(): void {
    this.tema = this.tema === 'tamna' ? 'svijetla' : 'tamna';
    this.spremiPostavke();
    this.spremna = false;
    // style.load ponovno doda slojeve i podatke.
    this.mapa?.setStyle(STIL[this.tema]);
  }

  // ---------- Prikaz ----------

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

  /** Kašnjenje u kartici: istaknuto samo kad bus znatno kasni. */
  klasaKasnjenja(s: number | null): string {
    if (s === null || !kasniZnatno(s)) return '';
    return s >= 300 ? 'is-late-bad' : 'is-late';
  }

  get rezultati(): Rezultat[] {
    const q = bezKvacica(this.trazi.trim());
    if (!q) return [];
    const rez: Rezultat[] = [];

    // Sve linije iz voznog reda, i one kojima sad nijedan bus nije vani.
    const naKarti = new Map<string, number>();
    for (const v of this.vozila) {
      if (v.linija) naKarti.set(v.linija, (naKarti.get(v.linija) ?? 0) + 1);
    }
    const opisi = new Map(this.sveRute.map((r) => [r.naziv, r.opis]));
    const linije = new Set([...opisi.keys(), ...naKarti.keys()]);
    [...linije]
      .filter((l) => bezKvacica(l).startsWith(q))
      .sort((a, b) => a.length - b.length || a.localeCompare(b, 'hr', { numeric: true }))
      .slice(0, 4)
      .forEach((l) => {
        const n = naKarti.get(l) ?? 0;
        const opis = [opisi.get(l), n ? `${n} na karti` : 'nitko ne vozi'].filter(Boolean).join(' · ');
        rez.push({ vrsta: 'linija', naslov: `Linija ${l}`, opis, linija: l });
      });

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

  /** Linija iz pretrage: samo njeni busevi i njena ruta (trasa + stajališta). */
  postaviLiniju(l: string | null): void {
    this.filterLinija = l;
    this.ruta = null;
    this.smjerRute = 0;
    this.spusteno = false;
    this.zatvori();
    if (!l) return;

    this.ucitavaRutu = true;
    this.servis.linija(l).subscribe({
      next: (r) => {
        this.ucitavaRutu = false;
        if (this.filterLinija !== l) return;
        this.ruta = r?.smjerovi?.length ? r : null;
        this.prikaziTrasu();
        this.pogledNaRutu();
      },
      error: () => {
        this.ucitavaRutu = false;
        // Bez rute barem pokaži buseve linije.
        if (this.filterLinija === l) this.prilagodiPogled(this.prikazana);
      },
    });
  }

  odaberiSmjer(i: number): void {
    this.smjerRute = i;
    this.prikaziTrasu();
  }

  /** Smjer rute koji se prikazuje (dok vozilo nije odabrano). */
  private get prikazaniSmjer(): LinijaKarta['smjerovi'][number] | null {
    return this.ruta?.smjerovi[this.smjerRute] ?? this.ruta?.smjerovi[0] ?? null;
  }

  private pogledNaRutu(): void {
    if (!this.mapa || !this.ruta) return;
    let [w, s, e, n] = [180, 90, -180, -90];
    for (const sm of this.ruta.smjerovi) {
      for (const [lat, lon] of sm.tocke) {
        w = Math.min(w, lon);
        e = Math.max(e, lon);
        s = Math.min(s, lat);
        n = Math.max(n, lat);
      }
    }
    this.mapa.fitBounds(
      [
        [w, s],
        [e, n],
      ],
      { padding: { top: 130, bottom: 210, left: 30, right: 30 }, maxZoom: 15, duration: 700 },
    );
  }

  odaberi(v: VoziloKarta, priblizi: boolean): void {
    this.odabrano = v;
    this.prati = true;
    this.spusteno = false;
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

  /** Gumbi + i −; praćenje odabranog vozila mijenja samo središte, ne zoom. */
  zumiraj(smjer: 1 | -1): void {
    if (!this.mapa) return;
    if (smjer > 0) this.mapa.zoomIn({ duration: 250 });
    else this.mapa.zoomOut({ duration: 250 });
  }

  // ---------- Kartica na povlačenje ----------

  /** Kartica spuštena: vidi se samo zaglavlje, ostatak ekrana je karta. */
  spusteno = false;
  /** Pomak prsta dok se kartica vuče (px); null = ne vuče se. */
  povlacenje: number | null = null;
  private pocetakY = 0;
  private visinaKartice = 0;

  pocniPovlacenje(e: PointerEvent, kartica: HTMLElement): void {
    // Gumbi i linkovi u kartici rade normalno.
    if ((e.target as HTMLElement).closest('button, a, input')) return;
    this.pocetakY = e.clientY;
    this.visinaKartice = kartica.offsetHeight;
    this.povlacenje = 0;
    kartica.setPointerCapture?.(e.pointerId);
  }

  povuci(e: PointerEvent): void {
    if (this.povlacenje === null) return;
    this.povlacenje = e.clientY - this.pocetakY;
  }

  pustiPovlacenje(e: PointerEvent): void {
    if (this.povlacenje === null) return;
    const dy = this.povlacenje;
    this.povlacenje = null;
    const naRucki = !!(e.target as HTMLElement).closest?.('.km-rucka');
    if (Math.abs(dy) < 6) {
      // Dodir: spuštenu karticu podigni; podignutu spusti samo dodirom ručke.
      if (this.spusteno || naRucki) this.spusteno = !this.spusteno;
    } else if (!this.spusteno && dy > 60) {
      this.spusteno = true;
    } else if (this.spusteno && dy < -40) {
      this.spusteno = false;
    }
    // Odabrano vozilo ostaje iznad kartice, i kad je spuštena.
    if (this.odabrano && this.mapa) {
      this.mapa.easeTo({
        padding: { top: 0, left: 0, right: 0, bottom: this.spusteno ? VIRI_KARTICA + 20 : PADDING_KARTICE },
        duration: 300,
      });
    }
  }

  /** Pomak kartice dok je prst vuče; inače CSS (spuštena/podignuta). */
  pomakKartice(): string | null {
    if (this.povlacenje === null) return null;
    const najvise = Math.max(0, this.visinaKartice - VIRI_KARTICA);
    const osnova = this.spusteno ? najvise : 0;
    const y = Math.max(0, Math.min(najvise, osnova + this.povlacenje));
    return `translateY(${y}px)`;
  }

  /** Navigacija (GPS) ili probna vožnja po trasi. */
  navigiraj(oblik: string, linija: string | null, cilj: string | null, proba: boolean): void {
    const queryParams: Record<string, string> = { oblik };
    if (linija) queryParams['linija'] = linija;
    if (cilj) queryParams['cilj'] = cilj;
    if (proba) queryParams['proba'] = '1';
    this.router.navigate(['/navigacija'], { queryParams });
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
    const b = BOJE[this.tema];
    const prazno: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
    if (!mapa.hasImage('vozilo')) mapa.addImage('vozilo', oznakaVozila(), { sdf: true, pixelRatio: 2 });
    for (const izvor of ['trasa', 'stajalista', 'vozila']) {
      if (!mapa.getSource(izvor)) mapa.addSource(izvor, { type: 'geojson', data: prazno });
    }

    mapa.addLayer({
      id: 'trasa-linija',
      type: 'line',
      source: 'trasa',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': b.trasa,
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 3, 16, 6],
        'line-opacity': 0.8,
      },
    });

    // Stajališta na trasi odabranog vozila; sljedeće je ispunjeno.
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
        'circle-color': ['case', ['get', 'sljedece'], b.trasa, b.stajalisteIspuna],
        'circle-stroke-color': b.trasa,
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
      paint: { 'text-color': b.stajalisteNaziv, 'text-halo-color': b.stajalisteIspuna, 'text-halo-width': 1.5 },
    });

    // Vozilo: krug s kljunom u smjeru vožnje i brojem linije.
    mapa.addLayer({
      id: 'vozila-oznaka',
      type: 'symbol',
      source: 'vozila',
      layout: {
        'icon-image': 'vozilo',
        'icon-rotate': ['get', 'smjer'],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'symbol-sort-key': ['get', 'red'],
        'icon-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10,
          ['case', ['get', 'podsused'], 0.42, 0.32],
          13,
          ['case', ['get', 'podsused'], 0.75, 0.6],
          16,
          ['case', ['get', 'podsused'], 1, 0.85],
        ],
      },
      paint: {
        'icon-color': ['get', 'boja'],
        'icon-halo-color': b.rub,
        'icon-halo-width': 1.6,
        'icon-opacity': ['get', 'opacity'],
      },
    });
    // Broj linije: Podsused i odabrano od zuma 12, ostali tek od 13.5.
    const tekst = (id: string, minzoom: number, filter: any) =>
      mapa.addLayer({
        id,
        type: 'symbol',
        source: 'vozila',
        minzoom,
        filter,
        layout: {
          'text-field': ['get', 'linija'],
          'text-font': ['Noto Sans Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 12, 8, 16, 11.5],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          'symbol-sort-key': ['get', 'red'],
        },
        paint: { 'text-color': ['get', 'tekstBoja'], 'text-opacity': ['get', 'opacity'] },
      });
    tekst('vozila-tekst-ostali', 13.5, ['!', ['any', ['get', 'podsused'], ['get', 'odabrano']]]);
    tekst('vozila-tekst', 12, ['any', ['get', 'podsused'], ['get', 'odabrano']]);
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
        'text-offset': [0, 1.7],
        'text-anchor': 'top',
        'text-optional': true,
      },
      paint: {
        'text-color': b.ime,
        'text-halo-color': b.rub,
        'text-halo-width': 1.5,
        'text-opacity': ['get', 'opacity'],
      },
    });

    this.spremna = true;
    if (this.prviPut && this.vozila.length) this.zone.run(() => this.pocetniPogled());
    // Otvoreno s kartice vozača: traženo vozilo ili ruta linije.
    if (this.ciljVozilo) this.zone.run(() => this.ispuniCilj());
    else if (this.ciljLinija) this.zone.run(() => this.prikaziCiljLiniju());
    this.prikaziTrasu();
    this.nacrtaj();
    if (!this.petljaPokrenuta) {
      this.petljaPokrenuta = true;
      this.petlja();
    }
  }

  private prikaziTrasu(): void {
    const izvor = this.mapa?.getSource('trasa') as GeoJSONSource | undefined;
    if (!izvor) return;
    // Odabrano vozilo ima prednost; inače ruta linije iz pretrage.
    const tocke = this.odabrano
      ? this.kretanje.trasa(this.odabrano.oblik)?.tocke
      : this.prikazaniSmjer?.tocke;
    izvor.setData({
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
    this.prikaziStajalista();
  }

  /** Stajališta trase odabranog vozila (bez odabira se ne prikazuju). */
  private prikaziStajalista(): void {
    const izvor = this.mapa?.getSource('stajalista') as GeoJSONSource | undefined;
    if (!izvor) return;
    if (!this.odabrano) {
      // Ruta linije: stajališta prikazanog smjera, bez "sljedećeg".
      this.prikazaniSljedeci = -1;
      izvor.setData({
        type: 'FeatureCollection',
        features: (this.prikazaniSmjer?.stajalista ?? []).map((s) => ({
          type: 'Feature',
          properties: { naziv: s.naziv, sljedece: false },
          geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
        })),
      });
      return;
    }
    const oblik = this.odabrano.oblik ?? null;
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
    const d = this.kretanje.naTrasi(v.id);
    const lista = this.stajalista.get(v.oblik);
    if (!u || d === null || !lista) return null;
    const s = sljedeceStajaliste(u, d);
    if (!s) return null;
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
    if (!this.spremna) return;
    const izvor = this.mapa?.getSource('vozila') as GeoJSONSource | undefined;
    if (!izvor) return;
    const b = BOJE[this.tema];
    const sad = Date.now();
    const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
    let odabranaPozicija: [number, number] | null = null;
    const odabranaLinija = this.odabrano?.linija ?? null;

    for (const v of this.prikazana) {
      const p = this.kretanje.pozicija(v.id, sad);
      if (!p) continue;
      const odabrano = this.odabrano?.id === v.id;
      if (odabrano) odabranaPozicija = [p.lon, p.lat];
      // Kad je vozilo odabrano, ostali (osim iste linije) se povuku u pozadinu.
      const uPozadini = !!this.odabrano && !odabrano && v.linija !== odabranaLinija;
      const staro = sad / 1000 - v.ts > STARO_S;
      const props: Record<string, unknown> = {
        id: v.id,
        linija: v.linija ?? '',
        smjer: p.smjer,
        boja: odabrano ? b.odabrano : v.podsused ? b.podsused : b.ostali,
        tekstBoja: odabrano ? '#ffffff' : v.podsused ? b.podsusedTekst : b.ostaliTekst,
        opacity: uPozadini ? 0.3 : staro ? 0.5 : 1,
        podsused: v.podsused,
        odabrano,
        // Crta se odozdo: ostali, Podsused, odabrano.
        red: odabrano ? 2 : v.podsused ? 1 : 0,
      };
      if (v.vozac?.ime) props['ime'] = v.vozac.ime;
      features.push({
        type: 'Feature',
        properties: props,
        geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      });
    }
    izvor.setData({ type: 'FeatureCollection', features });

    if (odabranaPozicija && this.prati && this.mapa && this.kameraSlobodna()) {
      this.mapa.setCenter(odabranaPozicija);
    }
  }
}
