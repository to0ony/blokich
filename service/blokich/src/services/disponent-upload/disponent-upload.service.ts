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
import { VozacStatsService } from '../vozac-stats/vozac-stats.service';
import { SluzbaUpload } from '../../schemas/sluzba-upload.schema';
import { Godisnji } from '../../schemas/godisnji.schema';

@Injectable()
export class DisponentUploadService {
  constructor(
    @InjectModel(Disponent.name)
    private readonly disponentModel: Model<Disponent>,
    private readonly vozacStatsService: VozacStatsService,
    @InjectModel(SluzbaUpload.name)
    private readonly sluzbaUploadModel: Model<SluzbaUpload>,
    @InjectModel(Godisnji.name)
    private readonly godisnjiModel: Model<Godisnji>,
  ) {}

  private async addNewDriversToGodisnji(rawSluzBrojevi: string[]) {
    // 1. Očisti i normaliziraj sve iz disponenta
    const sviSluzBrojevi = rawSluzBrojevi
      .map((sb) => String(sb).trim())
      .filter((sb) => /^[0-9]+$/.test(sb) && sb.length >= 5)
      .map((sb) => sb.replace(/^0+/, '')); // makni vodeće nule

    // 2. Dohvati sve postojeće i normaliziraj jednako
    const existingSluzBrojevi = (
      await this.godisnjiModel.distinct('vozaci.sluz_broj')
    )
      .map((sb) => String(sb).trim())
      .map((sb) => sb.replace(/^0+/, ''));

    // 3. Pronađi nove (koji ne postoje)
    const novi = sviSluzBrojevi.filter(
      (sb) => !existingSluzBrojevi.includes(sb),
    );

    if (novi.length === 0) return;

    const latest = await this.godisnjiModel.findOne().sort({ createdAt: -1 });

    const noviVozaci = novi.map((sb) => ({
      sluz_broj: sb, // bez vodećih nula
      ime_prezime: '',
      godisnji: [],
      ukupno_dana: '0',
    }));

    if (!latest) {
      await this.godisnjiModel.create({ vozaci: noviVozaci });
    } else {
      await this.godisnjiModel.findByIdAndUpdate(latest._id, {
        $push: { vozaci: { $each: noviVozaci } },
      });
    }

    console.log(`✅ Dodano ${novi.length} novih vozača:`, noviVozaci);
  }

  async processPdf(file: Express.Multer.File) {
    try {
      const scriptPath = path.join(
        __dirname,
        '..',
        '..',
        '..',
        'python',
        'extract_disponent.py',
      );

      const pythonProcess = spawn('python', [scriptPath, file.path]);

      let stdout = '';
      let stderr = '';

      return new Promise(async (resolve, reject) => {
        pythonProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        pythonProcess.on('close', async (code) => {
          if (code !== 0) {
            console.error('Python greška:', stderr);
            return reject(
              new InternalServerErrorException('Greška prilikom obrade PDF-a.'),
            );
          }

          try {
            const parsed = JSON.parse(stdout);

            if (!parsed.godina || !parsed.brojTjedna || !parsed.radnici) {
              throw new Error('Nedostaju ključna polja u JSON-u.');
            }

            const sviSluzBrojevi = parsed.radnici.map((r: any) => r.sluz_broj);
            await this.addNewDriversToGodisnji(sviSluzBrojevi);

            // Izbriši postojeći disponent za taj tjedan/godinu
            await this.disponentModel.deleteOne({
              godina: parsed.godina,
              brojTjedna: parsed.brojTjedna,
            });

            // Dohvati najnoviju verziju službi — bez obzira na tjedan
            const verzijaSluzbi = await this.sluzbaUploadModel
              .findOne()
              .sort({ datum_unosa: -1 }) // Sortiraj po datumu unosa (najnoviji prvi)
              .lean();

            // Kreiraj novi disponent s verzijom službi
            const doc = await this.disponentModel.create({
              ...parsed,
              datum_unosa: new Date(),
              verzija_sluzbe: verzijaSluzbi?.verzija || null, // Dodaj verziju službi ako postoji
            });

            /*
            await this.vozacStatsService.generateStatsFromDisponent(parsed);
            */

            resolve({
              poruka: `Uspješno spremljen disponent za tjedan ${parsed.brojTjedna}/${parsed.godina}`,
              verzija: verzijaSluzbi?.verzija || null,
              id: doc._id,
            });
          } catch (err) {
            console.error('Greška pri parsiranju JSON-a:', err);
            reject(
              new InternalServerErrorException(
                'Greška pri parsiranju JSON-a iz Python skripte.',
              ),
            );
          }
        });
      });
    } catch (error) {
      throw new InternalServerErrorException(
        error.message || 'Neuspješna obrada PDF-a',
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
