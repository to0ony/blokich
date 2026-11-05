import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Sluzba } from '../../schemas/sluzba.schema';
import { SluzbaUpload } from '../../schemas/sluzba-upload.schema';
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
}

export type SluzbaPriprema =
  | SluzbaPripremaNovo
  | {
      status: 'nema_promjene';
      poruka: string;
      verzija: string;
      filename: string;
    };

@Injectable()
export class SluzbaUploadService {
  constructor(
    @InjectModel(Sluzba.name)
    private readonly sluzbaModel: Model<Sluzba>,
    @InjectModel(SluzbaUpload.name)
    private readonly sluzbaUploadModel: Model<SluzbaUpload>,
    private readonly pdfProcessingService: PdfProcessingService,
    private readonly rucniUvozService: RucniUvozService,
  ) {}

  async processPdf(
    file: PdfInput,
    izvor: PdfIzvor = 'rucno',
    izvorniSha256?: string,
  ) {
    try {
      const priprema = await this.pripremi(file);

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

  /** Usporedi hash i isparsira PDF. Ne upisuje ništa u bazu. */
  async pripremi(file: PdfInput): Promise<SluzbaPriprema> {
    const hash = sha256(file.buffer);

    const zadnji = await this.sluzbaUploadModel
      .findOne()
      .sort({ datum_unosa: -1 })
      .lean();

    if (zadnji?.sha256 === hash || zadnji?.izvorni_sha256 === hash) {
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

    if (!sluzbe?.length) {
      throw new Error('Iz PDF-a službi nije izvučena nijedna služba.');
    }

    const brojLinija = new Set(
      sluzbe.map((s) => s.linija?.trim()).filter(Boolean),
    ).size;

    return {
      status: 'novo',
      poruka: `Izvučeno službi: ${sluzbe.length}, linija: ${brojLinija}.`,
      sha256: hash,
      sluzbe,
      filename: file.originalname,
    };
  }

  async spremi(
    file: PdfInput,
    priprema: SluzbaPripremaNovo,
    izvor: PdfIzvor,
    izvorniSha256?: string,
  ) {
    const { sluzbe, sha256: hash } = priprema;
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
}
