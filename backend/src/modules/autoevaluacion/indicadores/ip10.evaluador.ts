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
 * FSD §10: C_d = max(0, 100 − 25×A_d − 10×M_d) por docente, luego promediado.
 *   A_d = (1 si alerta R-03) + (1 si tiene algún cargo R-04 penalizable, excepción C4).
 *   M_d = (1 si alerta R-07).
 * IP-10 = round(SUM(C_d) / N). 100 cuando estadoCalculo = NO_APLICA.
 */
export interface ResultadoIP10 {
  carreraId: string;
  /** Consistencia promedio: round(SUM(C_d) / N). 100 cuando estadoCalculo = NO_APLICA. */
  puntaje: number;
  /** Suma de agregados de alerta ALTA (alertasR03 + alertasR04Penalizables). Solo contexto visual. */
  componenteA: number;
  /** Total de alertas MEDIA penalizables (R-07 sobreasignados). Solo contexto visual. */
  componenteM: number;
  alertasR03: number;
  /** Cargos en alerta R-04 cuyo docente no está exceptuado por C4. */
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
   * FSD §10: fórmula per-docente C_d = max(0, 100 − 25×A_d − 10×M_d), luego promedia.
   *   A_d binario: 1 si tiene alerta R-03, más 1 si tiene algún cargo R-04 penalizable.
   *   M_d binario: 1 si tiene alerta R-07.
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

    // docenteIds de esta carrera: acota R-03/R-07 cuando operan con alcance de facultad.
    const [allResults, docenteIdsCarrera] = await Promise.all([
      Promise.all([
        this.r03.evaluar(contextoCarrera),
        this.r07.evaluar(contextoCarrera),
        ...planes.map(p =>
          this.r04.evaluar({ planEstudioId: p.id, usuarioId, rolNombre, fechaEvaluacion }),
        ),
      ]),
      this.prisma.vinculacionCatedra.findMany({
        where: { carreraId, estado: 'APROBADA', docente: { activo: true } },
        select: { docenteId: true },
        distinct: ['docenteId'],
      }).then(rows => new Set(rows.map(r => r.docenteId))),
    ]);

    const r03Res = allResults[0] as ResultadoIndicador<ResultadoR03>;
    const r07Res = allResults[1] as ResultadoIndicador<ResultadoR07>;
    const r04Results = allResults.slice(2) as ResultadoIndicador<ResultadoR04>[];

    // ── Alertas R-03 (una por docente, filtradas a la carrera) ────────────────
    const r03AlertSet = new Set(
      (r03Res.valor?.enAlerta ?? [])
        .filter(d => docenteIdsCarrera.has(d.docenteId))
        .map(d => d.docenteId),
    );

    // ── Alertas R-04: binario por docente (tiene algún cargo no exceptuado) ───
    // alertasR04Penalizables: conteo de cargos (puede exceder el conteo de docentes).
    const r04AlertSet = new Set<string>();
    let alertasR04Penalizables = 0;
    for (const r04Res of r04Results) {
      if (!r04Res.valor) continue;
      const exceptuados = new Set(r04Res.valor.docentesExceptuadosPorC4);
      for (const cargo of r04Res.valor.cargosEnAlerta) {
        if (exceptuados.has(cargo.docenteId)) continue;
        r04AlertSet.add(cargo.docenteId);
        alertasR04Penalizables += 1;
      }
    }

    // ── Alertas R-07 (una por docente, filtradas a la carrera) ────────────────
    const r07AlertSet = new Set(
      (r07Res.valor?.sobreasignados ?? [])
        .filter(d => docenteIdsCarrera.has(d.docenteId))
        .map(d => d.docenteId),
    );

    const alertasR03 = r03AlertSet.size;
    const alertasR07 = r07AlertSet.size;

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

    // ── Fórmula per-docente: C_d = max(0, 100 − 25×A_d − 10×M_d) ─────────────
    // A_d: binario (0/1) por R-03 + binario (0/1) por R-04 → max A_d = 2.
    // M_d: binario (0/1) por R-07 → max M_d = 1.
    // Consistencia mínima por docente: max(0, 100−50−10) = 40.
    const N = docenteIdsCarrera.size;
    let sumaConsistencias = 0;
    for (const docenteId of docenteIdsCarrera) {
      const aD = (r03AlertSet.has(docenteId) ? 1 : 0) + (r04AlertSet.has(docenteId) ? 1 : 0);
      const mD = r07AlertSet.has(docenteId) ? 1 : 0;
      sumaConsistencias += Math.max(0, 100 - 25 * aD - 10 * mD);
    }
    const puntaje = N > 0 ? Math.round(sumaConsistencias / N) : 100;

    const estadoCalculo = allEstados.reduce((a, b) =>
      PESO_ESTADO[b] > PESO_ESTADO[a] ? b : a,
    );

    return {
      carreraId,
      puntaje,
      componenteA: alertasR03 + alertasR04Penalizables,
      componenteM: alertasR07,
      alertasR03,
      alertasR04Penalizables,
      alertasR07,
      estadoCalculo: estadoCalculo === EstadoCalculo.NO_APLICA
        ? EstadoCalculo.CALCULADO
        : estadoCalculo,
    };
  }
}
