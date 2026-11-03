import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, timingSafeEqual } from 'crypto';

export const PRISTUP_HEADER = 'x-pristup-token';

const MAX_POKUSAJA = 10;
const PROZOR_MS = 15 * 60 * 1000;

/**
 * Zajednička lozinka za vozače (VOZAC_LOZINKA u .env).
 *
 * Točna lozinka daje pristupni token koji praktički ne istječe, pa je
 * vozač upisuje samo jednom po uređaju. Token u sebi nosi otisak lozinke:
 * promjenom VOZAC_LOZINKA svi stari tokeni prestaju vrijediti.
 */
@Injectable()
export class PristupService {
  private readonly logger = new Logger(PristupService.name);
  private readonly neuspjesni = new Map<string, { broj: number; od: number }>();

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {
    if (!this.lozinka) {
      this.logger.warn(
        'VOZAC_LOZINKA nije postavljena – aplikacija je dostupna bez lozinke!',
      );
    }
  }

  private get lozinka(): string {
    return this.config.get<string>('VOZAC_LOZINKA') || '';
  }

  get ukljucen(): boolean {
    return this.lozinka.length > 0;
  }

  private get otisak(): string {
    return createHash('sha256')
      .update(`${this.lozinka}:${this.config.get<string>('JWT_SECRET')}`)
      .digest('hex')
      .slice(0, 16);
  }

  provjeriLozinku(unos: string | undefined): boolean {
    if (!unos) return false;
    const a = createHash('sha256').update(unos).digest();
    const b = createHash('sha256').update(this.lozinka).digest();
    return timingSafeEqual(a, b);
  }

  izdajToken(): string {
    return this.jwt.sign(
      { pristup: true, v: this.otisak },
      { expiresIn: '3650d' },
    );
  }

  provjeriToken(token: string | undefined): boolean {
    if (!token) return false;
    try {
      const payload = this.jwt.verify(token);
      return payload?.pristup === true && payload?.v === this.otisak;
    } catch {
      return false;
    }
  }

  provjeriAdminToken(authHeader: string | undefined): boolean {
    const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return false;
    try {
      return this.jwt.verify(token)?.isAdmin === true;
    } catch {
      return false;
    }
  }

  /** Jednostavna zaštita od pogađanja lozinke, po IP adresi. */
  previseNeuspjelih(ip: string): boolean {
    const z = this.neuspjesni.get(ip);
    if (!z) return false;
    if (Date.now() - z.od > PROZOR_MS) {
      this.neuspjesni.delete(ip);
      return false;
    }
    return z.broj >= MAX_POKUSAJA;
  }

  zabiljeziNeuspjeh(ip: string): void {
    const z = this.neuspjesni.get(ip);
    if (!z || Date.now() - z.od > PROZOR_MS) {
      this.neuspjesni.set(ip, { broj: 1, od: Date.now() });
    } else {
      z.broj++;
    }
  }

  ocistiNeuspjehe(ip: string): void {
    this.neuspjesni.delete(ip);
  }
}
