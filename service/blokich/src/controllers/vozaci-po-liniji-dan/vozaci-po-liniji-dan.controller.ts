import { Controller, Get, Query } from '@nestjs/common';
import { VozaciPoLinijiService } from '../../services/vozaci-po-liniji-dan/vozaci-po-liniji-dan.service';

@Controller('vozaci-po-liniji-dan')
export class VozaciPoLinijiDanController {
  constructor(private readonly service: VozaciPoLinijiService) {}

  @Get()
  async getVozaci(
    @Query('linija') linija: string,
    @Query('dan') dan: string,
    @Query('tjedan') tjedan: 'trenutni' | 'naredni' = 'trenutni',
  ) {
    return this.service.dohvatiVozaceZaLiniju(linija, dan, tjedan);
  }
}
