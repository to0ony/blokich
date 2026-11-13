import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PrimeNG } from 'primeng/config';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { UploadService } from '../../../services/upload.service';
import { postaviPrimeNgTemu } from '../../../theme/primeng-setup';

dayjs.extend(isoWeek);

/**
 * Okvir za preglede s login ekrana (bez prijave službenim brojem): zaglavlje
 * s povratkom na prijavu i podatak je li objavljen raspored za naredni tjedan.
 */
@Component({
  selector: 'app-pregled-okvir',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="vz-app ps">
      <header class="ps-top">
        <div class="ps-top-inner">
          <a routerLink="/login" class="ps-back" aria-label="Natrag na prijavu">
            <i class="pi pi-arrow-left"></i>
          </a>
          <img src="assets/blokich_logo.png" alt="Blokich" class="ps-logo" />
          <span class="ps-spacer"></span>
        </div>
      </header>
      <main class="ps-main">
        <ng-content />
      </main>
    </div>
  `,
  styles: `
    .ps {
      min-height: 100vh;
      min-height: 100dvh;
      background: var(--vz-bg);
    }
    .ps-top {
      position: sticky;
      top: 0;
      z-index: 50;
      background: var(--vz-topbar);
      backdrop-filter: saturate(180%) blur(14px);
      -webkit-backdrop-filter: saturate(180%) blur(14px);
      border-bottom: 1px solid var(--vz-border);
      padding-top: env(safe-area-inset-top);
    }
    .ps-top-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      max-width: 680px;
      height: 56px;
      margin: 0 auto;
      padding: 0 8px;
    }
    .ps-back,
    .ps-spacer {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
    }
    .ps-back {
      border-radius: 50%;
      color: var(--vz-text);
      text-decoration: none;
      font-size: 18px;
    }
    .ps-back:active {
      background: var(--vz-surface-2);
    }
    .ps-logo {
      height: 24px;
    }
    .ps-main {
      max-width: 680px;
      margin: 0 auto;
      padding: 16px 16px calc(32px + env(safe-area-inset-bottom));
    }
  `,
})
export class PregledOkvirComponent implements OnInit {
  private readonly uploadService = inject(UploadService);
  naredniDostupan = false;

  constructor() {
    postaviPrimeNgTemu(inject(PrimeNG));
  }

  ngOnInit(): void {
    // Isto kao na loginu: naredni tjedan je dostupan kad zadnji disponent
    // pokriva sljedeći tjedan.
    this.uploadService.fetchLastDisponentUpload().subscribe({
      next: (res: any) => {
        const sljedeci = dayjs().add(1, 'week');
        this.naredniDostupan =
          res?.godina === sljedeci.isoWeekYear() &&
          res?.brojTjedna === sljedeci.isoWeek();
      },
      error: () => (this.naredniDostupan = false),
    });
  }
}
