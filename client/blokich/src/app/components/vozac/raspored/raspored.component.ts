import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { DrawerModule } from 'primeng/drawer';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import { Bed, LucideAngularModule } from 'lucide-angular';
import { LineScheduleService } from '../../../services/line-schedule.service';
import { KolegaRowComponent } from '../kolega-row/kolega-row.component';
import {
  DanRasporeda,
  Kolega,
  RasporedOdgovor,
  TjedanTip,
  jePricuva,
  opisOdsustva,
  rutaUrl,
  slozTjedan,
} from '../vozac.model';

const MJESECI_GEN = [
  'siječnja', 'veljače', 'ožujka', 'travnja', 'svibnja', 'lipnja',
  'srpnja', 'kolovoza', 'rujna', 'listopada', 'studenoga', 'prosinca',
];

@Component({
  selector: 'app-raspored',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    SelectButtonModule,
    DrawerModule,
    SkeletonModule,
    MessageModule,
    LucideAngularModule,
    KolegaRowComponent,
  ],
  templateUrl: './raspored.component.html',
  styleUrl: './raspored.component.scss',
})
export class RasporedComponent implements OnChanges {
  @Input() data: RasporedOdgovor | null = null;
  @Input() loading = false;
  @Input() error: string | null = null;
  @Input() tjedan: TjedanTip = 'trenutni';
  @Input() naredniDostupan = false;
  @Output() tjedanChange = new EventEmitter<TjedanTip>();
  @Output() retry = new EventEmitter<void>();

  dani: DanRasporeda[] = [];
  /** Ikona odmora kao na tahografu (krevet). */
  readonly OdmorIcon = Bed;
  readonly opisOdsustva = opisOdsustva;
  readonly rutaUrl = rutaUrl;
  readonly jePricuva = jePricuva;

  tjedanOpcije = [
    { label: 'Ovaj tjedan', value: 'trenutni' as TjedanTip, disabled: false },
    { label: 'Sljedeći', value: 'naredni' as TjedanTip, disabled: true },
  ];

  // Donji panel sa smjenom
  smjenaOtvorena = false;
  smjenaDan: DanRasporeda | null = null;
  kolege: Kolega[] = [];
  kolegeLoading = false;
  kolegeGreska = false;

  constructor(private lineScheduleService: LineScheduleService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']) {
      this.dani = this.data ? slozTjedan(this.data) : [];
      if (this.tjedan === 'trenutni') setTimeout(() => this.skrolajNaDanas());
    }
    if (changes['naredniDostupan']) {
      this.tjedanOpcije = this.tjedanOpcije.map((o) =>
        o.value === 'naredni' ? { ...o, disabled: !this.naredniDostupan } : o,
      );
    }
  }

  get danas(): DanRasporeda | undefined {
    return this.tjedan === 'trenutni' ? this.dani.find((d) => d.danas) : undefined;
  }

  get rasponTjedna(): string {
    if (!this.dani.length) return '';
    const a = this.dani[0].datum;
    const b = this.dani[6].datum;
    return a.month() === b.month()
      ? `${a.date()}. – ${b.date()}. ${MJESECI_GEN[b.month()]}`
      : `${a.date()}. ${MJESECI_GEN[a.month()]} – ${b.date()}. ${MJESECI_GEN[b.month()]}`;
  }

  get brojRadnihDana(): number {
    return this.dani.filter((d) => d.sluzbe.length).length;
  }

  onTjedan(value: TjedanTip): void {
    if (value && value !== this.tjedan) this.tjedanChange.emit(value);
  }

  skrolajNa(dan: DanRasporeda): void {
    document
      .getElementById(`dan-${dan.key}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  private skrolajNaDanas(): void {
    const danas = this.dani.find((d) => d.danas);
    // Samo ako je današnji dan niže na stranici (ne skrolaj kad je pon/uto).
    if (danas && ['cet', 'pet', 'sub', 'ned'].includes(danas.key)) {
      document
        .getElementById(`dan-${danas.key}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  linije(dan: DanRasporeda): string[] {
    return [...new Set(dan.sluzbe.map((s) => s.linija).filter((l): l is string => !!l))];
  }

  otvoriSmjenu(dan: DanRasporeda): void {
    this.smjenaDan = dan;
    this.smjenaOtvorena = true;
    this.kolege = [];
    this.kolegeGreska = false;

    const linije = this.linije(dan);
    if (!linije.length) return;

    this.kolegeLoading = true;
    Promise.all(
      linije.map((l) =>
        firstValueFrom(
          this.lineScheduleService.fetchLineDrivers(l, dan.key, this.tjedan),
        ),
      ),
    )
      .then((rez) => {
        this.kolege = rez
          .flatMap((r) => r?.voze ?? [])
          .sort((a: Kolega, b: Kolega) => (a.od ?? '').localeCompare(b.od ?? ''));
        this.kolegeLoading = false;
      })
      .catch(() => {
        this.kolegeGreska = true;
        this.kolegeLoading = false;
      });
  }

  /** Prazno ili 0,00 / 00:00 – ne prikazuj u detaljima. */
  jeNula(v: string | undefined | null): boolean {
    return !v || /^[0:,.\s]*$/.test(v);
  }

  podijeli(): void {
    if (!this.dani.length || !this.data) return;
    const ime = sessionStorage.getItem('imePrezime') || 'Vozač';

    let text = `📅 *RASPORED ${this.data.tjedan}. TJEDAN ${this.data.godina}.*\n👤 ${ime}\n\n`;
    for (const d of this.dani) {
      text += `*${d.kratko.toUpperCase()} ${d.datum.format('DD.MM.')}*\n`;
      if (!d.sluzbe.length) {
        text += `🛌 ${opisOdsustva(d.odsustvo).toUpperCase()}${d.odsustvo ? ` (${d.odsustvo})` : ''}\n`;
      } else {
        for (const s of d.sluzbe) {
          const oznaka = s.linija ? `SL${s.br_sl}/${s.linija}` : `SL${s.br_sl}`;
          text += `🔹 ${oznaka}: (${s.nastup_sluzbe ?? ''}) ${s.od} -> ${s.do} (${s.zavrsna_sluzba ?? ''})\n`;
        }
      }
      text += '\n';
    }
    text += '🔗 https://blokich.vercel.app/';
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }
}
