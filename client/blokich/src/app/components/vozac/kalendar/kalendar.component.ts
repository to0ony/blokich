import { Component, EventEmitter, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import dayjs, { Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { DriverScheduleService } from '../../../services/driver-schedule.service';
import { SluzbaDetaljiComponent } from '../sluzba-detalji/sluzba-detalji.component';
import { DANI, DanKalendara, KalendarOdgovor, opisOdsustva } from '../vozac.model';
import { praznikZa } from './praznici';

dayjs.extend(isoWeek);

const MJESECI = [
  'Siječanj', 'Veljača', 'Ožujak', 'Travanj', 'Svibanj', 'Lipanj',
  'Srpanj', 'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac',
];

/** Kalendar uvijek ide barem do ovog mjeseca, radi praznika i bez rasporeda. */
const NAJSTARIJI_MJESEC = '2025-01';

interface Celija {
  datum: Dayjs;
  broj: number;
  danas: boolean;
  dan: DanKalendara | null;
  /** Prvi broj službe i linije bez ponavljanja; samo kad službe postoje. */
  sluzba: string | null;
  linije: string[];
  pricuva: boolean;
  vikend: 'sub' | 'ned' | null;
  praznik: string | null;
}

@Component({
  selector: 'app-kalendar',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    DrawerModule,
    MessageModule,
    SkeletonModule,
    SluzbaDetaljiComponent,
  ],
  templateUrl: './kalendar.component.html',
  styleUrl: './kalendar.component.scss',
})
export class KalendarComponent implements OnInit, OnDestroy {
  private readonly rasporedService = inject(DriverScheduleService);
  private zahtjev?: Subscription;

  @Output() natrag = new EventEmitter<void>();

  readonly daniUTjednu = DANI;
  readonly opisOdsustva = opisOdsustva;

  /** Prvi dan prikazanog mjeseca. */
  mjesec: Dayjs = dayjs().startOf('month');
  podaci: KalendarOdgovor | null = null;
  celije: Celija[] = [];
  /** Prazna mjesta prije 1. u mjesecu (tjedan počinje ponedjeljkom). */
  praznine: number[] = [];
  loading = true;
  greska = false;

  odabrana: Celija | null = null;
  detaljiOtvoreni = false;

  ngOnInit(): void {
    this.ucitaj();
  }

  ngOnDestroy(): void {
    this.zahtjev?.unsubscribe();
  }

  get naslov(): string {
    return `${MJESECI[this.mjesec.month()]} ${this.mjesec.year()}.`;
  }

  get imaPrethodni(): boolean {
    const od = this.podaci?.dostupno?.od ?? NAJSTARIJI_MJESEC;
    const granica = od < NAJSTARIJI_MJESEC ? od : NAJSTARIJI_MJESEC;
    return this.mjesec.format('YYYY-MM') > granica;
  }

  get imaSljedeci(): boolean {
    const doMjeseca = this.podaci?.dostupno?.do ?? '';
    const ovajMjesec = dayjs().format('YYYY-MM');
    const granica = doMjeseca > ovajMjesec ? doMjeseca : ovajMjesec;
    return this.mjesec.format('YYYY-MM') < granica;
  }

  get naslovDetalja(): string {
    if (!this.odabrana) return '';
    const d = this.odabrana.datum;
    return `${DANI[d.isoWeekday() - 1].naziv} · ${d.format('D.M.YYYY.')}`;
  }

  pomakni(mjeseci: number): void {
    this.mjesec = this.mjesec.add(mjeseci, 'month');
    this.ucitaj();
  }

  ucitaj(): void {
    this.loading = true;
    this.greska = false;
    this.zahtjev?.unsubscribe();
    this.zahtjev = this.rasporedService
      .fetchKalendar(this.mjesec.year(), this.mjesec.month() + 1)
      .subscribe({
        next: (d) => {
          this.podaci = d;
          this.slozi(d);
          this.loading = false;
        },
        error: () => {
          this.celije = [];
          this.greska = true;
          this.loading = false;
        },
      });
  }

  otvori(c: Celija): void {
    if (!c.sluzba && !c.praznik) return;
    this.odabrana = c;
    this.detaljiOtvoreni = true;
  }

  private slozi(odg: KalendarOdgovor): void {
    const poDatumu = new Map(odg.dani.map((d) => [d.datum, d]));
    const danas = dayjs();

    this.praznine = Array.from({ length: this.mjesec.isoWeekday() - 1 }, (_, i) => i);
    this.celije = Array.from({ length: this.mjesec.daysInMonth() }, (_, i) => {
      const datum = this.mjesec.add(i, 'day');
      const dan = poDatumu.get(datum.format('YYYY-MM-DD')) ?? null;
      const sluzbe = dan?.sluzbe ?? [];
      return {
        datum,
        broj: i + 1,
        danas: datum.isSame(danas, 'day'),
        dan,
        sluzba: sluzbe[0]?.br_sl ?? null,
        linije: [...new Set(sluzbe.map((s) => s.linija).filter((l): l is string => !!l))],
        pricuva: !!sluzbe.length && sluzbe.every((s) => !s.linija),
        vikend: datum.isoWeekday() === 6 ? 'sub' : datum.isoWeekday() === 7 ? 'ned' : null,
        praznik: praznikZa(datum),
      };
    });
  }
}
