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

      // Dohvati najnoviji dokument
      let existingDoc = await this.godisnjiModel
        .findOne()
        .sort({ createdAt: -1 });

      if (!existingDoc) {
        // Ako nema postojećeg, stvori novi
        const doc = await this.godisnjiModel.create({
          vozaci: parsed.vozaci,
        });
        return {
          poruka: 'Godišnji odmori uspješno spremljeni.',
          id: doc._id,
          brojVozaca: parsed.vozaci.length,
          createdAt: doc.createdAt,
        };
      }

      // Ažuriraj postojeći dokument
      const existingVozaci = existingDoc.vozaci || [];
      const updatedVozaci = [...existingVozaci];

      for (const newVozac of parsed.vozaci) {
        const existingIndex = updatedVozaci.findIndex(
          (v) => v.sluz_broj === newVozac.sluz_broj,
        );
        if (existingIndex !== -1) {
          // Ažuriraj ime_prezime za postojećeg vozača
          updatedVozaci[existingIndex].ime_prezime = newVozac.ime_prezime;
        } else {
          // Dodaj novog vozača
          updatedVozaci.push(newVozac);
        }
      }

      // Spremi ažurirani dokument
      existingDoc.vozaci = updatedVozaci;
      await existingDoc.save();

      return {
        poruka: 'Godišnji odmori uspješno ažurirani.',
        id: existingDoc._id,
        brojVozaca: updatedVozaci.length,
        updatedAt: existingDoc.updatedAt,
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
