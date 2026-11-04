import { Component, inject } from '@angular/core';
import { PrimeNG } from 'primeng/config';
import { AdminLoginFormComponent } from '../../components/form/admin-login-form/admin-login-form.component';
import { postaviPrimeNgTemu } from '../../theme/primeng-setup';

@Component({
  selector: 'app-login-admin',
  imports: [AdminLoginFormComponent],
  standalone: true,
  templateUrl: './login-admin.component.html',
  styleUrl: './login-admin.component.scss',
})
export class LoginAdminComponent {
  constructor() {
    postaviPrimeNgTemu(inject(PrimeNG));
  }
}
