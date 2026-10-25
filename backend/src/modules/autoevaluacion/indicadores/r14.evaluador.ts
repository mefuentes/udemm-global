import { BadRequestException, Injectable } from '@nestjs/common';
import { ConsultasAcademicasService } from '../consultas-academicas/consultas-academicas.service';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type {
  ContextoEvaluacion,
  DatoFaltante,
  IndicadorEvaluador,
  ResultadoIndicador,
} from './indicadores.types';

// ── Tipos internos de parseo ──────────────────────────────────────────────────

interface FilaFormacionPractica {
  intensidad?: string;
  horasClase?: number;
}

function parsearFormacionPracticaJson(raw: string | null): number | null {
  if (!raw) return 0;
  try {
    const filas: unknown = JSON.parse(raw);
    if (!Array.isArray(filas)) return null;
    let suma = 0;
    for (const f of filas as FilaFormacionPractica[]) {
      if (
        typeof f.horasClase !== 'number' ||
        !Number.isInteger(f.horasClase) ||
        f.horasClase < 0
      ) {
        // Fila con horasClase inválido → no se puede sumar con certeza
        return null;
      }
      suma += f.horasClase;
    }
    return suma;
  } catch {
    return null;
  }
}

// ── Tipos de resultado ────────────────────────────────────────────────────────

export interface MateriaAlertaR14 {
  materiaId: string;
  nombre: string;
  codigo: string;
  /** Suma de horasClase en formacionPracticaJson */
  horasFormacionPractica: number;
  /** cargaHorariaTotal de la materia */
  horasTotal: number;
  /** horasFormacionPractica − horasTotal (siempre > 0) */
  exceso: number;
}

/**
 * Valor del indicador R-14 para un plan de estudios.
 *
 * horasFormacionPractica se deriva de la suma de horasClase en
 * ProgramaAsignatura.formacionPracticaJson (sección S4 del programa).
 *
 * totalEvaluadas: materias con formacionPracticaJson parseable Y cargaHorariaTotal ≠ null.
 * totalSinDatos:  materias sin programa, sin formacionPracticaJson parseable, o sin
 *                 cargaHorariaTotal cuando la suma de horasClase > 0.
 *
 * estadoCalculo:
 *   NO_APLICA:       plan sin materias.
 *   CALCULADO:       todas las materias con horasClase>0 tienen cargaHorariaTotal.
 *   PARCIAL:         alguna materia con horasClase>0 no tiene cargaHorariaTotal, o
 *                    formacionPracticaJson no pudo parsearse.
 *   NO_DETERMINABLE: ninguna materia pudo evaluarse (no hay programas o datos).
 */
export interface ResultadoR14 {
  planEstudioId: string;
  totalMaterias: number;
  totalEvaluadas: number;
  totalSinDatos: number;
  totalConAlerta: number;
  enAlerta: MateriaAlertaR14[];
  estadoCalculo: EstadoCalculo;
}

// ── Evaluador ─────────────────────────────────────────────────────────────────

/**
 * Evaluador de R-14: Horas de formación práctica superiores a las horas totales.
 *
 * Definición funcional (FSD_MODAUT_v2 §6.4):
 *   Detecta materias cuyas horas de formación práctica declaradas en el programa
 *   superan la carga horaria total de la asignatura. Alerta MEDIA.
 *
 * Fuente de horasFormacionPractica:
 *   Suma de horasClase en ProgramaAsignatura.formacionPracticaJson
 *   (array de {intensidad: string, horasClase: number} validado por el módulo de programas).
 *   Si formacionPracticaJson es null, vacío o no parseable → 0 horas declaradas (sin alerta).
 *   Si alguna fila tiene horasClase inválido → materia sin datos (no se evalúa).
 *
 * Fuente de horasTotal: Materia.cargaHorariaTotal.
 *
 * Parámetro obligatorio: planEstudioId.
 */
@Injectable()
export class R14EvaluadorService implements IndicadorEvaluador<ResultadoR14> {
  constructor(private readonly consultas: ConsultasAcademicasService) {}

  async evaluar(contexto: ContextoEvaluacion): Promise<ResultadoIndicador<ResultadoR14>> {
    if (!contexto.planEstudioId) {
      throw new BadRequestException(
        'R-14 requiere planEstudioId. Proporcione el identificador del plan a evaluar.',
      );
    }

    const materiasProgramas = await this.consultas.obtenerMateriasProgramasDePlan(
      contexto.planEstudioId,
      contexto.usuarioId,
      contexto.rolNombre,
    );

    const noAplica: ResultadoIndicador<ResultadoR14> = {
      codigo: 'R-14',
      contextoId: contexto.planEstudioId,
      tipoContexto: 'PLAN',
      estadoImplementacion: 'IMPLEMENTADO',
      estadoCalculo: EstadoCalculo.NO_APLICA,
      valor: {
        planEstudioId: contexto.planEstudioId,
        totalMaterias: 0,
        totalEvaluadas: 0,
        totalSinDatos: 0,
        totalConAlerta: 0,
        enAlerta: [],
        estadoCalculo: EstadoCalculo.NO_APLICA,
      },
      datosFaltantes: [],
      fechaEvaluacion: contexto.fechaEvaluacion,
    };

    if (materiasProgramas.length === 0) return noAplica;

    const enAlerta: MateriaAlertaR14[] = [];
    let totalEvaluadas = 0;
    let totalSinDatos = 0;
    let hayParseError = false;

    for (const mp of materiasProgramas) {
      const horasFormacion = parsearFormacionPracticaJson(mp.formacionPracticaJson);

      if (horasFormacion === null) {
        // formacionPracticaJson no pudo parsearse → sin datos confiables
        totalSinDatos++;
        hayParseError = true;
        continue;
      }

      if (horasFormacion === 0) {
        // No hay horas de formación práctica declaradas → no hay inconsistencia posible
        totalEvaluadas++;
        continue;
      }

      // horasFormacion > 0: necesitamos cargaHorariaTotal para comparar
      if (mp.cargaHorariaTotal === null) {
        totalSinDatos++;
        continue;
      }

      totalEvaluadas++;

      if (horasFormacion > mp.cargaHorariaTotal) {
        enAlerta.push({
          materiaId: mp.materiaId,
          nombre: mp.materiaNombre,
          codigo: mp.materiaCodigo,
          horasFormacionPractica: horasFormacion,
          horasTotal: mp.cargaHorariaTotal,
          exceso: horasFormacion - mp.cargaHorariaTotal,
        });
      }
    }

    // Estado de cálculo
    let estadoCalculo: EstadoCalculo;
    if (totalEvaluadas === 0 && totalSinDatos === 0) {
      // Todos con horasFormacion=0 → se evaluaron pero no hubo inconsistencia posible
      estadoCalculo = EstadoCalculo.CALCULADO;
    } else if (totalEvaluadas === 0) {
      estadoCalculo = EstadoCalculo.NO_DETERMINABLE;
    } else if (totalSinDatos > 0) {
      estadoCalculo = EstadoCalculo.PARCIAL;
    } else {
      estadoCalculo = EstadoCalculo.CALCULADO;
    }

    const datosFaltantes: DatoFaltante[] = [];

    if (hayParseError) {
      datosFaltantes.push({
        campo: 'formacionPracticaJson',
        entidad: 'ProgramaAsignatura',
        descripcion:
          'Algunas materias tienen formacionPracticaJson con filas de horasClase inválidas ' +
          '(no entero no negativo). No pueden compararse con cargaHorariaTotal.',
      });
    }

    const hayMateriaSinHorasTotal = materiasProgramas.some(
      (mp) =>
        mp.cargaHorariaTotal === null &&
        parsearFormacionPracticaJson(mp.formacionPracticaJson) !== null &&
        (parsearFormacionPracticaJson(mp.formacionPracticaJson) ?? 0) > 0,
    );
    if (hayMateriaSinHorasTotal) {
      datosFaltantes.push({
        campo: 'cargaHorariaTotal',
        entidad: 'Materia',
        descripcion:
          'Algunas materias tienen horas de formación práctica declaradas pero no tienen ' +
          'cargaHorariaTotal registrada. No es posible detectar el exceso para esas materias.',
      });
    }

    return {
      codigo: 'R-14',
      contextoId: contexto.planEstudioId,
      tipoContexto: 'PLAN',
      estadoImplementacion: 'IMPLEMENTADO',
      estadoCalculo,
      valor: {
        planEstudioId: contexto.planEstudioId,
        totalMaterias: materiasProgramas.length,
        totalEvaluadas,
        totalSinDatos,
        totalConAlerta: enAlerta.length,
        enAlerta,
        estadoCalculo,
      },
      datosFaltantes,
      fechaEvaluacion: contexto.fechaEvaluacion,
    };
  }
}
