import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Sluzba } from '../../schemas/sluzba.schema';
import { SluzbaUpload } from '../../schemas/sluzba-upload.schema';
import { Disponent } from '../../schemas/disponent.schema';
import { toZonedTime } from 'date-fns-tz';
import { getISOWeek, getISOWeekYear } from 'date-fns';
import { PdfProcessingService } from 'src/pdf/pdf-processing.service';
import { PdfInput, PdfIzvor, sha256 } from 'src/pdf/pdf-input';
import { RucniUvozService } from '../rucni-uvoz/rucni-uvoz.service';

export interface SluzbaPripremaNovo {
  status: 'novo';
  poruka: string;
  sha256: string;
  sluzbe: any[];
  filename: string;
  /** Upozorenja parsera (npr. služba čiji se sati ne slažu). */
  upozorenja: string[];
  /** Ponovni ručni uvoz istog PDF-a: prepisuje se ova postojeća verzija. */
  prepisi?: {
    verzija: string;
    uploadId: unknown;
    izvorni_sha256?: string;
  };
}

export interface PripremaOpcije {
  /** Isti PDF se ipak ponovno parsira i prepisuje postojeći uvoz. */
  prepisi?: boolean;
}

export type SluzbaPriprema =
  | SluzbaPripremaNovo
  | {
      status: 'nema_promjene';
      poruka: string;
      verzija: string;
      filename: string;
    };

const POVIJEST_LIMIT = 50;

@Injectable()
export class SluzbaUploadService {
  constructor(
    @InjectModel(Sluzba.name)
    private readonly sluzbaModel: Model<Sluzba>,
    @InjectModel(SluzbaUpload.name)
    private readonly sluzbaUploadModel: Model<SluzbaUpload>,
    private readonly pdfProcessingService: PdfProcessingService,
    private readonly rucniUvozService: RucniUvozService,
    @InjectModel(Disponent.name)
    private readonly disponentModel: Model<Disponent>,
  ) {}

  async processPdf(
    file: PdfInput,
    izvor: PdfIzvor = 'rucno',
    izvorniSha256?: string,
    opcije: PripremaOpcije = {},
  ) {
    try {
      const priprema = await this.pripremi(file, opcije);

      if (priprema.status !== 'novo') {
        // Već učitan PDF može naknadno postati ispravak ZET-ovog originala.
        if (izvorniSha256) {
          await this.sluzbaUploadModel.updateOne(
            { sha256: sha256(file.buffer) },
            { izvorni_sha256: izvorniSha256 },
          );
        }
        return priprema;
      }

      const rezultat = await this.spremi(file, priprema, izvor, izvorniSha256);

      if (izvor === 'rucno') {
        await this.rucniUvozService.zabiljezi({
          dokument: 'sluzba',
          oznaka: rezultat.verzija,
          original_filename: file.originalname,
          sha256: priprema.sha256,
          izvorni_sha256: izvorniSha256,
        });
      }
      return rezultat;
    } catch (error) {
      console.error('Greška pri obradi PDF-a:', error);
      throw new InternalServerErrorException(
        error.message || 'Greška prilikom obrade PDF-a.',
      );
    }
  }

  /**
   * Usporedi hash i isparsira PDF. Ne upisuje ništa u bazu.
   * S `prepisi` isti PDF se ipak parsira, a spremi() prepisuje njegovu verziju.
   */
  async pripremi(
    file: PdfInput,
    opcije: PripremaOpcije = {},
  ): Promise<SluzbaPriprema> {
    const hash = sha256(file.buffer);

    const zadnji = await this.sluzbaUploadModel
      .findOne()
      .sort({ datum_unosa: -1 })
      .lean();

    const isti = zadnji?.sha256 === hash || zadnji?.izvorni_sha256 === hash;

    if (isti && !opcije.prepisi) {
      return {
        status: 'nema_promjene',
        poruka:
          zadnji.sha256 === hash
            ? `Ovaj PDF službi je već učitan (verzija ${zadnji.verzija}). Nema promjena.`
            : `Ovaj PDF službi je već ručno ispravljen (verzija ${zadnji.verzija}). Nema promjena.`,
        verzija: zadnji.verzija,
        filename: file.originalname,
      };
    }

    const response = await this.pdfProcessingService.extractSluzba(file);
    const sluzbe: any[] = response.sluzbe;
    const upozorenja: string[] = response.upozorenja ?? [];

    if (!sluzbe?.length) {
      throw new Error('Iz PDF-a službi nije izvučena nijedna služba.');
    }
    if (upozorenja.length) {
      console.warn(
        `PDF službi ${file.originalname}: ${upozorenja.length} upozorenja parsera`,
        upozorenja,
      );
    }

    return {
      status: 'novo',
      poruka:
        `Izvučeno službi: ${sluzbe.length}.` +
        (upozorenja.length ? ` Upozorenja: ${upozorenja.length}.` : ''),
      sha256: hash,
      sluzbe,
      filename: file.originalname,
      upozorenja,
      ...(isti && zadnji?.verzija
        ? {
            prepisi: {
              verzija: zadnji.verzija,
              uploadId: zadnji._id,
              // Ponovni uvoz ZET originala briše vezu na raniji ispravak.
              izvorni_sha256:
                zadnji.izvorni_sha256 === hash
                  ? undefined
                  : zadnji.izvorni_sha256,
            },
          }
        : {}),
    };
  }

  async spremi(
    file: PdfInput,
    priprema: SluzbaPripremaNovo,
    izvor: PdfIzvor,
    izvorniSha256?: string,
  ) {
    const { sluzbe, sha256: hash } = priprema;

    if (priprema.prepisi) {
      return this.prepisi(file, priprema, izvor, izvorniSha256);
    }

    const verzija = await this.generateVersion();

    await this.sluzbaModel.create({ verzija, sluzbe });

    await this.sluzbaUploadModel.create({
      datum_unosa: new Date(),
      broj_ubacenih: sluzbe.length,
      original_filename: file.originalname,
      verzija,
      sha256: hash,
      izvorni_sha256: izvorniSha256,
      izvor,
    });

    return {
      status: 'obradjeno' as const,
      poruka: `Uspješno spremljeno ${sluzbe.length} službi. Verzija: ${verzija}`,
      verzija,
      filename: file.originalname,
    };
  }

  /**
   * Isti PDF ponovno: službe postojeće verzije zamjenjuju se novo izvučenima.
   * Verzija ostaje ista, pa disponenti koji je koriste ostaju povezani.
   */
  private async prepisi(
    file: PdfInput,
    priprema: SluzbaPripremaNovo,
    izvor: PdfIzvor,
    izvorniSha256?: string,
  ) {
    const { sluzbe, sha256: hash } = priprema;
    const { verzija, uploadId } = priprema.prepisi!;

    const { matchedCount } = await this.sluzbaModel.updateOne(
      { verzija },
      { $set: { sluzbe } },
    );
    if (!matchedCount) {
      await this.sluzbaModel.create({ verzija, sluzbe });
    }

    const izvorni = izvorniSha256 ?? priprema.prepisi!.izvorni_sha256;
    const set: Record<string, unknown> = {
      datum_unosa: new Date(),
      broj_ubacenih: sluzbe.length,
      original_filename: file.originalname,
      sha256: hash,
      izvor,
    };
    if (izvorni) set.izvorni_sha256 = izvorni;
    await this.sluzbaUploadModel.updateOne(
      { _id: uploadId },
      izvorni ? { $set: set } : { $set: set, $unset: { izvorni_sha256: 1 } },
    );

    return {
      status: 'obradjeno' as const,
      poruka: `Verzija ${verzija} prepisana: ${sluzbe.length} službi.`,
      verzija,
      filename: file.originalname,
    };
  }

  private async generateVersion(): Promise<string> {
    const timeZone = 'Europe/Zagreb';
    const now = toZonedTime(new Date(), timeZone);

    const currentYear = getISOWeekYear(now);
    const currentWeek = getISOWeek(now);

    const lastUpload = await this.sluzbaUploadModel
      .findOne({
        verzija: new RegExp(`^${currentYear}-${currentWeek}-\\d+$`),
      })
      .sort({ datum_unosa: -1 })
      .lean();

    let nextNumber = 1;
    if (lastUpload && lastUpload.verzija) {
      const parts = lastUpload.verzija.split('-');
      nextNumber = parseInt(parts[2], 10) + 1;
    }

    return `${currentYear}-${currentWeek}-${nextNumber}`;
  }

  async getLastUploadInfo() {
    const last = await this.sluzbaUploadModel
      .findOne()
      .sort({ datum_unosa: -1 })
      .lean();

    if (!last) {
      throw new NotFoundException('Nema spremljenih uploadova.');
    }

    return last;
  }

  /**
   * Uvozi službi, najnoviji prvi. Uz svaku verziju idu tjedni čiji disponent
   * koristi tu verziju (disponent.verzija_sluzbe), najnoviji prvi.
   */
  async getPovijest() {
    const uvozi = await this.sluzbaUploadModel
      .find(
        {},
        'datum_unosa broj_ubacenih original_filename verzija sha256 izvorni_sha256 izvor',
      )
      .sort({ datum_unosa: -1 })
      .limit(POVIJEST_LIMIT)
      .lean();

    const verzije = [...new Set(uvozi.map((u) => u.verzija).filter(Boolean))];
    const disponenti = verzije.length
      ? await this.disponentModel
          .find(
            { verzija_sluzbe: { $in: verzije } },
            { godina: 1, brojTjedna: 1, verzija_sluzbe: 1 },
          )
          .sort({ godina: -1, brojTjedna: -1 })
          .lean()
      : [];

    const tjedniPoVerziji = new Map<
      string,
      { godina: number; brojTjedna: number }[]
    >();
    for (const d of disponenti) {
      const lista = tjedniPoVerziji.get(d.verzija_sluzbe) ?? [];
      if (
        !lista.some(
          (t) => t.godina === d.godina && t.brojTjedna === d.brojTjedna,
        )
      ) {
        lista.push({ godina: d.godina, brojTjedna: d.brojTjedna });
      }
      tjedniPoVerziji.set(d.verzija_sluzbe, lista);
    }

    return uvozi.map((u) => ({
      ...u,
      tjedni: (u.verzija && tjedniPoVerziji.get(u.verzija)) || [],
    }));
  }

  /**
   * Verzije službi koje je koristio barem jedan disponent, s tjednima
   * (najnoviji prvi). Verzije koje nijedan tjedan nije koristio se ne vraćaju.
   */
  async getKoristene() {
    const disponenti = await this.disponentModel
      .find(
        { verzija_sluzbe: { $nin: [null, ''] } },
        { godina: 1, brojTjedna: 1, verzija_sluzbe: 1 },
      )
      .sort({ godina: -1, brojTjedna: -1 })
      .lean();

    const poVerziji = new Map<
      string,
      { godina: number; brojTjedna: number }[]
    >();
    for (const d of disponenti) {
      const tjedni = poVerziji.get(d.verzija_sluzbe) ?? [];
      if (
        !tjedni.some(
          (t) => t.godina === d.godina && t.brojTjedna === d.brojTjedna,
        )
      ) {
        tjedni.push({ godina: d.godina, brojTjedna: d.brojTjedna });
      }
      poVerziji.set(d.verzija_sluzbe, tjedni);
    }

    // Redoslijed: verzija s najnovijim tjednom prva (Map čuva redoslijed
    // umetanja, a disponenti su sortirani od najnovijeg).
    return [...poVerziji.entries()].map(([verzija, tjedni]) => ({
      verzija,
      tjedni,
    }));
  }

  /** Službe jedne verzije, samo ako ju je koristio neki disponent. */
  async getKoristenaVerzija(verzija: string) {
    const tjedni = await this.disponentModel
      .find({ verzija_sluzbe: verzija }, { godina: 1, brojTjedna: 1 })
      .sort({ godina: -1, brojTjedna: -1 })
      .lean();
    if (!tjedni.length) {
      throw new NotFoundException(
        `Verziju službi ${verzija} nije koristio nijedan tjedan.`,
      );
    }
    const dokument = await this.sluzbaModel.findOne({ verzija }).lean();
    if (!dokument) {
      throw new NotFoundException(`Verzija službi ${verzija} ne postoji.`);
    }
    return {
      verzija,
      tjedni: tjedni.map((t) => ({
        godina: t.godina,
        brojTjedna: t.brojTjedna,
      })),
      sluzbe: dokument.sluzbe ?? [],
    };
  }

  /**
   * Službe koje vrijede za tekući (ili naredni) tjedan: verzija koju koristi
   * disponent tog tjedna, a bez disponenta zadnja učitana verzija.
   */
  async getAktualna(tjedan: 'tekuci' | 'naredni' = 'tekuci') {
    const sada = toZonedTime(new Date(), 'Europe/Zagreb');
    const datum =
      tjedan === 'naredni'
        ? new Date(sada.getTime() + 7 * 24 * 3600 * 1000)
        : sada;
    const godina = getISOWeekYear(datum);
    const brojTjedna = getISOWeek(datum);

    const disponent = await this.disponentModel
      .findOne({ godina, brojTjedna }, 'verzija_sluzbe')
      .lean();

    const uvoz = disponent?.verzija_sluzbe
      ? await this.sluzbaUploadModel
          .findOne({ verzija: disponent.verzija_sluzbe })
          .lean()
      : await this.sluzbaUploadModel.findOne().sort({ datum_unosa: -1 }).lean();

    const verzija = disponent?.verzija_sluzbe ?? uvoz?.verzija;
    if (!verzija) {
      throw new NotFoundException('Još nema učitanih službi.');
    }

    const dokument = await this.sluzbaModel.findOne({ verzija }).lean();
    if (!dokument) {
      throw new NotFoundException(`Verzija službi ${verzija} ne postoji.`);
    }

    return {
      verzija,
      tjedan: { godina, brojTjedna },
      /** false: za taj tjedan nema disponenta, prikazana je zadnja verzija. */
      prema_disponentu: !!disponent?.verzija_sluzbe,
      uvoz: uvoz
        ? {
            datum_unosa: uvoz.datum_unosa,
            original_filename: uvoz.original_filename,
            broj_ubacenih: uvoz.broj_ubacenih,
          }
        : null,
      sluzbe: dokument.sluzbe ?? [],
    };
  }

  /** Sve službe jedne verzije (za pregled u admin panelu). */
  async getVerzija(verzija: string) {
    const dokument = await this.sluzbaModel.findOne({ verzija }).lean();
    if (!dokument) {
      throw new NotFoundException(`Verzija službi ${verzija} ne postoji.`);
    }
    const uvoz = await this.sluzbaUploadModel
      .findOne(
        { verzija },
        'datum_unosa broj_ubacenih original_filename verzija sha256 izvor izvorni_sha256',
      )
      .lean();
    return { verzija, uvoz, sluzbe: dokument.sluzbe ?? [] };
  }
}
