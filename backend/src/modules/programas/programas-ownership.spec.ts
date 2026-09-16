import { ForbiddenException } from '@nestjs/common';
import { ProgramasService } from './programas.service';

/**
 * FASE 3 — Control de acceso a Programas de Asignatura.
 *
 * Los únicos roles con permiso de edición son:
 *   DIRECTOR_CARRERA, DECANO, SECRETARIA_ACADEMICA, RECTORADO
 *
 * DOCENTE es solo lectura: bloqueado por RolesGuard a nivel de controlador.
 * En el servicio NO existe un branch específico para DOCENTE.
 * ADMINISTRADOR_SISTEMA y ADMINISTRATIVO también son solo lectura.
 */

const MATERIA_A_ID = 'materia-a-id';
const USUARIO_ID   = 'usuario-test-id';
const PROGRAMA_ID  = 'programa-id';
const CARRERA_ID   = 'carrera-test-id';

const MATERIA_A = {
  id: MATERIA_A_ID, codigo: 'MAT001', nombre: 'Materia A', planEstudioId: 'plan-1',
  creditos: 3, estado: 'ACTIVO', anio: 1, cuatrimestre: 1,
  planEstudio: { carreraId: CARRERA_ID },
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

const makePrisma = () => {
  const prisma: any = {
    docente:            { findUnique: jest.fn().mockResolvedValue(null) },
    vinculacionCatedra: { findFirst: jest.fn().mockResolvedValue(null) },
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
  };
  prisma.$transaction = jest.fn().mockImplementation((cb: any) => cb(prisma));
  return prisma;
};

const makeScopeService = (tieneScope = true) => ({
  tieneScopeCarrera: jest.fn().mockResolvedValue(tieneScope),
});

const makeService = (prisma: any, scopeService?: any) =>
  new ProgramasService(prisma as any, (scopeService ?? makeScopeService()) as any);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProgramasService — control de acceso (FASE 3)', () => {

  describe('SECRETARIA_ACADEMICA — sin consultas de ownership ni scope', () => {
    it('puede editar sin verificar vinculación docente ni scope de carrera', async () => {
      const prisma = makePrisma();
      const scope = makeScopeService(true);
      await makeService(prisma, scope).actualizarPrograma(MATERIA_A_ID, {}, USUARIO_ID, 'SECRETARIA_ACADEMICA');
      expect(prisma.docente.findUnique).not.toHaveBeenCalled();
      expect(scope.tieneScopeCarrera).not.toHaveBeenCalled();
      expect(prisma.programaAsignatura.upsert).toHaveBeenCalled();
    });
  });

  describe('DIRECTOR_CARRERA — verifica scope de carrera, no consulta docente/vinculacion', () => {
    it('puede editar programa de su carrera asignada', async () => {
      const prisma = makePrisma();
      const scope = makeScopeService(true);
      await makeService(prisma, scope).actualizarPrograma(MATERIA_A_ID, {}, USUARIO_ID, 'DIRECTOR_CARRERA');
      expect(prisma.docente.findUnique).not.toHaveBeenCalled();
      expect(scope.tieneScopeCarrera).toHaveBeenCalledWith(USUARIO_ID, 'DIRECTOR_CARRERA', CARRERA_ID);
    });

    it('recibe 403 al intentar editar programa de carrera fuera de su scope', async () => {
      const prisma = makePrisma();
      const scope = makeScopeService(false);
      await expect(makeService(prisma, scope).actualizarPrograma(MATERIA_A_ID, {}, USUARIO_ID, 'DIRECTOR_CARRERA'))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('DOCENTE — RBAC: bloqueado por RolesGuard, sin branch en el servicio', () => {
    it('no activa lookup de docente ni vinculación (el acceso está controlado por RolesGuard)', async () => {
      // DOCENTE no está en ROLES_EDITAR del controlador — nunca llega al servicio.
      // Si por algún motivo llegara, el servicio no tiene branch DOCENTE y no consulta
      // docente.findUnique ni vinculacionCatedra.findFirst.
      const prisma = makePrisma();
      await makeService(prisma).actualizarPrograma(MATERIA_A_ID, {}, USUARIO_ID, 'DOCENTE');
      expect(prisma.docente.findUnique).not.toHaveBeenCalled();
      expect(prisma.vinculacionCatedra.findFirst).not.toHaveBeenCalled();
    });
  });

});
