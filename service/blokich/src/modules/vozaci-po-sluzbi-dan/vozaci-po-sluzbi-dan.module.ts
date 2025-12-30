import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VozaciPoSluzbiDanController } from '../../controllers/vozaci-po-sluzbi-dan/vozaci-po-sluzbi-dan.controller';
import { VozaciPoSluzbiDanService } from '../../services/vozaci-po-sluzbi-dan/vozaci-po-sluzbi-dan.service';
import { Disponent, DisponentSchema } from '../../schemas/disponent.schema';
import { Sluzba, SluzbaSchema } from '../../schemas/sluzba.schema';
import { Godisnji, GodisnjiSchema } from '../../schemas/godisnji.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Disponent.name, schema: DisponentSchema },
      { name: Sluzba.name, schema: SluzbaSchema },
      { name: Godisnji.name, schema: GodisnjiSchema },
    ]),
  ],
  controllers: [VozaciPoSluzbiDanController],
  providers: [VozaciPoSluzbiDanService],
})
export class VozaciPoSluzbiDanModule {}
