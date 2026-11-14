import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Zamjena, ZamjenaSchema } from '../../schemas/zamjena.schema';
import { ZamjenePrimjenaService } from '../../services/zamjene/zamjene-primjena.service';

/** Samo čitanje i primjena zamjena – uvoze ga svi koji čitaju disponent. */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Zamjena.name, schema: ZamjenaSchema }]),
  ],
  providers: [ZamjenePrimjenaService],
  exports: [ZamjenePrimjenaService, MongooseModule],
})
export class ZamjenePrimjenaModule {}
