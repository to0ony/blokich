import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Zamjena } from '../../schemas/zamjena.schema';
import {
  DisponentZaZamjene,
  StanjeZamjene,
  primijeniZamjene,
} from '../../zamjene/primijeni-zamjene';

export interface PrimijenjenaZamjena {
  zamjena: any;
  stanje: StanjeZamjene;
}

type TjedanDisponenta = DisponentZaZamjene & {
  godina: number;
  brojTjedna: number;
};

const kljuc = (g: number, t: number) => `${g}-${t}`;

/**
 * Primjenjuje zamjene vozača na disponent pri čitanju. Svi servisi koji
 * čitaju disponent idu preko ovoga, da raspored, kolege, karta uživo i
 * statistika vide isto.
 */
@Injectable()
export class ZamjenePrimjenaService {
  /** Vrijeme zadnje promjene zamjena – za poništavanje cacheva. */
  zadnjaPromjena = 0;

  constructor(
    @InjectModel(Zamjena.name) private readonly zamjenaModel: Model<Zamjena>,
  ) {}

  oznaciPromjenu() {
    this.zadnjaPromjena = Date.now();
  }

  /** Primijeni na jedan disponent (mijenja ga); vraća zamjene tog tjedna sa stanjem. */
  async primijeni(
    disponent: TjedanDisponenta | null | undefined,
  ): Promise<PrimijenjenaZamjena[]> {
    if (!disponent) return [];
    return (await this.primijeniSve([disponent])).get(
      kljuc(disponent.godina, disponent.brojTjedna),
    )!;
  }

  /** Primijeni na više tjedana jednim upitom. Ključ mape: "godina-tjedan". */
  async primijeniSve(
    disponenti: (TjedanDisponenta | null | undefined)[],
  ): Promise<Map<string, PrimijenjenaZamjena[]>> {
    const rez = new Map<string, PrimijenjenaZamjena[]>();
    const tjedni = disponenti.filter((d): d is TjedanDisponenta => !!d);
    for (const d of tjedni) rez.set(kljuc(d.godina, d.brojTjedna), []);
    if (!tjedni.length) return rez;

    const zamjene = await this.zamjenaModel
      .find({
        ponistena: null,
        $or: tjedni.map((d) => ({
          godina: d.godina,
          brojTjedna: d.brojTjedna,
        })),
      })
      .sort({ kreirano: 1 })
      .lean();

    const poTjednu = new Map<string, any[]>();
    for (const z of zamjene) {
      const k = kljuc(z.godina, z.brojTjedna);
      poTjednu.set(k, [...(poTjednu.get(k) ?? []), z]);
    }

    for (const d of tjedni) {
      const k = kljuc(d.godina, d.brojTjedna);
      const lista = poTjednu.get(k) ?? [];
      const stanja = primijeniZamjene(d, lista);
      rez.set(
        k,
        lista.map((zamjena, i) => ({ zamjena, stanje: stanja[i] })),
      );
    }
    return rez;
  }
}
