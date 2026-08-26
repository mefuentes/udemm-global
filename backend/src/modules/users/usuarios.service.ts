import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';

const SELECT_USUARIO = {
  id: true,
  nombre: true,
  apellido: true,
  correoElectronico: true,
  activo: true,
  fechaCreacion: true,
  fechaActualizacion: true,
  rol: { select: { id: true, nombre: true } }
};

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Garantiza la existencia y estado correcto del registro Docente vinculado al usuario.
   * Idempotente: si el docente ya existe lo actualiza; si no, lo crea o vincula uno pre-existente.
   *
   * - Rol DOCENTE + usuario activo   → docente activo   (aparece en selector de vinculación)
   * - Rol DOCENTE + usuario inactivo → docente inactivo (no aparece)
   * - Rol distinto de DOCENTE        → docente inactivo (preserva historia, no se elimina)
   *
   * Si ya existía un Docente creado manualmente con el mismo correo y sin usuarioId,
   * se vincula en lugar de crear uno nuevo.
   *
   * Para el placeholder de numeroDocumento se usa el UUID del usuario, que es único
   * por definición. El docente lo reemplaza con su documento real desde Mi Ficha.
   */
  private async sincronizarDocente(
    usuario: { id: string; nombre: string; apellido: string; correoElectronico: string; activo: boolean },
    rolNombre: string,
  ): Promise<void> {
    const docenteVinculado = await this.prisma.docente.findUnique({
      where: { usuarioId: usuario.id },
    });

    if (rolNombre !== 'DOCENTE') {
      if (docenteVinculado) {
        await this.prisma.docente.update({
          where: { id: docenteVinculado.id },
          data: { activo: false },
        });
      }
      return;
    }

    // El rol ES DOCENTE — garantizar que el docente exista y su estado esté sincronizado.

    if (docenteVinculado) {
      await this.prisma.docente.update({
        where: { id: docenteVinculado.id },
        data: { activo: usuario.activo },
      });
      return;
    }

    // Sin docente vinculado por usuarioId — buscar si existe uno con el mismo correo
    // (puede haber sido creado manualmente antes de la existencia del usuario).
    const docentePorEmail = await this.prisma.docente.findUnique({
      where: { correoElectronico: usuario.correoElectronico },
    });
    if (docentePorEmail) {
      if (!docentePorEmail.usuarioId) {
        // Vincular el docente existente a este usuario
        await this.prisma.docente.update({
          where: { id: docentePorEmail.id },
          data: { usuarioId: usuario.id, activo: usuario.activo },
        });
      }
      // Si ya tiene otro usuarioId: inconsistencia de datos existente, no tocar.
      return;
    }

    // Crear nuevo registro Docente con los datos disponibles del usuario.
    // Los campos académicos se completan desde Mi Ficha Docente.
    await this.prisma.docente.create({
      data: {
        usuarioId:         usuario.id,
        nombre:            usuario.nombre,
        apellido:          usuario.apellido,
        correoElectronico: usuario.correoElectronico,
        tipoDocumento:     'DNI',
        numeroDocumento:   usuario.id,   // UUID único como placeholder; se reemplaza en Mi Ficha
        activo:            usuario.activo,
      },
    });
  }

  async crearUsuario(data: {
    nombre: string;
    apellido: string;
    correoElectronico: string;
    contrasena: string;
    rolId: string;
  }) {
    const existe = await this.prisma.usuario.findUnique({
      where: { correoElectronico: data.correoElectronico }
    });
    if (existe) throw new BadRequestException('El correo electrónico ya está registrado');

    const contrasenaHash = await bcrypt.hash(data.contrasena, 10);
    const usuario = await this.prisma.usuario.create({
      data: {
        nombre: data.nombre,
        apellido: data.apellido,
        correoElectronico: data.correoElectronico,
        contrasenaHash,
        rolId: data.rolId
      },
      select: SELECT_USUARIO
    });

    // Si el rol es DOCENTE, garantizar la existencia del registro Docente vinculado
    if (usuario.rol.nombre === 'DOCENTE') {
      await this.sincronizarDocente(
        {
          id:                usuario.id,
          nombre:            usuario.nombre,
          apellido:          usuario.apellido,
          correoElectronico: usuario.correoElectronico,
          activo:            usuario.activo,
        },
        'DOCENTE',
      );
    }

    return usuario;
  }

  async obtenerUsuarios(buscar?: string, activo?: boolean) {
    const where: any = {};
    if (buscar) {
      where.OR = [
        { nombre: { contains: buscar, mode: 'insensitive' } },
        { apellido: { contains: buscar, mode: 'insensitive' } },
        { correoElectronico: { contains: buscar, mode: 'insensitive' } }
      ];
    }
    if (activo !== undefined) where.activo = activo;

    const [data, total] = await Promise.all([
      this.prisma.usuario.findMany({ where, select: SELECT_USUARIO, orderBy: { apellido: 'asc' } }),
      this.prisma.usuario.count({ where })
    ]);
    return { data, total };
  }

  async obtenerUsuarioPorId(id: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id }, select: SELECT_USUARIO });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    return usuario;
  }

  async actualizarUsuario(id: string, data: {
    nombre?: string;
    apellido?: string;
    correoElectronico?: string;
    contrasena?: string;
    rolId?: string;
  }) {
    await this.obtenerUsuarioPorId(id);

    if (data.correoElectronico) {
      const existe = await this.prisma.usuario.findFirst({
        where: { correoElectronico: data.correoElectronico, NOT: { id } }
      });
      if (existe) throw new BadRequestException('El correo electrónico ya está en uso');
    }

    const updateData: any = { ...data };
    if (data.contrasena) {
      updateData.contrasenaHash = await bcrypt.hash(data.contrasena, 10);
    }
    delete updateData.contrasena;

    const usuarioActualizado = await this.prisma.usuario.update({
      where: { id },
      data: updateData,
      select: SELECT_USUARIO
    });

    // Sincronizar el registro Docente cuando:
    //   - El rol cambió (cualquier dirección)
    //   - El usuario resultante tiene rol DOCENTE (garantiza creación tardía para
    //     usuarios creados antes de la existencia de esta lógica)
    if (data.rolId !== undefined || usuarioActualizado.rol.nombre === 'DOCENTE') {
      await this.sincronizarDocente(
        {
          id:                usuarioActualizado.id,
          nombre:            usuarioActualizado.nombre,
          apellido:          usuarioActualizado.apellido,
          correoElectronico: usuarioActualizado.correoElectronico,
          activo:            usuarioActualizado.activo,
        },
        usuarioActualizado.rol.nombre,
      );
    }

    return usuarioActualizado;
  }

  async toggleEstado(id: string) {
    const usuario = await this.obtenerUsuarioPorId(id);
    const actualizado = await this.prisma.usuario.update({
      where: { id },
      data: { activo: !usuario.activo },
      select: SELECT_USUARIO
    });

    // Sincronizar registro Docente: crea si falta, actualiza activo según rol y estado del usuario
    await this.sincronizarDocente(
      {
        id:                actualizado.id,
        nombre:            actualizado.nombre,
        apellido:          actualizado.apellido,
        correoElectronico: actualizado.correoElectronico,
        activo:            actualizado.activo,
      },
      actualizado.rol.nombre,
    );

    return actualizado;
  }
}
