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

// Extiende SELECT_USUARIO con las asociaciones de scope institucional.
// Usado en obtenerUsuarioPorId para que el endpoint de detalle devuelva
// la carrera (DIRECTOR_CARRERA) o facultad (DECANO) ya configurada.
const SELECT_USUARIO_CON_SCOPE = {
  ...SELECT_USUARIO,
  carrerasAsociadas: {
    select: { carrera: { select: { id: true, nombre: true } } },
  },
  facultadesAsociadas: {
    select: { facultad: { select: { id: true, nombre: true } } },
  },
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

  /**
   * Elimina asociaciones UsuarioCarrera/UsuarioFacultad cuando el rol ya no
   * corresponde al propietario del scope. Se invoca tras cualquier cambio de rol.
   *
   * - Nuevo rol != DIRECTOR_CARRERA → elimina todas sus filas en UsuarioCarrera
   * - Nuevo rol != DECANO           → elimina todas sus filas en UsuarioFacultad
   *
   * El servicio ScopeService SIEMPRE verifica ROL + ASOCIACIÓN, por lo que
   * aunque esta limpieza falle, la asociación residual no concedería scope.
   * La limpieza proactiva es una defensa en profundidad.
   */
  private async limpiarScopesResiduales(usuarioId: string, nuevoRolNombre: string): Promise<void> {
    if (nuevoRolNombre !== 'DIRECTOR_CARRERA') {
      await this.prisma.usuarioCarrera.deleteMany({ where: { usuarioId } });
    }
    if (nuevoRolNombre !== 'DECANO') {
      await this.prisma.usuarioFacultad.deleteMany({ where: { usuarioId } });
    }
  }

  async crearUsuario(data: {
    nombre: string;
    apellido: string;
    correoElectronico: string;
    contrasena: string;
    rolId: string;
    carreraId?: string;
    facultadId?: string;
  }) {
    // 1. Correo único
    const existe = await this.prisma.usuario.findUnique({
      where: { correoElectronico: data.correoElectronico }
    });
    if (existe) throw new BadRequestException('El correo electrónico ya está registrado');

    // 2. Resolver nombre del rol para validar scope
    const rol = await this.prisma.rol.findUnique({ where: { id: data.rolId }, select: { nombre: true } });
    if (!rol) throw new BadRequestException('El rol indicado no existe.');
    const rolNombre = rol.nombre;

    // 3. Validar requisitos de scope institucional
    if (rolNombre === 'DIRECTOR_CARRERA') {
      if (!data.carreraId) throw new BadRequestException('El rol DIRECTOR_CARRERA requiere una Carrera asociada.');
      const carrera = await this.prisma.carrera.findUnique({ where: { id: data.carreraId }, select: { id: true } });
      if (!carrera) throw new NotFoundException('La Carrera indicada no existe.');
    }
    if (rolNombre === 'DECANO') {
      if (!data.facultadId) throw new BadRequestException('El rol DECANO requiere una Facultad asociada.');
      const facultad = await this.prisma.facultad.findUnique({ where: { id: data.facultadId }, select: { id: true } });
      if (!facultad) throw new NotFoundException('La Facultad indicada no existe.');
    }

    const contrasenaHash = await bcrypt.hash(data.contrasena, 10);

    // 4. Crear usuario y asociación de scope en una sola transacción atómica
    const usuario = await this.prisma.$transaction(async (tx) => {
      const u = await tx.usuario.create({
        data: {
          nombre:            data.nombre,
          apellido:          data.apellido,
          correoElectronico: data.correoElectronico,
          contrasenaHash,
          rolId:             data.rolId,
        },
        select: SELECT_USUARIO,
      });

      if (rolNombre === 'DIRECTOR_CARRERA' && data.carreraId) {
        await tx.usuarioCarrera.create({ data: { usuarioId: u.id, carreraId: data.carreraId } });
      } else if (rolNombre === 'DECANO' && data.facultadId) {
        await tx.usuarioFacultad.create({ data: { usuarioId: u.id, facultadId: data.facultadId } });
      }

      return u;
    });

    // 5. Sincronizar registro Docente (fuera de la transacción, no crítico)
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
    const usuario = await this.prisma.usuario.findUnique({ where: { id }, select: SELECT_USUARIO_CON_SCOPE });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    return usuario;
  }

  async actualizarUsuario(id: string, data: {
    nombre?: string;
    apellido?: string;
    correoElectronico?: string;
    contrasena?: string;
    rolId?: string;
    carreraId?: string;
    facultadId?: string;
  }) {
    // 1. Verificar existencia y obtener rol actual
    const usuarioActual = await this.obtenerUsuarioPorId(id);
    const rolActualNombre = usuarioActual.rol.nombre;

    // 2. Resolver nombre del nuevo rol (si cambia)
    let rolNuevoNombre = rolActualNombre;
    if (data.rolId && data.rolId !== usuarioActual.rol.id) {
      const rolNuevo = await this.prisma.rol.findUnique({ where: { id: data.rolId }, select: { nombre: true } });
      if (!rolNuevo) throw new BadRequestException('El rol indicado no existe.');
      rolNuevoNombre = rolNuevo.nombre;
    }

    // 3. Validar scope requerido al cambiar a un rol con scope territorial
    const cambiaADirector = rolNuevoNombre === 'DIRECTOR_CARRERA' && rolActualNombre !== 'DIRECTOR_CARRERA';
    const cambiaADecano   = rolNuevoNombre === 'DECANO'           && rolActualNombre !== 'DECANO';
    if (cambiaADirector && !data.carreraId) {
      throw new BadRequestException('Al asignar el rol DIRECTOR_CARRERA se requiere una Carrera asociada.');
    }
    if (cambiaADecano && !data.facultadId) {
      throw new BadRequestException('Al asignar el rol DECANO se requiere una Facultad asociada.');
    }

    // 4. Validar existencia de carreraId/facultadId si se proveyeron
    if (data.carreraId) {
      const carrera = await this.prisma.carrera.findUnique({ where: { id: data.carreraId }, select: { id: true } });
      if (!carrera) throw new NotFoundException('La Carrera indicada no existe.');
    }
    if (data.facultadId) {
      const facultad = await this.prisma.facultad.findUnique({ where: { id: data.facultadId }, select: { id: true } });
      if (!facultad) throw new NotFoundException('La Facultad indicada no existe.');
    }

    // 5. Correo único
    if (data.correoElectronico) {
      const existe = await this.prisma.usuario.findFirst({
        where: { correoElectronico: data.correoElectronico, NOT: { id } }
      });
      if (existe) throw new BadRequestException('El correo electrónico ya está en uso');
    }

    // 6. Construir payload de actualización (sin campos de scope, que van a tablas propias)
    const updateData: any = {};
    if (data.nombre !== undefined)            updateData.nombre = data.nombre;
    if (data.apellido !== undefined)          updateData.apellido = data.apellido;
    if (data.correoElectronico !== undefined) updateData.correoElectronico = data.correoElectronico;
    if (data.rolId !== undefined)             updateData.rolId = data.rolId;
    if (data.contrasena) {
      updateData.contrasenaHash = await bcrypt.hash(data.contrasena, 10);
    }

    // 7. Actualizar usuario y gestionar scopes en una sola transacción atómica.
    //    Orden de operaciones:
    //      a) Actualizar fila Usuario
    //      b) Eliminar asociaciones que ya no corresponden al nuevo rol
    //      c) Crear/reemplazar la asociación si se proveyó carreraId/facultadId
    const usuarioActualizado = await this.prisma.$transaction(async (tx) => {
      const u = await tx.usuario.update({ where: { id }, data: updateData, select: SELECT_USUARIO });

      if (rolNuevoNombre !== 'DIRECTOR_CARRERA') {
        await tx.usuarioCarrera.deleteMany({ where: { usuarioId: id } });
      }
      if (rolNuevoNombre !== 'DECANO') {
        await tx.usuarioFacultad.deleteMany({ where: { usuarioId: id } });
      }

      if (rolNuevoNombre === 'DIRECTOR_CARRERA' && data.carreraId) {
        await tx.usuarioCarrera.deleteMany({ where: { usuarioId: id } });
        await tx.usuarioCarrera.create({ data: { usuarioId: id, carreraId: data.carreraId } });
      }
      if (rolNuevoNombre === 'DECANO' && data.facultadId) {
        await tx.usuarioFacultad.deleteMany({ where: { usuarioId: id } });
        await tx.usuarioFacultad.create({ data: { usuarioId: id, facultadId: data.facultadId } });
      }

      return u;
    });

    // 8. Sincronizar registro Docente (fuera de la transacción, no crítico)
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
