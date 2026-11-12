import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import dayjs from 'dayjs';
import { PregledOkvirComponent } from '../../components/vozac/pregled-okvir/pregled-okvir.component';
import { napraviTrasu, stajalistaNaTrasi } from '../../components/karta/kretanje';
import {
  KartaService,
  LinijaKarta,
  RutaKarta,
  StajalisteKarta,
  VarijantaKarta,
  VozniRedKarta,
} from '../../services/karta.service';

type Tip = 'sve' | 'autobus' | 'tramvaj';

interface Dan {
  /** YYYYMMDD */
  datum: string;
  naziv: string;
  podnaslov: string;
}

interface SatPolazaka {
  sat: string;
  polasci: { vrijeme: string; indeks: number; proslo: boolean }[];
}

interface RedakStajalista {
  stajaliste: StajalisteKarta;
  /** Metri od početka trase. */
  m: number | null;
  /** Minute od polaska. */
  min: number | null;
  /** Vrijeme dolaska za odabrani polazak (cca). */
  vrijeme: string | null;
}

const DANI = ['Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub'];

/** Preglednik linija: pretraga, varijante trase, stajališta, polasci i kilometraža. */
@Component({
  selector: 'app-linije-preglednik',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PregledOkvirComponent],
  templateUrl: './linije.component.html',
  styleUrl: './linije.component.scss',
})
export class LinijePreglednikComponent implements OnInit {
  private readonly servis = inject(KartaService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // ---------- Popis ----------
  rute: RutaKarta[] = [];
  ucitavaPopis = true;
  greskaPopisa = false;
  upit = '';
  tip: Tip = 'autobus';

  // ---------- Odabrana linija ----------
  broj: string | null = null;
  linija: LinijaKarta | null = null;
  ucitavaLiniju = false;
  greskaLinije = false;
  vozniRed: VozniRedKarta | null = null;
  ucitavaVozniRed = false;
  dani: Dan[] = [];
  dan = '';
  smjer = 0;
  varijanta = 0;
  /** Indeks odabranog polaska u popisu polazaka (za vremena po stajalištima). */
  polazak: number | null = null;

  private readonly metri = new Map<string, number[]>();

  ngOnInit(): void {
    this.dani = sljedeciDani();
    this.dan = this.dani[0].datum;

    this.servis.rute().subscribe({
      next: (r) => {
        this.rute = (r.rute ?? []).sort(poBroju);
        this.ucitavaPopis = false;
      },
      error: () => {
        this.ucitavaPopis = false;
        this.greskaPopisa = true;
      },
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((q) => {
      const broj = q.get('broj');
      if (broj !== this.broj) this.ucitajLiniju(broj);
    });
  }

  // ---------- Popis ----------

  get filtrirane(): RutaKarta[] {
    const u = this.upit.trim().toLowerCase();
    return this.rute.filter((r) => {
      if (this.tip === 'tramvaj' && r.tip !== 0) return false;
      if (this.tip === 'autobus' && r.tip === 0) return false;
      if (!u) return true;
      return r.naziv.toLowerCase().startsWith(u) || r.opis.toLowerCase().includes(u);
    });
  }

  otvori(r: RutaKarta): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { broj: r.naziv } });
  }

  /** Enter u pretrazi: točan broj ili prva linija s popisa. */
  potvrdi(): void {
    const u = this.upit.trim().toLowerCase();
    const r = this.filtrirane.find((x) => x.naziv.toLowerCase() === u) ?? this.filtrirane[0];
    if (r) this.otvori(r);
  }

  natrag(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  // ---------- Linija ----------

  private ucitajLiniju(broj: string | null): void {
    this.broj = broj;
    this.linija = null;
    this.vozniRed = null;
    this.greskaLinije = false;
    this.smjer = 0;
    this.varijanta = 0;
    this.polazak = null;
    if (!broj) return;

    this.ucitavaLiniju = true;
    this.servis.linija(broj).subscribe({
      next: (l) => {
        if (this.broj !== broj) return;
        this.ucitavaLiniju = false;
        this.linija = l?.smjerovi?.length ? l : null;
        this.greskaLinije = !this.linija;
      },
      error: () => {
        if (this.broj !== broj) return;
        this.ucitavaLiniju = false;
        this.greskaLinije = true;
      },
    });
    this.ucitajVozniRed();
  }

  private ucitajVozniRed(): void {
    const broj = this.broj;
    const datum = this.dan;
    if (!broj) return;
    this.ucitavaVozniRed = true;
    this.servis.vozniRed(broj, datum).subscribe({
      next: (v) => {
        if (this.broj !== broj || this.dan !== datum) return;
        this.ucitavaVozniRed = false;
        this.vozniRed = v;
      },
      error: () => {
        if (this.broj !== broj || this.dan !== datum) return;
        this.ucitavaVozniRed = false;
        this.vozniRed = null;
      },
    });
  }

  odaberiDan(datum: string): void {
    if (datum === this.dan) return;
    this.dan = datum;
    this.polazak = null;
    this.vozniRed = null;
    this.ucitajVozniRed();
  }

  odaberiSmjer(i: number): void {
    this.smjer = i;
    this.varijanta = 0;
    this.polazak = null;
  }

  odaberiVarijantu(i: number): void {
    this.varijanta = i;
    this.polazak = null;
  }

  odaberiPolazak(i: number): void {
    this.polazak = this.polazak === i ? null : i;
  }

  get smjerovi(): LinijaKarta['smjerovi'] {
    return this.linija?.smjerovi ?? [];
  }

  /** Sve trase odabranog smjera (stariji API šalje samo glavnu). */
  get varijante(): VarijantaKarta[] {
    const sm = this.smjerovi[this.smjer];
    if (!sm) return [];
    return sm.varijante?.length
      ? sm.varijante
      : [{ ...sm, voznji: 0, glavna: true, opis: 'Glavna trasa' }];
  }

  get trasa(): VarijantaKarta | null {
    return this.varijante[this.varijanta] ?? this.varijante[0] ?? null;
  }

  /** Polasci trase na odabrani dan; null dok se vozni red ne učita. */
  polasciZa(oblik: string): string[] | null {
    if (!this.vozniRed) return null;
    return this.vozniRed.oblici[oblik]?.polasci ?? [];
  }

  get polasci(): string[] {
    return this.trasa ? (this.polasciZa(this.trasa.oblik) ?? []) : [];
  }

  /** Polasci po satima; nakon ponoći dolaze iza 23 h, kao u voznom redu. */
  get satiPolazaka(): SatPolazaka[] {
    const sad = this.dan === this.dani[0].datum ? dayjs().hour() * 60 + dayjs().minute() : null;
    const rez: SatPolazaka[] = [];
    let prije = -1;
    let sutra = false;
    this.polasci.forEach((vrijeme, indeks) => {
      const min = minute(vrijeme);
      if (min < prije) sutra = true;
      prije = min;
      const sat = vrijeme.slice(0, 2);
      let grupa = rez[rez.length - 1];
      if (!grupa || grupa.sat !== sat) rez.push((grupa = { sat, polasci: [] }));
      grupa.polasci.push({ vrijeme, indeks, proslo: sad !== null && !sutra && min < sad });
    });
    return rez;
  }

  /** Stajališta trase s kilometražom i vremenom od polaska. */
  get stajalista(): RedakStajalista[] {
    const t = this.trasa;
    if (!t) return [];
    const m = this.metriZa(t);
    const vremena = this.vozniRed?.oblici[t.oblik]?.vremena;
    const v = vremena && vremena.length === t.stajalista.length ? vremena : null;
    const polazak = this.polazak !== null ? this.polasci[this.polazak] : null;
    return t.stajalista.map((s, i) => ({
      stajaliste: s,
      m: m?.[i] ?? null,
      min: v?.[i] ?? null,
      vrijeme: polazak && v ? hhmm(minute(polazak) + v[i]) : null,
    }));
  }

  /** Duljina trase u km (po obliku trase). */
  get km(): number | null {
    const t = this.trasa;
    if (!t || t.tocke.length < 2) return null;
    return napraviTrasu(t.tocke).duljina / 1000;
  }

  /** Trajanje vožnje od prvog do zadnjeg stajališta (iz voznog reda). */
  get trajanje(): number | null {
    const v = this.trasa ? this.vozniRed?.oblici[this.trasa.oblik]?.vremena : null;
    return v?.length ? v[v.length - 1] : null;
  }

  get danNaziv(): string {
    const d = this.dani.find((x) => x.datum === this.dan);
    return d ? d.naziv.toLowerCase() : '';
  }

  /** 3.4 -> "3,4" */
  decimalno(x: number): string {
    return x.toFixed(1).replace('.', ',');
  }

  private metriZa(t: VarijantaKarta): number[] | null {
    let m = this.metri.get(t.oblik);
    if (!m && t.tocke.length > 1 && t.stajalista.length) {
      m = stajalistaNaTrasi(napraviTrasu(t.tocke), t.stajalista);
      this.metri.set(t.oblik, m);
    }
    return m ?? null;
  }
}

function poBroju(a: RutaKarta, b: RutaKarta): number {
  const na = parseInt(a.naziv, 10);
  const nb = parseInt(b.naziv, 10);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  if (Number.isFinite(na) !== Number.isFinite(nb)) return Number.isFinite(na) ? -1 : 1;
  return a.naziv.localeCompare(b.naziv, 'hr');
}

function minute(hhmmTekst: string): number {
  const [h, m] = hhmmTekst.split(':').map(Number);
  return h * 60 + m;
}

function hhmm(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Danas, sutra i sljedeća subota i nedjelja (ako već nisu među njima). */
function sljedeciDani(): Dan[] {
  const danas = dayjs().startOf('day');
  const dani = [danas, danas.add(1, 'day')];
  for (const cilj of [6, 0]) {
    let d = danas;
    while (d.day() !== cilj) d = d.add(1, 'day');
    if (!dani.some((x) => x.isSame(d, 'day'))) dani.push(d);
  }
  return dani
    .sort((a, b) => a.valueOf() - b.valueOf())
    .map((d, i) => ({
      datum: d.format('YYYYMMDD'),
      naziv: i === 0 ? 'Danas' : i === 1 ? 'Sutra' : d.day() === 6 ? 'Subota' : 'Nedjelja',
      podnaslov: `${DANI[d.day()]} ${d.format('D.M.')}`,
    }));
}
