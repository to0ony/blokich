/** Zajedničko za punu kartu i karticu vozača: podloga, boje, oznaka vozila. */
import type { Map as MapaLibre } from 'maplibre-gl';
import { tamnaTema } from '../../theme/tema.service';

/**
 * Smije li kamera sad pratiti vozilo? Ne dok vozač dira kartu (i malo
 * nakon): svaka promjena kamere u MapLibreu prekida započetu gestu, pa se
 * karta inače ne bi dala ni povući ni zumirati.
 */
export function slobodnaKamera(mapa: MapaLibre): () => boolean {
  let dira = false;
  let zadnje = 0;
  const pocni = () => {
    dira = true;
    zadnje = performance.now();
  };
  const kraj = () => {
    dira = false;
    zadnje = performance.now();
  };
  mapa.on('touchstart', pocni);
  mapa.on('mousedown', pocni);
  mapa.on('touchend', kraj);
  mapa.on('touchcancel', kraj);
  mapa.on('mouseup', kraj);
  mapa.on('wheel', () => (zadnje = performance.now()));
  return () => !dira && performance.now() - zadnje > 350 && !mapa.isMoving();
}

export type Tema = 'svijetla' | 'tamna';

export const STIL: Record<Tema, string> = {
  svijetla: 'https://tiles.openfreemap.org/styles/positron',
  tamna: 'https://tiles.openfreemap.org/styles/dark',
};

/** Boje karte po temi – vozila su neutralna, ističe se samo Podsused i odabrano. */
export const BOJE: Record<
  Tema,
  {
    podsused: string;
    podsusedTekst: string;
    ostali: string;
    ostaliTekst: string;
    odabrano: string;
    rub: string;
    trasa: string;
    ime: string;
    stajalisteIspuna: string;
    stajalisteNaziv: string;
  }
> = {
  svijetla: {
    podsused: '#1e293b',
    podsusedTekst: '#ffffff',
    ostali: '#94a3b8',
    ostaliTekst: '#ffffff',
    odabrano: '#2563eb',
    rub: '#ffffff',
    trasa: '#2563eb',
    ime: '#0f172a',
    stajalisteIspuna: '#ffffff',
    stajalisteNaziv: '#1e3a8a',
  },
  tamna: {
    podsused: '#e2e8f0',
    podsusedTekst: '#0f172a',
    ostali: '#475569',
    ostaliTekst: '#e2e8f0',
    odabrano: '#3b82f6',
    rub: '#0b1220',
    trasa: '#60a5fa',
    ime: '#e2e8f0',
    stajalisteIspuna: '#0b1220',
    stajalisteNaziv: '#bfdbfe',
  },
};

export const POSTAVKE_KEY = 'karta-postavke';

export interface PostavkeKarte {
  samoPodsused: boolean;
  tramvaji: boolean;
  tema: Tema | null;
}

export function ucitajPostavke(): PostavkeKarte {
  try {
    const p = JSON.parse(localStorage.getItem(POSTAVKE_KEY) ?? '{}');
    return {
      samoPodsused: !!p.samoPodsused,
      tramvaji: p.tramvaji !== false,
      tema: p.tema === 'svijetla' || p.tema === 'tamna' ? p.tema : null,
    };
  } catch {
    return { samoPodsused: false, tramvaji: true, tema: null };
  }
}

export function sustavTamna(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

/** Tema karte prati temu odabranu u profilu (Svijetla / Tamna / Kao na mobitelu). */
export function temaKarte(): Tema {
  return tamnaTema() ? 'tamna' : 'svijetla';
}

/** MapLibre CSS se učitava tek kad karta zatreba. */
export function ucitajCss(): void {
  if (document.getElementById('maplibre-css')) return;
  const l = document.createElement('link');
  l.id = 'maplibre-css';
  l.rel = 'stylesheet';
  l.href = 'maplibre.css';
  document.head.appendChild(l);
}

/**
 * Oznaka vozila: krug s kljunom u smjeru vožnje (SDF – boja i rub se zadaju
 * u sloju). Središte kruga je točno na sredini slike, pa rotacija ne pomiče
 * vozilo s pozicije.
 */
export function oznakaVozila(): ImageData {
  const n = 96;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d')!;
  const cx = n / 2;
  const r = 24;
  g.fillStyle = '#000';
  // Kljun: dvije tangente na krug koje se sastaju ispred njega.
  const vrh = cx - r - 9;
  const kut = Math.acos(r / (cx - vrh));
  g.beginPath();
  g.moveTo(cx, vrh);
  g.lineTo(cx - r * Math.sin(kut), cx - r * Math.cos(kut));
  g.lineTo(cx + r * Math.sin(kut), cx - r * Math.cos(kut));
  g.closePath();
  g.fill();
  g.beginPath();
  g.arc(cx, cx, r, 0, Math.PI * 2);
  g.fill();
  return g.getImageData(0, 0, n, n);
}
