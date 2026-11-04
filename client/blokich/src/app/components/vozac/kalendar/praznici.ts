import dayjs, { Dayjs } from 'dayjs';

/** Blagdani i neradni dani u Hrvatskoj s fiksnim datumom, "MM-DD". */
const FIKSNI: Record<string, string> = {
  '01-01': 'Nova godina',
  '01-06': 'Sveta tri kralja',
  '05-01': 'Praznik rada',
  '05-30': 'Dan državnosti',
  '06-22': 'Dan antifašističke borbe',
  '08-05': 'Dan pobjede i domovinske zahvalnosti',
  '08-15': 'Velika Gospa',
  '11-01': 'Svi sveti',
  '11-18': 'Dan sjećanja na žrtve Domovinskog rata',
  '12-25': 'Božić',
  '12-26': 'Sveti Stjepan',
};

/** Pomični blagdani: broj dana od Uskrsa. */
const POMICNI: [number, string][] = [
  [0, 'Uskrs'],
  [1, 'Uskrsni ponedjeljak'],
  [60, 'Tijelovo'],
];

/** Datum Uskrsa po gregorijanskom kalendaru (anonimni algoritam). */
export function uskrs(godina: number): Dayjs {
  const a = godina % 19;
  const b = Math.floor(godina / 100);
  const c = godina % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mjesec = Math.floor((h + l - 7 * m + 114) / 31);
  const dan = ((h + l - 7 * m + 114) % 31) + 1;
  return dayjs(new Date(godina, mjesec - 1, dan));
}

/** Naziv blagdana za datum ili null. */
export function praznikZa(datum: Dayjs): string | null {
  const fiksni = FIKSNI[datum.format('MM-DD')];
  if (fiksni) return fiksni;

  const nedjelja = uskrs(datum.year());
  const pomicni = POMICNI.find(([dana]) => nedjelja.add(dana, 'day').isSame(datum, 'day'));
  return pomicni?.[1] ?? null;
}
