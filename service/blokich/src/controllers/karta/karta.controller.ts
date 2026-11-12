import {
  BadRequestException,
  Controller,
  Get,
  Header,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { KartaService } from '../../services/karta/karta.service';
import { NavigacijaService } from '../../services/karta/navigacija.service';

@Controller('karta')
export class KartaController {
  constructor(
    private readonly kartaService: KartaService,
    private readonly navigacijaService: NavigacijaService,
  ) {}

  /**
   * GET /api/karta/vozila – sva vozila ZET-a sa svježom pozicijom.
   * Za AP Podsused još model busa i vozač na bloku.
   */
  @Get('vozila')
  @Header('Cache-Control', 'no-store')
  async vozila(@Query('blokovi') blokovi?: string) {
    // ?blokovi=10902,13701 – samo vozila na tim blokovima (kartica vozača).
    const lista = (blokovi ?? '')
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean);
    if (lista.length > 20 || lista.some((b) => !/^\d{3,6}$/.test(b))) {
      throw new BadRequestException('Neispravan popis blokova.');
    }
    return this.kartaService.vozila(lista);
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

  /** GET /api/karta/linija?broj=109 – ruta linije: glavna trasa i stajališta po smjeru. */
  @Get('linija')
  @Header('Cache-Control', 'private, max-age=3600')
  linija(@Query('broj') broj?: string) {
    if (!broj || !/^[\w.-]{1,10}$/.test(broj)) {
      throw new BadRequestException('Neispravan broj linije.');
    }
    const l = this.kartaService.linija(broj);
    if (!l) throw new NotFoundException('Linija nije pronađena.');
    return l;
  }

  /**
   * GET /api/karta/vozni-red?broj=132&datum=20261113 – polasci svake trase
   * linije na dan (zadano danas) i vremena vožnje do stajališta.
   */
  @Get('vozni-red')
  @Header('Cache-Control', 'private, max-age=900')
  vozniRed(@Query('broj') broj?: string, @Query('datum') datum?: string) {
    if (!broj || !/^[\w.-]{1,10}$/.test(broj)) {
      throw new BadRequestException('Neispravan broj linije.');
    }
    if (datum !== undefined && !/^\d{8}$/.test(datum)) {
      throw new BadRequestException('Neispravan datum (YYYYMMDD).');
    }
    const v = this.kartaService.vozniRed(broj, datum);
    if (!v) throw new NotFoundException('Linija nije pronađena.');
    return v;
  }

  /**
   * GET /api/karta/navigacija?oblik=137_3 – skretanja po trasi za navigaciju:
   * s imenima ulica ako je postavljen OSRM_URL, inače iz oblika trase.
   */
  @Get('navigacija')
  @Header('Cache-Control', 'private, max-age=3600')
  async navigacija(@Query('oblik') oblik?: string) {
    if (!oblik || !/^[\w.-]{1,40}$/.test(oblik)) {
      throw new BadRequestException('Neispravna trasa.');
    }
    const n = this.navigacijaService.navigacija(oblik);
    if (!n) throw new NotFoundException('Trasa nije pronađena.');
    return n;
  }
}
