import { Component, OnInit, ViewChild } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { Router } from '@angular/router';
import { UploadService } from '../../../services/upload.service';
import { DisponentStatusComponent } from '../../status/disponent-status/disponent-status.component';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { VozacSearchFormComponent } from '../vozac-search-form/vozac-search-form.component';

dayjs.extend(isoWeek);

@Component({
  selector: 'app-login-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DisponentStatusComponent,
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
    if (this.loginForm.valid) {
      this.isLoading = true;
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
          console.error('Login greška:', err);
          alert('Neispravan broj ili vozač ne postoji.');
          this.isLoading = false;
        },
      });
    }
  }
}
