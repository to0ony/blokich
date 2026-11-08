import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PrimeNG } from 'primeng/config';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import { postaviPrimeNgTemu } from '../../theme/primeng-setup';
import { VoziloParka, VozniParkService } from '../../services/vozni-park.service';
import { MarkaComponent, markaZa } from '../../components/vozac/marka/marka.component';
import { TablicaComponent } from '../../components/vozac/tablica/tablica.component';
import { kasniZnatno, opisKasnjenja } from '../../components/vozac/vozac.model';

const INTERVAL_MS = 45_000;
const SKRIVENE_KEY = 'vz-skrivene-marke';

interface MarkaFilter {
  oznaka: string;
  naziv: string;
  model: string;
  ukupno: number;
  naLiniji: number;
  vidljiva: boolean;
}

interface Grupa {
  model: string;
  vozila: VoziloParka[];
  naLiniji: number;
}

/** Vozni park AP Podsused s prikazom tko je sad na liniji – s login ekrana. */
@Component({
  selector: 'app-vozni-park',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    InputTextModule,
    SelectButtonModule,
    SkeletonModule,
    MessageModule,
    MarkaComponent,
    TablicaComponent,
  ],
  templateUrl: './vozni-park.component.html',
  styleUrl: './vozni-park.component.scss',
})
export class VozniParkComponent implements OnInit, OnDestroy {
  private readonly servis = inject(VozniParkService);

  vozila: VoziloParka[] = [];
  loading = true;
  greska = false;
  trazi = '';
  samoNaLiniji = false;
  readonly filteri = [
    { label: 'Svi', value: false },
    { label: 'Na liniji', value: true },
  ];
  readonly opisKasnjenja = opisKasnjenja;
  readonly kasniZnatno = kasniZnatno;
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Skrivene marke (oznaka, npr. "MAN") – pamti se na uređaju. */
  skrivene = new Set<string>(this.ucitajSkrivene());

  constructor() {
    postaviPrimeNgTemu(inject(PrimeNG));
  }

  ngOnInit(): void {
    this.ucitaj();
    this.timer = setInterval(() => {
      if (!document.hidden) this.ucitaj();
    }, INTERVAL_MS);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  ucitaj(): void {
    this.servis.dohvati().subscribe({
      next: (res) => {
        this.vozila = res?.vozila ?? [];
        this.greska = false;
        this.loading = false;
      },
      error: () => {
        this.greska = !this.vozila.length;
        this.loading = false;
      },
    });
  }

  /** Marke prisutne u voznom parku, za filter gore (najbrojnija prva). */
  get marke(): MarkaFilter[] {
    const mapa = new Map<string, MarkaFilter>();
    for (const v of this.vozila) {
      const m = markaZa(v.kratko);
      const f = mapa.get(m.oznaka) ?? {
        oznaka: m.oznaka,
        naziv: m.naziv,
        model: v.kratko,
        ukupno: 0,
        naLiniji: 0,
        vidljiva: !this.skrivene.has(m.oznaka),
      };
      f.ukupno++;
      if (v.uzivo) f.naLiniji++;
      mapa.set(m.oznaka, f);
    }
    return [...mapa.values()].sort((a, b) => b.ukupno - a.ukupno);
  }

  prebaciMarku(oznaka: string): void {
    if (this.skrivene.has(oznaka)) this.skrivene.delete(oznaka);
    else this.skrivene.add(oznaka);
    try {
      localStorage.setItem(SKRIVENE_KEY, JSON.stringify([...this.skrivene]));
    } catch {}
  }

  private ucitajSkrivene(): string[] {
    try {
      return JSON.parse(localStorage.getItem(SKRIVENE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  get naLiniji(): number {
    return this.vozila.filter((v) => v.uzivo).length;
  }

  /** Grupe po modelu (najbrojniji prvi), filtrirane po pretrazi i "na liniji". */
  get grupe(): Grupa[] {
    const q = this.trazi.trim().toLowerCase();
    const mapa = new Map<string, VoziloParka[]>();
    for (const v of this.vozila) {
      if (this.samoNaLiniji && !v.uzivo) continue;
      if (this.skrivene.has(markaZa(v.kratko).oznaka)) continue;
      if (
        q &&
        !v.broj.toLowerCase().includes(q) &&
        !v.kratko.toLowerCase().includes(q) &&
        !(v.tablica ?? '').toLowerCase().includes(q) &&
        !(v.uzivo?.linija ?? '').includes(q) &&
        !(v.uzivo?.ruta ?? '').includes(q)
      ) {
        continue;
      }
      if (!mapa.has(v.kratko)) mapa.set(v.kratko, []);
      mapa.get(v.kratko)!.push(v);
    }
    return [...mapa.entries()]
      .map(([model, vozila]) => ({
        model,
        vozila: vozila.sort(
          (a, b) => Number(!!b.uzivo) - Number(!!a.uzivo) || a.broj.localeCompare(b.broj, 'hr', { numeric: true }),
        ),
        naLiniji: vozila.filter((v) => v.uzivo).length,
      }))
      .sort((a, b) => b.vozila.length - a.vozila.length);
  }
}
