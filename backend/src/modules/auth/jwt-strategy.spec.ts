import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './strategies/jwt.strategy';

const makeStrategy = (prisma: any) => {
  const configService = { getOrThrow: () => 'test-secret' } as any;
  return new JwtStrategy(configService, prisma);
};

const BASE_PAYLOAD = {
  sub: 'user-id-1',
  correoElectronico: 'docente@test.com',
  rol: { nombre: 'DOCENTE' },
  sesionId: 'sesion-id-1',
};

describe('JwtStrategy.validate — M-05a (rol desde BD) y M-05b (usuario.activo)', () => {
  describe('sin sesionId', () => {
    it('retorna el payload del JWT tal cual (no hay sesionId que verificar)', async () => {
      const prisma = { sesion: { findUnique: jest.fn() } };
      const strategy = makeStrategy(prisma);
      const payload = { ...BASE_PAYLOAD, sesionId: undefined };

      const result = await strategy.validate(payload);

      expect(prisma.sesion.findUnique).not.toHaveBeenCalled();
      expect(result.rol.nombre).toBe('DOCENTE');
    });
  });

  describe('sesion inválida o revocada', () => {
    it('lanza 401 si la sesión no existe', async () => {
      const prisma = { sesion: { findUnique: jest.fn().mockResolvedValue(null) } };
      const strategy = makeStrategy(prisma);

      await expect(strategy.validate(BASE_PAYLOAD)).rejects.toThrow(UnauthorizedException);
    });

    it('lanza 401 si sesion.activo es false', async () => {
      const prisma = {
        sesion: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'sesion-id-1',
            activo: false,
            usuario: { activo: true, rol: { nombre: 'DOCENTE' } },
          }),
        },
      };
      const strategy = makeStrategy(prisma);

      await expect(strategy.validate(BASE_PAYLOAD)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('M-05b — usuario desactivado', () => {
    it('lanza 401 cuando usuario.activo es false aunque la sesión esté activa', async () => {
      const prisma = {
        sesion: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'sesion-id-1',
            activo: true,
            usuario: { activo: false, rol: { nombre: 'DOCENTE' } },
          }),
        },
      };
      const strategy = makeStrategy(prisma);

      await expect(strategy.validate(BASE_PAYLOAD)).rejects.toThrow(
        new UnauthorizedException('Cuenta desactivada'),
      );
    });
  });

  describe('M-05a — rol actual desde BD, no del JWT', () => {
    it('retorna el rol actual de BD aunque el JWT traiga otro rol', async () => {
      const prisma = {
        sesion: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'sesion-id-1',
            activo: true,
            usuario: { activo: true, rol: { nombre: 'ADMINISTRATIVO' } },
          }),
        },
      };
      const strategy = makeStrategy(prisma);
      // JWT dice DOCENTE, BD dice ADMINISTRATIVO (rol fue degradado)
      const payload = { ...BASE_PAYLOAD, rol: { nombre: 'DOCENTE' } };

      const result = await strategy.validate(payload);

      expect(result.rol.nombre).toBe('ADMINISTRATIVO');
    });

    it('retorna el rol DOCENTE cuando BD y JWT coinciden', async () => {
      const prisma = {
        sesion: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'sesion-id-1',
            activo: true,
            usuario: { activo: true, rol: { nombre: 'DOCENTE' } },
          }),
        },
      };
      const strategy = makeStrategy(prisma);

      const result = await strategy.validate(BASE_PAYLOAD);

      expect(result.rol.nombre).toBe('DOCENTE');
      expect(result.id).toBe('user-id-1');
      expect(result.correoElectronico).toBe('docente@test.com');
      expect(result.sesionId).toBe('sesion-id-1');
    });
  });
});
