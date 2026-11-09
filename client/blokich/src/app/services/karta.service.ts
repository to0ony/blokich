/// <reference types="geojson" />
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

export interface KartaOdgovor {
  vrijeme: string | null;
  gtfs: string | null;
  vozila: VoziloKarta[];
}

/** Zatvorena cesta ili gradski radovi (svojstva GeoJSON featurea). */
export interface RadoviSvojstva {
  vrsta: 'zatvaranje' | 'radovi';
  naslov: string;
  opis: string | null;
  od: string | null;
  do: string | null;
  /** BOTH_DIRECTIONS / ONE_DIRECTION (samo zatvaranja). */
  smjer: string | null;
  url: string | null;
  aktivno: boolean;
}

@Injectable({ providedIn: 'root' })
export class KartaService {
  constructor(private api: ApiService) {}

  vozila() {
    return this.api.get<KartaOdgovor>('karta/vozila');
  }

  /** Zatvorene ceste (linije) i gradski radovi (točke) kao GeoJSON. */
  radovi() {
    return this.api.get<GeoJSON.FeatureCollection<GeoJSON.Geometry, RadoviSvojstva>>(
      'karta/radovi',
    );
  }

  /** Trase po shape_id, kao nizovi [lat, lon]. */
  oblici(ids: string[]) {
    const params = new HttpParams().set('id', ids.join(','));
    return this.api.get<{ oblici: Record<string, [number, number][]> }>('karta/oblici', params);
  }
}
