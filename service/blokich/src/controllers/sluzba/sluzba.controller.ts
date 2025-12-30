import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { SluzbaService } from '../../services/sluzba/sluzba.service';

@Controller('sluzba')
export class SluzbaController {
  constructor(private readonly service: SluzbaService) {}

  @Get()
  async findLatest() {
    const sluzba = await this.service.findAll();
    if (!sluzba) {
      throw new NotFoundException('Nema službi u bazi');
    }
    return sluzba;
  }

  @Get('verzija/:verzija')
  async findByVerzija(@Param('verzija') verzija: string) {
    const sluzba = await this.service.findByVerzija(verzija);
    if (!sluzba) {
      throw new NotFoundException(`Služba verzije ${verzija} nije pronađena`);
    }
    return sluzba;
  }

  @Get('br_sl/:br_sl')
  async findByBrSl(@Param('br_sl') br_sl: string) {
    const sluzbe = await this.service.findByBrSl(br_sl);
    if (!sluzbe || sluzbe.length === 0) {
      throw new NotFoundException(`Služba ${br_sl} nije pronađena`);
    }
    return sluzbe;
  }

  @Get('br_sl_svi/:br_sl')
  async findAllByBrSl(@Param('br_sl') br_sl: string) {
    const sluzbe = await this.service.findAllByBrSl(br_sl);
    if (!sluzbe || sluzbe.length === 0) {
      throw new NotFoundException(
        `Služba ${br_sl} nije pronađena ni u jednoj verziji`,
      );
    }
    return sluzbe;
  }
}
