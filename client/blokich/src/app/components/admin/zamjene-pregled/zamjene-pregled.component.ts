import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import dayjs from 'dayjs';
import {
  StanjeZamjene,
  ZamjenaAdmin,
  ZamjeneService,
} from '../../../services/zamjene.service';
import { DANI } from '../../vozac/vozac.model';

const STANJA: Record<
  StanjeZamjene,
  { tekst: string; severity: 'success' | 'info' | 'warn' | 'secondary' }
> = {
  primijenjena: { tekst: 'Aktivna', severity: 'success' },
  u_disponentu: { tekst: 'U disponentu', severity: 'info' },
  zastarjela: { tekst: 'Zastarjela', severity: 'warn' },
  ponistena: { tekst: 'Poništena', severity: 'secondary' },
};

/** Admin: pregled zamjena službi koje su vozači napravili, po vozaču. */
@Component({
  selector: 'app-zamjene-pregled',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule, TagModule, ButtonModule, SkeletonModule],
  templateUrl: './zamjene-pregled.component.html',
  styleUrl: './zamjene-pregled.component.scss',
})
export class ZamjenePregledComponent implements OnInit {
  vozaci: { label: string; value: string }[] = [];
  zamjene: ZamjenaAdmin[] = [];
  radnik: string | null = null;
  od = '';
  do = '';
  ucitava = false;
  greska = '';

  readonly stanja = STANJA;

  constructor(private zamjeneService: ZamjeneService) {}

  ngOnInit(): void {
    this.ucitaj();
  }

  ucitaj(): void {
    this.ucitava = true;
    this.greska = '';
    this.zamjeneService
      .adminPopis({ radnik: this.radnik ?? undefined, od: this.od, do: this.do })
      .subscribe({
        next: (res) => {
          this.zamjene = res.zamjene;
          this.vozaci = res.vozaci.map((v) => ({
            label: v.ime_prezime ? `${v.ime_prezime} (${v.sluz_broj})` : v.sluz_broj,
            value: v.sluz_broj,
          }));
          this.ucitava = false;
        },
        error: (err) => {
          this.greska = err?.error?.message || 'Zamjene nisu dohvaćene.';
          this.ucitava = false;
        },
      });
  }

  ocisti(): void {
    this.radnik = null;
    this.od = '';
    this.do = '';
    this.ucitaj();
  }

  get filtrirano(): boolean {
    return !!(this.radnik || this.od || this.do);
  }

  datum(z: ZamjenaAdmin): string {
    const naziv = DANI.find((d) => d.key === z.dan)?.kratko ?? z.dan;
    return `${naziv} ${dayjs(z.datum).format('D.M.YYYY.')}`;
  }

  ime(s: { sluz_broj: string; ime_prezime: string | null }): string {
    return s.ime_prezime || s.sluz_broj;
  }

  oznaka(o: string): string {
    return /^\d/.test(o) ? `sl. ${o}` : o;
  }
}
