import { Module } from '@nestjs/common';
import { GodisnjiUploadService } from '../../services/godisnji-upload/godisnji-upload.service';
import { GodisnjiUploadController } from '../../controllers/godisnji-upload/godisnji-upload.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Godisnji, GodisnjiSchema } from '../../schemas/godisnji.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Godisnji.name, schema: GodisnjiSchema },
    ]),
  ],
  controllers: [GodisnjiUploadController],
  providers: [GodisnjiUploadService],
})
export class GodisnjiUploadModule {}
