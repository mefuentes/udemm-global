import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface RawUsuarioRow {
  id: string;
  nombre: string;
  apellido: string;
  correoElectronico: string;
  activo: boolean;
  fechaCreacion: Date;
  fechaActualizacion: Date;
  rolId: string;
  rolNombre: string;
}

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

  async obtenerUsuarios(
    buscar?: string,
    activo?: boolean,
    page?: number,
    limit?: number,
    rolId?: string,
  ) {
    // Sin término de búsqueda: Prisma client tipado (ruta existente sin cambios)
    if (!buscar) {
      const where: any = {};
      if (activo !== undefined) where.activo = activo;
      if (rolId) where.rolId = rolId;

      const [data, total] = await Promise.all([
        this.prisma.usuario.findMany({
          where,
          select:  SELECT_USUARIO,
          orderBy: { apellido: 'asc' },
          ...(page !== undefined && limit !== undefined
            ? { take: limit, skip: (page - 1) * limit }
            : {}),
        }),
        this.prisma.usuario.count({ where }),
      ]);

      if (page !== undefined && limit !== undefined) {
        return { data, total, pagina: page, limite: limit, totalPaginas: Math.max(1, Math.ceil(total / limit)) };
      }
      return { data, total };
    }

    // Con término de búsqueda: raw SQL con unaccent() para coincidencias
    // sin distinción de mayúsculas NI de acentos (ej: "JOSE" encuentra "JOSÉ").
    // Todos los valores son parámetros Prisma.sql — no hay riesgo de SQL injection.
    const searchPattern = `%${buscar}%`;

    const conditions: Prisma.Sql[] = [
      Prisma.sql`(
        unaccent(u.nombre) ILIKE unaccent(${searchPattern})
        OR unaccent(u.apellido) ILIKE unaccent(${searchPattern})
        OR u."correoElectronico" ILIKE ${searchPattern}
      )`,
    ];
    if (activo !== undefined) conditions.push(Prisma.sql`u.activo = ${activo}`);
    if (rolId) conditions.push(Prisma.sql`u."rolId"::text = ${rolId}`);

    const whereClause = Prisma.join(conditions, ' AND ');
    const paginacion =
      page !== undefined && limit !== undefined
        ? Prisma.sql`LIMIT ${limit} OFFSET ${(page - 1) * limit}`
        : Prisma.empty;

    const [rows, countResult] = await Promise.all([
      this.prisma.$queryRaw<RawUsuarioRow[]>(Prisma.sql`
        SELECT
          u.id,
          u.nombre,
          u.apellido,
          u."correoElectronico",
          u.activo,
          u."fechaCreacion",
          u."fechaActualizacion",
          r.id     AS "rolId",
          r.nombre AS "rolNombre"
        FROM "Usuario" u
        JOIN "Rol" r ON r.id = u."rolId"
        WHERE ${whereClause}
        ORDER BY u.apellido ASC
        ${paginacion}
      `),
      this.prisma.$queryRaw<[{ count: bigint }]>(Prisma.sql`
        SELECT COUNT(*) AS count
        FROM "Usuario" u
        WHERE ${whereClause}
      `),
    ]);

    const data = rows.map((r) => ({
      id:                r.id,
      nombre:            r.nombre,
      apellido:          r.apellido,
      correoElectronico: r.correoElectronico,
      activo:            r.activo,
      fechaCreacion:     r.fechaCreacion,
      fechaActualizacion: r.fechaActualizacion,
      rol: { id: r.rolId, nombre: r.rolNombre },
    }));
    const total = Number(countResult[0].count);

    if (page !== undefined && limit !== undefined) {
      return { data, total, pagina: page, limite: limit, totalPaginas: Math.max(1, Math.ceil(total / limit)) };
    }
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

    // Al desactivar: revocar todas las sesiones activas (M-05b)
    if (!actualizado.activo) {
      await this.prisma.sesion.updateMany({
        where: { usuarioId: id, activo: true },
        data: { activo: false },
      });
    }

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
