import { Component, EventEmitter, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, catchError, forkJoin, of } from 'rxjs';
import dayjs, { Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { DriverScheduleService } from '../../../services/driver-schedule.service';
import { DriverStatsService } from '../../../services/driver-stats.service';
import { SluzbaDetaljiComponent } from '../sluzba-detalji/sluzba-detalji.component';
import { DANI, DanKalendara, KalendarOdgovor, opisOdsustva, satiSluzbe } from '../vozac.model';
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

/** Red kalendara: ISO tjedan sa 7 mjesta (null = dan drugog mjeseca). */
interface Tjedan {
  broj: number;
  /** Ukupni sati cijelog tjedna iz statistike (i dani susjednog mjeseca). */
  sati: number | null;
  /** Tjedan još traje – sati su po rasporedu, ne odvoženi. */
  traje: boolean;
  dani: (Celija | null)[];
}

interface PeriodStatistike {
  godina: number;
  period: number;
  ukupniSati: number;
  potpun: boolean;
}

/** "7:45" ili "7,5" -> sati. */
function sati(v?: string | null): number {
  const s = (v ?? '').trim();
  const hm = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (hm) return +hm[1] + +hm[2] / 60;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** 40.5 -> "40:30" */
export function hhmm(h: number | null | undefined): string {
  if (h === null || h === undefined) return '–';
  const min = Math.round(h * 60);
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
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
  private readonly statsService = inject(DriverStatsService);
  private zahtjev?: Subscription;
  private statsZahtjev?: Subscription;

  /** Statistika po tjednima i mjesecima ("godina-period"), učita se jednom. */
  private tjedniStats = new Map<string, PeriodStatistike>();
  private mjeseciStats = new Map<string, PeriodStatistike>();

  readonly hhmm = hhmm;
  tjedni: Tjedan[] = [];
  /** Ukupno sati u mjesecu (statistika) i odvoženo do danas (iz dana). */
  satiMjeseca: number | null = null;
  odvozenoDoDanas: number | null = null;

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
    this.ucitajStatistiku();
  }

  ngOnDestroy(): void {
    this.zahtjev?.unsubscribe();
    this.statsZahtjev?.unsubscribe();
  }

  /** Sati su dodatak – kalendar radi i kad statistika ne stigne. */
  private ucitajStatistiku(): void {
    const dohvati = (tip: 'tjedan' | 'mjesec') =>
      this.statsService.fetchDriverStats(tip).pipe(catchError(() => of(null)));
    this.statsZahtjev = forkJoin([dohvati('tjedan'), dohvati('mjesec')]).subscribe(
      ([t, m]) => {
        const mapa = (odg: any) =>
          new Map<string, PeriodStatistike>(
            (odg?.periodi ?? []).map((p: PeriodStatistike) => [`${p.godina}-${p.period}`, p]),
          );
        this.tjedniStats = mapa(t);
        this.mjeseciStats = mapa(m);
        if (this.podaci) this.slozi(this.podaci);
      },
    );
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

    // Redovi po ISO tjednima, s brojem tjedna i satima sa strane.
    this.tjedni = [];
    const mjesta: (Celija | null)[] = [...this.praznine.map(() => null), ...this.celije];
    while (mjesta.length % 7) mjesta.push(null);
    for (let i = 0; i < mjesta.length; i += 7) {
      const dani = mjesta.slice(i, i + 7);
      const prvi = dani.find((c): c is Celija => !!c)!.datum;
      const s = this.tjedniStats.get(`${prvi.isoWeekYear()}-${prvi.isoWeek()}`);
      this.tjedni.push({
        broj: prvi.isoWeek(),
        sati: s ? s.ukupniSati : null,
        traje: s ? !s.potpun : false,
        dani,
      });
    }

    const m = this.mjeseciStats.get(`${this.mjesec.year()}-${this.mjesec.month() + 1}`);
    this.satiMjeseca = m ? m.ukupniSati : null;
    // Do danas: samo dani koji su prošli (današnja služba još traje).
    const prosli = this.celije.filter((c) => c.datum.isBefore(danas, 'day'));
    this.odvozenoDoDanas =
      this.mjesec.isSame(danas, 'month') && prosli.length
        ? prosli.reduce((zbroj, c) => zbroj + sati(satiSluzbe(c.dan?.sluzbe ?? []).ukupni_sati), 0)
        : null;
  }
}
