import { ForbiddenException } from '@nestjs/common';
import { MateriasService } from './materias.service';

/**
 * El servicio ejecuta: vinculacionCatedra.findFirst({ where: { docenteId, materiaId, estado: 'APROBADA' } })
 * Los mocks simulan lo que Prisma devolvería con ese filtro:
 *   - estado 'APROBADA'  → findFirst retorna el registro (encontrado)
 *   - cualquier otro estado → findFirst retorna null (no encontrado, porque el filtro excluye ese estado)
 */

const MATERIA_A_ID = 'materia-a-id';
const MATERIA_B_ID = 'materia-b-id';
const USUARIO_ID   = 'usuario-docente-id';
const DOCENTE_ID   = 'docente-id';

const MATERIA_A = {
  id: MATERIA_A_ID, codigo: 'MAT001', nombre: 'Materia A',
  planEstudioId: 'plan-1', creditos: 3, estado: 'ACTIVO',
  anio: 1, cuatrimestre: 1, descripcion: null, bloqueConocimiento: null,
  cargaHorariaSemanal: 4, cargaHorariaTotal: 64, observaciones: null,
  regimenCursado: null, tipoAsignatura: 'OBLIGATORIA', modalidadDictado: null,
  fechaCreacion: new Date(), fechaActualizacion: new Date(),
};

// findFirst retorna el registro solo si la vinculación es APROBADA (simula el filtro Prisma)
const makePrisma = (tieneVinculacionAprobada: boolean) => ({
  docente: {
    findUnique: jest.fn().mockResolvedValue({ id: DOCENTE_ID, usuarioId: USUARIO_ID }),
  },
  vinculacionCatedra: {
    findFirst: jest.fn().mockResolvedValue(
      tieneVinculacionAprobada
        ? { id: 'vc-id', docenteId: DOCENTE_ID, materiaId: MATERIA_A_ID, estado: 'APROBADA' }
        : null,
    ),
  },
  materia: {
    findUnique: jest.fn().mockResolvedValue(MATERIA_A),
    update: jest.fn().mockResolvedValue(MATERIA_A),
  },
  historialMateria: {
    create: jest.fn().mockResolvedValue({}),
  },
});

const makeService = (prisma: any) => new MateriasService(prisma as any);

describe('MateriasService — ownership DOCENTE — política definitiva S4', () => {
  describe('DOCENTE sin perfil docente asociado', () => {
    it('lanza 403', async () => {
      const prisma = makePrisma(true);
      prisma.docente.findUnique = jest.fn().mockResolvedValue(null);
      await expect(makeService(prisma).actualizar(MATERIA_A_ID, {}, USUARIO_ID, 'DOCENTE'))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('DOCENTE sin ninguna vinculación con la materia', () => {
    it('lanza 403', async () => {
      await expect(makeService(makePrisma(false)).actualizar(MATERIA_B_ID, {}, USUARIO_ID, 'DOCENTE'))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('DOCENTE con vinculación PENDIENTE_DE_APROBACION (Prisma no retorna nada con filtro APROBADA)', () => {
    it('lanza 403 — PENDIENTE no otorga permisos de modificación', async () => {
      // Prisma filtra estado='APROBADA': como la vinculación es PENDIENTE, retorna null
      await expect(
        makeService(makePrisma(false)).actualizar(MATERIA_A_ID, {}, USUARIO_ID, 'DOCENTE'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('DOCENTE con vinculación RECHAZADA (Prisma no retorna nada con filtro APROBADA)', () => {
    it('lanza 403', async () => {
      await expect(
        makeService(makePrisma(false)).actualizar(MATERIA_A_ID, {}, USUARIO_ID, 'DOCENTE'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('DOCENTE con vinculación DESVINCULADA (Prisma no retorna nada con filtro APROBADA)', () => {
    it('lanza 403 — vinculación histórica no otorga permisos', async () => {
      await expect(
        makeService(makePrisma(false)).actualizar(MATERIA_A_ID, {}, USUARIO_ID, 'DOCENTE'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('DOCENTE con vinculación APROBADA sobre Materia A', () => {
    it('permite modificar Materia A', async () => {
      const prisma = makePrisma(true);
      const result = await makeService(prisma).actualizar(MATERIA_A_ID, { nombre: 'Nuevo nombre' }, USUARIO_ID, 'DOCENTE');
      expect(result).toBeDefined();
      expect(prisma.materia.update).toHaveBeenCalled();
    });

    it('lanza 403 al intentar modificar Materia B (IDOR — manipulación de materiaId)', async () => {
      // DOCENTE tiene vinculación APROBADA con Materia A, pero intenta modificar Materia B.
      // La query busca por materiaId=MATERIA_B, que no tiene vinculación → findFirst retorna null.
      const prisma = makePrisma(false);
      await expect(
        makeService(prisma).actualizar(MATERIA_B_ID, {}, USUARIO_ID, 'DOCENTE'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Roles institucionales — sin chequeo de ownership', () => {
    it('ADMINISTRADOR_SISTEMA puede modificar cualquier materia sin verificar vinculación', async () => {
      const prisma = makePrisma(false);
      await makeService(prisma).actualizar(MATERIA_B_ID, {}, USUARIO_ID, 'ADMINISTRADOR_SISTEMA');
      expect(prisma.docente.findUnique).not.toHaveBeenCalled();
    });

    it('SECRETARIA_ACADEMICA puede modificar cualquier materia sin verificar vinculación', async () => {
      const prisma = makePrisma(false);
      await makeService(prisma).actualizar(MATERIA_B_ID, {}, USUARIO_ID, 'SECRETARIA_ACADEMICA');
      expect(prisma.docente.findUnique).not.toHaveBeenCalled();
    });
  });
});
