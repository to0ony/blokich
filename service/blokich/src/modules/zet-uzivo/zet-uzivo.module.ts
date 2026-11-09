import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ZetUzivoController } from '../../controllers/zet-uzivo/zet-uzivo.controller';
import { VozniParkController } from '../../controllers/zet-uzivo/vozni-park.controller';
import { ZetUzivoService } from '../../services/zet-uzivo/zet-uzivo.service';

@Module({
  imports: [HttpModule],
  controllers: [ZetUzivoController, VozniParkController],
  providers: [ZetUzivoService],
  exports: [ZetUzivoService],
})
export class ZetUzivoModule {}
