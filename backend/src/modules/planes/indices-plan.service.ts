import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IndicadoresService } from '../autoevaluacion/indicadores/indicadores.service';
import { EstadoCalculo } from '../autoevaluacion/types/estado-calculo.types';
import type { ResultadoR09 } from '../autoevaluacion/indicadores/r09.evaluador';
import type { ResultadoR13 } from '../autoevaluacion/indicadores/r13.evaluador';
import type { ResultadoR14 } from '../autoevaluacion/indicadores/r14.evaluador';
import type { ResultadoIndicador } from '../autoevaluacion/indicadores/indicadores.types';

// ── DTOs de respuesta ─────────────────────────────────────────────────────────

export interface CompletitudPlan {
  /** Avance promedio de programas (0–100). null = plan sin asignaturas. */
  ap: number | null;
  /** Porcentaje de asignaturas con responsable vigente (0–100). null = plan sin asignaturas. */
  rc: number | null;
  /** Completitud = (AP + RC) / 2. null = plan sin asignaturas. */
  valor: number | null;
  totalMaterias: number;
  materiasSinPrograma: number;
  materiasConResponsable: number;
  estadoCalculo: EstadoCalculo;
}

export interface ConsistenciaPlan {
  /** Número de alertas ALTA (R-09 + R-13). null si no pudo evaluarse. */
  aa: number | null;
  /** Número de alertas MEDIA (R-14). null si no pudo evaluarse. */
  am: number | null;
  /** max(0, 100 - 25*AA - 10*AM). null si no pudo evaluarse. */
  valor: number | null;
  estadoCalculo: EstadoCalculo;
}

export interface IndicesPlanResponseDto {
  planEstudioId: string;
  completitud: CompletitudPlan;
  consistencia: ConsistenciaPlan;
}

// ── Servicio ──────────────────────────────────────────────────────────────────

@Injectable()
export class IndicesPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly indicadores: IndicadoresService,
  ) {}

  async calcular(
    planEstudioId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<IndicesPlanResponseDto> {
    // Verificar que el plan existe
    const plan = await this.prisma.planEstudio.findUnique({
      where: { id: planEstudioId },
      select: { id: true },
    });
    if (!plan) throw new NotFoundException(`Plan de estudios ${planEstudioId} no encontrado`);

    const [completitud, consistencia] = await Promise.all([
      this.calcularCompletitud(planEstudioId),
      this.calcularConsistencia(planEstudioId, usuarioId, rolNombre),
    ]);

    return { planEstudioId, completitud, consistencia };
  }

  // ── AP y RC (acceso directo a Prisma, sin restricciones de rol) ───────────

  private async calcularCompletitud(planEstudioId: string): Promise<CompletitudPlan> {
    // 1. Materias del plan
    const materias = await this.prisma.materia.findMany({
      where:  { planEstudioId, estado: 'ACTIVO' },
      select: { id: true },
    });

    const totalMaterias = materias.length;

    if (totalMaterias === 0) {
      return {
        ap: null, rc: null, valor: null,
        totalMaterias: 0, materiasSinPrograma: 0, materiasConResponsable: 0,
        estadoCalculo: EstadoCalculo.NO_APLICA,
      };
    }

    const materiaIds = materias.map(m => m.id);

    // 2. Programas existentes para esas materias
    const programas = await this.prisma.programaAsignatura.findMany({
      where:  { materiaId: { in: materiaIds } },
      select: {
        materiaId: true,
        estadoS1: true, estadoS2: true, estadoS3: true,
        estadoS4: true, estadoS5: true, estadoS6: true,
      },
    });

    // Indexar por materiaId (1 programa por materia)
    const programaPorMateria = new Map(programas.map(p => [p.materiaId, p]));

    // 3. AP: promedio de avance sobre TODAS las materias (sin programa → 0%)
    const TOTAL_SECCIONES = 6;
    let sumaAvance = 0;
    let materiasSinPrograma = 0;

    for (const { id } of materias) {
      const prog = programaPorMateria.get(id);
      if (!prog) {
        materiasSinPrograma++;
        // avance 0 para esta materia (ya incluido implícitamente en sumaAvance=0)
      } else {
        // Usar los estados almacenados (calculados en el último guardado del programa)
        const completas = [prog.estadoS1, prog.estadoS2, prog.estadoS3, prog.estadoS4, prog.estadoS5, prog.estadoS6]
          .filter(s => s === 'COMPLETO').length;
        sumaAvance += Math.round((completas / TOTAL_SECCIONES) * 100);
      }
    }

    const ap = Math.round(sumaAvance / totalMaterias);

    // 4. RC: porcentaje de materias con responsable de cátedra vigente
    const vinculaciones = await this.prisma.vinculacionCatedra.findMany({
      where: {
        materiaId:           { in: materiaIds },
        esResponsableCatedra: true,
        estado:              'APROBADA',
      },
      select: { materiaId: true },
    });

    // Deduplicar por materiaId (una asignatura cuenta una sola vez)
    const materiasConResponsable = new Set(vinculaciones.map(v => v.materiaId)).size;
    const rc = Math.round((materiasConResponsable / totalMaterias) * 100);

    const valor = Math.round((ap + rc) / 2);

    return {
      ap, rc, valor,
      totalMaterias, materiasSinPrograma, materiasConResponsable,
      estadoCalculo: EstadoCalculo.CALCULADO,
    };
  }

  // ── AA y AM (vía IndicadoresService — requiere rol MODAUT) ───────────────

  private async calcularConsistencia(
    planEstudioId: string,
    usuarioId:     string,
    rolNombre:     string,
  ): Promise<ConsistenciaPlan> {
    const contexto = {
      usuarioId,
      rolNombre,
      planEstudioId,
      fechaEvaluacion: new Date(),
    };

    let r09: ResultadoIndicador<ResultadoR09> | null = null;
    let r13: ResultadoIndicador<ResultadoR13> | null = null;
    let r14: ResultadoIndicador<ResultadoR14> | null = null;

    try {
      [r09, r13, r14] = await Promise.all([
        this.indicadores.evaluar({ codigoIndicador: 'R-09', contexto }) as Promise<ResultadoIndicador<ResultadoR09>>,
        this.indicadores.evaluar({ codigoIndicador: 'R-13', contexto }) as Promise<ResultadoIndicador<ResultadoR13>>,
        this.indicadores.evaluar({ codigoIndicador: 'R-14', contexto }) as Promise<ResultadoIndicador<ResultadoR14>>,
      ]);
    } catch (err) {
      if (err instanceof ForbiddenException) {
        return { aa: null, am: null, valor: null, estadoCalculo: EstadoCalculo.NO_DETERMINABLE };
      }
      throw err;
    }

    // ── AA (alertas ALTA) ──────────────────────────────────────────────────

    // R-09: una alerta ALTA por cada dimensión donde cumple === false
    let aa = 0;
    if (r09.estadoCalculo !== EstadoCalculo.NO_APLICA && r09.valor) {
      const evals = r09.valor.evaluaciones;
      for (const dim of [evals.total, evals.CB, evals.TB, evals.TA, evals.CTC]) {
        if (dim.cumple === false) aa++;
      }
    }

    // R-13: una alerta ALTA por cada violación de formación
    aa += r13.valor?.violacionesFormacion.length ?? 0;

    // ── AM (alertas MEDIA) ─────────────────────────────────────────────────

    const am = r14.valor?.totalConAlerta ?? 0;

    // ── Consistencia ──────────────────────────────────────────────────────

    const consistenciaRaw = 100 - 25 * aa - 10 * am;
    const valor = Math.max(0, consistenciaRaw);

    // Estado: más restrictivo entre R-09, R-13 y R-14 (descarta nulls de NO_IMPLEMENTADO)
    const pesos: Record<EstadoCalculo, number> = {
      [EstadoCalculo.CALCULADO]:       1,
      [EstadoCalculo.NO_APLICA]:       2,
      [EstadoCalculo.PARCIAL]:         3,
      [EstadoCalculo.NO_DETERMINABLE]: 4,
    };
    const estadosNonNull = [r09.estadoCalculo, r13.estadoCalculo, r14.estadoCalculo]
      .filter((e): e is EstadoCalculo => e !== null);
    const estadoCalculo = estadosNonNull.length > 0
      ? estadosNonNull.reduce((a, b) => (pesos[b] > pesos[a] ? b : a))
      : EstadoCalculo.CALCULADO;

    return { aa, am, valor, estadoCalculo };
  }
}
