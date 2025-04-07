import { Routes } from '@angular/router';
import { DashboardDriverComponent } from './pages/dashboard-driver/dashboard-driver.component';
import { DashboardAdminComponent } from './pages/dashboard-admin/dashboard-admin.component';
import { AdminGuard } from './guards/admin.guard';

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
  // Driver Dashboard page route
  {
    path: 'dashboard',
    component: DashboardDriverComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import(
            './components/schedule/weekly-schedule/weekly-schedule.component'
          ).then((m) => m.WeeklyScheduleComponent),
      },
    ],
  },
  // Admin Dashboard page route
  {
    canActivate: [AdminGuard],
    path: 'admin',
    component: DashboardAdminComponent,
  },
];
