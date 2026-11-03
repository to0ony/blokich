import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ZetSyncController } from '../../controllers/zet-sync/zet-sync.controller';
import { ZetSyncService } from '../../services/zet-sync/zet-sync.service';
import { ZetScraperService } from '../../services/zet-scraper/zet-scraper.service';
import { SluzbaUploadModule } from '../sluzba-upload/sluzba-upload.module';
import { DisponentUploadModule } from '../disponent-upload/disponent-upload.module';

@Module({
  imports: [HttpModule, SluzbaUploadModule, DisponentUploadModule],
  controllers: [ZetSyncController],
  providers: [ZetScraperService, ZetSyncService],
})
export class ZetSyncModule {}
