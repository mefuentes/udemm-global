import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';

/**
 * Tests de integración de scopes institucionales en UsuariosService — FASE 2
 *
 * Cubre la configuración de asociaciones desde Gestión de Usuarios:
 *   - Creación con carreraId / facultadId
 *   - Actualización con cambio de rol y/o de asociación
 *   - Validaciones de integridad (rol requiere asociación, asociación debe existir)
 *
 * SCOPE != PERMISO: estos tests verifican exclusivamente la gestión de scopes;
 * los permisos RBAC son responsabilidad del controlador y RolesGuard.
 */

const USUARIO_ID  = 'usuario-test-uuid';
const ROL_DC_ID   = 'rol-director-carrera-uuid';
const ROL_DEC_ID  = 'rol-decano-uuid';
const ROL_ADM_ID  = 'rol-admin-uuid';
const CARRERA_ID  = 'carrera-test-uuid';
const CARRERA2_ID = 'carrera2-test-uuid';
const FACULTAD_ID = 'facultad-test-uuid';

const ROL_DC  = { id: ROL_DC_ID,  nombre: 'DIRECTOR_CARRERA' };
const ROL_DEC = { id: ROL_DEC_ID, nombre: 'DECANO' };
const ROL_ADM = { id: ROL_ADM_ID, nombre: 'ADMINISTRADOR_SISTEMA' };

// Usuario base que devuelve obtenerUsuarioPorId (SELECT_USUARIO_CON_SCOPE)
function makeUsuarioActual(rolNombre: string, rolId: string) {
  return {
    id:                USUARIO_ID,
    nombre:            'Test',
    apellido:          'Usuario',
    correoElectronico: 'test@test.com',
    activo:            true,
    fechaCreacion:     new Date(),
    fechaActualizacion: new Date(),
    rol:               { id: rolId, nombre: rolNombre },
    carrerasAsociadas: [],
    facultadesAsociadas: [],
  };
}

// Usuario creado dentro de la transacción (SELECT_USUARIO, sin scope)
const USUARIO_CREADO = {
  id:                USUARIO_ID,
  nombre:            'Test',
  apellido:          'Usuario',
  correoElectronico: 'test@test.com',
  activo:            true,
  fechaCreacion:     new Date(),
  fechaActualizacion: new Date(),
  rol:               { id: ROL_DC_ID, nombre: 'DIRECTOR_CARRERA' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTx(opts?: { updateReturn?: any }) {
  return {
    usuario:        { create: jest.fn().mockResolvedValue(USUARIO_CREADO), update: jest.fn().mockResolvedValue(opts?.updateReturn ?? USUARIO_CREADO) },
    usuarioCarrera: { create: jest.fn().mockResolvedValue({}), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    usuarioFacultad:{ create: jest.fn().mockResolvedValue({}), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };
}

function makePrismaCrear(opts: {
  emailExiste?: boolean;
  rol?: { nombre: string } | null;
  carreraExiste?: boolean;
  facultadExiste?: boolean;
  tx?: ReturnType<typeof makeTx>;
}) {
  const tx = opts.tx ?? makeTx();
  return {
    tx,
    prisma: {
      usuario: {
        findUnique:  jest.fn().mockResolvedValue(opts.emailExiste ? { id: 'otro' } : null),
        findFirst:   jest.fn().mockResolvedValue(null),
      },
      rol:     { findUnique: jest.fn().mockResolvedValue(opts.rol !== undefined ? opts.rol : { nombre: 'DOCENTE' }) },
      carrera: { findUnique: jest.fn().mockResolvedValue(opts.carreraExiste !== false ? { id: CARRERA_ID } : null) },
      facultad:{ findUnique: jest.fn().mockResolvedValue(opts.facultadExiste !== false ? { id: FACULTAD_ID } : null) },
      docente: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    },
  };
}

function makePrismaActualizar(opts: {
  usuarioActual: ReturnType<typeof makeUsuarioActual>;
  rolNuevo?: { nombre: string } | null;
  carreraExiste?: boolean;
  facultadExiste?: boolean;
  emailExiste?: boolean;
  updateReturn?: any;
}) {
  const tx = makeTx({ updateReturn: opts.updateReturn ?? opts.usuarioActual });
  return {
    tx,
    prisma: {
      usuario: {
        findUnique: jest.fn().mockResolvedValue(opts.usuarioActual),
        findFirst:  jest.fn().mockResolvedValue(opts.emailExiste ? { id: 'otro' } : null),
      },
      rol:     { findUnique: jest.fn().mockResolvedValue(opts.rolNuevo !== undefined ? opts.rolNuevo : null) },
      carrera: { findUnique: jest.fn().mockResolvedValue(opts.carreraExiste !== false ? { id: CARRERA_ID } : null) },
      facultad:{ findUnique: jest.fn().mockResolvedValue(opts.facultadExiste !== false ? { id: FACULTAD_ID } : null) },
      docente: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    },
  };
}

const makeService = (prisma: any) => new UsuariosService(prisma as any);

const DATA_CREAR_BASE = {
  nombre: 'Juan', apellido: 'Pérez',
  correoElectronico: 'juan@test.com',
  contrasena: 'Contrasena1!',
  rolId: ROL_DC_ID,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('UsuariosService — scopes institucionales (FASE 2)', () => {

  // ── 1. crearUsuario: DIRECTOR_CARRERA con carreraId ────────────────────────

  describe('crearUsuario — DIRECTOR_CARRERA con carreraId válido', () => {
    it('crea usuario y UsuarioCarrera en la misma transacción', async () => {
      const { prisma, tx } = makePrismaCrear({ rol: ROL_DC, carreraExiste: true });
      const service = makeService(prisma);

      await service.crearUsuario({ ...DATA_CREAR_BASE, rolId: ROL_DC_ID, carreraId: CARRERA_ID });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.usuario.create).toHaveBeenCalledTimes(1);
      expect(tx.usuarioCarrera.create).toHaveBeenCalledWith({
        data: { usuarioId: USUARIO_ID, carreraId: CARRERA_ID },
      });
      expect(tx.usuarioFacultad.create).not.toHaveBeenCalled();
    });
  });

  // ── 2. crearUsuario: DIRECTOR_CARRERA sin carreraId ───────────────────────

  describe('crearUsuario — DIRECTOR_CARRERA sin carreraId', () => {
    it('lanza BadRequestException', async () => {
      const { prisma } = makePrismaCrear({ rol: ROL_DC });
      const service = makeService(prisma);

      await expect(service.crearUsuario({ ...DATA_CREAR_BASE, rolId: ROL_DC_ID }))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ── 3. crearUsuario: DECANO con facultadId ────────────────────────────────

  describe('crearUsuario — DECANO con facultadId válido', () => {
    it('crea usuario y UsuarioFacultad en la misma transacción', async () => {
      const tx = makeTx({ updateReturn: { ...USUARIO_CREADO, rol: { id: ROL_DEC_ID, nombre: 'DECANO' } } });
      const { prisma } = makePrismaCrear({ rol: ROL_DEC, facultadExiste: true, tx });
      const service = makeService(prisma);

      await service.crearUsuario({ ...DATA_CREAR_BASE, rolId: ROL_DEC_ID, facultadId: FACULTAD_ID });

      expect(tx.usuarioFacultad.create).toHaveBeenCalledWith({
        data: { usuarioId: USUARIO_ID, facultadId: FACULTAD_ID },
      });
      expect(tx.usuarioCarrera.create).not.toHaveBeenCalled();
    });
  });

  // ── 4. crearUsuario: DECANO sin facultadId ────────────────────────────────

  describe('crearUsuario — DECANO sin facultadId', () => {
    it('lanza BadRequestException', async () => {
      const { prisma } = makePrismaCrear({ rol: ROL_DEC });
      const service = makeService(prisma);

      await expect(service.crearUsuario({ ...DATA_CREAR_BASE, rolId: ROL_DEC_ID }))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ── 5. crearUsuario: otro rol con carreraId (se ignora) ───────────────────

  describe('crearUsuario — ADMINISTRADOR_SISTEMA con carreraId (campo irrelevante)', () => {
    it('no crea UsuarioCarrera para roles sin scope territorial', async () => {
      const tx = makeTx({ updateReturn: { ...USUARIO_CREADO, rol: ROL_ADM } });
      const { prisma } = makePrismaCrear({ rol: ROL_ADM, tx });
      const service = makeService(prisma);

      await service.crearUsuario({ ...DATA_CREAR_BASE, rolId: ROL_ADM_ID, carreraId: CARRERA_ID });

      expect(tx.usuarioCarrera.create).not.toHaveBeenCalled();
      expect(tx.usuarioFacultad.create).not.toHaveBeenCalled();
    });
  });

  // ── 6. actualizarUsuario: cambiar rol a DIRECTOR_CARRERA con carreraId ────

  describe('actualizarUsuario — cambiar rol a DIRECTOR_CARRERA con carreraId', () => {
    it('elimina UsuarioFacultad y crea UsuarioCarrera en la transacción', async () => {
      const usuarioActual = makeUsuarioActual('SECRETARIA_ACADEMICA', 'rol-sec-id');
      const { prisma, tx } = makePrismaActualizar({
        usuarioActual,
        rolNuevo: ROL_DC,
        carreraExiste: true,
        updateReturn: { ...USUARIO_CREADO, rol: ROL_DC },
      });
      const service = makeService(prisma);

      await service.actualizarUsuario(USUARIO_ID, { rolId: ROL_DC_ID, carreraId: CARRERA_ID });

      expect(tx.usuarioFacultad.deleteMany).toHaveBeenCalledWith({ where: { usuarioId: USUARIO_ID } });
      expect(tx.usuarioCarrera.create).toHaveBeenCalledWith({
        data: { usuarioId: USUARIO_ID, carreraId: CARRERA_ID },
      });
    });
  });

  // ── 7. actualizarUsuario: cambiar rol a DIRECTOR_CARRERA sin carreraId ────

  describe('actualizarUsuario — cambiar rol a DIRECTOR_CARRERA sin carreraId', () => {
    it('lanza BadRequestException antes de modificar nada', async () => {
      const usuarioActual = makeUsuarioActual('SECRETARIA_ACADEMICA', 'rol-sec-id');
      const { prisma } = makePrismaActualizar({ usuarioActual, rolNuevo: ROL_DC });
      const service = makeService(prisma);

      await expect(service.actualizarUsuario(USUARIO_ID, { rolId: ROL_DC_ID }))
        .rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ── 8. actualizarUsuario: cambiar rol a DECANO con facultadId ─────────────

  describe('actualizarUsuario — cambiar rol a DECANO con facultadId', () => {
    it('elimina UsuarioCarrera y crea UsuarioFacultad en la transacción', async () => {
      const usuarioActual = makeUsuarioActual('DIRECTOR_CARRERA', ROL_DC_ID);
      const { prisma, tx } = makePrismaActualizar({
        usuarioActual,
        rolNuevo: ROL_DEC,
        facultadExiste: true,
        updateReturn: { ...USUARIO_CREADO, rol: ROL_DEC },
      });
      const service = makeService(prisma);

      await service.actualizarUsuario(USUARIO_ID, { rolId: ROL_DEC_ID, facultadId: FACULTAD_ID });

      expect(tx.usuarioCarrera.deleteMany).toHaveBeenCalledWith({ where: { usuarioId: USUARIO_ID } });
      expect(tx.usuarioFacultad.create).toHaveBeenCalledWith({
        data: { usuarioId: USUARIO_ID, facultadId: FACULTAD_ID },
      });
    });
  });

  // ── 9. actualizarUsuario: DIRECTOR_CARRERA cambia Carrera (mismo rol) ─────

  describe('actualizarUsuario — DIRECTOR_CARRERA cambia carreraId (mismo rol)', () => {
    it('reemplaza la asociación: deleteMany + create con nueva carreraId', async () => {
      const usuarioActual = makeUsuarioActual('DIRECTOR_CARRERA', ROL_DC_ID);
      const { prisma, tx } = makePrismaActualizar({
        usuarioActual,
        carreraExiste: true,
        updateReturn: USUARIO_CREADO,
      });
      const service = makeService(prisma);

      await service.actualizarUsuario(USUARIO_ID, { carreraId: CARRERA2_ID });

      expect(tx.usuarioCarrera.create).toHaveBeenCalledWith({
        data: { usuarioId: USUARIO_ID, carreraId: CARRERA2_ID },
      });
    });
  });

  // ── 10. actualizarUsuario: DIRECTOR_CARRERA → otro rol, elimina asociación ─

  describe('actualizarUsuario — DIRECTOR_CARRERA cambia a otro rol', () => {
    it('elimina UsuarioCarrera dentro de la transacción', async () => {
      const usuarioActual = makeUsuarioActual('DIRECTOR_CARRERA', ROL_DC_ID);
      const { prisma, tx } = makePrismaActualizar({
        usuarioActual,
        rolNuevo: ROL_ADM,
        updateReturn: { ...USUARIO_CREADO, rol: ROL_ADM },
      });
      const service = makeService(prisma);

      await service.actualizarUsuario(USUARIO_ID, { rolId: ROL_ADM_ID });

      expect(tx.usuarioCarrera.deleteMany).toHaveBeenCalledWith({ where: { usuarioId: USUARIO_ID } });
      expect(tx.usuarioCarrera.create).not.toHaveBeenCalled();
    });
  });

  // ── 11. crearUsuario: carreraId inexistente ───────────────────────────────

  describe('crearUsuario — carreraId no existe en la base de datos', () => {
    it('lanza NotFoundException', async () => {
      const { prisma } = makePrismaCrear({ rol: ROL_DC, carreraExiste: false });
      const service = makeService(prisma);

      await expect(service.crearUsuario({ ...DATA_CREAR_BASE, rolId: ROL_DC_ID, carreraId: 'uuid-inexistente' }))
        .rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ── 12. actualizarUsuario: facultadId inexistente ─────────────────────────

  describe('actualizarUsuario — facultadId no existe en la base de datos', () => {
    it('lanza NotFoundException antes de la transacción', async () => {
      const usuarioActual = makeUsuarioActual('DECANO', ROL_DEC_ID);
      const { prisma } = makePrismaActualizar({
        usuarioActual,
        facultadExiste: false,
      });
      const service = makeService(prisma);

      await expect(service.actualizarUsuario(USUARIO_ID, { facultadId: 'uuid-inexistente' }))
        .rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

});
