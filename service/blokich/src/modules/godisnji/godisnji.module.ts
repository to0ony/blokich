import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Godisnji, GodisnjiSchema } from '../../schemas/godisnji.schema';
import { GodisnjiService } from '../../services/godisnji/godisnji.service';
import { GodisnjiController } from '../../controllers/godisnji/godisnji.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Godisnji.name, schema: GodisnjiSchema, collection: 'godisnji' },
    ]),
  ],
  providers: [GodisnjiService],
  controllers: [GodisnjiController],
})
export class GodisnjiModule {}
