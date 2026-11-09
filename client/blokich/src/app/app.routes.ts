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
  // Popis svih službi aktualne verzije s login ekrana
  {
    canActivate: [PristupGuard],
    path: 'sluzbe',
    loadComponent: () =>
      import('./pages/popis-sluzbi/popis-sluzbi.component').then(
        (m) => m.PopisSluzbiComponent,
      ),
  },
  // Vozači na liniji s login ekrana (bez prijave službenim brojem)
  {
    canActivate: [PristupGuard],
    path: 'linija',
    loadComponent: () =>
      import('./pages/pregled-linije/pregled-linije.component').then(
        (m) => m.PregledLinijeComponent,
      ),
  },
  // Vozni park s login ekrana (otključan uređaj)
  {
    canActivate: [PristupGuard],
    path: 'vozni-park',
    loadComponent: () =>
      import('./pages/vozni-park/vozni-park.component').then(
        (m) => m.VozniParkComponent,
      ),
  },
  // Karta uživo s login ekrana (otključan uređaj)
  {
    canActivate: [PristupGuard],
    path: 'karta',
    loadComponent: () =>
      import('./pages/karta/karta.component').then((m) => m.KartaComponent),
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
