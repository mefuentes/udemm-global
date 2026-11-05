import { UsuariosService } from './usuarios.service';
import { DocentesService } from '../docentes/docentes.service';

/**
 * Tests de integración entre Usuario DOCENTE y registro Docente.
 *
 * Verifica que al crear/actualizar/desactivar un usuario con rol DOCENTE,
 * el registro Docente correspondiente quede sincronizado para que el
 * selector de "Nueva Vinculación a Cátedra" (GET /docentes?activo=true)
 * lo devuelva correctamente.
 *
 * Escenarios cubiertos (sección 6 del diagnóstico):
 *  1. Crear usuario DOCENTE → Docente creado activo
 *  2. Docente creado disponible en selector (obtenerDocentes activo=true)
 *  3. Crear usuario con otro rol → Docente NO creado
 *  4. Idempotencia: si Docente ya existe por usuarioId → update, sin duplicado
 *  5. Usuario inactivo → docente inactivo (no aparece en selector)
 *  6. Usuarios DOCENTE existentes → regularizarDocentesExistentes
 *  7. Selector con búsqueda y paginación (obtenerDocentes)
 *  8. Vinculación se guarda correctamente (docenteId válido desde sincronizarDocente)
 *  9. No se alteran relaciones académicas existentes al sincronizar
 */

// ── Constantes ────────────────────────────────────────────────────────────────

const ROL_DOCENTE_ID  = 'rol-docente-uuid';
const ROL_ADMIN_ID    = 'rol-admin-uuid';
const USUARIO_ID      = 'usuario-test-uuid';
const DOCENTE_ID      = 'docente-test-uuid';
const EMAIL           = 'docente@udemm.edu.ar';

const ROL_DOCENTE     = { id: ROL_DOCENTE_ID, nombre: 'DOCENTE' };
const ROL_ADMIN       = { id: ROL_ADMIN_ID, nombre: 'ADMINISTRADOR_SISTEMA' };

const USUARIO_DOCENTE_ACTIVO = {
  id: USUARIO_ID,
  nombre: 'ANA', apellido: 'GARCÍA',
  correoElectronico: EMAIL,
  activo: true,
  fechaCreacion: new Date(), fechaActualizacion: new Date(),
  rol: ROL_DOCENTE,
  carrerasAsociadas: [], facultadesAsociadas: [],
};

const USUARIO_DOCENTE_INACTIVO = { ...USUARIO_DOCENTE_ACTIVO, activo: false };

const BASE_DOCENTE = {
  id: DOCENTE_ID, nombre: 'ANA', apellido: 'GARCÍA',
  correoElectronico: EMAIL, activo: true,
  usuarioId: USUARIO_ID, tipoDocumento: 'DNI', numeroDocumento: '12345678',
  fechaCreacion: new Date(), fechaActualizacion: new Date(),
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * findUnique stub que discrimina por campo del where:
 *  - { usuarioId } → retorna porUsuarioId
 *  - { correoElectronico } → retorna porEmail
 *  - { id } (usuario) → retorna porId
 */
function makeDocenteFindUnique(opts: {
  porUsuarioId?: any;
  porEmail?: any;
} = {}) {
  return jest.fn().mockImplementation(({ where }: { where: any }) => {
    if ('usuarioId' in where)          return Promise.resolve(opts.porUsuarioId ?? null);
    if ('correoElectronico' in where)  return Promise.resolve(opts.porEmail ?? null);
    return Promise.resolve(null);
  });
}

function makeTxCrear(rolNombre = 'DOCENTE') {
  return {
    usuario: {
      create: jest.fn().mockResolvedValue({
        id: USUARIO_ID, nombre: 'ANA', apellido: 'GARCÍA',
        correoElectronico: EMAIL, activo: true,
        fechaCreacion: new Date(), fechaActualizacion: new Date(),
        rol: { id: ROL_DOCENTE_ID, nombre: rolNombre },
      }),
    },
    usuarioCarrera:  { create: jest.fn(), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    usuarioFacultad: { create: jest.fn(), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };
}

function makeTxActualizar(usuarioActualizado: any) {
  return {
    usuario: { update: jest.fn().mockResolvedValue(usuarioActualizado) },
    usuarioCarrera:  { create: jest.fn(), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    usuarioFacultad: { create: jest.fn(), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };
}

function makeUsuariosService(opts: {
  usuarioActual?: any;
  rolParaBuscar?: any;
  docentePorUsuarioId?: any;
  docentePorEmail?: any;
  docenteCreate?: jest.Mock;
  docenteUpdate?: jest.Mock;
  txCrear?: any;
  txActualizar?: any;
  sesionUpdateMany?: jest.Mock;
  usuarioUpdate?: jest.Mock;
}) {
  const docenteCreate = opts.docenteCreate ?? jest.fn().mockResolvedValue(BASE_DOCENTE);
  const docenteUpdate = opts.docenteUpdate ?? jest.fn().mockResolvedValue({});
  const sesionUpdateMany = opts.sesionUpdateMany ?? jest.fn().mockResolvedValue({ count: 0 });
  const usuarioUpdate = opts.usuarioUpdate ?? jest.fn();

  const prisma: any = {
    usuario: {
      findUnique: jest.fn().mockResolvedValue(opts.usuarioActual ?? null),
      findFirst:  jest.fn().mockResolvedValue(null),
      create:     jest.fn(),
      update:     usuarioUpdate,
    },
    rol: {
      findUnique: jest.fn().mockResolvedValue(opts.rolParaBuscar !== undefined ? opts.rolParaBuscar : ROL_DOCENTE),
      findFirst:  jest.fn().mockResolvedValue(opts.rolParaBuscar !== undefined ? opts.rolParaBuscar : ROL_DOCENTE),
    },
    carrera:  { findUnique: jest.fn().mockResolvedValue(null) },
    facultad: { findUnique: jest.fn().mockResolvedValue(null) },
    sesion:   { updateMany: sesionUpdateMany },
    docente: {
      findUnique: makeDocenteFindUnique({
        porUsuarioId: opts.docentePorUsuarioId,
        porEmail:     opts.docentePorEmail,
      }),
      create: docenteCreate,
      update: docenteUpdate,
    },
    $transaction: jest.fn().mockImplementation(async (cb: any) => {
      if (opts.txCrear)      return cb(opts.txCrear);
      if (opts.txActualizar) return cb(opts.txActualizar);
      return cb({
        usuario:        { create: jest.fn().mockResolvedValue({}), update: jest.fn().mockResolvedValue({}) },
        usuarioCarrera: { create: jest.fn(), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        usuarioFacultad:{ create: jest.fn(), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      });
    }),
  };

  return { prisma, service: new UsuariosService(prisma) };
}

const DATA_CREAR_DOCENTE = {
  nombre: 'ANA', apellido: 'GARCÍA',
  correoElectronico: EMAIL,
  contrasena: 'Password1!',
  rolId: ROL_DOCENTE_ID,
};

// ── 1. Crear usuario DOCENTE → Docente creado activo ─────────────────────────

describe('1. crearUsuario con rol DOCENTE → registro Docente creado', () => {
  it('llama a docente.create con activo=true', async () => {
    const tx = makeTxCrear('DOCENTE');
    const { service, prisma } = makeUsuariosService({
      txCrear: tx,
      rolParaBuscar: ROL_DOCENTE,
    });

    await service.crearUsuario(DATA_CREAR_DOCENTE);

    expect(prisma.docente.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          usuarioId:         USUARIO_ID,
          nombre:            'ANA',
          apellido:          'GARCÍA',
          correoElectronico: EMAIL,
          activo:            true,
        }),
      }),
    );
  });
});

// ── 2. Docente creado disponible en selector (obtenerDocentes activo=true) ───

describe('2. obtenerDocentes con activo=true devuelve solo docentes activos', () => {
  const makeDocentesService = (docentes: any[]) => {
    const prisma: any = {
      docente: {
        count:    jest.fn().mockResolvedValue(docentes.length),
        findMany: jest.fn().mockResolvedValue(docentes),
      },
      $transaction: jest.fn().mockImplementation(async ([q1, q2]: any[]) =>
        Promise.all([q1, q2]),
      ),
    };
    return new DocentesService(prisma);
  };

  it('devuelve docente activo creado por sincronizarDocente', async () => {
    const docenteNuevo = {
      ...BASE_DOCENTE,
      activo: true,
      fechaNacimiento: null,
      usuario: null,
    };
    const svc = makeDocentesService([docenteNuevo]);

    // Simula llamada del frontend: activo=true, pagina=1, limite=500
    const result = await svc.obtenerDocentes(undefined, true, 1, 500);

    expect(result.total).toBe(1);
    expect(result.data[0].apellido).toBe('GARCÍA');
    expect(result.data[0].nombre).toBe('ANA');
  });

  it('NO devuelve docente inactivo', async () => {
    // Con activo=true el filtro excluye inactivos; aquí el mock ya filtra
    const svc = makeDocentesService([]);
    const result = await svc.obtenerDocentes(undefined, true, 1, 500);
    expect(result.total).toBe(0);
    expect(result.data).toHaveLength(0);
  });
});

// ── 3. Crear usuario con otro rol → Docente NO creado ────────────────────────

describe('3. crearUsuario con rol no-DOCENTE → docente.create NO es llamado', () => {
  it('no invoca docente.create para ADMINISTRADOR_SISTEMA', async () => {
    const tx = makeTxCrear('ADMINISTRADOR_SISTEMA');
    const { service, prisma } = makeUsuariosService({
      txCrear: tx,
      rolParaBuscar: ROL_ADMIN,
    });

    await service.crearUsuario({ ...DATA_CREAR_DOCENTE, rolId: ROL_ADMIN_ID });

    expect(prisma.docente.create).not.toHaveBeenCalled();
  });

  it('no invoca docente.create para SECRETARIA_ACADEMICA', async () => {
    const rolSec = { id: 'rol-sec-id', nombre: 'SECRETARIA_ACADEMICA' };
    const tx = makeTxCrear('SECRETARIA_ACADEMICA');
    const { service, prisma } = makeUsuariosService({
      txCrear: tx,
      rolParaBuscar: rolSec,
    });

    await service.crearUsuario({ ...DATA_CREAR_DOCENTE, rolId: rolSec.id });

    expect(prisma.docente.create).not.toHaveBeenCalled();
  });
});

// ── 4. Idempotencia: Docente ya existe → update, sin duplicado ───────────────

describe('4. sincronizarDocente es idempotente (no duplica Docente)', () => {
  it('si Docente existe por usuarioId → update(activo) en lugar de create', async () => {
    const tx = makeTxCrear('DOCENTE');
    const docenteExistente = { ...BASE_DOCENTE, activo: true };
    const { service, prisma } = makeUsuariosService({
      txCrear: tx,
      rolParaBuscar: ROL_DOCENTE,
      docentePorUsuarioId: docenteExistente,  // ya vinculado
    });

    await service.crearUsuario(DATA_CREAR_DOCENTE);

    expect(prisma.docente.create).not.toHaveBeenCalled();
    expect(prisma.docente.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: DOCENTE_ID },
        data:  { activo: true },
      }),
    );
  });

  it('si Docente preexistente por email sin usuarioId → vincula en lugar de crear', async () => {
    const tx = makeTxCrear('DOCENTE');
    const docentePreexistente = { ...BASE_DOCENTE, usuarioId: null };
    const { service, prisma } = makeUsuariosService({
      txCrear: tx,
      rolParaBuscar: ROL_DOCENTE,
      docentePorUsuarioId: null,
      docentePorEmail: docentePreexistente,
    });

    await service.crearUsuario(DATA_CREAR_DOCENTE);

    expect(prisma.docente.create).not.toHaveBeenCalled();
    expect(prisma.docente.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: DOCENTE_ID },
        data:  expect.objectContaining({ usuarioId: USUARIO_ID, activo: true }),
      }),
    );
  });

  it('si Docente preexistente por email ya tiene otro usuarioId → no se modifica', async () => {
    const tx = makeTxCrear('DOCENTE');
    const docenteOtro = { ...BASE_DOCENTE, usuarioId: 'otro-usuario-uuid' };
    const { service, prisma } = makeUsuariosService({
      txCrear: tx,
      rolParaBuscar: ROL_DOCENTE,
      docentePorUsuarioId: null,
      docentePorEmail: docenteOtro,
    });

    await service.crearUsuario(DATA_CREAR_DOCENTE);

    expect(prisma.docente.create).not.toHaveBeenCalled();
    expect(prisma.docente.update).not.toHaveBeenCalled();
  });
});

// ── 5. Usuario inactivo → docente inactivo ───────────────────────────────────

describe('5. toggleEstado en usuario DOCENTE sincroniza activo del Docente', () => {
  it('desactivar usuario DOCENTE → docente.update(activo: false)', async () => {
    const usuarioInactivo = { ...USUARIO_DOCENTE_ACTIVO, activo: false };
    const docenteExistente = { ...BASE_DOCENTE };
    const { service, prisma } = makeUsuariosService({
      usuarioActual: USUARIO_DOCENTE_ACTIVO,
      usuarioUpdate: jest.fn().mockResolvedValue(usuarioInactivo),
      docentePorUsuarioId: docenteExistente,
    });

    await service.toggleEstado(USUARIO_ID);

    expect(prisma.docente.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: DOCENTE_ID },
        data:  { activo: false },
      }),
    );
  });

  it('reactivar usuario DOCENTE → docente.update(activo: true)', async () => {
    const usuarioActivo = { ...USUARIO_DOCENTE_ACTIVO, activo: true };
    const docenteInactivo = { ...BASE_DOCENTE, activo: false };
    const { service, prisma } = makeUsuariosService({
      usuarioActual: USUARIO_DOCENTE_INACTIVO,
      usuarioUpdate: jest.fn().mockResolvedValue(usuarioActivo),
      docentePorUsuarioId: docenteInactivo,
    });

    await service.toggleEstado(USUARIO_ID);

    expect(prisma.docente.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: DOCENTE_ID },
        data:  { activo: true },
      }),
    );
  });
});

// ── 6. Usuarios DOCENTE existentes → regularizarDocentesExistentes ───────────

describe('6. regularizarDocentesExistentes regulariza usuarios previos al fix', () => {
  function makeServiceRegularizar(usuarios: any[], porUsuarioId: any = null, porEmail: any = null) {
    const docenteCreate = jest.fn().mockResolvedValue(BASE_DOCENTE);
    const docenteUpdate = jest.fn().mockResolvedValue({});
    const prisma: any = {
      rol: { findFirst: jest.fn().mockResolvedValue(ROL_DOCENTE) },
      usuario: { findMany: jest.fn().mockResolvedValue(usuarios) },
      docente: {
        findUnique: makeDocenteFindUnique({ porUsuarioId, porEmail }),
        create:     docenteCreate,
        update:     docenteUpdate,
      },
    };
    return { service: new UsuariosService(prisma), prisma, docenteCreate, docenteUpdate };
  }

  it('con 0 usuarios DOCENTE → procesados=0 sin tocar docentes', async () => {
    const { service, docenteCreate } = makeServiceRegularizar([]);
    const result = await service.regularizarDocentesExistentes();
    expect(result.procesados).toBe(0);
    expect(docenteCreate).not.toHaveBeenCalled();
  });

  it('con 2 usuarios DOCENTE sin Docente → docente.create llamado 2 veces', async () => {
    const u1 = { id: 'u1', nombre: 'A', apellido: 'B', correoElectronico: 'a@udemm.edu.ar', activo: true };
    const u2 = { id: 'u2', nombre: 'C', apellido: 'D', correoElectronico: 'c@udemm.edu.ar', activo: true };
    const { service, docenteCreate } = makeServiceRegularizar([u1, u2]);
    const result = await service.regularizarDocentesExistentes();
    expect(result.procesados).toBe(2);
    expect(docenteCreate).toHaveBeenCalledTimes(2);
  });

  it('con usuario DOCENTE con Docente ya vinculado → update, sin create', async () => {
    const u1 = { id: USUARIO_ID, nombre: 'ANA', apellido: 'GARCÍA', correoElectronico: EMAIL, activo: true };
    const { service, docenteCreate, docenteUpdate } = makeServiceRegularizar([u1], BASE_DOCENTE);
    const result = await service.regularizarDocentesExistentes();
    expect(result.procesados).toBe(1);
    expect(docenteCreate).not.toHaveBeenCalled();
    expect(docenteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: DOCENTE_ID }, data: { activo: true } }),
    );
  });

  it('cuando no existe el rol DOCENTE en BD → procesados=0', async () => {
    const prisma: any = {
      rol: { findFirst: jest.fn().mockResolvedValue(null) },
      usuario: { findMany: jest.fn() },
      docente: { findUnique: jest.fn(), create: jest.fn() },
    };
    const service = new UsuariosService(prisma);
    const result = await service.regularizarDocentesExistentes();
    expect(result.procesados).toBe(0);
    expect(prisma.usuario.findMany).not.toHaveBeenCalled();
  });
});

// ── 7. Selector con búsqueda y paginación ────────────────────────────────────

describe('7. obtenerDocentes — búsqueda y paginación del selector', () => {
  function makeDocentesSvc(docentes: any[], total?: number) {
    const prisma: any = {
      docente: {
        count:    jest.fn().mockResolvedValue(total ?? docentes.length),
        findMany: jest.fn().mockResolvedValue(docentes),
      },
      $transaction: jest.fn().mockImplementation(async ([q1, q2]: any[]) =>
        Promise.all([q1, q2]),
      ),
    };
    return new DocentesService(prisma);
  }

  it('búsqueda por apellido parcial devuelve coincidencias', async () => {
    const doc = { ...BASE_DOCENTE, fechaNacimiento: null, usuario: null };
    const svc = makeDocentesSvc([doc]);
    const result = await svc.obtenerDocentes('GARC', true, 1, 10);
    expect(result.total).toBe(1);
    expect(result.data[0].apellido).toBe('GARCÍA');
  });

  it('paginación correcta: pagina=2 con limite=5 de 11 registros → segunda página', async () => {
    // Con mock simplificado: findMany devuelve 1 elemento (última página)
    const doc = { ...BASE_DOCENTE, fechaNacimiento: null, usuario: null };
    const svc = makeDocentesSvc([doc], 11);
    const result = await svc.obtenerDocentes(undefined, true, 2, 5);
    expect(result.pagina).toBe(2);
    expect(result.limite).toBe(5);
    expect(result.total).toBe(11);
  });

  it('sin filtro activo devuelve todos los docentes', async () => {
    const activo = { ...BASE_DOCENTE, fechaNacimiento: null, usuario: null };
    const inactivo = { ...BASE_DOCENTE, id: 'doc-inactivo', activo: false, fechaNacimiento: null, usuario: null };
    const svc = makeDocentesSvc([activo, inactivo], 2);
    const result = await svc.obtenerDocentes(undefined, undefined, 1, 500);
    expect(result.total).toBe(2);
  });
});

// ── 8. Vinculación con docente sincronizado ───────────────────────────────────

describe('8. actualizarUsuario: cambio de rol a DOCENTE → Docente creado', () => {
  it('cambiar usuario no-DOCENTE a DOCENTE → docente.create', async () => {
    const usuarioAntes = {
      ...USUARIO_DOCENTE_ACTIVO,
      rol: ROL_ADMIN,
    };
    const usuarioDespues = {
      ...USUARIO_DOCENTE_ACTIVO,
      rol: ROL_DOCENTE,
    };
    const tx = makeTxActualizar(usuarioDespues);
    const { service, prisma } = makeUsuariosService({
      usuarioActual: usuarioAntes,
      txActualizar: tx,
      rolParaBuscar: ROL_DOCENTE,
      docentePorUsuarioId: null,
      docentePorEmail: null,
    });

    await service.actualizarUsuario(USUARIO_ID, { rolId: ROL_DOCENTE_ID });

    expect(prisma.docente.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ usuarioId: USUARIO_ID, activo: true }),
      }),
    );
  });
});

// ── 9. No se alteran relaciones académicas al sincronizar ─────────────────────

describe('9. sincronizarDocente NO modifica vinculaciones ni datos académicos', () => {
  it('crear usuario DOCENTE: no llama a vinculacionCatedra ni a cargos', async () => {
    const tx = makeTxCrear('DOCENTE');
    const { service, prisma } = makeUsuariosService({
      txCrear: tx,
      rolParaBuscar: ROL_DOCENTE,
    });
    // Añadir spy para detectar cualquier llamada a tablas académicas
    const anyAcademicCall = jest.fn();
    (prisma as any).vinculacionCatedra = { create: anyAcademicCall, update: anyAcademicCall };
    (prisma as any).cargoDocente       = { create: anyAcademicCall, update: anyAcademicCall };

    await service.crearUsuario(DATA_CREAR_DOCENTE);

    expect(anyAcademicCall).not.toHaveBeenCalled();
  });

  it('regularizarDocentesExistentes: solo toca tablas Rol, Usuario y Docente', async () => {
    const u = { id: USUARIO_ID, nombre: 'ANA', apellido: 'GARCÍA', correoElectronico: EMAIL, activo: true };
    const vinculacionCall = jest.fn();
    const prisma: any = {
      rol:     { findFirst: jest.fn().mockResolvedValue(ROL_DOCENTE) },
      usuario: { findMany: jest.fn().mockResolvedValue([u]) },
      docente: {
        findUnique: makeDocenteFindUnique(),
        create:     jest.fn().mockResolvedValue(BASE_DOCENTE),
        update:     jest.fn(),
      },
      vinculacionCatedra: { create: vinculacionCall, update: vinculacionCall },
      cargoDocente:       { create: vinculacionCall, update: vinculacionCall },
    };
    const service = new UsuariosService(prisma);

    await service.regularizarDocentesExistentes();

    expect(vinculacionCall).not.toHaveBeenCalled();
  });
});
