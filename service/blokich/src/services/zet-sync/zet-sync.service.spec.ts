import { ConflictException } from '@nestjs/common';
import { ZetSyncService } from './zet-sync.service';
import { sha256 } from 'src/pdf/pdf-input';

const novo = (sha256: string) => ({
  status: 'novo' as const,
  poruka: `novo ${sha256}`,
  sha256,
  filename: `${sha256}.pdf`,
});
const bezPromjene = {
  status: 'nema_promjene' as const,
  poruka: 'isto',
  filename: 'isto.pdf',
};

describe('ZetSyncService', () => {
  let redoslijed: string[];
  let scraper: any;
  let sluzba: any;
  let disponent: any;
  let service: ZetSyncService;

  beforeEach(() => {
    redoslijed = [];
    scraper = {
      fetchPodsusedPage: jest.fn().mockResolvedValue('<html>'),
      findLink: jest.fn((_: string, dokument: string) => ({
        url: `https://zet/${dokument}.pdf`,
        tekst: dokument,
      })),
      downloadPdf: jest.fn().mockResolvedValue({ buffer: Buffer.from('x') }),
    };
    sluzba = {
      pripremi: jest.fn().mockResolvedValue(novo('s1')),
      spremi: jest.fn(async () => {
        redoslijed.push('sluzba');
        return { poruka: 'sluzbe spremljene' };
      }),
    };
    disponent = {
      pripremi: jest.fn().mockResolvedValue(novo('d1')),
      spremi: jest.fn(async () => {
        redoslijed.push('disponent');
        return { poruka: 'disponent spremljen' };
      }),
    };
    service = new ZetSyncService(scraper, sluzba, disponent);
  });

  describe('provjeriPodsused', () => {
    it('vraća hash novih PDF-ova i ništa ne sprema', async () => {
      const { stavke } = await service.provjeriPodsused();

      const hash = sha256(Buffer.from('x'));
      expect(stavke.map((s) => [s.dokument, s.status, s.sha256])).toEqual([
        ['sluzba', 'novo', hash],
        ['disponent', 'novo', hash],
      ]);
      expect(sluzba.spremi).not.toHaveBeenCalled();
      expect(disponent.spremi).not.toHaveBeenCalled();
    });

    it('greška jednog dokumenta ne prekida provjeru drugog', async () => {
      sluzba.pripremi.mockRejectedValue(new Error('parser pao'));

      const { stavke } = await service.provjeriPodsused();

      expect(stavke[0]).toMatchObject({
        status: 'greska',
        poruka: 'Neuspjelo.',
        url: 'https://zet/sluzba.pdf',
        sha256: sha256(Buffer.from('x')),
      });
      expect(stavke[1].status).toBe('novo');
    });
  });

  describe('uveziPodsused', () => {
    it('sprema prvo službe pa disponent', async () => {
      const { stavke } = await service.uveziPodsused({
        sluzba: 's1',
        disponent: 'd1',
      });

      expect(redoslijed).toEqual(['sluzba', 'disponent']);
      expect(stavke.map((s) => s.status)).toEqual(['obradjeno', 'obradjeno']);
    });

    it('sprema samo novi dokument kad je drugi bez promjene', async () => {
      sluzba.pripremi.mockResolvedValue(bezPromjene);

      const { stavke } = await service.uveziPodsused({ disponent: 'd1' });

      expect(redoslijed).toEqual(['disponent']);
      expect(stavke.map((s) => s.status)).toEqual([
        'nema_promjene',
        'obradjeno',
      ]);
    });

    it('ne sprema ništa ako se PDF promijenio nakon provjere', async () => {
      disponent.pripremi.mockResolvedValue(novo('d2'));

      await expect(
        service.uveziPodsused({ sluzba: 's1', disponent: 'd1' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(redoslijed).toEqual([]);
    });

    it('ne sprema ništa ako je PDF postao nov nakon provjere', async () => {
      await expect(
        service.uveziPodsused({ disponent: 'd1' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(redoslijed).toEqual([]);
    });

    it('ne sprema službe ako parsiranje disponenta padne', async () => {
      disponent.pripremi.mockRejectedValue(new Error('parser pao'));

      await expect(
        service.uveziPodsused({ sluzba: 's1', disponent: 'd1' }),
      ).rejects.toThrow('Neuspjelo.');
      expect(redoslijed).toEqual([]);
    });

    it('staje i javlja grešku ako upis službi padne', async () => {
      sluzba.spremi.mockRejectedValue(new Error('baza pala'));

      const { stavke } = await service.uveziPodsused({
        sluzba: 's1',
        disponent: 'd1',
      });

      expect(stavke).toHaveLength(1);
      expect(stavke[0]).toMatchObject({ status: 'greska', poruka: 'Neuspjelo.' });
      expect(disponent.spremi).not.toHaveBeenCalled();
    });
  });
});
