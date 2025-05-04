import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VozaciController } from '../../controllers/vozaci/vozaci.controller';
import { VozaciService } from '../../services/vozaci/vozaci.service';
import { Godisnji, GodisnjiSchema } from '../../schemas/godisnji.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Godisnji', schema: GodisnjiSchema }]),
  ],
  controllers: [VozaciController],
  providers: [VozaciService],
})
export class VozaciModule {}
