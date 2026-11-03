import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import { LineScheduleService } from '../../../services/line-schedule.service';
import { KolegaRowComponent } from '../kolega-row/kolega-row.component';
import { DANI, DanKey, Kolega, TjedanTip, danasKey } from '../vozac.model';

const ZADNJE_KEY = 'vz-zadnje-linije';

@Component({
  selector: 'app-linije',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    SelectButtonModule,
    SkeletonModule,
    MessageModule,
    KolegaRowComponent,
  ],
  templateUrl: './linije.component.html',
  styleUrl: './linije.component.scss',
})
export class LinijeComponent {
  @Input() set naredniDostupan(v: boolean) {
    this.tjedanOpcije = [
      { label: 'Ovaj tjedan', value: 'trenutni', disabled: false },
      { label: 'Sljedeći', value: 'naredni', disabled: !v },
    ];
  }

  readonly dani = DANI;
  tjedanOpcije: { label: string; value: TjedanTip; disabled: boolean }[] = [];

  linija = '';
  dan: DanKey = danasKey();
  tjedan: TjedanTip = 'trenutni';

  rezultat: { linija: string; dan: string; voze: Kolega[] } | null = null;
  loading = false;
  greska = '';
  zadnje: string[] = this.ucitajZadnje();

  constructor(private lineScheduleService: LineScheduleService) {}

  get nazivDana(): string {
    return DANI.find((d) => d.key === this.dan)?.naziv ?? '';
  }

  odaberiDan(d: DanKey): void {
    this.dan = d;
    if (this.rezultat) this.trazi();
  }

  promijeniTjedan(t: TjedanTip): void {
    if (!t) return;
    this.tjedan = t;
    if (this.rezultat) this.trazi();
  }

  odaberiZadnju(l: string): void {
    this.linija = l;
    this.trazi();
  }

  trazi(): void {
    const linija = this.linija.trim();
    if (!linija) return;

    this.loading = true;
    this.greska = '';
    this.lineScheduleService.fetchLineDrivers(linija, this.dan, this.tjedan).subscribe({
      next: (data) => {
        this.rezultat = {
          linija: data?.linija ?? linija,
          dan: data?.dan ?? '',
          voze: data?.voze ?? [],
        };
        this.loading = false;
        this.zapamti(linija);
      },
      error: () => {
        this.rezultat = null;
        this.greska = 'Raspored za ovu liniju nije moguće dohvatiti.';
        this.loading = false;
      },
    });
  }

  private zapamti(linija: string): void {
    this.zadnje = [linija, ...this.zadnje.filter((l) => l !== linija)].slice(0, 5);
    try {
      localStorage.setItem(ZADNJE_KEY, JSON.stringify(this.zadnje));
    } catch {}
  }

  private ucitajZadnje(): string[] {
    try {
      return JSON.parse(localStorage.getItem(ZADNJE_KEY) || '[]');
    } catch {
      return [];
    }
  }
}
