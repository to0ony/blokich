import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { KartaController } from '../../controllers/karta/karta.controller';
import { KartaService } from '../../services/karta/karta.service';
import { GtfsStatickiService } from '../../services/karta/gtfs-staticki.service';
import { VozaciNaBlokuService } from '../../services/karta/vozaci-na-bloku.service';
import { NavigacijaService } from '../../services/karta/navigacija.service';
import { ZetUzivoModule } from '../zet-uzivo/zet-uzivo.module';
import { Disponent, DisponentSchema } from '../../schemas/disponent.schema';
import { Sluzba, SluzbaSchema } from '../../schemas/sluzba.schema';
import { Godisnji, GodisnjiSchema } from '../../schemas/godisnji.schema';

@Module({
  imports: [
    HttpModule,
    ZetUzivoModule,
    MongooseModule.forFeature([
      { name: Disponent.name, schema: DisponentSchema, collection: 'disponent' },
      { name: Sluzba.name, schema: SluzbaSchema, collection: 'sluzba' },
      { name: Godisnji.name, schema: GodisnjiSchema },
    ]),
  ],
  controllers: [KartaController],
  providers: [KartaService, GtfsStatickiService, VozaciNaBlokuService, NavigacijaService],
})
export class KartaModule {}
