import { Controller, Get, Param, Query } from '@nestjs/common';
import { VozacStatsService } from '../../services/vozac-stats/vozac-stats.service';

@Controller('vozac-stats')
export class VozacStatsController {
  constructor(private readonly statsService: VozacStatsService) {}

  @Get(':sluz_broj')
  async getStats(
    @Param('sluz_broj') sluzBroj: string,
    @Query('tip') tip: string = 'mjesec',
  ) {
    return this.statsService.dohvatiZaVozaca(
      sluzBroj,
      tip === 'tjedan' ? 'tjedan' : 'mjesec',
    );
  }
}
