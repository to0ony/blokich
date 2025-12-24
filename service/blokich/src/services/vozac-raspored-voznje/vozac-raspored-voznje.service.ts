import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Disponent } from '../../schemas/disponent.schema';
import { Sluzba } from '../../schemas/sluzba.schema';
import * as dayjs from 'dayjs';
import * as isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

@Injectable()
export class VozacRasporedVoznjeService {
  private cache = new Map<string, any>();

  constructor(
    @InjectModel(Disponent.name)
    private readonly disponentModel: Model<Disponent>,
    @InjectModel(Sluzba.name)
    private readonly sluzbaModel: Model<Sluzba>,
  ) {}

  private izracunajBrojTjedna(datum: Date): number {
    return dayjs(datum).isoWeek();
  }

  async dohvatiRasporedZaVozaca(sluzBroj: string): Promise<any> {
    const danas = new Date();
    const brojTjedna = this.izracunajBrojTjedna(danas);
    const godina = dayjs(danas).isoWeekYear();

    return this.dohvatiRaspored(sluzBroj, godina, brojTjedna);
  }

  async dohvatiNaredniTjedanRasporedZaVozaca(sluzBroj: string): Promise<any> {
    const danas = new Date();
    const nextWeekDate = dayjs(danas).add(1, 'week');
    const brojTjedna = nextWeekDate.isoWeek();
    const godina = nextWeekDate.isoWeekYear();

    return this.dohvatiRaspored(sluzBroj, godina, brojTjedna);
  }

  private async dohvatiRaspored(
    sluzBroj: string,
    godina: number,
    brojTjedna: number,
  ): Promise<any> {
    const disponent = await this.disponentModel
      .findOne({ godina, brojTjedna })
      .lean();

    if (!disponent) return null;

    const radnik = disponent.radnici.find((r) => r.radnik === sluzBroj);
    if (!radnik) return null;

    const verzija = disponent.verzija_sluzbe;
    if (!verzija) return null;

    const raspored = await this.generirajRaspored(radnik, verzija);

    const rezultat = {
      radnik: sluzBroj,
      tjedan: brojTjedna,
      godina,
      verzija,
      raspored,
    };

    return rezultat;
  }

  private async generirajRaspored(
    radnik: any,
    verzija: string,
  ): Promise<Record<string, any[]>> {
    const dani = ['pon', 'uto', 'sri', 'cet', 'pet', 'sub', 'ned'];
    const vrijednostiZaDane = dani.map((dan) => radnik[dan]);
    const regexi = vrijednostiZaDane.map((v) => new RegExp(`^${v}(P*)$`, 'i'));

    const sveSluzbe = await this.sluzbaModel
      .find({
        verzija,
        br_sl: { $in: regexi },
      })
      .lean();

    const raspored: Record<string, any[]> = {};

    for (let i = 0; i < dani.length; i++) {
      const dan = dani[i];
      const vrijednost = vrijednostiZaDane[i];

      const matchingSluzbe = sveSluzbe.filter((s) =>
        new RegExp(`^${vrijednost}(P*)$`, 'i').test(s.br_sl),
      );

      raspored[dan] =
        matchingSluzbe.length > 0 ? matchingSluzbe : [{ odsustvo: vrijednost }];
    }

    return raspored;
  }
}
