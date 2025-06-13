import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

interface PublicHoliday {
  id: string;
  startDate: string;
  endDate: string;
  name: { language: string; text: string }[];
}

@Injectable({ providedIn: 'root' })
export class OpenHolidaysService {
  constructor(private api: ApiService) {}

  getPublicHolidays(validFrom: string, validTo: string) {
    const query =
      `countryIsoCode=HR&validFrom=${encodeURIComponent(validFrom)}` +
      `&validTo=${encodeURIComponent(validTo)}&languageIsoCode=HR`;

    return this.api.get<PublicHoliday[]>(
      `${this.getPublicHolidays}/PublicHolidays?${query}`,
    );
  }
}
