import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from '../../services/auth/auth.service';
import { PristupService } from '../../authentication/pristup/pristup.service';
import { PristupGuard } from '../../authentication/pristup/pristup.guard';

describe('POST /auth/login s lozinkom za pristup', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [() => ({ JWT_SECRET: 's', VOZAC_LOZINKA: 'tajna123' })],
        }),
        JwtModule.register({ secret: 's', signOptions: { expiresIn: '2h' } }),
      ],
      controllers: [AuthController],
      providers: [
        PristupService,
        { provide: APP_GUARD, useClass: PristupGuard },
        {
          provide: AuthService,
          useValue: {
            validateVozac: async (broj: string) =>
              broj === '00466'
                ? { sluzbeniBroj: '00466', imePrezime: 'Test Vozač' }
                : null,
          },
        },
      ],
    }).compile();
    app = mod.createNestApplication({ logger: false });
    await app.init();
  });
  afterAll(() => app.close());

  const login = (body: object, token?: string) => {
    const r = request(app.getHttpServer()).post('/auth/login').send(body);
    return token ? r.set('X-Pristup-Token', token) : r;
  };

  it('bez lozinke: 401 "Unesi lozinku."', async () => {
    const res = await login({ sluzbeniBroj: '00466' }).expect(401);
    expect(res.body).toMatchObject({ code: 'PRISTUP', message: 'Unesi lozinku.' });
  });

  it('pogrešna lozinka: 401 "Pogrešna lozinka."', async () => {
    const res = await login({ sluzbeniBroj: '00466', lozinka: 'x' }).expect(401);
    expect(res.body.message).toBe('Pogrešna lozinka.');
  });

  it('točna lozinka vrati vozača i pristupni token, poslije lozinka ne treba', async () => {
    const prvi = await login({ sluzbeniBroj: '00466', lozinka: 'tajna123' }).expect(201);
    expect(prvi.body.imePrezime).toBe('Test Vozač');
    expect(prvi.body.pristupToken).toEqual(expect.any(String));

    const drugi = await login({ sluzbeniBroj: '00466' }, prvi.body.pristupToken).expect(201);
    expect(drugi.body.imePrezime).toBe('Test Vozač');
    expect(drugi.body.pristupToken).toBeUndefined();
  });

  it('točna lozinka, nepostojeći vozač: 404', () =>
    login({ sluzbeniBroj: '99999', lozinka: 'tajna123' }).expect(404));

  it('admin-create više nije javan', () =>
    request(app.getHttpServer())
      .post('/auth/admin-create')
      .send({ username: 'haker', password: 'x' })
      .expect(401));
});
