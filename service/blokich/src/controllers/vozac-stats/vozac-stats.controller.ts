// vozac-stats.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { VozacStatsService } from '../../services/vozac-stats/vozac-stats.service';
import { InjectModel } from '@nestjs/mongoose';
import { VozacStats } from '../../schemas/vozac-stats.schema';
import { Model } from 'mongoose';
import * as dayjs from 'dayjs';

@Controller('vozac-stats')
export class VozacStatsController {
  constructor(
    private readonly vozacStatsService: VozacStatsService,
    @InjectModel(VozacStats.name)
    private readonly vozacStatsModel: Model<VozacStats>,
  ) {}

  @Get(':sluzBroj/:mjesec/:godina')
  async getStats(
    @Param('sluzBroj') sluzBroj: string,
    @Param('mjesec') mjesec: number,
    @Param('godina') godina: number,
  ) {
    const doc = await this.vozacStatsModel.findOne({
      sluz_broj: sluzBroj,
      mjesec: Number(mjesec),
      godina: Number(godina),
    });

    if (!doc) return { message: 'Nema podataka za traženog vozača.' };

    return {
      sluz_broj: doc.sluz_broj,
      mjesec: doc.mjesec,
      godina: doc.godina,
      statistika: doc.statistika,
    };
  }

  @Get(':sluzBroj')
  async getStatsForCurrentMonth(@Param('sluzBroj') sluzBroj: string) {
    const today = dayjs();
    const mjesec = today.month() + 1; // mjesec je 0-indeksiran
    const godina = today.year();

    const doc = await this.vozacStatsModel.findOne({
      sluz_broj: sluzBroj,
      mjesec,
      godina,
    });

    if (!doc)
      return { message: 'Nema podataka za traženog vozača u tekućem mjesecu.' };

    return {
      sluz_broj: doc.sluz_broj,
      mjesec: doc.mjesec,
      godina: doc.godina,
      statistika: doc.statistika,
    };
  }
}
