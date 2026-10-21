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
    return `${f(p.od)} – ${f(p.do)}`;
  }

  datum(d?: string): string {
    return d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}.` : '';
  }

  sati(h: number | null | undefined): string {
    if (h === null || h === undefined) return '–';
    const cijeli = Math.floor(h);
    const min = Math.round((h - cijeli) * 60);
    return min ? `${cijeli} h ${min} min` : `${cijeli} h`;
  }

  // "7:21 h" – za uske kartice
  satiKratko(h: number | null | undefined): string {
    if (h === null || h === undefined) return '–';
    const ukupnoMin = Math.round(h * 60);
    return `${Math.floor(ukupnoMin / 60)}:${String(ukupnoMin % 60).padStart(2, '0')} h`;
  }

  // razlika ukupnih sati u odnosu na prethodni period (samo za završene periode)
  get razlikaSati(): number | null {
    if (!this.odabrani?.potpun || !this.prethodni?.potpun) return null;
    return (
      Math.round((this.odabrani.ukupniSati - this.prethodni.ukupniSati) * 10) /
      10
    );
  }

  abs(n: number): number {
    return Math.abs(n);
  }

  get odsustva(): { oznaka: string; dana: number }[] {
    const o = this.odabrani?.odsustva ?? {};
    return Object.keys(o)
      .map((oznaka) => ({ oznaka, dana: o[oznaka] }))
      .sort((a, b) => b.dana - a.dana);
  }

  // odabrani period krajnje desno, stariji lijevo
  get trend(): any[] {
    return this.periodi.slice(this.index, this.index + TREND_DULJINA).reverse();
  }

  get trendMax(): number {
    return Math.max(1, ...this.trend.map((p) => p.ukupniSati || 0));
  }

  visinaStupca(p: any): number {
    return Math.max(2, ((p.ukupniSati || 0) / this.trendMax) * 100);
  }

  get linijeMax(): number {
    return Math.max(
      1,
      ...(this.odabrani?.linije ?? []).map((l: any) => l.dana),
    );
  }
}
