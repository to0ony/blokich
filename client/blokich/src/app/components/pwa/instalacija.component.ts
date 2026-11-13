import { Component, inject } from '@angular/core';
import { PwaService } from '../../services/pwa.service';

/**
 * Kartica na prijavi: instaliraj Blokich na početni zaslon. Android/Chrome
 * dobiva gumb (sustavski dijalog), iOS upute preko izbornika Podijeli.
 */
@Component({
  selector: 'app-instalacija',
  standalone: true,
  template: `
    @if (pwa.mozeInstalirati()) {
      <div class="in">
        <img src="icons/icon-192.png" alt="" class="in-ikona" />
        <div class="in-txt">
          <strong>Instaliraj Blokich</strong>
          @if (pwa.imaGumb) {
            <small>Otvara se kao aplikacija, preko cijelog ekrana.</small>
          } @else {
            <small>
              Dodirni <i class="pi pi-upload" aria-label="Podijeli"></i> Podijeli, pa
              <b>Dodaj na početni zaslon</b>.
            </small>
          }
        </div>
        @if (pwa.imaGumb) {
          <button type="button" class="in-btn" (click)="pwa.instaliraj()">Instaliraj</button>
        }
        <button type="button" class="in-x" aria-label="Ne sad" (click)="pwa.odbij()">
          <i class="pi pi-times"></i>
        </button>
      </div>
    }
  `,
  styles: `
    .in {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 6px 10px 12px;
      border: 1px solid var(--vz-border);
      border-radius: 14px;
      background: var(--vz-surface);
      color: var(--vz-text);
    }
    .in-ikona {
      flex: none;
      width: 40px;
      height: 40px;
      border-radius: 10px;
      border: 1px solid var(--vz-border);
    }
    .in-txt {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
      strong {
        font-size: 14.5px;
      }
      small {
        font-size: 12.5px;
        line-height: 1.35;
        color: var(--vz-muted);
      }
      .pi {
        font-size: 12px;
      }
    }
    .in-btn {
      flex: none;
      padding: 8px 14px;
      border: none;
      border-radius: 999px;
      background: var(--p-primary-color, #1b3654);
      color: var(--p-primary-contrast-color, #fff);
      font-size: 13.5px;
      font-weight: 650;
      cursor: pointer;
    }
    .in-x {
      display: grid;
      flex: none;
      place-items: center;
      width: 36px;
      height: 36px;
      padding: 0;
      border: none;
      border-radius: 50%;
      background: transparent;
      color: var(--vz-muted);
      cursor: pointer;
      .pi {
        font-size: 12px;
      }
    }
    .in-x:active {
      background: var(--vz-surface-2);
    }
  `,
})
export class InstalacijaComponent {
  readonly pwa = inject(PwaService);
}
