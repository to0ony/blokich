import { Injectable, Logger } from '@nestjs/common';
import {
  PozicijaUzivo,
  VOZNI_PARK,
  ZetUzivoService,
} from '../zet-uzivo/zet-uzivo.service';
import { GtfsPodaci, GtfsStatickiService, Oblik, RutaGtfs } from './gtfs-staticki.service';
import { VozacNaBloku, VozaciNaBlokuService } from './vozaci-na-bloku.service';

/** Vozilo na karti. Model i vozač postoje samo za AP Podsused. */
export interface VoziloNaKarti {
  /** Garažni broj. */
  id: string;
  lat: number;
  lon: number;
  /** Kad je vozilo javilo poziciju (unix sekunde). */
  ts: number;
  /** Broj linije koju vožnja vozi (kao na busu). */
  linija: string | null;
  /** 'tramvaj' | 'autobus' (iz GTFS route_type). */
  tip: 'tramvaj' | 'autobus' | null;
  /** shape_id trase vožnje – trasa se dohvaća s /karta/oblici. */
  oblik: string | null;
  /** direction_id iz GTFS-a. */
  smjer: number | null;
  /** Odredište vožnje (trip_headsign). */
  cilj: string | null;
  /** Blok (linija + V.R.), linija bloka i V.R. – blok ponekad vozi drugu liniju. */
  blok: string | null;
  linijaBloka: string | null;
  vr: string | null;
  /** Sekunde; negativno = ranije. null = feed nema kašnjenje. */
  kasnjenje: number | null;
  podsused: boolean;
  model?: string;
  tablica?: string | null;
  vozac?: VozacNaBloku;
}

export interface KartaStanje {
  /** Vrijeme ZET-ovog feeda (ISO) ili null. */
  vrijeme: string | null;
  /** Verzija statičnog GTFS-a (null = trase još nisu učitane). */
  gtfs: string | null;
  vozila: VoziloNaKarti[];
}

const MAX_OBLIKA = 200;

@Injectable()
export class KartaService {
  private readonly logger = new Logger(KartaService.name);

  constructor(
    private readonly uzivo: ZetUzivoService,
    private readonly gtfs: GtfsStatickiService,
    private readonly vozaci: VozaciNaBlokuService,
  ) {}

  async vozila(): Promise<KartaStanje> {
    const [stanje, naBloku] = await Promise.all([
      this.uzivo.stanje(),
      this.vozaci.aktivni().catch((err) => {
        this.logger.warn(`Vozači na blokovima nedostupni: ${err?.message}`);
        return new Map<string, VozacNaBloku>();
      }),
    ]);
    const g = this.gtfs.get();
    return {
      vrijeme: stanje.vrijeme,
      gtfs: g?.verzija ?? null,
      vozila: stanje.vozila.map((p) => spojiVozilo(p, g, naBloku)),
    };
  }

  /** Trase po shape_id; nepoznati id se preskače. */
  oblici(ids: string[]): Record<string, Oblik> {
    const g = this.gtfs.get();
    const rez: Record<string, Oblik> = {};
    if (!g) return rez;
    for (const id of ids.slice(0, MAX_OBLIKA)) {
      const o = g.oblici.get(id);
      if (o) rez[id] = o;
    }
    return rez;
  }

  rute(): RutaGtfs[] {
    const g = this.gtfs.get();
    return g ? [...g.rute.values()] : [];
  }
}

/** Izdvojeno radi testiranja. */
export function spojiVozilo(
  p: PozicijaUzivo,
  g: GtfsPodaci | null,
  naBloku: Map<string, VozacNaBloku>,
): VoziloNaKarti {
  const voznja = g?.voznje.get(p.tripId);
  const rutaId = voznja?.ruta ?? p.ruta;
  const ruta = rutaId ? g?.rute.get(rutaId) : undefined;
  const park = VOZNI_PARK[p.vozilo];
  const podsused = !!park && p.vozilo !== 'default';
  const vozac = p.blok ? naBloku.get(p.blok) : undefined;

  const v: VoziloNaKarti = {
    id: p.vozilo,
    lat: p.lat,
    lon: p.lon,
    ts: p.ts,
    linija: ruta?.naziv ?? rutaId ?? null,
    tip: ruta ? (ruta.tip === 0 ? 'tramvaj' : 'autobus') : null,
    oblik: voznja?.oblik ?? null,
    smjer: voznja?.smjer ?? null,
    cilj: voznja?.cilj ?? null,
    blok: p.blok,
    linijaBloka: p.blok && p.blok.length > 2 ? p.blok.slice(0, -2) : null,
    vr: p.blok && p.blok.length > 2 ? String(Number(p.blok.slice(-2))) : null,
    kasnjenje: p.kasnjenje,
    podsused,
  };
  if (podsused) {
    v.model = park.kratko;
    v.tablica = park.tablica;
  }
  if (vozac) v.vozac = vozac;
  return v;
}
