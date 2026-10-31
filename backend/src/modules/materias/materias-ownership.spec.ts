import { Reflector } from '@nestjs/core';
import { MateriasService } from './materias.service';
import { RolesGuard } from '../../common/guards/roles.guard';

// ── Constantes compartidas ────────────────────────────────────────────────────

const MATERIA_A_ID = 'materia-a-id';
const USUARIO_ID   = 'usuario-id';

const MATERIA_A = {
  id: MATERIA_A_ID, codigo: 'MAT001', nombre: 'Materia A',
  planEstudioId: 'plan-1', creditos: 3, estado: 'ACTIVO',
  anio: 1, cuatrimestre: 1, descripcion: null, bloqueConocimiento: null,
  cargaHorariaSemanal: 4, cargaHorariaTotal: 64, observaciones: null,
  regimenCursado: null, tipoAsignatura: 'OBLIGATORIA', modalidadDictado: null,
  fechaCreacion: new Date(), fechaActualizacion: new Date(),
};

const makePrisma = () => ({
  materia: {
    findUnique: jest.fn().mockResolvedValue(MATERIA_A),
    update: jest.fn().mockResolvedValue(MATERIA_A),
  },
  historialMateria: {
    create: jest.fn().mockResolvedValue({}),
  },
});

const makeService = (prisma: any) => new MateriasService(prisma as any);

// ── Helper: RolesGuard con contexto simulado ──────────────────────────────────

function makeGuardContext(rolNombre: string, requiredRoles: string[]) {
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles);
  const guard = new RolesGuard(reflector);
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ user: { rol: { nombre: rolNombre } } }),
    }),
    getHandler: () => null,
    getClass:   () => null,
  } as any;
  return { guard, context };
}

const ROLES_ACTUALIZAR_MATERIA = [
  'ADMINISTRADOR_SISTEMA',
  'SECRETARIA_ACADEMICA',
  'DIRECTOR_CARRERA',
  'ADMINISTRATIVO',
];

// ── Suite 1: Guard — DOCENTE bloqueado en PATCH /materias/:id ─────────────────

describe('Guard — DOCENTE bloqueado en PATCH materias/:id', () => {
  it('DOCENTE: RolesGuard retorna false → HTTP 403', () => {
    const { guard, context } = makeGuardContext('DOCENTE', ROLES_ACTUALIZAR_MATERIA);
    expect(guard.canActivate(context)).toBe(false);
  });

  it('DOCENTE con vinculación aprobada: guard sigue retornando false (ownership ya no exime)', () => {
    // El guard evalúa el rol, no las vinculaciones. DOCENTE no está en ROLES_ACTUALIZAR_MATERIA.
    const { guard, context } = makeGuardContext('DOCENTE', ROLES_ACTUALIZAR_MATERIA);
    expect(guard.canActivate(context)).toBe(false);
  });

  it('usuario sin rol (undefined): RolesGuard retorna false', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(ROLES_ACTUALIZAR_MATERIA);
    const guard = new RolesGuard(reflector);
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ user: null }) }),
      getHandler: () => null,
      getClass:   () => null,
    } as any;
    expect(guard.canActivate(context)).toBe(false);
  });
});

// ── Suite 2: Guard — roles autorizados pasan ──────────────────────────────────

describe('Guard — roles autorizados en PATCH materias/:id', () => {
  const rolesAutorizados = [
    'ADMINISTRADOR_SISTEMA',
    'SECRETARIA_ACADEMICA',
    'DIRECTOR_CARRERA',
    'ADMINISTRATIVO',
  ];

  for (const rol of rolesAutorizados) {
    it(`${rol}: RolesGuard retorna true`, () => {
      const { guard, context } = makeGuardContext(rol, ROLES_ACTUALIZAR_MATERIA);
      expect(guard.canActivate(context)).toBe(true);
    });
  }
});

// ── Suite 3: Guard — DOCENTE puede acceder a operaciones de lectura ───────────

describe('Guard — DOCENTE mantiene acceso de lectura (GET materias)', () => {
  const ROLES_VER = [
    'ADMINISTRADOR_SISTEMA', 'SECRETARIA_ACADEMICA', 'DIRECTOR_CARRERA',
    'ADMINISTRATIVO', 'DECANO', 'RECTORADO', 'DOCENTE',
  ];

  it('DOCENTE: RolesGuard retorna true para GET /materias', () => {
    const { guard, context } = makeGuardContext('DOCENTE', ROLES_VER);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('DOCENTE: RolesGuard retorna true para GET /materias/:id', () => {
    const { guard, context } = makeGuardContext('DOCENTE', ROLES_VER);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('DOCENTE: RolesGuard retorna true para GET /materias/:id/correlativas', () => {
    const { guard, context } = makeGuardContext('DOCENTE', ROLES_VER);
    expect(guard.canActivate(context)).toBe(true);
  });
});

// ── Suite 4: Service.actualizar — funciona sin parámetro de rol ───────────────

describe('MateriasService.actualizar — roles institucionales sin ownership', () => {
  it('actualizar no recibe rolNombre — llama materia.update correctamente', async () => {
    const prisma = makePrisma();
    const result = await makeService(prisma).actualizar(MATERIA_A_ID, { nombre: 'Nuevo nombre' }, USUARIO_ID);
    expect(result).toBeDefined();
    expect(prisma.materia.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: MATERIA_A_ID } })
    );
  });

  it('no consulta tabla docente ni vinculacionCatedra (ownership eliminado)', async () => {
    const prisma = {
      ...makePrisma(),
      docente:           { findUnique: jest.fn() },
      vinculacionCatedra: { findFirst: jest.fn() },
    };
    await makeService(prisma).actualizar(MATERIA_A_ID, {}, USUARIO_ID);
    expect(prisma.docente.findUnique).not.toHaveBeenCalled();
    expect(prisma.vinculacionCatedra.findFirst).not.toHaveBeenCalled();
  });

  it('registra historial de ACTUALIZACION', async () => {
    const prisma = makePrisma();
    await makeService(prisma).actualizar(MATERIA_A_ID, { nombre: 'Nombre actualizado' }, USUARIO_ID);
    expect(prisma.historialMateria.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ accion: 'ACTUALIZACION', materiaId: MATERIA_A_ID })
      })
    );
  });
});
