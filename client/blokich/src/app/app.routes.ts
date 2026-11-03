import { Routes } from '@angular/router';
import { AdminGuard } from './guards/admin.guard';
import { DriverGuard } from './guards/driver.guard';
import { PristupGuard } from './guards/pristup.guard';

export const routes: Routes = [
  // Redirect to login if no path is provided
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  // Login page route
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'alogin',
    loadComponent: () =>
      import('./pages/login-admin/login-admin.component').then(
        (m) => m.LoginAdminComponent,
      ),
  },
  // Pregled službe s login ekrana (bez prijave službenim brojem)
  {
    canActivate: [PristupGuard],
    path: 'sluzba',
    loadComponent: () =>
      import('./pages/pregled-sluzbe/pregled-sluzbe.component').then(
        (m) => m.PregledSluzbeComponent,
      ),
  },
  // Driver Dashboard page route (lazy – PrimeNG se učitava tek ovdje)
  {
    canActivate: [DriverGuard],
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/dashboard-driver/dashboard-driver.component').then(
        (m) => m.DashboardDriverComponent,
      ),
  },
  // Admin Dashboard page route
  {
    canActivate: [AdminGuard],
    path: 'admin',
    loadComponent: () =>
      import('./pages/dashboard-admin/dashboard-admin.component').then(
        (m) => m.DashboardAdminComponent,
      ),
  },
];
