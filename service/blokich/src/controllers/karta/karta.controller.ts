import { BadRequestException, Controller, Get, Header, Query } from '@nestjs/common';
import { KartaService } from '../../services/karta/karta.service';
import { RadoviService } from '../../services/karta/radovi.service';

@Controller('karta')
export class KartaController {
  constructor(
    private readonly kartaService: KartaService,
    private readonly radoviService: RadoviService,
  ) {}

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

  /**
   * GET /api/karta/radovi – zatvorene ceste (linije) i gradski radovi (točke)
   * iz otvorenih podataka Grada Zagreba, kao GeoJSON.
   */
  @Get('radovi')
  @Header('Cache-Control', 'private, max-age=600')
  radovi() {
    return this.radoviService.radovi();
  }

  /** GET /api/karta/rute – sve linije (broj, naziv, tramvaj/autobus). */
  @Get('rute')
  @Header('Cache-Control', 'private, max-age=3600')
  rute() {
    return { rute: this.kartaService.rute() };
  }
}
