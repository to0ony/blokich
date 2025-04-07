import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Godisnji } from '../../schemas/godisnji.schema';

@Injectable()
export class GodisnjiUploadService {
  constructor(
    @InjectModel(Godisnji.name)
    private readonly godisnjiModel: Model<Godisnji>,
  ) {}

  async processPdf(file: Express.Multer.File) {
    try {
      const scriptPath = path.join(
        __dirname,
        '..',
        '..',
        '..',
        'python',
        'extract_godisnji.py',
      );

      const pythonProcess = spawn('python', [scriptPath, file.path]);

      let stdout = '';
      let stderr = '';

      return new Promise(async (resolve, reject) => {
        pythonProcess.stdout.on('data', (data) => {
          stdout += data.toString('utf-8');
        });

        pythonProcess.stderr.on('data', (data) => {
          stderr += data.toString('utf-8');
        });

        pythonProcess.on('close', async (code) => {
          if (code !== 0) {
            console.error('Python greška:', stderr);
            return reject(
              new InternalServerErrorException('Greška prilikom obrade PDF-a.'),
            );
          }

          try {
            const tempJsonPath = stdout.trim(); // Python skripta vraća putanju JSON datoteke
            const rawContent = await fs.readFile(tempJsonPath, 'utf-8');
            const parsed = JSON.parse(rawContent);

            if (!parsed.vozaci || !Array.isArray(parsed.vozaci)) {
              throw new Error('Neispravan format JSON-a: nedostaje "vozaci".');
            }

            const doc = await this.godisnjiModel.create({
              vozaci: parsed.vozaci,
            });

            resolve({
              poruka: 'Godišnji odmori uspješno spremljeni.',
              id: doc._id,
              brojVozaca: parsed.vozaci.length,
              createdAt: doc.createdAt,
            });
          } catch (err) {
            console.error('Greška pri čitanju JSON datoteke:', err);
            reject(
              new InternalServerErrorException(
                'Greška pri obradi podataka iz Python skripte.',
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
