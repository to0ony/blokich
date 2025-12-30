import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root',
})
export class ServiceScheduleService {
  constructor(private api: ApiService) {}

  fetchServiceDrivers(
    sluzba: string,
    dan?: string,
    tjedan: 'trenutni' | 'naredni' = 'trenutni',
  ): Observable<any> {
    let params = new HttpParams().set('br_sl', sluzba).set('tjedan', tjedan);

    if (dan) {
      params = params.set('dan', dan);
    }

    return this.api.get('vozaci-po-sluzbi-dan', params);
  }
}
