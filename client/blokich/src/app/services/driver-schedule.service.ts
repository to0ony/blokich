import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class DriverScheduleService {
  constructor(private http: HttpClient) {}

  // Fetches the schedule for current week for the logged-in driver
  fetchDriverSchedule(): Observable<any> {
    const sluzbeniBroj = sessionStorage.getItem('sluzbeniBroj');
    if (!sluzbeniBroj) {
      throw new Error(
        'Službeni broj nije pronađen u sessionStorage. Pokušajte se ponovno prijaviti.',
      );
    }

    return this.http.get(`/api/vozac-rasporedvoznje/${sluzbeniBroj}`);
  }

  // Fetches the schedule for the next week for the logged-in driver
  fetchUpcomingWeekSchedule() {
    const sluzbeniBroj = sessionStorage.getItem('sluzbeniBroj');
    if (!sluzbeniBroj) {
      throw new Error(
        'Službeni broj nije pronađen u sessionStorage. Pokušajte se ponovno prijaviti.',
      );
    }

    return this.http.get(
      `/api/vozac-rasporedVoznje/naredniTjedan/${sluzbeniBroj}`,
    );
  }
}
