import { Component, inject } from '@angular/core';
import { PrimeNG } from 'primeng/config';
import { UploadPanelComponent } from '../../components/admin/upload-panel/upload-panel.component';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { BlokichPreset } from '../../theme/blokich-preset';

@Component({
  selector: 'app-dashboard-admin',
  standalone: true,
  imports: [UploadPanelComponent, NavbarComponent],
  templateUrl: './dashboard-admin.component.html',
  styleUrl: './dashboard-admin.component.scss',
})
export class DashboardAdminComponent {
  constructor() {
    // Admin ruta je lazy, pa se PrimeNG tema učitava samo ovdje.
    inject(PrimeNG).setConfig({
      ripple: true,
      theme: {
        preset: BlokichPreset,
        // Aplikacija je samo svijetla – tamni način se nikad ne uključuje sam.
        options: { darkModeSelector: '.blokich-dark' },
      },
    });
  }
}
