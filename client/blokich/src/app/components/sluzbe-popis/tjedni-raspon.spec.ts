import { rasponiTjedana } from './tjedni-raspon';

describe('rasponiTjedana', () => {
  it('jedan tjedan: broj i datumi od ponedjeljka do nedjelje', () => {
    const [r] = rasponiTjedana([{ godina: 2026, brojTjedna: 45 }]);
    expect(r.tekst).toBe('Tjedan 45 (2.11.–8.11.2026.)');
  });

  it('uzastopni tjedni se spajaju u raspon', () => {
    const r = rasponiTjedana([
      { godina: 2026, brojTjedna: 46 },
      { godina: 2026, brojTjedna: 44 },
      { godina: 2026, brojTjedna: 45 },
    ]);
    expect(r.map((x) => x.tekst)).toEqual([
      'Tjedni 44–46 (26.10.–15.11.2026.)',
    ]);
  });

  it('razmak između tjedana daje više raspona, najnoviji prvi', () => {
    const r = rasponiTjedana([
      { godina: 2026, brojTjedna: 40 },
      { godina: 2026, brojTjedna: 41 },
      { godina: 2026, brojTjedna: 44 },
    ]);
    expect(r.map((x) => x.tekst)).toEqual([
      'Tjedan 44 (26.10.–1.11.2026.)',
      'Tjedni 40–41 (28.9.–11.10.2026.)',
    ]);
  });

  it('raspon preko nove godine', () => {
    const [r] = rasponiTjedana([
      { godina: 2026, brojTjedna: 53 },
      { godina: 2027, brojTjedna: 1 },
    ]);
    expect(r.tekst).toBe('Tjedni 53/2026–1/2027 (28.12.2026.–10.1.2027.)');
  });

  it('isti tjedan dvaput se broji jednom', () => {
    const r = rasponiTjedana([
      { godina: 2026, brojTjedna: 45 },
      { godina: 2026, brojTjedna: 45 },
    ]);
    expect(r.length).toBe(1);
    expect(r[0].tekst).toBe('Tjedan 45 (2.11.–8.11.2026.)');
  });
});
