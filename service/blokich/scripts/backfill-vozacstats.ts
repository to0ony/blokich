/*
 * Jednokratni izračun statistike za sve dosadašnje disponente.
 *
 *   npx ts-node scripts/backfill-vozacstats.ts \
 *     --disponent ./export/disponent.json \
 *     --sluzba ./export/sluzba.json \
 *     --out ./export/vozacstats.json
 *
 * Ulaz: Mongo export (Compass/mongoexport – JSON array ili jedan dokument po retku).
 * Izlaz: JSON array za uvoz:
 *   mongoimport --uri "$MONGO_URI" --collection vozacstats --jsonArray --file vozacstats.json --drop
 */
import * as fs from 'fs';
import {
  DisponentUlaz,
  SluzbaRed,
  izgradiDane,
  izracunajStatistike,
} from '../src/stats/vozac-stats.calculator';

function argument(ime: string, obavezan = true): string {
  const i = process.argv.indexOf(`--${ime}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (!v && obavezan) {
    console.error(`Nedostaje --${ime}`);
    process.exit(1);
  }
  return v ?? '';
}

function ucitaj(putanja: string): any[] {
  const tekst = fs.readFileSync(putanja, 'utf-8').trim();
  if (tekst.startsWith('[')) return JSON.parse(tekst);
  return tekst
    .split(/\r?\n/)
    .filter((r) => r.trim())
    .map((r) => JSON.parse(r));
}

// Extended JSON: {"$date": "..."} / {"$date": {"$numberLong": "..."}}
function uDatum(v: any): number | null {
  if (!v) return null;
  const d = v.$date ?? v;
  const raw = d.$numberLong !== undefined ? Number(d.$numberLong) : d;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : null;
}

const disponentiRaw = ucitaj(argument('disponent'));
const sluzbeRaw = ucitaj(argument('sluzba'));
const izlaz = argument('out');

const sluzbePoVerziji = new Map<string, SluzbaRed[]>();
const datumVerzije = new Map<string, number>();
for (const dok of sluzbeRaw) {
  const lista = sluzbePoVerziji.get(dok.verzija) ?? [];
  lista.push(...(dok.sluzbe || []));
  sluzbePoVerziji.set(dok.verzija, lista);
  const t = uDatum(dok.createdAt);
  if (t !== null) {
    datumVerzije.set(
      dok.verzija,
      Math.min(datumVerzije.get(dok.verzija) ?? t, t),
    );
  }
}
const verzijePoDatumu = [...datumVerzije].sort((a, b) => a[1] - b[1]);

let bezVerzije = 0;
let nadopunjeno = 0;
const disponenti: DisponentUlaz[] = disponentiRaw.map((d) => {
  let verzija: string | null = d.verzija_sluzbe || null;
  if (!verzija || !sluzbePoVerziji.has(verzija)) {
    // zadnja verzija službi unesena prije ovog disponenta
    const unos = uDatum(d.datum_unosa);
    const kandidat =
      unos !== null
        ? verzijePoDatumu.filter(([, t]) => t <= unos).pop()
        : undefined;
    if (kandidat) {
      verzija = kandidat[0];
      nadopunjeno++;
    } else {
      bezVerzije++;
    }
  }
  return {
    godina: Number(d.godina),
    brojTjedna: Number(d.brojTjedna),
    verzija_sluzbe: verzija,
    radnici: d.radnici || [],
  };
});

console.time('izračun');
const dani = izgradiDane(disponenti, sluzbePoVerziji);
const stats = izracunajStatistike(dani);
console.timeEnd('izračun');

const izracunato = { $date: new Date().toISOString() };
fs.writeFileSync(
  izlaz,
  JSON.stringify(stats.map((s) => ({ ...s, izracunato }))),
);

const radniDani = dani.filter((d) => d.tip === 'rad');
const nepoznati = radniDani.filter((d) => d.nepoznataSluzba).length;
const oznake = new Map<string, number>();
for (const d of dani) {
  if (d.tip !== 'rad') oznake.set(d.oznaka, (oznake.get(d.oznaka) ?? 0) + 1);
}

console.log(`
Disponenata:          ${disponenti.length}
  verzija nadopunjena: ${nadopunjeno}
  bez verzije službi:  ${bezVerzije}
Verzija službi:       ${sluzbePoVerziji.size}
Dana vozača:          ${dani.length}
  radnih:              ${radniDani.length}
  nepoznata služba:    ${nepoznati} (${((nepoznati / (radniDani.length || 1)) * 100).toFixed(1)} %)
Oznake bez službe:    ${[...oznake]
  .sort((a, b) => b[1] - a[1])
  .map(([o, n]) => `${o}=${n}`)
  .join(', ')}
Tjednih statistika:   ${stats.filter((s) => s.tip === 'tjedan').length}
Mjesečnih statistika: ${stats.filter((s) => s.tip === 'mjesec').length}
Spremljeno u:         ${izlaz}
`);
