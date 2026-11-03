import {
  Controller,
  Post,
  Body,
  Headers,
  Ip,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from '../../services/auth/auth.service';
import { Public } from '../../authentication/decorators/public.decorator';
import { AdminOnly } from '../../authentication/decorators/admin-only.decorator';
import { JwtAuthGuard } from '../../modules/auth/jwt-auth.guard';
import {
  PRISTUP_HEADER,
  PristupService,
} from '../../authentication/pristup/pristup.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly pristup: PristupService,
  ) {}

  /**
   * Prijava vozača službenim brojem. Uređaj koji još nema pristupni token
   * mora poslati i zajedničku lozinku (VOZAC_LOZINKA) – tada dobiva token
   * koji se sprema u preglednik i lozinka više ne treba.
   */
  @Public()
  @Post('login')
  async login(
    @Body('sluzbeniBroj') sluzbeniBroj: string,
    @Body('lozinka') lozinka: string | undefined,
    @Headers(PRISTUP_HEADER) postojeciToken: string | undefined,
    @Ip() ip: string,
  ) {
    let pristupToken: string | undefined;

    if (this.pristup.ukljucen && !this.pristup.provjeriToken(postojeciToken)) {
      if (this.pristup.previseNeuspjelih(ip)) {
        throw new HttpException(
          {
            statusCode: 429,
            code: 'PRISTUP',
            message: 'Previše pogrešnih pokušaja. Pokušaj ponovno za 15 minuta.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      if (!this.pristup.provjeriLozinku(lozinka)) {
        if (lozinka) this.pristup.zabiljeziNeuspjeh(ip);
        throw new UnauthorizedException({
          statusCode: 401,
          code: 'PRISTUP',
          message: lozinka ? 'Pogrešna lozinka.' : 'Unesi lozinku.',
        });
      }

      this.pristup.ocistiNeuspjehe(ip);
      pristupToken = this.pristup.izdajToken();
    }

    const vozac = await this.authService.validateVozac(sluzbeniBroj);

    if (!vozac) {
      throw new NotFoundException('Vozač nije pronađen.');
    }

    return {
      success: true,
      sluzbeniBroj: vozac.sluzbeniBroj,
      imePrezime: vozac.imePrezime,
      kontaktBroj: vozac.kontaktBroj,
      kontaktBrojInfo: vozac.kontaktBrojInfo,
      pristupToken,
    };
  }

  // Novog admina može napraviti samo postojeći admin.
  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @Post('admin-create')
  async createAdmin(
    @Body('username') username: string,
    @Body('password') password: string,
    @Body('email') email?: string,
  ) {
    // ako već postoji admin s tim imenom
    const existing = await this.authService.findAdminByUsername(username);
    if (existing) {
      throw new ConflictException('Admin već postoji.');
    }

    const admin = await this.authService.createAdmin({
      username,
      password,
      email,
    });

    return {
      success: true,
      admin: {
        username: admin.username,
        email: admin.email,
      },
    };
  }

  @Public()
  @Post('admin-login')
  async adminLogin(
    @Body('username') username: string,
    @Body('password') password: string,
  ) {
    const admin = await this.authService.validateAdmin(username, password);
    if (!admin) {
      throw new UnauthorizedException('Neispravni admin podaci.');
    }

    const token = await this.authService.generateAdminToken(admin);

    return {
      success: true,
      token,
    };
  }
}
