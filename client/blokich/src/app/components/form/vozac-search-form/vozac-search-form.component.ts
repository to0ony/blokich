import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DrawerModule } from 'primeng/drawer';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { Subject, Subscription, catchError, debounceTime, map, of, switchMap, tap } from 'rxjs';
import { VozaciService } from '../../../services/vozaci.service';
import { inicijali } from '../../vozac/vozac.model';

interface VozacInfo {
  sluz_broj: string;
  ime_prezime: string;
}

/** Pretraga od ovoliko upisanih znakova. */
const MIN_ZNAKOVA = 2;

/**
 * Pretraga vozača u donjem panelu (s prijave): upiši prezime, ime ili broj,
 * dodir na vozača upiše njegov broj u prijavu.
 */
@Component({
  standalone: true,
  selector: 'app-vozac-search-form',
  imports: [CommonModule, FormsModule, DrawerModule, InputTextModule, SkeletonModule],
  templateUrl: './vozac-search-form.component.html',
  styleUrls: ['./vozac-search-form.component.scss'],
})
export class VozacSearchFormComponent {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() selectVozac = new EventEmitter<string>();

  @ViewChild('polje') private polje?: ElementRef<HTMLInputElement>;

  searchQuery = '';
  searchResults: VozacInfo[] = [];
  trazim = false;
  /** Upit za koji su prikazani rezultati (null = još nije traženo). */
  trazeno: string | null = null;
  readonly inicijali = inicijali;

  private readonly upit = new Subject<string>();
  private readonly pretplata: Subscription;

  constructor(private vozaciService: VozaciService) {
    // Rezultati dok se tipka; zadnji upit pobjeđuje.
    this.pretplata = this.upit
      .pipe(
        map((q) => q.trim()),
        debounceTime(250),
        tap((q) => (this.trazim = q.length >= MIN_ZNAKOVA)),
        switchMap((q) =>
          q.length < MIN_ZNAKOVA
            ? of({ q: null, r: [] as VozacInfo[] })
            : this.vozaciService.searchVozaci(q).pipe(
                map((r) => ({ q, r: r ?? [] })),
                catchError(() => of({ q, r: [] as VozacInfo[] })),
              ),
        ),
      )
      .subscribe(({ q, r }) => {
        this.trazim = false;
        this.trazeno = q;
        this.searchResults = r;
      });
  }

  ngOnDestroy(): void {
    this.pretplata.unsubscribe();
  }

  naUpis(q: string): void {
    this.upit.next(q);
  }

  /** Enter samo zatvori tipkovnicu – pretraga već ide dok se tipka. */
  traziOdmah(): void {
    this.polje?.nativeElement.blur();
  }

  /** Panel otvoren: fokus u polje (tipkovnica se odmah otvori). */
  naOtvaranje(): void {
    setTimeout(() => this.polje?.nativeElement.focus(), 50);
  }

  zatvori(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  /** Panel zatvoren: počisti pretragu za sljedeći put. */
  naZatvaranje(): void {
    this.searchQuery = '';
    this.searchResults = [];
    this.trazeno = null;
    this.upit.next('');
  }

  onSelectVozac(sluzbeniBroj: string): void {
    this.selectVozac.emit(sluzbeniBroj);
    this.zatvori();
  }
}
