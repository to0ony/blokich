import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root',
})
export class DriverScheduleService {
  constructor(private api: ApiService) {}

  // Fetches the schedule for current week for the logged-in driver
  fetchDriverSchedule(): Observable<any> {
    const sluzbeniBroj = sessionStorage.getItem('sluzbeniBroj');
    if (!sluzbeniBroj) {
      throw new Error(
        'Službeni broj nije pronađen u sessionStorage. Pokušajte se ponovno prijaviti.',
      );
    }

    return this.api.get(`vozac-rasporedvoznje/${sluzbeniBroj}`);
  }

  // Fetches the schedule for the next week for the logged-in driver
  fetchUpcomingWeekSchedule(): Observable<any> {
    const sluzbeniBroj = sessionStorage.getItem('sluzbeniBroj');
    if (!sluzbeniBroj) {
      throw new Error(
        'Službeni broj nije pronađen u sessionStorage. Pokušajte se ponovno prijaviti.',
      );
    }

    return this.api.get(`vozac-rasporedVoznje/naredniTjedan/${sluzbeniBroj}`);
  }
}
