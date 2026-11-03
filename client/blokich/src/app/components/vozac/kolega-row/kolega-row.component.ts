import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Kolega } from '../vozac.model';

/** Jedan vozač u popisu (smjena, linija, služba) – ime, vrijeme, poziv. */
@Component({
  selector: 'app-kolega-row',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kolega-row.component.html',
  styleUrl: './kolega-row.component.scss',
})
export class KolegaRowComponent {
  @Input({ required: true }) kolega!: Kolega;
  /** Prikaži vrijeme i mjesta (u pregledu službe po danima nije potrebno). */
  @Input() prikaziVrijeme = true;

  private readonly mojBroj = sessionStorage.getItem('sluzbeniBroj');

  get jaSam(): boolean {
    return !!this.mojBroj && this.kolega.sluz_broj === this.mojBroj;
  }

  get inicijali(): string {
    const ime = this.kolega.ime_prezime?.trim();
    if (!ime) return '?';
    const dijelovi = ime.split(/\s+/);
    return (dijelovi[0][0] + (dijelovi[1]?.[0] ?? '')).toUpperCase();
  }

  get varijanta(): string | undefined {
    return this.kolega['V.R'] || this.kolega.varijanta;
  }
}
