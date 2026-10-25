import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { R03EvaluadorService } from './r03.evaluador';
import { R04EvaluadorService } from './r04.evaluador';
import { R07EvaluadorService } from './r07.evaluador';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type { ResultadoR03 } from './r03.evaluador';
import type { ResultadoR04 } from './r04.evaluador';
import type { ResultadoR07 } from './r07.evaluador';
import type { ResultadoIndicador } from './indicadores.types';

// ── Tipos de resultado ────────────────────────────────────────────────────────

/**
 * Resultado de IP-10: Consistencia del plantel docente.
 * Fórmula: max(0, 100 − 25×A − 10×M).
 *   A = alertas ALTA penalizables (R-03 + R-04 no exceptuadas por C4).
 *   M = alertas MEDIA penalizables (R-07 sobreasignados).
 */
export interface ResultadoIP10 {
  carreraId: string;
  /** Puntaje calculado. 100 cuando estadoCalculo = NO_APLICA. */
  puntaje: number;
  /** Total de alertas ALTA penalizables (R-03 + R-04 no exceptuadas). */
  componenteA: number;
  /** Total de alertas MEDIA penalizables (R-07 sobreasignados). */
  componenteM: number;
  alertasR03: number;
  /** Cargos en alerta R-04 cuyo docente tiene al menos un cargo con actividad en el plan. */
  alertasR04Penalizables: number;
  alertasR07: number;
  estadoCalculo: EstadoCalculo;
}

// ── Peso de estado para agregar el más restrictivo ───────────────────────────

const PESO_ESTADO: Record<EstadoCalculo, number> = {
  [EstadoCalculo.CALCULADO]: 1,
  [EstadoCalculo.NO_APLICA]: 1,
  [EstadoCalculo.PARCIAL]: 2,
  [EstadoCalculo.NO_DETERMINABLE]: 3,
};

// ── Servicio ──────────────────────────────────────────────────────────────────

@Injectable()
export class IP10EvaluadorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r03: R03EvaluadorService,
    private readonly r04: R04EvaluadorService,
    private readonly r07: R07EvaluadorService,
  ) {}

  /**
   * Calcula IP-10 (Consistencia del plantel) para una carrera.
   * Agrega alertas ALTA de R-03 y R-04 (con excepción C4) y MEDIA de R-07.
   */
  async evaluarParaCarrera(
    carreraId: string,
    usuarioId: string,
    rolNombre: string,
    fechaEvaluacion: Date,
  ): Promise<ResultadoIP10> {
    const contextoCarrera = { carreraId, usuarioId, rolNombre, fechaEvaluacion };

    const planes = await this.prisma.planEstudio.findMany({
      where: { carreraId },
      select: { id: true },
    });

    const allResults = await Promise.all([
      this.r03.evaluar(contextoCarrera),
      this.r07.evaluar(contextoCarrera),
      ...planes.map(p =>
        this.r04.evaluar({ planEstudioId: p.id, usuarioId, rolNombre, fechaEvaluacion }),
      ),
    ]);

    const r03Res = allResults[0] as ResultadoIndicador<ResultadoR03>;
    const r07Res = allResults[1] as ResultadoIndicador<ResultadoR07>;
    const r04Results = allResults.slice(2) as ResultadoIndicador<ResultadoR04>[];

    const alertasR03 = r03Res.valor?.totalEnAlerta ?? 0;
    const alertasR07 = r07Res.valor?.totalSobreasignados ?? 0;

    let alertasR04Penalizables = 0;
    for (const r04Res of r04Results) {
      if (!r04Res.valor) continue;
      const exceptuados = new Set(r04Res.valor.docentesExceptuadosPorC4);
      alertasR04Penalizables += r04Res.valor.cargosEnAlerta.filter(
        c => !exceptuados.has(c.docenteId),
      ).length;
    }

    const A = alertasR03 + alertasR04Penalizables;
    const M = alertasR07;
    const puntaje = Math.max(0, 100 - 25 * A - 10 * M);

    const allEstados: EstadoCalculo[] = [
      r03Res.estadoCalculo ?? EstadoCalculo.NO_DETERMINABLE,
      r07Res.estadoCalculo ?? EstadoCalculo.NO_DETERMINABLE,
      ...r04Results.map(r => r.estadoCalculo ?? EstadoCalculo.NO_DETERMINABLE),
    ];

    if (allEstados.every(e => e === EstadoCalculo.NO_APLICA)) {
      return {
        carreraId,
        puntaje: 100,
        componenteA: 0,
        componenteM: 0,
        alertasR03: 0,
        alertasR04Penalizables: 0,
        alertasR07: 0,
        estadoCalculo: EstadoCalculo.NO_APLICA,
      };
    }

    const estadoCalculo = allEstados.reduce((a, b) =>
      PESO_ESTADO[b] > PESO_ESTADO[a] ? b : a,
    );

    return {
      carreraId,
      puntaje,
      componenteA: A,
      componenteM: M,
      alertasR03,
      alertasR04Penalizables,
      alertasR07,
      estadoCalculo: estadoCalculo === EstadoCalculo.NO_APLICA
        ? EstadoCalculo.CALCULADO
        : estadoCalculo,
    };
  }
}
