import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CrearVinculacionDto } from './dto/crear-vinculacion.dto';
import { DesvincularVinculacionDto } from './dto/desvincular-vinculacion.dto';
import { FiltrarVinculacionesDto } from './dto/filtrar-vinculaciones.dto';
import { RechazarVinculacionDto } from './dto/rechazar-vinculacion.dto';

const INCLUDE_COMPLETO = {
  facultad:            { select: { id: true, nombre: true } },
  carrera:             { select: { id: true, nombre: true } },
  planEstudio:         { select: { id: true, nombre: true, codigo: true } },
  materia:             { select: { id: true, nombre: true, codigo: true } },
  docente:             { select: { id: true, nombre: true, apellido: true } },
  catedra:             { select: { id: true, nombre: true } },
  cargo:               { select: { id: true, nombre: true } },
  modalidad:           { select: { id: true, nombre: true } },
  designacion:         { select: { id: true, nombre: true } },
  usuarioSolicitante:  { select: { id: true, nombre: true, apellido: true } },
  aprobador:           { select: { id: true, nombre: true, apellido: true } },
  desvinculador:       { select: { id: true, nombre: true, apellido: true } },
};

@Injectable()
export class VinculacionesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async getDocenteByUsuarioId(usuarioId: string) {
    return this.prisma.docente.findUnique({ where: { usuarioId } });
  }

  // ── Listado ────────────────────────────────────────────────────────────────

  async listar(filtros: FiltrarVinculacionesDto, usuarioId: string, rolNombre: string) {
    const where: any = {};

    if (rolNombre === 'DOCENTE') {
      const docente = await this.getDocenteByUsuarioId(usuarioId);
      if (!docente) return [];
      where.docenteId = docente.id;
    } else {
      if (filtros.facultadId)    where.facultadId    = filtros.facultadId;
      if (filtros.carreraId)     where.carreraId     = filtros.carreraId;
      if (filtros.planEstudioId) where.planEstudioId = filtros.planEstudioId;
      if (filtros.materiaId)     where.materiaId     = filtros.materiaId;
      if (filtros.docenteId)     where.docenteId     = filtros.docenteId;
    }

    if (filtros.estado) where.estado = filtros.estado;

    if (filtros.buscar?.trim()) {
      const b = filtros.buscar.trim();
      where.OR = [
        { materia:  { nombre:   { contains: b, mode: 'insensitive' } } },
        { docente:  { nombre:   { contains: b, mode: 'insensitive' } } },
        { docente:  { apellido: { contains: b, mode: 'insensitive' } } },
        { carrera:  { nombre:   { contains: b, mode: 'insensitive' } } },
      ];
    }

    return this.prisma.vinculacionCatedra.findMany({
      where,
      include:  INCLUDE_COMPLETO,
      orderBy:  { fechaCreacion: 'desc' },
    });
  }

  // ── Detalle ────────────────────────────────────────────────────────────────

  async obtenerPorId(id: string, usuarioId: string, rolNombre: string) {
    const vc = await this.prisma.vinculacionCatedra.findUnique({
      where:   { id },
      include: INCLUDE_COMPLETO,
    });
    if (!vc) throw new NotFoundException('Vinculación no encontrada');

    if (rolNombre === 'DOCENTE') {
      const docente = await this.getDocenteByUsuarioId(usuarioId);
      if (!docente || vc.docenteId !== docente.id) {
        throw new ForbiddenException('No tenés acceso a esta vinculación');
      }
    }

    return vc;
  }

  // ── Crear ──────────────────────────────────────────────────────────────────

  async crear(dto: CrearVinculacionDto, usuarioId: string) {
    const [facultad, carrera, planEstudio, materia, docente, catedra, cargo, modalidad, designacion] =
      await Promise.all([
        this.prisma.facultad.findUnique({ where: { id: dto.facultadId } }),
        this.prisma.carrera.findUnique({ where: { id: dto.carreraId } }),
        this.prisma.planEstudio.findUnique({ where: { id: dto.planEstudioId } }),
        this.prisma.materia.findUnique({ where: { id: dto.materiaId } }),
        this.prisma.docente.findUnique({ where: { id: dto.docenteId } }),
        this.prisma.catedra.findUnique({ where: { id: dto.catedraId } }),
        this.prisma.cargo.findUnique({ where: { id: dto.cargoId } }),
        this.prisma.modalidad.findUnique({ where: { id: dto.modalidadId } }),
        this.prisma.designacion.findUnique({ where: { id: dto.designacionId } }),
      ]);

    if (!facultad   || facultad.estado   !== 'ACTIVO') throw new BadRequestException('Facultad no válida o inactiva');
    if (!carrera    || carrera.estado    !== 'ACTIVO') throw new BadRequestException('Carrera no válida o inactiva');
    if (!planEstudio || planEstudio.estado !== 'ACTIVO') throw new BadRequestException('Plan no válido o inactivo');
    if (!materia    || materia.estado    !== 'ACTIVO') throw new BadRequestException('Asignatura no válida o inactiva');
    if (!docente    || !docente.activo)                throw new BadRequestException('Docente no válido o inactivo');
    if (!catedra    || !catedra.activo)                throw new BadRequestException('Cátedra no válida o inactiva');
    if (!cargo      || !cargo.activo)                  throw new BadRequestException('Cargo no válido o inactivo');
    if (!modalidad  || !modalidad.activo)              throw new BadRequestException('Modalidad no válida o inactiva');
    if (!designacion || !designacion.activo)           throw new BadRequestException('Designación no válida o inactiva');

    if (materia.cargaHorariaSemanal === null || materia.cargaHorariaSemanal === undefined) {
      throw new BadRequestException(
        'La asignatura seleccionada no tiene carga horaria semanal definida. Actualizá la asignatura en la Estructura Curricular antes de crear la vinculación.',
      );
    }

    const duplicado = await this.prisma.vinculacionCatedra.findFirst({
      where: {
        planEstudioId:  dto.planEstudioId,
        materiaId:      dto.materiaId,
        docenteId:      dto.docenteId,
        catedraId:      dto.catedraId,
        cargoId:        dto.cargoId,
        modalidadId:    dto.modalidadId,
        designacionId:  dto.designacionId,
        estado:         { in: ['PENDIENTE_DE_APROBACION', 'APROBADA'] },
      },
    });
    if (duplicado) {
      throw new ConflictException(
        'Ya existe una vinculación pendiente o aprobada con la misma combinación de Asignatura, Docente, Cátedra, Cargo, Modalidad y Designación.',
      );
    }

    return this.prisma.vinculacionCatedra.create({
      data: {
        facultadId:           dto.facultadId,
        carreraId:            dto.carreraId,
        planEstudioId:        dto.planEstudioId,
        materiaId:            dto.materiaId,
        docenteId:            dto.docenteId,
        catedraId:            dto.catedraId,
        cargoId:              dto.cargoId,
        modalidadId:          dto.modalidadId,
        designacionId:        dto.designacionId,
        horasSemana:          materia.cargaHorariaSemanal,
        anioInicio:           dto.anioInicio,
        observaciones:        dto.observaciones,
        usuarioSolicitanteId: usuarioId,
        estado:               'PENDIENTE_DE_APROBACION',
      },
      include: INCLUDE_COMPLETO,
    });
  }

  // ── Aprobar ────────────────────────────────────────────────────────────────

  async aprobar(id: string, usuarioId: string, rolNombre: string) {
    const vc = await this.prisma.vinculacionCatedra.findUnique({ where: { id } });
    if (!vc) throw new NotFoundException('Vinculación no encontrada');

    if (rolNombre === 'DOCENTE') {
      const docente = await this.getDocenteByUsuarioId(usuarioId);
      if (!docente || vc.docenteId !== docente.id) {
        throw new ForbiddenException('Solo podés aprobar vinculaciones asignadas a tu cuenta');
      }
    }

    if (vc.estado !== 'PENDIENTE_DE_APROBACION') {
      throw new BadRequestException(`No se puede aprobar una vinculación en estado "${vc.estado}"`);
    }

    return this.prisma.vinculacionCatedra.update({
      where: { id },
      data: {
        estado:          'APROBADA',
        aprobadorId:     usuarioId,
        fechaAprobacion: new Date(),
      },
      include: INCLUDE_COMPLETO,
    });
  }

  // ── Rechazar ───────────────────────────────────────────────────────────────

  async rechazar(id: string, dto: RechazarVinculacionDto, usuarioId: string, rolNombre: string) {
    const vc = await this.prisma.vinculacionCatedra.findUnique({ where: { id } });
    if (!vc) throw new NotFoundException('Vinculación no encontrada');

    if (rolNombre === 'DOCENTE') {
      const docente = await this.getDocenteByUsuarioId(usuarioId);
      if (!docente || vc.docenteId !== docente.id) {
        throw new ForbiddenException('Solo podés rechazar vinculaciones asignadas a tu cuenta');
      }
    }

    if (vc.estado !== 'PENDIENTE_DE_APROBACION') {
      throw new BadRequestException(`No se puede rechazar una vinculación en estado "${vc.estado}"`);
    }

    return this.prisma.vinculacionCatedra.update({
      where: { id },
      data: {
        estado:          'RECHAZADA',
        aprobadorId:     usuarioId,
        fechaAprobacion: new Date(),
        motivoRechazo:   dto.motivo,
      },
      include: INCLUDE_COMPLETO,
    });
  }

  // ── Desvincular ────────────────────────────────────────────────────────────

  async desvincular(id: string, dto: DesvincularVinculacionDto, usuarioId: string) {
    const vc = await this.prisma.vinculacionCatedra.findUnique({
      where: { id },
      include: {
        materia:     { select: { nombre: true } },
        carrera:     { select: { nombre: true } },
        planEstudio: { select: { nombre: true } },
        catedra:     { select: { nombre: true } },
        cargo:       { select: { nombre: true } },
        docente:     { select: { id: true } },
      },
    });

    if (!vc) throw new NotFoundException('Vinculación no encontrada');

    if (vc.estado !== 'APROBADA') {
      throw new BadRequestException(
        `Solo se pueden desvincular vinculaciones APROBADAS. Estado actual: "${vc.estado}"`,
      );
    }

    const fechaParsed = new Date(`${dto.fechaDesvinculacion}T00:00:00.000Z`);
    if (isNaN(fechaParsed.getTime())) {
      throw new BadRequestException('Fecha de desvinculación inválida');
    }

    const cuerpoNotificacion = JSON.stringify({
      carrera:             vc.carrera.nombre,
      plan:                vc.planEstudio.nombre,
      asignatura:          vc.materia.nombre,
      catedra:             vc.catedra.nombre,
      cargo:               vc.cargo.nombre,
      fechaDesvinculacion: dto.fechaDesvinculacion,
      motivo:              dto.motivoDesvinculacion,
    });

    return this.prisma.$transaction(async (tx) => {
      const actualizada = await tx.vinculacionCatedra.update({
        where: { id },
        data: {
          estado:                      'DESVINCULADA',
          desvinculadorId:             usuarioId,
          fechaDesvinculacion:         fechaParsed,
          motivoDesvinculacion:        dto.motivoDesvinculacion,
          fechaRegistroDesvinculacion: new Date(),
        } as any,
        include: INCLUDE_COMPLETO,
      });

      await (tx as any).notificacion.create({
        data: {
          tipo:          'DESVINCULACION',
          titulo:        `Se ha registrado la finalización de su vinculación con la asignatura ${vc.materia.nombre}`,
          cuerpo:        cuerpoNotificacion,
          docenteId:     vc.docente.id,
          vinculacionId: id,
        },
      });

      return actualizada;
    });
  }
}
