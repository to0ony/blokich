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
export class VozaciPoSluzbiDanService {
  constructor(
    @InjectModel(Disponent.name)
    private readonly disponentModel: Model<Disponent>,
    @InjectModel(Sluzba.name)
    private readonly sluzbaModel: Model<Sluzba>,
    @InjectModel(Godisnji.name)
    private readonly godisnjiModel: Model<Godisnji>,
  ) {}

  async dohvatiVozaceZaSluzbu(
    brojSluzbe: string,
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

    // Dohvati sve sluzbe za verziju
    const sluzbeDokumenti = await this.sluzbaModel
      .find({ verzija: verzijaSluzbe })
      .lean();

    const sveSluzbe = sluzbeDokumenti.flatMap(
      (dokument) => dokument.sluzbe || [],
    );

    // Pronađi službu po broju
    const regex = new RegExp(`^${brojSluzbe}(P*)$`, 'i');
    const pronadenaSluzba = sveSluzbe.find((sluzba) =>
      regex.test(sluzba.br_sl),
    );

    if (!pronadenaSluzba) {
      throw new NotFoundException(
        `Služba ${brojSluzbe} nije pronađena u verziji ${verzijaSluzbe}`,
      );
    }

    // Pronađi sve radnike koji voze tu službu tog dana
    const radnici: { sluz_broj: number; br_sl: string }[] = [];
    for (const radnik of disponent.radnici) {
      const br_sl = radnik[danKey];
      if (br_sl && regex.test(br_sl)) {
        radnici.push({ sluz_broj: Number(radnik.radnik), br_sl });
      }
    }

    // Sastavi rezultat
    const rezultat: {
      sluz_broj: string;
      ime_prezime: string | null;
      kontakt_broj: string | null;
      kontakt_broj_info: string | null;
    }[] = [];

    for (const radnik of radnici) {
      rezultat.push({
        sluz_broj: radnik.sluz_broj.toString().padStart(5, '0'),
        ime_prezime: null,
        kontakt_broj: null,
        kontakt_broj_info: null,
      });
    }

    // Dohvati dodatne informacije o vozačima iz godišnjih
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
      br_sl: pronadenaSluzba.br_sl,
      linija: pronadenaSluzba.linija,
      varijanta: pronadenaSluzba.varijanta,
      od: pronadenaSluzba.od,
      do: pronadenaSluzba.do,
      nastup_sluzbe: pronadenaSluzba.nastup_sluzbe,
      zavrsna_sluzba: pronadenaSluzba.zavrsna_sluzba,
      nocni_rad: pronadenaSluzba.nocni_rad,
      druga_smjena: pronadenaSluzba.druga_smjena,
      efektivni_sati: pronadenaSluzba.efektivni_sati,
      ukupni_sati: pronadenaSluzba.ukupni_sati,
      verzija: verzijaSluzbe,
      vozaci: rezultat,
    };
  }

  async dohvatiVozaceZaSluzbyCijeliTjedan(
    brojSluzbe: string,
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

    // Dohvati sve sluzbe za verziju
    const sluzbeDokumenti = await this.sluzbaModel
      .find({ verzija: verzijaSluzbe })
      .lean();

    const sveSluzbe = sluzbeDokumenti.flatMap(
      (dokument) => dokument.sluzbe || [],
    );

    // Pronađi službu po broju
    const regex = new RegExp(`^${brojSluzbe}(P*)$`, 'i');
    const pronadenaSluzba = sveSluzbe.find((sluzba) =>
      regex.test(sluzba.br_sl),
    );

    if (!pronadenaSluzba) {
      throw new NotFoundException(
        `Služba ${brojSluzbe} nije pronađena u verziji ${verzijaSluzbe}`,
      );
    }

    const dani = ['pon', 'uto', 'sri', 'cet', 'pet', 'sub', 'ned'];
    const danIndexMap: Record<string, number> = {
      pon: 0,
      uto: 1,
      sri: 2,
      cet: 3,
      pet: 4,
      sub: 5,
      ned: 6,
    };

    const rasporedPoTjednu: any[] = [];
    const sviRadnici: number[] = [];

    for (const danKey of dani) {
      // Pronađi sve radnike koji voze tu službu tog dana
      const radnici: { sluz_broj: number; br_sl: string }[] = [];
      for (const radnik of disponent.radnici) {
        const br_sl = radnik[danKey];
        if (br_sl && regex.test(br_sl)) {
          const broj = Number(radnik.radnik);
          radnici.push({ sluz_broj: broj, br_sl });
          if (!sviRadnici.includes(broj)) {
            sviRadnici.push(broj);
          }
        }
      }

      const targetDan = danIndexMap[danKey];
      const startOfWeek = datumZaTjedan.startOf('isoWeek');
      const datumDana = startOfWeek.add(targetDan, 'day');
      const dan = datumDana.format('DD/MM/YYYY');

      rasporedPoTjednu.push({
        dan: danKey,
        datum: dan,
        broj_vozaca: radnici.length,
        sluz_brojevi: radnici.map((r) =>
          r.sluz_broj.toString().padStart(5, '0'),
        ),
      });
    }

    // Dohvati informacije o vozačima iz godišnjih
    const najnovijiGodisnji = await this.godisnjiModel
      .findOne({ 'vozaci.sluz_broj': { $in: sviRadnici } })
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

    // Dodaj informacije o vozačima u raspored
    for (const danRaspored of rasporedPoTjednu) {
      danRaspored.vozaci = danRaspored.sluz_brojevi.map((sluz_broj: string) => {
        const broj = Number(sluz_broj);
        const kontakt = mapaKontakta.get(broj);
        return {
          sluz_broj,
          ime_prezime: mapaImena.get(broj) || null,
          kontakt_broj: kontakt?.kontakt_broj ?? null,
          kontakt_broj_info: kontakt?.kontakt_broj_info ?? null,
        };
      });
      delete danRaspored.sluz_brojevi;
    }

    return {
      br_sl: pronadenaSluzba.br_sl,
      linija: pronadenaSluzba.linija,
      varijanta: pronadenaSluzba.varijanta,
      od: pronadenaSluzba.od,
      do: pronadenaSluzba.do,
      nastup_sluzbe: pronadenaSluzba.nastup_sluzbe,
      zavrsna_sluzba: pronadenaSluzba.zavrsna_sluzba,
      nocni_rad: pronadenaSluzba.nocni_rad,
      druga_smjena: pronadenaSluzba.druga_smjena,
      efektivni_sati: pronadenaSluzba.efektivni_sati,
      ukupni_sati: pronadenaSluzba.ukupni_sati,
      verzija: verzijaSluzbe,
      tjedan: brojTjedna,
      godina: godina,
      raspored: rasporedPoTjednu,
    };
  }
}
