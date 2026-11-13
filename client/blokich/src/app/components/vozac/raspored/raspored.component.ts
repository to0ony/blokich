import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
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
import { SluzbaDetaljiComponent } from '../sluzba-detalji/sluzba-detalji.component';
import { MojaKartaComponent } from '../moja-karta/moja-karta.component';
import {
  DanRasporeda,
  Kolega,
  RasporedOdgovor,
  TjedanTip,
  aktivniDan,
  blokZa,
  jeJucer,
  jePricuva,
  kasniZnatno,
  opisKasnjenja,
  opisOdsustva,
  procjenaDolaska,
  slozTjedan,
  stanjeSluzbe,
  sutraNaziv,
} from '../vozac.model';
import dayjs from 'dayjs';
import { praznikZa } from '../kalendar/praznici';

/** Bus koji preuzimam prikazuje se tek 60 min prije mog nastupa. */
const CEKANJE_MIN = 60;
const UZIVO_INTERVAL_MS = 30_000;

/** Moj bus uživo: vozim ga sad ili čekam da ga preuzmem. */
interface MojBus {
  vrsta: 'vozim' | 'cekam';
  vozilo: string;
  kasnjenje: number;
  /** Za 'cekam': procjena kad bus stiže na moju predaju. */
  stize: string | null;
  model?: string;
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
    SluzbaDetaljiComponent,
    MojaKartaComponent,
    RouterLink,
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
  /** Ponedjeljak: nedjelja prošlog tjedna, dok njena noćna služba još traje. */
  @Input() prethodniDan: DanRasporeda | null = null;
  @Output() tjedanChange = new EventEmitter<TjedanTip>();
  @Output() retry = new EventEmitter<void>();
  @Output() otvoriKalendar = new EventEmitter<void>();

  dani: DanRasporeda[] = [];
  /** Ikona odmora kao na tahografu (krevet). */
  readonly OdmorIcon = Bed;
  readonly opisOdsustva = opisOdsustva;

  /** Naziv blagdana / neradnog dana ili null. */
  praznik(d: DanRasporeda): string | null {
    return praznikZa(d.datum);
  }
  readonly jePricuva = jePricuva;
  readonly stanje = stanjeSluzbe;
  readonly sutraNaziv = sutraNaziv;

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
    this.osvjeziMojBus();
    this.uzivoTimer = setInterval(() => this.osvjeziMojBus(), UZIVO_INTERVAL_MS);
  }

  /**
   * Služba u tijeku → "kasniš X min · bus N".
   * Inače sljedeća služba unutar 60 min → bus na mom V.R. je onaj koji
   * preuzimam: "tvoj bus N stiže ~HH:MM".
   */
  osvjeziMojBus(): void {
    this.pratiKlizac();
    if (typeof document !== 'undefined' && document.hidden) return;
    const dan = this.danas;
    const sluzbe = (dan?.sluzbe ?? []).filter((s) => blokZa(s));
    const stanja = dan ? sluzbe.map((s) => ({ s, ...stanjeSluzbe(dan, s) })) : [];

    const sad = stanja.find((x) => x.uTijeku)?.s;
    const sljedeca = sad
      ? undefined
      : stanja
          .filter((x) => x.za !== null && x.za <= CEKANJE_MIN)
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
                model: v.model,
              }
            : null;
      },
      error: () => (this.mojBus = null),
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']) {
      this.dani = this.data ? slozTjedan(this.data) : [];
      // Klizač dana odmah na aktivnom danu (naredni tjedan: ponedjeljak).
      setTimeout(() => {
        this.pokaziDan(this.pocetniDan(), false);
        this.nagovijestiJednom();
      });
      if (this.tjedan === 'trenutni' && this.danas) this.pokreniUzivo();
      else this.zaustaviUzivo();
    }
    if (changes['naredniDostupan']) {
      this.tjedanOpcije = this.tjedanOpcije.map((o) =>
        o.value === 'naredni' ? { ...o, disabled: !this.naredniDostupan } : o,
      );
    }
  }

  /**
   * Dan za karticu "Danas" i kartu: današnji, a nakon ponoći jučerašnji dok
   * njegova noćna služba još traje (računa se iznova pri svakom prikazu).
   */
  get danas(): DanRasporeda | undefined {
    if (this.tjedan !== 'trenutni') return undefined;
    return aktivniDan(this.prethodniDan ? [this.prethodniDan, ...this.dani] : this.dani);
  }

  /** Kartica Danas prikazuje jučerašnji dan (noćna služba nakon ponoći). */
  odJucer(dan: DanRasporeda): boolean {
    return jeJucer(dan.datum);
  }

  /** Istaknuti dan u tjednu: aktivni dan (i noćna od jučer), inače kalendarski danas. */
  istaknut(dan: DanRasporeda): boolean {
    const a = this.danas;
    return a && this.dani.includes(a) ? dan === a : dan.danas;
  }

  /** Dok se prikazuje noćna od jučer: prva današnja služba, npr. "14:00 · 109". */
  danasKasnije(dan: DanRasporeda): string | null {
    if (!jeJucer(dan.datum)) return null;
    const danas = this.dani.find((d) => d.datum.isSame(dayjs(), 'day'));
    const s = danas?.sluzbe[0];
    if (!s) return null;
    const linije = [...new Set(danas!.sluzbe.map((x) => x.linija).filter(Boolean))];
    return [s.od, ...linije].join(' · ');
  }

  /** Dan je iz prošlog tjedna – za njega nema popisa kolega. */
  izProslogTjedna(dan: DanRasporeda): boolean {
    return dan === this.prethodniDan;
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

  // ---------- Klizač dana (kartice dana lijevo-desno) ----------

  @ViewChild('daniKlizac') private daniKlizac?: ElementRef<HTMLDivElement>;
  /** Indeks dana koji je sad prikazan u klizaču (označen u traci dana). */
  prikazanDan = 0;

  /** Kartice se jednom malo pomaknu ulijevo – vidi se da se dani listaju. */
  nagovijestiKlizanje = false;

  private nagovijestiJednom(): void {
    const KLJUC = 'blokich.klizacDanaNagovijesten';
    if (this.prikazanDan >= this.dani.length - 1) return;
    try {
      if (localStorage.getItem(KLJUC)) return;
      localStorage.setItem(KLJUC, '1');
    } catch {
      return;
    }
    setTimeout(() => (this.nagovijestiKlizanje = true), 700);
    setTimeout(() => (this.nagovijestiKlizanje = false), 700 + 1400);
  }

  /** Strelica: prethodni ili sljedeći dan. */
  pokaziSusjedni(smjer: -1 | 1): void {
    const i = Math.min(Math.max(this.prikazanDan + smjer, 0), this.dani.length - 1);
    this.pokaziDan(i);
  }

  /** Prvi prikazani dan: aktivni (ili današnji), za naredni tjedan ponedjeljak. */
  private pocetniDan(): number {
    const i = this.dani.findIndex((d) => this.istaknut(d));
    return i >= 0 ? i : 0;
  }

  /**
   * Dodir na dan u traci: klizač pređe na taj dan. Stranica se spusti do
   * kartice tek nakon toga – Chrome na mobitelu prekida glatko skrolanje
   * klizača kad istovremeno glatko skrola i stranica.
   */
  odaberiDan(dan: DanRasporeda): void {
    this.pokaziDan(this.dani.indexOf(dan));
    const el = this.daniKlizac?.nativeElement;
    if (!el || el.getBoundingClientRect().top < window.innerHeight - 160) return;
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 400);
  }

  private pokaziDan(i: number, glatko = true): void {
    const el = this.daniKlizac?.nativeElement;
    const kartica = el?.children[i] as HTMLElement | undefined;
    if (!el || !kartica) return;
    this.prikazanDan = i;
    el.scrollTo({ left: this.pomakKartice(el, kartica), behavior: glatko ? 'smooth' : 'auto' });
  }

  /** Položaj kartice u klizaču, bez unutarnjeg ruba klizača. */
  private pomakKartice(el: HTMLElement, kartica: HTMLElement): number {
    return kartica.offsetLeft - (el.firstElementChild as HTMLElement).offsetLeft;
  }

  /** Koja je kartica poravnata uz lijevi rub klizača. */
  naKlizanjuDana(el: HTMLElement): void {
    let najblizi = 0;
    let razmak = Infinity;
    Array.from(el.children).forEach((c, i) => {
      const r = Math.abs(this.pomakKartice(el, c as HTMLElement) - el.scrollLeft);
      if (r < razmak) {
        razmak = r;
        najblizi = i;
      }
    });
    this.prikazanDan = najblizi;
  }

  linije(dan: DanRasporeda): string[] {
    return [...new Set(dan.sluzbe.map((s) => s.linija).filter((l): l is string => !!l))];
  }

  // ---------- Klizač karata (više linija u danu) ----------

  /** Koja je kartica klizača prikazana (za točkice). */
  slajd = 0;
  private klizacPostavljen = false;

  private klizacEl: HTMLDivElement | null = null;
  /** Linija na koju je klizač zadnji put sam prešao (ne dira ručno listanje između). */
  private pracenaLinija: string | null = null;

  /** Kad se klizač pojavi: odmah prikaži liniju koju vozač vozi sad (ili sljedeću). */
  @ViewChild('klizac') set klizacRef(el: ElementRef<HTMLDivElement> | undefined) {
    if (!el) {
      this.klizacPostavljen = false;
      this.klizacEl = null;
      return;
    }
    this.klizacEl = el.nativeElement;
    if (this.klizacPostavljen || !this.danas) return;
    this.klizacPostavljen = true;
    const i = this.aktualnaLinija(this.danas);
    this.pracenaLinija = this.linijeKarte(this.danas)[i] ?? null;
    setTimeout(() => {
      this.slajd = i;
      el.nativeElement.scrollLeft = i * this.sirinaSlajda(el.nativeElement);
    });
  }

  /**
   * Kad vozač prijeđe na sljedeću liniju (npr. u 01:45 sa 132 na 118),
   * klizač sam pređe na nju.
   */
  private pratiKlizac(): void {
    const el = this.klizacEl;
    const dan = this.danas;
    if (!el || !dan) return;
    const linije = this.linijeKarte(dan);
    const i = this.aktualnaLinija(dan);
    if (linije[i] === this.pracenaLinija) return;
    this.pracenaLinija = linije[i] ?? null;
    this.naSlajd(el, i);
  }

  private sirinaSlajda(klizac: HTMLElement): number {
    const prvi = klizac.firstElementChild as HTMLElement | null;
    const razmak = parseFloat(getComputedStyle(klizac).columnGap) || 0;
    return (prvi?.offsetWidth ?? klizac.clientWidth) + razmak;
  }

  naKlizanju(klizac: HTMLElement): void {
    this.slajd = Math.round(klizac.scrollLeft / this.sirinaSlajda(klizac));
  }

  naSlajd(klizac: HTMLElement, i: number): void {
    klizac.scrollTo({ left: i * this.sirinaSlajda(klizac), behavior: 'smooth' });
  }

  /** Indeks linije koja je sad u tijeku, inače sljedeće danas, inače prve. */
  private aktualnaLinija(dan: DanRasporeda): number {
    const linije = this.linijeKarte(dan);
    const stanja = dan.sluzbe
      .filter((s) => blokZa(s) && s.linija)
      .map((s) => ({ s, ...stanjeSluzbe(dan, s) }));
    const sad = stanja.find((x) => x.uTijeku)?.s;
    const sljedeca = stanja
      .filter((x) => x.za !== null)
      .sort((a, b) => a.za! - b.za!)[0]?.s;
    const i = linije.indexOf((sad ?? sljedeca)?.linija ?? '');
    return i >= 0 ? i : 0;
  }

  /** Linije dana koje imaju blok (linija + V.R.) – za karte ispod kartice Danas. */
  linijeKarte(dan: DanRasporeda): string[] {
    return [
      ...new Set(
        dan.sluzbe.filter((s) => blokZa(s) && s.linija).map((s) => s.linija as string),
      ),
    ];
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
