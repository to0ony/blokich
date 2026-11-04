import { PrimeNG } from 'primeng/config';
import { BlokichPreset } from './blokich-preset';

/**
 * Postavlja PrimeNG temu. Zove se iz lazy-loaded stranica (admin, vozač),
 * da login ostane bez PrimeNG-a u početnom bundleu.
 */
export function postaviPrimeNgTemu(primeng: PrimeNG): void {
  primeng.setConfig({
    ripple: true,
    theme: {
      preset: BlokichPreset,
      // Aplikacija je samo svijetla – tamni način se nikad ne uključuje sam.
      options: { darkModeSelector: '.blokich-dark' },
    },
  });
}
