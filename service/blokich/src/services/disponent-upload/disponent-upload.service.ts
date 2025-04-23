import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { spawn } from 'child_process';
import * as path from 'path';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Disponent } from '../../schemas/disponent.schema';
import { SluzbaUpload } from '../../schemas/sluzba-upload.schema';
import { Godisnji } from '../../schemas/godisnji.schema';
import { PdfProcessingService } from 'src/pdf/pdf-processing.service';

@Injectable()
export class DisponentUploadService {
  constructor(
    @InjectModel(Disponent.name)
    private readonly disponentModel: Model<Disponent>,
    @InjectModel(SluzbaUpload.name)
    private readonly sluzbaUploadModel: Model<SluzbaUpload>,
    @InjectModel(Godisnji.name)
    private readonly godisnjiModel: Model<Godisnji>,
    private readonly pdfProcessingService: PdfProcessingService,
  ) {}

  private async addNewDriversToGodisnji(rawSluzBrojevi: string[]) {
    // Normalizacija ulaznih brojeva – ukloni vodeće nule i ignoriraj loše unose
    const cleanedSluzBrojevi = rawSluzBrojevi
      .filter((broj) => typeof broj === 'string' && broj.trim().length > 0)
      .map((broj) => broj.replace(/^0+/, ''));

    // Dohvati sve postojeće brojeve iz godisnji
    const existingDocs = await this.godisnjiModel
      .find({}, 'vozaci.sluz_broj')
      .lean();
    const existingSluzBrojevi = new Set<string>();

    for (const doc of existingDocs) {
      for (const vozac of doc.vozaci || []) {
        if (vozac.sluz_broj && typeof vozac.sluz_broj === 'string') {
          existingSluzBrojevi.add(vozac.sluz_broj.replace(/^0+/, ''));
        }
      }
    }

    // Pronađi nove koje treba dodati
    const noviVozaci = cleanedSluzBrojevi.filter(
      (broj) => !existingSluzBrojevi.has(broj),
    );

    // Ako ima novih – dodaj ih u najnoviji godisnji
    if (noviVozaci.length > 0) {
      const targetGodisnji = await this.godisnjiModel
        .findOne()
        .sort({ createdAt: -1 });

      if (targetGodisnji) {
        for (const broj of noviVozaci) {
          targetGodisnji.vozaci.push({
            sluz_broj: broj,
            ime_prezime: '?',
            godisnji: [],
            ukupno_dana: '0',
          });
        }
        await targetGodisnji.save();
        console.log(`✅ Dodano ${noviVozaci.length} novih vozača u godisnji.`);
      }
    }
  }

  async processPdf(file: Express.Multer.File) {
    try {
      const parsed = await this.pdfProcessingService.extractDisponent(file);

      if (!parsed.godina || !parsed.brojTjedna || !parsed.radnici) {
        throw new Error('Nedostaju ključna polja u JSON-u.');
      }

      const sviSluzBrojevi = parsed.radnici.map((r: any) => r.radnik);
      await this.addNewDriversToGodisnji(sviSluzBrojevi);

      await this.disponentModel.deleteOne({
        godina: parsed.godina,
        brojTjedna: parsed.brojTjedna,
      });

      const verzijaSluzbi = await this.sluzbaUploadModel
        .findOne()
        .sort({ datum_unosa: -1 })
        .lean();

      const doc = await this.disponentModel.create({
        ...parsed,
        datum_unosa: new Date(),
        verzija_sluzbe: verzijaSluzbi?.verzija || null,
      });

      return {
        poruka: `Uspješno spremljen disponent za tjedan ${parsed.brojTjedna}/${parsed.godina}`,
        verzija: verzijaSluzbi?.verzija || null,
        id: doc._id,
      };
    } catch (error) {
      console.error('Greška:', error);
      throw new InternalServerErrorException(
        error.message || 'Greška prilikom obrade PDF-a.',
      );
    }
  }

  async getLastUploadInfo() {
    const last = await this.disponentModel
      .findOne()
      .sort({ datum_unosa: -1 })
      .lean();

    if (!last) {
      throw new NotFoundException('Nema spremljenih disponenta.');
    }

    return {
      datum_unosa: last.datum_unosa,
      brojTjedna: last.brojTjedna,
      godina: last.godina,
    };
  }
}
