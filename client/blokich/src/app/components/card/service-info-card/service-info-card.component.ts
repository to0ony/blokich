import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-service-info-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './service-info-card.component.html',
  styleUrls: ['./service-info-card.component.scss'],
})
export class ServiceInfoCardComponent {
  @Input() serviceData: any;
  isStatsExpanded = false;

  toggleStats() {
    this.isStatsExpanded = !this.isStatsExpanded;
  }
}
