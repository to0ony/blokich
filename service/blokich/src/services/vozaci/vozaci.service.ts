import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Godisnji } from '../../schemas/godisnji.schema';

@Injectable()
export class VozaciService {
  constructor(
    @InjectModel('Godisnji') private readonly godisnjiModel: Model<Godisnji>,
  ) {}

  /**
   * Pretraga vozača po imenu ili službenom broju. Brojke traže po početku
   * broja (vodeće nule se ne broje), točan broj prvi – za prijedloge pri
   * upisu broja na prijavi. `limit` ograničava broj rezultata.
   */
  async search(q: string, limit?: number) {
    const latest = await this.godisnjiModel
      .findOne()
      .sort({ createdAt: -1 })
      .lean();

    if (!latest || !latest.vozaci) return [];

    const upit = q.trim();
    let rezultat: { sluz_broj: string; ime_prezime: string }[];

    if (/^\d+$/.test(upit)) {
      const bezNula = (b: string) => String(b).replace(/^0+(?=\d)/, '');
      const p = bezNula(upit);
      rezultat = latest.vozaci
        .filter((v) => bezNula(v.sluz_broj).startsWith(p))
        .sort(
          (a, b) =>
            Number(bezNula(b.sluz_broj) === p) -
              Number(bezNula(a.sluz_broj) === p) ||
            Number(a.sluz_broj) - Number(b.sluz_broj),
        );
    } else {
      const normQuery = normalizeText(upit);
      rezultat = latest.vozaci.filter((v) =>
        normalizeText(v.ime_prezime).includes(normQuery),
      );
    }

    return rezultat
      .slice(0, limit && limit > 0 ? limit : undefined)
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
