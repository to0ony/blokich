import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SkeletonModule } from 'primeng/skeleton';
import { PregledOkvirComponent } from '../../components/vozac/pregled-okvir/pregled-okvir.component';
import { SluzbePopisComponent } from '../../components/sluzbe-popis/sluzbe-popis.component';
import {
  RasponTjedana,
  rasponiTjedana,
} from '../../components/sluzbe-popis/tjedni-raspon';
import {
  KoristenaVerzija,
  SluzbaZapis,
  UploadService,
} from '../../services/upload.service';

interface Prikaz {
  verzija: string;
  sluzbe: SluzbaZapis[];
  rasponi: RasponTjedana[];
}

interface StavkaPovijesti {
  verzija: string;
  rasponi: RasponTjedana[];
}

/**
 * Popis službi s login ekrana: aktualne službe (verzija tekućeg tjedna) i
 * gumb za prethodne – samo verzije koje je neki tjedan stvarno koristio.
 */
@Component({
  selector: 'app-popis-sluzbi',
  standalone: true,
  imports: [
    CommonModule,
    SkeletonModule,
    PregledOkvirComponent,
    SluzbePopisComponent,
  ],
  template: `
    <app-pregled-okvir>
      <header class="pls-head">
        <div class="pls-title">
          <h1>
            {{ jeAktualna ? 'Popis službi' : 'Prethodne službe' }}
          </h1>
          @if (prikaz) {
            @if (prikaz.rasponi.length) {
              @for (r of prikaz.rasponi; track r.tekst) {
                <p>{{ r.tekst }}</p>
              }
            } @else {
              <p>Zadnje učitane službe · još ih ne koristi nijedan tjedan</p>
            }
          }
        </div>
        <div class="pls-actions">
          @if (!jeAktualna && aktualnaVerzija) {
            <button
              type="button"
              class="pls-btn"
              (click)="otvori(aktualnaVerzija)"
            >
              <i class="pi pi-arrow-left"></i> Aktualne
            </button>
          }
          @if (povijest.length) {
            <button
              type="button"
              class="pls-btn"
              [class.is-open]="povijestOtvorena"
              [attr.aria-expanded]="povijestOtvorena"
              (click)="povijestOtvorena = !povijestOtvorena"
            >
              <i class="pi pi-history"></i> Prethodne službe
              <i
                class="pi"
                [class.pi-chevron-down]="!povijestOtvorena"
                [class.pi-chevron-up]="povijestOtvorena"
              ></i>
            </button>
          }
        </div>
      </header>

      @if (povijestOtvorena) {
        <nav class="pls-history" aria-label="Prethodne službe">
          @for (s of povijest; track s.verzija) {
            <button
              type="button"
              class="pls-history-item"
              [class.is-current]="s.verzija === prikaz?.verzija"
              (click)="otvori(s.verzija)"
            >
              <span class="pls-history-weeks">
                @for (r of s.rasponi; track r.tekst) {
                  <span>{{ r.tekst }}</span>
                }
              </span>
              <span class="pls-history-meta">
                @if (s.verzija === aktualnaVerzija) {
                  <span class="pls-tag">Aktualno</span>
                }
                v{{ s.verzija }}
              </span>
            </button>
          }
        </nav>
      }

      @if (ucitava) {
        <p-skeleton height="2.4rem" styleClass="mb-2" />
        @for (i of [1, 2, 3, 4]; track i) {
          <p-skeleton height="6.5rem" styleClass="mb-2" />
        }
      } @else if (greska) {
        <p class="pls-error">
          <i class="pi pi-exclamation-triangle"></i> {{ greska }}
        </p>
      } @else if (prikaz) {
        <app-sluzbe-popis [zapisi]="prikaz.sluzbe" [vrhFiltera]="56" />
      }
    </app-pregled-okvir>
  `,
  styles: `
    :host {
      --sp-toolbar-bg: var(--vz-bg);
    }
    .pls-head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 12px;
    }
    .pls-title h1 {
      margin: 0 0 2px;
      font-size: 22px;
      font-weight: 800;
    }
    .pls-title p {
      margin: 0;
      font-size: 13px;
      color: var(--vz-muted);
    }
    .pls-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .pls-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 38px;
      padding: 6px 12px;
      font-size: 13.5px;
      font-weight: 600;
      color: var(--vz-text);
      background: var(--vz-surface);
      border: 1px solid var(--vz-border);
      border-radius: 10px;
      cursor: pointer;
    }
    .pls-btn .pi {
      font-size: 12px;
    }
    .pls-btn.is-open {
      color: var(--p-primary-700);
      border-color: var(--p-primary-200);
      background: var(--p-primary-50);
    }
    .pls-history {
      display: flex;
      flex-direction: column;
      margin-bottom: 14px;
      overflow: hidden;
      background: var(--vz-surface);
      border: 1px solid var(--vz-border);
      border-radius: 12px;
    }
    .pls-history-item {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 4px 12px;
      padding: 11px 14px;
      text-align: left;
      color: var(--vz-text);
      background: none;
      border: none;
      border-bottom: 1px solid var(--vz-border);
      cursor: pointer;
    }
    .pls-history-item:last-child {
      border-bottom: none;
    }
    .pls-history-item:active,
    .pls-history-item:hover {
      background: var(--vz-surface-2);
    }
    .pls-history-item.is-current {
      box-shadow: inset 3px 0 0 var(--p-primary-600);
      background: var(--p-primary-50);
    }
    .pls-history-weeks {
      display: flex;
      flex-direction: column;
      font-size: 14px;
      font-weight: 600;
    }
    .pls-history-meta {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--vz-muted);
    }
    .pls-tag {
      padding: 1px 7px;
      font-size: 11px;
      font-weight: 700;
      color: #166534;
      background: #dcfce7;
      border-radius: 999px;
    }
    .pls-error {
      color: #dc2626;
      font-size: 14px;
    }
  `,
})
export class PopisSluzbiComponent implements OnInit {
  prikaz: Prikaz | null = null;
  /** Aktualne službe ostaju u memoriji – ne moraju biti "korištene". */
  private aktualniPrikaz: Prikaz | null = null;
  aktualnaVerzija: string | null = null;
  povijest: StavkaPovijesti[] = [];
  povijestOtvorena = false;
  ucitava = true;
  greska = '';

  constructor(private uploadService: UploadService) {}

  get jeAktualna(): boolean {
    return !this.prikaz || this.prikaz.verzija === this.aktualnaVerzija;
  }

  ngOnInit(): void {
    forkJoin({
      aktualna: this.uploadService.fetchAktualneSluzbe('tekuci'),
      koristene: this.uploadService
        .fetchKoristeneSluzbe()
        .pipe(catchError(() => of([] as KoristenaVerzija[]))),
    }).subscribe({
      next: ({ aktualna, koristene }) => {
        this.povijest = koristene.map((k) => ({
          verzija: k.verzija,
          rasponi: rasponiTjedana(k.tjedni),
        }));
        this.aktualnaVerzija = aktualna.verzija;
        this.aktualniPrikaz = {
          verzija: aktualna.verzija,
          sluzbe: aktualna.sluzbe,
          rasponi: this.rasponiZa(aktualna.verzija),
        };
        this.prikaz = this.aktualniPrikaz;
        this.ucitava = false;
      },
      error: (err) => {
        this.greska = err?.error?.message || 'Službe nisu dohvaćene.';
        this.ucitava = false;
      },
    });
  }

  otvori(verzija: string): void {
    this.povijestOtvorena = false;
    if (verzija === this.prikaz?.verzija) return;
    if (verzija === this.aktualnaVerzija && this.aktualniPrikaz) {
      this.prikaz = this.aktualniPrikaz;
      window.scrollTo({ top: 0 });
      return;
    }

    this.ucitava = true;
    this.greska = '';
    this.uploadService.fetchKoristenaVerzija(verzija).subscribe({
      next: (res) => {
        this.prikaz = {
          verzija: res.verzija,
          sluzbe: res.sluzbe,
          rasponi: rasponiTjedana(res.tjedni),
        };
        this.ucitava = false;
        window.scrollTo({ top: 0 });
      },
      error: (err) => {
        this.greska = err?.error?.message || 'Službe nisu dohvaćene.';
        this.ucitava = false;
      },
    });
  }

  private rasponiZa(verzija: string): RasponTjedana[] {
    return this.povijest.find((p) => p.verzija === verzija)?.rasponi ?? [];
  }
}
