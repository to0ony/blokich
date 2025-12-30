import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ServiceScheduleService } from '../../../services/service-schedule.service';
import { ServiceDutyCardComponent } from '../../card/service-duty-card/service-duty-card.component';
import { ServiceInfoCardComponent } from '../../card/service-info-card/service-info-card.component';

@Component({
  selector: 'app-service-schedule',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ServiceDutyCardComponent,
    ServiceInfoCardComponent,
  ],
  templateUrl: './service-schedule.component.html',
  styleUrls: ['./service-schedule.component.scss'],
})
export class ServiceScheduleComponent implements OnInit {
  odabranaSluzba: string = '';
  odabraniTjedan: 'trenutni' | 'naredni' = 'trenutni';
  serviceData: any = null;
  isLoading: boolean = false;
  isSearched: boolean = false;

  isNextWeekAvailable: boolean =
    sessionStorage.getItem('isNextWeekAvailable') === 'true';

  constructor(private serviceScheduleService: ServiceScheduleService) {}

  ngOnInit(): void {
    if (!this.isNextWeekAvailable) {
      this.odabraniTjedan = 'trenutni';
    }
  }

  fetchSchedule() {
    if (!this.odabranaSluzba) return;

    this.isLoading = true;
    this.isSearched = true;

    this.serviceScheduleService
      .fetchServiceDrivers(this.odabranaSluzba, undefined, this.odabraniTjedan)
      .subscribe({
        next: (data) => {
          this.serviceData = data;
          this.isLoading = false;
        },
        error: (err) => {
          console.error(err);
          this.serviceData = null;
          this.isLoading = false;
        },
      });
  }
}
