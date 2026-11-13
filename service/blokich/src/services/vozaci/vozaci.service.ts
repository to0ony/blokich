import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Godisnji } from '../../schemas/godisnji.schema';

@Injectable()
export class VozaciService {
  constructor(
    @InjectModel('Godisnji') private readonly godisnjiModel: Model<Godisnji>,
  ) {}

  async search(q: string) {
    const latest = await this.godisnjiModel
      .findOne()
      .sort({ createdAt: -1 })
      .lean();

    if (!latest || !latest.vozaci) return [];

    const normQuery = normalizeText(q);

    return latest.vozaci
      .filter(
        (v) =>
          v.sluz_broj === q || normalizeText(v.ime_prezime).includes(normQuery),
      )
      .map((v) => ({
        sluz_broj: v.sluz_broj,
        ime_prezime: v.ime_prezime,
      }));
  }
}

function normalizeText(text: string): string {
  return text
    .normalize('NFD') // razdvoji osnovna slova i dijakritike
    .replace(/[\u0300-\u036f]/g, '') // ukloni dijakritike
    .toLowerCase(); // pretvori u mala slova
}
