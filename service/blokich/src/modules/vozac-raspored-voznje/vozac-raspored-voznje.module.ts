import { Module } from '@nestjs/common';
import { VozacRasporedVoznjeController } from '../../controllers/vozac-raspored-voznje/vozac-raspored-voznje.controller';
import { VozacRasporedVoznjeService } from '../../services/vozac-raspored-voznje/vozac-raspored-voznje.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Disponent, DisponentSchema } from '../../schemas/disponent.schema';
import { Sluzba, SluzbaSchema } from '../../schemas/sluzba.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Disponent.name, schema: DisponentSchema },
      { name: Sluzba.name, schema: SluzbaSchema },
    ]),
  ],
  controllers: [VozacRasporedVoznjeController],
  providers: [VozacRasporedVoznjeService],
})
export class VozacRasporedVoznjeModule {}
