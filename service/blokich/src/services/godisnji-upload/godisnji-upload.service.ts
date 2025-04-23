import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Godisnji } from '../../schemas/godisnji.schema';
import { PdfProcessingService } from 'src/pdf/pdf-processing.service';

@Injectable()
export class GodisnjiUploadService {
  constructor(
    @InjectModel(Godisnji.name)
    private readonly godisnjiModel: Model<Godisnji>,
    private readonly pdfProcessingService: PdfProcessingService,
  ) {}

  async processPdf(file: Express.Multer.File) {
    try {
      const parsed = await this.pdfProcessingService.extractGodisnji(file);

      if (!parsed.vozaci || !Array.isArray(parsed.vozaci)) {
        throw new Error('Neispravan format JSON-a: nedostaje "vozaci".');
      }

      const doc = await this.godisnjiModel.create({
        vozaci: parsed.vozaci,
      });

      return {
        poruka: 'Godišnji odmori uspješno spremljeni.',
        id: doc._id,
        brojVozaca: parsed.vozaci.length,
        createdAt: doc.createdAt,
      };
    } catch (error) {
      console.error('Greška pri obradi PDF-a:', error);
      throw new InternalServerErrorException(
        error.message || 'Greška prilikom obrade PDF-a.',
      );
    }
  }

  async getLastUploadInfo() {
    const last = await this.godisnjiModel
      .findOne()
      .sort({ createdAt: -1 })
      .lean();

    if (!last) {
      throw new NotFoundException('Nema unosa godišnjih odmora.');
    }

    return {
      createdAt: last.createdAt,
      brojVozaca: last.vozaci?.length || 0,
    };
  }
}
