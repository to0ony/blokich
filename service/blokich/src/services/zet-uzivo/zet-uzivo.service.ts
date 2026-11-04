import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import * as vozniParkPodsused from '../../vozni-park/podsused.json';

/** Garažni broj -> kratko ime modela (izvor: autobusi.org, vidi scripts/vozni-park). */
const VOZNI_PARK: Record<string, { kratko: string; model: string; tablica: string | null }> =
  vozniParkPodsused as any;

/** Bus iz voznog parka AP Podsused sa stanjem uživo (ako vozi). */
export interface VoziloParka {
  broj: string;
  kratko: string;
  model: string;
  tablica: string | null;
  uzivo: { linija: string; vr: string; kasnjenje: number } | null;
}

/** Vozilo koje trenutno vozi na bloku (linija + V.R.). */
export interface BlokUzivo {
  /** Garažni broj vozila. */
  vozilo: string;
  /** Kašnjenje u sekundama (negativno = ranije od voznog reda). */
  kasnjenje: number;
  /** Model vozila, samo ako je poznat (vozni park AP Podsused). */
  model?: string;
  /** Linija koju vožnja stvarno vozi (route_id) – blok ponekad vozi drugu liniju. */
  ruta?: string;
}

export interface UzivoStanje {
  /** Vrijeme ZET-ovog feeda (ISO) ili null ako podaci nisu dostupni. */
  vrijeme: string | null;
  blokovi: Record<string, BlokUzivo>;
}

const CACHE_MS = 20_000;
/** Stariji podaci se ne prikazuju – bolje ništa nego krivo. */
const MAX_STAROST_S = 180;

/**
 * Podaci uživo iz ZET-ovog GTFS-Realtime feeda.
 *
 * trip_id ima oblik 0_1_10910_109_10258, gdje je treći dio blok:
 * linija (109) + V.R. s dvije znamenke (10). Isti V.R. koristi Blokich.
 */
@Injectable()
export class ZetUzivoService {
  private readonly logger = new Logger(ZetUzivoService.name);
  private readonly url: string;
  private cache: { do: number; stanje: Promise<UzivoStanje> } | null = null;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.url =
      this.config.get<string>('ZET_GTFS_RT_URL') ||
      'https://www.zet.hr/gtfs-rt-protobuf';
  }

  async zaBlokove(blokovi: string[]): Promise<UzivoStanje> {
    const stanje = await this.stanje();
    const odabrani: Record<string, BlokUzivo> = {};
    for (const b of blokovi) {
      const v = stanje.blokovi[b];
      if (!v) continue;
      const model = VOZNI_PARK[v.vozilo]?.kratko;
      odabrani[b] = model ? { ...v, model } : v;
    }
    return { vrijeme: stanje.vrijeme, blokovi: odabrani };
  }

  /** Svi busevi AP Podsused; za one koji su sad u feedu i linija, V.R. i kašnjenje. */
  async vozniPark(): Promise<{ vrijeme: string | null; vozila: VoziloParka[] }> {
    const stanje = await this.stanje();
    const poVozilu = new Map<string, { blok: string; v: BlokUzivo }>();
    for (const [blok, v] of Object.entries(stanje.blokovi)) {
      poVozilu.set(v.vozilo, { blok, v });
    }

    const vozila = Object.entries(VOZNI_PARK)
      .filter(([broj]) => broj !== 'default')
      .map(([broj, p]) => {
        const u = poVozilu.get(broj);
        return {
          broj,
          kratko: p.kratko,
          model: p.model,
          tablica: p.tablica,
          uzivo: u
            ? {
                linija: u.v.ruta || u.blok.slice(0, -2),
                vr: String(Number(u.blok.slice(-2))),
                kasnjenje: u.v.kasnjenje,
              }
            : null,
        };
      });
    return { vrijeme: stanje.vrijeme, vozila };
  }

  /** Feed se dohvaća najviše jednom u 20 s, bez obzira na broj vozača. */
  private stanje(): Promise<UzivoStanje> {
    const sad = Date.now();
    if (!this.cache || this.cache.do < sad) {
      this.cache = {
        do: sad + CACHE_MS,
        stanje: this.dohvati().catch((err) => {
          this.logger.warn(`ZET GTFS-RT nije dostupan: ${err?.message}`);
          return { vrijeme: null, blokovi: {} };
        }),
      };
    }
    return this.cache.stanje;
  }

  private async dohvati(): Promise<UzivoStanje> {
    const res = await firstValueFrom(
      this.http.get<ArrayBuffer>(this.url, {
        responseType: 'arraybuffer',
        timeout: 10_000,
      }),
    );
    const feed =
      GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
        new Uint8Array(res.data),
      );
    return this.obradi(feed, Date.now() / 1000);
  }

  /** Izdvojeno radi testiranja. */
  obradi(feed: any, sadSek: number): UzivoStanje {
    const vrijemeFeeda = Number(feed.header?.timestamp ?? 0);
    if (!vrijemeFeeda || sadSek - vrijemeFeeda > MAX_STAROST_S) {
      return { vrijeme: null, blokovi: {} };
    }

    // Kašnjenje po vožnji: prva sljedeća stanica u trip_update.
    const kasnjenjePoVoznji = new Map<string, number>();
    for (const e of feed.entity ?? []) {
      const tu = e.tripUpdate;
      const tripId = tu?.trip?.tripId;
      const prva = tu?.stopTimeUpdate?.[0];
      if (!tripId || !prva) continue;
      const delay = prva.arrival?.delay ?? prva.departure?.delay;
      if (typeof delay === 'number') kasnjenjePoVoznji.set(tripId, delay);
    }

    const blokovi: Record<string, BlokUzivo> = {};
    const dvostruki = new Set<string>();

    for (const e of feed.entity ?? []) {
      const v = e.vehicle;
      const tripId: string | undefined = v?.trip?.tripId;
      const vozilo: string | undefined = v?.vehicle?.id;
      if (!tripId || !vozilo || !v.position) continue;

      // Pozicija mora biti svježa.
      const ts = Number(v.timestamp ?? 0);
      if (!ts || sadSek - ts > MAX_STAROST_S) continue;

      const blok = tripId.split('_')[2];
      const kasnjenje = kasnjenjePoVoznji.get(tripId);
      if (!blok || !/^\d+$/.test(blok) || kasnjenje === undefined) continue;

      if (blokovi[blok]) dvostruki.add(blok);
      const ruta: string | undefined = v.trip?.routeId || tripId.split('_')[3];
      blokovi[blok] = ruta ? { vozilo, kasnjenje, ruta } : { vozilo, kasnjenje };
    }

    // Dva vozila na istom bloku = nejasno, ne prikazuj ništa.
    for (const b of dvostruki) delete blokovi[b];

    return {
      vrijeme: new Date(vrijemeFeeda * 1000).toISOString(),
      blokovi,
    };
  }
}
