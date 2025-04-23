import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PdfProcessingService } from 'src/pdf/pdf-processing.service';

@Module({
  imports: [HttpModule],
  providers: [PdfProcessingService],
  exports: [PdfProcessingService],
})
export class PdfModule {}
