import { Component, Input } from '@angular/core';

interface Marka {
  oznaka: string;
  naziv: string;
  boja: string;
  pozadina: string;
}

/**
 * Oznaka marke autobusa – jednostavna pločica s nazivom u stilu aplikacije
 * (namjerno ne kopira službene logotipe proizvođača).
 */
const MARKE: { uzorak: RegExp; marka: Marka }[] = [
  { uzorak: /^MAN\b/i, marka: { oznaka: 'MAN', naziv: 'MAN', boja: '#ffffff', pozadina: '#1e3a5f' } },
  { uzorak: /mercedes/i, marka: { oznaka: 'MB', naziv: 'Mercedes-Benz', boja: '#1f2937', pozadina: '#e5e7eb' } },
  { uzorak: /feniks/i, marka: { oznaka: 'FENIKS', naziv: 'Feniksbus', boja: '#ffffff', pozadina: '#0f766e' } },
  { uzorak: /iveco/i, marka: { oznaka: 'IVECO', naziv: 'Iveco', boja: '#ffffff', pozadina: '#1d4ed8' } },
];

const NEPOZNATA: Marka = { oznaka: 'BUS', naziv: 'Autobus', boja: '#475569', pozadina: '#f1f5f9' };

export function markaZa(model: string): Marka {
  return MARKE.find((m) => m.uzorak.test(model))?.marka ?? NEPOZNATA;
}

@Component({
  selector: 'app-marka',
  standalone: true,
  template: `<span
    class="mk"
    [class.is-small]="mala"
    [style.color]="marka.boja"
    [style.background]="marka.pozadina"
    [attr.title]="marka.naziv"
    [attr.aria-label]="marka.naziv"
    >{{ marka.oznaka }}</span
  >`,
  styles: `
    :host {
      display: inline-flex;
    }
    .mk {
      display: inline-grid;
      place-items: center;
      min-width: 44px;
      height: 28px;
      padding: 0 8px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.6px;
      line-height: 1;
      box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08);
    }
    .mk.is-small {
      min-width: 36px;
      height: 22px;
      padding: 0 6px;
      font-size: 9.5px;
      border-radius: 6px;
    }
  `,
})
export class MarkaComponent {
  @Input({ required: true }) set model(v: string) {
    this.marka = markaZa(v ?? '');
  }
  @Input() mala = false;
  marka: Marka = NEPOZNATA;
}
