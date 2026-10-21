// Čisti izračun statistike vozača – bez NestJS/Mongoose ovisnosti kako bi ga
// koristili i servis (na upload disponenta) i lokalna backfill skripta.

export const DANI = ['pon', 'uto', 'sri', 'cet', 'pet', 'sub', 'ned'] as const;

// Oznake slobodnog dana u disponentu: O, Oz, Og, Ob, O4… (uz česte tipfelere 0z, o)
const OZNAKA_SLOBODAN = /^[O0][A-Z0-9]?$/i;
// "Linije" koje nisu stvarna vožnja – ne koriste se za kolege
const NISU_LINIJE = new Set(['PRIČUVA']);
// Odmor između smjena kraći od ovoga se posebno broji
const MIN_ODMOR_SATI = 12;
// Služba s "P" dijelom je dvokratna tek ako je pauza između dijelova barem ovoliko
// (kraće pauze su samo nastavak iste smjene, npr. 79 → 79P nakon 30 min)
const MIN_PAUZA_DVOKRATNE_MIN = 120;

export interface DisponentUlaz {
  godina: number;
  brojTjedna: number;
  verzija_sluzbe?: string | null;
  radnici: Record<string, string>[];
}

export interface SluzbaRed {
  br_sl: string;
  linija?: string;
  varijanta?: string;
  nastup_sluzbe?: string;
  od?: string;
  do?: string;
  zavrsna_sluzba?: string;
  nocni_rad?: string;
  druga_smjena?: string;
  efektivni_sati?: string;
  ukupni_sati?: string;
}

export type TipDana = 'rad' | 'slobodan' | 'odsustvo';

export interface DanVozaca {
  radnik: string;
  datum: string; // YYYY-MM-DD
  danUTjednu: number; // 0 = pon … 6 = ned
  godina: number; // ISO godina tjedna
  brojTjedna: number;
  oznaka: string;
  tip: TipDana;
  linije: string[];
  pocetakMin: number | null; // minute od ponoći tog datuma
  krajMin: number | null; // može biti > 1440 ako prelazi ponoć
  ukupniSati: number;
  efektivniSati: number;
  nocniSati: number;
  dvokratna: boolean;
  nepoznataSluzba: boolean; // broj službe nije pronađen u verziji službi
  odmorPrijeSati: number | null; // od kraja prethodne smjene
}

export interface StatVrijeme {
  vrijeme: string;
  datum: string;
}

export interface RangStavka {
  pozicija: number;
  od: number;
  percentil: number; // % vozača s manjom vrijednošću
}

export interface VozacStatsPeriod {
  radnik: string;
  tip: 'tjedan' | 'mjesec';
  godina: number;
  period: number; // ISO tjedan ili mjesec 1–12
  od: string;
  do: string;
  potpun: boolean;
  daniSaPodacima: number;
  radniDani: number;
  nepoznateSluzbe: number;
  slobodniDani: number;
  odsustva: Record<string, number>;
  smjene: {
    jutarnje: number;
    popodnevne: number;
    nocne: number;
    dvokratne: number;
  };
  ukupniSati: number;
  efektivniSati: number;
  nocniSati: number;
  prosjekSatiPoSmjeni: number;
  najranijiNastup: StatVrijeme | null;
  najkasnijiKraj: StatVrijeme | null;
  najkraciOdmor: { sati: number; datum: string } | null;
  odmoriIspod12h: number;
  radniVikendDani: number;
  radneNedjelje: number;
  najduziNiz: number;
  brojLinija: number;
  linije: { linija: string; dana: number; sati: number }[];
  kolege: { radnik: string; zajednickihDana: number }[];
  rang: {
    ukupniSati: RangStavka | null;
    radniDani: RangStavka | null;
  };
}

// ---------- parsiranje ----------

export function parseVrijeme(v?: string | null): number | null {
  if (!v) return null;
  const m = v.trim().match(/^(\d{1,2})[:.](\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

// "7:45" -> 7.75 ; "7,5" / "7.5" -> 7.5
export function parseSati(v?: string | null): number {
  if (!v) return 0;
  const s = v.trim();
  const hm = s.match(/^(\d{1,2}):(\d{2})$/);
  if (hm) return Number(hm[1]) + Number(hm[2]) / 60;
  const dec = Number(s.replace(',', '.'));
  return Number.isFinite(dec) ? dec : 0;
}

function formatVrijeme(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

const zaokruzi = (n: number) => Math.round(n * 100) / 100;

// ---------- datumi (UTC da izbjegnemo vremenske zone) ----------

export function ponedjeljakIsoTjedna(godina: number, tjedan: number): Date {
  const jan4 = new Date(Date.UTC(godina, 0, 4));
  const danJan4 = (jan4.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(godina, 0, 4 - danJan4 + (tjedan - 1) * 7));
}

export function isoTjedan(d: Date): { godina: number; tjedan: number } {
  const t = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  t.setUTCDate(t.getUTCDate() + 3 - ((t.getUTCDay() + 6) % 7));
  const godina = t.getUTCFullYear();
  const tjedan =
    Math.round(
      (t.getTime() - ponedjeljakIsoTjedna(godina, 1).getTime()) / 6048e5,
    ) + 1;
  return { godina, tjedan };
}

const dodajDane = (d: Date, n: number) => new Date(d.getTime() + n * 864e5);
const isoDatum = (d: Date) => d.toISOString().slice(0, 10);
const danaUMjesecu = (g: number, m: number) =>
  new Date(Date.UTC(g, m, 0)).getUTCDate();

// ---------- izgradnja dana ----------

const osnovniBroj = (brSl: string) =>
  brSl.trim().toUpperCase().replace(/P+$/, '');

function indeksirajSluzbe(sluzbe: SluzbaRed[]): Map<string, SluzbaRed[]> {
  const mapa = new Map<string, SluzbaRed[]>();
  for (const s of sluzbe) {
    if (!s?.br_sl) continue;
    const kljuc = osnovniBroj(s.br_sl);
    const lista = mapa.get(kljuc) ?? [];
    lista.push(s);
    mapa.set(kljuc, lista);
  }
  // osnovni dio prije "P" dijela
  for (const lista of mapa.values()) {
    lista.sort((a, b) => a.br_sl.length - b.br_sl.length);
  }
  return mapa;
}

function izgradiRadniDan(dijelovi: SluzbaRed[]) {
  let pocetak: number | null = null;
  let kraj: number | null = null;
  let zadnje: number | null = null;
  let trajanjeDijelova = 0;
  let najduzaPauza = 0;

  // vremena svakog sljedećeg dijela moraju biti >= prethodnih (prelazak ponoći)
  const normaliziraj = (min: number | null) => {
    if (min === null) return null;
    while (zadnje !== null && min < zadnje) min += 1440;
    zadnje = min;
    return min;
  };

  for (const d of dijelovi) {
    const od = normaliziraj(parseVrijeme(d.od));
    const doo = normaliziraj(parseVrijeme(d.do));
    if (od !== null && kraj !== null) {
      najduzaPauza = Math.max(najduzaPauza, od - kraj);
    }
    if (od !== null && pocetak === null) pocetak = od;
    if (doo !== null) kraj = doo;

    if (od !== null && doo !== null) trajanjeDijelova += (doo - od) / 60;
  }

  // Sati u svakom redu (i u "P" dijelu) odnose se na cijelu službu –
  // uzimamo ih jednom, a ako ih nema, zbroj trajanja dijelova
  const satiSluzbe = (polje: keyof SluzbaRed) =>
    Math.max(0, ...dijelovi.map((d) => parseSati(d[polje])));
  const efektivni = satiSluzbe('efektivni_sati') || trajanjeDijelova;
  const ukupni = satiSluzbe('ukupni_sati') || efektivni;
  const nocni = satiSluzbe('nocni_rad');

  return {
    pocetakMin: pocetak,
    krajMin: kraj,
    ukupniSati: ukupni,
    efektivniSati: efektivni,
    nocniSati: nocni,
    dvokratna: najduzaPauza >= MIN_PAUZA_DVOKRATNE_MIN,
    linije: [
      ...new Set(
        dijelovi.map((d) => d.linija?.trim()).filter((l): l is string => !!l),
      ),
    ],
  };
}

/**
 * Pretvara disponente u dane po vozaču. `sluzbePoVerziji` mora sadržavati
 * službe za svaku `verzija_sluzbe` koja se pojavljuje u disponentima.
 */
export function izgradiDane(
  disponenti: DisponentUlaz[],
  sluzbePoVerziji: Map<string, SluzbaRed[]>,
): DanVozaca[] {
  const indeksi = new Map<string, Map<string, SluzbaRed[]>>();
  const dani: DanVozaca[] = [];

  for (const disp of disponenti) {
    const verzija = disp.verzija_sluzbe ?? '';
    if (!indeksi.has(verzija)) {
      indeksi.set(
        verzija,
        indeksirajSluzbe(sluzbePoVerziji.get(verzija) ?? []),
      );
    }
    const indeks = indeksi.get(verzija)!;
    const ponedjeljak = ponedjeljakIsoTjedna(disp.godina, disp.brojTjedna);

    for (const r of disp.radnici ?? []) {
      if (!r?.radnik) continue;
      DANI.forEach((danKey, i) => {
        const oznaka = (r[danKey] ?? '').trim();
        if (!oznaka) return;

        const dijelovi = indeks.get(oznaka.toUpperCase());
        const baza = {
          radnik: r.radnik,
          datum: isoDatum(dodajDane(ponedjeljak, i)),
          danUTjednu: i,
          godina: disp.godina,
          brojTjedna: disp.brojTjedna,
          oznaka,
          odmorPrijeSati: null,
        };

        if (dijelovi?.length) {
          dani.push({
            ...baza,
            tip: 'rad',
            nepoznataSluzba: false,
            ...izgradiRadniDan(dijelovi),
          });
        } else {
          const brojSluzbe = /^\d+P*$/i.test(oznaka);
          dani.push({
            ...baza,
            tip: brojSluzbe
              ? 'rad'
              : OZNAKA_SLOBODAN.test(oznaka)
                ? 'slobodan'
                : 'odsustvo',
            nepoznataSluzba: brojSluzbe,
            linije: [],
            pocetakMin: null,
            krajMin: null,
            ukupniSati: 0,
            efektivniSati: 0,
            nocniSati: 0,
            dvokratna: false,
          });
        }
      });
    }
  }

  izracunajOdmore(dani);
  return dani;
}

// Odmor = početak smjene − kraj smjene prethodnog dana (istog vozača)
function izracunajOdmore(dani: DanVozaca[]) {
  const poVozacu = new Map<string, DanVozaca[]>();
  for (const d of dani) {
    if (d.tip !== 'rad') continue;
    const lista = poVozacu.get(d.radnik) ?? [];
    lista.push(d);
    poVozacu.set(d.radnik, lista);
  }

  for (const lista of poVozacu.values()) {
    lista.sort((a, b) => a.datum.localeCompare(b.datum));
    let prethodniKraj: number | null = null;
    let prethodniDan: number | null = null;
    for (const d of lista) {
      const dan = Date.parse(d.datum) / 6e4; // minute od epohe
      const jucer = prethodniDan !== null && dan - prethodniDan === 1440;
      if (jucer && prethodniKraj !== null && d.pocetakMin !== null) {
        d.odmorPrijeSati = zaokruzi((dan + d.pocetakMin - prethodniKraj) / 60);
      }
      prethodniKraj = d.krajMin !== null ? dan + d.krajMin : null;
      prethodniDan = dan;
    }
  }
}

// ---------- agregacija ----------

function tipSmjene(d: DanVozaca): 'jutarnje' | 'popodnevne' | 'nocne' | null {
  if (d.pocetakMin === null) return null;
  if (d.pocetakMin >= 20 * 60 || (d.krajMin ?? 0) > 24 * 60) return 'nocne';
  return d.pocetakMin < 12 * 60 ? 'jutarnje' : 'popodnevne';
}

interface PeriodMeta {
  tip: 'tjedan' | 'mjesec';
  godina: number;
  period: number;
  od: string;
  do: string;
}

function agregiraj(
  radnik: string,
  dani: DanVozaca[],
  meta: PeriodMeta,
  kolegeBrojac: Map<string, number>,
): VozacStatsPeriod {
  const radni = dani
    .filter((d) => d.tip === 'rad')
    .sort((a, b) => a.datum.localeCompare(b.datum));
  const odsustva: Record<string, number> = {};
  for (const d of dani) {
    if (d.tip === 'odsustvo')
      odsustva[d.oznaka] = (odsustva[d.oznaka] ?? 0) + 1;
  }

  const smjene = { jutarnje: 0, popodnevne: 0, nocne: 0, dvokratne: 0 };
  const linije = new Map<string, { dana: number; sati: number }>();
  let najraniji: DanVozaca | null = null;
  let najkasniji: DanVozaca | null = null;
  let najkraciOdmor: { sati: number; datum: string } | null = null;
  let odmoriIspod = 0;
  let najduziNiz = 0;
  let niz = 0;
  let prethodniDatum: string | null = null;

  for (const d of radni) {
    const t = tipSmjene(d);
    if (t) smjene[t]++;
    if (d.dvokratna) smjene.dvokratne++;

    for (const l of d.linije) {
      const s = linije.get(l) ?? { dana: 0, sati: 0 };
      s.dana++;
      s.sati += d.ukupniSati / d.linije.length;
      linije.set(l, s);
    }

    if (
      d.pocetakMin !== null &&
      (!najraniji || d.pocetakMin < najraniji.pocetakMin!)
    )
      najraniji = d;
    if (d.krajMin !== null && (!najkasniji || d.krajMin > najkasniji.krajMin!))
      najkasniji = d;

    if (d.odmorPrijeSati !== null) {
      if (d.odmorPrijeSati < MIN_ODMOR_SATI) odmoriIspod++;
      if (!najkraciOdmor || d.odmorPrijeSati < najkraciOdmor.sati) {
        najkraciOdmor = { sati: d.odmorPrijeSati, datum: d.datum };
      }
    }

    const uzastopan =
      prethodniDatum !== null &&
      Date.parse(d.datum) - Date.parse(prethodniDatum) === 864e5;
    niz = uzastopan ? niz + 1 : 1;
    najduziNiz = Math.max(najduziNiz, niz);
    prethodniDatum = d.datum;
  }

  const ukupniSati = radni.reduce((s, d) => s + d.ukupniSati, 0);
  const poznatih = radni.filter((d) => !d.nepoznataSluzba).length;

  return {
    radnik,
    ...meta,
    potpun: false, // postavlja se izvana prema pokrivenosti perioda
    daniSaPodacima: dani.length,
    radniDani: radni.length,
    nepoznateSluzbe: radni.filter((d) => d.nepoznataSluzba).length,
    slobodniDani: dani.filter((d) => d.tip === 'slobodan').length,
    odsustva,
    smjene,
    ukupniSati: zaokruzi(ukupniSati),
    efektivniSati: zaokruzi(radni.reduce((s, d) => s + d.efektivniSati, 0)),
    nocniSati: zaokruzi(radni.reduce((s, d) => s + d.nocniSati, 0)),
    prosjekSatiPoSmjeni: poznatih ? zaokruzi(ukupniSati / poznatih) : 0,
    najranijiNastup: najraniji
      ? {
          vrijeme: formatVrijeme(najraniji.pocetakMin!),
          datum: najraniji.datum,
        }
      : null,
    najkasnijiKraj: najkasniji
      ? { vrijeme: formatVrijeme(najkasniji.krajMin!), datum: najkasniji.datum }
      : null,
    najkraciOdmor,
    odmoriIspod12h: odmoriIspod,
    radniVikendDani: radni.filter((d) => d.danUTjednu >= 5).length,
    radneNedjelje: radni.filter((d) => d.danUTjednu === 6).length,
    najduziNiz,
    brojLinija: linije.size,
    linije: [...linije.entries()]
      .map(([linija, s]) => ({ linija, dana: s.dana, sati: zaokruzi(s.sati) }))
      .sort((a, b) => b.dana - a.dana || b.sati - a.sati)
      .slice(0, 5),
    kolege: [...kolegeBrojac.entries()]
      .map(([r, n]) => ({ radnik: r, zajednickihDana: n }))
      .sort((a, b) => b.zajednickihDana - a.zajednickihDana)
      .slice(0, 5),
    rang: { ukupniSati: null, radniDani: null },
  };
}

function rangiraj(
  stats: VozacStatsPeriod[],
  polje: 'ukupniSati' | 'radniDani',
) {
  const aktivni = stats.filter((s) => s.radniDani > 0);
  const vrijednosti = aktivni.map((s) => s[polje]).sort((a, b) => a - b);
  for (const s of aktivni) {
    const manjih = vrijednosti.findIndex((v) => v >= s[polje]);
    const vecih =
      vrijednosti.length - vrijednosti.findLastIndex((v) => v <= s[polje]) - 1;
    s.rang[polje] = {
      pozicija: vecih + 1,
      od: aktivni.length,
      percentil: Math.round((manjih / aktivni.length) * 100),
    };
  }
}

// Za svaki dan: tko je vozio istu liniju → broj zajedničkih dana po paru
function brojiKolege(dani: DanVozaca[]): Map<string, Map<string, number>> {
  const grupe = new Map<string, Set<string>>();
  for (const d of dani) {
    if (d.tip !== 'rad') continue;
    for (const l of d.linije) {
      if (NISU_LINIJE.has(l.toUpperCase())) continue;
      const k = `${d.datum}|${l}`;
      const g = grupe.get(k) ?? new Set<string>();
      g.add(d.radnik);
      grupe.set(k, g);
    }
  }

  // isti par na istom datumu brojimo jednom čak i ako dijele više linija
  const parovi = new Map<string, Map<string, Set<string>>>();
  for (const [kljuc, radnici] of grupe) {
    const datum = kljuc.split('|')[0];
    for (const a of radnici) {
      const mapa = parovi.get(a) ?? new Map<string, Set<string>>();
      for (const b of radnici) {
        if (a === b) continue;
        const datumi = mapa.get(b) ?? new Set<string>();
        datumi.add(datum);
        mapa.set(b, datumi);
      }
      parovi.set(a, mapa);
    }
  }

  const rezultat = new Map<string, Map<string, number>>();
  for (const [a, mapa] of parovi) {
    rezultat.set(a, new Map([...mapa].map(([b, d]) => [b, d.size])));
  }
  return rezultat;
}

export interface Opseg {
  tjedni?: { godina: number; tjedan: number }[];
  mjeseci?: { godina: number; mjesec: number }[];
}

/**
 * Računa tjedne i mjesečne statistike. Bez `opseg` računa sve periode koji
 * se pojavljuju u danima; s `opseg` samo navedene (ostali dani služe kao
 * kontekst, npr. za odmor između smjena).
 */
export function izracunajStatistike(
  dani: DanVozaca[],
  opseg?: Opseg,
): VozacStatsPeriod[] {
  const tjedni = new Map<string, DanVozaca[]>();
  const mjeseci = new Map<string, DanVozaca[]>();
  for (const d of dani) {
    const kt = `${d.godina}-${d.brojTjedna}`;
    const km = d.datum.slice(0, 7);
    (tjedni.get(kt) ?? tjedni.set(kt, []).get(kt)!).push(d);
    (mjeseci.get(km) ?? mjeseci.set(km, []).get(km)!).push(d);
  }

  const zeljeniTjedni =
    opseg?.tjedni &&
    new Set(opseg.tjedni.map((t) => `${t.godina}-${t.tjedan}`));
  const zeljeniMjeseci =
    opseg?.mjeseci &&
    new Set(
      opseg.mjeseci.map(
        (m) => `${m.godina}-${String(m.mjesec).padStart(2, '0')}`,
      ),
    );

  const rezultat: VozacStatsPeriod[] = [];

  const obradi = (
    daniPerioda: DanVozaca[],
    meta: PeriodMeta,
    ukupnoDana: number,
  ) => {
    const pokriveniDatumi = new Set(daniPerioda.map((d) => d.datum)).size;
    const kolege = brojiKolege(daniPerioda);
    const poVozacu = new Map<string, DanVozaca[]>();
    for (const d of daniPerioda) {
      (
        poVozacu.get(d.radnik) ?? poVozacu.set(d.radnik, []).get(d.radnik)!
      ).push(d);
    }

    const stats = [...poVozacu].map(([radnik, dv]) => {
      const s = agregiraj(radnik, dv, meta, kolege.get(radnik) ?? new Map());
      s.potpun = pokriveniDatumi === ukupnoDana;
      return s;
    });
    rangiraj(stats, 'ukupniSati');
    rangiraj(stats, 'radniDani');
    rezultat.push(...stats);
  };

  for (const [k, dv] of tjedni) {
    if (zeljeniTjedni && !zeljeniTjedni.has(k)) continue;
    const { godina, brojTjedna } = dv[0];
    const pon = ponedjeljakIsoTjedna(godina, brojTjedna);
    obradi(
      dv,
      {
        tip: 'tjedan',
        godina,
        period: brojTjedna,
        od: isoDatum(pon),
        do: isoDatum(dodajDane(pon, 6)),
      },
      7,
    );
  }

  for (const [k, dv] of mjeseci) {
    if (zeljeniMjeseci && !zeljeniMjeseci.has(k)) continue;
    const [g, m] = k.split('-').map(Number);
    const n = danaUMjesecu(g, m);
    obradi(
      dv,
      {
        tip: 'mjesec',
        godina: g,
        period: m,
        od: `${k}-01`,
        do: `${k}-${String(n).padStart(2, '0')}`,
      },
      n,
    );
  }

  return rezultat;
}

/**
 * Za upload tjedna: koji tjedni i mjeseci se moraju preračunati te koje
 * disponente treba učitati (svi tjedni tih mjeseci + tjedan prije, zbog odmora).
 */
export function opsegZaTjedan(godina: number, tjedan: number) {
  const pon = ponedjeljakIsoTjedna(godina, tjedan);
  const mjeseci = new Map<string, { godina: number; mjesec: number }>();
  for (let i = 0; i < 7; i++) {
    const d = dodajDane(pon, i);
    const m = { godina: d.getUTCFullYear(), mjesec: d.getUTCMonth() + 1 };
    mjeseci.set(`${m.godina}-${m.mjesec}`, m);
  }

  const potrebniTjedni = new Map<string, { godina: number; tjedan: number }>();
  for (const m of mjeseci.values()) {
    const prvi = new Date(Date.UTC(m.godina, m.mjesec - 1, 1));
    const zadnji = new Date(Date.UTC(m.godina, m.mjesec, 0));
    for (let d = dodajDane(prvi, -7); d <= zadnji; d = dodajDane(d, 7)) {
      const t = isoTjedan(d);
      potrebniTjedni.set(`${t.godina}-${t.tjedan}`, t);
    }
    const t = isoTjedan(zadnji);
    potrebniTjedni.set(`${t.godina}-${t.tjedan}`, t);
  }

  return {
    opseg: {
      tjedni: [{ godina, tjedan }],
      mjeseci: [...mjeseci.values()],
    } as Opseg,
    potrebniTjedni: [...potrebniTjedni.values()],
  };
}
