import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Sluzba } from '../../schemas/sluzba.schema';
import { SluzbaUpload } from '../../schemas/sluzba-upload.schema';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { getISOWeek } from 'date-fns';

@Injectable()
export class SluzbaUploadService {
  constructor(
    @InjectModel(Sluzba.name)
    private readonly sluzbaModel: Model<Sluzba>,
    @InjectModel(SluzbaUpload.name)
    private readonly sluzbaUploadModel: Model<SluzbaUpload>,
  ) {}

  // ...existing code...

  async processPdf(file: Express.Multer.File) {
    try {
      const scriptPath = path.join(
        __dirname,
        '..',
        '..',
        '..',
        'python',
        'extract_sluzba.py',
      );

      const pythonProcess = spawn('python', [scriptPath, file.path]);
      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.setEncoding('utf8');
      pythonProcess.stdout.on('data', (data) => {
        stdout += data;
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      return new Promise((resolve, reject) => {
        pythonProcess.on('close', async (code) => {
          if (code !== 0) {
            console.error('Greška u Python skripti:', stderr);
            return reject(
              new InternalServerErrorException('Greška prilikom obrade PDF-a.'),
            );
          }

          const jsonPath = stdout.trim();

          try {
            const rawContent = fs.readFileSync(jsonPath, 'utf8');
            const parsed: Sluzba[] = JSON.parse(rawContent);

            // Generiraj verziju
            const verzija = await this.generateVersion();

            // Dodaj vrijeme unosa i verziju
            const withTimestamps = parsed.map((item) => ({
              ...item,
              datum_unosa: new Date(),
              verzija,
            }));

            // Očisti kolekciju
            await this.sluzbaModel.insertMany(withTimestamps);

            // Sprema info o uploadu
            await this.sluzbaUploadModel.create({
              datum_unosa: new Date(),
              broj_ubacenih: withTimestamps.length,
              filename: file.filename,
              original_filename: file.originalname,
              verzija,
            });

            // Obriši privremeni JSON
            fs.unlinkSync(jsonPath);

            resolve({
              poruka: `Uspješno spremljeno ${withTimestamps.length} službi (nakon brisanja starih).`,
            });
          } catch (err) {
            console.error('Greška u parsiranju JSON-a:', err);
            reject(
              new InternalServerErrorException(
                'Neispravan izlaz iz Python skripte.',
              ),
            );
          }
        });
      });
    } catch (error) {
      throw new InternalServerErrorException(
        error.message || 'Greška prilikom obrade PDF-a.',
      );
    }
  }

  private async generateVersion(): Promise<string> {
    const timeZone = 'Europe/Zagreb'; // Hrvatska vremenska zona
    const now = toZonedTime(new Date(), timeZone); // Pretvori trenutni datum u hrvatsku vremensku zonu

    const currentYear = now.getFullYear();
    const currentWeek = getISOWeek(now); // Dobij ISO tjedan prema lokalnom vremenu

    // Pronađi posljednji upload za trenutni tjedan i godinu
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
