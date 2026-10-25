import { BadRequestException, Injectable } from '@nestjs/common';
import { ConsultasAcademicasService } from '../consultas-academicas/consultas-academicas.service';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type {
  ContextoEvaluacion,
  DatoFaltante,
  IndicadorEvaluador,
  ResultadoIndicador,
} from './indicadores.types';

// ── Tipos de resultado ────────────────────────────────────────────────────────

export interface MateriaFormacionPracticaR13 {
  materiaId: string;
  nombre: string;
  codigo: string;
  tipoAsignatura: string;
  cargaHorariaTotal: number | null;
}

/**
 * Valor del indicador R-13 para un plan de estudios.
 *
 * Reporta la distribución de materias por tipoAsignatura, presencia de PPS/PI,
 * y verifica el cumplimiento de los umbrales configurados en el plan.
 *
 * horasPPS / horasPI:
 *   Suma de cargaHorariaTotal de las materias de cada tipo.
 *   null si alguna materia de ese tipo no tiene cargaHorariaTotal registrada.
 *
 * configuracionPlan:
 *   Refleja los valores de PlanEstudio.requierePPS / requierePI / porcentajeMinFormacion.
 *   null en cada campo = no configurado (R-13 no puede verificar ese aspecto).
 *
 * violacionesFormacion:
 *   Lista de incumplimientos detectados según la configuración del plan.
 *   Vacía si no hay configuración relevante o no hay incumplimientos.
 *
 * estadoCalculo:
 *   NO_APLICA:  plan sin materias.
 *   CALCULADO:  enumeración de tipos completa y configuración no introduce PARCIAL.
 *   PARCIAL:    al menos una materia PPS o PI tiene cargaHorariaTotal=null
 *               y hay un porcentajeMinFormacion configurado que requiere sumar horas.
 */
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
  /** null si alguna materia PPS tiene cargaHorariaTotal=null */
  horasPPS: number | null;
  /** null si alguna materia PI tiene cargaHorariaTotal=null */
  horasPI: number | null;
  materiasPPS: MateriaFormacionPracticaR13[];
  materiasPI: MateriaFormacionPracticaR13[];
  configuracionPlan: {
    /** null = no configurado; true = requerido; false = explícitamente no requerido */
    requierePPS: boolean | null;
    /** null = no configurado; true = requerido; false = explícitamente no requerido */
    requierePI: boolean | null;
    /** null = no configurado; 0–100 = porcentaje mínimo de horas prácticas sobre total del plan */
    porcentajeMinFormacion: number | null;
  };
  violacionesFormacion: string[];
  estadoCalculo: EstadoCalculo;
}

// ── Evaluador ─────────────────────────────────────────────────────────────────

/**
 * Evaluador de R-13: Formación práctica insuficiente / ausencia de PPS o PI.
 *
 * Definición funcional (FSD_MODAUT_v2 §6.3):
 *   Verifica la presencia de materias de tipo PPS y PI, y evalúa el cumplimiento
 *   de los umbrales configurados en PlanEstudio (requierePPS, requierePI,
 *   porcentajeMinFormacion).
 *
 * Semántica nullable de configuración:
 *   null = no configurado → no puede verificar ese aspecto (D-13 permanece)
 *   true = requerido → ausencia es una violación
 *   false = explícitamente no requerido → ausencia es normal
 *
 * Parámetro obligatorio: planEstudioId.
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
      this.consultas.obtenerMateriasDePlan(
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
      porcentajeMinFormacion: configFormacion.porcentajeMinFormacion,
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
        horasPPS: null, horasPI: null,
        materiasPPS: [], materiasPI: [],
        configuracionPlan,
        violacionesFormacion: [],
        estadoCalculo: EstadoCalculo.NO_APLICA,
      },
      datosFaltantes: [],
      fechaEvaluacion: contexto.fechaEvaluacion,
    };

    if (materias.length === 0) return noAplica;

    const porTipo = { OBLIGATORIA: 0, ELECTIVA: 0, PPS: 0, PI: 0, OTRO: 0 };
    const materiasPPS: MateriaFormacionPracticaR13[] = [];
    const materiasPI: MateriaFormacionPracticaR13[] = [];

    for (const m of materias) {
      const tipo = m.tipoAsignatura.toUpperCase();
      if (tipo === 'OBLIGATORIA') porTipo.OBLIGATORIA++;
      else if (tipo === 'ELECTIVA') porTipo.ELECTIVA++;
      else if (tipo === 'PPS') {
        porTipo.PPS++;
        materiasPPS.push({
          materiaId: m.id, nombre: m.nombre, codigo: m.codigo,
          tipoAsignatura: m.tipoAsignatura, cargaHorariaTotal: m.cargaHorariaTotal,
        });
      } else if (tipo === 'PI') {
        porTipo.PI++;
        materiasPI.push({
          materiaId: m.id, nombre: m.nombre, codigo: m.codigo,
          tipoAsignatura: m.tipoAsignatura, cargaHorariaTotal: m.cargaHorariaTotal,
        });
      } else {
        porTipo.OTRO++;
      }
    }

    const tienePPS = porTipo.PPS > 0;
    const tienePI = porTipo.PI > 0;

    // Acumular horas por tipo; null si alguna no tiene cargaHorariaTotal
    const sumarHoras = (lista: MateriaFormacionPracticaR13[]): number | null => {
      if (lista.length === 0) return null;
      let suma = 0;
      for (const m of lista) {
        if (m.cargaHorariaTotal === null) return null;
        suma += m.cargaHorariaTotal;
      }
      return suma;
    };

    const horasPPS = sumarHoras(materiasPPS);
    const horasPI = sumarHoras(materiasPI);

    // Estado base de cálculo
    const hayHorasIncompletas =
      materiasPPS.some((m) => m.cargaHorariaTotal === null) ||
      materiasPI.some((m) => m.cargaHorariaTotal === null);

    // Lógica de cumplimiento (FSD §6.3)
    const violacionesFormacion: string[] = [];

    if (configuracionPlan.requierePPS === true && !tienePPS) {
      violacionesFormacion.push('PPS requerida por el plan pero no hay materias de tipo PPS.');
    }
    if (configuracionPlan.requierePI === true && !tienePI) {
      violacionesFormacion.push('PI requerido por el plan pero no hay materias de tipo PI.');
    }

    // Estado de cálculo final: PARCIAL si el porcentaje mínimo requiere horas pero faltan
    const porcentajeMin = configuracionPlan.porcentajeMinFormacion;
    let estadoCalculo: EstadoCalculo;

    if (porcentajeMin !== null && hayHorasIncompletas) {
      estadoCalculo = EstadoCalculo.PARCIAL;
    } else if (hayHorasIncompletas && (materiasPPS.length > 0 || materiasPI.length > 0)) {
      estadoCalculo = EstadoCalculo.PARCIAL;
    } else {
      estadoCalculo = EstadoCalculo.CALCULADO;
    }

    // Verificar porcentaje mínimo (solo cuando CALCULADO y configurado)
    if (porcentajeMin !== null && estadoCalculo === EstadoCalculo.CALCULADO) {
      const totalHorasPlan = materias.reduce((acc, m) => acc + (m.cargaHorariaTotal ?? 0), 0);
      if (totalHorasPlan > 0) {
        const horasPracticas = (horasPPS ?? 0) + (horasPI ?? 0);
        const pctActual = (horasPracticas / totalHorasPlan) * 100;
        if (pctActual < porcentajeMin) {
          violacionesFormacion.push(
            `Formación práctica insuficiente: ${pctActual.toFixed(1)}% del plan ` +
            `(mínimo configurado: ${porcentajeMin}%).`,
          );
        }
      }
    }

    // D-13: persiste solo si algún campo de configuración es null
    const todasConfiguradas =
      configuracionPlan.requierePPS !== null &&
      configuracionPlan.requierePI !== null &&
      configuracionPlan.porcentajeMinFormacion !== null;

    const datosFaltantes: DatoFaltante[] = [];

    if (!todasConfiguradas) {
      datosFaltantes.push({
        campo: 'porcentajeMinFormacion / requierePPS / requierePI',
        entidad: 'PlanEstudio',
        descripcion:
          'R-13 no puede verificar todos los umbrales de formación práctica: ' +
          'uno o más campos de configuración (requierePPS, requierePI, porcentajeMinFormacion) ' +
          'no están configurados para este plan de estudios.',
      });
    }

    if (estadoCalculo === EstadoCalculo.PARCIAL) {
      datosFaltantes.push({
        campo: 'cargaHorariaTotal',
        entidad: 'Materia',
        descripcion:
          'Algunas materias PPS o PI no tienen carga horaria total registrada. ' +
          'Las sumas de horas de formación práctica pueden estar subestimadas.',
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
        horasPPS,
        horasPI,
        materiasPPS,
        materiasPI,
        configuracionPlan,
        violacionesFormacion,
        estadoCalculo,
      },
      datosFaltantes,
      fechaEvaluacion: contexto.fechaEvaluacion,
    };
  }
}
