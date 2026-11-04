import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Disponent } from '../../schemas/disponent.schema';
import { Sluzba } from '../../schemas/sluzba.schema';
import * as dayjs from 'dayjs';
import * as isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

const DANI = ['pon', 'uto', 'sri', 'cet', 'pet', 'sub', 'ned'];

/** Službe iz verzije za oznaku iz disponenta: "308" je i 308 i njezin dio 308P. */
function pronadiSluzbe(sveSluzbe: any[], oznaka: string): any[] {
  const trazena = (oznaka ?? '').trim().toUpperCase();
  if (!trazena) return [];
  return sveSluzbe.filter((s) => {
    const broj = (s.br_sl ?? '').toUpperCase();
    return broj.startsWith(trazena) && /^P*$/.test(broj.slice(trazena.length));
  });
}

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
    const sluzbeDokumenti = await this.sluzbaModel.find({ verzija }).lean();

    const sveSluzbe = sluzbeDokumenti.flatMap(
      (dokument) => dokument.sluzbe || [],
    );

    const raspored: Record<string, any[]> = {};

    for (const dan of DANI) {
      const brojSluzbe = radnik[dan];
      const pronadeneSluzbe = pronadiSluzbe(sveSluzbe, brojSluzbe);

      raspored[dan] =
        pronadeneSluzbe.length > 0
          ? pronadeneSluzbe
          : [{ odsustvo: brojSluzbe }];
    }

    return raspored;
  }

  /**
   * Dani jednog mjeseca za vozača. Svaki tjedan koristi točno onu verziju
   * službi koju ima njegov disponent; ako ta verzija ne postoji, dan ostaje
   * bez detalja (nikad se ne uzima neka druga verzija).
   */
  async dohvatiKalendar(sluzBroj: string, godina: number, mjesec: number) {
    const prvi = dayjs(`${godina}-${String(mjesec).padStart(2, '0')}-01`);
    const datumi = Array.from({ length: prvi.daysInMonth() }, (_, i) =>
      prvi.add(i, 'day'),
    );
    const kljuc = (g: number, t: number) => `${g}-${t}`;

    const tjedni = new Map<string, { godina: number; brojTjedna: number }>();
    for (const d of datumi) {
      tjedni.set(kljuc(d.isoWeekYear(), d.isoWeek()), {
        godina: d.isoWeekYear(),
        brojTjedna: d.isoWeek(),
      });
    }

    const disponenti: any[] = await this.disponentModel
      .find(
        { $or: [...tjedni.values()] },
        {
          godina: 1,
          brojTjedna: 1,
          verzija_sluzbe: 1,
          radnici: { $elemMatch: { radnik: sluzBroj } },
        },
      )
      .lean();
    const poTjednu = new Map(
      disponenti.map((d) => [kljuc(d.godina, d.brojTjedna), d]),
    );

    const verzije = [
      ...new Set(disponenti.map((d) => d.verzija_sluzbe).filter(Boolean)),
    ];
    const sluzbePoVerziji = new Map<string, any[]>();
    if (verzije.length) {
      const dokumenti = await this.sluzbaModel
        .find({ verzija: { $in: verzije } })
        .lean();
      for (const dok of dokumenti) {
        const lista = sluzbePoVerziji.get(dok.verzija) ?? [];
        lista.push(...(dok.sluzbe || []));
        sluzbePoVerziji.set(dok.verzija, lista);
      }
    }

    const dani: any[] = [];
    for (const d of datumi) {
      const disponent = poTjednu.get(kljuc(d.isoWeekYear(), d.isoWeek()));
      const radnik = disponent?.radnici?.[0];
      const oznaka = (radnik?.[DANI[d.isoWeekday() - 1]] ?? '').trim();
      if (!oznaka) continue;

      const verzija = disponent.verzija_sluzbe ?? null;
      dani.push({
        datum: d.format('YYYY-MM-DD'),
        oznaka,
        verzija,
        sluzbe: pronadiSluzbe(sluzbePoVerziji.get(verzija) ?? [], oznaka),
      });
    }

    return {
      radnik: sluzBroj,
      godina,
      mjesec,
      dostupno: await this.dostupniMjeseci(),
      dani,
    };
  }

  /** Raspon mjeseci ("YYYY-MM") za koje postoji barem jedan disponent. */
  private async dostupniMjeseci() {
    const krajnji = (smjer: 1 | -1) =>
      this.disponentModel
        .findOne({}, { godina: 1, brojTjedna: 1 })
        .sort({ godina: smjer, brojTjedna: smjer })
        .lean();
    const [prvi, zadnji] = await Promise.all([krajnji(1), krajnji(-1)]);
    if (!prvi || !zadnji) return null;

    // 4. siječnja je uvijek u ISO tjednu 1
    const tjedan = (d: { godina: number; brojTjedna: number }) =>
      dayjs(`${d.godina}-01-04`).isoWeek(d.brojTjedna);
    return {
      od: tjedan(prvi).startOf('isoWeek').format('YYYY-MM'),
      do: tjedan(zadnji).endOf('isoWeek').format('YYYY-MM'),
    };
  }
}
