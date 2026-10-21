import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VozacStatsController } from '../../controllers/vozac-stats/vozac-stats.controller';
import { VozacStatsService } from '../../services/vozac-stats/vozac-stats.service';
import { Disponent, DisponentSchema } from '../../schemas/disponent.schema';
import { Sluzba, SluzbaSchema } from '../../schemas/sluzba.schema';
import { Godisnji, GodisnjiSchema } from '../../schemas/godisnji.schema';
import { VozacStats, VozacStatsSchema } from '../../schemas/vozac-stats.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Disponent.name, schema: DisponentSchema },
      { name: Sluzba.name, schema: SluzbaSchema },
      { name: Godisnji.name, schema: GodisnjiSchema },
      { name: VozacStats.name, schema: VozacStatsSchema },
    ]),
  ],
  controllers: [VozacStatsController],
  providers: [VozacStatsService],
  exports: [VozacStatsService],
})
export class VozacStatsModule {}
