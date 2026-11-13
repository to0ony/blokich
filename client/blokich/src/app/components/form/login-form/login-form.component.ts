import { Component, DestroyRef, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { Router, RouterLink } from '@angular/router';
import { UploadService } from '../../../services/upload.service';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { VozacSearchFormComponent } from '../vozac-search-form/vozac-search-form.component';
import { PristupStorage } from '../../../services/pristup-storage';
import { VozacInfo, VozaciService } from '../../../services/vozaci.service';

/** Prijedlozi vozača tek od ovoliko upisanih znamenki. */
const PRIJEDLOZI_OD = 2;
const PRIJEDLOGA = 6;

dayjs.extend(isoWeek);

@Component({
  selector: 'app-login-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule,
    VozacSearchFormComponent,
  ],
  templateUrl: './login-form.component.html',
  styleUrls: ['./login-form.component.scss'],
})
export class LoginFormComponent implements OnInit {
  loginForm!: FormGroup;
  isLoading = false;
  lastDisponentUpload: any;
  isNextWeekAvailable: boolean = false;
  showSearchForm = false;
  recentNumbers: string[] = [];
  /** Uređaj je već jednom unio lozinku – ekran s lozinkom se preskače. */
  otkljucano = PristupStorage.otkljucano;
  lozinka = '';
  loginGreska = '';
  lozinkaGreska = '';
  /** Vozači čiji broj počinje upisanim znamenkama. */
  prijedlozi: VozacInfo[] = [];
  private readonly vozaciService = inject(VozaciService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild(VozacSearchFormComponent)
  vozacSearchFormComponent?: VozacSearchFormComponent;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private uploadService: UploadService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadRecentNumbers();

    this.loginForm = this.fb.group({
      sluzbeniBroj: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    });

    // Dok se upisuje broj: prijedlozi vozača (zadnji upit pobjeđuje).
    this.loginForm
      .get('sluzbeniBroj')!
      .valueChanges.pipe(
        map((v) => String(v ?? '').trim()),
        debounceTime(200),
        distinctUntilChanged(),
        switchMap((q) =>
          /^\d+$/.test(q) && q.replace(/^0+/, '').length >= PRIJEDLOZI_OD
            ? this.vozaciService.searchVozaci(q, PRIJEDLOGA).pipe(catchError(() => of([])))
            : of([]),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => (this.prijedlozi = r ?? []));

    this.uploadService.fetchLastDisponentUpload().subscribe({
      next: (res) => {
        const data = res as { brojTjedna: number; godina: number };

        this.lastDisponentUpload = data;

        const nextWeekDate = dayjs().add(1, 'week');
        const nextYear = nextWeekDate.isoWeekYear();
        const nextWeek = nextWeekDate.isoWeek();

        if (data.godina === nextYear && data.brojTjedna === nextWeek) {
          this.isNextWeekAvailable = true;
        }
      },
      error: (err) => {
        console.error(
          'Greška prilikom dohvacanja informacija o posljednjem disponentu:',
          err,
        );
      },
    });
  }

  otkljucaj(): void {
    if (!this.lozinka || this.isLoading) return;
    this.isLoading = true;
    this.lozinkaGreska = '';

    this.authService.otkljucaj(this.lozinka).subscribe({
      next: (res) => {
        // Bez VOZAC_LOZINKA server ne izdaje token; oznaka "otvoreno" ne vrijedi
        // kao token, pa se uređaj sam zaključa čim se lozinka uključi.
        PristupStorage.set(res.pristupToken || 'otvoreno');
        this.otkljucano = true;
        this.lozinka = '';
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.lozinkaGreska =
          err?.error?.code === 'PRISTUP'
            ? err.error.message || 'Pogrešna lozinka.'
            : 'Provjera lozinke nije uspjela. Pokušaj ponovno.';
      },
    });
  }

  private zakljucaj(poruka?: string) {
    PristupStorage.clear();
    this.otkljucano = false;
    this.showSearchForm = false;
    this.lozinkaGreska = poruka ?? '';
  }

  toggleSearchForm() {
    this.showSearchForm = !this.showSearchForm;
  }

  onVozacSelected(sluzbeniBroj: string) {
    this.selectRecentNumber(sluzbeniBroj);
    this.showSearchForm = false;
  }

  loadRecentNumbers() {
    const stored = localStorage.getItem('recentDriverNumbers');
    if (stored) {
      this.recentNumbers = JSON.parse(stored);
    }
  }

  saveRecentNumber(broj: string) {
    let numbers = this.recentNumbers.filter((n) => n !== broj);
    numbers.unshift(broj);
    if (numbers.length > 3) numbers = numbers.slice(0, 3);
    this.recentNumbers = numbers;
    localStorage.setItem('recentDriverNumbers', JSON.stringify(numbers));
  }

  /** Uklanja nule slijeva do prve znamenke različite od nule (00564 → 564). */
  ukloniVodeceNule() {
    const ctrl = this.loginForm.get('sluzbeniBroj');
    const v = String(ctrl?.value ?? '').trim();
    if (/^\d+$/.test(v)) ctrl?.setValue(v.replace(/^0+(?=\d)/, ''));
  }

  /** Dodir na prijedlog: upiši broj i zatvori popis. */
  odaberiPrijedlog(v: VozacInfo): void {
    // Bez valueChanges, da se popis odmah opet ne otvori.
    const ctrl = this.loginForm.get('sluzbeniBroj');
    ctrl?.setValue(String(v.sluz_broj).replace(/^0+(?=\d)/, ''), { emitEvent: false });
    ctrl?.markAsTouched();
    this.loginGreska = '';
    this.prijedlozi = [];
  }

  /** Popis se zatvori kad polje izgubi fokus (dodir na prijedlog ide prije). */
  zatvoriPrijedloge(): void {
    setTimeout(() => (this.prijedlozi = []), 150);
  }

  selectRecentNumber(broj: string) {
    this.loginForm.get('sluzbeniBroj')?.setValue(broj);
    this.loginForm.get('sluzbeniBroj')?.markAsTouched();
  }

  removeRecentNumber(event: Event, broj: string) {
    event.stopPropagation();
    this.recentNumbers = this.recentNumbers.filter((n) => n !== broj);
    localStorage.setItem(
      'recentDriverNumbers',
      JSON.stringify(this.recentNumbers),
    );
  }

  onSubmit(): void {
    this.ukloniVodeceNule();
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.loginGreska = '';
      this.lozinkaGreska = '';
      const broj = String(this.loginForm.value.sluzbeniBroj);
      const forSessionBroj = broj.padStart(5, '0');

      this.authService.loginWithEmployeeNumber(broj).subscribe({
        next: (res) => {
          this.saveRecentNumber(forSessionBroj);

          sessionStorage.setItem('sluzbeniBroj', forSessionBroj);
          sessionStorage.setItem('imePrezime', res.imePrezime);
          sessionStorage.setItem('kontaktBroj', res.kontaktBroj);
          sessionStorage.setItem('kontaktBrojInfo', res.kontaktBrojInfo);
          sessionStorage.setItem(
            'isNextWeekAvailable',
            this.isNextWeekAvailable ? 'true' : 'false',
          );

          this.router.navigate(['/dashboard']);

          this.isLoading = false;
        },
        error: (err) => {
          this.isLoading = false;
          if (err?.error?.code === 'PRISTUP') {
            // Spremljeni token više ne vrijedi (npr. promijenjena lozinka).
            this.zakljucaj('Lozinka je promijenjena – unesi novu.');
            return;
          }
          this.loginGreska =
            err?.status === 404
              ? 'Vozač s tim brojem ne postoji.'
              : 'Prijava nije uspjela. Pokušaj ponovno.';
        },
      });
    }
  }
}
