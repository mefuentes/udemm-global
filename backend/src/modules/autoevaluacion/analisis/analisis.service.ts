import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ScopeService } from '../../scopes/scope.service';
import { TablroFacultadService } from '../tablero/tablero-facultad.service';
import { TablroCarreraService } from '../tablero/tablero-carrera.service';
import { TablroPlanService } from '../tablero/tablero-plan.service';
import type { EstadoCalculo } from '../types/estado-calculo.types';
import type {
  AmbitoAnalisis,
  DetalleEjecucion,
  HistorialAnalisis,
  ItemHistorial,
  ResultadoAnalisisCarrera,
  ResultadoAnalisisFacultad,
  ResultadoAnalisisPlan,
} from './analisis.dto';

const VERSION_FORMATO = '1';

const ROLES_MODAUT = new Set([
  'ADMINISTRADOR_SISTEMA',
  'SECRETARIA_ACADEMICA',
  'RECTORADO',
  'DECANO',
  'DIRECTOR_CARRERA',
]);

const ROLES_GLOBALES = new Set([
  'ADMINISTRADOR_SISTEMA',
  'SECRETARIA_ACADEMICA',
  'RECTORADO',
]);

const ROLES_FACULTAD = new Set([
  'ADMINISTRADOR_SISTEMA',
  'SECRETARIA_ACADEMICA',
  'RECTORADO',
  'DECANO',
]);

const POR_PAGINA_DEFAULT = 10;
const POR_PAGINA_MAX     = 50;

@Injectable()
export class AnalisisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly tableroFacultad: TablroFacultadService,
    private readonly tableroCarrera: TablroCarreraService,
    private readonly tableroPlan: TablroPlanService,
  ) {}

  // ── Ejecución por ámbito ──────────────────────────────────────────────────

  async ejecutarFacultad(
    facultadId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<ResultadoAnalisisFacultad> {
    if (!ROLES_FACULTAD.has(rolNombre)) {
      throw new ForbiddenException('Rol sin acceso al análisis de facultad');
    }

    const fechaInicio = new Date();
    let registro = await this.prisma.analisisEjecucion.create({
      data: {
        ambito: 'FACULTAD',
        entidadId: facultadId,
        facultadId,
        usuarioId,
        versionFormato: VERSION_FORMATO,
        fechaInicio,
        estado: 'EN_CURSO',
      },
    });

    try {
      const resultado = await this.tableroFacultad.consultarFacultad(facultadId, usuarioId, rolNombre);
      const fechaFin  = new Date();

      registro = await this.prisma.analisisEjecucion.update({
        where: { id: registro.id },
        data: {
          estado: 'COMPLETADO',
          fechaFin,
          snapshot: resultado as object,
        },
      });

      return {
        metadata: {
          ejecucionId: registro.id,
          ambito: 'FACULTAD',
          entidadId: facultadId,
          usuarioId,
          fechaEjecucion: registro.fechaFin!.toISOString(),
          estadoPersistencia: 'GUARDADO',
          estadoCalculo: resultado.estadoGeneralCalculo as EstadoCalculo,
        },
        resultado,
      };
    } catch (err) {
      await this.prisma.analisisEjecucion.update({
        where: { id: registro.id },
        data: {
          estado: 'ERROR',
          fechaFin: new Date(),
          errores: (err as Error).message ?? 'Error desconocido',
        },
      });
      throw err;
    }
  }

  async ejecutarCarrera(
    carreraId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<ResultadoAnalisisCarrera> {
    if (!ROLES_MODAUT.has(rolNombre)) {
      throw new ForbiddenException('Rol sin acceso al análisis de carrera');
    }

    const facultadId = await this._facultadDeCarrera(carreraId);
    const fechaInicio = new Date();
    let registro = await this.prisma.analisisEjecucion.create({
      data: {
        ambito: 'CARRERA',
        entidadId: carreraId,
        facultadId,
        usuarioId,
        versionFormato: VERSION_FORMATO,
        fechaInicio,
        estado: 'EN_CURSO',
      },
    });

    try {
      const resultado = await this.tableroCarrera.consultarCarrera(carreraId, usuarioId, rolNombre);
      const fechaFin  = new Date();

      registro = await this.prisma.analisisEjecucion.update({
        where: { id: registro.id },
        data: {
          estado: 'COMPLETADO',
          fechaFin,
          snapshot: resultado as object,
        },
      });

      return {
        metadata: {
          ejecucionId: registro.id,
          ambito: 'CARRERA',
          entidadId: carreraId,
          usuarioId,
          fechaEjecucion: registro.fechaFin!.toISOString(),
          estadoPersistencia: 'GUARDADO',
          estadoCalculo: resultado.estadoGeneralCalculo as EstadoCalculo,
        },
        resultado,
      };
    } catch (err) {
      await this.prisma.analisisEjecucion.update({
        where: { id: registro.id },
        data: {
          estado: 'ERROR',
          fechaFin: new Date(),
          errores: (err as Error).message ?? 'Error desconocido',
        },
      });
      throw err;
    }
  }

  async ejecutarPlan(
    planEstudioId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<ResultadoAnalisisPlan> {
    if (!ROLES_MODAUT.has(rolNombre)) {
      throw new ForbiddenException('Rol sin acceso al análisis de plan');
    }

    const facultadId = await this._facultadDePlan(planEstudioId);
    const fechaInicio = new Date();
    let registro = await this.prisma.analisisEjecucion.create({
      data: {
        ambito: 'PLAN',
        entidadId: planEstudioId,
        facultadId,
        usuarioId,
        versionFormato: VERSION_FORMATO,
        fechaInicio,
        estado: 'EN_CURSO',
      },
    });

    try {
      const resultado = await this.tableroPlan.consultarPlan(planEstudioId, usuarioId, rolNombre);
      const fechaFin  = new Date();

      registro = await this.prisma.analisisEjecucion.update({
        where: { id: registro.id },
        data: {
          estado: 'COMPLETADO',
          fechaFin,
          snapshot: resultado as object,
        },
      });

      return {
        metadata: {
          ejecucionId: registro.id,
          ambito: 'PLAN',
          entidadId: planEstudioId,
          usuarioId,
          fechaEjecucion: registro.fechaFin!.toISOString(),
          estadoPersistencia: 'GUARDADO',
          estadoCalculo: resultado.estadoGeneralCalculo as EstadoCalculo,
        },
        resultado,
      };
    } catch (err) {
      await this.prisma.analisisEjecucion.update({
        where: { id: registro.id },
        data: {
          estado: 'ERROR',
          fechaFin: new Date(),
          errores: (err as Error).message ?? 'Error desconocido',
        },
      });
      throw err;
    }
  }

  // ── Historial ─────────────────────────────────────────────────────────────

  async obtenerHistorialFacultad(
    facultadId: string,
    rolNombre: string,
    pagina = 1,
    porPagina = POR_PAGINA_DEFAULT,
  ): Promise<HistorialAnalisis> {
    if (!ROLES_FACULTAD.has(rolNombre)) {
      throw new ForbiddenException('Rol sin acceso al historial de facultad');
    }
    return this._historial('FACULTAD', facultadId, pagina, porPagina);
  }

  async obtenerHistorialCarrera(
    carreraId: string,
    rolNombre: string,
    pagina = 1,
    porPagina = POR_PAGINA_DEFAULT,
  ): Promise<HistorialAnalisis> {
    if (!ROLES_MODAUT.has(rolNombre)) {
      throw new ForbiddenException('Rol sin acceso al historial de carrera');
    }
    return this._historial('CARRERA', carreraId, pagina, porPagina);
  }

  async obtenerHistorialPlan(
    planEstudioId: string,
    rolNombre: string,
    pagina = 1,
    porPagina = POR_PAGINA_DEFAULT,
  ): Promise<HistorialAnalisis> {
    if (!ROLES_MODAUT.has(rolNombre)) {
      throw new ForbiddenException('Rol sin acceso al historial de plan');
    }
    return this._historial('PLAN', planEstudioId, pagina, porPagina);
  }

  // ── Detalle de ejecución ──────────────────────────────────────────────────

  async obtenerDetalle(ejecucionId: string, rolNombre: string, usuarioId: string): Promise<DetalleEjecucion> {
    if (!ROLES_MODAUT.has(rolNombre)) {
      throw new ForbiddenException('Rol sin acceso MOD-AUT');
    }
    const reg = await this.prisma.analisisEjecucion.findUnique({ where: { id: ejecucionId } });
    if (!reg) throw new NotFoundException('Ejecución no encontrada');

    await this._verificarScopeDetalle(reg, usuarioId, rolNombre);

    return {
      ejecucionId: reg.id,
      ambito: reg.ambito as AmbitoAnalisis,
      entidadId: reg.entidadId,
      usuarioId: reg.usuarioId,
      estadoEjecucion: reg.estado as 'COMPLETADO' | 'ERROR',
      estadoCalculo: reg.snapshot
        ? ((reg.snapshot as Record<string, unknown>).estadoGeneralCalculo as EstadoCalculo)
        : null,
      fechaInicio: reg.fechaInicio.toISOString(),
      fechaFin: reg.fechaFin?.toISOString() ?? null,
      errores: reg.errores ?? null,
      snapshot: reg.snapshot as DetalleEjecucion['snapshot'],
    };
  }

  private async _verificarScopeDetalle(
    reg: { ambito: string; entidadId: string; facultadId: string },
    usuarioId: string,
    rolNombre: string,
  ): Promise<void> {
    if (ROLES_GLOBALES.has(rolNombre)) return;

    if (rolNombre === 'DECANO') {
      const assoc = await this.prisma.usuarioFacultad.findFirst({
        where: { usuarioId },
        select: { facultadId: true },
      });
      if (!assoc || assoc.facultadId !== reg.facultadId) {
        throw new ForbiddenException('Acceso fuera del scope autorizado');
      }
      return;
    }

    if (rolNombre === 'DIRECTOR_CARRERA') {
      if (reg.ambito === 'FACULTAD') {
        throw new ForbiddenException('DIRECTOR_CARRERA no tiene acceso a análisis de facultad');
      }
      if (reg.ambito === 'CARRERA') {
        const carreraIds = await this.scope.getCarrerasEnScope(usuarioId, rolNombre);
        if (!carreraIds?.includes(reg.entidadId)) {
          throw new ForbiddenException('Acceso fuera del scope autorizado');
        }
        return;
      }
      if (reg.ambito === 'PLAN') {
        const plan = await this.prisma.planEstudio.findUnique({
          where: { id: reg.entidadId },
          select: { carreraId: true },
        });
        if (!plan) throw new NotFoundException('Plan no encontrado');
        const carreraIds = await this.scope.getCarrerasEnScope(usuarioId, rolNombre);
        if (!carreraIds?.includes(plan.carreraId)) {
          throw new ForbiddenException('Acceso fuera del scope autorizado');
        }
        return;
      }
    }

    throw new ForbiddenException('Acceso no autorizado');
  }

  // ── Helpers privados ──────────────────────────────────────────────────────

  private async _historial(
    ambito: AmbitoAnalisis,
    entidadId: string,
    pagina: number,
    porPagina: number,
  ): Promise<HistorialAnalisis> {
    const pp     = Math.min(Math.max(1, porPagina), POR_PAGINA_MAX);
    const pag    = Math.max(1, pagina);
    const skip   = (pag - 1) * pp;
    const where  = { ambito, entidadId, estado: { not: 'EN_CURSO' } };

    const [total, rows] = await Promise.all([
      this.prisma.analisisEjecucion.count({ where }),
      this.prisma.analisisEjecucion.findMany({
        where,
        orderBy: { fechaInicio: 'desc' },
        skip,
        take: pp,
        select: {
          id: true,
          fechaInicio: true,
          fechaFin: true,
          usuarioId: true,
          estado: true,
          errores: true,
          snapshot: true,
        },
      }),
    ]);

    const items: ItemHistorial[] = rows.map((r) => ({
      ejecucionId: r.id,
      fechaInicio: r.fechaInicio.toISOString(),
      fechaFin: r.fechaFin?.toISOString() ?? null,
      usuarioId: r.usuarioId,
      estadoEjecucion: r.estado as 'COMPLETADO' | 'ERROR',
      estadoCalculo: r.snapshot
        ? ((r.snapshot as Record<string, unknown>).estadoGeneralCalculo as EstadoCalculo)
        : null,
      errores: r.errores ?? null,
    }));

    return { ambito, entidadId, total, pagina: pag, porPagina: pp, items };
  }

  private async _facultadDeCarrera(carreraId: string): Promise<string> {
    const carrera = await this.prisma.carrera.findUnique({
      where: { id: carreraId },
      select: { facultadId: true },
    });
    if (!carrera) throw new NotFoundException(`Carrera ${carreraId} no encontrada`);
    return carrera.facultadId;
  }

  private async _facultadDePlan(planEstudioId: string): Promise<string> {
    const plan = await this.prisma.planEstudio.findUnique({
      where: { id: planEstudioId },
      select: { carrera: { select: { facultadId: true } } },
    });
    if (!plan) throw new NotFoundException(`Plan ${planEstudioId} no encontrado`);
    return plan.carrera.facultadId;
  }
}
