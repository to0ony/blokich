import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TabsModule } from 'primeng/tabs';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ManualUploadComponent } from '../manual-upload/manual-upload.component';
import {
  UploadOdgovor,
  UploadService,
  UploadTip,
  ZadnjiDisponentUpload,
  ZadnjiGodisnjiUpload,
  ZadnjiSluzbaUpload,
  ZetSyncStavka,
} from '../../../services/upload.service';

dayjs.extend(isoWeek);

const DANI = [
  'Ponedjeljak',
  'Utorak',
  'Srijeda',
  'Četvrtak',
  'Petak',
  'Subota',
  'Nedjelja',
];

type Severity ='success' | 'info' | 'warn' | 'danger' | 'secondary';

@Component({
  selector: 'app-upload-panel',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TagModule,
    TabsModule,
    SkeletonModule,
    ToastModule,
    ManualUploadComponent,
  ],
  providers: [MessageService],
  templateUrl: './upload-panel.component.html',
  styleUrl: './upload-panel.component.scss',
})
export class UploadPanelComponent implements OnInit {
  readonly danas = dayjs();
  readonly tekuciTjedan = this.danas.isoWeek();
  readonly tekucaGodina = this.danas.isoWeekYear();
  readonly danasTekst = `${DANI[this.danas.isoWeekday() - 1]}, ${this.danas.format('D.M.YYYY.')}`;

  stanjeUcitava = true;
  sluzba: ZadnjiSluzbaUpload | null = null;
  disponent: ZadnjiDisponentUpload | null = null;
  godisnji: ZadnjiGodisnjiUpload | null = null;

  zetLoading = false;
  zetStavke: ZetSyncStavka[] = [];
  zetGreska = '';
  zetVrijeme: Date | null = null;

  aktivniTab: UploadTip = 'disponent';

  readonly naziviDokumenata: Record<ZetSyncStavka['dokument'], string> = {
    sluzba: 'Službe',
    disponent: 'Disponent',
  };

  constructor(
    private uploadService: UploadService,
    private messages: MessageService,
  ) {}

  ngOnInit(): void {
    this.ucitajStanje();
  }

  ucitajStanje(): void {
    const dohvati = <T>(tip: UploadTip) =>
      this.uploadService
        .fetchLastUpload<T>(tip)
        .pipe(catchError(() => of(null)));

    forkJoin({
      sluzba: dohvati<ZadnjiSluzbaUpload>('sluzba'),
      disponent: dohvati<ZadnjiDisponentUpload>('disponent'),
      godisnji: dohvati<ZadnjiGodisnjiUpload>('godisnji'),
    }).subscribe((stanje) => {
      this.sluzba = stanje.sluzba;
      this.disponent = stanje.disponent;
      this.godisnji = stanje.godisnji;
      this.stanjeUcitava = false;
    });
  }

  /** Disponent je aktualan ako pokriva tekući ili neki budući tjedan. */
  get disponentStanje(): { tekst: string; severity: Severity } {
    if (!this.disponent) return { tekst: 'Nema podataka', severity: 'danger' };
    const { godina, brojTjedna } = this.disponent;
    const razlika =
      (godina - this.tekucaGodina) * 53 + (brojTjedna - this.tekuciTjedan);
    if (razlika > 0) return { tekst: 'Sljedeći tjedan', severity: 'info' };
    if (razlika === 0) return { tekst: 'Aktualno', severity: 'success' };
    return { tekst: 'Zastarjelo', severity: 'warn' };
  }

  /** Petkom od podneva ZET objavljuje disponent za sljedeći tjedan. */
  get cekaSeNoviDisponent(): boolean {
    const petakPopodne = this.danas.isoWeekday() === 5 && this.danas.hour() >= 12;
    const vikend = this.danas.isoWeekday() >= 6;
    return (
      (petakPopodne || vikend) &&
      this.disponentStanje.severity !== 'info'
    );
  }

  syncZetPodsused(): void {
    this.zetLoading = true;
    this.zetStavke = [];
    this.zetGreska = '';

    this.uploadService.syncZetPodsused().subscribe({
      next: (res) => {
        this.zetStavke = res.stavke;
        this.zetVrijeme = new Date();
        this.zetLoading = false;
        this.ucitajStanje();

        const obradjeno = res.stavke.filter((s) => s.status === 'obradjeno');
        const greske = res.stavke.filter((s) => s.status === 'greska');
        this.messages.add(
          greske.length
            ? {
                severity: 'error',
                summary: 'Dohvat djelomično neuspješan',
                detail: `${greske.length} od ${res.stavke.length} dokumenata nije obrađeno.`,
              }
            : obradjeno.length
              ? {
                  severity: 'success',
                  summary: 'Podaci ažurirani',
                  detail: obradjeno
                    .map((s) => this.naziviDokumenata[s.dokument])
                    .join(' i '),
                }
              : {
                  severity: 'info',
                  summary: 'Nema promjena',
                  detail: 'Na ZET-u nema novih PDF-ova.',
                },
        );
      },
      error: (err) => {
        this.zetGreska =
          err?.error?.message || 'Povlačenje podataka sa ZET-a nije uspjelo.';
        this.zetLoading = false;
      },
    });
  }

  onManualUpload(tip: UploadTip, res: UploadOdgovor): void {
    if (res.status === 'nema_promjene') return;
    this.ucitajStanje();
    this.messages.add({
      severity: 'success',
      summary: 'Uvoz završen',
      detail: res.poruka,
    });
  }

  zetSeverity(stavka: ZetSyncStavka): Severity {
    return stavka.status === 'obradjeno'
      ? 'success'
      : stavka.status === 'nema_promjene'
        ? 'info'
        : 'danger';
  }

  zetStatusTekst(stavka: ZetSyncStavka): string {
    return stavka.status === 'obradjeno'
      ? 'Obrađeno'
      : stavka.status === 'nema_promjene'
        ? 'Bez promjena'
        : 'Greška';
  }
}
