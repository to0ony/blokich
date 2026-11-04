import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectButtonModule } from 'primeng/selectbutton';
import { KolegaRowComponent } from '../kolega-row/kolega-row.component';
import { Kolega, kolegaKljuc } from '../vozac.model';

const GRUPIRAJ_KEY = 'vz-grupiraj-vr';

interface GrupaVr {
  vr: string | null;
  kolege: Kolega[];
}

/** Popis vozača na liniji, po vremenu ili grupiran po V.R. (izbor se pamti). */
@Component({
  selector: 'app-kolege-lista',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectButtonModule, KolegaRowComponent],
  templateUrl: './kolege-lista.component.html',
  styleUrl: './kolege-lista.component.scss',
})
export class KolegeListaComponent {
  @Input() set kolege(v: Kolega[] | null | undefined) {
    this._kolege = [...(v ?? [])].sort((a, b) => (a.od ?? '').localeCompare(b.od ?? ''));
    this.grupe = this.slozGrupe();
  }
  get kolege(): Kolega[] {
    return this._kolege;
  }

  /** Kašnjenje (s) po ključu vozača – samo za one koji upravo voze. */
  @Input() uzivo: Record<string, number> = {};

  kasnjenje(k: Kolega): number | null {
    return this.uzivo[kolegaKljuc(k)] ?? null;
  }

  private _kolege: Kolega[] = [];
  grupe: GrupaVr[] = [];
  grupiraj = this.ucitajIzbor();

  readonly opcije = [
    { label: 'Po vremenu', value: false },
    { label: 'Po V.R.', value: true },
  ];

  /** Prekidač ima smisla samo kad postoji više različitih V.R. */
  get imaViseVr(): boolean {
    return this.grupe.filter((g) => g.vr).length > 1;
  }

  promijeni(v: boolean): void {
    if (v === null || v === undefined) return;
    this.grupiraj = v;
    try {
      localStorage.setItem(GRUPIRAJ_KEY, v ? '1' : '0');
    } catch {}
  }

  private slozGrupe(): GrupaVr[] {
    const mapa = new Map<string | null, Kolega[]>();
    for (const k of this._kolege) {
      const vr = (k['V.R'] || k.varijanta || '').toString().trim() || null;
      if (!mapa.has(vr)) mapa.set(vr, []);
      mapa.get(vr)!.push(k);
    }
    return [...mapa.entries()]
      .map(([vr, kolege]) => ({ vr, kolege }))
      .sort((a, b) => {
        if (a.vr === null) return 1;
        if (b.vr === null) return -1;
        return a.vr.localeCompare(b.vr, 'hr', { numeric: true });
      });
  }

  private ucitajIzbor(): boolean {
    try {
      return localStorage.getItem(GRUPIRAJ_KEY) === '1';
    } catch {
      return false;
    }
  }
}
