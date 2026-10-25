import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ScopeService } from '../scopes/scope.service';
import { CrearCargoDocenteDto } from './dto/crear-cargo-docente.dto';
import { ActualizarCargoDocenteDto } from './dto/actualizar-cargo-docente.dto';

// Roles con acceso global a cargos institucionales (lectura)
const ROLES_GLOBALES_CARGO = new Set([
  'ADMINISTRADOR_SISTEMA',
  'SECRETARIA_ACADEMICA',
  'RECTORADO',
]);

// Campos cuya modificación invalida la verificación del cargo y reabre el relevamiento
const CAMPOS_SUSTANTIVOS: ReadonlyArray<keyof ActualizarCargoDocenteDto> = [
  'fechaInicio',
  'fechaFin',
  'designacion',
];

// Valores admitidos para el parámetro ?vigencia
const VIGENCIAS_VALIDAS = new Set(['vigente', 'futuro', 'historico']);

export type VigenciaFiltro = 'vigente' | 'futuro' | 'historico' | undefined;

const INCLUDE_CARGO = {
  cargo: { select: { id: true, nombre: true } },
} as const;

@Injectable()
export class CargosDocenteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
  ) {}

  // ── Consulta con control de alcance ─────────────────────────────────────────

  async obtenerCargos(
    docenteId: string,
    vigencia: VigenciaFiltro,
    usuarioId: string,
    rolNombre: string,
  ) {
    this.validarVigencia(vigencia);
    await this.verificarDocenteExiste(docenteId);
    await this.verificarScopeDocente(docenteId, usuarioId, rolNombre);
    return this.buscarCargos(docenteId, vigencia);
  }

  // ── Consulta propia del DOCENTE (sin scope institucional) ─────────────────

  async obtenerCargosPropio(usuarioId: string, vigencia: VigenciaFiltro) {
    this.validarVigencia(vigencia);
    const docente = await this.prisma.docente.findFirst({ where: { usuarioId } });
    if (!docente) throw new NotFoundException('Docente no encontrado para este usuario');
    return this.buscarCargos(docente.id, vigencia);
  }

  // ── Creación ─────────────────────────────────────────────────────────────────

  async crearCargo(
    docenteId: string,
    dto: CrearCargoDocenteDto,
    creadoPorId: string,
  ) {
    await this.verificarDocenteExiste(docenteId);

    const cargo = await this.prisma.cargo.findUnique({ where: { id: dto.cargoId } });
    if (!cargo || !cargo.activo) {
      throw new BadRequestException('Cargo no válido o inactivo');
    }

    const fechaInicio = new Date(dto.fechaInicio);
    const fechaFin    = dto.fechaFin ? new Date(dto.fechaFin) : null;
    this.validarFechas(fechaInicio, fechaFin);

    // Transacción: crear cargo + reabrir relevamiento (el nuevo cargo no está verificado)
    return this.prisma.$transaction(async (tx) => {
      const nuevoCargo = await tx.cargoDocente.create({
        data: {
          docenteId,
          cargoId:       dto.cargoId,
          designacion:   dto.designacion   ?? null,
          fechaInicio,
          fechaFin,
          observaciones: dto.observaciones ?? null,
          creadoPorId,
          // fuente: siempre 'SECRETARIA' (default del modelo) — no expuesto en DTO
        },
        include: INCLUDE_CARGO,
      });
      await tx.docente.update({
        where: { id: docenteId },
        data:  { relevamientoCargosCompleto: false },
      });
      return nuevoCargo;
    });
  }

  // ── Actualización ─────────────────────────────────────────────────────────────

  async actualizarCargo(
    docenteId: string,
    cargoDocenteId: string,
    dto: ActualizarCargoDocenteDto,
  ) {
    const cargoDocente = await this.prisma.cargoDocente.findUnique({
      where: { id: cargoDocenteId },
    });
    if (!cargoDocente) throw new NotFoundException('Cargo institucional no encontrado');
    if (cargoDocente.docenteId !== docenteId) {
      throw new ForbiddenException('El cargo no pertenece a este docente');
    }

    // Detectar si hay cambio sustantivo (invalida verificado y reabre relevamiento)
    const hayCambioSustantivo = CAMPOS_SUSTANTIVOS.some(c => dto[c] !== undefined);

    // No se puede verificar y modificar datos sustantivos en el mismo acto
    if (hayCambioSustantivo && dto.verificado === true) {
      throw new BadRequestException(
        'No se puede verificar un cargo al mismo tiempo que se modifican datos sustantivos (fechaInicio, fechaFin, designacion)',
      );
    }

    const fechaInicio = dto.fechaInicio !== undefined
      ? new Date(dto.fechaInicio)
      : cargoDocente.fechaInicio;
    const fechaFin = dto.fechaFin !== undefined
      ? (dto.fechaFin === null ? null : new Date(dto.fechaFin))
      : cargoDocente.fechaFin;
    this.validarFechas(fechaInicio, fechaFin);

    // Solo incluir campos explícitamente enviados (whitelist por DTO + whitelist: true del pipe)
    // Inmutables bloqueados: id, docenteId, cargoId, creadoPorId, fechaCreacion, fuente
    const data: Record<string, unknown> = {};
    if (dto.designacion   !== undefined) data['designacion']   = dto.designacion;
    if (dto.fechaInicio   !== undefined) data['fechaInicio']   = new Date(dto.fechaInicio);
    if (dto.fechaFin      !== undefined) data['fechaFin']      = fechaFin;
    if (dto.observaciones !== undefined) data['observaciones'] = dto.observaciones;
    if (dto.verificado    !== undefined) data['verificado']    = dto.verificado;

    // Cambio sustantivo → forzar verificado = false (invalida certificación anterior)
    if (hayCambioSustantivo) {
      data['verificado'] = false;
    }

    // Se reabre el relevamiento si: cambio sustantivo O desverificación explícita
    const resetRelevamiento = hayCambioSustantivo || dto.verificado === false;

    return this.prisma.$transaction(async (tx) => {
      const cargoActualizado = await tx.cargoDocente.update({
        where:   { id: cargoDocenteId },
        data,
        include: INCLUDE_CARGO,
      });
      if (resetRelevamiento) {
        await tx.docente.update({
          where: { id: docenteId },
          data:  { relevamientoCargosCompleto: false },
        });
      }
      return cargoActualizado;
    });
  }

  // ── Relevamiento ─────────────────────────────────────────────────────────────

  async actualizarRelevamiento(
    docenteId: string,
    relevamientoCargosCompleto: boolean,
  ) {
    await this.verificarDocenteExiste(docenteId);

    if (relevamientoCargosCompleto) {
      // Bloquear cierre si existen cargos sin verificación institucional
      const pendientes = await this.prisma.cargoDocente.count({
        where: { docenteId, verificado: false },
      });
      if (pendientes > 0) {
        throw new BadRequestException(
          `No se puede cerrar el relevamiento: ${pendientes} cargo(s) pendiente(s) de verificación institucional`,
        );
      }
    }
    // Reapertura (false) siempre permitida

    return this.prisma.docente.update({
      where:  { id: docenteId },
      data:   { relevamientoCargosCompleto },
      select: { id: true, relevamientoCargosCompleto: true },
    });
  }

  // ── Helpers privados ─────────────────────────────────────────────────────────

  private async buscarCargos(docenteId: string, vigencia: VigenciaFiltro) {
    const hoy   = new Date();
    const where: any = { docenteId };
    this.aplicarFiltroVigencia(where, vigencia, hoy);
    return this.prisma.cargoDocente.findMany({
      where,
      include: INCLUDE_CARGO,
      orderBy: { fechaInicio: 'desc' },
    });
  }

  /**
   * Verifica que el usuario tenga alcance institucional sobre el docente.
   *
   * FUENTE DE VERDAD: VinculacionCatedra con estado = 'APROBADA' (consistente con MOD-AUT).
   *
   * LIMITACIÓN DOCUMENTADA: un docente sin vinculaciones APROBADAS en el scope del
   * DECANO/DIRECTOR no puede ser consultado aunque tenga vinculaciones PENDIENTES.
   * Política segura: denegar cuando no puede acreditarse el alcance (D3B §2).
   * Esta política es consistente con la fuente usada por MOD-AUT para determinar
   * el plantel docente de una facultad/carrera.
   */
  private async verificarScopeDocente(
    docenteId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<void> {
    if (ROLES_GLOBALES_CARGO.has(rolNombre)) return;

    if (rolNombre === 'DECANO') {
      const asocFacultad = await this.prisma.usuarioFacultad.findFirst({
        where:  { usuarioId },
        select: { facultadId: true },
      });
      if (!asocFacultad) {
        throw new ForbiddenException('Sin alcance de facultad asociado al usuario');
      }
      const vinc = await this.prisma.vinculacionCatedra.findFirst({
        where: {
          docenteId,
          facultadId: asocFacultad.facultadId,
          estado: 'APROBADA',
        },
      });
      if (!vinc) {
        throw new ForbiddenException('Docente sin vinculación activa en la facultad del decano');
      }
      return;
    }

    if (rolNombre === 'DIRECTOR_CARRERA') {
      const carrerasScope = await this.scope.getCarrerasEnScope(usuarioId, rolNombre);
      if (!carrerasScope || carrerasScope.length === 0) {
        throw new ForbiddenException('Sin alcance de carrera asociado al usuario');
      }
      const vinc = await this.prisma.vinculacionCatedra.findFirst({
        where: {
          docenteId,
          carreraId: { in: carrerasScope },
          estado: 'APROBADA',
        },
      });
      if (!vinc) {
        throw new ForbiddenException('Docente sin vinculación activa en las carreras del director');
      }
      return;
    }

    throw new ForbiddenException('Rol sin alcance de gestión de cargos institucionales');
  }

  /**
   * Filtra por vigencia según K-D6.
   * K-D6: vigente = fechaInicio <= fechaCalculo AND (fechaFin IS NULL OR fechaFin > fechaCalculo)
   * Nota: fechaFin === fechaCalculo → NO vigente (gt, no gte).
   */
  private aplicarFiltroVigencia(
    where: any,
    vigencia: VigenciaFiltro,
    hoy: Date,
  ): void {
    if (!vigencia) return;
    if (vigencia === 'vigente') {
      where.fechaInicio = { lte: hoy };
      where.OR = [{ fechaFin: null }, { fechaFin: { gt: hoy } }];
    } else if (vigencia === 'futuro') {
      where.fechaInicio = { gt: hoy };
    } else if (vigencia === 'historico') {
      where.AND = [
        { fechaFin: { not: null } },
        { fechaFin: { lte: hoy } },
      ];
    }
    // VIGENCIAS_VALIDAS garantiza que solo se llega aquí con valores conocidos
  }

  /**
   * Valida el parámetro vigencia.
   * Un valor desconocido lanza BadRequestException en lugar de retornar todos los registros.
   */
  private validarVigencia(vigencia: string | undefined): void {
    if (vigencia !== undefined && !VIGENCIAS_VALIDAS.has(vigencia)) {
      throw new BadRequestException(
        `Parámetro 'vigencia' inválido: '${vigencia}'. Valores aceptados: vigente, futuro, historico`,
      );
    }
  }

  private async verificarDocenteExiste(docenteId: string): Promise<void> {
    const docente = await this.prisma.docente.findUnique({ where: { id: docenteId } });
    if (!docente) throw new NotFoundException('Docente no encontrado');
  }

  private validarFechas(fechaInicio: Date, fechaFin: Date | null): void {
    if (fechaFin !== null && fechaFin <= fechaInicio) {
      throw new BadRequestException('fechaFin debe ser posterior a fechaInicio');
    }
  }
}
