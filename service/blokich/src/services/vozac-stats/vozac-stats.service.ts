import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Disponent } from '../../schemas/disponent.schema';
import { Sluzba } from '../../schemas/sluzba.schema';
import { Godisnji } from '../../schemas/godisnji.schema';
import { VozacStats } from '../../schemas/vozac-stats.schema';
import {
  DisponentUlaz,
  SluzbaRed,
  VozacStatsPeriod,
  izgradiDane,
  izracunajStatistike,
  opsegZaTjedan,
} from '../../stats/vozac-stats.calculator';

@Injectable()
export class VozacStatsService {
  private readonly logger = new Logger(VozacStatsService.name);

  constructor(
    @InjectModel(Disponent.name)
    private readonly disponentModel: Model<Disponent>,
    @InjectModel(Sluzba.name)
    private readonly sluzbaModel: Model<Sluzba>,
    @InjectModel(Godisnji.name)
    private readonly godisnjiModel: Model<Godisnji>,
    @InjectModel(VozacStats.name)
    private readonly statsModel: Model<VozacStats>,
  ) {}

  // Poziva se nakon uploada disponenta – preračunava taj tjedan i mjesece koje dotiče
  async preracunajTjedan(godina: number, brojTjedna: number): Promise<number> {
    const { opseg, potrebniTjedni } = opsegZaTjedan(godina, brojTjedna);

    const disponenti = (await this.disponentModel
      .find({
        $or: potrebniTjedni.map((t) => ({
          godina: t.godina,
          brojTjedna: t.tjedan,
        })),
      })
      .lean()) as unknown as DisponentUlaz[];

    const verzije = [
      ...new Set(disponenti.map((d) => d.verzija_sluzbe).filter(Boolean)),
    ] as string[];
    const sluzbeDokumenti = await this.sluzbaModel
      .find({ verzija: { $in: verzije } })
      .lean();

    const sluzbePoVerziji = new Map<string, SluzbaRed[]>();
    for (const dok of sluzbeDokumenti) {
      const lista = sluzbePoVerziji.get(dok.verzija) ?? [];
      lista.push(...((dok.sluzbe as SluzbaRed[]) || []));
      sluzbePoVerziji.set(dok.verzija, lista);
    }

    const stats = izracunajStatistike(
      izgradiDane(disponenti, sluzbePoVerziji),
      opseg,
    );
    await this.spremi(stats);

    this.logger.log(
      `Preračunato ${stats.length} statistika za tjedan ${brojTjedna}/${godina}`,
    );
    return stats.length;
  }

  private async spremi(stats: VozacStatsPeriod[]) {
    if (!stats.length) return;
    const izracunato = new Date();
    await this.statsModel.bulkWrite(
      stats.map((s) => ({
        replaceOne: {
          filter: {
            radnik: s.radnik,
            tip: s.tip,
            godina: s.godina,
            period: s.period,
          },
          replacement: { ...s, izracunato },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }

  async dohvatiZaVozaca(radnik: string, tip: 'tjedan' | 'mjesec') {
    const periodi = await this.statsModel
      .find({ radnik, tip }, { _id: 0, __v: 0 })
      .sort({ godina: -1, period: -1 })
      .limit(tip === 'tjedan' ? 104 : 36)
      .lean();

    // imena kolega iz najnovijeg popisa radnika
    const brojevi = [
      ...new Set(periodi.flatMap((p) => (p.kolege || []).map((k) => k.radnik))),
    ];
    const imena = await this.mapaImena(brojevi);
    for (const p of periodi) {
      p.kolege = (p.kolege || []).map((k) => ({
        ...k,
        ime_prezime: imena.get(Number(k.radnik)) ?? null,
      }));
    }

    return { radnik, tip, periodi };
  }

  private async mapaImena(brojevi: string[]): Promise<Map<number, string>> {
    const mapa = new Map<number, string>();
    if (!brojevi.length) return mapa;

    const trazeni = new Set(brojevi.map(Number));
    const najnoviji = await this.godisnjiModel
      .findOne({}, { 'vozaci.sluz_broj': 1, 'vozaci.ime_prezime': 1 })
      .sort({ createdAt: -1 })
      .lean();

    for (const v of najnoviji?.vozaci || []) {
      const broj = Number(v.sluz_broj);
      if (trazeni.has(broj) && v.ime_prezime && v.ime_prezime !== '?') {
        mapa.set(broj, v.ime_prezime);
      }
    }
    return mapa;
  }
}
