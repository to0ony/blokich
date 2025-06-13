import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { HttpParams } from '@angular/common/http';

interface PublicHoliday {
  id: string;
  startDate: string;
  endDate: string;
  name: { language: string; text: string }[];
}

@Injectable({ providedIn: 'root' })
export class OpenHolidaysService {
  private readonly baseUrl = 'PublicHolidays';

  constructor(private api: ApiService) {}

  getPublicHolidays(validFrom: string, validTo: string) {
    const params = new HttpParams()
      .set('countryIsoCode', 'HR')
      .set('validFrom', validFrom)
      .set('validTo', validTo)
      .set('languageIsoCode', 'HR');

    return this.api.getFromOpenHolidays<PublicHoliday[]>(this.baseUrl, params);
  }
}
