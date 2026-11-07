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
    const service = new SluzbaUploadService(
      sluzbaModel as any,
      uploadModel as any,
      pdf as any,
      rucniUvoz as any,
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
