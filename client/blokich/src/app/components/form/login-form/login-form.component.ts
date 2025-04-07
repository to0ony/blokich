import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login-form.component.html',
  styleUrls: ['./login-form.component.scss'],
})
export class LoginFormComponent implements OnInit {
  loginForm!: FormGroup;
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      sluzbeniBroj: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    });
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.isLoading = true;
      const broj = String(this.loginForm.value.sluzbeniBroj);
      const forSessionBroj = broj.padStart(5, '0');

      this.authService.loginWithEmployeeNumber(broj).subscribe({
        next: (res) => {
          sessionStorage.setItem('sluzbeniBroj', forSessionBroj);
          sessionStorage.setItem('imePrezime', res.imePrezime);

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
