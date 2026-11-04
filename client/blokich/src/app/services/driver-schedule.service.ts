import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { KalendarOdgovor } from '../components/vozac/vozac.model';

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

  // Fetches one month of the driver's schedule for the calendar
  fetchKalendar(godina: number, mjesec: number): Observable<KalendarOdgovor> {
    const sluzbeniBroj = sessionStorage.getItem('sluzbeniBroj');
    if (!sluzbeniBroj) {
      throw new Error(
        'Službeni broj nije pronađen u sessionStorage. Pokušajte se ponovno prijaviti.',
      );
    }

    const params = new HttpParams().set('godina', godina).set('mjesec', mjesec);
    return this.api.get<KalendarOdgovor>(
      `vozac-rasporedVoznje/kalendar/${sluzbeniBroj}`,
      params,
    );
  }
}
