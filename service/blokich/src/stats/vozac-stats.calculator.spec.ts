import {
  izgradiDane,
  izracunajStatistike,
  isoTjedan,
  opsegZaTjedan,
  parseSati,
  ponedjeljakIsoTjedna,
  SluzbaRed,
} from './vozac-stats.calculator';

const sluzbe: SluzbaRed[] = [
  {
    br_sl: '101',
    linija: '6',
    od: '05:00',
    do: '13:00',
    ukupni_sati: '8:00',
    efektivni_sati: '7:30',
  },
  {
    br_sl: '102',
    linija: '6',
    od: '05:10',
    do: '13:10',
    ukupni_sati: '8:00',
    efektivni_sati: '7:00',
  },
  {
    br_sl: '201',
    linija: '14',
    od: '06:00',
    do: '09:00',
    ukupni_sati: '7,00',
    efektivni_sati: '07:00',
  },
  // P dio ponavlja sate cijele službe
  {
    br_sl: '201P',
    linija: '14',
    od: '14:00',
    do: '18:00',
    ukupni_sati: '7,00',
    efektivni_sati: '07:00',
  },
  {
    br_sl: '301',
    linija: '6',
    od: '16:00',
    do: '00:30',
    ukupni_sati: '8:30',
    efektivni_sati: '8:00',
    nocni_rad: '2:30',
  },
];

const sluzbePoVerziji = new Map([['v1', sluzbe]]);

// tjedan 1/2026 počinje u pon 29.12.2025.
const disponent = {
  godina: 2026,
  brojTjedna: 1,
  verzija_sluzbe: 'v1',
  radnici: [
    {
      radnik: '00001',
      pon: '301',
      uto: '101',
      sri: '201',
      cet: 'O',
      pet: 'I-GO',
      sub: '101',
      ned: '999',
    },
    {
      radnik: '00002',
      pon: 'O',
      uto: '102',
      sri: 'O',
      cet: 'Oz',
      pet: '0z',
      sub: '102',
      ned: 'O',
    },
  ],
};

describe('vozac-stats.calculator', () => {
  const dani = izgradiDane([disponent], sluzbePoVerziji);
  const stats = izracunajStatistike(dani);
  const nadi = (radnik: string, tip: string, period: number) =>
    stats.find(
      (s) => s.radnik === radnik && s.tip === tip && s.period === period,
    )!;

  it('parsira sate', () => {
    expect(parseSati('7:45')).toBe(7.75);
    expect(parseSati('7,5')).toBe(7.5);
    expect(parseSati('')).toBe(0);
    expect(parseSati('8,08')).toBe(8.08);
    expect(parseSati('06:55')).toBeCloseTo(6.9167);
  });

  it('računa ISO tjedne', () => {
    expect(ponedjeljakIsoTjedna(2026, 1).toISOString().slice(0, 10)).toBe(
      '2025-12-29',
    );
    expect(isoTjedan(new Date(Date.UTC(2025, 11, 31)))).toEqual({
      godina: 2026,
      tjedan: 1,
    });
  });

  it('tjedna statistika vozača', () => {
    const s = nadi('00001', 'tjedan', 1);
    expect(s.potpun).toBe(true);
    expect(s.radniDani).toBe(5); // 301, 101, 201, 101, 999 (nepoznata)
    expect(s.nepoznateSluzbe).toBe(1);
    expect(s.slobodniDani).toBe(1);
    expect(s.odsustva).toEqual({ 'I-GO': 1 });
    expect(s.ukupniSati).toBe(8.5 + 8 + 7 + 8);
    expect(s.nocniSati).toBe(2.5);
    expect(s.smjene).toEqual({
      jutarnje: 3,
      popodnevne: 0,
      nocne: 1,
      dvokratne: 1,
    });
    expect(s.najranijiNastup).toEqual({
      vrijeme: '05:00',
      datum: '2025-12-30',
    });
    expect(s.najkasnijiKraj).toEqual({ vrijeme: '00:30', datum: '2025-12-29' });
    // pon kraj 00:30 → uto početak 05:00
    expect(s.najkraciOdmor).toEqual({ sati: 4.5, datum: '2025-12-30' });
    expect(s.najduziNiz).toBe(3);
    expect(s.radniVikendDani).toBe(2);
    expect(s.linije[0]).toEqual({ linija: '6', dana: 3, sati: 24.5 });
  });

  it('sve varijante O su slobodni dani', () => {
    expect(nadi('00002', 'tjedan', 1).slobodniDani).toBe(5);
    expect(nadi('00002', 'tjedan', 1).odsustva).toEqual({});
  });

  it('kolege na istoj liniji istog dana', () => {
    const s = nadi('00001', 'tjedan', 1);
    expect(s.kolege).toEqual([{ radnik: '00002', zajednickihDana: 2 }]);
  });

  it('rang po satima', () => {
    expect(nadi('00001', 'tjedan', 1).rang.ukupniSati).toEqual({
      pozicija: 1,
      od: 2,
      percentil: 50,
    });
    expect(nadi('00002', 'tjedan', 1).rang.ukupniSati).toEqual({
      pozicija: 2,
      od: 2,
      percentil: 0,
    });
  });

  it('dijeli tjedan na mjesece', () => {
    const prosinac = nadi('00001', 'mjesec', 12);
    const sijecanj = nadi('00001', 'mjesec', 1);
    expect(prosinac.godina).toBe(2025);
    expect(prosinac.daniSaPodacima).toBe(3);
    expect(prosinac.potpun).toBe(false);
    expect(sijecanj.godina).toBe(2026);
    expect(sijecanj.daniSaPodacima).toBe(4);
  });

  it('opseg za upload tjedna dotiče oba mjeseca', () => {
    const { opseg, potrebniTjedni } = opsegZaTjedan(2026, 1);
    expect(opseg.mjeseci).toEqual([
      { godina: 2025, mjesec: 12 },
      { godina: 2026, mjesec: 1 },
    ]);
    expect(potrebniTjedni).toContainEqual({ godina: 2025, tjedan: 48 });
    expect(potrebniTjedni).toContainEqual({ godina: 2026, tjedan: 5 });
  });
});
