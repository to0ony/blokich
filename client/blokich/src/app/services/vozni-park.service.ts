import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

export interface VoziloParka {
  broj: string;
  kratko: string;
  model: string;
  tablica: string | null;
  uzivo: { linija: string; vr: string; kasnjenje: number } | null;
}

export interface VozniParkOdgovor {
  vrijeme: string | null;
  vozila: VoziloParka[];
}

@Injectable({ providedIn: 'root' })
export class VozniParkService {
  constructor(private api: ApiService) {}

  /** Busevi AP Podsused i tko je od njih sad na liniji (ZET uživo). */
  dohvati() {
    return this.api.get<VozniParkOdgovor>('vozni-park');
  }
}
