import dayjs, { Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

export type DanKey = 'pon' | 'uto' | 'sri' | 'cet' | 'pet' | 'sub' | 'ned';
export type TjedanTip = 'trenutni' | 'naredni';
export type VozacView =
  | 'raspored'
  | 'kalendar'
  | 'danas'
  | 'linije'
  | 'sluzbe'
  | 'statistika';

export const DANI: { key: DanKey; naziv: string; kratko: string }[] = [
  { key: 'pon', naziv: 'Ponedjeljak', kratko: 'Pon' },
  { key: 'uto', naziv: 'Utorak', kratko: 'Uto' },
  { key: 'sri', naziv: 'Srijeda', kratko: 'Sri' },
  { key: 'cet', naziv: 'Četvrtak', kratko: 'Čet' },
  { key: 'pet', naziv: 'Petak', kratko: 'Pet' },
  { key: 'sub', naziv: 'Subota', kratko: 'Sub' },
  { key: 'ned', naziv: 'Nedjelja', kratko: 'Ned' },
];

/** Služba iz rasporeda vozača (vozac-rasporedvoznje). */
export interface Sluzba {
  br_sl: string;
  linija?: string;
  varijanta?: string;
  od: string;
  do: string;
  nastup_sluzbe?: string;
  zavrsna_sluzba?: string;
  nocni_rad?: string;
  druga_smjena?: string;
  efektivni_sati?: string;
  ukupni_sati?: string;
}

type SatiSluzbe = Pick<
  Sluzba,
  'ukupni_sati' | 'efektivni_sati' | 'nocni_rad' | 'druga_smjena'
>;

/**
 * Sati (ukupno, efektivno, noćni, druga smjena) vrijede za cijelu službu i
 * upisani su u svaki njezin dio (308 i 308P) – ovdje se uzimaju jednom.
 */
export function satiSluzbe(dijelovi: SatiSluzbe[]): SatiSluzbe {
  const prvi = (k: keyof SatiSluzbe) =>
    dijelovi.map((d) => d[k]).find((v) => !!v?.trim());
  return {
    ukupni_sati: prvi('ukupni_sati'),
    efektivni_sati: prvi('efektivni_sati'),
    nocni_rad: prvi('nocni_rad'),
    druga_smjena: prvi('druga_smjena'),
  };
}

/** Minute od kraja jednog dijela do početka sljedećeg (i preko ponoći). */
export function pauzaMinuta(kraj?: string, pocetak?: string): number | null {
  const min = (t?: string) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(t ?? '');
    return m ? +m[1] * 60 + +m[2] : null;
  };
  const a = min(kraj);
  const b = min(pocetak);
  return a === null || b === null ? null : (b - a + 1440) % 1440;
}

/** "30 min", "3 h 40 min", "4 h" */
export function trajanjeTekst(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Dan bez službe: oznaka iz disponenta (O, Ob, I-GO…). */
export interface Odsustvo {
  odsustvo: string;
}

export interface RasporedOdgovor {
  godina: number;
  tjedan: number;
  raspored: Record<DanKey, (Sluzba | Odsustvo)[]>;
}

/** Dan u kalendaru; službe su iz verzije koju ima disponent tog tjedna. */
export interface DanKalendara {
  datum: string;
  /** Oznaka iz disponenta: broj službe ili odsustvo (O, I-GO…). */
  oznaka: string;
  verzija: string | null;
  sluzbe: Sluzba[];
}

export interface KalendarOdgovor {
  godina: number;
  mjesec: number;
  /** Mjeseci s podacima, "YYYY-MM". */
  dostupno: { od: string; do: string } | null;
  dani: DanKalendara[];
}

/** Vozač na liniji / službi određenog dana. */
export interface Kolega {
  sluz_broj: string;
  ime_prezime: string | null;
  kontakt_broj?: string | null;
  kontakt_broj_info?: string | null;
  br_sl?: string;
  linija?: string;
  'V.R'?: string;
  varijanta?: string;
  od?: string;
  do?: string;
  nastup?: string;
  zavrsetak?: string;
}

export interface DanRasporeda {
  key: DanKey;
  naziv: string;
  kratko: string;
  datum: Dayjs;
  sluzbe: Sluzba[];
  odsustvo: string | null;
  danas: boolean;
  prosao: boolean;
}

export function jeOdsustvo(x: Sluzba | Odsustvo): x is Odsustvo {
  return 'odsustvo' in x && !!(x as Odsustvo).odsustvo;
}

export function danasKey(): DanKey {
  return DANI[dayjs().isoWeekday() - 1].key;
}

/** Pretvori odgovor API-ja u 7 dana s datumima. */
export function slozTjedan(odg: RasporedOdgovor): DanRasporeda[] {
  // 4. siječnja je uvijek u ISO tjednu 1 – sigurno i na prijelazu godine.
  const pocetak = dayjs(`${odg.godina}-01-04`)
    .isoWeek(odg.tjedan)
    .startOf('isoWeek');
  const danas = dayjs().startOf('day');

  return DANI.map((d, i) => {
    const stavke = odg.raspored?.[d.key] ?? [];
    const odsustvo = stavke.find(jeOdsustvo)?.odsustvo ?? null;
    const sluzbe = stavke.filter((s): s is Sluzba => !jeOdsustvo(s));
    const datum = pocetak.add(i, 'day');
    return {
      ...d,
      datum,
      sluzbe,
      odsustvo: sluzbe.length ? null : odsustvo,
      danas: datum.isSame(danas, 'day'),
      prosao: datum.isBefore(danas, 'day'),
    };
  });
}

/** Pričuva (služba s P na kraju) nema liniju. */
export function jePricuva(s: Sluzba): boolean {
  return !s.linija || /P$/i.test(s.br_sl);
}


/** Čitljiv opis oznake odsustva iz disponenta. */
export function opisOdsustva(oznaka: string | null): string {
  if (!oznaka) return 'Slobodno';
  const o = oznaka.toUpperCase();
  if (o.includes('GO')) return 'Godišnji odmor';
  if (o.includes('BO')) return 'Bolovanje';
  if (/^O/.test(o)) return 'Slobodan dan';
  if (/^\d/.test(o)) return 'Služba nije u voznom redu';
  return 'Slobodno';
}

/**
 * Inicijali "Ime Prezime" (npr. AM). Imena u bazi su zapisana kao
 * "Prezime Ime", pa je ime zadnja riječ, a prezime prva.
 */
export function inicijali(prezimeIme: string | null | undefined): string {
  const d = (prezimeIme ?? '').trim().split(/\s+/).filter(Boolean);
  if (!d.length) return '?';
  if (d.length === 1) return d[0][0].toUpperCase();
  return (d[d.length - 1][0] + d[0][0]).toUpperCase();
}

/** Brojevi telefona bez praznih vrijednosti ("null"/"undefined" iz sessionStorage). */
export function telefoni(...brojevi: (string | null | undefined)[]): string[] {
  return brojevi
    .map((b) => (b ?? '').trim())
    .filter((b) => b && b !== 'null' && b !== 'undefined');
}

/* ---------- Uživo (ZET GTFS-RT) ---------- */

/** Ključ vozača u popisu (isti vozač može imati dva dijela službe). */
export function kolegaKljuc(k: Kolega): string {
  return `${k.sluz_broj}|${k.br_sl ?? ''}|${k.od ?? ''}`;
}

/** Blok u ZET-ovom feedu: linija + V.R. s dvije znamenke (109 + 2 = 10902). */
export function blokZa(
  k: Pick<Kolega, 'linija' | 'varijanta' | 'V.R'>,
): string | null {
  const linija = (k.linija ?? '').trim();
  const vr = (k['V.R'] ?? k.varijanta ?? '').toString().trim();
  if (!/^\d+$/.test(linija) || !/^\d{1,2}$/.test(vr)) return null;
  return linija + vr.padStart(2, '0');
}

function minute(hhmm: string | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm ?? '').trim());
  return m ? +m[1] * 60 + +m[2] : null;
}

/**
 * Je li služba sad u tijeku: od `od` do neposredno prije `do`. U minuti
 * predaje vozi onaj koji preuzima. Služba preko ponoći (20:00–01:30) svog
 * dana traje od `od` do ponoći, a sutradan (`jucer` = služba je od jučer)
 * od ponoći do `do` – isto pravilo kao na backendu (aktivniNaBlokovima).
 */
export function uSmjeniSad(
  od?: string,
  doo?: string,
  sad = new Date(),
  jucer = false,
): boolean {
  const a = minute(od);
  const b = minute(doo);
  if (a === null || b === null) return false;
  const n = sad.getHours() * 60 + sad.getMinutes();
  if (jucer) return a > b && n < b;
  return a <= b ? n >= a && n < b : n >= a;
}

/** Je li datum jučerašnji dan u odnosu na `sad`. */
export function jeJucer(datum: Dayjs, sad = new Date()): boolean {
  return datum.isSame(dayjs(sad).subtract(1, 'day'), 'day');
}

/**
 * Dan koji vozač sad "živi": jučerašnji dok njegova služba preko ponoći još
 * traje, inače današnji. Tako noćna vožnja ne nestane u ponoć.
 */
export function aktivniDan<T extends { datum: Dayjs; sluzbe: Sluzba[] }>(
  dani: T[],
  sad = new Date(),
): T | undefined {
  const jucer = dani.find((d) => jeJucer(d.datum, sad));
  if (jucer?.sluzbe.some((s) => uSmjeniSad(s.od, s.do, sad, true))) return jucer;
  return dani.find((d) => d.datum.isSame(dayjs(sad), 'day'));
}

/**
 * Stanje službe zadanog dana u odnosu na sad: je li u tijeku i za koliko
 * minuta počinje (null = već je počela ili prošla). Služba od jučer više ne
 * počinje – samo još traje do svog `do`.
 */
export function stanjeSluzbe(
  dan: { datum: Dayjs },
  s: { od?: string; do?: string },
  sad = new Date(),
): { uTijeku: boolean; za: number | null } {
  const jucer = jeJucer(dan.datum, sad);
  return {
    uTijeku: uSmjeniSad(s.od, s.do, sad, jucer),
    za: jucer ? null : minutaDo(s.od, sad),
  };
}

/**
 * Tko od kolega trenutno vozi koji blok. Kod predaje smjene (dvije službe
 * istog V.R. se preklapaju) vozi onaj koji je ranije počeo – do zamjene.
 * `jucer` = kolege su iz jučerašnjeg rasporeda (noćne službe nakon ponoći).
 */
export function aktivniPoBloku(
  kolege: Kolega[],
  sad = new Date(),
  jucer = false,
): Map<string, Kolega> {
  const mapa = new Map<string, Kolega>();
  for (const k of kolege) {
    const blok = blokZa(k);
    if (!blok || !uSmjeniSad(k.od, k.do, sad, jucer)) continue;
    const postojeci = mapa.get(blok);
    if (!postojeci || (minute(k.od) ?? 0) < (minute(postojeci.od) ?? 0)) {
      mapa.set(blok, k);
    }
  }
  return mapa;
}

/** Vozilo na bloku iz ZET-ovog feeda. */
export interface VoziloUzivo {
  vozilo: string;
  /** Sekunde; negativno = ranije od voznog reda. */
  kasnjenje: number;
  /** Model vozila ako je poznat (vozni park AP Podsused). */
  model?: string;
}

/** "kasni 5 min" / "kasniš 5 min" / "na vremenu" / "2 min ranije". */
export function opisKasnjenja(sekunde: number, ti = false): string {
  const min = Math.round(Math.abs(sekunde) / 60);
  if (min === 0) return 'na vremenu';
  return sekunde > 0
    ? `${ti ? 'kasniš' : 'kasni'} ${min} min`
    : `${min} min ranije`;
}

export function kasniZnatno(sekunde: number): boolean {
  return sekunde >= 90;
}

/**
 * Procjena dolaska: vrijeme iz rasporeda + kašnjenje. Ranije od voznog
 * reda se ne računa – bus na predaju ne stiže prije vremena.
 */
export function procjenaDolaska(
  hhmm: string | undefined,
  sekunde: number,
): string | null {
  const m = minute(hhmm);
  if (m === null) return null;
  const t = (m + Math.round(Math.max(0, sekunde) / 60)) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** Za koliko minuta počinje (0 ako je sad), null ako je već prošlo. */
export function minutaDo(
  hhmm: string | undefined,
  sad = new Date(),
): number | null {
  const m = minute(hhmm);
  if (m === null) return null;
  const n = sad.getHours() * 60 + sad.getMinutes();
  return m >= n ? m - n : null;
}
