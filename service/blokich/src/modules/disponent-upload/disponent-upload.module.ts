import { Module } from '@nestjs/common';
import { DisponentUploadController } from '../../controllers/disponent-upload/disponent-upload.controller';
import { DisponentUploadService } from '../../services/disponent-upload/disponent-upload.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Disponent, DisponentSchema } from '../../schemas/disponent.schema';
import { SluzbaUploadSchema } from 'src/schemas/sluzba-upload.schema';
import { Godisnji, GodisnjiSchema } from '../../schemas/godisnji.schema';
import { PdfModule } from '../pdf/pdf.module';
import { VozacStatsModule } from '../vozac-stats/vozac-stats.module';
import { RucniUvozModule } from '../rucni-uvoz/rucni-uvoz.module';

@Module({
  imports: [
    PdfModule,
    VozacStatsModule,
    RucniUvozModule,
    MongooseModule.forFeature([
      {
        name: Disponent.name,
        schema: DisponentSchema,
        collection: 'disponent',
      },
      { name: 'SluzbaUpload', schema: SluzbaUploadSchema },
      { name: Godisnji.name, schema: GodisnjiSchema },
    ]),
  ],
  controllers: [DisponentUploadController],
  providers: [DisponentUploadService],
  exports: [DisponentUploadService],
})
export class DisponentUploadModule {}
