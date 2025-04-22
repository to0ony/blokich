import { Component } from '@angular/core';
import { UploadPanelComponent } from '../../components/admin/upload-panel/upload-panel.component';
import { NavbarComponent } from '../../components/navbar/navbar.component';

@Component({
  selector: 'app-dashboard-admin',
  standalone: true,
  imports: [UploadPanelComponent, NavbarComponent],
  templateUrl: './dashboard-admin.component.html',
  styleUrl: './dashboard-admin.component.scss',
})
export class DashboardAdminComponent {}
