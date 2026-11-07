import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import { SluzbaZapis } from '../../services/upload.service';

export type Dan = 'RADNI_DAN' | 'SUBOTA' | 'NEDJELJA';

/** Jedna služba sa svim svojim dijelovima ("79" + "79P"). */
export interface SluzbaGrupa {
  broj: string;
  dijelovi: (SluzbaZapis & { trajanje: number | null })[];
  prvi: SluzbaZapis;
  dani: Dan[];
  linije: string[];
  sekcija: string | null;
  vrsta: string;
  pretraga: string;
}

export const DANI: { kljuc: Dan; kratko: string; naziv: string }[] = [
  { kljuc: 'RADNI_DAN', kratko: 'R', naziv: 'Radni dan' },
  { kljuc: 'SUBOTA', kratko: 'S', naziv: 'Subota' },
  { kljuc: 'NEDJELJA', kratko: 'N', naziv: 'Nedjelja' },
];

function minute(t?: string | null): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t ?? '');
  return m ? +m[1] * 60 + +m[2] : null;
}

/** Grupira ravne zapise po broju službe, poredano po broju. */
export function grupiraj(zapisi: SluzbaZapis[]): SluzbaGrupa[] {
  const grupe = new Map<string, SluzbaGrupa>();
  for (const z of zapisi) {
    const broj = (z.br_sl ?? '').trim().replace(/P+$/i, '');
    if (!broj) continue;
    const od = minute(z.od);
    const doo = minute(z.do);
    const trajanje =
      od !== null && doo !== null ? (doo - od + 1440) % 1440 : null;
    let g = grupe.get(broj);
    if (!g) {
      g = {
        broj,
        dijelovi: [],
        prvi: z,
        dani: [],
        linije: [],
        sekcija: z.sekcija ?? null,
        vrsta: z.vrsta ?? '',
        pretraga: '',
      };
      grupe.set(broj, g);
    }
    g.dijelovi.push({ ...z, trajanje });
    for (const d of z.dani ?? []) if (!g.dani.includes(d)) g.dani.push(d);
    const lin = z.linija?.trim();
    if (lin && !g.linije.includes(lin)) g.linije.push(lin);
  }

  const lista = [...grupe.values()];
  for (const g of lista) {
    // "79" prije "79P", "79PP"
    g.dijelovi.sort((a, b) => a.br_sl.length - b.br_sl.length);
    g.prvi = g.dijelovi[0];
    if (!g.vrsta)
      g.vrsta = g.dijelovi.length > 1 ? 'dvodijelna' : 'jednodijelna';
    g.pretraga = [
      g.broj,
      ...g.linije,
      ...g.dijelovi.flatMap((d) => [d.nastup_sluzbe, d.zavrsna_sluzba]),
      g.sekcija,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }
  return lista.sort(
    (a, b) => +a.broj - +b.broj || a.broj.localeCompare(b.broj),
  );
}

/**
 * Popis službi jedne verzije: sažetak, filteri i tablica. Na uskom prostoru
 * (mobitel) tablica postaje popis kartica. Koriste ga admin dijalog i
 * pregled s login ekrana.
 */
@Component({
  selector: 'app-sluzbe-popis',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, CheckboxModule],
  templateUrl: './sluzbe-popis.component.html',
  styleUrl: './sluzbe-popis.component.scss',
})
export class SluzbePopisComponent implements OnChanges {
  @Input() zapisi: SluzbaZapis[] = [];
  /** Tjedni u kojima je verzija korištena (samo admin). */
  @Input() tjedni: { godina: number; brojTjedna: number }[] | null = null;
  /** Sticky vrh filtera (npr. ispod fiksnog zaglavlja stranice). */
  @Input() vrhFiltera = 0;

  readonly dani = DANI;

  grupe: SluzbaGrupa[] = [];
  prikazane: SluzbaGrupa[] = [];

  pretraga = '';
  odabraniDani: Dan[] = ['RADNI_DAN', 'SUBOTA', 'NEDJELJA'];
  samoDvodijelne = false;
  imaDane = false;

  ngOnChanges(): void {
    this.grupe = grupiraj(this.zapisi ?? []);
    this.imaDane = this.grupe.some((g) => g.dani.length);
    this.filtriraj();
  }

  filtriraj(): void {
    const t = this.pretraga.trim().toLowerCase();
    this.prikazane = this.grupe.filter(
      (g) =>
        (!t || g.pretraga.includes(t)) &&
        (!this.samoDvodijelne || g.dijelovi.length > 1) &&
        (!this.imaDane ||
          !g.dani.length ||
          g.dani.some((d) => this.odabraniDani.includes(d))),
    );
  }

  prebaciDan(dan: Dan): void {
    this.odabraniDani = this.odabraniDani.includes(dan)
      ? this.odabraniDani.filter((d) => d !== dan)
      : [...this.odabraniDani, dan];
    this.filtriraj();
  }

  /** Naslov sekcije prikazuje se iznad prve službe u njoj (bez filtera). */
  novaSekcija(i: number): string | null {
    if (this.pretraga || this.samoDvodijelne) return null;
    const g = this.prikazane[i];
    const prije = this.prikazane[i - 1];
    if (!g.sekcija || g.sekcija === prije?.sekcija) return null;
    return g.sekcija;
  }

  get brojDvodijelnih(): number {
    return this.grupe.filter((g) => g.dijelovi.length > 1).length;
  }

  brojPoDanu(dan: Dan): number {
    return this.grupe.filter((g) => g.dani.includes(dan)).length;
  }

  jePricuva(linija?: string | null): boolean {
    return /PRIČ/i.test(linija ?? '');
  }

  prekoPonoci(d: SluzbaZapis): boolean {
    const od = minute(d.od);
    const doo = minute(d.do);
    return od !== null && doo !== null && doo < od;
  }

  trajanjeTekst(min: number | null): string {
    if (min === null) return '';
    return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
  }

  vrstaTekst(g: SluzbaGrupa): string {
    return (
      (
        {
          s_pauzom: 'pauza',
          dvokratna: 'dvokratna',
          dvodijelna: 'dvodijelna',
        } as Record<string, string>
      )[g.vrsta] ?? ''
    );
  }
}
