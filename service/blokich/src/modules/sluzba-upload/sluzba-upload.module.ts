import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Sluzba, SluzbaSchema } from '../../schemas/sluzba.schema';
import {
  SluzbaUpload,
  SluzbaUploadSchema,
} from '../../schemas/sluzba-upload.schema';
import { Disponent, DisponentSchema } from '../../schemas/disponent.schema';
import { SluzbaUploadController } from '../../controllers/sluzba-upload/sluzba-upload.controller';
import { SluzbaUploadService } from '../../services/sluzba-upload/sluzba-upload.service';
import { PdfModule } from '../pdf/pdf.module';
import { RucniUvozModule } from '../rucni-uvoz/rucni-uvoz.module';

@Module({
  imports: [
    PdfModule,
    RucniUvozModule,
    MongooseModule.forFeature([
      { name: Sluzba.name, schema: SluzbaSchema, collection: 'sluzba' },
    ]),
    MongooseModule.forFeature([
      { name: SluzbaUpload.name, schema: SluzbaUploadSchema },
    ]),
    MongooseModule.forFeature([
      {
        name: Disponent.name,
        schema: DisponentSchema,
        collection: 'disponent',
      },
    ]),
  ],
  controllers: [SluzbaUploadController],
  providers: [SluzbaUploadService],
  exports: [SluzbaUploadService],
})
export class SluzbaUploadModule {}
