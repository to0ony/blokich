import { SluzbaUploadService } from './sluzba-upload.service';
import { sha256 } from 'src/pdf/pdf-input';

describe('SluzbaUploadService.pripremi', () => {
  const file = { buffer: Buffer.from('pdf'), originalname: 's.pdf' };

  const napravi = (zadnji: any, sluzbe: any[]) => {
    const sluzbaModel = { create: jest.fn() };
    const uploadModel = {
      create: jest.fn(),
      updateOne: jest.fn(),
      findOne: () => ({
        sort: () => ({ lean: () => Promise.resolve(zadnji) }),
      }),
    };
    const pdf = { extractSluzba: jest.fn().mockResolvedValue({ sluzbe }) };
    const rucniUvoz = { zabiljezi: jest.fn() };
    const disponentModel = { find: jest.fn() };
    const service = new SluzbaUploadService(
      sluzbaModel as any,
      uploadModel as any,
      pdf as any,
      rucniUvoz as any,
      disponentModel as any,
    );
    return { service, pdf, sluzbaModel, uploadModel, rucniUvoz };
  };

  it('prebroji službe i različite linije, a ne upisuje u bazu', async () => {
    const { service, sluzbaModel, uploadModel } = napravi(null, [
      { br_sl: '1', linija: '119' },
      { br_sl: '2', linija: '119 ' },
      { br_sl: '3', linija: '124' },
      { br_sl: '4', linija: null },
    ]);

    await expect(service.pripremi(file)).resolves.toMatchObject({
      status: 'novo',
      poruka: 'Izvučeno službi: 4.',
    });
    expect(sluzbaModel.create).not.toHaveBeenCalled();
    expect(uploadModel.create).not.toHaveBeenCalled();
  });

  it('ne parsira PDF s istim hashom', async () => {
    const { service, pdf } = napravi(
      { sha256: sha256(file.buffer), verzija: '2026-45-1' },
      [],
    );

    const rezultat = await service.pripremi(file);

    expect(rezultat.status).toBe('nema_promjene');
    expect(pdf.extractSluzba).not.toHaveBeenCalled();
  });

  it('originalu koji je ručno ispravljen nema promjene', async () => {
    const { service, pdf } = napravi(
      {
        sha256: 'hash-ispravka',
        izvorni_sha256: sha256(file.buffer),
        verzija: '2026-45-1',
      },
      [],
    );

    const rezultat = await service.pripremi(file);

    expect(rezultat.status).toBe('nema_promjene');
    expect(rezultat.poruka).toContain('ručno ispravljen');
    expect(pdf.extractSluzba).not.toHaveBeenCalled();
  });

  it('ručni uvoz veže izvorni hash i bilježi povijest', async () => {
    const { service, uploadModel, rucniUvoz } = napravi(null, [
      { br_sl: '1', linija: '119' },
    ]);

    await service.processPdf(file, 'rucno', 'izvorni');

    expect(uploadModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ izvorni_sha256: 'izvorni' }),
    );
    expect(rucniUvoz.zabiljezi).toHaveBeenCalledWith(
      expect.objectContaining({
        dokument: 'sluzba',
        izvorni_sha256: 'izvorni',
      }),
    );
  });

  it('veže izvorni hash i na već učitan ispravak', async () => {
    const { service, uploadModel, sluzbaModel } = napravi(
      { sha256: sha256(file.buffer), verzija: '2026-45-1' },
      [],
    );

    await service.processPdf(file, 'rucno', 'izvorni');

    expect(uploadModel.updateOne).toHaveBeenCalledWith(
      { sha256: sha256(file.buffer) },
      { izvorni_sha256: 'izvorni' },
    );
    expect(sluzbaModel.create).not.toHaveBeenCalled();
  });

  it('uvoz sa ZET-a ne ide u povijest ručnih', async () => {
    const { service, rucniUvoz } = napravi(null, [
      { br_sl: '1', linija: '119' },
    ]);

    await service.processPdf(file, 'zet');

    expect(rucniUvoz.zabiljezi).not.toHaveBeenCalled();
  });

  it('prenosi upozorenja parsera u pripremu i poruku', async () => {
    const { service, pdf } = napravi(null, [{ br_sl: '1', linija: '119' }]);
    pdf.extractSluzba.mockResolvedValue({
      sluzbe: [{ br_sl: '1', linija: '119' }],
      upozorenja: ['služba 1: zbroj dijelova 400 min, EFEK. 06:55'],
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const rezultat = await service.pripremi(file);

    expect(rezultat).toMatchObject({
      status: 'novo',
      poruka: 'Izvučeno službi: 1. Upozorenja: 1.',
      upozorenja: ['služba 1: zbroj dijelova 400 min, EFEK. 06:55'],
    });
    warn.mockRestore();
  });

  it('odbija PDF iz kojeg nije izvučena nijedna služba', async () => {
    const { service } = napravi(null, []);

    await expect(service.pripremi(file)).rejects.toThrow('nijedna služba');
  });
});

describe('SluzbaUploadService.getPovijest', () => {
  const lanac = (rezultat: any) => ({
    sort: () => ({
      limit: () => ({ lean: () => Promise.resolve(rezultat) }),
      lean: () => Promise.resolve(rezultat),
    }),
  });

  it('uz svaku verziju vraća tjedne u kojima ju disponent koristi', async () => {
    const uploadModel = {
      find: () =>
        lanac([
          { verzija: '2026-45-1', broj_ubacenih: 914 },
          { verzija: '2026-40-1', broj_ubacenih: 900 },
        ]),
    };
    const disponentModel = {
      find: jest.fn(() =>
        lanac([
          { godina: 2026, brojTjedna: 46, verzija_sluzbe: '2026-45-1' },
          { godina: 2026, brojTjedna: 46, verzija_sluzbe: '2026-45-1' },
          { godina: 2026, brojTjedna: 45, verzija_sluzbe: '2026-45-1' },
        ]),
      ),
    };
    const service = new SluzbaUploadService(
      {} as any,
      uploadModel as any,
      {} as any,
      {} as any,
      disponentModel as any,
    );

    const povijest = await service.getPovijest();

    expect(disponentModel.find).toHaveBeenCalledWith(
      { verzija_sluzbe: { $in: ['2026-45-1', '2026-40-1'] } },
      expect.anything(),
    );
    expect(povijest[0].tjedni).toEqual([
      { godina: 2026, brojTjedna: 46 },
      { godina: 2026, brojTjedna: 45 },
    ]);
    expect(povijest[1].tjedni).toEqual([]);
  });
});

describe('SluzbaUploadService – ponovni ručni uvoz (prepisi)', () => {
  const file = { buffer: Buffer.from('pdf'), originalname: 's.pdf' };
  const hash = sha256(file.buffer);

  const napravi = (zadnji: any) => {
    const sluzbaModel = {
      create: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({ matchedCount: 1 }),
    };
    const uploadModel = {
      create: jest.fn(),
      updateOne: jest.fn(),
      findOne: () => ({
        sort: () => ({ lean: () => Promise.resolve(zadnji) }),
      }),
    };
    const pdf = {
      extractSluzba: jest
        .fn()
        .mockResolvedValue({ sluzbe: [{ br_sl: '1' }, { br_sl: '1P' }] }),
    };
    const rucniUvoz = { zabiljezi: jest.fn() };
    const service = new SluzbaUploadService(
      sluzbaModel as any,
      uploadModel as any,
      pdf as any,
      rucniUvoz as any,
      {} as any,
    );
    return { service, pdf, sluzbaModel, uploadModel, rucniUvoz };
  };

  it('isti PDF s prepisi ponovno parsira i prepisuje postojeću verziju', async () => {
    const { service, pdf, sluzbaModel, uploadModel, rucniUvoz } = napravi({
      _id: 'u1',
      sha256: hash,
      verzija: '2026-45-1',
    });

    const rezultat = await service.processPdf(file, 'rucno', undefined, {
      prepisi: true,
    });

    expect(pdf.extractSluzba).toHaveBeenCalled();
    expect(sluzbaModel.updateOne).toHaveBeenCalledWith(
      { verzija: '2026-45-1' },
      { $set: { sluzbe: [{ br_sl: '1' }, { br_sl: '1P' }] } },
    );
    expect(sluzbaModel.create).not.toHaveBeenCalled();
    expect(uploadModel.create).not.toHaveBeenCalled();
    expect(uploadModel.updateOne).toHaveBeenCalledWith(
      { _id: 'u1' },
      expect.objectContaining({
        $set: expect.objectContaining({ broj_ubacenih: 2, sha256: hash }),
      }),
    );
    expect(rezultat).toMatchObject({
      status: 'obradjeno',
      verzija: '2026-45-1',
      poruka: 'Verzija 2026-45-1 prepisana: 2 službi.',
    });
    expect(rucniUvoz.zabiljezi).toHaveBeenCalledWith(
      expect.objectContaining({ dokument: 'sluzba', oznaka: '2026-45-1' }),
    );
  });

  it('ispravak zadržava vezu na ZET original', async () => {
    const { service, uploadModel } = napravi({
      _id: 'u1',
      sha256: hash,
      izvorni_sha256: 'zet-original',
      verzija: '2026-45-1',
    });

    await service.processPdf(file, 'rucno', undefined, { prepisi: true });

    const [, update] = uploadModel.updateOne.mock.calls[0];
    expect(update.$set.izvorni_sha256).toBe('zet-original');
    expect(update.$unset).toBeUndefined();
  });

  it('ponovni uvoz ZET originala briše vezu na raniji ispravak', async () => {
    const { service, uploadModel } = napravi({
      _id: 'u1',
      sha256: 'hash-ispravka',
      izvorni_sha256: hash,
      verzija: '2026-45-1',
    });

    await service.processPdf(file, 'rucno', undefined, { prepisi: true });

    const [, update] = uploadModel.updateOne.mock.calls[0];
    expect(update.$set.sha256).toBe(hash);
    expect(update.$unset).toEqual({ izvorni_sha256: 1 });
  });

  it('bez prepisi isti PDF i dalje vraća nema_promjene', async () => {
    const { service, pdf } = napravi({ sha256: hash, verzija: '2026-45-1' });

    const rezultat = await service.processPdf(file, 'rucno');

    expect(rezultat.status).toBe('nema_promjene');
    expect(pdf.extractSluzba).not.toHaveBeenCalled();
  });
});

describe('SluzbaUploadService.getAktualna', () => {
  const lean = (v: any) => ({ lean: () => Promise.resolve(v) });

  const napravi = (disponent: any) => {
    const sluzbaModel = {
      findOne: jest.fn((f: any) =>
        lean({ verzija: f.verzija, sluzbe: [{ br_sl: '1' }] }),
      ),
    };
    const uploadModel = {
      findOne: jest.fn((f: any) =>
        f?.verzija
          ? lean({ verzija: f.verzija, broj_ubacenih: 1 })
          : { sort: () => lean({ verzija: '2026-46-3', broj_ubacenih: 1 }) },
      ),
    };
    const disponentModel = { findOne: jest.fn(() => lean(disponent)) };
    const service = new SluzbaUploadService(
      sluzbaModel as any,
      uploadModel as any,
      {} as any,
      {} as any,
      disponentModel as any,
    );
    return { service, sluzbaModel, disponentModel };
  };

  it('uzima verziju koju koristi disponent tjedna', async () => {
    const { service, sluzbaModel } = napravi({ verzija_sluzbe: '2026-45-1' });

    const r = await service.getAktualna();

    expect(r.verzija).toBe('2026-45-1');
    expect(r.prema_disponentu).toBe(true);
    expect(sluzbaModel.findOne).toHaveBeenCalledWith({ verzija: '2026-45-1' });
    expect(r.sluzbe).toEqual([{ br_sl: '1' }]);
  });

  it('bez disponenta uzima zadnju učitanu verziju', async () => {
    const { service } = napravi(null);

    const r = await service.getAktualna('naredni');

    expect(r.verzija).toBe('2026-46-3');
    expect(r.prema_disponentu).toBe(false);
  });

  it('naredni tjedan je tjedan nakon tekućeg', async () => {
    const { service, disponentModel } = napravi(null);

    const tekuci = await service.getAktualna('tekuci');
    const naredni = await service.getAktualna('naredni');

    const redni = (t: { godina: number; brojTjedna: number }) =>
      t.godina * 53 + t.brojTjedna;
    expect(redni(naredni.tjedan) - redni(tekuci.tjedan)).toBeGreaterThan(0);
    expect(disponentModel.findOne).toHaveBeenCalledTimes(2);
  });
});

describe('SluzbaUploadService – korištene verzije (login ekran)', () => {
  const lanac = (v: any) => ({
    sort: () => ({ lean: () => Promise.resolve(v) }),
  });

  const napravi = (disponenti: any[], dokument: any = { sluzbe: [] }) => {
    const disponentModel = { find: jest.fn(() => lanac(disponenti)) };
    const sluzbaModel = {
      findOne: () => ({ lean: () => Promise.resolve(dokument) }),
    };
    const service = new SluzbaUploadService(
      sluzbaModel as any,
      {} as any,
      {} as any,
      {} as any,
      disponentModel as any,
    );
    return { service, disponentModel };
  };

  it('grupira tjedne po verziji, najnovija verzija prva', async () => {
    const { service } = napravi([
      { godina: 2026, brojTjedna: 47, verzija_sluzbe: '2026-46-1' },
      { godina: 2026, brojTjedna: 46, verzija_sluzbe: '2026-46-1' },
      { godina: 2026, brojTjedna: 45, verzija_sluzbe: '2026-40-2' },
    ]);

    await expect(service.getKoristene()).resolves.toEqual([
      {
        verzija: '2026-46-1',
        tjedni: [
          { godina: 2026, brojTjedna: 47 },
          { godina: 2026, brojTjedna: 46 },
        ],
      },
      { verzija: '2026-40-2', tjedni: [{ godina: 2026, brojTjedna: 45 }] },
    ]);
  });

  it('ne vraća službe verzije koju nije koristio nijedan tjedan', async () => {
    const { service } = napravi([]);

    await expect(service.getKoristenaVerzija('2026-45-3')).rejects.toThrow(
      'nijedan tjedan',
    );
  });

  it('vraća službe i tjedne korištene verzije', async () => {
    const { service } = napravi([{ godina: 2026, brojTjedna: 45 }], {
      sluzbe: [{ br_sl: '1' }],
    });

    await expect(service.getKoristenaVerzija('2026-44-1')).resolves.toEqual({
      verzija: '2026-44-1',
      tjedni: [{ godina: 2026, brojTjedna: 45 }],
      sluzbe: [{ br_sl: '1' }],
    });
  });
});
