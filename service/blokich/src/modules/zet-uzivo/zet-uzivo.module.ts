import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ZetUzivoController } from '../../controllers/zet-uzivo/zet-uzivo.controller';
import { ZetUzivoService } from '../../services/zet-uzivo/zet-uzivo.service';

@Module({
  imports: [HttpModule],
  controllers: [ZetUzivoController],
  providers: [ZetUzivoService],
})
export class ZetUzivoModule {}
