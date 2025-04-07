import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { SluzbaService } from '../../services/sluzba/sluzba.service';

@Controller('sluzba')
export class SluzbaController {
  constructor(private readonly service: SluzbaService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':br_sl')
  async findOne(@Param('br_sl') br_sl: string) {
    const sluzba = await this.service.findByBrSl(br_sl);
    if (!sluzba) {
      throw new NotFoundException(`Služba ${br_sl} nije pronađena`);
    }
    return sluzba;
  }
}
