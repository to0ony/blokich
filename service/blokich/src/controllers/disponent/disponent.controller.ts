import { Controller, Get, Param } from '@nestjs/common';
import { DisponentService } from 'src/services/disponent/disponent.service';

@Controller('disponent')
export class DisponentController {
  constructor(private readonly disponentService: DisponentService) {}

  @Get(':radnik')
  async getByRadnik(@Param('radnik') radnik: string) {
    return this.disponentService.getByRadnik(radnik);
  }
}
