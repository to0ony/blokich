import { Component, inject } from '@angular/core';
import { PrimeNG } from 'primeng/config';
import { LoginFormComponent } from '../../components/form/login-form/login-form.component';
import { postaviPrimeNgTemu } from '../../theme/primeng-setup';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [LoginFormComponent],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  constructor() {
    postaviPrimeNgTemu(inject(PrimeNG));
  }
}
