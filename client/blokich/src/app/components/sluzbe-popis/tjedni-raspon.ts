import dayjs, { Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

export interface Tjedan {
  godina: number;
  brojTjedna: number;
}

export interface RasponTjedana {
  od: Tjedan;
  do: Tjedan;
  /** Ponedjeljak prvog i nedjelja zadnjeg tjedna. */
  pocetak: Dayjs;
  kraj: Dayjs;
  /** npr. "Tjedan 45 (3.11.–9.11.2026.)" ili "Tjedni 44–46 (27.10.–16.11.2026.)" */
  tekst: string;
}

/** Ponedjeljak ISO tjedna (4. siječnja je uvijek u 1. tjednu). */
export function ponedjeljak(t: Tjedan): Dayjs {
  return dayjs(`${t.godina}-01-04`).isoWeek(t.brojTjedna).startOf('isoWeek');
}

function datumi(pocetak: Dayjs, kraj: Dayjs): string {
  const istaGodina = pocetak.year() === kraj.year();
  const prvi = pocetak.format(istaGodina ? 'D.M.' : 'D.M.YYYY.');
  return `${prvi}–${kraj.format('D.M.YYYY.')}`;
}

function oznakaTjedna(t: Tjedan, sGodinom: boolean): string {
  return sGodinom ? `${t.brojTjedna}/${t.godina}` : `${t.brojTjedna}`;
}

/**
 * Spaja uzastopne tjedne u raspone, najnoviji raspon prvi.
 * Tjedni 44, 45, 46 i 49 -> ["Tjedan 49 (…)", "Tjedni 44–46 (…)"]
 */
export function rasponiTjedana(tjedni: Tjedan[]): RasponTjedana[] {
  const sortirani = [...tjedni]
    .map((t) => ({ t, pon: ponedjeljak(t) }))
    .sort((a, b) => a.pon.valueOf() - b.pon.valueOf());

  const grupe: { t: Tjedan; pon: Dayjs }[][] = [];
  for (const stavka of sortirani) {
    const zadnja = grupe[grupe.length - 1];
    const prethodni = zadnja?.[zadnja.length - 1];
    const razlikaDana = prethodni ? stavka.pon.diff(prethodni.pon, 'day') : -1;
    if (razlikaDana === 0) continue; // isti tjedan dvaput
    if (razlikaDana === 7) zadnja.push(stavka);
    else grupe.push([stavka]);
  }

  return grupe
    .map((g) => {
      const prvi = g[0];
      const zadnji = g[g.length - 1];
      const pocetak = prvi.pon;
      const kraj = zadnji.pon.add(6, 'day');
      const razlicitaGodina = prvi.t.godina !== zadnji.t.godina;
      const tekst =
        g.length === 1
          ? `Tjedan ${prvi.t.brojTjedna} (${datumi(pocetak, kraj)})`
          : `Tjedni ${oznakaTjedna(prvi.t, razlicitaGodina)}–${oznakaTjedna(
              zadnji.t,
              razlicitaGodina,
            )} (${datumi(pocetak, kraj)})`;
      return { od: prvi.t, do: zadnji.t, pocetak, kraj, tekst };
    })
    .reverse();
}
