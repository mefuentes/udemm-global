import { BadRequestException, Injectable } from '@nestjs/common';
import { ConsultasAcademicasService } from '../consultas-academicas/consultas-academicas.service';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type {
  ContextoEvaluacion,
  DatoFaltante,
  IndicadorEvaluador,
  ResultadoIndicador,
} from './indicadores.types';
import type { MateriaProgramaAut } from '../consultas-academicas/consultas-academicas.types';

// ── Tipos de resultado ────────────────────────────────────────────────────────

export interface ResultadoR13 {
  planEstudioId: string;
  totalMaterias: number;
  porTipo: {
    OBLIGATORIA: number;
    ELECTIVA: number;
    PPS: number;
    PI: number;
    OTRO: number;
  };
  tienePPS: boolean;
  tienePI: boolean;
  /**
   * Suma de horas de FP del plan vía D07 fallback.
   * Suma parcial de las materias con datos disponibles (puede ser subestimada si sinDatosFP > 0).
   */
  totalHorasFormacionPractica: number;
  /** Materias con FP calculable (D07 o JSON histórico) */
  conDatosFP: number;
  /** Materias sin FP calculable (sin programa, sin hsFormacionPractica, sin JSON válido) */
  sinDatosFP: number;
  configuracionPlan: {
    /** null = no configurado; true = requerido; false = explícitamente no requerido */
    requierePPS: boolean | null;
    /** null = no configurado; true = requerido; false = explícitamente no requerido */
    requierePI: boolean | null;
    /** null = no configurado; >= 0 = horas mínimas de FP del plan */
    horasMinFormacionPractica: number | null;
  };
  violacionesFormacion: string[];
  estadoCalculo: EstadoCalculo;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface FilaFP { intensidad?: string; horasClase?: number }

/**
 * Computa horas de FP de una materia usando el fallback D07:
 *   1. hsFormacionPractica !== null → usar directamente
 *   2. formacionPracticaJson → parsear suma de horasClase
 *   null = sin datos (materia sin programa o datos incompletos)
 */
function fpEfectiva(mp: MateriaProgramaAut): number | null {
  if (mp.hsFormacionPractica !== null) return mp.hsFormacionPractica;
  if (!mp.formacionPracticaJson) return null;
  try {
    const filas: unknown = JSON.parse(mp.formacionPracticaJson);
    if (!Array.isArray(filas)) return null;
    let suma = 0;
    for (const f of filas as FilaFP[]) {
      const h = f?.horasClase;
      if (typeof h !== 'number' || !Number.isInteger(h) || h < 0 || h > 9999) return null;
      suma += h;
    }
    return suma;
  } catch { return null; }
}

// ── Evaluador ─────────────────────────────────────────────────────────────────

/**
 * Evaluador de R-13: Formación práctica insuficiente / ausencia de PPS o PI.
 *
 * Definición funcional (FSD_MODAUT_v2 §6.3, actualizado D07):
 *   Verifica la presencia de materias de tipo PPS y PI, y evalúa el cumplimiento
 *   del umbral configurado en PlanEstudio (requierePPS, requierePI, horasMinFormacionPractica).
 *
 * Fuente de horas (D07 fallback):
 *   1. ProgramaAsignatura.hsFormacionPractica (D07) si no es null
 *   2. Fallback: suma de horasClase en formacionPracticaJson (programas históricos)
 *   Materias sin datos en ambas fuentes → sinDatosFP (no se interpretan como 0)
 *
 * Estado de cálculo:
 *   NO_APLICA:  plan sin materias.
 *   CALCULADO:  todas las materias tienen datos FP O no hay umbral de horas configurado.
 *   PARCIAL:    al menos una materia sin datos FP Y horasMinFormacionPractica configurado.
 */
@Injectable()
export class R13EvaluadorService implements IndicadorEvaluador<ResultadoR13> {
  constructor(private readonly consultas: ConsultasAcademicasService) {}

  async evaluar(contexto: ContextoEvaluacion): Promise<ResultadoIndicador<ResultadoR13>> {
    if (!contexto.planEstudioId) {
      throw new BadRequestException(
        'R-13 requiere planEstudioId. Proporcione el identificador del plan a evaluar.',
      );
    }

    const [materias, configFormacion] = await Promise.all([
      this.consultas.obtenerMateriasProgramasDePlan(
        contexto.planEstudioId,
        contexto.usuarioId,
        contexto.rolNombre,
      ),
      this.consultas.obtenerConfigFormacionPlan(
        contexto.planEstudioId,
        contexto.usuarioId,
        contexto.rolNombre,
      ),
    ]);

    const configuracionPlan = {
      requierePPS: configFormacion.requierePPS,
      requierePI: configFormacion.requierePI,
      horasMinFormacionPractica: configFormacion.horasMinFormacionPractica,
    };

    const noAplica: ResultadoIndicador<ResultadoR13> = {
      codigo: 'R-13',
      contextoId: contexto.planEstudioId,
      tipoContexto: 'PLAN',
      estadoImplementacion: 'IMPLEMENTADO',
      estadoCalculo: EstadoCalculo.NO_APLICA,
      valor: {
        planEstudioId: contexto.planEstudioId,
        totalMaterias: 0,
        porTipo: { OBLIGATORIA: 0, ELECTIVA: 0, PPS: 0, PI: 0, OTRO: 0 },
        tienePPS: false, tienePI: false,
        totalHorasFormacionPractica: 0,
        conDatosFP: 0, sinDatosFP: 0,
        configuracionPlan,
        violacionesFormacion: [],
        estadoCalculo: EstadoCalculo.NO_APLICA,
      },
      datosFaltantes: [],
      fechaEvaluacion: contexto.fechaEvaluacion,
    };

    if (materias.length === 0) return noAplica;

    // ── Distribución por tipo ─────────────────────────────────────────────────
    const porTipo = { OBLIGATORIA: 0, ELECTIVA: 0, PPS: 0, PI: 0, OTRO: 0 };

    for (const m of materias) {
      const tipo = m.tipoAsignatura.toUpperCase();
      if      (tipo === 'OBLIGATORIA') porTipo.OBLIGATORIA++;
      else if (tipo === 'ELECTIVA')    porTipo.ELECTIVA++;
      else if (tipo === 'PPS')         porTipo.PPS++;
      else if (tipo === 'PI')          porTipo.PI++;
      else                             porTipo.OTRO++;
    }

    const tienePPS = porTipo.PPS > 0;
    const tienePI  = porTipo.PI  > 0;

    // ── Sumar horas FP vía D07 fallback ──────────────────────────────────────
    let totalHorasFormacionPractica = 0;
    let conDatosFP = 0;
    let sinDatosFP = 0;

    for (const m of materias) {
      const fp = fpEfectiva(m);
      if (fp !== null) {
        totalHorasFormacionPractica += fp;
        conDatosFP++;
      } else {
        sinDatosFP++;
      }
    }

    // ── Estado de cálculo ────────────────────────────────────────────────────
    const horasMin = configuracionPlan.horasMinFormacionPractica;
    const estadoCalculo: EstadoCalculo =
      sinDatosFP > 0 && horasMin !== null
        ? EstadoCalculo.PARCIAL
        : EstadoCalculo.CALCULADO;

    // ── Lógica de cumplimiento ────────────────────────────────────────────────
    const violacionesFormacion: string[] = [];

    if (configuracionPlan.requierePPS === true && !tienePPS) {
      violacionesFormacion.push('PPS requerida por el plan pero no hay materias de tipo PPS.');
    }
    if (configuracionPlan.requierePI === true && !tienePI) {
      violacionesFormacion.push('PI requerido por el plan pero no hay materias de tipo PI.');
    }

    // Verificar umbral de horas solo cuando estado es CALCULADO (sin datos faltantes)
    if (horasMin !== null && estadoCalculo === EstadoCalculo.CALCULADO) {
      if (totalHorasFormacionPractica < horasMin) {
        violacionesFormacion.push(
          `Formación práctica insuficiente: ${totalHorasFormacionPractica} h del plan ` +
          `(mínimo configurado: ${horasMin} h).`,
        );
      }
    }

    // ── D-13: datos faltantes ─────────────────────────────────────────────────
    const todasConfiguradas =
      configuracionPlan.requierePPS !== null &&
      configuracionPlan.requierePI !== null &&
      configuracionPlan.horasMinFormacionPractica !== null;

    const datosFaltantes: DatoFaltante[] = [];

    if (!todasConfiguradas) {
      datosFaltantes.push({
        campo: 'horasMinFormacionPractica / requierePPS / requierePI',
        entidad: 'PlanEstudio',
        descripcion:
          'R-13 no puede verificar todos los umbrales de formación práctica: ' +
          'uno o más campos de configuración (requierePPS, requierePI, horasMinFormacionPractica) ' +
          'no están configurados para este plan de estudios.',
      });
    }

    if (estadoCalculo === EstadoCalculo.PARCIAL) {
      datosFaltantes.push({
        campo: 'hsFormacionPractica / formacionPracticaJson',
        entidad: 'ProgramaAsignatura',
        descripcion:
          `${sinDatosFP} materia(s) no tienen datos de formación práctica registrados ` +
          '(ni D07 ni JSON histórico). La suma total puede estar subestimada.',
      });
    }

    return {
      codigo: 'R-13',
      contextoId: contexto.planEstudioId,
      tipoContexto: 'PLAN',
      estadoImplementacion: 'IMPLEMENTADO',
      estadoCalculo,
      valor: {
        planEstudioId: contexto.planEstudioId,
        totalMaterias: materias.length,
        porTipo,
        tienePPS,
        tienePI,
        totalHorasFormacionPractica,
        conDatosFP,
        sinDatosFP,
        configuracionPlan,
        violacionesFormacion,
        estadoCalculo,
      },
      datosFaltantes,
      fechaEvaluacion: contexto.fechaEvaluacion,
    };
  }
}
