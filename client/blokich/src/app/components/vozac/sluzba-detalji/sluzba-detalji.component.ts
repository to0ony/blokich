import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Sluzba,
  pauzaMinuta,
  rutaUrl,
  satiSluzbe,
  trajanjeTekst,
} from '../vozac.model';

/**
 * Detalji službe jednog dana: svaki dio (308, 308P) s linijom, vremenom i
 * mjestima, pauza između dijelova, a sati cijele službe samo jednom.
 */
@Component({
  selector: 'app-sluzba-detalji',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sluzba-detalji.component.html',
  styleUrl: './sluzba-detalji.component.scss',
})
export class SluzbaDetaljiComponent {
  @Input() sluzbe: Sluzba[] = [];

  readonly rutaUrl = rutaUrl;

  get sati() {
    return satiSluzbe(this.sluzbe);
  }

  /** Pauza prije (i+1). dijela, npr. "30 min"; null ako nema razmaka. */
  pauza(i: number): string | null {
    const min = pauzaMinuta(this.sluzbe[i]?.do, this.sluzbe[i + 1]?.od);
    return min ? trajanjeTekst(min) : null;
  }
}
