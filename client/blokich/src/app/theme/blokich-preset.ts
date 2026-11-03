import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

/** Aura tema s plavom primarnom bojom (#0484f1 iz Bootstrap teme). */
export const BlokichPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#eef7ff',
      100: '#d9edff',
      200: '#bce0ff',
      300: '#8ecdff',
      400: '#59b0ff',
      500: '#0484f1',
      600: '#0272d6',
      700: '#035bad',
      800: '#074d8e',
      900: '#0c4275',
      950: '#09294d',
    },
  },
});
