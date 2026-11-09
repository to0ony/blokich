import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

/** Zatvorena cesta (linija) ili gradski radovi (točka) – GeoJSON za kartu. */
export interface RadoviSvojstva {
  vrsta: 'zatvaranje' | 'radovi';
  naslov: string;
  opis: string | null;
  /** ISO; null = nepoznato. */
  od: string | null;
  do: string | null;
  /** Za zatvaranja: BOTH_DIRECTIONS / ONE_DIRECTION. */
  smjer: string | null;
  url: string | null;
  /** Zatvaranje je sad na snazi (ili još nije počelo). */
  aktivno: boolean;
}

export interface RadoviFeature {
  type: 'Feature';
  properties: RadoviSvojstva;
  geometry:
    | { type: 'LineString'; coordinates: [number, number][] }
    | { type: 'Point'; coordinates: [number, number] };
}

export interface RadoviOdgovor {
  type: 'FeatureCollection';
  features: RadoviFeature[];
}

/** Grad Zagreb, data.zagreb.hr – "Zatvaranje prometnica" (Waze CIFS format). */
const ZATVARANJA_URL =
  'https://data.zagreb.hr/dataset/7ff5514d-0a1f-4f6c-86bd-8ed9a3c55eee/resource/e48b6992-add0-45a1-ae95-c5d97d8db259/download/data.json';
/** Grad Zagreb, regulacije.zagreb.hr – "Gradski radovi" (ArcGIS). */
const RADOVI_URL =
  'https://services8.arcgis.com/Usi0jGQwMmBUpFjr/arcgis/rest/services/Regulacije_view/FeatureServer/0/query' +
  '?where=1%3D1&outFields=status,Naslov,podnaslov,url&outSR=4326&f=geojson';

const CACHE_MS = 15 * 60 * 1000;
/** Zatvaranja koja počinju u idućih toliko dana se već prikazuju. */
const UNAPRIJED_MS = 3 * 24 * 60 * 60 * 1000;

/** "45.79 16.02 45.80 16.03" -> [[lon, lat], ...] */
export function parsirajPolyline(p: string): [number, number][] {
  const brojevi = (p ?? '').trim().split(/\s+/).map(Number);
  const rez: [number, number][] = [];
  for (let i = 0; i + 1 < brojevi.length; i += 2) {
    const [lat, lon] = [brojevi[i], brojevi[i + 1]];
    if (Number.isFinite(lat) && Number.isFinite(lon)) rez.push([lon, lat]);
  }
  return rez;
}

export function obradiZatvaranja(podaci: any[], sad: number): RadoviFeature[] {
  const rez: RadoviFeature[] = [];
  for (const z of Array.isArray(podaci) ? podaci : []) {
    const koordinate = parsirajPolyline(z?.polyline);
    if (koordinate.length < 2) continue;
    const od = z.expectedStartTime ? Date.parse(z.expectedStartTime) : NaN;
    const doo = z.expectedEndTime ? Date.parse(z.expectedEndTime) : NaN;
    if (Number.isFinite(doo) && doo < sad) continue;
    if (Number.isFinite(od) && od - UNAPRIJED_MS > sad) continue;
    rez.push({
      type: 'Feature',
      properties: {
        vrsta: 'zatvaranje',
        naslov: z.street || 'Zatvorena cesta',
        opis: z.description || null,
        od: Number.isFinite(od) ? new Date(od).toISOString() : null,
        do: Number.isFinite(doo) ? new Date(doo).toISOString() : null,
        smjer: z.direction || null,
        url: null,
        aktivno: !Number.isFinite(od) || od <= sad,
      },
      geometry: { type: 'LineString', coordinates: koordinate },
    });
  }
  return rez;
}

function bezHtml(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*/g, '\n')
    .trim();
}

const MJESECI: Record<string, number> = {
  sijecnja: 1, veljace: 2, ozujka: 3, travnja: 4, svibnja: 5, lipnja: 6,
  srpnja: 7, kolovoza: 8, rujna: 9, listopada: 10, studenoga: 11, studenog: 11, prosinca: 12,
};

function bezKvacica(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
}

/**
 * Procjena kraja radova iz slobodnog teksta: "do 7. prosinca", "do 4.4.2026.",
 * "tijekom rujna". Bez godine = godina iz `sad`. null = ne zna se.
 */
export function procijeniKraj(tekst: string, sad: Date): Date | null {
  const t = bezKvacica(tekst).replace(/[^\x20-\x7e\n]/g, ' ');
  const i = t.indexOf('kada?');
  const dio = (i >= 0 ? t.slice(i, i + 160) : t.slice(0, 160)).replace(/\s+/g, ' ');
  const godina = sad.getUTCFullYear();
  const kraj = (g: number, m: number, d?: number) =>
    d ? new Date(Date.UTC(g, m - 1, d, 23, 59)) : new Date(Date.UTC(g, m, 0, 23, 59));

  let m = /\bdo (\d{1,2})\. ?(\d{1,2})\.(?: ?(\d{4}))?/.exec(dio);
  if (m) return kraj(m[3] ? +m[3] : godina, +m[2], +m[1]);
  m = /\bdo (\d{1,2})\. ([a-z]+)(?: (\d{4}))?/.exec(dio);
  if (m && MJESECI[m[2]]) return kraj(m[3] ? +m[3] : godina, MJESECI[m[2]], +m[1]);
  m = /\bdo ([a-z]+)(?: (\d{4}))?/.exec(dio);
  if (m && MJESECI[m[1]]) return kraj(m[2] ? +m[2] : godina, MJESECI[m[1]]);
  m =/\btijekom ([a-z]+)(?: (\d{4}))?/.exec(dio);
  if (m && MJESECI[m[1]]) return kraj(m[2] ? +m[2] : godina, MJESECI[m[1]]);
  return null;
}

/**
 * Gradski radovi. Status u izvoru je neuredan, pa se završeni prepoznaju i
 * po tekstu ("Radovi su završeni", "puštena u promet", prošao rok iz "Kada?").
 */
export function obradiRadove(geojson: any, sad = new Date()): RadoviFeature[] {
  const rez: RadoviFeature[] = [];
  for (const f of geojson?.features ?? []) {
    const p = f?.properties ?? {};
    const c = f?.geometry?.coordinates;
    if (f?.geometry?.type !== 'Point' || !Array.isArray(c)) continue;
    const status = String(p.status ?? '').trim().toLowerCase();
    const naslov = String(p.Naslov ?? '').trim();
    const opis = bezHtml(p.podnaslov);
    if (!naslov || status === 'završeno' || /^\d{4}$/.test(status)) continue;
    if (/završen|puštena u promet|pušten u promet/i.test(opis.slice(0, 200))) continue;
    // Naslov s prošlom godinom ("Blagdan Svih svetih 2025.").
    const godinaNaslova = /\b(20\d{2})\b/.exec(naslov);
    if (godinaNaslova && +godinaNaslova[1] < sad.getUTCFullYear()) continue;
    const kraj = procijeniKraj(opis, sad);
    if (kraj && kraj.getTime() < sad.getTime()) continue;
    rez.push({
      type: 'Feature',
      properties: {
        vrsta: 'radovi',
        naslov,
        opis: opis || null,
        od: null,
        do: kraj ? kraj.toISOString() : null,
        smjer: null,
        url: p.url || null,
        aktivno: status !== 'planirano',
      },
      geometry: { type: 'Point', coordinates: [Number(c[0]), Number(c[1])] },
    });
  }
  return rez;
}

/** Radovi i zatvorene ceste u Zagrebu iz gradskih otvorenih podataka. */
@Injectable()
export class RadoviService {
  private readonly logger = new Logger(RadoviService.name);
  private cache: { do: number; podaci: Promise<RadoviOdgovor> } | null = null;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  radovi(): Promise<RadoviOdgovor> {
    const sad = Date.now();
    if (!this.cache || this.cache.do < sad) {
      this.cache = { do: sad + CACHE_MS, podaci: this.ucitaj() };
    }
    return this.cache.podaci;
  }

  private async ucitaj(): Promise<RadoviOdgovor> {
    const [zatvaranja, radovi] = await Promise.all([
      this.dohvati(this.config.get<string>('ZG_ZATVARANJA_URL') || ZATVARANJA_URL)
        .then((d) => obradiZatvaranja(d, Date.now()))
        .catch((err) => {
          this.logger.warn(`Zatvaranja prometnica nedostupna: ${err?.message}`);
          return [] as RadoviFeature[];
        }),
      this.dohvati(this.config.get<string>('ZG_RADOVI_URL') || RADOVI_URL)
        .then((d) => obradiRadove(d))
        .catch((err) => {
          this.logger.warn(`Gradski radovi nedostupni: ${err?.message}`);
          return [] as RadoviFeature[];
        }),
    ]);
    return { type: 'FeatureCollection', features: [...zatvaranja, ...radovi] };
  }

  private async dohvati(url: string): Promise<any> {
    const res = await firstValueFrom(this.http.get(url, { timeout: 20_000 }));
    return res.data;
  }
}
