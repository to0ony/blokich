import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { AdminOnly } from 'src/authentication/decorators/admin-only.decorator';
import {
  TjedanTip,
  TipZamjene,
  ZamjeneService,
} from '../../services/zamjene/zamjene.service';

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

function tjedanIz(v: unknown): TjedanTip {
  if (v === 'trenutni' || v === 'naredni') return v;
  throw new BadRequestException(
    'Zamjene su moguće samo za aktualni i naredni tjedan.',
  );
}

@Controller('zamjene')
export class ZamjeneController {
  constructor(private readonly zamjene: ZamjeneService) {}

  /** Moj dan i kolege za zamjenu: ?radnik=&tjedan=trenutni|naredni&dan=sri&q= */
  @Get('kandidati')
  kandidati(
    @Query('radnik') radnik: string,
    @Query('tjedan') tjedan: string,
    @Query('dan') dan: string,
    @Query('q') q?: string,
  ) {
    if (!radnik) throw new BadRequestException('Nedostaje službeni broj.');
    return this.zamjene.kandidati(radnik, tjedanIz(tjedan), dan, q ?? '');
  }

  @Post()
  stvori(
    @Body()
    body: {
      radnik: string;
      tjedan: string;
      dan: string;
      tip: TipZamjene;
      sa?: string;
    },
  ) {
    return this.zamjene.stvori({
      radnik: String(body?.radnik ?? ''),
      tjedan: tjedanIz(body?.tjedan),
      dan: String(body?.dan ?? ''),
      tip: body?.tip,
      sa: body?.sa ? String(body.sa) : undefined,
    });
  }

  @Post(':id/ponisti')
  ponisti(@Param('id') id: string, @Body() body: { radnik: string }) {
    if (!body?.radnik) {
      throw new BadRequestException('Nedostaje službeni broj.');
    }
    return this.zamjene.ponisti(id, String(body.radnik));
  }

  @AdminOnly()
  @Get('admin')
  popis(
    @Query('radnik') radnik?: string,
    @Query('od') od?: string,
    @Query('do') doo?: string,
  ) {
    if (radnik && !/^\d+$/.test(radnik)) {
      throw new BadRequestException('Neispravan službeni broj.');
    }
    if ((od && !DATUM.test(od)) || (doo && !DATUM.test(doo))) {
      throw new BadRequestException('Datum mora biti YYYY-MM-DD.');
    }
    return this.zamjene.popis({ radnik, od, do: doo });
  }
}
