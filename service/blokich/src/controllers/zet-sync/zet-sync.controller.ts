import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { AdminOnly } from 'src/authentication/decorators/admin-only.decorator';
import { ZetSyncService } from '../../services/zet-sync/zet-sync.service';

@Controller('zet-sync')
export class ZetSyncController {
  constructor(private readonly zetSyncService: ZetSyncService) {}

  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @Post('podsused')
  async syncPodsused() {
    return this.zetSyncService.syncPodsused();
  }
}
