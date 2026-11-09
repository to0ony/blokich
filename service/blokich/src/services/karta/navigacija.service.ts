import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { GtfsStatickiService, Oblik, StajalisteGtfs } from './gtfs-staticki.service';

/** Vrsta manevra – kako ga crta i izgovara navigacija. */
export type TipManevra =
  | 'lijevo'
  | 'desno'
  | 'blago-lijevo'
  | 'blago-desno'
  | 'ostro-lijevo'
  | 'ostro-desno'
  | 'polukruzno'
  | 'kruzni';

export interface Manevar {
  /** Metri od početka trase. */
  d: number;
  tip: TipManevra;
  /** Ulica u koju se skreće (samo iz OSRM-a). */
  ulica: string | null;
  /** Izlaz s kružnog toka. */
  izlaz?: number;
}

export interface NavigacijaTrase {
  /** 'osrm' = skretanja s imenima ulica; 'geometrija' = iz oblika trase, bez imena. */
  izvor: 'osrm' | 'geometrija';
  manevri: Manevar[];
}

const KX = 111_320 * Math.cos((45.81 * Math.PI) / 180);
const KY = 110_540;
/** OSRM ruta smije od trase odstupati najviše ovoliko – inače joj ne vjerujemo. */
const MAX_OD_TRASE_M = 40;
/** Udio OSRM rute izvan trase iznad kojeg se koristi geometrija. */
const MAX_UDIO_IZVAN = 0.05;
const MAX_CACHE = 400;

// ---------- Geometrija ----------

interface Ravnina {
  x: number[];
  y: number[];
  d: number[];
}

function uRavninu(tocke: Oblik): Ravnina {
  const x: number[] = [];
  const y: number[] = [];
  const d: number[] = [];
  tocke.forEach(([lat, lon], i) => {
    x.push(lon * KX);
    y.push(lat * KY);
    d.push(i ? d[i - 1] + Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]) : 0);
  });
  return { x, y, d };
}

/** Točka na `d` metara trase. */
function tockaNa(r: Ravnina, d: number): [number, number] {
  const n = r.d.length;
  if (d <= 0) return [r.x[0], r.y[0]];
  if (d >= r.d[n - 1]) return [r.x[n - 1], r.y[n - 1]];
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (r.d[m] <= d) lo = m;
    else hi = m;
  }
  const k = (d - r.d[lo]) / (r.d[hi] - r.d[lo] || 1);
  return [r.x[lo] + k * (r.x[hi] - r.x[lo]), r.y[lo] + k * (r.y[hi] - r.y[lo])];
}

/** Smjer (stupnjevi, 0 = sjever) od a do b. */
function smjer(a: [number, number], b: [number, number]): number {
  return ((Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI + 360) % 360;
}

function razlikaKuta(a: number, b: number): number {
  return ((b - a + 540) % 360) - 180;
}

/** Najbliža točka na trasi, tražeći od `od` naprijed; vraća metre i razmak. */
export function naTrasi(r: Ravnina, lat: number, lon: number, od = 0): { d: number; razmak: number } {
  const px = lon * KX;
  const py = lat * KY;
  let najbolji = { d: od, razmak: Infinity };
  for (let i = 0; i + 1 < r.x.length; i++) {
    if (r.d[i + 1] < od) continue;
    const dx = r.x[i + 1] - r.x[i];
    const dy = r.y[i + 1] - r.y[i];
    const l2 = dx * dx + dy * dy;
    let k = l2 ? ((px - r.x[i]) * dx + (py - r.y[i]) * dy) / l2 : 0;
    k = k < 0 ? 0 : k > 1 ? 1 : k;
    const razmak = Math.hypot(r.x[i] + k * dx - px, r.y[i] + k * dy - py);
    const d = Math.max(od, r.d[i] + k * (r.d[i + 1] - r.d[i]));
    if (razmak < najbolji.razmak) najbolji = { d, razmak };
    // Prvi prolaz je pravi (trasa se zna vratiti istim putem).
    if (najbolji.razmak <= MAX_OD_TRASE_M && razmak > 150) break;
  }
  return najbolji;
}

function tipIzKuta(kut: number): TipManevra {
  const a = Math.abs(kut);
  const desno = kut > 0;
  if (a > 160) return 'polukruzno';
  if (a > 125) return desno ? 'ostro-desno' : 'ostro-lijevo';
  if (a < 55) return desno ? 'blago-desno' : 'blago-lijevo';
  return desno ? 'desno' : 'lijevo';
}

/**
 * Skretanja iz same trase: gdje se smjer na ~25 m prije i poslije točke
 * razlikuje za više od 35°. Bez imena ulica, ali radi bez ikakvog servisa.
 */
export function geometrijskiManevri(tocke: Oblik): Manevar[] {
  if (tocke.length < 3) return [];
  const r = uRavninu(tocke);
  const duljina = r.d[r.d.length - 1];
  const KORAK = 10;
  const PROZOR = 25;
  const kandidati: { d: number; kut: number }[] = [];
  for (let d = PROZOR + 20; d <= duljina - PROZOR - 20; d += KORAK) {
    const a = tockaNa(r, d - PROZOR);
    const b = tockaNa(r, d);
    const c = tockaNa(r, d + PROZOR);
    const kut = razlikaKuta(smjer(a, b), smjer(b, c));
    if (Math.abs(kut) >= 35) kandidati.push({ d, kut });
  }
  // Susjedni uzorci istog skretanja → jedan manevar s najvećim kutom.
  const rez: Manevar[] = [];
  let grupa: { d: number; kut: number }[] = [];
  const zatvori = () => {
    if (!grupa.length) return;
    const naj = grupa.reduce((x, y) => (Math.abs(y.kut) > Math.abs(x.kut) ? y : x));
    rez.push({ d: Math.round(naj.d), tip: tipIzKuta(naj.kut), ulica: null });
    grupa = [];
  };
  for (const k of kandidati) {
    if (grupa.length && k.d - grupa[grupa.length - 1].d > 40) zatvori();
    grupa.push(k);
  }
  zatvori();
  return rez;
}

// ---------- OSRM ----------

function tipIzOsrm(type: string, modifier: string | undefined): TipManevra | null {
  if (type === 'roundabout' || type === 'rotary' || type === 'roundabout turn') return 'kruzni';
  switch (modifier) {
    case 'left':
      return 'lijevo';
    case 'right':
      return 'desno';
    case 'slight left':
      return 'blago-lijevo';
    case 'slight right':
      return 'blago-desno';
    case 'sharp left':
      return 'ostro-lijevo';
    case 'sharp right':
      return 'ostro-desno';
    case 'uturn':
      return 'polukruzno';
    default:
      return null;
  }
}

/** Manevri iz OSRM ruta (po dijelovima) smješteni na GTFS trasu. null = ruta se ne poklapa s trasom. */
export function osrmManevri(tocke: Oblik, rute: any[]): Manevar[] | null {
  const r = uRavninu(tocke);
  let izvan = 0;
  let ukupno = 0;
  const rez: Manevar[] = [];
  let zadnji = 0;

  for (const ruta of rute) {
    for (const [lon, lat] of ruta?.geometry?.coordinates ?? []) {
      ukupno++;
      if (naTrasi(r, lat, lon).razmak > MAX_OD_TRASE_M) izvan++;
    }
    for (const leg of ruta?.legs ?? []) {
      for (const s of leg.steps ?? []) {
        const m = s.maneuver ?? {};
        if (m.type === 'depart' || m.type === 'arrive') continue;
        const tip = tipIzOsrm(m.type, m.modifier);
        if (!tip) continue;
        // "Nastavi ravno"/"novo ime" bez skretanja nije manevar.
        if (m.type === 'new name' && tip.startsWith('blago')) continue;
        const [lon, lat] = m.location ?? [];
        if (typeof lat !== 'number') continue;
        const p = naTrasi(r, lat, lon, Math.max(0, zadnji - 30));
        if (p.razmak > MAX_OD_TRASE_M) continue;
        // Isto skretanje na spoju dva dijela rute – ne dvaput.
        if (rez.length && p.d - rez[rez.length - 1].d < 15) continue;
        zadnji = p.d;
        const man: Manevar = { d: Math.round(p.d), tip, ulica: s.name || s.ref || null };
        if (tip === 'kruzni' && m.exit) man.izlaz = m.exit;
        rez.push(man);
      }
    }
  }
  if (!ukupno || izvan / ukupno > MAX_UDIO_IZVAN) return null;
  return rez;
}

/**
 * Navigacija po trasi linije. S vlastitim OSRM-om (OSRM_URL) skretanja imaju
 * imena ulica: ruta se traži kroz stajališta trase redom i provjerava se da
 * ide istim putem kao trasa. Bez OSRM-a (ili kad ruta skrene s trase) skretanja
 * se računaju iz oblika trase.
 */
@Injectable()
export class NavigacijaService {
  private readonly logger = new Logger(NavigacijaService.name);
  private readonly cache = new Map<string, Promise<NavigacijaTrase>>();

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly gtfs: GtfsStatickiService,
  ) {}

  navigacija(oblik: string): Promise<NavigacijaTrase> | null {
    const g = this.gtfs.get();
    const tocke = g?.oblici.get(oblik);
    if (!g || !tocke) return null;
    const kljuc = `${g.verzija}:${oblik}`;
    let p = this.cache.get(kljuc);
    if (!p) {
      const stajalista = (g.stajalistaOblika.get(oblik) ?? [])
        .map((id) => g.stajalista.get(id))
        .filter((s): s is StajalisteGtfs => !!s);
      p = this.izracunaj(oblik, tocke, stajalista);
      if (this.cache.size >= MAX_CACHE) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(kljuc, p);
      // Neuspjeh OSRM-a ne pamtimo zauvijek – sljedeći put probaj opet.
      p.then((n) => n.izvor === 'geometrija' && this.osrmUrl && this.cache.delete(kljuc));
    }
    return p;
  }

  private get osrmUrl(): string | null {
    return (this.config.get<string>('OSRM_URL') || '').replace(/\/+$/, '') || null;
  }

  private async izracunaj(
    oblik: string,
    tocke: Oblik,
    stajalista: StajalisteGtfs[],
  ): Promise<NavigacijaTrase> {
    const url = this.osrmUrl;
    if (url && stajalista.length >= 2) {
      try {
        const rute = await this.osrmRute(url, tocke, stajalista);
        const manevri = osrmManevri(tocke, rute);
        if (manevri) return { izvor: 'osrm', manevri };
        this.logger.warn(`OSRM ruta za ${oblik} ne prati trasu – skretanja iz geometrije.`);
      } catch (err: any) {
        this.logger.warn(`OSRM nedostupan za ${oblik}: ${err?.message}`);
      }
    }
    return { izvor: 'geometrija', manevri: geometrijskiManevri(tocke) };
  }

  /** Ruta kroz početak trase, sva stajališta i kraj trase, u dijelovima (ograničenje broja točaka). */
  private async osrmRute(url: string, tocke: Oblik, stajalista: StajalisteGtfs[]): Promise<any[]> {
    const max = Math.max(3, Number(this.config.get<string>('OSRM_MAX_TOCAKA')) || 25);
    const [p0, pN] = [tocke[0], tocke[tocke.length - 1]];
    const sve: [number, number][] = [
      [p0[1], p0[0]],
      ...stajalista.map((s) => [s.lon, s.lat] as [number, number]),
      [pN[1], pN[0]],
    ];
    const rute: any[] = [];
    for (let i = 0; i < sve.length - 1; i += max - 1) {
      const dio = sve.slice(i, i + max);
      if (dio.length < 2) break;
      const coords = dio.map(([lon, lat]) => `${lon.toFixed(6)},${lat.toFixed(6)}`).join(';');
      const res = await firstValueFrom(
        this.http.get(`${url}/route/v1/driving/${coords}`, {
          params: { steps: 'true', overview: 'full', geometries: 'geojson', continue_straight: 'true' },
          timeout: 15_000,
        }),
      );
      const ruta = (res.data as any)?.routes?.[0];
      if (!ruta) throw new Error((res.data as any)?.code ?? 'bez rute');
      rute.push(ruta);
    }
    return rute;
  }
}
