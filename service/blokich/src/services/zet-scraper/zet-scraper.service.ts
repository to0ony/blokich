import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as cheerio from 'cheerio';
import { PdfInput } from 'src/pdf/pdf-input';

export type ZetDokument = 'disponent' | 'sluzba';

export interface ZetLink {
  url: string;
  tekst: string;
}

const USER_AGENT = 'Mozilla/5.0 (compatible; Blokich/1.0)';
const TIMEOUT_MS = 30_000;

/**
 * Dohvaća PDF-ove sa ZET intraneta (https://www.zet.hr/interno/).
 *
 * Login je obična forma (polje "pojam") koja postavlja ASP.NET_SessionId
 * cookie. Cookie treba samo za stranicu s linkovima – sami PDF-ovi su javni.
 */
@Injectable()
export class ZetScraperService {
  private readonly logger = new Logger(ZetScraperService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.baseUrl = (
      this.config.get<string>('ZET_INTERNO_BASE_URL') ||
      'https://www.zet.hr/interno'
    ).replace(/\/+$/, '');
  }

  /** Ulogira se i vrati HTML stranice AP Podsused. */
  async fetchPodsusedPage(): Promise<string> {
    const cookie = await this.login();
    const pageId = this.config.get<string>('ZET_PODSUSED_PAGE_ID') || '1043';
    const html = await this.getText(
      `${this.baseUrl}/default.aspx?id=${pageId}`,
      cookie,
    );

    if (!this.isLoggedIn(html)) {
      throw new BadGatewayException(
        'ZET sesija nije valjana – stranica AP Podsused traži ponovni login.',
      );
    }
    return html;
  }

  /** Iz HTML-a stranice AP Podsused izvuče link na traženi PDF. */
  findLink(html: string, dokument: ZetDokument): ZetLink | null {
    const $ = cheerio.load(html);
    const linkovi = $('.pageContent a[href]')
      .toArray()
      .map((el) => ({
        href: $(el).attr('href') || '',
        tekst: $(el).text().replace(/\s+/g, ' ').trim(),
      }))
      .filter((l) => /\.pdf(\?|$)/i.test(l.href));

    const nadji = (
      pred: (l: { href: string; tekst: string }) => boolean,
    ): ZetLink | null => {
      const l = linkovi.find(pred);
      return l
        ? { url: new URL(l.href, `${this.baseUrl}/`).toString(), tekst: l.tekst }
        : null;
    };

    if (dokument === 'disponent') {
      // ZET ga zove "SLUŽBE OD dd.mm. DO dd.mm.yyyy.", datoteka DisponentRaspored*.pdf
      return (
        nadji((l) => /disponentraspored/i.test(l.href)) ??
        nadji((l) => /^slu[žz]be\s+od/i.test(l.tekst))
      );
    }

    // ZET ga zove "Raspored rada", datoteka u mapi "Raspored rada vozača"
    return nadji((l) => /raspored rada voza/i.test(l.href));
  }

  async downloadPdf(link: ZetLink): Promise<PdfInput> {
    const res = await firstValueFrom(
      this.http.get<ArrayBuffer>(link.url, {
        responseType: 'arraybuffer',
        timeout: TIMEOUT_MS,
        headers: { 'User-Agent': USER_AGENT },
      }),
    ).catch((err) => {
      throw new BadGatewayException(
        `Preuzimanje PDF-a sa ZET-a nije uspjelo: ${err.message}`,
      );
    });

    const buffer = Buffer.from(res.data);
    if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw new BadGatewayException(
        'Datoteka preuzeta sa ZET-a nije PDF.',
      );
    }

    const originalname = decodeURIComponent(
      new URL(link.url).pathname.split('/').pop() || 'zet.pdf',
    );
    return { buffer, originalname, mimetype: 'application/pdf' };
  }

  private async login(): Promise<string> {
    const password = this.config.get<string>('ZET_INTERNO_PASSWORD');
    if (!password) {
      throw new BadGatewayException(
        'ZET_INTERNO_PASSWORD nije postavljen u .env datoteci.',
      );
    }

    const res = await firstValueFrom(
      this.http.post<string>(
        `${this.baseUrl}/default.aspx?a=login`,
        new URLSearchParams({ pojam: password }).toString(),
        {
          responseType: 'text',
          timeout: TIMEOUT_MS,
          maxRedirects: 0,
          validateStatus: (s) => s >= 200 && s < 400,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': USER_AGENT,
          },
        },
      ),
    ).catch((err) => {
      throw new BadGatewayException(
        `ZET stranica nije dostupna: ${err.message}`,
      );
    });

    const setCookie = res.headers['set-cookie'] ?? [];
    const cookie = setCookie.map((c: string) => c.split(';')[0]).join('; ');

    if (!cookie || (res.status === 200 && !this.isLoggedIn(res.data))) {
      this.logger.warn('Login na ZET intranet nije uspio.');
      throw new BadGatewayException(
        'Login na ZET nije uspio – provjeri ZET_INTERNO_PASSWORD.',
      );
    }
    return cookie;
  }

  private async getText(url: string, cookie: string): Promise<string> {
    const res = await firstValueFrom(
      this.http.get<string>(url, {
        responseType: 'text',
        timeout: TIMEOUT_MS,
        headers: { Cookie: cookie, 'User-Agent': USER_AGENT },
      }),
    ).catch((err) => {
      throw new BadGatewayException(
        `ZET stranica nije dostupna: ${err.message}`,
      );
    });
    return res.data;
  }

  /** Ulogirana stranica ima formu za odjavu. */
  private isLoggedIn(html: string): boolean {
    return /default\.aspx\?a=logoff/i.test(html);
  }
}
