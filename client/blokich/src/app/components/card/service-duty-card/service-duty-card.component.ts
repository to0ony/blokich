import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-service-duty-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './service-duty-card.component.html',
  styleUrls: ['./service-duty-card.component.scss'],
})
export class ServiceDutyCardComponent {
  @Input() day: any;
  @Input() serviceInfo: any;

  dayMapping: { [key: string]: string } = {
    PON: 'Ponedjeljak',
    UTO: 'Utorak',
    SRI: 'Srijeda',
    CET: 'Četvrtak',
    PET: 'Petak',
    SUB: 'Subota',
    NED: 'Nedjelja',
  };

  getDayName(shortDay: string): string {
    if (!shortDay) return '';
    const cleanDay = shortDay.replace('.', '').trim().toUpperCase();
    return this.dayMapping[cleanDay] || shortDay;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return dateStr.replace(/\//g, '.');
  }
}
