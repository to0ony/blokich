import dayjs, { Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

export type DanKey = 'pon' | 'uto' | 'sri' | 'cet' | 'pet' | 'sub' | 'ned';
export type TjedanTip = 'trenutni' | 'naredni';
export type VozacView = 'raspored' | 'danas' | 'linije' | 'sluzbe' | 'statistika';

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

/** Dan bez službe: oznaka iz disponenta (O, Ob, I-GO…). */
export interface Odsustvo {
  odsustvo: string;
}

export interface RasporedOdgovor {
  godina: number;
  tjedan: number;
  raspored: Record<DanKey, (Sluzba | Odsustvo)[]>;
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

/** Karta linije s vozilima uživo (ZETko). routeId je isti kao broj linije. */
export function rutaUrl(linija: string): string {
  return `https://zet.prometko.cyou/#route/${encodeURIComponent(linija)}`;
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
