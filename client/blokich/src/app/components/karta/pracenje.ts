/**
 * Praćenje vozača po trasi iz GPS-a telefona – odluke o tome gdje je na
 * trasi, bez karte i Angulara (zbog testova).
 *
 * - Fiks lošiji od 40 m se ne koristi.
 * - Ako trasa istom ulicom prolazi dvaput (gore pa dolje, petlja na
 *   okretištu), odluka čeka da se vozač pomakne i uzima prolaz koji ide u
 *   smjeru kretanja.
 * - Vožnja suprotno od trase i odlazak s trase se prijavljuju, da navigacija
 *   može ponuditi drugi smjer linije ili put do rute.
 */
import { Trasa, projiciraj, tockaNa } from './kretanje';

const KX = 111_320 * Math.cos((45.81 * Math.PI) / 180);
const KY = 110_540;

/** Fiks lošiji od ovoga se ne koristi za položaj na trasi. */
export const MAX_NETOCNOST_M = 40;
/** Dalje od trase od ovoga = nije na trasi. */
export const IZVAN_RUTE_M = 60;
/** Smjer kretanja se računa tek kad se vozač pomakne barem ovoliko. */
const POMAK_ZA_SMJER_M = 15;
/** Smjer kretanja i trase se "slažu" ako se razlikuju manje od ovoga. */
const ISTI_SMJER_STUPNJEVA = 70;
const SUPROTNO_STUPNJEVA = 110;
/** Koliko uzastopnih fiksova treba za "suprotno" ili "izvan rute". */
const POTVRDA_FIKSOVA = 3;

export interface Kandidat {
  /** Metri od početka trase. */
  d: number;
  razmak: number;
  /** Smjer trase na tom mjestu (stupnjevi). */
  smjer: number;
}

export type Status = 'slab-signal' | 'odredujem-smjer' | 'na-ruti' | 'izvan-rute' | 'suprotan-smjer';

export interface Stanje {
  status: Status;
  /** Položaj na trasi kad je vozač na njoj. */
  d: number | null;
  /** Kad nije na trasi: najbliža točka trase i udaljenost do nje. */
  doRute: { lat: number; lon: number; m: number } | null;
  /** Netočnost zadnjeg fiksa (m). */
  netocnost: number;
}

export function smjerIzmedu(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  return ((Math.atan2((b.lon - a.lon) * KX, (b.lat - a.lat) * KY) * 180) / Math.PI + 360) % 360;
}

export function udaljenost(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  return Math.hypot((b.lon - a.lon) * KX, (b.lat - a.lat) * KY);
}

export function razlikaKuta(a: number, b: number): number {
  return Math.abs(((b - a + 540) % 360) - 180);
}

/**
 * Sva mjesta na trasi bliža od `max` metara – po jedno za svaki prolaz
 * (trasa koja se vraća istom ulicom ima dva kandidata).
 */
export function kandidatiNaTrasi(t: Trasa, lat: number, lon: number, max = IZVAN_RUTE_M): Kandidat[] {
  const px = lon * KX;
  const py = lat * KY;
  const blizu: { d: number; razmak: number; i: number }[] = [];
  for (let i = 0; i + 1 < t.x.length; i++) {
    const dx = t.x[i + 1] - t.x[i];
    const dy = t.y[i + 1] - t.y[i];
    const l2 = dx * dx + dy * dy;
    let k = l2 ? ((px - t.x[i]) * dx + (py - t.y[i]) * dy) / l2 : 0;
    k = k < 0 ? 0 : k > 1 ? 1 : k;
    const razmak = Math.hypot(t.x[i] + k * dx - px, t.y[i] + k * dy - py);
    if (razmak <= max) blizu.push({ d: t.d[i] + k * (t.d[i + 1] - t.d[i]), razmak, i });
  }
  // Susjedni segmenti istog prolaza → jedan kandidat (najbliži).
  const rez: Kandidat[] = [];
  let grupa: typeof blizu = [];
  const zatvori = () => {
    if (!grupa.length) return;
    const naj = grupa.reduce((a, b) => (b.razmak < a.razmak ? b : a));
    const s = tockaNa(t, Math.min(t.duljina, naj.d + 5));
    const p = tockaNa(t, Math.max(0, naj.d - 5));
    rez.push({ d: naj.d, razmak: naj.razmak, smjer: smjerIzmedu(p, s) });
    grupa = [];
  };
  for (const b of blizu) {
    if (grupa.length && b.d - grupa[grupa.length - 1].d > 40) zatvori();
    grupa.push(b);
  }
  zatvori();
  return rez;
}

/** Prati jednog vozača po jednoj trasi. */
export class Pracenje {
  private d: number | null = null;
  private zadnjaZaSmjer: { lat: number; lon: number } | null = null;
  /** Smjer kretanja iz GPS-a (stupnjevi) ili null dok se vozač ne pomakne. */
  private kretanje: number | null = null;
  private suprotno = 0;
  private izvan = 0;
  private stanje: Stanje = { status: 'slab-signal', d: null, doRute: null, netocnost: Infinity };

  constructor(readonly trasa: Trasa) {}

  /** Smjer kretanja vozača (za odabir drugog smjera linije). */
  get smjerKretanja(): number | null {
    return this.kretanje;
  }

  fiks(
    lat: number,
    lon: number,
    netocnost: number,
    heading: number | null = null,
    brzina: number | null = null,
  ): Stanje {
    const t = this.trasa;
    if (!(netocnost <= MAX_NETOCNOST_M)) {
      // Loš fiks: ne mijenjaj položaj; ako ga još nemamo, javi slab signal.
      this.stanje = { ...this.stanje, netocnost, status: this.d === null ? 'slab-signal' : this.stanje.status };
      return this.stanje;
    }

    // Smjer kretanja: iz kompasa GPS-a kad se vozi, inače iz pomaka.
    const tu = { lat, lon };
    if (heading !== null && Number.isFinite(heading) && (brzina ?? 0) > 3) {
      this.kretanje = heading;
      this.zadnjaZaSmjer = tu;
    } else if (!this.zadnjaZaSmjer) {
      this.zadnjaZaSmjer = tu;
    } else if (udaljenost(this.zadnjaZaSmjer, tu) >= POMAK_ZA_SMJER_M) {
      this.kretanje = smjerIzmedu(this.zadnjaZaSmjer, tu);
      this.zadnjaZaSmjer = tu;
    }

    if (this.d !== null) return (this.stanje = this.prati(lat, lon, netocnost));
    return (this.stanje = this.nadi(lat, lon, netocnost));
  }

  /** Vozač već ima položaj na trasi: nastavi uz nju. */
  private prati(lat: number, lon: number, netocnost: number): Stanje {
    const t = this.trasa;
    const p = projiciraj(t, lat, lon, this.d!);
    if (p.razmak > IZVAN_RUTE_M) {
      if (++this.izvan >= POTVRDA_FIKSOVA) {
        this.d = null;
        this.izvan = 0;
        return this.nadi(lat, lon, netocnost);
      }
      return { ...this.stanje, netocnost };
    }
    this.izvan = 0;

    // Suprotan smjer: kretanje ide protiv trase (ili se položaj vraća unatrag).
    const smjerTrase = smjerIzmedu(tockaNa(t, Math.max(0, p.d - 5)), tockaNa(t, Math.min(t.duljina, p.d + 5)));
    const protiv =
      (this.kretanje !== null && razlikaKuta(this.kretanje, smjerTrase) > SUPROTNO_STUPNJEVA) || p.d < this.d! - 40;
    if (protiv) {
      if (++this.suprotno >= POTVRDA_FIKSOVA) {
        return { status: 'suprotan-smjer', d: this.d, doRute: null, netocnost };
      }
    } else {
      this.suprotno = 0;
    }

    // GPS na mjestu šeta – ne vraćaj se unatrag za malo.
    if (!(p.d < this.d! && this.d! - p.d < 25)) this.d = p.d;
    return { status: 'na-ruti', d: this.d, doRute: null, netocnost };
  }

  /** Vozač još nema položaj na trasi: nađi ga (ili javi koliko je do rute). */
  private nadi(lat: number, lon: number, netocnost: number): Stanje {
    const t = this.trasa;
    const kandidati = kandidatiNaTrasi(t, lat, lon);
    if (!kandidati.length) {
      const p = projiciraj(t, lat, lon);
      const tocka = tockaNa(t, p.d);
      return { status: 'izvan-rute', d: null, doRute: { lat: tocka.lat, lon: tocka.lon, m: p.razmak }, netocnost };
    }

    if (this.kretanje === null) {
      // Ne znamo kamo ide: jedan prolaz – uzmi ga (krivi smjer javit će se kasnije);
      // više prolaza – pričekaj da krene.
      if (kandidati.length === 1) {
        this.d = kandidati[0].d;
        return { status: 'na-ruti', d: this.d, doRute: null, netocnost };
      }
      return { status: 'odredujem-smjer', d: null, doRute: null, netocnost };
    }

    const kretanje = this.kretanje;
    const isti = kandidati
      .filter((k) => razlikaKuta(kretanje, k.smjer) < ISTI_SMJER_STUPNJEVA)
      .sort((a, b) => a.razmak - b.razmak);
    if (isti.length) {
      this.d = isti[0].d;
      this.suprotno = 0;
      return { status: 'na-ruti', d: this.d, doRute: null, netocnost };
    }
    if (kandidati.some((k) => razlikaKuta(kretanje, k.smjer) > SUPROTNO_STUPNJEVA)) {
      return { status: 'suprotan-smjer', d: null, doRute: null, netocnost };
    }
    // Kretanje poprijeko (skretanje na raskrižju) – pričekaj sljedeći fiks.
    return { status: 'odredujem-smjer', d: null, doRute: null, netocnost };
  }
}

/**
 * Odgovara li trasa vozaču na ovom mjestu: blizu je i ide u smjeru kretanja.
 * Za automatski prelazak na drugi smjer linije (krivi smjer, okretište).
 */
export function trasaOdgovara(t: Trasa, lat: number, lon: number, kretanje: number | null): Kandidat | null {
  const kandidati = kandidatiNaTrasi(t, lat, lon, 40);
  if (!kandidati.length) return null;
  if (kretanje === null) return null;
  const isti = kandidati
    .filter((k) => razlikaKuta(kretanje, k.smjer) < ISTI_SMJER_STUPNJEVA)
    .sort((a, b) => a.razmak - b.razmak);
  return isti[0] ?? null;
}
