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

@Injectable()
export class SluzbaUploadService {
  constructor(
    @InjectModel(Sluzba.name)
    private readonly sluzbaModel: Model<Sluzba>,
    @InjectModel(SluzbaUpload.name)
    private readonly sluzbaUploadModel: Model<SluzbaUpload>,
    private readonly pdfProcessingService: PdfProcessingService,
  ) {}

  async processPdf(file: Express.Multer.File) {
    try {
      const response = await this.pdfProcessingService.extractSluzba(file);
      const parsed = response.sluzbe;

      const verzija = await this.generateVersion();

      await this.sluzbaModel.create({
        verzija,
        sluzbe: parsed,
      });

      await this.sluzbaUploadModel.create({
        datum_unosa: new Date(),
        broj_ubacenih: parsed.length,
        filename: file.filename,
        original_filename: file.originalname,
        verzija,
      });

      return {
        poruka: `Uspješno spremljeno ${parsed.length} službi. Verzija: ${verzija}`,
      };
    } catch (error) {
      console.error('Greška pri obradi PDF-a:', error);
      throw new InternalServerErrorException(
        error.message || 'Greška prilikom obrade PDF-a.',
      );
    }
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
