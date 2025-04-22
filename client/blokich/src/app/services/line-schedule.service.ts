import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root',
})
export class LineScheduleService {
  constructor(private api: ApiService) {}

  fetchLineDrivers(
    linija: string,
    dan: string,
    tjedan: 'trenutni' | 'naredni' = 'trenutni',
  ): Observable<any> {
    const params = new HttpParams()
      .set('linija', linija)
      .set('dan', dan)
      .set('tjedan', tjedan);

    return this.api.get('vozaci-po-liniji-dan', params);
  }
}
