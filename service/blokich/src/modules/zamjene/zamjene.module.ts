import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ZamjeneController } from '../../controllers/zamjene/zamjene.controller';
import { ZamjeneService } from '../../services/zamjene/zamjene.service';
import { Disponent, DisponentSchema } from '../../schemas/disponent.schema';
import { Sluzba, SluzbaSchema } from '../../schemas/sluzba.schema';
import { Godisnji, GodisnjiSchema } from '../../schemas/godisnji.schema';
import { ZamjenePrimjenaModule } from './zamjene-primjena.module';
import { VozacStatsModule } from '../vozac-stats/vozac-stats.module';

@Module({
  imports: [
    ZamjenePrimjenaModule,
    VozacStatsModule,
    MongooseModule.forFeature([
      {
        name: Disponent.name,
        schema: DisponentSchema,
        collection: 'disponent',
      },
      { name: Sluzba.name, schema: SluzbaSchema, collection: 'sluzba' },
      { name: Godisnji.name, schema: GodisnjiSchema },
    ]),
  ],
  controllers: [ZamjeneController],
  providers: [ZamjeneService],
})
export class ZamjeneModule {}
