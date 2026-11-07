import { DisponentUploadService } from './disponent-upload.service';
import { sha256 } from 'src/pdf/pdf-input';

describe('DisponentUploadService – ponovni ručni uvoz (prepisi)', () => {
  const file = { buffer: Buffer.from('disp'), originalname: 'd.pdf' };
  const hash = sha256(file.buffer);
  const parsed = {
    godina: 2026,
    brojTjedna: 46,
    radnici: [{ radnik: '00123', pon: '214' }],
  };

  const napravi = (zadnji: any, postojeciTjedan: any) => {
    const lean = (v: any) => ({ lean: () => Promise.resolve(v) });
    const disponentModel = {
      // pripremi: findOne().sort().lean(); spremi: findOne(tjedan).lean()
      findOne: jest.fn((filter: any) =>
        filter && filter.brojTjedna
          ? lean(postojeciTjedan)
          : { sort: () => lean(zadnji) },
      ),
      deleteOne: jest.fn(),
      create: jest.fn().mockResolvedValue({ _id: 'd1' }),
      updateOne: jest.fn(),
    };
    const sluzbaUploadModel = {
      findOne: () => ({ sort: () => lean({ verzija: '2026-46-2' }) }),
    };
    const godisnjiModel = {
      find: () => lean([]),
      findOne: () => ({ sort: () => Promise.resolve(null) }),
    };
    const pdf = { extractDisponent: jest.fn().mockResolvedValue(parsed) };
    const stats = { preracunajTjedan: jest.fn().mockResolvedValue(1) };
    const rucniUvoz = { zabiljezi: jest.fn() };
    const service = new DisponentUploadService(
      disponentModel as any,
      sluzbaUploadModel as any,
      godisnjiModel as any,
      pdf as any,
      stats as any,
      rucniUvoz as any,
    );
    return { service, disponentModel, pdf };
  };

  it('isti PDF s prepisi prepisuje tjedan i zadržava njegovu verziju službi', async () => {
    const { service, disponentModel, pdf } = napravi(
      { sha256: hash, godina: 2026, brojTjedna: 46 },
      { verzija_sluzbe: '2026-45-1' },
    );

    const rezultat = await service.processPdf(file, 'rucno', undefined, {
      prepisi: true,
    });

    expect(pdf.extractDisponent).toHaveBeenCalled();
    expect(disponentModel.deleteOne).toHaveBeenCalledWith({
      godina: 2026,
      brojTjedna: 46,
    });
    expect(disponentModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ verzija_sluzbe: '2026-45-1', sha256: hash }),
    );
    expect(rezultat).toMatchObject({
      status: 'obradjeno',
      poruka: 'Tjedan 46/2026 prepisan: 1 vozača.',
    });
  });

  it('bez prepisi isti PDF i dalje vraća nema_promjene', async () => {
    const { service, pdf } = napravi(
      { sha256: hash, godina: 2026, brojTjedna: 46 },
      null,
    );

    const rezultat = await service.processPdf(file, 'rucno');

    expect(rezultat.status).toBe('nema_promjene');
    expect(pdf.extractDisponent).not.toHaveBeenCalled();
  });

  it('novi PDF za novi tjedan uzima najnoviju verziju službi', async () => {
    const { service, disponentModel } = napravi(
      { sha256: 'drugi', godina: 2026, brojTjedna: 45 },
      null,
    );

    const rezultat = await service.processPdf(file, 'rucno');

    expect(disponentModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ verzija_sluzbe: '2026-46-2' }),
    );
    expect(rezultat.poruka).toContain('Uspješno spremljeno');
  });
});
