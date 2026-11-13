import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Observable, Subject } from 'rxjs';

export type Tema = 'svijetla' | 'tamna' | 'sustav';

const KLJUC = 'blokich.tema';

function procitaj(): Tema {
  try {
    const t = localStorage.getItem(KLJUC);
    if (t === 'tamna' || t === 'sustav' || t === 'svijetla') return t;
  } catch {}
  // Zadano: kako je postavljeno na uređaju; izbor u profilu to nadjača.
  return 'sustav';
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
/** --vz-bg svijetle i tamne teme (styles.scss), za <meta name="theme-color">. */
const BOJA_SVIJETLA = '#f3f5f8';
const BOJA_TAMNA = '#0b1220';

/**
 * Uvijek svijetlo: admin (nema tamnu temu) i popis službi (/sluzbe), koji
 * izgleda kao papirnati raspored.
 */
const BEZ_TEME = /^\/(admin|alogin|sluzbe)(\/|\?|$)/;

/**
 * Tema aplikacije (prijava, vozač, pregledi, karte). Zadano prema sustavu;
 * izbor u profilu se pamti u pregledniku i vrijedi svugdje. Admin i popis službi
 * ostaju svijetli.
 */
@Injectable({ providedIn: 'root' })
export class TemaService {
  private aktivna = false;
  private readonly promjena = new Subject<void>();
  /** Javlja svaku promjenu teme (izbor u profilu ili postavka sustava ("Prema sustavu")). */
  readonly promjena$: Observable<void> = this.promjena.asObservable();

  constructor() {
    // Klasa na <html> prati stranicu: svugdje osim admina.
    const router = inject(Router);
    // Odmah pri pokretanju, da prvi ekran ne bljesne svijetlo.
    this.aktivna = !BEZ_TEME.test(location.pathname);
    this.primijeni();
    router.events.subscribe((e) => {
      if (!(e instanceof NavigationEnd)) return;
      this.aktivna = !BEZ_TEME.test(e.urlAfterRedirects);
      this.primijeni();
    });
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

  private primijeni(): void {
    const tamna = this.aktivna && tamnaTema();
    const html = document.documentElement;
    html.classList.toggle(KLASA, tamna);
    html.style.colorScheme = tamna ? 'dark' : '';
    // Traka sustava (status bar, adresna traka) u boji pozadine aplikacije.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', tamna ? BOJA_TAMNA : BOJA_SVIJETLA);
  }
}
