import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { ApiService } from './api.service';

/** Vozač na bloku (samo AP Podsused). */
export interface VozacKarta {
  sluz_broj: string;
  ime: string | null;
  kontakt: string | null;
  br_sl: string;
  od: string;
  do: string;
}

/** Vozilo na karti, kako ga vraća /api/karta/vozila. */
export interface VoziloKarta {
  id: string;
  lat: number;
  lon: number;
  /** Kad je vozilo javilo poziciju (unix sekunde). */
  ts: number;
  linija: string | null;
  tip: 'tramvaj' | 'autobus' | null;
  oblik: string | null;
  smjer: number | null;
  cilj: string | null;
  blok: string | null;
  linijaBloka: string | null;
  vr: string | null;
  /** Sekunde; negativno = ranije. */
  kasnjenje: number | null;
  podsused: boolean;
  model?: string;
  tablica?: string | null;
  vozac?: VozacKarta;
}

export interface StajalisteKarta {
  id: string;
  naziv: string;
  lat: number;
  lon: number;
}

/** Linija iz GTFS-a (za pretragu). */
export interface RutaKarta {
  id: string;
  naziv: string;
  opis: string;
  tip: number;
}

/** Ruta linije: za svaki smjer glavna trasa i stajališta. */
export interface LinijaKarta {
  broj: string;
  opis: string;
  tip: 'tramvaj' | 'autobus';
  smjerovi: {
    smjer: number | null;
    cilj: string | null;
    oblik: string;
    tocke: [number, number][];
    stajalista: StajalisteKarta[];
  }[];
}

/** Skretanje na trasi (vidi /api/karta/navigacija). */
export interface ManevarKarta {
  /** Metri od početka trase. */
  d: number;
  tip:
    | 'lijevo'
    | 'desno'
    | 'blago-lijevo'
    | 'blago-desno'
    | 'ostro-lijevo'
    | 'ostro-desno'
    | 'polukruzno'
    | 'kruzni';
  ulica: string | null;
  izlaz?: number;
}

export interface NavigacijaKarta {
  izvor: 'osrm' | 'geometrija';
  manevri: ManevarKarta[];
}

export interface KartaOdgovor {
  vrijeme: string | null;
  gtfs: string | null;
  vozila: VoziloKarta[];
}

@Injectable({ providedIn: 'root' })
export class KartaService {
  constructor(private api: ApiService) {}

  /** Sva vozila, ili samo ona na zadanim blokovima (linija + V.R.). */
  vozila(blokovi?: string[]) {
    const params = blokovi?.length ? new HttpParams().set('blokovi', blokovi.join(',')) : undefined;
    return this.api.get<KartaOdgovor>('karta/vozila', params);
  }

  /** Sve linije (za pretragu i kad nijedan bus linije nije vani). */
  rute() {
    return this.api.get<{ rute: RutaKarta[] }>('karta/rute');
  }

  /** Ruta linije po broju. */
  linija(broj: string) {
    const params = new HttpParams().set('broj', broj);
    return this.api.get<LinijaKarta>('karta/linija', params);
  }

  /** Skretanja po trasi za navigaciju. */
  navigacija(oblik: string) {
    const params = new HttpParams().set('oblik', oblik);
    return this.api.get<NavigacijaKarta>('karta/navigacija', params);
  }

  /** Stajališta trase, redom kojim ih vožnja obilazi. */
  stajalista(oblik: string) {
    const params = new HttpParams().set('oblik', oblik);
    return this.api.get<{ stajalista: StajalisteKarta[] }>('karta/stajalista', params);
  }

  /** Trase po shape_id, kao nizovi [lat, lon]. */
  oblici(ids: string[]) {
    const params = new HttpParams().set('id', ids.join(','));
    return this.api.get<{ oblici: Record<string, [number, number][]> }>('karta/oblici', params);
  }
}
