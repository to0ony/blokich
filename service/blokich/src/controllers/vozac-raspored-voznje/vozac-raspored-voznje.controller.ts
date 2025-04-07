import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { VozacRasporedVoznjeService } from '../../services/vozac-raspored-voznje/vozac-raspored-voznje.service';

@Controller('vozac-rasporedVoznje')
export class VozacRasporedVoznjeController {
  constructor(private readonly rasporedService: VozacRasporedVoznjeService) {}

  @Get(':sluz_broj')
  async getRaspored(@Param('sluz_broj') sluzBroj: string) {
    const rezultat =
      await this.rasporedService.dohvatiRasporedZaVozaca(sluzBroj);

    if (!rezultat) {
      throw new NotFoundException(
        'Disponent ili vozač nisu pronađeni za ovaj tjedan.',
      );
    }

    return rezultat;
  }

  @Get('naredniTjedan/:sluz_broj')
  async getSljedeciRaspored(@Param('sluz_broj') sluzBroj: string) {
    const rezultat =
      await this.rasporedService.dohvatiNaredniTjedanRasporedZaVozaca(sluzBroj);

    if (!rezultat) {
      throw new NotFoundException(
        'Raspored za naredni tjedan nije pronađen za ovog vozača.',
      );
    }

    return rezultat;
  }
}
