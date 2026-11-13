import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export type Tema = 'svijetla' | 'tamna' | 'sustav';

const KLJUC = 'blokich.tema';

function procitaj(): Tema {
  try {
    const t = localStorage.getItem(KLJUC);
    if (t === 'tamna' || t === 'sustav' || t === 'svijetla') return t;
  } catch {}
  return 'svijetla';
}

function sustavJeTamni(): boolean {
  try {
    return matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

/** Je li prema izboru u profilu sad tamna tema (i za karte). */
export function tamnaTema(): boolean {
  const t = procitaj();
  return t === 'tamna' || (t === 'sustav' && sustavJeTamni());
}
/** Klasa na <html>: uključuje PrimeNG tamni način i tamne --vz-* boje. */
const KLASA = 'blokich-dark';

/**
 * Tema vozačke aplikacije. Odabir se pamti u pregledniku; tamna klasa je na
 * <html> samo dok je otvorena vozačka aplikacija (admin i prijava ostaju svijetli).
 */
@Injectable({ providedIn: 'root' })
export class TemaService {
  private aktivna = false;
  private readonly promjena = new Subject<void>();
  /** Javlja svaku promjenu teme (izbor u profilu ili mobitel u "Kao na mobitelu"). */
  readonly promjena$: Observable<void> = this.promjena.asObservable();

  constructor() {
    try {
      matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (procitaj() !== 'sustav') return;
        this.primijeni();
        this.promjena.next();
      });
    } catch {}
  }

  get tema(): Tema {
    return procitaj();
  }

  postavi(tema: Tema): void {
    try {
      localStorage.setItem(KLJUC, tema);
    } catch {}
    this.primijeni();
    this.promjena.next();
  }

  /** Vozačka aplikacija otvorena: primijeni odabranu temu. */
  ukljuci(): void {
    this.aktivna = true;
    this.primijeni();
  }

  /** Izlaz iz vozačke aplikacije: natrag na svijetlo. */
  iskljuci(): void {
    this.aktivna = false;
    this.primijeni();
  }

  private primijeni(): void {
    const tamna = this.aktivna && tamnaTema();
    const html = document.documentElement;
    html.classList.toggle(KLASA, tamna);
    html.style.colorScheme = tamna ? 'dark' : '';
  }
}
