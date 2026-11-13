import { Component, inject } from '@angular/core';
import { PwaService } from '../../services/pwa.service';

/** Globalne obavijesti na vrhu ekrana: nema veze, nova verzija spremna. */
@Component({
  selector: 'app-pwa-obavijesti',
  standalone: true,
  template: `
    <div class="po" aria-live="polite">
      @if (!pwa.online()) {
        <div class="po-pill">
          <i class="pi pi-wifi"></i>
          <span>Nema veze · prikazani su zadnji spremljeni podaci</span>
        </div>
      }
      @if (pwa.novaVerzija()) {
        <div class="po-pill is-klik">
          <i class="pi pi-sparkles"></i>
          <span>Nova verzija je spremna</span>
          <button type="button" (click)="pwa.osvjezi()">Osvježi</button>
          <button type="button" class="po-x" aria-label="Kasnije" (click)="pwa.novaVerzija.set(false)">
            <i class="pi pi-times"></i>
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .po {
      position: fixed;
      top: calc(env(safe-area-inset-top) + 8px);
      left: 50%;
      z-index: 2000;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      width: max-content;
      max-width: calc(100vw - 24px);
      transform: translateX(-50%);
      pointer-events: none;
    }
    .po-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 14px;
      border-radius: 999px;
      background: #0f172a;
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 6px 20px rgba(15, 23, 42, 0.25);
      animation: po-ulaz 0.25s ease-out;
      .pi {
        font-size: 13px;
        opacity: 0.85;
      }
    }
    .po-pill.is-klik {
      padding-right: 4px;
      pointer-events: auto;
    }
    button {
      padding: 5px 12px;
      border: none;
      border-radius: 999px;
      background: #fff;
      color: #0f172a;
      font-size: 12.5px;
      font-weight: 700;
      cursor: pointer;
    }
    .po-x {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      padding: 0;
      background: transparent;
      color: #fff;
      .pi {
        font-size: 11px;
      }
    }
    :host-context(.blokich-dark) .po-pill {
      background: #1f3a5c;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    @keyframes po-ulaz {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
    }
  `,
})
export class PwaObavijestiComponent {
  readonly pwa = inject(PwaService);
}
