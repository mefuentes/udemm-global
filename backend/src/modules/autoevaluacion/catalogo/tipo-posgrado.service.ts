import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface TipoPosgradoDto {
  id: string;
  nombre: string;
  activo: boolean;
}

/** Nombres canónicos del catálogo CONEAU de nivel de posgrado (D-06). */
export const NOMBRE_POSGRADO = {
  DOCTORADO: 'DOCTORADO',
  MAESTRIA: 'MAESTRIA',
  ESPECIALIZACION: 'ESPECIALIZACION',
} as const;

export type NombrePosgrado = typeof NOMBRE_POSGRADO[keyof typeof NOMBRE_POSGRADO];

/** Orden jerárquico descendente: DOCTORADO > MAESTRIA > ESPECIALIZACION. */
export const JERARQUIA_POSGRADO: readonly NombrePosgrado[] = [
  NOMBRE_POSGRADO.DOCTORADO,
  NOMBRE_POSGRADO.MAESTRIA,
  NOMBRE_POSGRADO.ESPECIALIZACION,
];

@Injectable()
export class TipoPosgradoService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(soloActivos = true): Promise<TipoPosgradoDto[]> {
    return this.prisma.tipoPosgrado.findMany({
      where: soloActivos ? { activo: true } : undefined,
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      select: { id: true, nombre: true, activo: true },
    });
  }

  async obtenerPorNombre(nombre: string): Promise<TipoPosgradoDto | null> {
    return this.prisma.tipoPosgrado.findUnique({
      where: { nombre },
      select: { id: true, nombre: true, activo: true },
    });
  }

  async obtenerPorId(id: string): Promise<TipoPosgradoDto> {
    const tipo = await this.prisma.tipoPosgrado.findUnique({
      where: { id },
      select: { id: true, nombre: true, activo: true },
    });
    if (!tipo) throw new NotFoundException(`TipoPosgrado ${id} no encontrado`);
    return tipo;
  }

  /**
   * Resuelve el tipo de posgrado por FK.
   * Devuelve null cuando el FK es null (= no clasificado — ausencia de clasificación confiable).
   */
  async resolverTipoPorId(tipoPosgradoId: string | null): Promise<TipoPosgradoDto | null> {
    if (!tipoPosgradoId) return null;
    return this.obtenerPorId(tipoPosgradoId);
  }
}
