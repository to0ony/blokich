import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { ApiService } from './api.service';

export interface UzivoOdgovor {
  vrijeme: string | null;
  blokovi: Record<string, { vozilo: string; kasnjenje: number; model?: string }>;
}

@Injectable({ providedIn: 'root' })
export class UzivoService {
  constructor(private api: ApiService) {}

  /** Kašnjenje vozila po bloku (linija + V.R.) iz ZET-ovog feeda. */
  zaBlokove(blokovi: string[]) {
    const params = new HttpParams().set('blokovi', blokovi.join(','));
    return this.api.get<UzivoOdgovor>('uzivo', params);
  }
}
