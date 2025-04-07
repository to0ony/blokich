import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Disponent } from '../../schemas/disponent.schema';
import { Sluzba } from '../../schemas/sluzba.schema';
import { Godisnji } from '../../schemas/godisnji.schema';
import * as dayjs from 'dayjs';
import * as isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

@Injectable()
export class VozaciPoLinijiService {
  constructor(
    @InjectModel(Disponent.name)
    private readonly disponentModel: Model<Disponent>,
    @InjectModel(Sluzba.name)
    private readonly sluzbaModel: Model<Sluzba>,
    @InjectModel(Godisnji.name)
    private readonly godisnjiModel: Model<Godisnji>,
  ) {}

  async dohvatiVozaceZaLiniju(
    linija: string,
    danKey: string,
    tjedanTip: 'trenutni' | 'naredni' = 'trenutni',
  ): Promise<any> {
    const danas = dayjs();
    const datumZaTjedan =
      tjedanTip === 'naredni' ? danas.add(1, 'week') : danas;

    const godina = datumZaTjedan.year();
    const brojTjedna = datumZaTjedan.isoWeek();

    const disponent = await this.disponentModel.findOne({ godina, brojTjedna });
    if (!disponent) {
      throw new NotFoundException('Disponent za traženi tjedan nije pronađen.');
    }

    const radnici: { sluz_broj: number; br_sl: string }[] = [];
    for (const r of disponent.radnici) {
      const br_sl = r[danKey];
      if (br_sl && br_sl !== 'O' && br_sl.trim() !== '') {
        radnici.push({ sluz_broj: Number(r.radnik), br_sl });
      }
    }

    const rezultat: {
      sluz_broj: string;
      ime_prezime: string | null;

      od: string;
      do: string;
      nastup: string;
      zavrsetak: string;

      br_sl?: string;
      linija?: string;
      'V.R'?: string | null;
    }[] = [];

    for (const r of radnici) {
      const sluzbe = await this.sluzbaModel.find({
        linija,
        br_sl: { $regex: `^${r.br_sl}(P*)$`, $options: 'i' },
      });

      for (const sl of sluzbe) {
        rezultat.push({
          sluz_broj: r.sluz_broj.toString().padStart(5, '0'),
          ime_prezime: null,

          od: sl.od,
          do: sl.do,
          nastup: sl.nastup_sluzbe,
          zavrsetak: sl.zavrsna_sluzba,

          br_sl: sl.br_sl,
          linija: sl.linija,
          'V.R': sl.varijanta || null,
        });
      }
    }

    const sluzBrojeviBroj = rezultat.map((v) => Number(v.sluz_broj));
    const godisnjiPodaci = await this.godisnjiModel.find({
      'vozaci.sluz_broj': { $in: sluzBrojeviBroj },
    });

    const mapaImena = new Map<number, string>();
    for (const entry of godisnjiPodaci) {
      for (const v of entry.vozaci) {
        mapaImena.set(Number(v.sluz_broj), v.ime_prezime);
      }
    }

    for (const v of rezultat) {
      const broj = Number(v.sluz_broj);
      v.ime_prezime = mapaImena.get(broj) || null;
    }

    rezultat.sort((a, b) => a.od.localeCompare(b.od));

    // Format datuma
    const danIndexMap: Record<string, number> = {
      pon: 0,
      uto: 1,
      sri: 2,
      cet: 3,
      pet: 4,
      sub: 5,
      ned: 6,
    };

    const targetDan = danIndexMap[danKey];
    const startOfWeek = datumZaTjedan.startOf('isoWeek');
    const datumDana = startOfWeek.add(targetDan, 'day');

    const dan = datumDana.format('DD/MM/YYYY');

    return {
      dan,
      linija,
      voze: rezultat,
    };
  }
}
