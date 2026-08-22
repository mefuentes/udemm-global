import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ListarAuditoriaDto } from './dto/listar-auditoria.dto';

export interface RegistrarAuditoriaParams {
  accion: string;
  usuarioId?: string | null;
  normativaId?: string | null;
  normativaTitulo?: string | null;
  normativaNumero?: string | null;
  normativaAnio?: number | null;
  detalle?: Record<string, any> | null;
  ipOrigen?: string | null;
}

@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(params: RegistrarAuditoriaParams): Promise<void> {
    try {
      let usuarioNombre: string | null = null;
      if (params.usuarioId) {
        const u = await this.prisma.usuario.findUnique({
          where:  { id: params.usuarioId },
          select: { nombre: true, apellido: true },
        });
        if (u) usuarioNombre = `${u.apellido}, ${u.nombre}`;
      }

      await this.prisma.auditLogNormativa.create({
        data: {
          accion:          params.accion,
          usuarioId:       params.usuarioId       ?? null,
          usuarioNombre,
          normativaId:     params.normativaId     ?? null,
          normativaTitulo: params.normativaTitulo ?? null,
          normativaNumero: params.normativaNumero ?? null,
          normativaAnio:   params.normativaAnio   ?? null,
          detalle:         (params.detalle as any) ?? null,
          ipOrigen:        params.ipOrigen        ?? null,
        },
      });
    } catch {
      // Audit failures must never affect the main operation
    }
  }

  async listar(dto: ListarAuditoriaDto) {
    const { accion, busqueda, fechaDesde, fechaHasta, page = 1, limit = 10 } = dto;

    const where: Record<string, any> = {};

    if (accion) {
      where.accion = accion;
    }

    if (busqueda?.trim()) {
      const b = busqueda.trim();
      where.OR = [
        { usuarioNombre:   { contains: b, mode: 'insensitive' } },
        { normativaTitulo: { contains: b, mode: 'insensitive' } },
        { normativaNumero: { contains: b, mode: 'insensitive' } },
      ];
    }

    if (fechaDesde || fechaHasta) {
      where.fecha = {};
      if (fechaDesde) where.fecha.gte = new Date(fechaDesde);
      if (fechaHasta) where.fecha.lte = new Date(fechaHasta + 'T23:59:59.999Z');
    }

    const [total, data] = await this.prisma.$transaction([
      this.prisma.auditLogNormativa.count({ where }),
      this.prisma.auditLogNormativa.findMany({
        where,
        orderBy: { fecha: 'desc' },
        take:    limit,
        skip:    (page - 1) * limit,
      }),
    ]);

    return {
      data,
      total,
      paginaActual:  page,
      limite:        limit,
      totalPaginas:  Math.ceil(total / limit),
    };
  }

  async obtenerPorId(id: string) {
    const log = await this.prisma.auditLogNormativa.findUnique({ where: { id } });
    if (!log) throw new NotFoundException('Registro de auditoría no encontrado');
    return log;
  }
}
