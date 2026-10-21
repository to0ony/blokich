import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root',
})
export class DriverStatsService {
  constructor(private api: ApiService) {}

  // Fetches weekly or monthly statistics for the logged-in driver (newest first)
  fetchDriverStats(tip: 'tjedan' | 'mjesec'): Observable<any> {
    const sluzbeniBroj = sessionStorage.getItem('sluzbeniBroj');
    if (!sluzbeniBroj) {
      throw new Error(
        'Službeni broj nije pronađen u sessionStorage. Pokušajte se ponovno prijaviti.',
      );
    }

    const params = new HttpParams().set('tip', tip);
    return this.api.get(`vozac-stats/${sluzbeniBroj}`, params);
  }
}
