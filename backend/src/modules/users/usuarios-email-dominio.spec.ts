import { BadRequestException } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';

/**
 * Tests de validación de dominio institucional en UsuariosService.
 *
 * Solo se aceptan correos @udemm.edu.ar y @docentes.udemm.edu.ar.
 * El servicio valida como defensa en profundidad (la primera línea es el DTO).
 */

const ROL_ID = 'rol-doc-uuid';
const ROL_DOCENTE = { nombre: 'DOCENTE' };

const DATA_BASE = {
  nombre: 'Ana', apellido: 'García',
  contrasena: 'Password1!',
  rolId: ROL_ID,
};

function makePrismaBase(opts: { emailExiste?: boolean } = {}) {
  return {
    usuario: {
      findUnique: jest.fn().mockResolvedValue(opts.emailExiste ? { id: 'otro' } : null),
      findFirst:  jest.fn().mockResolvedValue(null),
      create:     jest.fn(),
      update:     jest.fn(),
    },
    rol:     { findUnique: jest.fn().mockResolvedValue(ROL_DOCENTE) },
    carrera: { findUnique: jest.fn().mockResolvedValue(null) },
    facultad:{ findUnique: jest.fn().mockResolvedValue(null) },
    docente: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn().mockImplementation(async (cb: any) => cb({
      usuario:        { create: jest.fn().mockResolvedValue({ id: 'u1', nombre: 'Ana', apellido: 'García', correoElectronico: 'ana@udemm.edu.ar', activo: true, fechaCreacion: new Date(), fechaActualizacion: new Date(), rol: { id: ROL_ID, nombre: 'DOCENTE' } }),
                        update: jest.fn() },
      usuarioCarrera: { create: jest.fn(), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      usuarioFacultad:{ create: jest.fn(), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    })),
  };
}

function makeUsuarioActual(email: string) {
  return {
    id: 'u-test', nombre: 'Ana', apellido: 'García',
    correoElectronico: email, activo: true,
    fechaCreacion: new Date(), fechaActualizacion: new Date(),
    rol: { id: ROL_ID, nombre: 'DOCENTE' },
    carrerasAsociadas: [], facultadesAsociadas: [],
  };
}

const makeService = (prisma: any) => new UsuariosService(prisma as any);

// ── crearUsuario ──────────────────────────────────────────────────────────────

describe('UsuariosService — validación de dominio (crearUsuario)', () => {

  it('acepta correo @udemm.edu.ar', async () => {
    const prisma = makePrismaBase();
    const svc = makeService(prisma);
    await expect(
      svc.crearUsuario({ ...DATA_BASE, correoElectronico: 'ana@udemm.edu.ar' }),
    ).resolves.toBeDefined();
  });

  it('acepta correo @docentes.udemm.edu.ar', async () => {
    const prisma = makePrismaBase();
    const svc = makeService(prisma);
    await expect(
      svc.crearUsuario({ ...DATA_BASE, correoElectronico: 'ana@docentes.udemm.edu.ar' }),
    ).resolves.toBeDefined();
  });

  it('acepta dominio en mayúsculas (@UDEMM.EDU.AR)', async () => {
    const prisma = makePrismaBase();
    const svc = makeService(prisma);
    await expect(
      svc.crearUsuario({ ...DATA_BASE, correoElectronico: 'ana@UDEMM.EDU.AR' }),
    ).resolves.toBeDefined();
  });

  it('acepta correo con espacios al inicio/fin (trim)', async () => {
    const prisma = makePrismaBase();
    const svc = makeService(prisma);
    await expect(
      svc.crearUsuario({ ...DATA_BASE, correoElectronico: '  ana@udemm.edu.ar  ' }),
    ).resolves.toBeDefined();
  });

  it('rechaza correo @gmail.com', async () => {
    const prisma = makePrismaBase();
    const svc = makeService(prisma);
    await expect(
      svc.crearUsuario({ ...DATA_BASE, correoElectronico: 'ana@gmail.com' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza correo @mail.udemm.edu.ar (subdominio no autorizado)', async () => {
    const prisma = makePrismaBase();
    const svc = makeService(prisma);
    await expect(
      svc.crearUsuario({ ...DATA_BASE, correoElectronico: 'ana@mail.udemm.edu.ar' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza correo con texto falso "udemm.edu.ar@gmail.com"', async () => {
    const prisma = makePrismaBase();
    const svc = makeService(prisma);
    await expect(
      svc.crearUsuario({ ...DATA_BASE, correoElectronico: 'udemm.edu.ar@gmail.com' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza correo malformado (sin @)', async () => {
    const prisma = makePrismaBase();
    const svc = makeService(prisma);
    await expect(
      svc.crearUsuario({ ...DATA_BASE, correoElectronico: 'noesunemail' }),
    ).rejects.toThrow(BadRequestException);
  });

});

// ── actualizarUsuario ─────────────────────────────────────────────────────────

describe('UsuariosService — validación de dominio (actualizarUsuario)', () => {

  it('acepta nuevo email @udemm.edu.ar', async () => {
    const usuarioActual = makeUsuarioActual('viejo@udemm.edu.ar');
    const tx = {
      usuario:        { update: jest.fn().mockResolvedValue({ ...usuarioActual, correoElectronico: 'nuevo@udemm.edu.ar' }) },
      usuarioCarrera: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      usuarioFacultad:{ deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const prisma = {
      usuario:  { findUnique: jest.fn().mockResolvedValue(usuarioActual), findFirst: jest.fn().mockResolvedValue(null) },
      rol:      { findUnique: jest.fn() },
      carrera:  { findUnique: jest.fn() },
      facultad: { findUnique: jest.fn() },
      docente:  { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    };
    const svc = makeService(prisma);
    await expect(
      svc.actualizarUsuario('u-test', { correoElectronico: 'nuevo@udemm.edu.ar' }),
    ).resolves.toBeDefined();
  });

  it('acepta nuevo email @docentes.udemm.edu.ar', async () => {
    const usuarioActual = makeUsuarioActual('viejo@udemm.edu.ar');
    const tx = {
      usuario:        { update: jest.fn().mockResolvedValue({ ...usuarioActual, correoElectronico: 'nuevo@docentes.udemm.edu.ar' }) },
      usuarioCarrera: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      usuarioFacultad:{ deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const prisma = {
      usuario:  { findUnique: jest.fn().mockResolvedValue(usuarioActual), findFirst: jest.fn().mockResolvedValue(null) },
      rol:      { findUnique: jest.fn() },
      carrera:  { findUnique: jest.fn() },
      facultad: { findUnique: jest.fn() },
      docente:  { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    };
    const svc = makeService(prisma);
    await expect(
      svc.actualizarUsuario('u-test', { correoElectronico: 'nuevo@docentes.udemm.edu.ar' }),
    ).resolves.toBeDefined();
  });

  it('rechaza nuevo email @gmail.com', async () => {
    const usuarioActual = makeUsuarioActual('viejo@udemm.edu.ar');
    const prisma = {
      usuario:  { findUnique: jest.fn().mockResolvedValue(usuarioActual), findFirst: jest.fn() },
      rol:      { findUnique: jest.fn() },
      carrera:  { findUnique: jest.fn() },
      facultad: { findUnique: jest.fn() },
      docente:  { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };
    const svc = makeService(prisma);
    await expect(
      svc.actualizarUsuario('u-test', { correoElectronico: 'nuevo@gmail.com' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rechaza nuevo email @mail.udemm.edu.ar (subdominio no autorizado)', async () => {
    const usuarioActual = makeUsuarioActual('viejo@udemm.edu.ar');
    const prisma = {
      usuario:  { findUnique: jest.fn().mockResolvedValue(usuarioActual), findFirst: jest.fn() },
      rol:      { findUnique: jest.fn() },
      carrera:  { findUnique: jest.fn() },
      facultad: { findUnique: jest.fn() },
      docente:  { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };
    const svc = makeService(prisma);
    await expect(
      svc.actualizarUsuario('u-test', { correoElectronico: 'nuevo@mail.udemm.edu.ar' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('no valida dominio si no se provee correoElectronico (edición de otros datos)', async () => {
    const usuarioActual = makeUsuarioActual('historico@gmail.com');
    const tx = {
      usuario:        { update: jest.fn().mockResolvedValue({ ...usuarioActual, nombre: 'Actualizado' }) },
      usuarioCarrera: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      usuarioFacultad:{ deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const prisma = {
      usuario:  { findUnique: jest.fn().mockResolvedValue(usuarioActual), findFirst: jest.fn() },
      rol:      { findUnique: jest.fn() },
      carrera:  { findUnique: jest.fn() },
      facultad: { findUnique: jest.fn() },
      docente:  { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    };
    const svc = makeService(prisma);
    // Editar solo el nombre — no debe lanzar error por dominio histórico
    await expect(
      svc.actualizarUsuario('u-test', { nombre: 'Actualizado' }),
    ).resolves.toBeDefined();
  });

});
