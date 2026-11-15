import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ZamjeneService } from './zamjene.service';
import { ZamjenePrimjenaService } from './zamjene-primjena.service';

const lean = (v: any) => ({ lean: async () => structuredClone(v) });

// srijeda, 11. 11. 2026 – ISO tjedan 46
const SAD = new Date('2026-11-11T10:00:00Z');
const Z1 = '65a000000000000000000001';

describe('ZamjeneService', () => {
  let db: any[];
  let disponenti: any[];
  let stats: { preracunajTjedan: jest.Mock };
  let service: ZamjeneService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(SAD);
    db = [];
    disponenti = [
      {
        godina: 2026,
        brojTjedna: 46,
        verzija_sluzbe: 'v1',
        radnici: [
          { radnik: '1234', uto: '200', sri: '45' },
          { radnik: '5678', uto: 'O', sri: '112' },
          { radnik: '0999', sri: 'O' },
          { radnik: '4444', sri: 'I-GO' },
          { radnik: '7777', sri: '300' },
        ],
      },
      {
        godina: 2026,
        brojTjedna: 45,
        verzija_sluzbe: 'v1',
        radnici: [{ radnik: '1234', sri: '45' }],
      },
    ];

    const sluzbe = [
      {
        verzija: 'v1',
        sluzbe: [
          { br_sl: '45', linija: '109', od: '14:00', do: '22:00' },
          { br_sl: '112', linija: '172', od: '05:00', do: '13:00' },
          { br_sl: '200', linija: '124', od: '15:00', do: '23:00' },
          { br_sl: '300', linija: '109', od: '21:00', do: '02:00' },
        ],
      },
    ];

    const zamjenaModel: any = {
      find: (f: any) => {
        const rez = db.filter(
          (z) =>
            (f.ponistena !== null || !z.ponistena) &&
            (!f.$or ||
              f.$or.some(
                (t: any) =>
                  t.godina === z.godina && t.brojTjedna === z.brojTjedna,
              )) &&
            (f.sudionici === undefined || z.sudionici.includes(f.sudionici)),
        );
        const chain = {
          sort: () => chain,
          limit: () => chain,
          lean: async () => structuredClone(rez),
        };
        return chain;
      },
      create: async (d: any) => {
        const doc = {
          ...d,
          _id: `65a0000000000000000000${String(db.length + 1).padStart(2, '0')}`,
          ponistena: null,
        };
        db.push(doc);
        return { toObject: () => structuredClone(doc) };
      },
      findById: async (id: string) => {
        const doc = db.find((z) => z._id === id);
        return doc ? Object.assign(doc, { save: async () => doc }) : null;
      },
      distinct: async () => [...new Set(db.flatMap((z) => z.sudionici))],
    };
    const disponentModel: any = {
      findOne: (f: any) =>
        lean(
          disponenti.find(
            (d) => d.godina === f.godina && d.brojTjedna === f.brojTjedna,
          ) ?? null,
        ),
      find: (f: any) =>
        lean(
          disponenti.filter((d) =>
            f.$or.some(
              (t: any) =>
                t.godina === d.godina && t.brojTjedna === d.brojTjedna,
            ),
          ),
        ),
    };
    const sluzbaModel: any = {
      find: (f: any) =>
        lean(sluzbe.filter((s) => f.verzija.$in.includes(s.verzija))),
    };
    const godisnjiModel: any = {
      findOne: () => ({
        sort: () =>
          lean({
            vozaci: [
              { sluz_broj: '1234', ime_prezime: 'Horvat Ivan' },
              { sluz_broj: '5678', ime_prezime: 'Šimić Ana' },
              { sluz_broj: '999', ime_prezime: 'Kovač Marko' },
            ],
          }),
      }),
    };
    stats = { preracunajTjedan: jest.fn(async () => 1) };

    service = new ZamjeneService(
      zamjenaModel,
      disponentModel,
      sluzbaModel,
      godisnjiModel,
      new ZamjenePrimjenaService(zamjenaModel),
      stats as any,
    );
  });

  afterEach(() => jest.useRealTimers());

  describe('kandidati', () => {
    it('traži po broju službe i upozorava na kratak odmor', async () => {
      const r = await service.kandidati('1234', 'trenutni', 'sri', '112');
      expect(r.datum).toBe('2026-11-11');
      expect(r.moj).toMatchObject({
        oznaka: '45',
        vrsta: 'sluzba',
        od: '14:00',
      });
      expect(r.mozeUkinuti).toBe(true);
      expect(r.kandidati[0]).toMatchObject({
        sluz_broj: '5678',
        ime_prezime: 'Šimić Ana',
        oznaka: '112',
        od: '05:00',
        do: '13:00',
      });
      // uto 23:00 -> sri 05:00
      expect(r.kandidati[0].upozorenja).toEqual([
        'Ti: odmor prije smjene (sri) bio bi 6 h',
      ]);
    });

    it('traži po imenu bez dijakritike i po službenom broju', async () => {
      const poImenu = await service.kandidati(
        '1234',
        'trenutni',
        'sri',
        'simic',
      );
      expect(poImenu.kandidati.map((k) => k.sluz_broj)).toEqual(['5678']);

      const poBroju = await service.kandidati('1234', 'trenutni', 'sri', '999');
      expect(poBroju.kandidati[0]).toMatchObject({
        sluz_broj: '0999',
        vrsta: 'slobodan',
      });
    });

    it('bez upita nema kandidata, a odsustvo se ne nudi', async () => {
      expect(
        (await service.kandidati('1234', 'trenutni', 'sri', '')).kandidati,
      ).toEqual([]);
      expect(
        (await service.kandidati('1234', 'trenutni', 'sri', '4444')).kandidati,
      ).toEqual([]);
    });

    it('filtar bez upisa: slobodni, smjena i moja linija', async () => {
      const ime = (r: any) => r.kandidati.map((k: any) => k.sluz_broj);

      const slobodni = await service.kandidati(
        '1234',
        'trenutni',
        'sri',
        '',
        'slobodni',
      );
      expect(ime(slobodni)).toEqual(['0999']);
      expect(slobodni.ukupno).toBe(1);

      expect(
        ime(await service.kandidati('1234', 'trenutni', 'sri', '', 'jutarnja')),
      ).toEqual(['5678']);
      // 21:00–02:00 prelazi ponoć
      const nocna = await service.kandidati(
        '1234',
        'trenutni',
        'sri',
        '',
        'nocna',
      );
      expect(ime(nocna)).toEqual(['7777']);
      expect(nocna.kandidati[0].smjena).toBe('nocna');
      // moja služba 45 je na liniji 109
      expect(
        ime(await service.kandidati('1234', 'trenutni', 'sri', '', 'linija')),
      ).toEqual(['7777']);
      expect(
        ime(
          await service.kandidati('1234', 'trenutni', 'sri', '', 'popodnevna'),
        ),
      ).toEqual([]);
    });

    it('filtar i upit zajedno', async () => {
      const r = await service.kandidati(
        '1234',
        'trenutni',
        'sri',
        'simic',
        'slobodni',
      );
      expect(r.kandidati).toEqual([]);
      const s = await service.kandidati(
        '1234',
        'trenutni',
        'sri',
        'simic',
        'jutarnja',
      );
      expect(s.kandidati.map((k: any) => k.sluz_broj)).toEqual(['5678']);
    });

    it('raspon nastupa: obje granice, jedna granica i preko ponoći', async () => {
      const brojevi = async (od: string | null, doV: string | null, q = '') =>
        (
          await service.kandidati('1234', 'trenutni', 'sri', q, null, {
            od,
            do: doV,
          })
        ).kandidati.map((k: any) => k.sluz_broj);

      // 5678: 05:00, 7777: 21:00, 0999 slobodan – nikad u rasponu
      expect(await brojevi('04:00', '07:59')).toEqual(['5678']);
      expect(await brojevi('05:00', '05:00')).toEqual(['5678']);
      expect(await brojevi('10:00', null)).toEqual(['7777']);
      expect(await brojevi(null, '12:00')).toEqual(['5678']);
      expect(await brojevi('20:00', '03:59')).toEqual(['7777']);
      expect(await brojevi('06:00', '20:00')).toEqual([]);
      expect(await brojevi('04:00', '07:59', 'kovac')).toEqual([]);
      // prazan raspon = kao da ga nema
      expect(await brojevi(null, null)).toEqual([]);
    });

    it('slobodan vozač ne vidi slobodne', async () => {
      const r = await service.kandidati(
        '0999',
        'trenutni',
        'sri',
        '',
        'slobodni',
      );
      expect(r.kandidati).toEqual([]);
    });

    it('bez disponenta za naredni tjedan', async () => {
      await expect(
        service.kandidati('1234', 'naredni', 'sri', '1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('stvori', () => {
    it('zamjena se sprema, preračuna statistiku i vidi se kao aktivna', async () => {
      const z = await service.stvori({
        radnik: '1234',
        tjedan: 'trenutni',
        dan: 'sri',
        tip: 'zamjena',
        sa: '5678',
      });
      expect(z).toMatchObject({
        tip: 'zamjena',
        moja: true,
        prije: '45',
        poslije: '112',
        datum: '2026-11-11',
        kolega: { sluz_broj: '5678', ime_prezime: 'Šimić Ana' },
      });
      expect(db[0]).toMatchObject({
        a: { radnik: '1234', oznaka: '45', ime: 'Horvat Ivan' },
        b: { radnik: '5678', oznaka: '112' },
        sudionici: [1234, 5678],
      });
      expect(stats.preracunajTjedan).toHaveBeenCalledWith(2026, 46);

      const kolega = await service.kandidati('5678', 'trenutni', 'sri', '');
      expect(kolega.moj.oznaka).toBe('45');
      expect(kolega.aktivna).toMatchObject({ moja: false, prije: '112' });
      expect(kolega.mozeUkinuti).toBe(false);
    });

    it('ne dopušta drugu zamjenu istog dana', async () => {
      const ulaz = {
        radnik: '1234',
        tjedan: 'trenutni' as const,
        dan: 'sri',
        tip: 'zamjena' as const,
        sa: '5678',
      };
      await service.stvori(ulaz);
      await expect(service.stvori(ulaz)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(
        service.stvori({ ...ulaz, radnik: '0999', sa: '5678' }),
      ).rejects.toThrow('Kolega za taj dan već ima zamjenu.');
    });

    it('ne mijenja s odsustvom ni dva slobodna dana', async () => {
      const ulaz = {
        radnik: '1234',
        tjedan: 'trenutni' as const,
        dan: 'sri',
        tip: 'zamjena' as const,
      };
      await expect(service.stvori({ ...ulaz, sa: '4444' })).rejects.toThrow(
        'Mijenjati se mogu samo službe i slobodni dani.',
      );
      await expect(
        service.stvori({ ...ulaz, radnik: '5678', dan: 'uto', sa: '0999' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('ukidanje samo kad ima službu', async () => {
      await expect(
        service.stvori({
          radnik: '0999',
          tjedan: 'trenutni',
          dan: 'sri',
          tip: 'ukidanje',
        }),
      ).rejects.toThrow('Taj dan nemaš službu koju bi ukinuo.');

      const z = await service.stvori({
        radnik: '1234',
        tjedan: 'trenutni',
        dan: 'sri',
        tip: 'ukidanje',
      });
      expect(z).toMatchObject({ tip: 'ukidanje', prije: '45', poslije: 'O' });
      const r = await service.kandidati('1234', 'trenutni', 'sri', '');
      expect(r.moj.vrsta).toBe('slobodan');
    });
  });

  describe('ponisti', () => {
    beforeEach(async () => {
      await service.stvori({
        radnik: '1234',
        tjedan: 'trenutni',
        dan: 'sri',
        tip: 'zamjena',
        sa: '5678',
      });
      stats.preracunajTjedan.mockClear();
    });

    it('kolega ne može poništiti', async () => {
      await expect(service.ponisti(Z1, '5678')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('vozač koji ju je napravio može', async () => {
      await service.ponisti(Z1, '01234');
      expect(db[0].ponistena).toBeInstanceOf(Date);
      expect(stats.preracunajTjedan).toHaveBeenCalledWith(2026, 46);
      const r = await service.kandidati('1234', 'trenutni', 'sri', '');
      expect(r.moj.oznaka).toBe('45');
      expect(r.aktivna).toBeNull();
      await expect(service.ponisti(Z1, '1234')).rejects.toThrow(
        'Zamjena je već poništena.',
      );
    });

    it('prošli tjedan se ne može poništiti', async () => {
      jest.setSystemTime(new Date('2026-11-25T10:00:00Z'));
      await expect(service.ponisti(Z1, '1234')).rejects.toThrow(
        'Zamjene iz prošlih tjedana se ne mogu poništiti.',
      );
    });
  });

  it('admin popis po vozaču sa stanjem', async () => {
    await service.stvori({
      radnik: '1234',
      tjedan: 'trenutni',
      dan: 'sri',
      tip: 'zamjena',
      sa: '5678',
    });
    // ZET je upisao zamjenu u disponent
    disponenti[0].radnici[0].sri = '112';
    disponenti[0].radnici[1].sri = '45';

    const r = await service.popis({ radnik: '5678' });
    expect(r.zamjene).toHaveLength(1);
    expect(r.zamjene[0]).toMatchObject({
      stanje: 'u_disponentu',
      a: { sluz_broj: '1234', ime_prezime: 'Horvat Ivan' },
      b: { sluz_broj: '5678', oznaka: '112' },
    });
    expect(r.vozaci.map((v) => v.ime_prezime)).toEqual([
      'Horvat Ivan',
      'Šimić Ana',
    ]);
    expect((await service.popis({ radnik: '999' })).zamjene).toEqual([]);
  });
});
