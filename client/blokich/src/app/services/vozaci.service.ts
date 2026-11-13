import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

export interface VozacInfo {
  sluz_broj: string;
  ime_prezime: string;
}

@Injectable({
  providedIn: 'root',
})
export class VozaciService {
  constructor(private api: ApiService) {}

  searchVozaci(query: string, limit?: number) {
    const lim = limit ? `&limit=${limit}` : '';
    return this.api.get<VozacInfo[]>(
      `vozaci/search?q=${encodeURIComponent(query)}${lim}`,
    );
  }
}
