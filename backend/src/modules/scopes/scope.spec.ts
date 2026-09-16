import { ScopeService } from './scope.service';

/**
 * Tests de infraestructura de scopes institucionales — FASE 1
 *
 * SCOPE != PERMISO
 * Estos tests verifican que ScopeService resuelve correctamente el alcance
 * institucional por rol, sin modificar ni evaluar permisos RBAC.
 *
 * Roles globales (sin restricción): ADMINISTRADOR_SISTEMA, SECRETARIA_ACADEMICA,
 *                                   RECTORADO, ADMINISTRATIVO
 * Roles con scope territorial:      DIRECTOR_CARRERA (por Carrera),
 *                                   DECANO (por Facultad → Carreras de esa Facultad)
 * Roles sin scope de gestión:        DOCENTE y cualquier otro
 */

const USUARIO_ID    = 'usuario-test-id';
const CARRERA_A_ID  = 'carrera-a-id';
const CARRERA_B_ID  = 'carrera-b-id';
const FACULTAD_A_ID = 'facultad-a-id';
const FACULTAD_B_ID = 'facultad-b-id';

// ── Prisma mocks ─────────────────────────────────────────────────────────────

function makePrismaDirector(tieneCarreraA: boolean) {
  return {
    usuarioCarrera: {
      findUnique: jest.fn().mockImplementation(({ where }: any) =>
        tieneCarreraA && where.usuarioId_carreraId.carreraId === CARRERA_A_ID
          ? Promise.resolve({ id: 'uc-1', usuarioId: USUARIO_ID, carreraId: CARRERA_A_ID })
          : Promise.resolve(null),
      ),
      findMany: jest.fn().mockResolvedValue(
        tieneCarreraA ? [{ carreraId: CARRERA_A_ID }] : [],
      ),
    },
    usuarioFacultad: { findFirst: jest.fn().mockResolvedValue(null) },
    carrera:         { findUnique: jest.fn(), findMany: jest.fn() },
  };
}

function makePrismaDecano(tieneFacultadA: boolean, carreraFacultadId: string) {
  return {
    usuarioCarrera:  { findUnique: jest.fn(), findMany: jest.fn() },
    usuarioFacultad: {
      findFirst: jest.fn().mockResolvedValue(
        tieneFacultadA ? { facultadId: FACULTAD_A_ID } : null,
      ),
    },
    carrera: {
      findUnique: jest.fn().mockResolvedValue({ facultadId: carreraFacultadId }),
      findMany: jest.fn().mockResolvedValue(
        tieneFacultadA ? [{ id: CARRERA_A_ID }] : [],
      ),
    },
  };
}

const makeService = (prisma: any) => new ScopeService(prisma as any);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ScopeService — infraestructura de scopes institucionales (FASE 1)', () => {

  // ── 1. DIRECTOR_CARRERA con asociación Carrera A ─────────────────────────

  describe('DIRECTOR_CARRERA asociado a Carrera A', () => {
    it('tiene scope sobre Carrera A', async () => {
      const service = makeService(makePrismaDirector(true));
      await expect(service.tieneScopeCarrera(USUARIO_ID, 'DIRECTOR_CARRERA', CARRERA_A_ID))
        .resolves.toBe(true);
    });

    it('NO tiene scope sobre Carrera B', async () => {
      const service = makeService(makePrismaDirector(true));
      await expect(service.tieneScopeCarrera(USUARIO_ID, 'DIRECTOR_CARRERA', CARRERA_B_ID))
        .resolves.toBe(false);
    });
  });

  // ── 2. DIRECTOR_CARRERA sin asociación ───────────────────────────────────

  describe('DIRECTOR_CARRERA sin ninguna asociación', () => {
    it('no tiene scope sobre ninguna Carrera', async () => {
      const service = makeService(makePrismaDirector(false));
      await expect(service.tieneScopeCarrera(USUARIO_ID, 'DIRECTOR_CARRERA', CARRERA_A_ID))
        .resolves.toBe(false);
    });

    it('getCarrerasEnScope devuelve array vacío', async () => {
      const service = makeService(makePrismaDirector(false));
      await expect(service.getCarrerasEnScope(USUARIO_ID, 'DIRECTOR_CARRERA'))
        .resolves.toEqual([]);
    });
  });

  // ── 3. DECANO asociado a Facultad A ──────────────────────────────────────

  describe('DECANO asociado a Facultad A', () => {
    it('tiene scope sobre Carrera que pertenece a Facultad A', async () => {
      const service = makeService(makePrismaDecano(true, FACULTAD_A_ID));
      await expect(service.tieneScopeCarrera(USUARIO_ID, 'DECANO', CARRERA_A_ID))
        .resolves.toBe(true);
    });

    it('NO tiene scope sobre Carrera que pertenece a Facultad B', async () => {
      const service = makeService(makePrismaDecano(true, FACULTAD_B_ID));
      await expect(service.tieneScopeCarrera(USUARIO_ID, 'DECANO', CARRERA_A_ID))
        .resolves.toBe(false);
    });
  });

  // ── 4. DECANO sin asociación ─────────────────────────────────────────────

  describe('DECANO sin ninguna asociación', () => {
    it('no tiene scope sobre ninguna Carrera', async () => {
      const service = makeService(makePrismaDecano(false, FACULTAD_A_ID));
      await expect(service.tieneScopeCarrera(USUARIO_ID, 'DECANO', CARRERA_A_ID))
        .resolves.toBe(false);
    });

    it('getCarrerasEnScope devuelve array vacío', async () => {
      const service = makeService(makePrismaDecano(false, FACULTAD_A_ID));
      await expect(service.getCarrerasEnScope(USUARIO_ID, 'DECANO'))
        .resolves.toEqual([]);
    });
  });

  // ── 5. Roles con scope global ─────────────────────────────────────────────

  describe.each([
    ['SECRETARIA_ACADEMICA'],
    ['RECTORADO'],
    ['ADMINISTRADOR_SISTEMA'],
    ['ADMINISTRATIVO'],
  ])('Rol %s — scope global', (rol) => {
    it('tiene scope sobre cualquier Carrera (sin consultar la BD)', async () => {
      // Prisma no debe consultarse para roles globales
      const prisma = {
        usuarioCarrera:  { findUnique: jest.fn(), findMany: jest.fn() },
        usuarioFacultad: { findFirst: jest.fn() },
        carrera:         { findUnique: jest.fn(), findMany: jest.fn() },
      };
      const service = makeService(prisma);
      await expect(service.tieneScopeCarrera(USUARIO_ID, rol, CARRERA_A_ID))
        .resolves.toBe(true);
      expect(prisma.usuarioCarrera.findUnique).not.toHaveBeenCalled();
      expect(prisma.usuarioFacultad.findFirst).not.toHaveBeenCalled();
    });

    it('getCarrerasEnScope devuelve null (convenio: sin restricción)', async () => {
      const service = makeService({
        usuarioCarrera:  { findMany: jest.fn() },
        usuarioFacultad: { findFirst: jest.fn() },
        carrera:         { findMany: jest.fn() },
      });
      await expect(service.getCarrerasEnScope(USUARIO_ID, rol))
        .resolves.toBeNull();
    });
  });

  // ── 6. ADMINISTRATIVO — scope global NO es permiso global ────────────────

  describe('ADMINISTRATIVO — scope global no implica permiso de modificación', () => {
    it('tieneScopeCarrera devuelve true (scope global), pero esto no es un permiso', async () => {
      // El permiso de la operación concreta es responsabilidad del RBAC del controlador.
      // Este test verifica que el scope de ADMINISTRATIVO es global (retorna true),
      // pero documenta explícitamente que eso no es un permiso de edición.
      const service = makeService({
        usuarioCarrera:  { findUnique: jest.fn() },
        usuarioFacultad: { findFirst: jest.fn() },
        carrera:         { findUnique: jest.fn() },
      });
      const scope = await service.tieneScopeCarrera(USUARIO_ID, 'ADMINISTRATIVO', CARRERA_A_ID);
      expect(scope).toBe(true);
      // El permiso de edición (p.ej. PATCH /carreras/:id) lo decide el RolesGuard,
      // no este servicio. El scope global de ADMINISTRATIVO no lo convierte en editor.
    });
  });

  // ── 7. Rol DOCENTE con asociación accidental ─────────────────────────────

  describe('DOCENTE con asociación UsuarioCarrera residual', () => {
    it('NO obtiene scope de DIRECTOR_CARRERA — el rol determina el mecanismo', async () => {
      // Aunque hubiera una fila en UsuarioCarrera, con rol DOCENTE
      // el service retorna false porque el mecanismo DIRECTOR_CARRERA no aplica.
      const prisma = {
        usuarioCarrera:  { findUnique: jest.fn() },
        usuarioFacultad: { findFirst: jest.fn() },
        carrera:         { findUnique: jest.fn() },
      };
      const service = makeService(prisma);
      await expect(service.tieneScopeCarrera(USUARIO_ID, 'DOCENTE', CARRERA_A_ID))
        .resolves.toBe(false);
      // Para DOCENTE no se consulta UsuarioCarrera
      expect(prisma.usuarioCarrera.findUnique).not.toHaveBeenCalled();
    });
  });

  // ── 8. Asociación residual tras cambio de rol ─────────────────────────────

  describe('Asociación residual no concede scope tras cambio de rol', () => {
    it('ex-DIRECTOR_CARRERA con rol DOCENTE no obtiene scope sobre Carrera A', async () => {
      // Simula: había una fila UsuarioCarrera (ex-DIRECTOR) pero el rol ahora es DOCENTE
      const prisma = {
        usuarioCarrera:  { findUnique: jest.fn().mockResolvedValue({ id: 'uc-residual' }) },
        usuarioFacultad: { findFirst: jest.fn() },
        carrera:         { findUnique: jest.fn() },
      };
      const service = makeService(prisma);
      // Con rol DOCENTE el mecanismo DIRECTOR_CARRERA no se activa → false
      await expect(service.tieneScopeCarrera(USUARIO_ID, 'DOCENTE', CARRERA_A_ID))
        .resolves.toBe(false);
      expect(prisma.usuarioCarrera.findUnique).not.toHaveBeenCalled();
    });

    it('ex-DECANO con rol DOCENTE no obtiene scope sobre Carrera A', async () => {
      const prisma = {
        usuarioCarrera:  { findUnique: jest.fn() },
        usuarioFacultad: { findFirst: jest.fn().mockResolvedValue({ facultadId: FACULTAD_A_ID }) },
        carrera:         { findUnique: jest.fn().mockResolvedValue({ facultadId: FACULTAD_A_ID }) },
      };
      const service = makeService(prisma);
      await expect(service.tieneScopeCarrera(USUARIO_ID, 'DOCENTE', CARRERA_A_ID))
        .resolves.toBe(false);
      expect(prisma.usuarioFacultad.findFirst).not.toHaveBeenCalled();
    });
  });

  // ── 9. getCarrerasEnScope — DIRECTOR_CARRERA con una Carrera ─────────────

  describe('getCarrerasEnScope — DIRECTOR_CARRERA', () => {
    it('devuelve el array con la carreraId asociada', async () => {
      const service = makeService(makePrismaDirector(true));
      await expect(service.getCarrerasEnScope(USUARIO_ID, 'DIRECTOR_CARRERA'))
        .resolves.toEqual([CARRERA_A_ID]);
    });
  });

  // ── 10. getCarrerasEnScope — DECANO con Facultad A ───────────────────────

  describe('getCarrerasEnScope — DECANO con Facultad A', () => {
    it('devuelve el array de carreraIds de la Facultad A', async () => {
      const service = makeService(makePrismaDecano(true, FACULTAD_A_ID));
      await expect(service.getCarrerasEnScope(USUARIO_ID, 'DECANO'))
        .resolves.toEqual([CARRERA_A_ID]);
    });
  });

});
