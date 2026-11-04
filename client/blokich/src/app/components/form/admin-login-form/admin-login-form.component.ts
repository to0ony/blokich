import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-admin-login-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ButtonModule, InputTextModule],
  templateUrl: './admin-login-form.component.html',
  styleUrl: './admin-login-form.component.scss',
})
export class AdminLoginFormComponent {
  username = '';
  password = '';
  error = '';
  loading = false;

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  login() {
    if (!this.username || !this.password || this.loading) return;
    this.loading = true;
    this.error = '';

    this.authService.loginAsAdmin(this.username, this.password).subscribe({
      next: (res) => {
        localStorage.setItem('token', res.token);
        localStorage.setItem(
          'user',
          JSON.stringify({ username: this.username, isAdmin: true }),
        );
        this.loading = false;
        this.router.navigate(['/admin']);
      },
      error: () => {
        this.loading = false;
        this.error = 'Neispravno korisničko ime ili lozinka.';
      },
    });
  }
}
