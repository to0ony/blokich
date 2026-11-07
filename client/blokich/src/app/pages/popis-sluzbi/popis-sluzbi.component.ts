import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonModule } from 'primeng/skeleton';
import { PregledOkvirComponent } from '../../components/vozac/pregled-okvir/pregled-okvir.component';
import { SluzbePopisComponent } from '../../components/sluzbe-popis/sluzbe-popis.component';
import { AktualneSluzbe, UploadService } from '../../services/upload.service';

type Tjedan = 'tekuci' | 'naredni';

/** Popis svih službi aktualne verzije – s login ekrana, bez prijave. */
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
    <app-pregled-okvir #okvir>
      <header class="pls-head">
        <div>
          <h1>Popis službi</h1>
          @if (podaci) {
            <p>
              Tjedan {{ podaci.tjedan.brojTjedna }}/{{ podaci.tjedan.godina }} ·
              verzija {{ podaci.verzija }}
            </p>
          }
        </div>
        @if (okvir.naredniDostupan) {
          <div class="pls-switch" role="group" aria-label="Tjedan">
            <button
              type="button"
              [class.is-on]="tjedan === 'tekuci'"
              (click)="odaberi('tekuci')"
            >
              Ovaj tjedan
            </button>
            <button
              type="button"
              [class.is-on]="tjedan === 'naredni'"
              (click)="odaberi('naredni')"
            >
              Sljedeći
            </button>
          </div>
        }
      </header>

      @if (podaci && !podaci.prema_disponentu) {
        <p class="pls-note">
          <i class="pi pi-info-circle"></i>
          Za ovaj tjedan još nema disponenta – prikazane su zadnje učitane
          službe.
        </p>
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
      } @else if (podaci) {
        <app-sluzbe-popis [zapisi]="podaci.sluzbe" [vrhFiltera]="56" />
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
    .pls-head h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 800;
    }
    .pls-head p {
      margin: 2px 0 0;
      font-size: 13px;
      color: var(--vz-muted);
    }
    .pls-switch {
      display: inline-flex;
      padding: 3px;
      background: var(--vz-surface);
      border: 1px solid var(--vz-border);
      border-radius: 10px;
    }
    .pls-switch button {
      min-height: 34px;
      padding: 4px 12px;
      font-size: 13px;
      font-weight: 600;
      color: var(--vz-muted);
      background: none;
      border: none;
      border-radius: 7px;
      cursor: pointer;
    }
    .pls-switch button.is-on {
      color: #fff;
      background: var(--p-primary-600);
    }
    .pls-note {
      margin: 0 0 12px;
      padding: 8px 12px;
      font-size: 13px;
      color: #92400e;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 10px;
    }
    .pls-error {
      color: #dc2626;
      font-size: 14px;
    }
  `,
})
export class PopisSluzbiComponent implements OnInit {
  tjedan: Tjedan = 'tekuci';
  podaci: AktualneSluzbe | null = null;
  ucitava = true;
  greska = '';

  constructor(private uploadService: UploadService) {}

  ngOnInit(): void {
    this.ucitaj();
  }

  odaberi(tjedan: Tjedan): void {
    if (tjedan === this.tjedan) return;
    this.tjedan = tjedan;
    this.ucitaj();
  }

  private ucitaj(): void {
    this.ucitava = true;
    this.greska = '';
    this.uploadService.fetchAktualneSluzbe(this.tjedan).subscribe({
      next: (res) => {
        this.podaci = res;
        this.ucitava = false;
      },
      error: (err) => {
        this.greska = err?.error?.message || 'Službe nisu dohvaćene.';
        this.ucitava = false;
      },
    });
  }
}
