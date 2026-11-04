import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { VozacRasporedVoznjeService } from './vozac-raspored-voznje.service';
import { Disponent } from '../../schemas/disponent.schema';
import { Sluzba } from '../../schemas/sluzba.schema';

const lean = (v: any) => ({ lean: () => Promise.resolve(v) });

describe('VozacRasporedVoznjeService', () => {
  let service: VozacRasporedVoznjeService;
  let disponentModel: any;
  let sluzbaModel: any;

  const disponenti = [
    // listopad/studeni 2026: tjedan 44 koristi v1, tjedan 45 koristi v2
    {
      godina: 2026,
      brojTjedna: 44,
      verzija_sluzbe: 'v1',
      radnici: [{ radnik: '2345', sri: '308', sub: 'O', ned: '' }],
    },
    {
      godina: 2026,
      brojTjedna: 45,
      verzija_sluzbe: 'v2',
      radnici: [{ radnik: '2345', pon: '308', uto: '999', sri: 'I-GO' }],
    },
    // vozač nije u ovom tjednu
    { godina: 2026, brojTjedna: 46, verzija_sluzbe: 'v2', radnici: [] },
    // verzija službi ne postoji
    {
      godina: 2026,
      brojTjedna: 47,
      verzija_sluzbe: 'obrisana',
      radnici: [{ radnik: '2345', pon: '308' }],
    },
    // disponent bez verzije
    {
      godina: 2026,
      brojTjedna: 48,
      verzija_sluzbe: null,
      radnici: [{ radnik: '2345', pon: '308' }],
    },
  ];
  const sluzbe = [
    {
      verzija: 'v1',
      sluzbe: [{ br_sl: '308', linija: '109', od: '05:00', do: '13:00' }],
    },
    {
      verzija: 'v2',
      sluzbe: [
        { br_sl: '308', linija: '172', od: '06:00', do: '10:00' },
        { br_sl: '308P', linija: '124', od: '14:00', do: '18:00' },
        { br_sl: '3080', linija: '1', od: '01:00', do: '02:00' },
      ],
    },
  ];

  beforeEach(async () => {
    disponentModel = {
      find: jest.fn((filter: any) =>
        lean(
          disponenti.filter((d) =>
            filter.$or.some(
              (t: any) =>
                t.godina === d.godina && t.brojTjedna === d.brojTjedna,
            ),
          ),
        ),
      ),
      findOne: jest.fn(() => ({
        sort: (s: any) =>
          lean(s.godina === 1 ? disponenti[0] : disponenti[4]),
      })),
    };
    sluzbaModel = {
      find: jest.fn((filter: any) =>
        lean(sluzbe.filter((d) => filter.verzija.$in.includes(d.verzija))),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VozacRasporedVoznjeService,
        { provide: getModelToken(Disponent.name), useValue: disponentModel },
        { provide: getModelToken(Sluzba.name), useValue: sluzbaModel },
      ],
    }).compile();

    service = module.get(VozacRasporedVoznjeService);
  });

  const dan = (r: any, datum: string) =>
    r.dani.find((d: any) => d.datum === datum);

  it('svaki tjedan uzima službe iz verzije svog disponenta', async () => {
    const lis = await service.dohvatiKalendar('2345', 2026, 10);
    const stu = await service.dohvatiKalendar('2345', 2026, 11);

    expect(dan(lis, '2026-10-28').verzija).toBe('v1');
    expect(dan(lis, '2026-10-28').sluzbe.map((s: any) => s.linija)).toEqual([
      '109',
    ]);
    expect(dan(stu, '2026-11-02').verzija).toBe('v2');
    expect(dan(stu, '2026-11-02').sluzbe.map((s: any) => s.linija)).toEqual([
      '172',
      '124',
    ]);
  });

  it('službu nepostojeće verzije ne traži u drugoj verziji', async () => {
    const r = await service.dohvatiKalendar('2345', 2026, 11);

    expect(dan(r, '2026-11-16')).toEqual({
      datum: '2026-11-16',
      oznaka: '308',
      verzija: 'obrisana',
      sluzbe: [],
    });
    expect(dan(r, '2026-11-23').verzija).toBeNull();
    expect(dan(r, '2026-11-23').sluzbe).toEqual([]);
  });

  it('odsustva i nepoznate službe vraća kao oznaku bez detalja', async () => {
    const r = await service.dohvatiKalendar('2345', 2026, 11);

    expect(dan(r, '2026-11-03').oznaka).toBe('999');
    expect(dan(r, '2026-11-03').sluzbe).toEqual([]);
    expect(dan(r, '2026-11-04').oznaka).toBe('I-GO');
  });

  it('izostavlja dane bez podataka i dane van mjeseca', async () => {
    const r = await service.dohvatiKalendar('2345', 2026, 11);

    expect(dan(r, '2026-11-01')).toBeUndefined(); // prazna oznaka
    expect(dan(r, '2026-11-09')).toBeUndefined(); // vozač nije u disponentu
    expect(r.dani.every((d: any) => d.datum.startsWith('2026-11'))).toBe(true);
  });

  it('vraća raspon dostupnih mjeseci', async () => {
    const r = await service.dohvatiKalendar('2345', 2026, 11);

    expect(r.dostupno).toEqual({ od: '2026-10', do: '2026-11' });
  });
});
