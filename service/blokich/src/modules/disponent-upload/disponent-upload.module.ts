import { Module } from '@nestjs/common';
import { DisponentUploadController } from '../../controllers/disponent-upload/disponent-upload.controller';
import { DisponentUploadService } from '../../services/disponent-upload/disponent-upload.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Disponent, DisponentSchema } from '../../schemas/disponent.schema';
import { VozacStatsModule } from '../vozac-stats/vozac-stats.module';
import { SluzbaUploadSchema } from 'src/schemas/sluzba-upload.schema';
import { Godisnji, GodisnjiSchema } from '../../schemas/godisnji.schema';
import { PdfModule } from '../pdf/pdf.module';

@Module({
  imports: [
    PdfModule,
    MongooseModule.forFeature([
      { name: Disponent.name, schema: DisponentSchema },
      { name: 'SluzbaUpload', schema: SluzbaUploadSchema },
      { name: Godisnji.name, schema: GodisnjiSchema },
    ]),
    VozacStatsModule,
  ],
  controllers: [DisponentUploadController],
  providers: [DisponentUploadService],
})
export class DisponentUploadModule {}
