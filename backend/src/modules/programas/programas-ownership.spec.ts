import { ForbiddenException } from '@nestjs/common';
import { ProgramasService } from './programas.service';

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
const PROGRAMA_ID  = 'programa-id';

const MATERIA_A = {
  id: MATERIA_A_ID, codigo: 'MAT001', nombre: 'Materia A', planEstudioId: 'plan-1',
  creditos: 3, estado: 'ACTIVO', anio: 1, cuatrimestre: 1,
};

const PROGRAMA_BASE = {
  id: PROGRAMA_ID, materiaId: MATERIA_A_ID, estadoPrograma: 'PENDIENTE',
  estadoS1: 'PENDIENTE', estadoS2: 'PENDIENTE', estadoS3: 'PENDIENTE',
  estadoS4: 'PENDIENTE', estadoS5: 'PENDIENTE', estadoS6: 'PENDIENTE',
  objetivosGenerales: null, aportesPerfilTitulo: null,
  competenciasResultadosJson: null, contenidosGridJson: null,
  unidadesDidacticasJson: null, formacionPracticaJson: null,
  recursosDidacticos: null, metodologiaEnsenanza: null,
  modalidadEvaluacion: null, requisitosAprobacion: null,
  bibliografiaBasica: null, fechaVigenciaPrograma: null, fechaAprobacion: null,
  historial: [],
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
  },
  programaAsignatura: {
    findFirst: jest.fn().mockResolvedValue(PROGRAMA_BASE),
    findUnique: jest.fn().mockResolvedValue({ ...PROGRAMA_BASE, historial: [] }),
    upsert: jest.fn().mockResolvedValue(PROGRAMA_BASE),
  },
  historialPrograma: {
    create: jest.fn().mockResolvedValue({}),
  },
});

const makeService = (prisma: any) => new ProgramasService(prisma as any);

describe('ProgramasService — ownership DOCENTE — política definitiva S4', () => {
  describe('DOCENTE sin perfil docente asociado', () => {
    it('lanza 403', async () => {
      const prisma = makePrisma(true);
      prisma.docente.findUnique = jest.fn().mockResolvedValue(null);
      await expect(makeService(prisma).actualizarPrograma(MATERIA_A_ID, {}, USUARIO_ID, 'DOCENTE'))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('DOCENTE sin ninguna vinculación con la materia', () => {
    it('lanza 403', async () => {
      await expect(makeService(makePrisma(false)).actualizarPrograma(MATERIA_B_ID, {}, USUARIO_ID, 'DOCENTE'))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('DOCENTE con vinculación PENDIENTE_DE_APROBACION (Prisma no retorna nada con filtro APROBADA)', () => {
    it('lanza 403 — PENDIENTE no otorga permisos de modificación', async () => {
      await expect(
        makeService(makePrisma(false)).actualizarPrograma(MATERIA_A_ID, {}, USUARIO_ID, 'DOCENTE'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('DOCENTE con vinculación RECHAZADA (Prisma no retorna nada con filtro APROBADA)', () => {
    it('lanza 403', async () => {
      await expect(
        makeService(makePrisma(false)).actualizarPrograma(MATERIA_A_ID, {}, USUARIO_ID, 'DOCENTE'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('DOCENTE con vinculación DESVINCULADA (Prisma no retorna nada con filtro APROBADA)', () => {
    it('lanza 403 — vinculación histórica no otorga permisos', async () => {
      await expect(
        makeService(makePrisma(false)).actualizarPrograma(MATERIA_A_ID, {}, USUARIO_ID, 'DOCENTE'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('DOCENTE con vinculación APROBADA sobre Materia A', () => {
    it('permite editar el programa de Materia A', async () => {
      const prisma = makePrisma(true);
      const result = await makeService(prisma).actualizarPrograma(
        MATERIA_A_ID, { seccionModificada: 'S1' }, USUARIO_ID, 'DOCENTE',
      );
      expect(result).toBeDefined();
      expect(prisma.programaAsignatura.upsert).toHaveBeenCalled();
    });

    it('lanza 403 al intentar editar programa de Materia B (IDOR — manipulación de materiaId)', async () => {
      // DOCENTE tiene vinculación APROBADA con Materia A, pero intenta editar el programa de Materia B.
      const prisma = makePrisma(false);
      await expect(
        makeService(prisma).actualizarPrograma(MATERIA_B_ID, {}, USUARIO_ID, 'DOCENTE'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Roles institucionales — sin chequeo de ownership', () => {
    it('SECRETARIA_ACADEMICA puede editar cualquier programa sin verificar vinculación', async () => {
      const prisma = makePrisma(false);
      await makeService(prisma).actualizarPrograma(MATERIA_B_ID, {}, USUARIO_ID, 'SECRETARIA_ACADEMICA');
      expect(prisma.docente.findUnique).not.toHaveBeenCalled();
    });

    it('DIRECTOR_CARRERA puede editar cualquier programa sin verificar vinculación', async () => {
      const prisma = makePrisma(false);
      await makeService(prisma).actualizarPrograma(MATERIA_B_ID, {}, USUARIO_ID, 'DIRECTOR_CARRERA');
      expect(prisma.docente.findUnique).not.toHaveBeenCalled();
    });
  });
});
