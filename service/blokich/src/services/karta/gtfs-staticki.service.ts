import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Unzip, UnzipInflate, strFromU8, unzipSync } from 'fflate';

/** Linija iz routes.txt. */
export interface RutaGtfs {
  id: string;
  /** Broj linije kakav piše na busu (route_short_name). */
  naziv: string;
  /** Npr. "Črnomerec - Savišće". */
  opis: string;
  /** GTFS route_type: 0 = tramvaj, 3 = autobus. */
  tip: number;
}

/** Vožnja iz trips.txt – trip_id je isti kao u GTFS-RT feedu. */
export interface VoznjaGtfs {
  ruta: string;
  oblik: string | null;
  smjer: number | null;
  cilj: string | null;
}

/** Trasa kao niz [lat, lon]. */
export type Oblik = [number, number][];

/** Stajalište iz stops.txt. */
export interface StajalisteGtfs {
  id: string;
  naziv: string;
  lat: number;
  lon: number;
}

export interface GtfsPodaci {
  verzija: string | null;
  rute: Map<string, RutaGtfs>;
  voznje: Map<string, VoznjaGtfs>;
  oblici: Map<string, Oblik>;
  stajalista: Map<string, StajalisteGtfs>;
  /** shape_id -> stop_id redom kojim ih vožnja te trase obilazi. */
  stajalistaOblika: Map<string, string[]>;
  /** route_id -> glavna trasa za svaki smjer (ona kojom ide najviše vožnji). */
  glavneTrase: Map<string, GlavnaTrasa[]>;
}

/** Najčešća trasa linije u jednom smjeru. */
export interface GlavnaTrasa {
  smjer: number | null;
  oblik: string;
  cilj: string | null;
}

const DATOTEKE = ['feed_info.txt', 'routes.txt', 'trips.txt', 'shapes.txt', 'stops.txt'];
/** ZET objavljuje novi GTFS otprilike jednom dnevno. */
const OSVJEZI_MS = 6 * 60 * 60 * 1000;
/** Točke trase bliže od ovoga pravcu između susjeda se izbacuju. */
const TOLERANCIJA_M = 1.5;

/**
 * Statični GTFS ZET-a (vozni red): linije, vožnje i trase za kartu.
 * Drži se u memoriji. stop_times.txt (~80 MB) se čita u komadima i iz njega
 * se uzima samo po jedna vožnja za svaku trasu – za popis stajališta.
 */
@Injectable()
export class GtfsStatickiService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GtfsStatickiService.name);
  private readonly url: string;
  private podaci: GtfsPodaci | null = null;
  private ucitavanje: Promise<void> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.url =
      this.config.get<string>('ZET_GTFS_URL') ||
      'https://www.zet.hr/gtfs-scheduled/latest';
  }

  onModuleInit(): void {
    // Ne blokira start aplikacije – karta je bez trasa dok se ne učita.
    void this.osvjezi();
    this.timer = setInterval(() => void this.osvjezi(), OSVJEZI_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Trenutni podaci ili null ako GTFS još nije učitan. */
  get(): GtfsPodaci | null {
    return this.podaci;
  }

  osvjezi(): Promise<void> {
    if (!this.ucitavanje) {
      this.ucitavanje = this.ucitaj().finally(() => (this.ucitavanje = null));
    }
    return this.ucitavanje;
  }

  private async ucitaj(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<ArrayBuffer>(this.url, {
          responseType: 'arraybuffer',
          timeout: 60_000,
        }),
      );
      const podaci = obradiGtfs(new Uint8Array(res.data));
      this.podaci = podaci;
      this.logger.log(
        `GTFS ${podaci.verzija ?? '?'}: ${podaci.rute.size} linija, ` +
          `${podaci.voznje.size} vožnji, ${podaci.oblici.size} trasa, ` +
          `${podaci.stajalista.size} stajališta`,
      );
    } catch (err: any) {
      // Stari podaci ostaju – bolje jučerašnje trase nego nikakve.
      this.logger.warn(`ZET GTFS nije dostupan: ${err?.message}`);
    }
  }
}

/** Raspakira ZET-ov GTFS zip i složi ga za kartu. Izdvojeno radi testiranja. */
export function obradiGtfs(zip: Uint8Array): GtfsPodaci {
  const datoteke = unzipSync(zip, {
    filter: (f) => DATOTEKE.includes(f.name.split('/').pop() ?? ''),
  });
  const tekst = (ime: string): string => {
    const kljuc = Object.keys(datoteke).find((k) => k.split('/').pop() === ime);
    return kljuc ? strFromU8(datoteke[kljuc]) : '';
  };

  const verzija = redovi(tekst('feed_info.txt'))[0]?.feed_version || null;

  const rute = new Map<string, RutaGtfs>();
  for (const r of redovi(tekst('routes.txt'))) {
    if (!r.route_id) continue;
    rute.set(r.route_id, {
      id: r.route_id,
      naziv: r.route_short_name || r.route_id,
      opis: r.route_long_name || '',
      tip: Number(r.route_type ?? 3),
    });
  }

  const voznje = new Map<string, VoznjaGtfs>();
  /** Po jedna vožnja za svaku trasu – iz nje se čitaju stajališta trase. */
  const predstavnici = new Map<string, string>();
  for (const t of redovi(tekst('trips.txt'))) {
    if (!t.trip_id) continue;
    if (t.shape_id && !predstavnici.has(t.shape_id)) predstavnici.set(t.shape_id, t.trip_id);
    const smjer = t.direction_id === '' || t.direction_id == null ? null : Number(t.direction_id);
    voznje.set(t.trip_id, {
      ruta: t.route_id,
      oblik: t.shape_id || null,
      smjer: Number.isFinite(smjer) ? smjer : null,
      cilj: t.trip_headsign || null,
    });
  }

  const sirovo = new Map<string, { seq: number; lat: number; lon: number }[]>();
  for (const s of redovi(tekst('shapes.txt'))) {
    const lat = Number(s.shape_pt_lat);
    const lon = Number(s.shape_pt_lon);
    if (!s.shape_id || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    let lista = sirovo.get(s.shape_id);
    if (!lista) sirovo.set(s.shape_id, (lista = []));
    lista.push({ seq: Number(s.shape_pt_sequence), lat, lon });
  }
  const oblici = new Map<string, Oblik>();
  for (const [id, tocke] of sirovo) {
    tocke.sort((a, b) => a.seq - b.seq);
    oblici.set(id, pojednostavi(tocke.map((t) => [t.lat, t.lon] as [number, number])));
  }

  const stajalista = new Map<string, StajalisteGtfs>();
  for (const s of redovi(tekst('stops.txt'))) {
    const lat = Number(s.stop_lat);
    const lon = Number(s.stop_lon);
    if (!s.stop_id || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    stajalista.set(s.stop_id, {
      id: s.stop_id,
      naziv: s.stop_name || '',
      lat: Math.round(lat * 1e5) / 1e5,
      lon: Math.round(lon * 1e5) / 1e5,
    });
  }

  const poVoznji = stajalistaVoznji(zip, new Set(predstavnici.values()));
  const stajalistaOblika = new Map<string, string[]>();
  for (const [oblik, trip] of predstavnici) {
    const lista = poVoznji.get(trip);
    if (lista?.length) stajalistaOblika.set(oblik, lista);
  }

  return {
    verzija,
    rute,
    voznje,
    oblici,
    stajalista,
    stajalistaOblika,
    glavneTrase: glavneTraseLinija(voznje),
  };
}

/**
 * Za svaku liniju i smjer trasa kojom ide najviše vožnji – to je "ruta
 * linije" kakvu vozač očekuje, bez rijetkih varijanti (garaža, skraćene).
 */
export function glavneTraseLinija(voznje: Map<string, VoznjaGtfs>): Map<string, GlavnaTrasa[]> {
  const brojac = new Map<string, Map<string, { n: number; cilj: string | null }>>();
  for (const v of voznje.values()) {
    if (!v.oblik) continue;
    const kljuc = `${v.ruta}|${v.smjer ?? ''}`;
    let poObliku = brojac.get(kljuc);
    if (!poObliku) brojac.set(kljuc, (poObliku = new Map()));
    const b = poObliku.get(v.oblik) ?? { n: 0, cilj: v.cilj };
    b.n++;
    poObliku.set(v.oblik, b);
  }

  const rez = new Map<string, GlavnaTrasa[]>();
  for (const [kljuc, poObliku] of brojac) {
    const [ruta, smjerTekst] = kljuc.split('|');
    const [oblik, b] = [...poObliku].sort((x, y) => y[1].n - x[1].n)[0];
    const lista = rez.get(ruta) ?? [];
    lista.push({ smjer: smjerTekst === '' ? null : Number(smjerTekst), oblik, cilj: b.cilj });
    rez.set(ruta, lista);
  }
  for (const lista of rez.values()) lista.sort((a, b) => (a.smjer ?? 0) - (b.smjer ?? 0));
  return rez;
}

/**
 * Stajališta odabranih vožnji iz stop_times.txt, redom. Datoteka se
 * raspakirava i čita u komadima – cijela bi zauzela ~80 MB memorije.
 */
function stajalistaVoznji(zip: Uint8Array, voznje: Set<string>): Map<string, string[]> {
  const sirovo = new Map<string, { seq: number; stop: string }[]>();
  const bez = (v: string | undefined) => (v ?? '').trim().replace(/^"|"$/g, '');
  let stupci: { trip: number; stop: number; seq: number } | null = null;
  let ostatak = '';
  const dekoder = new TextDecoder();

  const redak = (l: string) => {
    if (!l) return;
    if (!stupci) {
      const h = l.replace(/^\uFEFF/, '').split(',').map((x) => bez(x));
      stupci = { trip: h.indexOf('trip_id'), stop: h.indexOf('stop_id'), seq: h.indexOf('stop_sequence') };
      return;
    }
    // Brza provjera prije dijeljenja retka – zanima nas samo mali dio redaka.
    if (stupci.trip === 0 && !voznje.has(bez(l.slice(0, l.indexOf(','))))) return;
    const d = l.split(',');
    const trip = bez(d[stupci.trip]);
    if (!voznje.has(trip)) return;
    let lista = sirovo.get(trip);
    if (!lista) sirovo.set(trip, (lista = []));
    lista.push({ seq: Number(bez(d[stupci.seq])), stop: bez(d[stupci.stop]) });
  };

  const uz = new Unzip((f) => {
    if (f.name.split('/').pop() !== 'stop_times.txt') return;
    f.ondata = (err, komad, kraj) => {
      if (err) throw err;
      const tekst = ostatak + dekoder.decode(komad, { stream: !kraj });
      const linije = tekst.split('\n').map((x) => (x.endsWith('\r') ? x.slice(0, -1) : x));
      ostatak = kraj ? '' : (linije.pop() ?? '');
      for (const l of linije) redak(l);
    };
    f.start();
  });
  uz.register(UnzipInflate);
  // U komadima – inače se cijela datoteka raspakira odjednom.
  const KOMAD = 64 * 1024;
  for (let i = 0; i < zip.length; i += KOMAD) {
    uz.push(zip.subarray(i, i + KOMAD), i + KOMAD >= zip.length);
  }

  const rez = new Map<string, string[]>();
  for (const [trip, lista] of sirovo) {
    lista.sort((a, b) => a.seq - b.seq);
    rez.set(trip, lista.map((x) => x.stop));
  }
  return rez;
}

/** CSV s navodnicima (GTFS) -> objekti po zaglavlju. */
export function redovi(csv: string): Record<string, string>[] {
  const linije = parsirajCsv(csv.replace(/^﻿/, ''));
  const zaglavlje = linije.shift()?.map((h) => h.trim()) ?? [];
  return linije
    .filter((l) => l.length > 1 || (l[0] ?? '') !== '')
    .map((l) => Object.fromEntries(zaglavlje.map((h, i) => [h, l[i] ?? ''])));
}

function parsirajCsv(csv: string): string[][] {
  const rez: string[][] = [];
  let red: string[] = [];
  let polje = '';
  let uNavodnicima = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (uNavodnicima) {
      if (c === '"') {
        if (csv[i + 1] === '"') {
          polje += '"';
          i++;
        } else uNavodnicima = false;
      } else polje += c;
    } else if (c === '"') uNavodnicima = true;
    else if (c === ',') {
      red.push(polje);
      polje = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && csv[i + 1] === '\n') i++;
      red.push(polje);
      rez.push(red);
      red = [];
      polje = '';
    } else polje += c;
  }
  if (polje !== '' || red.length) {
    red.push(polje);
    rez.push(red);
  }
  return rez;
}

/** Douglas–Peucker u metrima; koordinate zaokružene na 5 decimala (~1 m). */
export function pojednostavi(tocke: Oblik, tolerancija = TOLERANCIJA_M): Oblik {
  const zaokruzi = (t: [number, number]): [number, number] => [
    Math.round(t[0] * 1e5) / 1e5,
    Math.round(t[1] * 1e5) / 1e5,
  ];
  if (tocke.length <= 2) return tocke.map(zaokruzi);

  const kx = 111_320 * Math.cos((tocke[0][0] * Math.PI) / 180);
  const ky = 110_540;
  const xy = tocke.map(([lat, lon]) => [lon * kx, lat * ky]);
  const zadrzi = new Uint8Array(tocke.length);
  zadrzi[0] = zadrzi[tocke.length - 1] = 1;

  const stog: [number, number][] = [[0, tocke.length - 1]];
  while (stog.length) {
    const [a, b] = stog.pop()!;
    let max = 0;
    let idx = -1;
    const [ax, ay] = xy[a];
    const [bx, by] = xy[b];
    const dx = bx - ax;
    const dy = by - ay;
    const d2 = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = xy[i];
      let t = d2 ? ((px - ax) * dx + (py - ay) * dy) / d2 : 0;
      t = Math.max(0, Math.min(1, t));
      const ex = ax + t * dx - px;
      const ey = ay + t * dy - py;
      const d = ex * ex + ey * ey;
      if (d > max) {
        max = d;
        idx = i;
      }
    }
    if (idx >= 0 && max > tolerancija * tolerancija) {
      zadrzi[idx] = 1;
      stog.push([a, idx], [idx, b]);
    }
  }
  return tocke.filter((_, i) => zadrzi[i]).map(zaokruzi);
}
