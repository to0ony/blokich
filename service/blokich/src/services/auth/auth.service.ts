import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AdminService } from '../admin/admin.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Godisnji } from '../../schemas/godisnji.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Godisnji.name) private readonly godisnjiModel: Model<Godisnji>,
    private readonly adminService: AdminService,
    private readonly jwtService: JwtService,
  ) {}

  async validateVozac(
    sluzbeniBroj: string,
  ): Promise<{ sluzbeniBroj: string; imePrezime: string } | null> {
    const result = await this.godisnjiModel
      .aggregate([
        { $sort: { createdAt: -1 } },
        { $unwind: '$vozaci' },
        { $match: { 'vozaci.sluz_broj': sluzbeniBroj } },
        { $limit: 1 },
        {
          $project: {
            _id: 0,
            sluzbeniBroj: '$vozaci.sluz_broj',
            imePrezime: '$vozaci.ime_prezime',
            kontaktBroj: '$vozaci.kontakt_broj',
            kontaktBrojInfo: '$vozaci.kontakt_broj_info',
          },
        },
      ])
      .exec();

    return result[0] || null;
  }

  async validateAdmin(username: string, password: string) {
    const admin = await this.adminService.findByUsername(username);
    if (!admin) return null;

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return null;

    return {
      username: admin.username,
      email: admin.email,
      isAdmin: true,
    };
  }

  async generateAdminToken(admin: { username: string; isAdmin: boolean }) {
    const payload = { username: admin.username, isAdmin: true };
    return this.jwtService.sign(payload);
  }

  async createAdmin(data: {
    username: string;
    password: string;
    email?: string;
  }) {
    return this.adminService.create(data);
  }

  async findAdminByUsername(username: string) {
    return this.adminService.findByUsername(username);
  }

  async loginAdmin(username: string, password: string) {
    const admin = await this.validateAdmin(username, password);
    if (!admin) {
      throw new UnauthorizedException('Pogrešno korisničko ime ili lozinka.');
    }

    const payload = { username: admin.username, isAdmin: admin.isAdmin };
    const token = this.jwtService.sign(payload);
    const expiresIn = process.env.JWT_EXPIRATION_TIME || '2h';

    return {
      access_token: token,
      expires_in: expiresIn,
      token_type: 'Bearer',
    };
  }
}
