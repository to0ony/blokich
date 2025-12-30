import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { VozaciPoSluzbiDanService } from '../../services/vozaci-po-sluzbi-dan/vozaci-po-sluzbi-dan.service';

@Controller('vozaci-po-sluzbi-dan')
export class VozaciPoSluzbiDanController {
  constructor(private readonly service: VozaciPoSluzbiDanService) {}

  @Get()
  async getVozaceZaSluzbu(
    @Query('br_sl') brSluzbe: string,
    @Query('dan') dan?: string,
    @Query('tjedan') tjedan?: 'trenutni' | 'naredni',
  ) {
    if (!brSluzbe) {
      throw new BadRequestException('Parametar br_sl je obavezan');
    }

    // Ako dan nije specificiran, vrati cijeli tjedan
    if (!dan) {
      return this.service.dohvatiVozaceZaSluzbyCijeliTjedan(
        brSluzbe,
        tjedan || 'trenutni',
      );
    }

    const validniDani = ['pon', 'uto', 'sri', 'cet', 'pet', 'sub', 'ned'];
    if (!validniDani.includes(dan)) {
      throw new BadRequestException(
        `Dan mora biti jedan od: ${validniDani.join(', ')}`,
      );
    }

    return this.service.dohvatiVozaceZaSluzbu(
      brSluzbe,
      dan,
      tjedan || 'trenutni',
    );
  }
}
