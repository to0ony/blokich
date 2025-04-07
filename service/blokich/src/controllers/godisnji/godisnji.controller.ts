import { Controller, Get, Param } from '@nestjs/common';
import { GodisnjiService } from '../../services/godisnji/godisnji.service';

@Controller('godisnji')
export class GodisnjiController {
  constructor(private readonly godisnjiService: GodisnjiService) {}

  @Get(':sluz_broj')
  async getBySluzBroj(@Param('sluz_broj') sluzBroj: string) {
    return this.godisnjiService.getBySluzBroj(sluzBroj);
  }
}
