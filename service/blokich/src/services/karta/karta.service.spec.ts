import { KartaService, danasZagreb, opisVarijante, spojiVozilo, vozniRed } from './karta.service';
import { GtfsPodaci, glavneTraseLinija, kalendarGtfs, servisiNaDan } from './gtfs-staticki.service';
import { VOZNI_PARK } from '../zet-uzivo/zet-uzivo.service';

const gtfs: GtfsPodaci = {
  verzija: '1',
  rute: new Map([
    ['109', { id: '109', naziv: '109', opis: 'Črnomerec - Dubrava', tip: 3 }],
    ['12', { id: '12', naziv: '12', opis: 'Ljubljanica - Dubrava', tip: 0 }],
  ]),
  voznje: new Map([
    ['0_1_10902_109_1', { ruta: '109', oblik: '109_1', smjer: 1, cilj: 'Dubrava' }],
    ['0_1_1203_12_1', { ruta: '12', oblik: '12_3', smjer: 0, cilj: 'Ljubljanica' }],
  ]),
  oblici: new Map(),
  stajalista: new Map(),
  stajalistaOblika: new Map(),
  glavneTrase: new Map(),
};

const pozicija = (vozilo: string, tripId: string, blok: string) => ({
  vozilo,
  lat: 45.8,
  lon: 15.9,
  ts: 1,
  tripId,
  ruta: tripId.split('_')[3],
  blok,
  kasnjenje: 60,
});

describe('spojiVozilo', () => {
  const podsusedBroj = Object.keys(VOZNI_PARK).find((k) => k !== 'default')!;
  const vozac = {
    sluz_broj: '00001',
    ime: 'Ivo Ivić',
    kontakt: '091',
    br_sl: '12',
    od: '05:00',
    do: '13:00',
  };

  it('bus AP Podsused: model i vozač na bloku', () => {
    const v = spojiVozilo(
      pozicija(podsusedBroj, '0_1_10902_109_1', '10902'),
      gtfs,
      new Map([['10902', vozac]]),
    );
    expect(v).toMatchObject({
      id: podsusedBroj,
      linija: '109',
      tip: 'autobus',
      oblik: '109_1',
      cilj: 'Dubrava',
      linijaBloka: '109',
      vr: '2',
      kasnjenje: 60,
      podsused: true,
      model: VOZNI_PARK[podsusedBroj].kratko,
      vozac,
    });
  });

  it('ostala vozila: bez modela i vozača', () => {
    const v = spojiVozilo(pozicija('22112', '0_1_1203_12_1', '1203'), gtfs, new Map());
    expect(v).toMatchObject({ linija: '12', tip: 'tramvaj', vr: '3', podsused: false });
    expect(v.model).toBeUndefined();
    expect(v.vozac).toBeUndefined();
  });

  it('bez GTFS-a linija iz feeda, bez trase', () => {
    const v = spojiVozilo(pozicija('22112', '0_1_1203_12_1', '1203'), null, new Map());
    expect(v).toMatchObject({ linija: '12', tip: null, oblik: null });
  });
});

describe('glavneTraseLinija', () => {
  const v = (oblik: string, smjer: number, cilj: string, servis = 'r') => ({
    ruta: '109',
    oblik,
    smjer,
    cilj,
    servis,
  });

  it('po smjeru trasa s najviše vožnji, ostale kao varijante', () => {
    const g = glavneTraseLinija(
      new Map([
        ['a', v('109_1', 0, 'Dugave')],
        ['b', v('109_1', 0, 'Dugave')],
        ['c', v('109_9', 0, 'Garaža')],
        ['d', v('109_2', 1, 'Črnomerec')],
      ]),
    );
    expect(g.get('109')).toEqual([
      { smjer: 0, oblik: '109_1', cilj: 'Dugave', voznji: 2, ostale: [{ oblik: '109_9', cilj: 'Garaža', voznji: 1 }] },
      { smjer: 1, oblik: '109_2', cilj: 'Črnomerec', voznji: 1, ostale: [] },
    ]);
  });

  it('broj vožnji je najveći u jednom servisu (danu)', () => {
    const g = glavneTraseLinija(
      new Map([
        ['a', v('109_1', 0, 'Dugave', 'radni')],
        ['b', v('109_1', 0, 'Dugave', 'subota')],
        ['c', v('109_1', 0, 'Dugave', 'nedjelja')],
        ['d', v('109_3', 0, 'Dugave', 'radni')],
        ['e', v('109_3', 0, 'Dugave', 'radni')],
      ]),
    );
    expect(g.get('109')![0]).toMatchObject({
      oblik: '109_1',
      voznji: 1,
      ostale: [{ oblik: '109_3', voznji: 2 }],
    });
  });
});

describe('opisVarijante', () => {
  const st = (...nazivi: string[]) => nazivi.map((naziv, i) => ({ id: String(i), naziv, lat: 0, lon: 0 }));
  const glavna = st('Savski most', 'Remetinec', 'Karlovačka', 'Petlja', 'Brezovica');

  it('drugi put: prvo stajalište kojeg glavna nema', () => {
    expect(opisVarijante(glavna, st('Savski most', 'Arena', 'Petlja', 'Brezovica'))).toBe('preko Arena');
  });

  it('skraćena vožnja: novi kraj', () => {
    expect(opisVarijante(glavna, st('Savski most', 'Remetinec', 'Karlovačka', 'Petlja'))).toBe('do Petlja');
    expect(opisVarijante(glavna, st('Karlovačka', 'Petlja', 'Brezovica'))).toBe('od Karlovačka');
  });

  it('isti krajevi, preskače stajalište', () => {
    expect(opisVarijante(glavna, st('Savski most', 'Remetinec', 'Petlja', 'Brezovica'))).toBe('bez Karlovačka');
  });

  it('bez razlike ili bez stajališta = null', () => {
    expect(opisVarijante(glavna, glavna)).toBeNull();
    expect(opisVarijante([], glavna)).toBeNull();
  });
});

describe('KartaService.linija', () => {
  const tocke: [number, number][] = [
    [45.8, 15.9],
    [45.81, 15.91],
  ];
  const podaci: GtfsPodaci = {
    ...gtfs,
    oblici: new Map([['109_1', tocke]]),
    stajalista: new Map([['s1', { id: 's1', naziv: 'Črnomerec', lat: 45.8, lon: 15.9 }]]),
    stajalistaOblika: new Map([['109_1', ['s1']]]),
    glavneTrase: new Map([['109', [{ smjer: 0, oblik: '109_1', cilj: 'Dubrava', voznji: 30, ostale: [] }]]]),
  };
  const s = new KartaService({} as any, { get: () => podaci } as any, {} as any);

  it('trasa i stajališta po smjeru', () => {
    expect(s.linija('109')).toEqual({
      broj: '109',
      opis: 'Črnomerec - Dubrava',
      tip: 'autobus',
      smjerovi: [
        {
          smjer: 0,
          cilj: 'Dubrava',
          oblik: '109_1',
          tocke,
          stajalista: [{ id: 's1', naziv: 'Črnomerec', lat: 45.8, lon: 15.9 }],
          varijante: [
            {
              oblik: '109_1',
              cilj: 'Dubrava',
              tocke,
              stajalista: [{ id: 's1', naziv: 'Črnomerec', lat: 45.8, lon: 15.9 }],
              voznji: 30,
              glavna: true,
              opis: 'Glavna trasa',
            },
          ],
        },
      ],
    });
  });

  it('varijante smjera s opisom razlike', () => {
    const st = (id: string, naziv: string) => ({ id, naziv, lat: 45.8, lon: 15.9 });
    const s2 = new KartaService(
      {} as any,
      {
        get: () => ({
          ...podaci,
          oblici: new Map([
            ['132_5', tocke],
            ['132_8', tocke],
          ]),
          stajalista: new Map(
            [st('a', 'Savski most'), st('b', 'Remetinec'), st('c', 'Arena'), st('d', 'Brezovica')].map((x) => [x.id, x]),
          ),
          stajalistaOblika: new Map([
            ['132_5', ['a', 'b', 'd']],
            ['132_8', ['a', 'c', 'd']],
          ]),
          rute: new Map([['132', { id: '132', naziv: '132', opis: 'S. most - Brezovica', tip: 3 }]]),
          glavneTrase: new Map([
            [
              '132',
              [
                {
                  smjer: 0,
                  oblik: '132_5',
                  cilj: 'Brezovica',
                  voznji: 30,
                  ostale: [{ oblik: '132_8', cilj: 'Brezovica', voznji: 9 }],
                },
              ],
            ],
          ]),
        }),
      } as any,
      {} as any,
    );
    const sm = s2.linija('132')!.smjerovi[0];
    expect(sm.oblik).toBe('132_5');
    expect(sm.varijante.map((v) => [v.oblik, v.glavna, v.voznji, v.opis])).toEqual([
      ['132_5', true, 30, 'Glavna trasa'],
      ['132_8', false, 9, 'preko Arena'],
    ]);
  });

  it('nepoznata linija = null', () => {
    expect(s.linija('999')).toBeNull();
  });
});

describe('vozni red', () => {
  const kalendar = kalendarGtfs(
    [
      {
        service_id: 'radni',
        monday: '1',
        tuesday: '1',
        wednesday: '1',
        thursday: '1',
        friday: '1',
        saturday: '0',
        sunday: '0',
        start_date: '20261101',
        end_date: '20261231',
      },
    ],
    [
      { service_id: 'radni', date: '20261113', exception_type: '2' },
      { service_id: 'blagdan', date: '20261113', exception_type: '1' },
      { service_id: 'sub', date: '20261114', exception_type: '1' },
    ],
  );

  it('servisi po danu u tjednu i iznimkama', () => {
    expect([...servisiNaDan(kalendar, '20261112')]).toEqual(['radni']);
    expect([...servisiNaDan(kalendar, '20261113')]).toEqual(['blagdan']);
    expect([...servisiNaDan(kalendar, '20261114')]).toEqual(['sub']);
    expect([...servisiNaDan(kalendar, '20261115')]).toEqual([]);
  });

  it('polasci trase redom, samo servisi tog dana, preko ponoći', () => {
    const v = (oblik: string, servis: string, polazak: number) => ({
      ruta: '132',
      oblik,
      smjer: 0,
      cilj: 'Brezovica',
      servis,
      polazak,
    });
    const g: GtfsPodaci = {
      ...gtfs,
      voznje: new Map([
        ['a', v('132_5', 'radni', 8 * 60 + 15)],
        ['b', v('132_5', 'radni', 4 * 60 + 10)],
        ['c', v('132_5', 'radni', 24 * 60 + 5)],
        ['d', v('132_8', 'radni', 5 * 60)],
        ['e', v('132_5', 'sub', 6 * 60)],
      ]),
      vremenaOblika: new Map([['132_5', [0, 2, 29]]]),
      kalendar,
    };
    const ruta = { id: '132', naziv: '132', opis: '', tip: 3 };
    expect(vozniRed(g, ruta, '20261112')).toEqual({
      broj: '132',
      datum: '20261112',
      oblici: {
        '132_5': { polasci: ['04:10', '08:15', '00:05'], vremena: [0, 2, 29] },
        '132_8': { polasci: ['05:00'], vremena: null },
      },
    });
  });

  it('danasZagreb po zagrebačkom vremenu', () => {
    expect(danasZagreb(new Date('2026-11-12T23:30:00Z'))).toBe('20261113');
  });
});
