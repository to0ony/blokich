import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { SluzbaModule } from './modules/sluzba/sluzba.module';
import { DisponentModule } from './modules/disponent/disponent.module';
import { GodisnjiModule } from './modules/godisnji/godisnji.module';
import { DisponentUploadModule } from './modules/disponent-upload/disponent-upload.module';
import { SluzbaUploadModule } from './modules/sluzba-upload/sluzba-upload.module';
import { VozacRasporedVoznjeModule } from './modules/vozac-raspored-voznje/vozac-raspored-voznje.module';
import { VozaciPoLinijiDanModule } from './modules/vozaci-po-liniji-dan/vozaci-po-liniji-dan.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdminService } from './services/admin/admin.service';
import { AdminModule } from './modules/admin/admin.module';
import { GodisnjiUploadModule } from './modules/godisnji-upload/godisnji-upload.module';
import { VozaciService } from './services/vozaci/vozaci.service';
import { VozaciController } from './controllers/vozaci/vozaci.controller';
import { VozaciModule } from './modules/vozaci/vozaci.module';
import { VozaciPoSluzbiDanModule } from './modules/vozaci-po-sluzbi-dan/vozaci-po-sluzbi-dan.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const uri = config.get<string>('MONGO_URI');
        if (!uri) {
          throw new Error('MONGO_URI nije postavljen u .env datoteci!');
        }
        return { uri };
      },
    }),
    SluzbaModule,
    SluzbaUploadModule,
    DisponentModule,
    DisponentUploadModule,
    GodisnjiModule,
    GodisnjiUploadModule,
    VozacRasporedVoznjeModule,
    VozaciPoLinijiDanModule,
    AuthModule,
    AdminModule,
    VozaciModule,
    VozaciPoSluzbiDanModule,
  ],
  providers: [AdminService],
})
export class AppModule {}
