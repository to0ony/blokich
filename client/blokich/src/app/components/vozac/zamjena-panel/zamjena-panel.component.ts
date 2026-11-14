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
import { Subject, Subscription, debounceTime, switchMap, catchError, of, tap } from 'rxjs';
import { DrawerModule } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import { ZamjeneService } from '../../../services/zamjene.service';
import {
  DanRasporeda,
  DanZaZamjenu,
  KandidatZamjene,
  KandidatiOdgovor,
  TjedanTip,
  inicijali,
  opisOdsustva,
} from '../vozac.model';

type Korak = 'trazi' | 'potvrda';

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
  trazim = false;
  kandidati: KandidatZamjene[] = [];

  korak: Korak = 'trazi';
  /** Odabrani kolega; null u koraku potvrde = ukidanje službe. */
  odabran: KandidatZamjene | null = null;
  /** Potvrda poništavanja postojeće zamjene. */
  ponistavam = false;
  spremam = false;

  private upiti = new Subject<string>();
  private pretraga: Subscription;

  constructor(private zamjene: ZamjeneService) {
    this.pretraga = this.upiti
      .pipe(
        debounceTime(250),
        tap(() => (this.trazim = true)),
        switchMap((q) =>
          q.trim() && this.dan
            ? this.zamjene.kandidati(this.tjedan, this.dan.key, q).pipe(
                catchError((e) => {
                  this.greska = poruka(e);
                  return of(null);
                }),
              )
            : of(null),
        ),
      )
      .subscribe((odg) => {
        this.trazim = false;
        this.kandidati = odg?.kandidati ?? [];
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
    this.kandidati = [];
    this.korak = 'trazi';
    this.odabran = null;
    this.ponistavam = false;
    this.loading = true;
    this.zamjene.kandidati(this.tjedan, this.dan!.key).subscribe({
      next: (odg) => {
        this.podaci = odg;
        this.loading = false;
      },
      error: (e) => {
        this.greska = poruka(e);
        this.loading = false;
      },
    });
  }

  naUpit(q: string): void {
    this.upit = q;
    this.greska = null;
    if (!q.trim()) this.kandidati = [];
    this.upiti.next(q);
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

function poruka(e: unknown): string {
  const err = e as HttpErrorResponse;
  const m = err?.error?.message;
  if (typeof m === 'string') return m;
  if (Array.isArray(m)) return m.join(' ');
  return err?.status === 0 ? 'Nema veze. Pokušaj ponovno.' : 'Nešto nije u redu. Pokušaj ponovno.';
}
