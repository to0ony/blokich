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

    const mondayOfWeek = datumZaTjedan.startOf('isoWeek');
    const thursdayOfWeek = mondayOfWeek.add(3, 'day');
    const godina = thursdayOfWeek.year();
    const brojTjedna = datumZaTjedan.isoWeek();

    const disponent = await this.disponentModel.findOne({ godina, brojTjedna });
    if (!disponent) {
      throw new NotFoundException('Disponent za traženi tjedan nije pronađen.');
    }

    const verzijaSluzbe = disponent.verzija_sluzbe;

    const radnici: { sluz_broj: number; br_sl: string }[] = [];
    for (const radnik of disponent.radnici) {
      const br_sl = radnik[danKey];
      if (br_sl && br_sl !== 'O' && br_sl.trim() !== '') {
        radnici.push({ sluz_broj: Number(radnik.radnik), br_sl });
      }
    }

    // Dohvati sve sluzbe za verziju
    const sluzbeDokumenti = await this.sluzbaModel
      .find({ verzija: verzijaSluzbe })
      .lean();

    // Flattaj sve sluzbe iz svih dokumenata
    const sveSluzbe = sluzbeDokumenti.flatMap(
      (dokument) => dokument.sluzbe || [],
    );

    // Filtriraj sluzbe za svakog radnika i liniju
    const sluzbePoRadnicima = radnici.map((radnik) => {
      const regex = new RegExp(`^${radnik.br_sl}(P*)$`, 'i');
      return sveSluzbe.filter(
        (sluzba) => sluzba.linija === linija && regex.test(sluzba.br_sl),
      );
    });

    // Sastavi rezultat
    const rezultat: {
      sluz_broj: string;
      ime_prezime: string | null;
      kontakt_broj: string | null;
      kontakt_broj_info: string | null;
      od: string;
      do: string;
      nastup: string;
      zavrsetak: string;
      br_sl?: string;
      linija?: string;
      'V.R'?: string | null;
    }[] = [];

    radnici.forEach((radnik, index) => {
      const sluzbe = sluzbePoRadnicima[index];
      for (const sluzba of sluzbe) {
        rezultat.push({
          sluz_broj: radnik.sluz_broj.toString().padStart(5, '0'),
          ime_prezime: null,
          kontakt_broj: null,
          kontakt_broj_info: null,
          od: sluzba.od,
          do: sluzba.do,
          nastup: sluzba.nastup_sluzbe,
          zavrsetak: sluzba.zavrsna_sluzba,
          br_sl: sluzba.br_sl,
          linija: sluzba.linija,
          'V.R': sluzba.varijanta || null,
        });
      }
    });

    const sluzbeBrojevi = rezultat.map((vozac) => Number(vozac.sluz_broj));
    const najnovijiGodisnji = await this.godisnjiModel
      .findOne({ 'vozaci.sluz_broj': { $in: sluzbeBrojevi } })
      .sort({ createdAt: -1 });

    const mapaImena = new Map<number, string>();
    const mapaKontakta = new Map<
      number,
      { kontakt_broj: string | null; kontakt_broj_info: string | null }
    >();
    if (najnovijiGodisnji) {
      for (const vozac of najnovijiGodisnji.vozaci) {
        mapaImena.set(Number(vozac.sluz_broj), vozac.ime_prezime);
        mapaKontakta.set(Number(vozac.sluz_broj), {
          kontakt_broj: vozac.kontakt_broj || null,
          kontakt_broj_info: vozac.kontakt_broj_info || null,
        });
      }
    }

    for (const vozac of rezultat) {
      const broj = Number(vozac.sluz_broj);
      vozac.ime_prezime = mapaImena.get(broj) || null;
      const kontakt = mapaKontakta.get(broj);
      vozac.kontakt_broj = kontakt?.kontakt_broj ?? null;
      vozac.kontakt_broj_info = kontakt?.kontakt_broj_info ?? null;
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
      verzija: verzijaSluzbe,
      voze: rezultat,
    };
  }
}
