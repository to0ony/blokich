import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Iza nginxa: prava IP adresa klijenta iz X-Forwarded-For (rate limit lozinke).
  app.set('trust proxy', 1);
  // Sažimanje odgovora (gzip): karta svakih 5 s dohvaća ~90 KB JSON-a, sažeto ~10 KB.
  app.use(compression());

  app.enableCors({
    origin: [
      'http://localhost:4200',
      'https://sluzbe.vercel.app',
      'https://blokich.vercel.app',
      'https://sluzbe-git-develop-to0onys-projects.vercel.app',
      'https://blokich-git-develop-to0onys-projects.vercel.app',
      // Vercel preview deploy bilo kojeg brancha, npr.
      // https://blokich-git-feature-vozac-redizajn-to0onys-projects.vercel.app
      /^https:\/\/(blokich|sluzbe)-git-[a-z0-9-]+-to0onys-projects\.vercel\.app$/,
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
