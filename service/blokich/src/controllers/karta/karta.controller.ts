import { BadRequestException, Controller, Get, Header, Query } from '@nestjs/common';
import { KartaService } from '../../services/karta/karta.service';

@Controller('karta')
export class KartaController {
  constructor(private readonly kartaService: KartaService) {}

  /**
   * GET /api/karta/vozila – sva vozila ZET-a sa svježom pozicijom.
   * Za AP Podsused još model busa i vozač na bloku.
   */
  @Get('vozila')
  @Header('Cache-Control', 'no-store')
  async vozila() {
    return this.kartaService.vozila();
  }

  /** GET /api/karta/oblici?id=109_1,109_2 – trase kao nizovi [lat, lon]. */
  @Get('oblici')
  @Header('Cache-Control', 'private, max-age=3600')
  oblici(@Query('id') id?: string) {
    const ids = (id ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!ids.length || ids.length > 200 || ids.some((s) => !/^[\w.-]{1,40}$/.test(s))) {
      throw new BadRequestException('Neispravan popis trasa.');
    }
    return { oblici: this.kartaService.oblici(ids) };
  }

  /** GET /api/karta/stajalista?oblik=109_1 – stajališta trase, redom. */
  @Get('stajalista')
  @Header('Cache-Control', 'private, max-age=3600')
  stajalista(@Query('oblik') oblik?: string) {
    if (!oblik || !/^[\w.-]{1,40}$/.test(oblik)) {
      throw new BadRequestException('Neispravna trasa.');
    }
    return { stajalista: this.kartaService.stajalista(oblik) };
  }

  /** GET /api/karta/rute – sve linije (broj, naziv, tramvaj/autobus). */
  @Get('rute')
  @Header('Cache-Control', 'private, max-age=3600')
  rute() {
    return { rute: this.kartaService.rute() };
  }
}
