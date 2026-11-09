import { ZetUzivoService, uzivoNaBloku } from './zet-uzivo.service';

const SAD = 1_800_000_000;

const vozilo = (tripId: string, id: string, ts = SAD - 10) => ({
  vehicle: {
    trip: { tripId },
    position: { latitude: 45.8, longitude: 15.9 },
    timestamp: ts,
    vehicle: { id },
  },
});
const kasnjenje = (tripId: string, delay: number, polje = 'arrival') => ({
  tripUpdate: { trip: { tripId }, stopTimeUpdate: [{ [polje]: { delay } }] },
});

describe('ZetUzivoService.obradi', () => {
  const s = new ZetUzivoService({} as any, { get: () => undefined } as any);
  const feed = (entity: any[], ts = SAD - 5) => ({ header: { timestamp: ts }, entity });

  it('spoji vozilo i kašnjenje preko bloka (linija + V.R.)', () => {
    const r = s.obradi(
      feed([vozilo('0_1_10910_109_10258', '3514'), kasnjenje('0_1_10910_109_10258', 355)]),
      SAD,
    );
    expect(r.blokovi).toEqual({ '10910': { vozilo: '3514', kasnjenje: 355, ruta: '109' } });
  });

  it('koristi departure kad nema arrival', () => {
    const r = s.obradi(
      feed([vozilo('0_1_10902_109_1', '3503'), kasnjenje('0_1_10902_109_1', -60, 'departure')]),
      SAD,
    );
    expect(r.blokovi['10902'].kasnjenje).toBe(-60);
  });

  it('bez kašnjenja za trenutnu vožnju ne vraća ništa', () => {
    const r = s.obradi(
      feed([vozilo('0_1_10902_109_1', '3503'), kasnjenje('0_1_10902_109_2', 0)]),
      SAD,
    );
    expect(r.blokovi).toEqual({});
  });

  it('stara pozicija vozila se ignorira', () => {
    const r = s.obradi(
      feed([vozilo('0_1_10902_109_1', '3503', SAD - 600), kasnjenje('0_1_10902_109_1', 0)]),
      SAD,
    );
    expect(r.blokovi).toEqual({});
  });

  it('cijeli stari feed = nema podataka', () => {
    const r = s.obradi(
      feed([vozilo('0_1_10902_109_1', '3503'), kasnjenje('0_1_10902_109_1', 0)], SAD - 600),
      SAD,
    );
    expect(r).toEqual({ vrijeme: null, blokovi: {}, vozila: [] });
  });

  it('dva vozila na istom bloku = nejasno, ne vraća ništa', () => {
    const r = s.obradi(
      feed([
        vozilo('0_1_10902_109_1', '3503'),
        kasnjenje('0_1_10902_109_1', 0),
        vozilo('0_1_10902_109_2', '3504'),
        kasnjenje('0_1_10902_109_2', 60),
      ]),
      SAD,
    );
    expect(r.blokovi).toEqual({});
  });

  it('za kartu vrati sva vozila sa svježom pozicijom, i bez kašnjenja', () => {
    const r = s.obradi(
      feed([
        vozilo('0_1_10910_109_10258', '3514'),
        kasnjenje('0_1_10910_109_10258', 355),
        vozilo('0_1_10902_109_1', '3503'),
        vozilo('0_1_10903_109_1', '3505', SAD - 600),
      ]),
      SAD,
    );
    expect(r.vozila).toEqual([
      {
        vozilo: '3514',
        lat: 45.8,
        lon: 15.9,
        ts: SAD - 10,
        tripId: '0_1_10910_109_10258',
        ruta: '109',
        blok: '10910',
        kasnjenje: 355,
      },
      {
        vozilo: '3503',
        lat: 45.8,
        lon: 15.9,
        ts: SAD - 10,
        tripId: '0_1_10902_109_1',
        ruta: '109',
        blok: '10902',
        kasnjenje: null,
      },
    ]);
  });

  it('dva vozila na istom bloku su oba na karti', () => {
    const r = s.obradi(
      feed([
        vozilo('0_1_10902_109_1', '3503'),
        kasnjenje('0_1_10902_109_1', 0),
        vozilo('0_1_10902_109_2', '3504'),
        kasnjenje('0_1_10902_109_2', 60),
      ]),
      SAD,
    );
    expect(r.vozila.map((v) => v.vozilo)).toEqual(['3503', '3504']);
  });
});

describe('uzivoNaBloku', () => {
  it('linija i V.R. su iz bloka, kao u rasporedu vozača', () => {
    expect(uzivoNaBloku('10910', { vozilo: '3514', kasnjenje: 30, ruta: '109' })).toEqual({
      linija: '109',
      vr: '10',
      kasnjenje: 30,
    });
  });

  it('blok koji usput vozi drugu liniju zadrži svoju liniju, a ruta ide zasebno', () => {
    expect(uzivoNaBloku('11101', { vozilo: '494', kasnjenje: 0, ruta: '162' })).toEqual({
      linija: '111',
      vr: '1',
      kasnjenje: 0,
      ruta: '162',
    });
  });

  it('bez rute iz feeda samo blok', () => {
    expect(uzivoNaBloku('20102', { vozilo: '268', kasnjenje: -60 })).toEqual({
      linija: '201',
      vr: '2',
      kasnjenje: -60,
    });
  });
});
