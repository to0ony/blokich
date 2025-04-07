import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class LineScheduleService {
  constructor(private http: HttpClient) {}

  fetchLineDrivers(
    linija: string,
    dan: string,
    tjedan: 'trenutni' | 'naredni' = 'trenutni',
  ): Observable<any> {
    return this.http.get('/api/vozaci-po-liniji-dan', {
      params: { linija, dan, tjedan },
    });
  }
}
