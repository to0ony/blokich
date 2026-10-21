import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DriverStatsService } from '../../../services/driver-stats.service';

const MJESECI = [
  'Siječanj',
  'Veljača',
  'Ožujak',
  'Travanj',
  'Svibanj',
  'Lipanj',
  'Srpanj',
  'Kolovoz',
  'Rujan',
  'Listopad',
  'Studeni',
  'Prosinac',
];

// Broj perioda prikazanih u grafu trenda
const TREND_DULJINA = 12;

interface Redak {
  naziv: string;
  opis?: string;
  broj: number;
  udio: number; // 0–100, širina trake
}

@Component({
  selector: 'app-driver-stats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './driver-stats.component.html',
  styleUrls: ['./driver-stats.component.scss'],
})
export class DriverStatsComponent implements OnInit {
  tip: 'tjedan' | 'mjesec' = 'mjesec';
  periodi: any[] = []; // najnoviji prvi
  index = 0;
  isLoading = false;
  error: string | null = null;

  constructor(private statsService: DriverStatsService) {}

  ngOnInit(): void {
    this.fetchStats();
  }

  get odabrani(): any | null {
    return this.periodi[this.index] ?? null;
  }

  get prethodni(): any | null {
    return this.periodi[this.index + 1] ?? null;
  }

  changeTip(tip: 'tjedan' | 'mjesec') {
    if (this.tip === tip) return;
    this.tip = tip;
    this.fetchStats();
  }

  fetchStats() {
    this.isLoading = true;
    this.error = null;

    this.statsService.fetchDriverStats(this.tip).subscribe({
      next: (data) => {
        this.periodi = data?.periodi ?? [];
        this.index = 0;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Greška pri dohvaćanju statistike', err);
        this.periodi = [];
        this.error = 'Greška pri dohvaćanju statistike.';
        this.isLoading = false;
      },
    });
  }

  // korak > 0 = stariji period
  move(korak: number) {
    const novi = this.index + korak;
    if (novi >= 0 && novi < this.periodi.length) this.index = novi;
  }

  selectPeriod(p: any) {
    this.index = this.periodi.indexOf(p);
  }

  // ---------- formatiranje ----------

  nazivPerioda(p: any): string {
    if (!p) return '';
    return p.tip === 'mjesec'
      ? `${MJESECI[p.period - 1]} ${p.godina}.`
      : `${p.period}. tjedan ${p.godina}.`;
  }

  kratkiNaziv(p: any): string {
    return p.tip === 'mjesec'
      ? MJESECI[p.period - 1].substring(0, 3)
      : `${p.period}.`;
  }

  rasponDatuma(p: any): string {
    const f = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;
    return `${f(p.od)} – ${f(p.do)}${p.do.slice(0, 4)}.`;
  }

  datum(d?: string): string {
    return d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.` : '';
  }

  // 156.78 -> "156:47"
  hhmm(h: number | null | undefined): string {
    if (h === null || h === undefined) return '–';
    const ukupnoMin = Math.round(h * 60);
    return `${Math.floor(ukupnoMin / 60)}:${String(ukupnoMin % 60).padStart(2, '0')}`;
  }

  dana(n: number): string {
    return n === 1 ? 'dan' : 'dana';
  }

  // ---------- sažetak ----------

  // razlika ukupnih sati u odnosu na prethodni period (samo za završene periode)
  get razlikaSati(): number | null {
    if (!this.odabrani?.potpun || !this.prethodni?.potpun) return null;
    return this.odabrani.ukupniSati - this.prethodni.ukupniSati;
  }

  abs(n: number): number {
    return Math.abs(n);
  }

  // ---------- raspodjele ----------

  get smjene(): Redak[] {
    const s = this.odabrani;
    if (!s) return [];
    const ukupno = Math.max(1, s.radniDani - (s.nepoznateSluzbe || 0));
    const red = (naziv: string, opis: string, broj: number): Redak => ({
      naziv,
      opis,
      broj,
      udio: (broj / ukupno) * 100,
    });
    return [
      red('Jutarnje', 'početak prije 12:00', s.smjene?.jutarnje || 0),
      red('Popodnevne', 'početak 12:00 – 20:00', s.smjene?.popodnevne || 0),
      red('Noćne', 'nakon 20:00 ili preko ponoći', s.smjene?.nocne || 0),
    ];
  }

  get raspodjelaDana(): Redak[] {
    const s = this.odabrani;
    if (!s) return [];
    const ukupno = Math.max(1, s.daniSaPodacima);
    const red = (naziv: string, broj: number): Redak => ({
      naziv,
      broj,
      udio: (broj / ukupno) * 100,
    });
    const odsustva = Object.keys(s.odsustva ?? {})
      .map((o) => red(o, s.odsustva[o]))
      .sort((a, b) => b.broj - a.broj);
    return [
      red('Radni', s.radniDani),
      red('Slobodni', s.slobodniDani),
      ...odsustva,
    ].filter((r) => r.broj > 0);
  }

  get linije(): (Redak & { sati: number })[] {
    const lista = this.odabrani?.linije ?? [];
    const max = Math.max(1, ...lista.map((l: any) => l.dana));
    return lista.map((l: any) => ({
      naziv: l.linija,
      broj: l.dana,
      sati: l.sati,
      udio: (l.dana / max) * 100,
    }));
  }

  // ---------- graf ----------

  // odabrani period krajnje desno, stariji lijevo
  get trend(): any[] {
    return this.periodi.slice(this.index, this.index + TREND_DULJINA).reverse();
  }

  // "okrugle" vrijednosti za os: 0, korak, 2·korak, 3·korak
  get osY(): number[] {
    const max = Math.max(1, ...this.trend.map((p) => p.ukupniSati || 0));
    const grubi = max / 3;
    const red = Math.pow(10, Math.floor(Math.log10(grubi)));
    const korak =
      [1, 2, 2.5, 5, 10].map((k) => k * red).find((k) => k >= grubi) ??
      10 * red;
    return [3, 2, 1, 0].map((i) => i * korak);
  }

  visinaStupca(p: any): number {
    return ((p.ukupniSati || 0) / this.osY[0]) * 100;
  }

  get imaNepotpunih(): boolean {
    return this.trend.some((p) => !p.potpun);
  }
}
