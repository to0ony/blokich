import { Injectable, Logger } from '@nestjs/common';
import {
  PozicijaUzivo,
  VOZNI_PARK,
  ZetUzivoService,
} from '../zet-uzivo/zet-uzivo.service';
import {
  GtfsPodaci,
  GtfsStatickiService,
  Oblik,
  RutaGtfs,
  StajalisteGtfs,
  servisiNaDan,
} from './gtfs-staticki.service';
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

  /** Sva vozila, ili samo ona na zadanim blokovima (npr. kartica vozača). */
  async vozila(blokovi?: string[]): Promise<KartaStanje> {
    const [stanje, naBloku] = await Promise.all([
      this.uzivo.stanje(),
      this.vozaci.aktivni().catch((err) => {
        this.logger.warn(`Vozači na blokovima nedostupni: ${err?.message}`);
        return new Map<string, VozacNaBloku>();
      }),
    ]);
    const g = this.gtfs.get();
    const samo = blokovi?.length ? new Set(blokovi) : null;
    return {
      vrijeme: stanje.vrijeme,
      gtfs: g?.verzija ?? null,
      vozila: stanje.vozila
        .filter((p) => !samo || (p.blok !== null && samo.has(p.blok)))
        .map((p) => spojiVozilo(p, g, naBloku)),
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

  /** Stajališta trase redom kojim ih vožnja obilazi. */
  stajalista(oblik: string): StajalisteGtfs[] {
    const g = this.gtfs.get();
    const ids = g?.stajalistaOblika.get(oblik) ?? [];
    return ids
      .map((id) => g!.stajalista.get(id))
      .filter((s): s is StajalisteGtfs => !!s);
  }

  rute(): RutaGtfs[] {
    const g = this.gtfs.get();
    return g ? [...g.rute.values()] : [];
  }

  /**
   * Ruta linije po broju (kao na busu): za svaki smjer glavna trasa i
   * njena stajališta, plus sve varijante tog smjera (prva je glavna).
   * null = linija ne postoji (ili GTFS još nije učitan).
   */
  linija(broj: string): LinijaKarta | null {
    const g = this.gtfs.get();
    if (!g) return null;
    const ruta = [...g.rute.values()].find((r) => r.naziv === broj) ?? g.rute.get(broj);
    if (!ruta) return null;
    const trasa = (oblik: string) => ({
      oblik,
      tocke: g.oblici.get(oblik) ?? [],
      stajalista: this.stajalista(oblik),
    });
    const smjerovi = (g.glavneTrase.get(ruta.id) ?? [])
      .map((t) => {
        const glavna = trasa(t.oblik);
        const varijante: VarijantaKarta[] = [
          { ...glavna, cilj: t.cilj, voznji: t.voznji, glavna: true, opis: 'Glavna trasa' },
          ...t.ostale.map((o) => {
            const v = trasa(o.oblik);
            return {
              ...v,
              cilj: o.cilj,
              voznji: o.voznji,
              glavna: false,
              opis:
                opisVarijante(glavna.stajalista, v.stajalista) ??
                (v.stajalista.length ? 'ista stajališta, drugi put' : (o.cilj ?? o.oblik)),
            };
          }),
        ].filter((v) => v.tocke.length > 1);
        return { smjer: t.smjer, cilj: t.cilj, ...glavna, varijante };
      })
      .filter((s) => s.tocke.length > 1);
    return { broj: ruta.naziv, opis: ruta.opis, tip: ruta.tip === 0 ? 'tramvaj' : 'autobus', smjerovi };
  }

  /** Vozni red linije po broju na datum (YYYYMMDD, zadano danas). null = nema linije. */
  vozniRed(broj: string, datum = danasZagreb()): VozniRedLinije | null {
    const g = this.gtfs.get();
    if (!g) return null;
    const ruta = [...g.rute.values()].find((r) => r.naziv === broj) ?? g.rute.get(broj);
    return ruta ? vozniRed(g, ruta, datum) : null;
  }
}

/** Polasci i vremena vožnje po trasi linije za jedan dan. */
export interface VozniRedLinije {
  broj: string;
  /** YYYYMMDD */
  datum: string;
  /** shape_id -> polasci (HH:MM, redom) i minute od polaska do svakog stajališta. */
  oblici: Record<string, { polasci: string[]; vremena: number[] | null }>;
}

/** Današnji datum u Zagrebu kao YYYYMMDD. */
export function danasZagreb(sad = new Date()): string {
  return sad.toLocaleDateString('sv-SE', { timeZone: 'Europe/Zagreb' }).replace(/-/g, '');
}

/** Vozni red linije na dan: polasci svake trase iz servisa koji tad voze. */
export function vozniRed(g: GtfsPodaci, ruta: RutaGtfs, datum: string): VozniRedLinije {
  const servisi = g.kalendar ? servisiNaDan(g.kalendar, datum) : new Set<string>();
  const poObliku = new Map<string, number[]>();
  for (const v of g.voznje.values()) {
    if (v.ruta !== ruta.id || !v.oblik || v.polazak == null) continue;
    if (!v.servis || !servisi.has(v.servis)) continue;
    let lista = poObliku.get(v.oblik);
    if (!lista) poObliku.set(v.oblik, (lista = []));
    lista.push(v.polazak);
  }
  const hhmm = (min: number) =>
    `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
  const oblici: VozniRedLinije['oblici'] = {};
  for (const [oblik, polasci] of poObliku) {
    oblici[oblik] = {
      polasci: [...new Set(polasci)].sort((a, b) => a - b).map(hhmm),
      vremena: g.vremenaOblika?.get(oblik) ?? null,
    };
  }
  return { broj: ruta.naziv, datum, oblici };
}

/**
 * Kratak opis po čemu se varijanta razlikuje od glavne trase, npr.
 * "preko Jadranska av.-Arena", "do Petlja - izlaz" ili "bez Klanjec".
 * null = nema razlike u stajalištima (ili nema stajališta za usporedbu).
 */
export function opisVarijante(glavna: StajalisteGtfs[], varijanta: StajalisteGtfs[]): string | null {
  if (!glavna.length || !varijanta.length) return null;
  const uGlavnoj = new Set(glavna.map((s) => s.naziv));
  const uVarijanti = new Set(varijanta.map((s) => s.naziv));
  const prva = varijanta[0].naziv;
  const zadnja = varijanta[varijanta.length - 1].naziv;
  const dijelovi: string[] = [];
  if (prva !== glavna[0].naziv) dijelovi.push(`od ${prva}`);
  if (zadnja !== glavna[glavna.length - 1].naziv) dijelovi.push(`do ${zadnja}`);
  // Krajnja stajališta su već opisana s "od"/"do".
  const dodatna = varijanta.slice(1, -1).find((s) => !uGlavnoj.has(s.naziv));
  if (dodatna) dijelovi.push(`preko ${dodatna.naziv}`);
  else if (!dijelovi.length) {
    const preskace = glavna.find((s) => !uVarijanti.has(s.naziv));
    if (preskace) dijelovi.push(`bez ${preskace.naziv}`);
  }
  return dijelovi.length ? dijelovi.join(', ') : null;
}

/** Jedna trasa smjera: glavna ili rjeđa varijanta. */
export interface VarijantaKarta {
  oblik: string;
  cilj: string | null;
  tocke: Oblik;
  stajalista: StajalisteGtfs[];
  /** Najviše vožnji tom trasom u jednom danu. */
  voznji: number;
  glavna: boolean;
  /** Npr. "Glavna trasa", "preko Jadranska av.-Arena", "do Petlja - izlaz". */
  opis: string;
}

/** Ruta linije za kartu. */
export interface LinijaKarta {
  broj: string;
  opis: string;
  tip: 'tramvaj' | 'autobus';
  /** Polja smjera su njegova glavna trasa; `varijante` su sve trase smjera. */
  smjerovi: {
    smjer: number | null;
    cilj: string | null;
    oblik: string;
    tocke: Oblik;
    stajalista: StajalisteGtfs[];
    varijante: VarijantaKarta[];
  }[];
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
