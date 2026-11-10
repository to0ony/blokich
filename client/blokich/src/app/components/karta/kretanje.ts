/**
 * Glatko i točno kretanje vozila po karti.
 *
 * Vozilo javlja poziciju otprilike svakih 11 s (ponekad 20 s), a na kartu
 * stiže s ~15 s kašnjenja i nepravilno. Umjesto da se svaka nova točka
 * animira od trenutka kad stigne (pa bus stane i čeka sljedeću), svako
 * vozilo ima svoj "sat reprodukcije" koji kasni malo iza zadnjeg javljanja –
 * kao video s međuspremnikom. Između dva stvarna javljanja vozilo vozi po
 * trasi linije, brzinom iz podataka: stoji kad je stvarno stajalo, ubrzava
 * kad je ubrzalo. Ništa se ne pogađa unaprijed.
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
/** Veći skokovi se ne voze – vozilo se premjesti. */
const MAX_SKOK_M = 3_000;
/**
 * Koliko sekundi reprodukcija kasni iza zadnjeg javljanja. Pokriva i duže
 * razmake između javljanja (p90 ~20 s), pa vozilo ne stane čekajući podatke.
 */
const MEDUSPREMNIK_S = 20;
/** Koliko javljanja po vozilu pamtimo. */
const MAX_UZORAKA = 8;

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

/** Najkraći kut od a do b (−180…180). */
function razlikaKuta(a: number, b: number): number {
  return ((b - a + 540) % 360) - 180;
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
  /** Kad je vozilo javilo poziciju (unix sekunde). */
  ts: number;
  oblik: string | null;
}

interface Uzorak {
  t: number;
  lat: number;
  lon: number;
  /** Metri po trasi; null = izvan trase. */
  d: number | null;
}

interface Stanje {
  oblik: string | null;
  uzorci: Uzorak[];
  /** Procjena: lokalno vrijeme (s) − vrijeme javljanja. Pokriva kašnjenje feeda i razliku satova. */
  pomak: number;
  /** Vrijeme reprodukcije (u vremenu javljanja, s). */
  sat: number;
  /** Lokalno vrijeme zadnjeg pomaka sata (ms). */
  zadnje: number;
  smjer: number;
  /** Zadnja izračunata pozicija po trasi (za sljedeće stajalište). */
  d: number | null;
}

export class Kretanje {
  private trase = new Map<string, Trasa>();
  private stanja = new Map<string, Stanje>();

  imaTrasu(id: string): boolean {
    return this.trase.has(id);
  }

  dodajTrasu(id: string, tocke: [number, number][]): void {
    if (!tocke.length) return;
    const t = napraviTrasu(tocke);
    this.trase.set(id, t);
    // Vozila koja su već vozila bez ove trase: smjesti njihova javljanja na nju.
    for (const s of this.stanja.values()) {
      if (s.oblik !== id) continue;
      let prethodno: number | undefined;
      for (const u of s.uzorci) {
        const p = projiciraj(t, u.lat, u.lon, prethodno);
        u.d = p.razmak <= MAX_OD_TRASE_M ? Math.max(p.d, prethodno ?? 0) : null;
        if (u.d !== null) prethodno = u.d;
      }
    }
  }

  trasa(id: string | null): Trasa | undefined {
    return id ? this.trase.get(id) : undefined;
  }

  /** Nova javljanja (sad = lokalno vrijeme u ms); vozila kojih više nema se brišu. */
  azuriraj(javljanja: Javljanje[], sad: number): void {
    const vidjeni = new Set<string>();
    for (const j of javljanja) {
      vidjeni.add(j.id);
      this.dodaj(j, sad);
    }
    for (const id of this.stanja.keys()) if (!vidjeni.has(id)) this.stanja.delete(id);
  }

  /** Gdje je vozilo sad na ekranu. Pomiče sat reprodukcije – zove se svaki frame. */
  pozicija(id: string, sad: number): Pozicija | null {
    const s = this.stanja.get(id);
    if (!s) return null;
    this.pomakniSat(s, sad);
    return this.izracunaj(s);
  }

  /** Metri po trasi na kojima je vozilo zadnji put nacrtano; null = nije na trasi. */
  naTrasi(id: string): number | null {
    return this.stanja.get(id)?.d ?? null;
  }

  private dodaj(j: Javljanje, sad: number): void {
    const s = this.stanja.get(j.id);
    const t = this.trasa(j.oblik);
    const sadS = sad / 1000;

    // Prvo javljanje ili nova vožnja: kreni od nule.
    if (!s || s.oblik !== j.oblik) {
      const d = t ? this.naTrasu(t, j) : null;
      this.stanja.set(j.id, {
        oblik: j.oblik,
        uzorci: [{ t: j.ts, lat: j.lat, lon: j.lon, d }],
        pomak: sadS - j.ts,
        sat: j.ts,
        zadnje: sad,
        smjer: s?.smjer ?? (t && d !== null ? tockaNa(t, d).smjer : 0),
        d,
      });
      return;
    }

    const zadnji = s.uzorci[s.uzorci.length - 1];
    if (j.ts <= zadnji.t) return; // isto ili starije javljanje

    // Kašnjenje feeda se mijenja polako – izgladi ga.
    s.pomak = s.pomak * 0.8 + (sadS - j.ts) * 0.2;

    let d = t ? this.naTrasu(t, j, zadnji.d ?? undefined) : null;
    if (d !== null && zadnji.d !== null) {
      if (d < zadnji.d && zadnji.d - d < SUM_UNATRAG_M) d = zadnji.d; // stoji, GPS šeta
      if (d < zadnji.d - SUM_UNATRAG_M || d - zadnji.d > MAX_SKOK_M) {
        // Skok (GPS se vratio, krug na okretištu): premjesti bez vožnje.
        s.uzorci = [{ t: j.ts, lat: j.lat, lon: j.lon, d }];
        s.sat = j.ts;
        return;
      }
    } else {
      const m = Math.hypot((j.lon - zadnji.lon) * KX, (j.lat - zadnji.lat) * KY);
      if (m > MAX_SKOK_M) {
        s.uzorci = [{ t: j.ts, lat: j.lat, lon: j.lon, d }];
        s.sat = j.ts;
        return;
      }
    }

    s.uzorci.push({ t: j.ts, lat: j.lat, lon: j.lon, d });
    if (s.uzorci.length > MAX_UZORAKA) s.uzorci.shift();
  }

  private naTrasu(t: Trasa, j: Javljanje, oko?: number): number | null {
    const p = projiciraj(t, j.lat, j.lon, oko);
    return p.razmak <= MAX_OD_TRASE_M ? p.d : null;
  }

  /**
   * Sat reprodukcije teče kao pravo vrijeme, a lagano se primiče cilju
   * (zadnje javljanje − međuspremnik). Ne ide unatrag i ne prelazi zadnje
   * javljanje – tada vozilo stoji gdje je zadnje javljeno.
   */
  private pomakniSat(s: Stanje, sad: number): void {
    const dt = Math.max(0, Math.min(1, (sad - s.zadnje) / 1000));
    s.zadnje = sad;
    const cilj = sad / 1000 - s.pomak - MEDUSPREMNIK_S;
    const prvi = s.uzorci[0].t;
    const zadnji = s.uzorci[s.uzorci.length - 1].t;

    if (Math.abs(cilj - s.sat) > 60) {
      s.sat = cilj; // tab je bio u pozadini – ne vozi minutu ubrzano
    } else {
      // Kad ponestaje podataka, sat usporava umjesto da vozilo naglo stane.
      const preostalo = zadnji - s.sat;
      const brzina = preostalo < 6 ? Math.max(0.2, preostalo / 6) : 1;
      // Pravo vrijeme + blago primicanje cilju (~5 s da se razlika prepolovi).
      s.sat += dt * brzina + (cilj - s.sat) * Math.min(1, dt * 0.14);
    }
    s.sat = Math.max(prvi, Math.min(zadnji, s.sat));

    // Stariji uzorci više ne trebaju.
    while (s.uzorci.length > 2 && s.uzorci[1].t <= s.sat) s.uzorci.shift();
  }

  private izracunaj(s: Stanje): Pozicija {
    const u = s.uzorci;
    let a = u[0];
    let b = u[0];
    for (let i = 0; i + 1 < u.length; i++) {
      if (u[i + 1].t >= s.sat) {
        a = u[i];
        b = u[i + 1];
        break;
      }
      a = b = u[i + 1];
    }
    const k = b.t > a.t ? Math.max(0, Math.min(1, (s.sat - a.t) / (b.t - a.t))) : 1;
    const t = this.trasa(s.oblik);

    let p: Pozicija;
    if (t && a.d !== null && b.d !== null) {
      const d = a.d + k * (b.d - a.d);
      s.d = d;
      p = tockaNa(t, d);
      // Kad stoji, ne okreći se.
      if (b.d - a.d < 1) p.smjer = s.smjer;
    } else {
      s.d = null;
      const dx = (b.lon - a.lon) * KX;
      const dy = (b.lat - a.lat) * KY;
      p = {
        lat: a.lat + k * (b.lat - a.lat),
        lon: a.lon + k * (b.lon - a.lon),
        smjer: Math.hypot(dx, dy) > 5 ? smjerIz(dx, dy) : s.smjer,
      };
    }
    // Glatko okretanje – bez naglog skretanja na lomu trase.
    s.smjer = (s.smjer + razlikaKuta(s.smjer, p.smjer) * 0.25 + 360) % 360;
    return { lat: p.lat, lon: p.lon, smjer: s.smjer };
  }
}
