/**
 * Glatko kretanje vozila po karti.
 *
 * Feed javlja poziciju svakih ~20–30 s. Umjesto skakanja, vozilo se od
 * prikazane pozicije do nove vozi kroz vrijeme između dva javljanja – po
 * trasi linije, pa skreće po ulicama. Ne pogađa se unaprijed (nema vraćanja
 * unatrag kad bus stane na stajalištu); cijena je zaostatak od jednog javljanja.
 */

/** Trasa u metrima (lokalna ravnina oko Zagreba) s kumulativnom duljinom. */
export interface Trasa {
  tocke: [number, number][];
  x: Float64Array;
  y: Float64Array;
  d: Float64Array;
  duljina: number;
}

export interface Pozicija {
  lat: number;
  lon: number;
  /** Smjer kretanja u stupnjevima (0 = sjever, u smjeru kazaljke). */
  smjer: number;
}

const KX = 111_320 * Math.cos((45.81 * Math.PI) / 180);
const KY = 110_540;

/** Dalje od trase od ovoga = vozilo nije na trasi (garaža, obilazak). */
const MAX_OD_TRASE_M = 60;
/** Manji pomak unatrag na istoj vožnji je GPS šum – vozilo stoji. */
const SUM_UNATRAG_M = 80;
/** Veći skokovi se ne animiraju – vozilo se samo premjesti. */
const MAX_SKOK_M = 3_000;
const MIN_TRAJANJE_MS = 3_000;
const MAX_TRAJANJE_MS = 35_000;

export function napraviTrasu(tocke: [number, number][]): Trasa {
  const n = tocke.length;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const d = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = tocke[i][1] * KX;
    y[i] = tocke[i][0] * KY;
    if (i) d[i] = d[i - 1] + Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]);
  }
  return { tocke, x, y, d, duljina: n ? d[n - 1] : 0 };
}

/**
 * Najbliža točka na trasi: udaljenost od početka trase i koliko je pozicija
 * daleko od nje. S `oko` se prednost daje dijelu trase od malo iza do 2 km
 * ispred zadnje poznate pozicije – trase se znaju preklapati (okretište).
 */
export function projiciraj(
  t: Trasa,
  lat: number,
  lon: number,
  oko?: number,
): { d: number; razmak: number } {
  const px = lon * KX;
  const py = lat * KY;
  let najbolji = { d: 0, razmak: Infinity };
  let uProzoru = { d: 0, razmak: Infinity };

  for (let i = 0; i + 1 < t.x.length; i++) {
    const ax = t.x[i];
    const ay = t.y[i];
    const dx = t.x[i + 1] - ax;
    const dy = t.y[i + 1] - ay;
    const l2 = dx * dx + dy * dy;
    let k = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    k = k < 0 ? 0 : k > 1 ? 1 : k;
    const razmak = Math.hypot(ax + k * dx - px, ay + k * dy - py);
    const d = t.d[i] + k * (t.d[i + 1] - t.d[i]);
    if (razmak < najbolji.razmak) najbolji = { d, razmak };
    if (oko !== undefined && d >= oko - 150 && d <= oko + 2_000 && razmak < uProzoru.razmak) {
      uProzoru = { d, razmak };
    }
  }
  return uProzoru.razmak <= MAX_OD_TRASE_M ? uProzoru : najbolji;
}

/** Pozicija i smjer na `d` metara od početka trase. */
export function tockaNa(t: Trasa, d: number): Pozicija {
  const n = t.x.length;
  if (n === 1) return { lat: t.tocke[0][0], lon: t.tocke[0][1], smjer: 0 };
  d = Math.max(0, Math.min(t.duljina, d));
  // Binarno traženje segmenta.
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (t.d[mid] <= d) lo = mid;
    else hi = mid;
  }
  const seg = t.d[hi] - t.d[lo];
  const k = seg ? (d - t.d[lo]) / seg : 0;
  const x = t.x[lo] + k * (t.x[hi] - t.x[lo]);
  const y = t.y[lo] + k * (t.y[hi] - t.y[lo]);
  return { lat: y / KY, lon: x / KX, smjer: smjerIz(t.x[hi] - t.x[lo], t.y[hi] - t.y[lo]) };
}

function smjerIz(dx: number, dy: number): number {
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

/**
 * Udaljenost svakog stajališta od početka trase, redom. Trasa se zna vratiti
 * istim putem (okretište), pa se svako stajalište traži od prethodnog naprijed.
 */
export function stajalistaNaTrasi(t: Trasa, stajalista: { lat: number; lon: number }[]): number[] {
  const rez: number[] = [];
  let zadnje = 0;
  for (const s of stajalista) {
    const px = s.lon * KX;
    const py = s.lat * KY;
    let najbolji = { d: zadnje, razmak: Infinity };
    for (let i = 0; i + 1 < t.x.length; i++) {
      if (t.d[i + 1] < zadnje) continue;
      const ax = t.x[i];
      const ay = t.y[i];
      const dx = t.x[i + 1] - ax;
      const dy = t.y[i + 1] - ay;
      const l2 = dx * dx + dy * dy;
      let k = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
      k = k < 0 ? 0 : k > 1 ? 1 : k;
      const razmak = Math.hypot(ax + k * dx - px, ay + k * dy - py);
      const d = Math.max(zadnje, t.d[i] + k * (t.d[i + 1] - t.d[i]));
      if (razmak < najbolji.razmak) najbolji = { d, razmak };
      // Prvi prolaz pokraj stajališta je pravi – ne traži dalje (povratak istim putem).
      if (najbolji.razmak <= 40 && razmak > 150) break;
    }
    rez.push(najbolji.d);
    zadnje = najbolji.d;
  }
  return rez;
}

/** Bus je "na stajalištu" ako je bliže od ovoga. */
const NA_STAJALISTU_M = 25;

/**
 * Indeks sljedećeg stajališta za vozilo na `d` metara trase, i je li vozilo
 * upravo na tom stajalištu. null = prošao je zadnje.
 */
export function sljedeceStajaliste(
  udaljenosti: number[],
  d: number,
): { indeks: number; naStajalistu: boolean } | null {
  for (let i = 0; i < udaljenosti.length; i++) {
    if (udaljenosti[i] >= d - NA_STAJALISTU_M) {
      return { indeks: i, naStajalistu: Math.abs(udaljenosti[i] - d) <= NA_STAJALISTU_M };
    }
  }
  return null;
}

/** Ulaz za jedno vozilo (podskup VoziloKarta). */
export interface Javljanje {
  id: string;
  lat: number;
  lon: number;
  ts: number;
  oblik: string | null;
}

interface Stanje {
  ts: number;
  oblik: string | null;
  /** Animacija po trasi (od/do = metri) ili ravno (od/do = lat/lon). */
  poTrasi: boolean;
  odD: number;
  doD: number;
  od: Pozicija;
  do: Pozicija;
  pocetak: number;
  trajanje: number;
  smjer: number;
}

export class Kretanje {
  private trase = new Map<string, Trasa>();
  private stanja = new Map<string, Stanje>();

  imaTrasu(id: string): boolean {
    return this.trase.has(id);
  }

  dodajTrasu(id: string, tocke: [number, number][]): void {
    if (tocke.length) this.trase.set(id, napraviTrasu(tocke));
  }

  trasa(id: string | null): Trasa | undefined {
    return id ? this.trase.get(id) : undefined;
  }

  /** Nova javljanja; vozila kojih više nema se brišu. */
  azuriraj(javljanja: Javljanje[], sad: number): void {
    const vidjeni = new Set<string>();
    for (const j of javljanja) {
      vidjeni.add(j.id);
      const s = this.stanja.get(j.id);
      if (s && s.ts === j.ts && s.oblik === j.oblik) continue;
      this.stanja.set(j.id, this.novoStanje(j, s, sad));
    }
    for (const id of this.stanja.keys()) if (!vidjeni.has(id)) this.stanja.delete(id);
  }

  /** Gdje je vozilo sad na ekranu. */
  pozicija(id: string, sad: number): Pozicija | null {
    const s = this.stanja.get(id);
    return s ? this.izracunaj(s, sad) : null;
  }

  /** Koliko je metara vozilo (kako je prikazano) od početka trase; null = nije na trasi. */
  naTrasi(id: string, sad: number): number | null {
    const s = this.stanja.get(id);
    if (!s || !s.poTrasi || !this.trasa(s.oblik)) return null;
    const k = s.trajanje ? Math.max(0, Math.min(1, (sad - s.pocetak) / s.trajanje)) : 1;
    return s.odD + k * (s.doD - s.odD);
  }

  private izracunaj(s: Stanje, sad: number): Pozicija {
    const k = s.trajanje ? Math.max(0, Math.min(1, (sad - s.pocetak) / s.trajanje)) : 1;
    const t = s.poTrasi ? this.trasa(s.oblik) : undefined;
    if (t) {
      // Na trasi je smjer uvijek smjer trase – i kad vozilo stoji.
      return tockaNa(t, s.odD + k * (s.doD - s.odD));
    }
    return {
      lat: s.od.lat + k * (s.do.lat - s.od.lat),
      lon: s.od.lon + k * (s.do.lon - s.od.lon),
      smjer: s.smjer,
    };
  }

  private novoStanje(j: Javljanje, s: Stanje | undefined, sad: number): Stanje {
    const t = this.trasa(j.oblik);
    const istaTrasa = !!s && s.oblik === j.oblik && s.poTrasi;
    const proj = t ? projiciraj(t, j.lat, j.lon, istaTrasa ? s!.doD : undefined) : null;
    const naTrasi = !!proj && proj.razmak <= MAX_OD_TRASE_M;
    const trajanje = s
      ? Math.max(MIN_TRAJANJE_MS, Math.min(MAX_TRAJANJE_MS, (j.ts - s.ts) * 1000))
      : 0;
    const sada = s ? this.izracunaj(s, sad) : null;

    if (t && naTrasi) {
      let cilj = proj!.d;
      let odD = cilj;
      let anim = false;
      if (s && istaTrasa) {
        const trenutno = s.odD + Math.min(1, (sad - s.pocetak) / (s.trajanje || 1)) * (s.doD - s.odD);
        if (cilj < trenutno && trenutno - cilj < SUM_UNATRAG_M) cilj = trenutno;
        if (cilj >= trenutno && cilj - trenutno <= MAX_SKOK_M) {
          odD = trenutno;
          anim = true;
        }
      }
      const p = tockaNa(t, cilj);
      return {
        ts: j.ts,
        oblik: j.oblik,
        poTrasi: true,
        odD,
        doD: cilj,
        od: p,
        do: p,
        pocetak: sad,
        trajanje: anim ? trajanje : 0,
        smjer: p.smjer,
      };
    }

    // Bez trase: ravno od prikazane do nove pozicije, ako nije predaleko.
    const cilj: Pozicija = { lat: j.lat, lon: j.lon, smjer: s?.smjer ?? 0 };
    let od = cilj;
    let anim = false;
    if (sada) {
      const dx = (j.lon - sada.lon) * KX;
      const dy = (j.lat - sada.lat) * KY;
      const m = Math.hypot(dx, dy);
      if (m <= MAX_SKOK_M) {
        od = sada;
        anim = m > 0;
      }
      if (m > 5) cilj.smjer = smjerIz(dx, dy);
    }
    return {
      ts: j.ts,
      oblik: j.oblik,
      poTrasi: false,
      odD: 0,
      doD: 0,
      od,
      do: cilj,
      pocetak: sad,
      trajanje: anim ? trajanje : 0,
      smjer: cilj.smjer,
    };
  }
}
