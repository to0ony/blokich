import { Component, inject } from '@angular/core';
import { PrimeNG } from 'primeng/config';
import { UploadPanelComponent } from '../../components/admin/upload-panel/upload-panel.component';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { postaviPrimeNgTemu } from '../../theme/primeng-setup';

@Component({
  selector: 'app-dashboard-admin',
  standalone: true,
  imports: [UploadPanelComponent, NavbarComponent],
  templateUrl: './dashboard-admin.component.html',
  styleUrl: './dashboard-admin.component.scss',
})
export class DashboardAdminComponent {
  constructor() {
    postaviPrimeNgTemu(inject(PrimeNG));
  }
}
