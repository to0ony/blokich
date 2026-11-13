import { Injectable } from '@angular/core';

export type Tema = 'svijetla' | 'tamna' | 'sustav';

const KLJUC = 'blokich.tema';
/** Klasa na <html>: uključuje PrimeNG tamni način i tamne --vz-* boje. */
const KLASA = 'blokich-dark';

/**
 * Tema vozačke aplikacije. Odabir se pamti u pregledniku; tamna klasa je na
 * <html> samo dok je otvorena vozačka aplikacija (admin i prijava ostaju svijetli).
 */
@Injectable({ providedIn: 'root' })
export class TemaService {
  private aktivna = false;
  private readonly sustav =
    typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;
  private readonly naPromjenuSustava = () => this.primijeni();

  get tema(): Tema {
    try {
      const t = localStorage.getItem(KLJUC);
      if (t === 'tamna' || t === 'sustav' || t === 'svijetla') return t;
    } catch {}
    return 'svijetla';
  }

  postavi(tema: Tema): void {
    try {
      localStorage.setItem(KLJUC, tema);
    } catch {}
    this.primijeni();
  }

  /** Vozačka aplikacija otvorena: primijeni odabranu temu i prati sustav. */
  ukljuci(): void {
    this.aktivna = true;
    this.sustav?.addEventListener('change', this.naPromjenuSustava);
    this.primijeni();
  }

  /** Izlaz iz vozačke aplikacije: natrag na svijetlo. */
  iskljuci(): void {
    this.aktivna = false;
    this.sustav?.removeEventListener('change', this.naPromjenuSustava);
    this.primijeni();
  }

  private primijeni(): void {
    const t = this.tema;
    const tamna = this.aktivna && (t === 'tamna' || (t === 'sustav' && !!this.sustav?.matches));
    const html = document.documentElement;
    html.classList.toggle(KLASA, tamna);
    html.style.colorScheme = tamna ? 'dark' : '';
  }
}
