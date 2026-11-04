import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ZetUzivoService } from '../../services/zet-uzivo/zet-uzivo.service';

@Controller('uzivo')
export class ZetUzivoController {
  constructor(private readonly zetUzivoService: ZetUzivoService) {}

  /**
   * GET /api/uzivo?blokovi=10902,10910
   * Blok = linija + V.R. s dvije znamenke (109 + 02 = 10902).
   * Vraća samo blokove za koje postoje svježi podaci.
   */
  @Get()
  async uzivo(@Query('blokovi') blokovi?: string) {
    const lista = (blokovi ?? '')
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean);

    if (lista.length > 50 || lista.some((b) => !/^\d{3,6}$/.test(b))) {
      throw new BadRequestException('Neispravan popis blokova.');
    }
    return this.zetUzivoService.zaBlokove(lista);
  }
}
