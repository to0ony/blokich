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
import { PdfInput, PdfIzvor, sha256 } from 'src/pdf/pdf-input';
import { VozacStatsService } from '../vozac-stats/vozac-stats.service';
import { RucniUvozService } from '../rucni-uvoz/rucni-uvoz.service';

export interface DisponentPripremaNovo {
  status: 'novo';
  poruka: string;
  sha256: string;
  parsed: any;
  filename: string;
}

export type DisponentPriprema =
  | DisponentPripremaNovo
  | {
      status: 'nema_promjene';
      poruka: string;
      brojTjedna: number;
      godina: number;
      filename: string;
    };

const POVIJEST_LIMIT = 50;

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
    private readonly vozacStatsService: VozacStatsService,
    private readonly rucniUvozService: RucniUvozService,
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
            kontakt_broj: '',
            kontakt_broj_info: '',
          });
        }
        await targetGodisnji.save();
        console.log(`✅ Dodano ${noviVozaci.length} novih vozača u godisnji.`);
      }
    }
  }

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
          await this.disponentModel.updateOne(
            { sha256: sha256(file.buffer) },
            { izvorni_sha256: izvorniSha256 },
          );
        }
        return priprema;
      }

      const rezultat = await this.spremi(file, priprema, izvor, izvorniSha256);

      if (izvor === 'rucno') {
        await this.rucniUvozService.zabiljezi({
          dokument: 'disponent',
          oznaka: `${rezultat.brojTjedna}/${rezultat.godina}`,
          original_filename: file.originalname,
          sha256: priprema.sha256,
          izvorni_sha256: izvorniSha256,
        });
      }
      return rezultat;
    } catch (error) {
      console.error('Greška:', error);
      throw new InternalServerErrorException(
        error.message || 'Greška prilikom obrade PDF-a.',
      );
    }
  }

  /** Usporedi hash i isparsira PDF. Ne upisuje ništa u bazu. */
  async pripremi(file: PdfInput): Promise<DisponentPriprema> {
    const hash = sha256(file.buffer);

    const zadnji = await this.disponentModel
      .findOne({}, 'sha256 izvorni_sha256 godina brojTjedna')
      .sort({ datum_unosa: -1 })
      .lean();

    if (zadnji?.sha256 === hash || zadnji?.izvorni_sha256 === hash) {
      return {
        status: 'nema_promjene',
        poruka:
          zadnji.sha256 === hash
            ? `Ovaj PDF disponenta je već učitan (tjedan ${zadnji.brojTjedna}/${zadnji.godina}). Nema promjena.`
            : `Ovaj PDF disponenta je već ručno ispravljen (tjedan ${zadnji.brojTjedna}/${zadnji.godina}). Nema promjena.`,
        brojTjedna: zadnji.brojTjedna,
        godina: zadnji.godina,
        filename: file.originalname,
      };
    }

    const parsed = await this.pdfProcessingService.extractDisponent(file);

    if (!parsed.godina || !parsed.brojTjedna || !parsed.radnici?.length) {
      throw new Error('Nedostaju ključna polja u JSON-u.');
    }

    return {
      status: 'novo',
      poruka: `Izvučeno vozača: ${parsed.radnici.length}.`,
      sha256: hash,
      parsed,
      filename: file.originalname,
    };
  }

  async spremi(
    file: PdfInput,
    priprema: DisponentPripremaNovo,
    izvor: PdfIzvor,
    izvorniSha256?: string,
  ) {
    const { parsed, sha256: hash } = priprema;

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
      sha256: hash,
      izvorni_sha256: izvorniSha256,
      izvor,
      original_filename: file.originalname,
    });

    // Greška u statistici ne smije srušiti upload disponenta
    let statistika: number | null = null;
    try {
      statistika = await this.vozacStatsService.preracunajTjedan(
        parsed.godina,
        parsed.brojTjedna,
      );
    } catch (err) {
      console.error('Greška pri izračunu statistike:', err);
    }

    return {
      status: 'obradjeno' as const,
      poruka: `Uspješno spremljeno ${parsed.radnici.length} vozača. Tjedan: ${parsed.brojTjedna}/${parsed.godina}`,
      brojTjedna: parsed.brojTjedna,
      godina: parsed.godina,
      filename: file.originalname,
      verzija: verzijaSluzbi?.verzija || null,
      id: doc._id,
      statistika,
    };
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
      verzija_sluzbe: last.verzija_sluzbe,
    };
  }

  /** Po jedan red za tjedan: ponovni uvoz tjedna zamjenjuje prethodni. */
  async getPovijest() {
    return this.disponentModel.aggregate([
      { $sort: { godina: -1, brojTjedna: -1 } },
      { $limit: POVIJEST_LIMIT },
      {
        $project: {
          godina: 1,
          brojTjedna: 1,
          datum_unosa: 1,
          verzija_sluzbe: 1,
          original_filename: 1,
          sha256: 1,
          izvorni_sha256: 1,
          izvor: 1,
          broj_vozaca: { $size: { $ifNull: ['$radnici', []] } },
        },
      },
    ]);
  }
}
