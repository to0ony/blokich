import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-admin-login-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-login-form.component.html',
  styleUrl: './admin-login-form.component.scss',
})
export class AdminLoginFormComponent {
  username = '';
  password = '';
  error = '';

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  login() {
    this.authService.loginAsAdmin(this.username, this.password).subscribe({
      next: (res) => {
        localStorage.setItem('token', res.token);
        localStorage.setItem(
          'user',
          JSON.stringify({ username: this.username, isAdmin: true }),
        );
        this.router.navigate(['/admin']);
      },
      error: () => {
        this.error = 'Neispravni podaci.';
      },
    });
  }
}
