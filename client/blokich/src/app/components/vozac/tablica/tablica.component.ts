import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Hrvatska registarska tablica u malom: EU stupac (zvjezdice + HR),
 * oznaka grada, grb i broj – npr. "ZG-4262-LB" → ZG [grb] 4262-LB.
 */
let brojac = 0;

@Component({
  selector: 'app-tablica',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="tb" [attr.aria-label]="'Registracija ' + tablica">
      <span class="tb-eu" aria-hidden="true">
        <svg viewBox="0 0 20 20" class="tb-stars">
          <circle
            *ngFor="let z of zvjezdice"
            [attr.cx]="z.x"
            [attr.cy]="z.y"
            r="1.15"
            fill="#ffd617"
          />
        </svg>
        <span class="tb-hr">HR</span>
      </span>
      <span class="tb-txt">
        <span>{{ grad }}</span>
        <svg class="tb-grb" viewBox="0 0 20 26" aria-hidden="true">
          <!-- kruna (pojednostavljeno) -->
          <rect x="1" y="0.5" width="3.4" height="4.5" rx="0.8" fill="#2b5ba8" />
          <rect x="4.6" y="0" width="3.4" height="5" rx="0.8" fill="#4a90d9" />
          <rect x="8.3" y="0" width="3.4" height="5" rx="0.8" fill="#2b5ba8" />
          <rect x="12" y="0" width="3.4" height="5" rx="0.8" fill="#4a90d9" />
          <rect x="15.6" y="0.5" width="3.4" height="4.5" rx="0.8" fill="#2b5ba8" />
          <!-- šahovnica: crveno polje gore lijevo -->
          <clipPath [attr.id]="clipId">
            <path d="M1 6h18v10.5c0 5-4 8-9 9.5C5 24.5 1 21.5 1 16.5z" />
          </clipPath>
          <g [attr.clip-path]="'url(#' + clipId + ')'">
            <rect x="1" y="6" width="18" height="20" fill="#fff" />
            <ng-container *ngFor="let p of polja">
              <rect [attr.x]="p.x" [attr.y]="p.y" width="3.6" height="4" fill="#e1251b" />
            </ng-container>
          </g>
          <path
            d="M1 6h18v10.5c0 5-4 8-9 9.5C5 24.5 1 21.5 1 16.5z"
            fill="none"
            stroke="#e1251b"
            stroke-width="0.6"
          />
        </svg>
        <span>{{ ostatak }}</span>
      </span>
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    .tb {
      display: inline-flex;
      align-items: stretch;
      height: 26px;
      border: 1.5px solid #111;
      border-radius: 4px;
      background: #fff;
      overflow: hidden;
      box-shadow: 0 0 0 1px #fff, 0 0 0 2px #c8ccd2;
    }
    .tb-eu {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      width: 15px;
      padding: 2px 0 1px;
      background: #1446a0;
    }
    .tb-stars {
      width: 11px;
      height: 11px;
    }
    .tb-hr {
      font-size: 7px;
      font-weight: 700;
      line-height: 1;
      color: #fff;
      font-family: Arial, sans-serif;
    }
    .tb-txt {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 0 6px 0 5px;
      font-family: 'Arial Narrow', 'Roboto Condensed', Arial, sans-serif;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.3px;
      color: #111;
      white-space: nowrap;
    }
    .tb-grb {
      width: 10px;
      height: 13px;
    }
  `,
})
export class TablicaComponent {
  /** Jedinstveni id za clipPath (na stranici je puno tablica). */
  readonly clipId = `tb-stit-${++brojac}`;
  grad = '';
  ostatak = '';

  @Input({ required: true }) set tablica(v: string) {
    // "ZG-4262-LB" → grad "ZG", ostatak "4262-LB"
    const t = (v ?? '').trim().toUpperCase();
    const m = /^([A-ZČĆŠŽĐ]{2})[\s-]+(.+)$/.exec(t);
    this.grad = m ? m[1] : t;
    this.ostatak = m ? m[2] : '';
    this._tablica = t;
  }
  get tablica(): string {
    return this._tablica;
  }
  private _tablica = '';

  /** 12 zvjezdica u krugu. */
  readonly zvjezdice = Array.from({ length: 12 }, (_, i) => {
    const kut = (i / 12) * 2 * Math.PI;
    return { x: 10 + 7.5 * Math.sin(kut), y: 10 - 7.5 * Math.cos(kut) };
  });

  /** Crvena polja šahovnice 5×5 (crveno počinje gore lijevo). */
  readonly polja = Array.from({ length: 25 }, (_, i) => ({ r: Math.floor(i / 5), c: i % 5 }))
    .filter(({ r, c }) => (r + c) % 2 === 0)
    .map(({ r, c }) => ({ x: 1 + c * 3.6, y: 6 + r * 4 }));
}
