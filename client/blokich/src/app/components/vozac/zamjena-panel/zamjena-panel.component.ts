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
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, Subscription, switchMap, catchError, of, tap, timer } from 'rxjs';
import { DrawerModule } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import { ZamjeneService } from '../../../services/zamjene.service';
import {
  DanRasporeda,
  DanZaZamjenu,
  FilterKandidata,
  KandidatZamjene,
  KandidatiOdgovor,
  RasponNastupa,
  TjedanTip,
  inicijali,
  opisOdsustva,
} from '../vozac.model';

type Korak = 'trazi' | 'potvrda';

const FILTERI: { value: FilterKandidata; label: string; naslov: string }[] = [
  { value: 'slobodni', label: 'Slobodni', naslov: 'Slobodni taj dan' },
  { value: 'linija', label: 'Moja linija', naslov: 'Na tvojoj liniji' },
];

/** Brzi rasponi nastupa; vozač ih može doraditi u poljima. Noć ide preko ponoći. */
const PRESETI: { label: string; od: string; do: string }[] = [
  { label: 'Rano', od: '04:00', do: '07:59' },
  { label: 'Jutro', od: '08:00', do: '11:59' },
  { label: 'Popodne', od: '12:00', do: '19:59' },
  { label: 'Noć', od: '20:00', do: '03:59' },
];

/** Koliko minuta oko mog nastupa gleda "Oko HH:MM". */
const OKO_MOJE_MIN = 60;

interface Pretraga {
  q: string;
  filter: FilterKandidata | null;
  raspon: RasponNastupa | null;
  /** Filtar se primijeni odmah, tipkanje čeka da vozač stane. */
  odmah: boolean;
}

/** Donji panel: zamjena službe s kolegom ili ukidanje službe za jedan dan. */
@Component({
  selector: 'app-zamjena-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, DrawerModule, ButtonModule, SkeletonModule, MessageModule],
  templateUrl: './zamjena-panel.component.html',
  styleUrl: './zamjena-panel.component.scss',
})
export class ZamjenaPanelComponent implements OnChanges, OnDestroy {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Input() dan: DanRasporeda | null = null;
  @Input() tjedan: TjedanTip = 'trenutni';
  /** Zamjena je napravljena ili poništena – raspored treba iznova. */
  @Output() promijenjeno = new EventEmitter<void>();

  readonly inicijali = inicijali;

  podaci: KandidatiOdgovor | null = null;
  loading = false;
  greska: string | null = null;

  upit = '';
  filter: FilterKandidata | null = null;
  /** Raspon nastupa "HH:MM"; prazno = bez granice. */
  nastupOd = '';
  nastupDo = '';
  trazim = false;
  kandidati: KandidatZamjene[] = [];
  ukupno = 0;

  korak: Korak = 'trazi';
  /** Odabrani kolega; null u koraku potvrde = ukidanje službe. */
  odabran: KandidatZamjene | null = null;
  /** Potvrda poništavanja postojeće zamjene. */
  ponistavam = false;
  spremam = false;

  private upiti = new Subject<Pretraga>();
  private pretraga: Subscription;

  constructor(private zamjene: ZamjeneService) {
    this.pretraga = this.upiti
      .pipe(
        switchMap((p) =>
          timer(p.odmah ? 0 : 250).pipe(
            tap(() => (this.trazim = true)),
            switchMap(() =>
              (p.q.trim() || p.filter || p.raspon) && this.dan
                ? this.zamjene.kandidati(this.tjedan, this.dan.key, p.q, p.filter, p.raspon).pipe(
                    catchError((e) => {
                      this.greska = poruka(e);
                      return of(null);
                    }),
                  )
                : of(null),
            ),
          ),
        ),
      )
      .subscribe((odg) => {
        this.trazim = false;
        this.kandidati = odg?.kandidati ?? [];
        this.ukupno = odg?.ukupno ?? 0;
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['visible'] || changes['dan']) && this.visible && this.dan) {
      this.ucitaj();
    }
  }

  ngOnDestroy(): void {
    this.pretraga.unsubscribe();
  }

  get naslov(): string {
    return this.dan ? `Zamjena · ${this.dan.naziv} ${this.dan.datum.format('D.M.')}` : 'Zamjena';
  }

  private ucitaj(): void {
    this.podaci = null;
    this.greska = null;
    this.upit = '';
    this.filter = null;
    this.nastupOd = '';
    this.nastupDo = '';
    this.kandidati = [];
    this.ukupno = 0;
    this.korak = 'trazi';
    this.odabran = null;
    this.ponistavam = false;
    this.loading = true;
    this.zamjene.kandidati(this.tjedan, this.dan!.key).subscribe({
      next: (odg) => {
        this.podaci = odg;
        this.loading = false;
        // Prijedlog odmah: tko je slobodan taj dan (može ti preuzeti službu).
        if (!odg.aktivna && odg.moj.vrsta === 'sluzba') this.postaviFilter('slobodni');
      },
      error: (e) => {
        this.greska = poruka(e);
        this.loading = false;
      },
    });
  }

  /** Filtri koji imaju smisla za moj dan. */
  get filteri() {
    const moj = this.podaci?.moj;
    return FILTERI.filter((f) => {
      if (f.value === 'slobodni') return moj?.vrsta === 'sluzba';
      if (f.value === 'linija') return !!moj?.linije.length;
      return true;
    });
  }

  /** Brzi rasponi; "Oko HH:MM" samo kad imam službu s poznatim nastupom. */
  get preseti() {
    const moj = this.podaci?.moj;
    const nastup = moj?.vrsta === 'sluzba' ? uMinute(moj.od) : null;
    if (nastup === null) return PRESETI;
    return [
      {
        label: `Oko ${moj!.od}`,
        od: izMinuta(nastup - OKO_MOJE_MIN),
        do: izMinuta(nastup + OKO_MOJE_MIN),
      },
      ...PRESETI,
    ];
  }

  get raspon(): RasponNastupa | null {
    return this.nastupOd || this.nastupDo ? { od: this.nastupOd, do: this.nastupDo } : null;
  }

  /** Ima li išta osim upisa po čemu se traži (filtar ili raspon). */
  get imaKriterij(): boolean {
    return !!this.filter || !!this.raspon;
  }

  /** Naslov iznad rezultata: "Slobodni taj dan" / "Nastup 08:00–11:59" / "Rezultati". */
  get naslovRezultata(): string {
    const f = FILTERI.find((x) => x.value === this.filter);
    const upit = !!this.upit.trim();
    const dijelovi: string[] = [];
    if (upit) dijelovi.push('Rezultati');
    if (f) dijelovi.push(upit ? f.label.toLowerCase() : f.naslov);
    if (this.raspon) {
      const t = `nastup ${this.nastupOd || '…'}–${this.nastupDo || '…'}`;
      dijelovi.push(dijelovi.length ? t : t[0].toUpperCase() + t.slice(1));
    }
    return dijelovi.join(' · ');
  }

  presetUkljucen(p: { od: string; do: string }): boolean {
    return this.nastupOd === p.od && this.nastupDo === p.do;
  }

  /** Dodir na uključeni preset ga isključuje. */
  postaviPreset(p: { od: string; do: string }): void {
    if (this.presetUkljucen(p)) this.postaviRaspon('', '', true);
    else this.postaviRaspon(p.od, p.do, true);
  }

  /** Slobodni nemaju nastup, pa raspon i "Slobodni" ne idu zajedno. */
  postaviRaspon(od: string, doV: string, odmah: boolean): void {
    this.nastupOd = od ?? '';
    this.nastupDo = doV ?? '';
    if (this.raspon && this.filter === 'slobodni') this.filter = null;
    this.greska = null;
    this.trazi(odmah);
  }

  naUpit(q: string): void {
    this.upit = q;
    this.greska = null;
    this.trazi(false);
  }

  /** Dodir na aktivni filtar ga isključuje. */
  postaviFilter(f: FilterKandidata): void {
    this.filter = this.filter === f ? null : f;
    if (this.filter === 'slobodni') {
      this.nastupOd = '';
      this.nastupDo = '';
    }
    this.greska = null;
    this.trazi(true);
  }

  private trazi(odmah: boolean): void {
    if (!this.upit.trim() && !this.imaKriterij) {
      this.kandidati = [];
      this.ukupno = 0;
    }
    this.upiti.next({ q: this.upit, filter: this.filter, raspon: this.raspon, odmah });
  }

  odaberi(k: KandidatZamjene): void {
    if (k.zauzet) return;
    this.odabran = k;
    this.korak = 'potvrda';
  }

  ukiniKorak(): void {
    this.odabran = null;
    this.korak = 'potvrda';
  }

  natrag(): void {
    this.korak = 'trazi';
    this.odabran = null;
    this.greska = null;
  }

  potvrdi(): void {
    if (!this.dan || this.spremam) return;
    this.spremam = true;
    this.greska = null;
    const zahtjev = this.odabran
      ? this.zamjene.zamijeni(this.tjedan, this.dan.key, this.odabran.sluz_broj)
      : this.zamjene.ukini(this.tjedan, this.dan.key);
    zahtjev.subscribe({
      next: () => this.gotovo(),
      error: (e) => {
        this.greska = poruka(e);
        this.spremam = false;
      },
    });
  }

  ponisti(): void {
    const id = this.podaci?.aktivna?.id;
    if (!id || this.spremam) return;
    this.spremam = true;
    this.greska = null;
    this.zamjene.ponisti(id).subscribe({
      next: () => this.gotovo(),
      error: (e) => {
        this.greska = poruka(e);
        this.spremam = false;
      },
    });
  }

  private gotovo(): void {
    this.spremam = false;
    this.promijenjeno.emit();
    this.zatvori();
  }

  zatvori(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  /** "Služba 45 · 14:00–22:00" ili "Slobodan dan". */
  opis(d: Pick<DanZaZamjenu, 'oznaka' | 'vrsta' | 'od' | 'do'> | null): string {
    if (!d) return '';
    if (d.vrsta !== 'sluzba') return opisOdsustva(d.oznaka);
    return d.od ? `Služba ${d.oznaka} · ${d.od}–${d.do}` : `Služba ${d.oznaka}`;
  }

  /** Oznaka iz disponenta kao tekst: "služba 45" / "slobodan dan". */
  oznakaTekst(oznaka: string | null | undefined): string {
    return /^\d/.test(oznaka ?? '') ? `služba ${oznaka}` : opisOdsustva(oznaka ?? null).toLowerCase();
  }
}

/** "06:15" -> 375; ostalo null. */
function uMinute(v: string | null | undefined): number | null {
  const m = /^(\d{1,2})[:.](\d{2})/.exec((v ?? '').trim());
  return m ? +m[1] * 60 + +m[2] : null;
}

/** Minute (i preko ponoći ili prije nje) -> "HH:MM". */
function izMinuta(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function poruka(e: unknown): string {
  const err = e as HttpErrorResponse;
  const m = err?.error?.message;
  if (typeof m === 'string') return m;
  if (Array.isArray(m)) return m.join(' ');
  return err?.status === 0 ? 'Nema veze. Pokušaj ponovno.' : 'Nešto nije u redu. Pokušaj ponovno.';
}
