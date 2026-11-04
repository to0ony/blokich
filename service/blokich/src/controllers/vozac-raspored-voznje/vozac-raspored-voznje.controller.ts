import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
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

  @Get('kalendar/:sluz_broj')
  async getKalendar(
    @Param('sluz_broj') sluzBroj: string,
    @Query('godina') godina: string,
    @Query('mjesec') mjesec: string,
  ) {
    const g = Number(godina);
    const m = Number(mjesec);
    if (!Number.isInteger(g) || g < 2000 || g > 2100) {
      throw new BadRequestException('Neispravna godina.');
    }
    if (!Number.isInteger(m) || m < 1 || m > 12) {
      throw new BadRequestException('Neispravan mjesec.');
    }

    return this.rasporedService.dohvatiKalendar(sluzBroj, g, m);
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
