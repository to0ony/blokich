import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Kolega, inicijali, telefoni } from '../vozac.model';

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
    return inicijali(this.kolega.ime_prezime);
  }

  get telefoni(): string[] {
    return telefoni(this.kolega.kontakt_broj, this.kolega.kontakt_broj_info);
  }

  get imaDetalje(): boolean {
    return (
      (this.prikaziVrijeme && !!this.kolega.od) ||
      !!this.kolega.br_sl ||
      !!this.kolega.linija
    );
  }

  get varijanta(): string | undefined {
    return this.kolega['V.R'] || this.kolega.varijanta;
  }
}
