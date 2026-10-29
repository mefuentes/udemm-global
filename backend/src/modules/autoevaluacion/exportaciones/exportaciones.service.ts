import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

import { AnalisisService }   from '../analisis/analisis.service';
import type { AmbitoAnalisis } from '../analisis/analisis.dto';
import type { EstadoCalculo }  from '../types/estado-calculo.types';
import { extraerAlertas }    from '../alertas/alertas.extractor';

import type { SnapshotExport } from './exportaciones.types';
import { generarPdfBuffer }   from './pdf.generator';
import { generarExcelBuffer } from './excel.generator';

const ROLES_MODAUT = new Set([
  'ADMINISTRADOR_SISTEMA',
  'SECRETARIA_ACADEMICA',
  'RECTORADO',
  'DECANO',
  'DIRECTOR_CARRERA',
]);

@Injectable()
export class ExportacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analisis: AnalisisService,
  ) {}

  // ── API pública ───────────────────────────────────────────────────────────────

  async exportarPorEjecucion(
    ejecucionId: string,
    formato: 'pdf' | 'xlsx',
    rolNombre: string,
    usuarioId: string,
  ): Promise<{ buffer: Buffer; filename: string; mime: string }> {
    this._checkRol(rolNombre);
    const data = await this._obtenerDatosPorEjecucion(ejecucionId, rolNombre, usuarioId);
    return this._generarArchivo(data, formato);
  }

  async exportarPorEntidad(
    ambito: AmbitoAnalisis,
    entidadId: string,
    formato: 'pdf' | 'xlsx',
    rolNombre: string,
    usuarioId: string,
  ): Promise<{ buffer: Buffer; filename: string; mime: string }> {
    this._checkRol(rolNombre);
    const data = await this._obtenerDatosPorEntidad(ambito, entidadId, rolNombre, usuarioId);
    return this._generarArchivo(data, formato);
  }

  // ── Obtención de datos ────────────────────────────────────────────────────────

  private async _obtenerDatosPorEjecucion(
    ejecucionId: string,
    rolNombre: string,
    usuarioId: string,
  ): Promise<SnapshotExport> {
    // Scope check (throws ForbiddenException / NotFoundException if not authorized)
    await this.analisis.obtenerDetalle(ejecucionId, rolNombre, usuarioId);

    const reg = await (this.prisma as any).analisisEjecucion.findUnique({
      where: { id: ejecucionId },
    });
    if (!reg) throw new NotFoundException('Ejecución no encontrada');
    if (!reg.snapshot) throw new NotFoundException('La ejecución no tiene snapshot disponible');

    return this._buildSnapshotExport(reg);
  }

  private async _obtenerDatosPorEntidad(
    ambito: AmbitoAnalisis,
    entidadId: string,
    rolNombre: string,
    usuarioId: string,
  ): Promise<SnapshotExport> {
    const ultima = await (this.prisma as any).analisisEjecucion.findFirst({
      where:   { ambito, entidadId, estado: 'COMPLETADO' },
      orderBy: { fechaInicio: 'desc' },
    });

    if (ultima?.snapshot) {
      // Scope check against the found execution
      await this.analisis.obtenerDetalle(ultima.id, rolNombre, usuarioId);
      return this._buildSnapshotExport(ultima);
    }

    // No completed execution — trigger one now
    let ejecucionId: string;
    if (ambito === 'FACULTAD') {
      const r = await this.analisis.ejecutarFacultad(entidadId, usuarioId, rolNombre);
      ejecucionId = r.metadata.ejecucionId;
    } else if (ambito === 'CARRERA') {
      const r = await this.analisis.ejecutarCarrera(entidadId, usuarioId, rolNombre);
      ejecucionId = r.metadata.ejecucionId;
    } else {
      const r = await this.analisis.ejecutarPlan(entidadId, usuarioId, rolNombre);
      ejecucionId = r.metadata.ejecucionId;
    }

    const nueva = await (this.prisma as any).analisisEjecucion.findUnique({
      where: { id: ejecucionId },
    });
    if (!nueva?.snapshot) {
      throw new InternalServerErrorException('No se pudo obtener el snapshot tras la ejecución');
    }
    return this._buildSnapshotExport(nueva);
  }

  // ── Construcción del objeto exportable ────────────────────────────────────────

  private async _buildSnapshotExport(reg: {
    id: string;
    ambito: string;
    entidadId: string;
    facultadId: string;
    usuarioId: string;
    fechaFin: Date | null;
    snapshot: unknown;
  }): Promise<SnapshotExport> {
    const snap          = (reg.snapshot ?? {}) as Record<string, unknown>;
    const estadoCalculo = (snap['estadoGeneralCalculo'] as EstadoCalculo | null) ?? null;
    const fechaEjecucion = reg.fechaFin?.toISOString() ?? new Date().toISOString();
    const meta = await this._obtenerMetadataEntidad(reg.ambito as AmbitoAnalisis, reg.entidadId);

    const alertas = extraerAlertas(
      reg.snapshot,
      reg.ambito as AmbitoAnalisis,
      reg.entidadId,
      reg.facultadId,
      reg.id,
      fechaEjecucion,
      estadoCalculo,
    );

    return {
      ejecucionId:    reg.id,
      ambito:         reg.ambito as AmbitoAnalisis,
      entidadId:      reg.entidadId,
      entidadNombre:  meta.entidadNombre,
      carreraNombre:  meta.carreraNombre,
      facultadNombre: meta.facultadNombre,
      facultadId:     reg.facultadId,
      usuarioId:      reg.usuarioId,
      fechaEjecucion,
      estadoCalculo,
      snapshot: snap,
      alertas,
    };
  }

  private async _obtenerMetadataEntidad(
    ambito: AmbitoAnalisis,
    entidadId: string,
  ): Promise<{ entidadNombre: string; carreraNombre?: string; facultadNombre?: string }> {
    try {
      if (ambito === 'FACULTAD') {
        const f = await (this.prisma as any).facultad.findUnique({
          where: { id: entidadId },
          select: { nombre: true },
        });
        return { entidadNombre: f?.nombre ?? entidadId };
      }
      if (ambito === 'CARRERA') {
        const c = await (this.prisma as any).carrera.findUnique({
          where: { id: entidadId },
          select: { nombre: true, facultad: { select: { nombre: true } } },
        });
        return {
          entidadNombre:  c?.nombre             ?? entidadId,
          facultadNombre: c?.facultad?.nombre,
        };
      }
      // PLAN scope
      const p = await (this.prisma as any).planEstudio.findUnique({
        where: { id: entidadId },
        select: {
          nombre:  true,
          carrera: { select: { nombre: true, facultad: { select: { nombre: true } } } },
        },
      });
      return {
        entidadNombre:  p?.nombre                    ?? entidadId,
        carreraNombre:  p?.carrera?.nombre,
        facultadNombre: p?.carrera?.facultad?.nombre,
      };
    } catch {
      return { entidadNombre: entidadId };
    }
  }

  // ── Generación de archivos ────────────────────────────────────────────────────

  private async _generarArchivo(
    data: SnapshotExport,
    formato: 'pdf' | 'xlsx',
  ): Promise<{ buffer: Buffer; filename: string; mime: string }> {
    const slug      = data.entidadNombre.replace(/[^a-z0-9]/gi, '_').slice(0, 40);
    const fechaSlug = new Date(data.fechaEjecucion).toISOString().slice(0, 10).replace(/-/g, '');

    if (formato === 'pdf') {
      const buffer   = await generarPdfBuffer(data);
      const filename = `autoevaluacion_${data.ambito.toLowerCase()}_${slug}_${fechaSlug}.pdf`;
      return { buffer, filename, mime: 'application/pdf' };
    }

    const buffer   = await generarExcelBuffer(data);
    const filename = `autoevaluacion_${data.ambito.toLowerCase()}_${slug}_${fechaSlug}.xlsx`;
    return {
      buffer,
      filename,
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  private _checkRol(rolNombre: string): void {
    if (!ROLES_MODAUT.has(rolNombre)) {
      throw new ForbiddenException('Rol sin acceso al módulo de autoevaluación');
    }
  }
}
