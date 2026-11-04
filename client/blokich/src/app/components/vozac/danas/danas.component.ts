import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import { ButtonModule } from 'primeng/button';
import { Bed, LucideAngularModule } from 'lucide-angular';
import { LineScheduleService } from '../../../services/line-schedule.service';
import { UzivoService } from '../../../services/uzivo.service';
import { KolegeListaComponent } from '../kolege-lista/kolege-lista.component';
import {
  DanRasporeda,
  Kolega,
  aktivniPoBloku,
  kolegaKljuc,
  opisOdsustva,
} from '../vozac.model';

const UZIVO_INTERVAL_MS = 30_000;

interface GrupaLinije {
  linija: string;
  kolege: Kolega[];
}

/** Današnja smjena: svi vozači na linijama koje danas voziš. */
@Component({
  selector: 'app-danas',
  standalone: true,
  imports: [
    CommonModule,
    SkeletonModule,
    MessageModule,
    ButtonModule,
    LucideAngularModule,
    KolegeListaComponent,
  ],
  templateUrl: './danas.component.html',
  styleUrl: './danas.component.scss',
})
export class DanasComponent implements OnChanges, OnDestroy {
  @Input() dan: DanRasporeda | undefined;
  @Input() rasporedLoading = false;

  grupe: GrupaLinije[] = [];
  loading = false;
  greska = false;
  private ucitanoZa: string | null = null;
  /** Ikona odmora kao na tahografu (krevet). */
  readonly OdmorIcon = Bed;
  readonly opisOdsustva = opisOdsustva;

  /** Kašnjenje (s) vozača koji upravo voze, po ključu vozača. Prazno = ništa se ne prikazuje. */
  uzivo: Record<string, number> = {};
  private uzivoTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private lineScheduleService: LineScheduleService,
    private uzivoService: UzivoService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['dan']) this.ucitaj();
  }

  ngOnDestroy(): void {
    if (this.uzivoTimer) clearInterval(this.uzivoTimer);
  }

  /** Tko od kolega sad vozi – zelena točkica i kašnjenje iz ZET-ovog feeda. */
  osvjeziUzivo(): void {
    if (typeof document !== 'undefined' && document.hidden) return;

    const aktivni = aktivniPoBloku(this.grupe.flatMap((g) => g.kolege));
    if (!aktivni.size) {
      this.uzivo = {};
      return;
    }

    this.uzivoService.zaBlokove([...aktivni.keys()]).subscribe({
      next: (res) => {
        const novo: Record<string, number> = {};
        for (const [blok, k] of aktivni) {
          const v = res?.blokovi?.[blok];
          if (v && typeof v.kasnjenje === 'number') novo[kolegaKljuc(k)] = v.kasnjenje;
        }
        this.uzivo = novo;
      },
      // Bez podataka nema ni točkice – nikad ne prikazujemo zastarjelo stanje.
      error: () => (this.uzivo = {}),
    });
  }

  private pokreniUzivo(): void {
    if (this.uzivoTimer) clearInterval(this.uzivoTimer);
    this.osvjeziUzivo();
    this.uzivoTimer = setInterval(() => this.osvjeziUzivo(), UZIVO_INTERVAL_MS);
  }

  get linije(): string[] {
    return [
      ...new Set(
        (this.dan?.sluzbe ?? []).map((s) => s.linija).filter((l): l is string => !!l),
      ),
    ];
  }

  ucitaj(force = false): void {
    const kljuc = this.dan ? `${this.dan.datum.format('YYYY-MM-DD')}:${this.linije.join(',')}` : null;
    if (!kljuc || (!force && kljuc === this.ucitanoZa)) return;
    this.ucitanoZa = kljuc;

    const linije = this.linije;
    this.grupe = [];
    this.greska = false;
    if (!linije.length) return;

    this.loading = true;
    Promise.all(
      linije.map((l) =>
        firstValueFrom(this.lineScheduleService.fetchLineDrivers(l, this.dan!.key, 'trenutni')),
      ),
    )
      .then((rez) => {
        this.grupe = linije.map((linija, i) => ({
          linija,
          kolege: [...(rez[i]?.voze ?? [])].sort((a: Kolega, b: Kolega) =>
            (a.od ?? '').localeCompare(b.od ?? ''),
          ),
        }));
        this.loading = false;
        this.pokreniUzivo();
      })
      .catch(() => {
        this.greska = true;
        this.loading = false;
      });
  }
}
