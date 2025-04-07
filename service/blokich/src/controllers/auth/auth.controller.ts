import {
  Controller,
  Post,
  Body,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { AuthService } from '../../services/auth/auth.service';
import * as bcrypt from 'bcrypt';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body('sluzbeniBroj') sluzbeniBroj: string) {
    // console.log(sluzbeniBroj);
    const vozac = await this.authService.validateVozac(sluzbeniBroj);

    if (!vozac) {
      throw new NotFoundException('Vozač nije pronađen.');
    }

    return {
      success: true,
      sluzbeniBroj: vozac.sluzbeniBroj,
      imePrezime: vozac.imePrezime,
    };
  }

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
