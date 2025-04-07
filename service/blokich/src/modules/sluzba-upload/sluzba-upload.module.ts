import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Sluzba, SluzbaSchema } from '../../schemas/sluzba.schema';
import {
  SluzbaUpload,
  SluzbaUploadSchema,
} from '../../schemas/sluzba-upload.schema';
import { SluzbaUploadController } from '../../controllers/sluzba-upload/sluzba-upload.controller';
import { SluzbaUploadService } from '../../services/sluzba-upload/sluzba-upload.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Sluzba.name, schema: SluzbaSchema }]),
    MongooseModule.forFeature([
      { name: SluzbaUpload.name, schema: SluzbaUploadSchema },
    ]),
  ],
  controllers: [SluzbaUploadController],
  providers: [SluzbaUploadService],
})
export class SluzbaUploadModule {}
