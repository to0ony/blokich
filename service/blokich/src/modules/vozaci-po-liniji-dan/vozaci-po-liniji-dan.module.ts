import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VozaciPoLinijiDanController } from '../../controllers/vozaci-po-liniji-dan/vozaci-po-liniji-dan.controller';
import { VozaciPoLinijiService } from '../../services/vozaci-po-liniji-dan/vozaci-po-liniji-dan.service';
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
  controllers: [VozaciPoLinijiDanController],
  providers: [VozaciPoLinijiService],
})
export class VozaciPoLinijiDanModule {}
