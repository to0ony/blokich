import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import { ButtonModule } from 'primeng/button';
import { Bed, LucideAngularModule } from 'lucide-angular';
import { LineScheduleService } from '../../../services/line-schedule.service';
import { KolegaRowComponent } from '../kolega-row/kolega-row.component';
import { DanRasporeda, Kolega, opisOdsustva } from '../vozac.model';

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
    KolegaRowComponent,
  ],
  templateUrl: './danas.component.html',
  styleUrl: './danas.component.scss',
})
export class DanasComponent implements OnChanges {
  @Input() dan: DanRasporeda | undefined;
  @Input() rasporedLoading = false;

  grupe: GrupaLinije[] = [];
  loading = false;
  greska = false;
  private ucitanoZa: string | null = null;
  /** Ikona odmora kao na tahografu (krevet). */
  readonly OdmorIcon = Bed;
  readonly opisOdsustva = opisOdsustva;

  constructor(private lineScheduleService: LineScheduleService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['dan']) this.ucitaj();
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
      })
      .catch(() => {
        this.greska = true;
        this.loading = false;
      });
  }
}
