import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from '../../controllers/auth/auth.controller';
import { AuthService } from '../../services/auth/auth.service';
import { Godisnji, GodisnjiSchema } from '../../schemas/godisnji.schema';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { AdminModule } from '../admin/admin.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PristupService } from '../../authentication/pristup/pristup.service';
import { PristupGuard } from '../../authentication/pristup/pristup.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Godisnji.name, schema: GodisnjiSchema },
    ]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { 
          expiresIn: configService.get<string>('JWT_EXPIRATION_TIME', '2h')
        },
      }),
    }),
    AdminModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    PristupService,
    { provide: APP_GUARD, useClass: PristupGuard },
  ],
})
export class AuthModule {}
