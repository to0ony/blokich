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
    // Tamna tema: plavkaste (slate) površine kao ostatak aplikacije i
    // primarni gumbi s bijelim tekstom kao u svijetloj temi.
    colorScheme: {
      dark: {
        surface: {
          0: '#ffffff',
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#121b2b',
          950: '#0b1220',
        },
        primary: {
          color: '{primary.500}',
          contrastColor: '#ffffff',
          hoverColor: '{primary.400}',
          activeColor: '{primary.300}',
        },
      },
    },
  },
});
