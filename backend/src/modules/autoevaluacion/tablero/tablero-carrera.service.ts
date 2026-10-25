import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ScopeService } from '../../scopes/scope.service';
import { IP09EvaluadorService } from '../indicadores/ip09.evaluador';
import { IP10EvaluadorService } from '../indicadores/ip10.evaluador';
import { R07EvaluadorService } from '../indicadores/r07.evaluador';
import { R10EvaluadorService } from '../indicadores/r10.evaluador';
import { R12EvaluadorService } from '../indicadores/r12.evaluador';
import { R15EvaluadorService } from '../indicadores/r15.evaluador';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type { ResultadoIP01, ResultadoIP02, ResultadoIP03, ResultadoIP04, ResultadoIP08, ResultadoIP09, ResultadoIP10, ResultadoIP13, ResultadoR10, ResultadoR12, TablroCarreraResponseDto } from './tablero-carrera.dto';

// ── Autorización ──────────────────────────────────────────────────────────────

const ROLES_MODAUT = new Set([
  'ADMINISTRADOR_SISTEMA',
  'SECRETARIA_ACADEMICA',
  'RECTORADO',
  'DECANO',
  'DIRECTOR_CARRERA',
]);

// ── Estado más restrictivo ────────────────────────────────────────────────────

const PESO_ESTADO: Record<EstadoCalculo, number> = {
  [EstadoCalculo.CALCULADO]: 1,
  [EstadoCalculo.NO_APLICA]: 2,
  [EstadoCalculo.PARCIAL]: 3,
  [EstadoCalculo.NO_DETERMINABLE]: 4,
};

function estadoMasRestrictivo(...estados: EstadoCalculo[]): EstadoCalculo {
  return estados.reduce((a, b) => (PESO_ESTADO[b] > PESO_ESTADO[a] ? b : a));
}

// ── Clasificación de cargos (FSD §7, IP-08) ───────────────────────────────────

/**
 * Categorías CONEAU reconocidas por el FSD para el cálculo P/A.
 * Los nombres se normalizan a mayúsculas antes de comparar.
 */
const CARGOS_PROFESOR = new Set([
  'TITULAR',
  'PROFESOR TITULAR',
  'ASOCIADO',
  'PROFESOR ASOCIADO',
  'ADJUNTO',
  'PROFESOR ADJUNTO',
]);

const CARGOS_AUXILIAR = new Set([
  'JTP',
  'JEFE DE TRABAJOS PRÁCTICOS',
  'JEFE DE TRABAJOS PRACTICOS',
  'AYUDANTE GRADUADO',
  'AYUDANTE NO GRADUADO',
]);

function categorizarCargo(nombre: string): 'P' | 'A' | null {
  const n = nombre.trim().toUpperCase();
  if (CARGOS_PROFESOR.has(n)) return 'P';
  if (CARGOS_AUXILIAR.has(n)) return 'A';
  return null;
}

// ── Servicio ──────────────────────────────────────────────────────────────────

/**
 * Calcula IP-01 (Docentes vigentes), IP-02 (Cargos docentes vigentes),
 * IP-03 (Materias cubiertas) e IP-08 (Relación profesores/auxiliares)
 * para el plantel de una carrera según FSD §7.
 *
 * Autorización: rol verificado localmente + scope territorial delegado a ScopeService.
 * Defensa en profundidad: la verificación de scope está tanto en el controlador
 * (vía RolesGuard) como en este servicio.
 */
@Injectable()
export class TablroCarreraService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly r15: R15EvaluadorService,
    private readonly r07: R07EvaluadorService,
    private readonly ip09: IP09EvaluadorService,
    private readonly ip10: IP10EvaluadorService,
    private readonly r12: R12EvaluadorService,
    private readonly r10: R10EvaluadorService,
  ) {}

  async consultarCarrera(
    carreraId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<TablroCarreraResponseDto> {
    if (!ROLES_MODAUT.has(rolNombre)) {
      throw new ForbiddenException('Rol sin acceso a MOD-AUT');
    }

    const carrera = await this.prisma.carrera.findUnique({
      where: { id: carreraId },
      select: { id: true },
    });
    if (!carrera) throw new NotFoundException(`Carrera ${carreraId} no encontrada`);

    const tieneScope = await this.scope.tieneScopeCarrera(usuarioId, rolNombre, carreraId);
    if (!tieneScope) throw new ForbiddenException();

    const fechaEvaluacion = new Date();
    const [ip01, ip02, ip03, ip08, ip04, ip09, ip10, ip13, r10, r12] = await Promise.all([
      this.calcularIP01(carreraId),
      this.calcularIP02(carreraId),
      this.calcularIP03(carreraId),
      this.calcularIP08(carreraId),
      this.calcularIP04(carreraId, usuarioId, rolNombre, fechaEvaluacion),
      this.calcularIP09(carreraId),
      this.calcularIP10(carreraId, usuarioId, rolNombre, fechaEvaluacion),
      this.calcularIP13(carreraId, usuarioId, rolNombre, fechaEvaluacion),
      this.calcularR10(carreraId, usuarioId, rolNombre, fechaEvaluacion),
      this.calcularR12(carreraId, usuarioId, rolNombre, fechaEvaluacion),
    ]);

    return {
      carreraId,
      fechaEvaluacion: fechaEvaluacion.toISOString(),
      ip01,
      ip02,
      ip03,
      ip04,
      ip08,
      ip09,
      ip10,
      ip13,
      r10,
      r12,
      estadoGeneralCalculo: estadoMasRestrictivo(
        ip01.estadoCalculo, ip02.estadoCalculo,
        ip03.estadoCalculo, ip04.estadoCalculo, ip08.estadoCalculo,
        ip09.estadoCalculo, ip10.estadoCalculo, ip13.estadoCalculo,
        r10.estadoCalculo, r12.estadoCalculo,
      ),
    };
  }

  /**
   * IP-01: Docentes vigentes.
   * COUNT DISTINCT docenteId con estado='APROBADA' y docente.activo=true.
   */
  private async calcularIP01(carreraId: string): Promise<ResultadoIP01> {
    const docentes = await this.prisma.vinculacionCatedra.findMany({
      where: { carreraId, estado: 'APROBADA', docente: { activo: true } },
      select: { docenteId: true },
      distinct: ['docenteId'],
    });

    if (docentes.length === 0) {
      return { total: 0, estadoCalculo: EstadoCalculo.NO_APLICA };
    }

    return { total: docentes.length, estadoCalculo: EstadoCalculo.CALCULADO };
  }

  /**
   * IP-02: Cargos docentes vigentes.
   * COUNT DISTINCT (docenteId, cargoId) con estado='APROBADA', docente.activo=true.
   * Excluye cargos de gestión («Otros»): solo categorías P y A según CONEAU (FSD §7).
   */
  private async calcularIP02(carreraId: string): Promise<ResultadoIP02> {
    const cargos = await this.prisma.vinculacionCatedra.findMany({
      where: { carreraId, estado: 'APROBADA', docente: { activo: true } },
      select: {
        docenteId: true,
        cargoId: true,
        cargo: { select: { nombre: true } },
      },
      distinct: ['docenteId', 'cargoId'],
    });

    const total = cargos.filter((c) => categorizarCargo(c.cargo.nombre) !== null).length;

    if (total === 0) {
      return { total: 0, estadoCalculo: EstadoCalculo.NO_APLICA };
    }

    return { total, estadoCalculo: EstadoCalculo.CALCULADO };
  }

  /**
   * IP-03: Materias cubiertas.
   *
   * Total = todas las materias en planes de la carrera (sin filtro de estado de materia,
   * consistente con R-08 que evalúa todas las materias del plan).
   * Cubiertas = distintos materiaId con ≥1 VinculacionCatedra estado='APROBADA'.
   */
  private async calcularIP03(carreraId: string): Promise<ResultadoIP03> {
    const planes = await this.prisma.planEstudio.findMany({
      where: { carreraId },
      select: { id: true },
    });

    if (planes.length === 0) {
      return { cubiertas: 0, total: 0, estadoCalculo: EstadoCalculo.NO_APLICA };
    }

    const planIds = planes.map((p) => p.id);

    const [totalMaterias, materiasCubiertas] = await Promise.all([
      this.prisma.materia.count({ where: { planEstudioId: { in: planIds } } }),
      this.prisma.vinculacionCatedra.findMany({
        where: { carreraId, estado: 'APROBADA' },
        select: { materiaId: true },
        distinct: ['materiaId'],
      }),
    ]);

    if (totalMaterias === 0) {
      return { cubiertas: 0, total: 0, estadoCalculo: EstadoCalculo.NO_APLICA };
    }

    return {
      cubiertas: materiasCubiertas.length,
      total: totalMaterias,
      estadoCalculo: EstadoCalculo.CALCULADO,
    };
  }

  /**
   * IP-04 / R-15: Materias por docente (FSD §7, §5.3).
   *
   * Delega en R15EvaluadorService que evalúa la carrera seleccionada sin extensión
   * cross-carrera:
   * - Universo: docentes con ≥1 vinculación APROBADA y activo=true en la carrera.
   * - Deduplicación: distinct materiaId por docenteId.
   * - Estadísticas: mediana (principal), promedio, máximo.
   * - Alertas: docentes con nMaterias > p03MaxMat (limite).
   *
   * estadoCalculo: NO_DETERMINABLE si config no existe, NO_APLICA si sin docentes,
   * CALCULADO si evaluación completa.
   */
  private async calcularIP04(
    carreraId: string,
    usuarioId: string,
    rolNombre: string,
    fechaEvaluacion: Date,
  ): Promise<ResultadoIP04> {
    const resultado = await this.r15.evaluar({ carreraId, usuarioId, rolNombre, fechaEvaluacion });
    const v = resultado.valor!;
    return {
      totalDocentes: v.totalDocentes,
      mediana: v.mediana,
      promedio: v.promedio,
      maximo: v.maximo,
      distribucion: v.distribucion,
      limite: v.limite,
      totalEnAlerta: v.totalEnAlerta,
      enAlerta: v.enAlerta,
      estadoCalculo: resultado.estadoCalculo ?? EstadoCalculo.NO_DETERMINABLE,
    };
  }

  /**
   * R-10: Docentes con baja dedicación horaria (FSD §5.3).
   *
   * Delega en R10EvaluadorService: compara horas semanales de docencia conocidas
   * contra el umbral p02BajaH (default 20h).
   * Alertas INFORMATIVAS: no penalizan el score de IP-10.
   */
  private async calcularR10(
    carreraId: string,
    usuarioId: string,
    rolNombre: string,
    fechaEvaluacion: Date,
  ): Promise<ResultadoR10> {
    const resultado = await this.r10.evaluar({ carreraId, usuarioId, rolNombre, fechaEvaluacion });
    const v = resultado.valor!;
    return {
      carreraId: v.carreraId,
      umbral: v.umbral,
      totalDocentes: v.totalDocentes,
      totalEnAlerta: v.totalEnAlerta,
      totalInciertos: v.totalInciertos,
      enAlerta: v.enAlerta,
      alcanceFacultad: v.alcanceFacultad,
      estadoCalculo: resultado.estadoCalculo ?? EstadoCalculo.NO_DETERMINABLE,
    };
  }

  /**
   * IP-13: Docentes sobreasignados (FSD MOD-AUT §3.3 y §5.3).
   *
   * Delega en R07EvaluadorService, que evalúa el plantel completo de la facultad
   * para roles con alcance suficiente (ADMIN/SECRETARIA/RECTORADO/DECANO), o
   * solo la carrera solicitada para DIRECTOR_CARRERA (→ PARCIAL).
   *
   * Condición de sobreasignación: nMaterias > P-03 (comparación estricta).
   * Unidad de conteo: combinaciones distintas (planEstudioId, materiaId, catedraId).
   *
   * El estado de IP-13 participa en estadoGeneralCalculo. PARCIAL indica evaluación
   * incompleta (no implica incumplimiento académico definitivo).
   */
  private async calcularIP13(
    carreraId: string,
    usuarioId: string,
    rolNombre: string,
    fechaEvaluacion: Date,
  ): Promise<ResultadoIP13> {
    const resultado = await this.r07.evaluar({ carreraId, usuarioId, rolNombre, fechaEvaluacion });
    const v = resultado.valor!;
    return {
      limite: v.limite,
      totalDocentes: v.totalDocentes,
      totalSobreasignados: v.totalSobreasignados,
      sobreasignados: v.sobreasignados.map((d) => ({
        docenteId: d.docenteId,
        nombre: d.nombre,
        nMaterias: d.nMaterias,
        exceso: d.exceso,
      })),
      totalNoDeterminables: v.totalNoDeterminables,
      alcanceFacultad: v.alcanceFacultad,
      estadoCalculo: resultado.estadoCalculo ?? EstadoCalculo.NO_DETERMINABLE,
    };
  }

  /**
   * IP-09: Completitud promedio del plantel (FSD §6.3).
   * Delega en IP09EvaluadorService: round(mean(25×(C1+C2+C3+C4))) por docente vigente.
   */
  private async calcularIP09(carreraId: string): Promise<ResultadoIP09> {
    return this.ip09.evaluarParaCarrera(carreraId);
  }

  /**
   * IP-10: Consistencia del plantel docente (FSD MOD-AUT §5).
   * Fórmula: max(0, 100 − 25×A − 10×M).
   *   A = R-03 ALTA + R-04 ALTA no exceptuadas por C4.
   *   M = R-07 MEDIA (sobreasignados).
   */
  private async calcularIP10(
    carreraId: string,
    usuarioId: string,
    rolNombre: string,
    fechaEvaluacion: Date,
  ): Promise<ResultadoIP10> {
    return this.ip10.evaluarParaCarrera(carreraId, usuarioId, rolNombre, fechaEvaluacion);
  }

  /**
   * R-12: Campos obligatorios faltantes en la ficha docente (FSD MOD-AUT §3.1).
   *
   * Delega en R12EvaluadorService: evalúa personales, formacionGrado y areaDesempeno
   * para todos los docentes activos con vinculación APROBADA en la carrera.
   */
  private async calcularR12(
    carreraId: string,
    usuarioId: string,
    rolNombre: string,
    fechaEvaluacion: Date,
  ): Promise<ResultadoR12> {
    const resultado = await this.r12.evaluar({ carreraId, usuarioId, rolNombre, fechaEvaluacion });
    const v = resultado.valor!;
    return {
      carreraId: v.carreraId,
      facultadId: v.facultadId,
      totalDocentes: v.totalDocentes,
      totalIncompletos: v.totalIncompletos,
      incompletos: v.incompletos,
      totalNoDeterminables: v.totalNoDeterminables,
      noDeterminables: v.noDeterminables,
      alcanceFacultad: v.alcanceFacultad,
      estadoCalculo: resultado.estadoCalculo ?? EstadoCalculo.NO_DETERMINABLE,
    };
  }

  /**
   * IP-08: Relación profesores / auxiliares.
   *
   * Unidad: par (docenteId, cargoId) distinto con estado='APROBADA' en la carrera.
   * Clasificación: según CARGOS_PROFESOR y CARGOS_AUXILIAR (categorías CONEAU).
   * Cargos no clasificables → «Otros», no se cuentan.
   */
  private async calcularIP08(carreraId: string): Promise<ResultadoIP08> {
    const cargosVigentes = await this.prisma.vinculacionCatedra.findMany({
      where: { carreraId, estado: 'APROBADA' },
      select: {
        docenteId: true,
        cargoId: true,
        cargo: { select: { nombre: true } },
      },
      distinct: ['docenteId', 'cargoId'],
    });

    if (cargosVigentes.length === 0) {
      return { profesores: 0, auxiliares: 0, ratio: null, estadoCalculo: EstadoCalculo.NO_APLICA };
    }

    let profesores = 0;
    let auxiliares = 0;
    for (const c of cargosVigentes) {
      const cat = categorizarCargo(c.cargo.nombre);
      if (cat === 'P') profesores++;
      else if (cat === 'A') auxiliares++;
    }

    const ratio =
      auxiliares === 0 ? null : Math.round((profesores / auxiliares) * 10) / 10;

    return {
      profesores,
      auxiliares,
      ratio,
      estadoCalculo: EstadoCalculo.CALCULADO,
    };
  }
}
