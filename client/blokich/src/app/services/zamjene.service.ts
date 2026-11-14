import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  DanKey,
  FilterKandidata,
  KandidatiOdgovor,
  TjedanTip,
  ZamjenaInfo,
} from '../components/vozac/vozac.model';

export type StanjeZamjene = 'primijenjena' | 'u_disponentu' | 'zastarjela' | 'ponistena';

export interface StranaZamjene {
  sluz_broj: string;
  ime_prezime: string | null;
  oznaka: string;
}

export interface ZamjenaAdmin {
  id: string;
  godina: number;
  brojTjedna: number;
  dan: DanKey;
  datum: string;
  tip: 'zamjena' | 'ukidanje';
  a: StranaZamjene;
  b: StranaZamjene | null;
  kreirano: string;
  ponistena: string | null;
  stanje: StanjeZamjene;
}

export interface ZamjeneAdminOdgovor {
  vozaci: { sluz_broj: string; ime_prezime: string | null }[];
  zamjene: ZamjenaAdmin[];
}

/** Zamjene i ukidanje službi prijavljenog vozača. */
@Injectable({ providedIn: 'root' })
export class ZamjeneService {
  constructor(private api: ApiService) {}

  private get radnik(): string {
    const broj = sessionStorage.getItem('sluzbeniBroj');
    if (!broj) {
      throw new Error('Službeni broj nije pronađen. Pokušajte se ponovno prijaviti.');
    }
    return broj;
  }

  kandidati(
    tjedan: TjedanTip,
    dan: DanKey,
    q = '',
    filter: FilterKandidata | null = null,
  ): Observable<KandidatiOdgovor> {
    let params = new HttpParams()
      .set('radnik', this.radnik)
      .set('tjedan', tjedan)
      .set('dan', dan)
      .set('q', q);
    if (filter) params = params.set('filter', filter);
    return this.api.get<KandidatiOdgovor>('zamjene/kandidati', params);
  }

  zamijeni(tjedan: TjedanTip, dan: DanKey, sa: string): Observable<ZamjenaInfo> {
    return this.api.post<ZamjenaInfo>('zamjene', {
      radnik: this.radnik,
      tjedan,
      dan,
      tip: 'zamjena',
      sa,
    });
  }

  ukini(tjedan: TjedanTip, dan: DanKey): Observable<ZamjenaInfo> {
    return this.api.post<ZamjenaInfo>('zamjene', {
      radnik: this.radnik,
      tjedan,
      dan,
      tip: 'ukidanje',
    });
  }

  /** Admin: sve zamjene, po vozaču i rasponu datuma (YYYY-MM-DD). */
  adminPopis(filter: { radnik?: string; od?: string; do?: string }): Observable<ZamjeneAdminOdgovor> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(filter)) if (v) params = params.set(k, v);
    return this.api.get<ZamjeneAdminOdgovor>('zamjene/admin', params);
  }

  ponisti(id: string): Observable<unknown> {
    return this.api.post(`zamjene/${id}/ponisti`, { radnik: this.radnik });
  }
}
