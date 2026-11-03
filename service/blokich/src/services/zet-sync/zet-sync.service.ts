import { Injectable, Logger } from '@nestjs/common';
import {
  ZetDokument,
  ZetScraperService,
} from '../zet-scraper/zet-scraper.service';
import { SluzbaUploadService } from '../sluzba-upload/sluzba-upload.service';
import { DisponentUploadService } from '../disponent-upload/disponent-upload.service';

export interface ZetSyncStavka {
  dokument: ZetDokument;
  status: 'obradjeno' | 'nema_promjene' | 'greska';
  poruka: string;
  filename?: string;
  url?: string;
}

@Injectable()
export class ZetSyncService {
  private readonly logger = new Logger(ZetSyncService.name);

  constructor(
    private readonly scraper: ZetScraperService,
    private readonly sluzbaUploadService: SluzbaUploadService,
    private readonly disponentUploadService: DisponentUploadService,
  ) {}

  /**
   * Povuče službe i disponent sa ZET stranice AP Podsused.
   * Službe idu prve jer disponent pamti verziju zadnjih službi.
   * Greška jednog dokumenta ne prekida drugi.
   */
  async syncPodsused(): Promise<{ stavke: ZetSyncStavka[] }> {
    // Ako login ili dohvat stranice ne uspije, nema smisla nastavljati –
    // BadGatewayException ide ravno klijentu.
    const html = await this.scraper.fetchPodsusedPage();

    const stavke: ZetSyncStavka[] = [];
    for (const dokument of ['sluzba', 'disponent'] as ZetDokument[]) {
      stavke.push(await this.syncDokument(html, dokument));
    }

    this.logger.log(
      `ZET sync Podsused: ${stavke.map((s) => `${s.dokument}=${s.status}`).join(', ')}`,
    );
    return { stavke };
  }

  private async syncDokument(
    html: string,
    dokument: ZetDokument,
  ): Promise<ZetSyncStavka> {
    const link = this.scraper.findLink(html, dokument);
    if (!link) {
      return {
        dokument,
        status: 'greska',
        poruka: 'PDF link nije pronađen na stranici AP Podsused.',
      };
    }

    try {
      const pdf = await this.scraper.downloadPdf(link);
      const rezultat =
        dokument === 'sluzba'
          ? await this.sluzbaUploadService.processPdf(pdf, 'zet')
          : await this.disponentUploadService.processPdf(pdf, 'zet');

      return {
        dokument,
        status: rezultat.status,
        poruka: rezultat.poruka,
        filename: pdf.originalname,
        url: link.url,
      };
    } catch (err) {
      this.logger.error(`ZET sync ${dokument} nije uspio`, err);
      return {
        dokument,
        status: 'greska',
        poruka: err?.message || 'Nepoznata greška.',
        url: link.url,
      };
    }
  }
}
