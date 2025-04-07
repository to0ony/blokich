import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VozacStats, VozacStatsSchema } from '../../schemas/vozac-stats.schema';
import { VozacStatsService } from '../../services/vozac-stats/vozac-stats.service';
import { SluzbaModule } from '../sluzba/sluzba.module';
import { VozacStatsController } from 'src/controllers/vozac-stats/vozac-stats.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VozacStats.name, schema: VozacStatsSchema },
    ]),
    SluzbaModule,
  ],
  controllers: [VozacStatsController],
  providers: [VozacStatsService],
  exports: [VozacStatsService],
})
export class VozacStatsModule {}
