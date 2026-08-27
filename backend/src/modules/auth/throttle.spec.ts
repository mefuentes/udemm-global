import { Controller, HttpCode, INestApplication, Post } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';

// ── Controlador mínimo que replica los límites del AuthController real ────────
// No requiere base de datos — solo valida el comportamiento del ThrottlerGuard.
@Controller('auth')
class MockAuthController {
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login() { return { ok: true }; }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  refresh() { return { ok: true }; }

  @Post('solicitar-recuperacion')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 900_000 } })
  solicitar() { return { ok: true }; }

  @Post('restablecer-contrasena')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  restablecer() { return { ok: true }; }
}

// ── Suite ─────────────────────────────────────────────────────────────────────
describe('Rate Limiting — AuthController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
      ],
      controllers: [MockAuthController],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  const post = (path: string) =>
    request(app.getHttpServer()).post(path);

  describe('POST /auth/login — límite 5 / 60 s', () => {
    it('primeras 5 solicitudes → 200', async () => {
      for (let i = 0; i < 5; i++) await post('/auth/login').expect(200);
    });
    it('solicitud 6 → 429', () => post('/auth/login').expect(429));
  });

  describe('POST /auth/refresh — límite 20 / 60 s', () => {
    it('primeras 20 solicitudes → 200', async () => {
      for (let i = 0; i < 20; i++) await post('/auth/refresh').expect(200);
    });
    it('solicitud 21 → 429', () => post('/auth/refresh').expect(429));
  });

  describe('POST /auth/solicitar-recuperacion — límite 3 / 15 min', () => {
    it('primeras 3 solicitudes → 200', async () => {
      for (let i = 0; i < 3; i++) await post('/auth/solicitar-recuperacion').expect(200);
    });
    it('solicitud 4 → 429', () => post('/auth/solicitar-recuperacion').expect(429));
  });

  describe('POST /auth/restablecer-contrasena — límite 5 / 15 min', () => {
    it('primeras 5 solicitudes → 200', async () => {
      for (let i = 0; i < 5; i++) await post('/auth/restablecer-contrasena').expect(200);
    });
    it('solicitud 6 → 429', () => post('/auth/restablecer-contrasena').expect(429));
  });
});
