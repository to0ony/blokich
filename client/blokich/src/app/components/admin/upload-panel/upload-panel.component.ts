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
  ZetUvozPotvrda,
  RucniUvoz,
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
  zetUvozi = false;
  zetIspravakUcitava = false;
  zetStavke: ZetSyncStavka[] = [];
  zetGreska = '';
  zetVrijeme: Date | null = null;

  aktivniTab: UploadTip = 'disponent';

  povijestOtvorena = false;
  povijestUcitava = false;
  povijest: RucniUvoz[] = [];

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

  get zetNemaNista(): boolean {
    return (
      this.zetStavke.length > 0 &&
      this.zetStavke.every((s) => s.status === 'nema_promjene')
    );
  }

  get zetImaGresku(): boolean {
    return this.zetStavke.some((s) => s.status === 'greska');
  }

  get zetImaNovo(): boolean {
    return this.zetStavke.some((s) => s.status === 'novo');
  }

  /** Uvoz je sve ili ništa: uz grešku bilo kojeg PDF-a nema potvrde. */
  get zetMozePotvrda(): boolean {
    return this.zetImaNovo && !this.zetImaGresku;
  }

  /** Službe uvijek idu prve, pa disponent čeka dok one nisu u bazi. */
  zetMozeIspravak(stavka: ZetSyncStavka): boolean {
    return (
      stavka.dokument === 'sluzba' ||
      this.zetStavke.find((s) => s.dokument === 'sluzba')?.status ===
        'nema_promjene'
    );
  }

  ucitajIspravak(stavka: ZetSyncStavka, event: Event): void {
    const input = event.target as HTMLInputElement;
    const pdf = input.files?.[0];
    input.value = '';
    if (!pdf) return;

    this.zetIspravakUcitava = true;

    this.uploadService
      .uploadPdf(stavka.dokument, pdf, stavka.sha256)
      .subscribe({
        next: (res) => {
          this.zetIspravakUcitava = false;
          this.messages.add({
            severity: 'success',
            summary: 'Ispravak ubačen',
            detail: res.poruka,
          });
          this.ucitajStanje();
          this.osvjeziPovijest();
          this.provjeriZet();
        },
        error: () => {
          this.zetIspravakUcitava = false;
          this.messages.add({
            severity: 'error',
            summary: 'Neuspjelo',
            detail: 'Ispravljeni PDF nije pročitan.',
          });
        },
      });
  }

  togglePovijest(): void {
    this.povijestOtvorena = !this.povijestOtvorena;
    this.osvjeziPovijest();
  }

  provjeriZet(): void {
    this.zetLoading = true;
    this.zetStavke = [];
    this.zetGreska = '';

    this.uploadService.provjeriZetPodsused().subscribe({
      next: (res) => {
        this.zetStavke = res.stavke;
        this.zetVrijeme = new Date();
        this.zetLoading = false;
      },
      error: (err) => {
        this.zetGreska =
          err?.error?.message || 'Provjera podataka sa ZET-a nije uspjela.';
        this.zetLoading = false;
      },
    });
  }

  potvrdiZet(): void {
    const potvrda: ZetUvozPotvrda = {};
    for (const s of this.zetStavke) {
      if (s.status === 'novo') potvrda[s.dokument] = s.sha256;
    }

    this.zetUvozi = true;
    this.zetGreska = '';

    this.uploadService.uveziZetPodsused(potvrda).subscribe({
      next: (res) => {
        this.zetStavke = res.stavke;
        this.zetVrijeme = new Date();
        this.zetUvozi = false;
        this.ucitajStanje();

        const obradjeno = res.stavke.filter((s) => s.status === 'obradjeno');
        const greska = res.stavke.find((s) => s.status === 'greska');
        this.messages.add(
          greska
            ? {
                severity: 'error',
                summary: 'Uvoz nije dovršen',
                detail: `${this.naziviDokumenata[greska.dokument]} nisu spremljeni – provjeri rezultat.`,
              }
            : {
                severity: 'success',
                summary: 'Podaci ažurirani',
                detail: obradjeno
                  .map((s) => this.naziviDokumenata[s.dokument])
                  .join(' i '),
              },
        );
      },
      error: (err) => {
        // Server ništa nije upisao, a stari hashevi više ne vrijede.
        this.zetStavke = [];
        this.zetGreska =
          err?.error?.message || 'Uvoz podataka sa ZET-a nije uspio.';
        this.zetUvozi = false;
      },
    });
  }

  onManualUpload(tip: UploadTip, res: UploadOdgovor): void {
    if (res.status === 'nema_promjene') return;
    this.ucitajStanje();
    this.osvjeziPovijest();
    this.messages.add({
      severity: 'success',
      summary: 'Uvoz završen',
      detail: res.poruka,
    });
  }

  private osvjeziPovijest(): void {
    if (!this.povijestOtvorena) return;

    this.povijestUcitava = true;
    this.uploadService.fetchRucniUvozi().subscribe({
      next: (povijest) => {
        this.povijest = povijest;
        this.povijestUcitava = false;
      },
      error: () => {
        this.povijest = [];
        this.povijestUcitava = false;
      },
    });
  }

  zetSeverity(stavka: ZetSyncStavka): Severity {
    return {
      novo: 'warn',
      obradjeno: 'success',
      nema_promjene: 'info',
      greska: 'danger',
    }[stavka.status] as Severity;
  }

  zetStatusTekst(stavka: ZetSyncStavka): string {
    return {
      novo: 'Novo',
      obradjeno: 'Obrađeno',
      nema_promjene: 'Bez promjena',
      greska: 'Greška',
    }[stavka.status];
  }
}
