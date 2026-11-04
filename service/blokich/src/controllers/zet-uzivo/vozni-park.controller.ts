import { Controller, Get } from '@nestjs/common';
import { ZetUzivoService } from '../../services/zet-uzivo/zet-uzivo.service';

@Controller('vozni-park')
export class VozniParkController {
  constructor(private readonly zetUzivoService: ZetUzivoService) {}

  /** GET /api/vozni-park – busevi AP Podsused i tko je od njih sad na liniji. */
  @Get()
  async vozniPark() {
    return this.zetUzivoService.vozniPark();
  }
}
