import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { Public } from '../decorators/public.decorator';
import { PristupGuard } from './pristup.guard';
import { PristupService } from './pristup.service';

@Controller()
class TestController {
  @Get('tajno')
  tajno() {
    return { ok: true };
  }

  @Public()
  @Get('javno')
  javno() {
    return { ok: true };
  }
}

async function napraviApp(env: Record<string, string>) {
  @Module({
    imports: [
      ConfigModule.forRoot({
        ignoreEnvFile: true,
        load: [() => ({ JWT_SECRET: 'test-secret', ...env })],
      }),
      JwtModule.register({
        secret: 'test-secret',
        signOptions: { expiresIn: '2h' },
      }),
    ],
    controllers: [TestController],
    providers: [PristupService, { provide: APP_GUARD, useClass: PristupGuard }],
  })
  class TestModule {}

  const mod = await Test.createTestingModule({ imports: [TestModule] }).compile();
  const app = mod.createNestApplication({ logger: false });
  await app.init();
  return { app, pristup: mod.get(PristupService), jwt: mod.get(JwtService) };
}

describe('PristupGuard', () => {
  let app: INestApplication;
  let pristup: PristupService;
  let jwt: JwtService;

  beforeAll(async () => {
    ({ app, pristup, jwt } = await napraviApp({ VOZAC_LOZINKA: 'tajna123' }));
  });
  afterAll(() => app.close());

  it('bez tokena odbije zaštićeni endpoint s kodom PRISTUP', async () => {
    const res = await request(app.getHttpServer()).get('/tajno').expect(401);
    expect(res.body.code).toBe('PRISTUP');
  });

  it('pusti @Public endpoint bez tokena', () =>
    request(app.getHttpServer()).get('/javno').expect(200));

  it('pusti s valjanim pristupnim tokenom', () =>
    request(app.getHttpServer())
      .get('/tajno')
      .set('X-Pristup-Token', pristup.izdajToken())
      .expect(200));

  it('pusti s admin JWT-om', () =>
    request(app.getHttpServer())
      .get('/tajno')
      .set('Authorization', `Bearer ${jwt.sign({ username: 'a', isAdmin: true })}`)
      .expect(200));

  it('odbije krivotvoreni ili tuđi token', async () => {
    const tudji = new JwtService({ secret: 'drugi' }).sign({ pristup: true });
    await request(app.getHttpServer())
      .get('/tajno')
      .set('X-Pristup-Token', tudji)
      .expect(401);
    await request(app.getHttpServer())
      .get('/tajno')
      .set('X-Pristup-Token', 'smece')
      .expect(401);
  });

  it('token vrijedi ~10 godina', () => {
    const payload = jwt.decode(pristup.izdajToken()) as any;
    const godina = (payload.exp - payload.iat) / (365 * 24 * 3600);
    expect(godina).toBeGreaterThan(9.9);
  });

  it('provjerava lozinku', () => {
    expect(pristup.provjeriLozinku('tajna123')).toBe(true);
    expect(pristup.provjeriLozinku('tajna12')).toBe(false);
    expect(pristup.provjeriLozinku(undefined)).toBe(false);
  });

  it('promjena lozinke poništi stare tokene', async () => {
    const stari = pristup.izdajToken();
    const drugi = await napraviApp({ VOZAC_LOZINKA: 'nova-lozinka' });
    expect(drugi.pristup.provjeriToken(stari)).toBe(false);
    await drugi.app.close();
  });

  it('nakon 10 pogrešnih pokušaja blokira IP', () => {
    for (let i = 0; i < 10; i++) pristup.zabiljeziNeuspjeh('1.2.3.4');
    expect(pristup.previseNeuspjelih('1.2.3.4')).toBe(true);
    expect(pristup.previseNeuspjelih('5.6.7.8')).toBe(false);
  });
});

describe('PristupGuard bez VOZAC_LOZINKA', () => {
  it('ne zaključava aplikaciju', async () => {
    const { app } = await napraviApp({});
    await request(app.getHttpServer()).get('/tajno').expect(200);
    await app.close();
  });
});
