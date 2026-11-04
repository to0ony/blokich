import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
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
import { UzivoService } from '../../../services/uzivo.service';
import { KolegeListaComponent } from '../kolege-lista/kolege-lista.component';
import {
  DanRasporeda,
  Kolega,
  RasporedOdgovor,
  TjedanTip,
  blokZa,
  jePricuva,
  kasniZnatno,
  minutaDo,
  opisKasnjenja,
  opisOdsustva,
  procjenaDolaska,
  rutaUrl,
  slozTjedan,
  uSmjeniSad,
} from '../vozac.model';

/** Koliko prije svoje službe vozač vidi gdje mu je bus. */
const CEKANJE_MIN = 120;
const UZIVO_INTERVAL_MS = 30_000;

/** Moj bus uživo: vozim ga sad ili čekam da ga preuzmem. */
interface MojBus {
  vrsta: 'vozim' | 'cekam';
  vozilo: string;
  kasnjenje: number;
  /** Za 'cekam': procjena kad bus stiže na moju predaju. */
  stize: string | null;
}

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
    KolegeListaComponent,
  ],
  templateUrl: './raspored.component.html',
  styleUrl: './raspored.component.scss',
})
export class RasporedComponent implements OnChanges, OnDestroy {
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

  /** Moj bus uživo za karticu "Danas"; null = ništa se ne prikazuje. */
  mojBus: MojBus | null = null;
  readonly opisKasnjenja = opisKasnjenja;
  readonly kasniZnatno = kasniZnatno;
  private uzivoTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private lineScheduleService: LineScheduleService,
    private uzivoService: UzivoService,
  ) {}

  ngOnDestroy(): void {
    this.zaustaviUzivo();
  }

  private zaustaviUzivo(): void {
    if (this.uzivoTimer) clearInterval(this.uzivoTimer);
    this.uzivoTimer = null;
    this.mojBus = null;
  }

  private pokreniUzivo(): void {
    this.zaustaviUzivo();
    if (!this.danas?.sluzbe.some((s) => blokZa(s))) return;
    this.osvjeziMojBus();
    this.uzivoTimer = setInterval(() => this.osvjeziMojBus(), UZIVO_INTERVAL_MS);
  }

  /**
   * Služba u tijeku → "kasniš X min · bus N".
   * Inače sljedeća služba unutar 2 h → bus na mom V.R. je onaj koji
   * preuzimam: "tvoj bus N stiže ~HH:MM".
   */
  osvjeziMojBus(): void {
    if (typeof document !== 'undefined' && document.hidden) return;
    const sluzbe = this.danas?.sluzbe ?? [];

    const sad = sluzbe.find((s) => blokZa(s) && uSmjeniSad(s.od, s.do));
    const sljedeca = sad
      ? undefined
      : sluzbe
          .filter((s) => blokZa(s))
          .map((s) => ({ s, za: minutaDo(s.od) }))
          .filter((x) => x.za !== null && x.za! <= CEKANJE_MIN)
          .sort((a, b) => a.za! - b.za!)[0]?.s;

    const cilj = sad ?? sljedeca;
    const blok = cilj ? blokZa(cilj) : null;
    if (!cilj || !blok) {
      this.mojBus = null;
      return;
    }

    this.uzivoService.zaBlokove([blok]).subscribe({
      next: (res) => {
        const v = res?.blokovi?.[blok];
        this.mojBus =
          v && v.vozilo && typeof v.kasnjenje === 'number'
            ? {
                vrsta: sad ? 'vozim' : 'cekam',
                vozilo: v.vozilo,
                kasnjenje: v.kasnjenje,
                stize: sad ? null : procjenaDolaska(cilj.od, v.kasnjenje),
              }
            : null;
      },
      error: () => (this.mojBus = null),
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']) {
      this.dani = this.data ? slozTjedan(this.data) : [];
      if (this.tjedan === 'trenutni') setTimeout(() => this.skrolajNaDanas());
      if (this.tjedan === 'trenutni' && this.danas) this.pokreniUzivo();
      else this.zaustaviUzivo();
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
