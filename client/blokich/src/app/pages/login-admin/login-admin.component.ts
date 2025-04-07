import { Component } from '@angular/core';
import { AdminLoginFormComponent } from '../../components/form/admin-login-form/admin-login-form.component';

@Component({
  selector: 'app-login-admin',
  imports: [AdminLoginFormComponent],
  standalone: true,
  templateUrl: './login-admin.component.html',
  styleUrl: './login-admin.component.scss',
})
export class LoginAdminComponent {}
