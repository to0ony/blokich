import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { AdminOnly } from 'src/authentication/decorators/admin-only.decorator';
import {
  ZetSyncService,
  type ZetUvozPotvrda,
} from '../../services/zet-sync/zet-sync.service';

@Controller('zet-sync')
export class ZetSyncController {
  constructor(private readonly zetSyncService: ZetSyncService) {}

  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @Post('podsused/provjera')
  async provjeriPodsused() {
    return this.zetSyncService.provjeriPodsused();
  }

  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @Post('podsused/uvoz')
  async uveziPodsused(@Body() potvrda: ZetUvozPotvrda) {
    return this.zetSyncService.uveziPodsused(potvrda);
  }
}
