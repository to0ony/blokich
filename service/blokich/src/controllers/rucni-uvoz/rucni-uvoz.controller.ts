import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { AdminOnly } from 'src/authentication/decorators/admin-only.decorator';
import { RucniUvozService } from '../../services/rucni-uvoz/rucni-uvoz.service';

@Controller('rucni-uvoz')
export class RucniUvozController {
  constructor(private readonly rucniUvozService: RucniUvozService) {}

  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @Get()
  async povijest() {
    return this.rucniUvozService.povijest();
  }
}
