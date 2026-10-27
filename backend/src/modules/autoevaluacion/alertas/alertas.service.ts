import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ScopeService } from '../../scopes/scope.service';
import type { AmbitoAnalisis } from '../analisis/analisis.dto';
import type { EstadoCalculo } from '../types/estado-calculo.types';
import type { AlertaBandeja, FiltrosBandeja, GrupoAmbitoAlerta, RespuestaBandeja } from './alertas.dto';
import { extraerAlertas } from './alertas.extractor';

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

const ORDEN_PRIORIDAD: Record<string, number> = { ALTA: 0, MEDIA: 1, INFORMATIVA: 2 };

const REGLAS_GRUPO: Record<GrupoAmbitoAlerta, Set<string>> = {
  DOCENTES: new Set(['R-03', 'R-07', 'R-10', 'R-12', 'IP-13']),
  PLANES:   new Set(['IPL-01', 'IPL-02', 'IP-03']),
  CRUZADAS: new Set(['IPL-03', 'IPL-04']),
};

const POR_PAGINA_DEFAULT = 20;
const POR_PAGINA_MAX     = 100;

@Injectable()
export class AlertasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
  ) {}

  /**
   * Retorna la bandeja de alertas vigentes para el usuario.
   *
   * Criterio de vigencia: se toma la ejecución COMPLETADO más reciente por
   * (ambito, entidadId) dentro del scope del usuario. Las ejecuciones históricas
   * anteriores no generan alertas duplicadas.
   *
   * Las alertas se extraen únicamente de snapshots persistidos.
   * No se ejecutan evaluadores en esta operación.
   */
  async obtenerBandeja(
    usuarioId: string,
    rolNombre: string,
    pagina = 1,
    porPagina = POR_PAGINA_DEFAULT,
    filtros: FiltrosBandeja = {},
  ): Promise<RespuestaBandeja> {
    if (!ROLES_MODAUT.has(rolNombre)) {
      throw new ForbiddenException('Rol sin acceso a la bandeja de alertas');
    }

    const pp  = Math.min(Math.max(1, porPagina), POR_PAGINA_MAX);
    const pag = Math.max(1, pagina);

    const whereScope = await this._buildScopeWhere(usuarioId, rolNombre);
    if (whereScope === null) {
      return { total: 0, pagina: pag, porPagina: pp, tieneAnalisis: false, items: [] };
    }

    const ejecuciones = await this.prisma.analisisEjecucion.findMany({
      where: { estado: 'COMPLETADO', ...whereScope },
      orderBy: { fechaInicio: 'desc' },
      select: {
        id:          true,
        ambito:      true,
        entidadId:   true,
        facultadId:  true,
        fechaFin:    true,
        snapshot:    true,
      },
    });

    // Deduplicate: keep only the most recent completed execution per (ambito, entidadId)
    const seen = new Set<string>();
    const vigentes = ejecuciones.filter(e => {
      const key = `${e.ambito}:${e.entidadId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Extract alerts from each snapshot
    let todasAlertas: AlertaBandeja[] = [];
    for (const e of vigentes) {
      const fechaEjecucion = e.fechaFin?.toISOString() ?? '';
      const estadoCalculo  = e.snapshot
        ? ((e.snapshot as Record<string, unknown>)['estadoGeneralCalculo'] as EstadoCalculo | null)
        : null;
      const alertas = extraerAlertas(
        e.snapshot,
        e.ambito as AmbitoAnalisis,
        e.entidadId,
        e.facultadId,
        e.id,
        fechaEjecucion,
        estadoCalculo,
      );
      todasAlertas = todasAlertas.concat(alertas);
    }

    // Apply filters
    if (filtros.ambito)      todasAlertas = todasAlertas.filter(a => a.ambito    === filtros.ambito);
    if (filtros.grupoAmbito) {
      const reglas = REGLAS_GRUPO[filtros.grupoAmbito];
      todasAlertas = todasAlertas.filter(a => reglas.has(a.regla));
    }
    if (filtros.prioridad)   todasAlertas = todasAlertas.filter(a => a.prioridad === filtros.prioridad);
    if (filtros.regla)       todasAlertas = todasAlertas.filter(a => a.regla     === filtros.regla);

    // Sort ALTA > MEDIA > INFORMATIVA, then by fechaEjecucion desc
    todasAlertas.sort((a, b) => {
      const pd = (ORDEN_PRIORIDAD[a.prioridad] ?? 3) - (ORDEN_PRIORIDAD[b.prioridad] ?? 3);
      if (pd !== 0) return pd;
      return b.fechaEjecucion.localeCompare(a.fechaEjecucion);
    });

    const total        = todasAlertas.length;
    const items        = todasAlertas.slice((pag - 1) * pp, pag * pp);
    const tieneAnalisis = vigentes.length > 0;

    return { total, pagina: pag, porPagina: pp, tieneAnalisis, items };
  }

  /**
   * Builds a Prisma `where` clause that restricts ejecuciones to the user's scope.
   * Returns null when the user has no scope (empty result expected).
   * Returns {} for global roles (no restriction).
   */
  private async _buildScopeWhere(
    usuarioId: string,
    rolNombre: string,
  ): Promise<Record<string, unknown> | null> {
    if (ROLES_GLOBALES.has(rolNombre)) return {};

    if (rolNombre === 'DECANO') {
      const assoc = await this.prisma.usuarioFacultad.findFirst({
        where: { usuarioId },
        select: { facultadId: true },
      });
      if (!assoc) return null;
      return { facultadId: assoc.facultadId };
    }

    if (rolNombre === 'DIRECTOR_CARRERA') {
      const carreraIds = (await this.scope.getCarrerasEnScope(usuarioId, rolNombre)) ?? [];
      if (carreraIds.length === 0) return null;

      const planes = await this.prisma.planEstudio.findMany({
        where: { carreraId: { in: carreraIds } },
        select: { id: true },
      });
      const planIds = planes.map(p => p.id);

      const orConditions: Record<string, unknown>[] = [
        { ambito: 'CARRERA', entidadId: { in: carreraIds } },
      ];
      if (planIds.length > 0) {
        orConditions.push({ ambito: 'PLAN', entidadId: { in: planIds } });
      }
      return { OR: orConditions };
    }

    return null;
  }
}
