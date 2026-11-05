import {
  BadGatewayException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  ZetDokument,
  ZetScraperService,
} from '../zet-scraper/zet-scraper.service';
import { SluzbaUploadService } from '../sluzba-upload/sluzba-upload.service';
import { DisponentUploadService } from '../disponent-upload/disponent-upload.service';
import { PdfInput, sha256 } from 'src/pdf/pdf-input';

export interface ZetSyncStavka {
  dokument: ZetDokument;
  status: 'novo' | 'obradjeno' | 'nema_promjene' | 'greska';
  poruka: string;
  filename?: string;
  url?: string;
  /** Za 'novo' ide nazad pri potvrdi, a za 'greska' uz ispravljeni PDF. */
  sha256?: string;
}

/** Hash svakog novog PDF-a koji je admin vidio u provjeri i potvrdio. */
export type ZetUvozPotvrda = Partial<Record<ZetDokument, string>>;

interface ZetPriprema {
  status: 'novo' | 'nema_promjene';
  poruka: string;
  filename: string;
  sha256?: string;
  spremi?: () => Promise<{ poruka: string }>;
}

/** Službe idu prve jer disponent pamti verziju zadnjih službi. */
const REDOSLIJED: ZetDokument[] = ['sluzba', 'disponent'];

const NAZIVI: Record<ZetDokument, string> = {
  sluzba: 'Službe',
  disponent: 'Disponent',
};

const NEUSPJELO = 'Neuspjelo.';

@Injectable()
export class ZetSyncService {
  private readonly logger = new Logger(ZetSyncService.name);

  constructor(
    private readonly scraper: ZetScraperService,
    private readonly sluzbaUploadService: SluzbaUploadService,
    private readonly disponentUploadService: DisponentUploadService,
  ) {}

  /**
   * Preuzme i isparsira službe i disponent sa stranice AP Podsused.
   * Ne upisuje ništa u bazu – admin rezultat potvrđuje kroz uveziPodsused.
   * Greška jednog dokumenta ne prekida provjeru drugog.
   */
  async provjeriPodsused(): Promise<{ stavke: ZetSyncStavka[] }> {
    // Ako login ili dohvat stranice ne uspije, nema smisla nastavljati –
    // BadGatewayException ide ravno klijentu.
    const html = await this.scraper.fetchPodsusedPage();

    const stavke: ZetSyncStavka[] = [];
    for (const dokument of REDOSLIJED) {
      stavke.push(await this.provjeriDokument(html, dokument));
    }

    this.logger.log(
      `ZET provjera Podsused: ${stavke.map((s) => `${s.dokument}=${s.status}`).join(', ')}`,
    );
    return { stavke };
  }

  /**
   * Upisuje potvrđene PDF-ove, sve ili ništa: prvo se oba ponovno preuzmu i
   * isparsiraju, a tek ako su ispravni i jednaki onima iz provjere ide upis.
   */
  async uveziPodsused(
    potvrda: ZetUvozPotvrda,
  ): Promise<{ stavke: ZetSyncStavka[] }> {
    const html = await this.scraper.fetchPodsusedPage();

    const pripreme: { dokument: ZetDokument; priprema: ZetPriprema }[] = [];
    for (const dokument of REDOSLIJED) {
      const priprema = await this.pripremiZaUvoz(html, dokument);

      if (priprema.sha256 !== potvrda?.[dokument]) {
        throw new ConflictException(
          `${NAZIVI[dokument]}: stanje se promijenilo nakon provjere. Ništa nije ubačeno – provjeri ponovno.`,
        );
      }
      pripreme.push({ dokument, priprema });
    }

    const stavke: ZetSyncStavka[] = [];
    for (const { dokument, priprema } of pripreme) {
      const { filename, spremi } = priprema;

      if (!spremi) {
        stavke.push({
          dokument,
          status: 'nema_promjene',
          poruka: priprema.poruka,
          filename,
        });
        continue;
      }

      try {
        const { poruka } = await spremi();
        stavke.push({ dokument, status: 'obradjeno', poruka, filename });
      } catch (err) {
        // Upis nije u transakciji, pa se ovdje samo staje i javlja stanje.
        this.logger.error(`ZET uvoz ${dokument} nije uspio`, err);
        stavke.push({
          dokument,
          status: 'greska',
          poruka: NEUSPJELO,
          filename,
        });
        break;
      }
    }

    this.logger.log(
      `ZET uvoz Podsused: ${stavke.map((s) => `${s.dokument}=${s.status}`).join(', ')}`,
    );
    return { stavke };
  }

  private async provjeriDokument(
    html: string,
    dokument: ZetDokument,
  ): Promise<ZetSyncStavka> {
    const link = this.scraper.findLink(html, dokument);
    if (!link) {
      this.logger.error(`ZET provjera ${dokument}: PDF link nije pronađen`);
      return { dokument, status: 'greska', poruka: NEUSPJELO };
    }

    let hash: string | undefined;
    try {
      const pdf = await this.scraper.downloadPdf(link);
      hash = sha256(pdf.buffer);

      const { status, poruka, filename } = await this.pripremi(pdf, dokument);
      return {
        dokument,
        status,
        poruka,
        filename,
        url: link.url,
        sha256: hash,
      };
    } catch (err) {
      this.logger.error(`ZET provjera ${dokument} nije uspjela`, err);
      return {
        dokument,
        status: 'greska',
        poruka: NEUSPJELO,
        url: link.url,
        sha256: hash,
      };
    }
  }

  private async pripremiZaUvoz(
    html: string,
    dokument: ZetDokument,
  ): Promise<ZetPriprema> {
    const link = this.scraper.findLink(html, dokument);
    if (!link) {
      throw new BadGatewayException(NEUSPJELO);
    }

    try {
      const pdf = await this.scraper.downloadPdf(link);
      return await this.pripremi(pdf, dokument);
    } catch (err) {
      this.logger.error(`ZET uvoz ${dokument} nije uspio`, err);
      throw new BadGatewayException(NEUSPJELO);
    }
  }

  private async pripremi(
    pdf: PdfInput,
    dokument: ZetDokument,
  ): Promise<ZetPriprema> {
    if (dokument === 'sluzba') {
      const p = await this.sluzbaUploadService.pripremi(pdf);
      return p.status === 'novo'
        ? {
            ...p,
            spremi: () => this.sluzbaUploadService.spremi(pdf, p, 'zet'),
          }
        : p;
    }

    const p = await this.disponentUploadService.pripremi(pdf);
    return p.status === 'novo'
      ? {
          ...p,
          spremi: () => this.disponentUploadService.spremi(pdf, p, 'zet'),
        }
      : p;
  }
}
