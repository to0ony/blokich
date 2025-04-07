import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { VozacStats } from '../../schemas/vozac-stats.schema';
import { Model } from 'mongoose';
import { SluzbaService } from '../sluzba/sluzba.service';
import * as dayjs from 'dayjs';
import * as isoWeek from 'dayjs/plugin/isoWeek';
import * as weekday from 'dayjs/plugin/weekday';

dayjs.extend(isoWeek);
dayjs.extend(weekday);

@Injectable()
export class VozacStatsService {
  private readonly logger = new Logger(VozacStatsService.name);

  constructor(
    @InjectModel(VozacStats.name)
    private model: Model<VozacStats>,
    private sluzbaService: SluzbaService,
  ) {}

  async generateStatsFromDisponent(disponent: any) {
    const dani = ['pon', 'uto', 'sri', 'cet', 'pet', 'sub', 'ned'];
    const { godina, brojTjedna, radnici } = disponent;
    const statsMap = new Map<string, any>();

    for (const radnik of radnici) {
      const sluzBroj = radnik.radnik;

      for (let i = 0; i < dani.length; i++) {
        const dan = dani[i];
        const vrijednost = radnik[dan];
        if (!vrijednost) continue;

        const datum = this.getDatumFromTjedanDan(godina, brojTjedna, i);
        const mjesec = dayjs(datum).month() + 1;
        const kljuc = `${sluzBroj}-${mjesec}-${godina}`;

        if (!statsMap.has(kljuc)) {
          statsMap.set(kljuc, {
            sluz_broj: sluzBroj,
            mjesec,
            godina,
            ukupni_sati: '00:00',
            efektivni_sati: '00:00',
            broj_druga_smjena: 0,
            broj_nocni_rad: 0,
            broj_dana_rada: 0,
            oznaka_count: new Map(),
            broj_linija: new Map(),
            polazista_count: new Map(),
            zavrsna_count: new Map(),
          });
        }

        const stat = statsMap.get(kljuc);
        stat.broj_dana_rada++;

        if (/^\d+$/.test(vrijednost)) {
          const brSl = vrijednost;
          try {
            const [a, b] = await Promise.all([
              this.sluzbaService.findByBrSl(brSl),
              this.sluzbaService.findByBrSl(brSl + 'P'),
            ]);
            const sluzbe = [...a, ...b];

            if (!sluzbe.length) continue;

            for (const s of sluzbe) {
              this.addToMap(stat.broj_linija, s.linija);
              this.addToMap(stat.polazista_count, s.nastup_sluzbe);
              this.addToMap(stat.zavrsna_count, s.zavrsna_sluzba);

              stat.ukupni_sati = this.sumSati([
                stat.ukupni_sati,
                this.formatiraj(s.ukupni_sati),
              ]);
              stat.efektivni_sati = this.sumSati([
                stat.efektivni_sati,
                this.formatiraj(s.efektivni_sati),
              ]);

              if (this.parseBool(s.druga_smjena)) stat.broj_druga_smjena++;
              if (this.parseBool(s.nocni_rad)) stat.broj_nocni_rad++;
            }
          } catch (error) {
            this.logger.error(`Greška pri dohvaćanju službi za ${brSl}`, error);
          }
        } else {
          this.addToMap(stat.oznaka_count, vrijednost);
        }
      }
    }

    for (const [_key, stat] of statsMap.entries()) {
      try {
        const existing = await this.model.findOne({
          sluz_broj: stat.sluz_broj,
          mjesec: stat.mjesec,
          godina: stat.godina,
        });

        const saveObj = {
          sluz_broj: stat.sluz_broj,
          mjesec: stat.mjesec,
          godina: stat.godina,
          statistika: {
            ukupni_sati: stat.ukupni_sati,
            efektivni_sati: stat.efektivni_sati,
            broj_druga_smjena: stat.broj_druga_smjena,
            broj_nocni_rad: stat.broj_nocni_rad,
            broj_dana_rada: stat.broj_dana_rada,
            oznaka_count: Object.fromEntries(stat.oznaka_count),
            broj_linija: Object.fromEntries(stat.broj_linija),
            polazista_count: Object.fromEntries(
              Array.from(stat.polazista_count.entries()).map(([k, v]) => [
                k.replace(/\./g, '_'),
                v,
              ]),
            ),
            zavrsna_count: Object.fromEntries(
              Array.from(stat.zavrsna_count.entries()).map(([k, v]) => [
                k.replace(/\./g, '_'),
                v,
              ]),
            ),
          },
        };

        if (existing) {
          await this.model.updateOne({ _id: existing._id }, saveObj);
        } else {
          await this.model.create(saveObj);
        }
      } catch (error) {
        this.logger.error(
          `Greška pri spremanju statistike za vozača ${stat.sluz_broj} (${stat.mjesec}/${stat.godina})`,
          error,
        );
      }
    }
  }

  private getDatumFromTjedanDan(
    godina: number,
    tjedan: number,
    danIndex: number,
  ): string {
    return dayjs()
      .year(godina)
      .isoWeek(tjedan)
      .startOf('week')
      .add(danIndex, 'day')
      .format('YYYY-MM-DD');
  }

  private parseBool(v: string): boolean {
    return parseFloat(v.replace(',', '.')) > 0;
  }

  private formatiraj(v: string): string {
    const [h, m] = v.split(',');
    const sati = parseInt(h || '0', 10);
    const minute = Math.round(parseFloat(`0.${m || '0'}`) * 60);
    return `${sati.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  private sumSati(lista: string[]): string {
    let totalMin = 0;
    for (const t of lista) {
      const [h, m] = t.split(':').map(Number);
      totalMin += h * 60 + m;
    }
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  private addToMap(map: Map<string, number>, key: string) {
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  }
}
