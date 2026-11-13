import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { VozaciService } from '../../services/vozaci/vozaci.service';

@Controller('vozaci')
export class VozaciController {
  constructor(private readonly vozaciService: VozaciService) {}

  @Get('search')
  async search(@Query('q') q: string) {
    if (!q) {
      throw new BadRequestException('Query param "q" is required');
    }
    return this.vozaciService.search(q);
  }
}
