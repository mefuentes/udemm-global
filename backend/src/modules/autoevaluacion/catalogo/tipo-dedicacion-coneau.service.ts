import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface TipoDedicacionConeauDto {
  id: string;
  nombre: string;
  codigo: string;
  activo: boolean;
}

/** Códigos canónicos del catálogo CONEAU de dedicación. */
export const CODIGO_DEDICACION_CONEAU = {
  EXCLUSIVA: 'EXCLUSIVA',
  SEMIEXCLUSIVA: 'SEMIEXCLUSIVA',
  SIMPLE: 'SIMPLE',
} as const;

export type CodigoDedicacionConeau = typeof CODIGO_DEDICACION_CONEAU[keyof typeof CODIGO_DEDICACION_CONEAU];

@Injectable()
export class TipoDedicacionConeauService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(soloActivos = true): Promise<TipoDedicacionConeauDto[]> {
    return this.prisma.tipoDedicacionConeau.findMany({
      where: soloActivos ? { activo: true } : undefined,
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      select: { id: true, nombre: true, codigo: true, activo: true },
    });
  }

  async obtenerPorCodigo(codigo: string): Promise<TipoDedicacionConeauDto | null> {
    return this.prisma.tipoDedicacionConeau.findUnique({
      where: { codigo },
      select: { id: true, nombre: true, codigo: true, activo: true },
    });
  }

  async obtenerPorId(id: string): Promise<TipoDedicacionConeauDto> {
    const tipo = await this.prisma.tipoDedicacionConeau.findUnique({
      where: { id },
      select: { id: true, nombre: true, codigo: true, activo: true },
    });
    if (!tipo) throw new NotFoundException(`TipoDedicacionConeau ${id} no encontrado`);
    return tipo;
  }

  /**
   * Resuelve el tipo de dedicación por FK.
   * Devuelve null cuando el FK es null (= NO_DETERMINADA — ausencia de clasificación confiable).
   */
  async resolverTipoPorId(tipoDedicacionConeauId: string | null): Promise<TipoDedicacionConeauDto | null> {
    if (!tipoDedicacionConeauId) return null;
    return this.obtenerPorId(tipoDedicacionConeauId);
  }
}
