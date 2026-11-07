import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import dayjs from 'dayjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import { ServiceScheduleService } from '../../../services/service-schedule.service';
import { KolegaRowComponent } from '../kolega-row/kolega-row.component';
import {
  DANI,
  Kolega,
  TjedanTip,
  pauzaMinuta,
  rutaUrl,
  satiSluzbe,
  trajanjeTekst,
} from '../vozac.model';

interface SluzbaDan {
  dan: string;
  datum: string;
  vozaci: Kolega[];
}

interface DioSluzbe {
  br_sl: string;
  linija?: string;
  varijanta?: string;
  od: string;
  do: string;
  nastup_sluzbe?: string;
  zavrsna_sluzba?: string;
  nocni_rad?: string;
  druga_smjena?: string;
  efektivni_sati?: string;
  ukupni_sati?: string;
}

interface SluzbaOdgovor {
  /** Svi dijelovi službe (npr. 207 i 207P); stariji backend ga ne šalje. */
  dijelovi?: DioSluzbe[];
  br_sl: string;
  linija?: string;
  varijanta?: string;
  od: string;
  do: string;
  nastup_sluzbe?: string;
  zavrsna_sluzba?: string;
  nocni_rad?: string;
  druga_smjena?: string;
  efektivni_sati?: string;
  ukupni_sati?: string;
  raspored: SluzbaDan[];
}

@Component({
  selector: 'app-sluzbe',
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
  templateUrl: './sluzbe.component.html',
  styleUrl: './sluzbe.component.scss',
})
export class SluzbeComponent {
  @Input() set naredniDostupan(v: boolean) {
    this.tjedanOpcije = [
      { label: 'Ovaj tjedan', value: 'trenutni', disabled: false },
      { label: 'Sljedeći', value: 'naredni', disabled: !v },
    ];
  }

  tjedanOpcije: { label: string; value: TjedanTip; disabled: boolean }[] = [];
  sluzba = '';
  tjedan: TjedanTip = 'trenutni';
  rezultat: SluzbaOdgovor | null = null;
  loading = false;
  greska = '';
  readonly rutaUrl = rutaUrl;

  /** Dijelovi službe; bez polja `dijelovi` (stariji backend) samo prvi dio. */
  get dijelovi(): DioSluzbe[] {
    if (!this.rezultat) return [];
    return this.rezultat.dijelovi?.length
      ? this.rezultat.dijelovi
      : [this.rezultat];
  }

  /** Sati cijele službe (upisani su u svaki dio) – prikazuju se jednom. */
  get sati() {
    return satiSluzbe(this.dijelovi);
  }

  /** Pauza prije (i+1). dijela, npr. "30 min"; null ako nema razmaka. */
  pauza(i: number): string | null {
    const d = this.dijelovi;
    const min = pauzaMinuta(d[i]?.do, d[i + 1]?.od);
    return min ? trajanjeTekst(min) : null;
  }

  constructor(private serviceScheduleService: ServiceScheduleService) {}

  promijeniTjedan(t: TjedanTip): void {
    if (!t) return;
    this.tjedan = t;
    if (this.rezultat) this.trazi();
  }

  trazi(): void {
    const sl = this.sluzba.trim();
    if (!sl) return;

    this.loading = true;
    this.greska = '';
    this.serviceScheduleService
      .fetchServiceDrivers(sl, undefined, this.tjedan)
      .subscribe({
        next: (data) => {
          this.rezultat = data;
          this.loading = false;
        },
        error: (err) => {
          this.rezultat = null;
          this.greska =
            err?.status === 404
              ? `Služba ${sl} ne postoji u voznom redu.`
              : 'Podatke o službi nije moguće dohvatiti.';
          this.loading = false;
        },
      });
  }

  nazivDana(kratica: string): string {
    const k = kratica.replace('.', '').trim().toLowerCase().replace('č', 'c');
    return DANI.find((d) => d.key === k)?.naziv ?? kratica;
  }

  datum(d: string): string {
    const parsed = dayjs(d.replace(/\//g, '-').split('-').reverse().join('-'));
    return parsed.isValid() ? parsed.format('D.M.') : d;
  }

  jeDanas(d: string): boolean {
    return d.replace(/\//g, '.') === dayjs().format('DD.MM.YYYY');
  }
}
