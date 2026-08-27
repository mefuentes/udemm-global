import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CsrfMiddleware } from './csrf.middleware';

const mockConfig = {
  get: (key: string) =>
    key === 'FRONTEND_URL' ? 'http://localhost:3000' : undefined,
} as unknown as ConfigService;

describe('CsrfMiddleware', () => {
  let mw: CsrfMiddleware;

  beforeEach(() => { mw = new CsrfMiddleware(mockConfig); });

  function run(
    method: string,
    path: string,
    headers: Record<string, string> = {},
  ): Promise<'ok'> {
    return new Promise((resolve, reject) => {
      try {
        mw.use({ method, path, headers } as any, {} as any, () => resolve('ok'));
      } catch (e) { reject(e); }
    });
  }

  // ── Métodos no mutantes ────────────────────────────────────────────────────
  describe('métodos no mutantes → pasan siempre', () => {
    it('GET', () => expect(run('GET', '/docentes')).resolves.toBe('ok'));
    it('HEAD', () => expect(run('HEAD', '/cualquier')).resolves.toBe('ok'));
    it('OPTIONS (preflight)', () => expect(run('OPTIONS', '/auth/me')).resolves.toBe('ok'));
  });

  // ── Exclusiones explícitas ─────────────────────────────────────────────────
  describe('CSRF_SKIP_PATHS → excluidos del check', () => {
    it('POST /auth/login → pasa aunque tenga Origin de atacante', () =>
      expect(run('POST', '/auth/login', { origin: 'http://evil.com' })).resolves.toBe('ok'));

    it('POST /auth/solicitar-recuperacion → pasa sin headers', () =>
      expect(run('POST', '/auth/solicitar-recuperacion')).resolves.toBe('ok'));

    it('POST /auth/restablecer-contrasena → pasa sin headers', () =>
      expect(run('POST', '/auth/restablecer-contrasena')).resolves.toBe('ok'));
  });

  // ── Origin ausente → 403 ──────────────────────────────────────────────────
  describe('Origin ausente → ForbiddenException', () => {
    it('POST autenticado sin Origin', () =>
      expect(run('POST', '/docentes')).rejects.toBeInstanceOf(ForbiddenException));

    it('DELETE sin Origin', () =>
      expect(run('DELETE', '/docentes/123')).rejects.toBeInstanceOf(ForbiddenException));

    it('PATCH sin Origin aunque tenga X-Requested-With', () =>
      expect(
        run('PATCH', '/docentes/123', { 'x-requested-with': 'XMLHttpRequest' }),
      ).rejects.toBeInstanceOf(ForbiddenException));

    it('POST /auth/refresh sin Origin', () =>
      expect(run('POST', '/auth/refresh')).rejects.toBeInstanceOf(ForbiddenException));

    it('POST /auth/logout sin Origin', () =>
      expect(run('POST', '/auth/logout')).rejects.toBeInstanceOf(ForbiddenException));
  });

  // ── Origin incorrecto → 403 ───────────────────────────────────────────────
  describe('Origin incorrecto → ForbiddenException', () => {
    it('POST con origin de atacante + X-Requested-With', () =>
      expect(
        run('POST', '/docentes', {
          origin: 'http://evil.com',
          'x-requested-with': 'XMLHttpRequest',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException));

    it('POST con puerto distinto (localhost:3001)', () =>
      expect(
        run('POST', '/docentes', {
          origin: 'http://localhost:3001',
          'x-requested-with': 'XMLHttpRequest',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException));
  });

  // ── Origin correcto pero falta X-Requested-With → 403 ─────────────────────
  describe('X-Requested-With ausente o incorrecto → ForbiddenException', () => {
    it('POST con Origin correcto sin X-Requested-With', () =>
      expect(
        run('POST', '/docentes', { origin: 'http://localhost:3000' }),
      ).rejects.toBeInstanceOf(ForbiddenException));

    it('POST con X-Requested-With con valor incorrecto', () =>
      expect(
        run('POST', '/docentes', {
          origin: 'http://localhost:3000',
          'x-requested-with': 'fetch',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException));
  });

  // ── Credenciales completas → pasa ─────────────────────────────────────────
  describe('Origin correcto + X-Requested-With → pasa', () => {
    const h = { origin: 'http://localhost:3000', 'x-requested-with': 'XMLHttpRequest' };

    it('POST /docentes → pasa', () => expect(run('POST', '/docentes', h)).resolves.toBe('ok'));
    it('PUT /docentes/123 → pasa', () => expect(run('PUT', '/docentes/123', h)).resolves.toBe('ok'));
    it('PATCH /docentes/123 → pasa', () => expect(run('PATCH', '/docentes/123', h)).resolves.toBe('ok'));
    it('DELETE /docentes/123 → pasa', () => expect(run('DELETE', '/docentes/123', h)).resolves.toBe('ok'));
    it('POST /auth/refresh legítimo → pasa', () => expect(run('POST', '/auth/refresh', h)).resolves.toBe('ok'));
    it('POST /auth/logout legítimo → pasa', () => expect(run('POST', '/auth/logout', h)).resolves.toBe('ok'));
  });
});
