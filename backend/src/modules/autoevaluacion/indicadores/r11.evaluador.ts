import { BadRequestException, Injectable } from '@nestjs/common';
import { ConsultasAcademicasService } from '../consultas-academicas/consultas-academicas.service';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type {
  ContextoEvaluacion,
  IndicadorEvaluador,
  ResultadoIndicador,
} from './indicadores.types';

// ── Tipos de resultado ────────────────────────────────────────────────────────

/**
 * Materia con programa inconsistente detectado por R-11.
 *
 * Prioridad basada exclusivamente en secciones completas (estadoPrograma irrelevante):
 *   ALTA  — 0–2 secciones completas (programa muy incompleto).
 *   MEDIA — 3–5 secciones completas (progreso parcial).
 *   Sin inconsistencia — 6/6 secciones completas.
 */
export interface ProgramaInconsistenteR11 {
  materiaId: string;
  materiaNombre: string;
  materiaCodigo: string;
  estadoPrograma: string;
  seccionesCompletas: number;
  seccionesPendientes: number;
  prioridad: 'ALTA' | 'MEDIA';
}

export interface MateriaSinProgramaR11 {
  materiaId: string;
  materiaNombre: string;
  materiaCodigo: string;
}

/**
 * Valor del indicador R-11 para un plan de estudios.
 *
 * estadoCalculo:
 *   NO_APLICA:  plan sin materias.
 *   CALCULADO:  evaluación completa (siempre alcanzable cuando hay materias, ya que
 *               las secciones tienen valor por defecto 'PENDIENTE').
 *
 * Nota: los ítems repetidos dentro de un programa (FSD §6.2) no son detectables
 * con la estructura actual del schema (contenido almacenado como texto libre).
 * Se documentan en datosFaltantes cuando hay programas con contenido.
 */
export interface ResultadoR11 {
  planEstudioId: string;
  totalMaterias: number;
  totalConPrograma: number;
  totalSinPrograma: number;
  totalInconsistencias: number;
  totalAlta: number;
  totalMedia: number;
  inconsistencias: ProgramaInconsistenteR11[];
  sinPrograma: MateriaSinProgramaR11[];
  estadoCalculo: EstadoCalculo;
}

// ── Evaluador ─────────────────────────────────────────────────────────────────

/**
 * Evaluador de R-11: Inconsistencias en programas de asignatura.
 *
 * Definición funcional (FSD_MODAUT_v2 §6.2):
 *   Detecta contradicciones entre el estadoPrograma y el estado de las seis secciones
 *   (estadoS1–estadoS6) almacenadas en ProgramaAsignatura.
 *
 * Clasificación (basada en secciones completas, independiente del estado administrativo):
 *   ALTA  — 0–2 secciones completas (programa muy incompleto).
 *   MEDIA — 3–5 secciones completas (progreso parcial).
 *   Sin inconsistencia — 6/6 secciones completas (programa íntegro).
 *
 * Materias sin programa: se listan en sinPrograma, no se cuentan como inconsistencias.
 *
 * Ítems repetidos (FSD §6.2): no detectables sin parseo de contenido libre.
 *   Se agrega un DatoFaltante informativo cuando hay programas con contenido cargado.
 *
 * Parámetro obligatorio: planEstudioId.
 */
@Injectable()
export class R11EvaluadorService implements IndicadorEvaluador<ResultadoR11> {
  constructor(private readonly consultas: ConsultasAcademicasService) {}

  async evaluar(contexto: ContextoEvaluacion): Promise<ResultadoIndicador<ResultadoR11>> {
    if (!contexto.planEstudioId) {
      throw new BadRequestException(
        'R-11 requiere planEstudioId. Proporcione el identificador del plan a evaluar.',
      );
    }

    const materiasProgramas = await this.consultas.obtenerMateriasProgramasDePlan(
      contexto.planEstudioId,
      contexto.usuarioId,
      contexto.rolNombre,
    );

    const noAplica: ResultadoIndicador<ResultadoR11> = {
      codigo: 'R-11',
      contextoId: contexto.planEstudioId,
      tipoContexto: 'PLAN',
      estadoImplementacion: 'IMPLEMENTADO',
      estadoCalculo: EstadoCalculo.NO_APLICA,
      valor: {
        planEstudioId: contexto.planEstudioId,
        totalMaterias: 0,
        totalConPrograma: 0,
        totalSinPrograma: 0,
        totalInconsistencias: 0,
        totalAlta: 0,
        totalMedia: 0,
        inconsistencias: [],
        sinPrograma: [],
        estadoCalculo: EstadoCalculo.NO_APLICA,
      },
      datosFaltantes: [],
      fechaEvaluacion: contexto.fechaEvaluacion,
    };

    if (materiasProgramas.length === 0) return noAplica;

    const inconsistencias: ProgramaInconsistenteR11[] = [];
    const sinPrograma: MateriaSinProgramaR11[] = [];
    let totalAlta = 0;
    let totalMedia = 0;
    let hayContenido = false;

    for (const mp of materiasProgramas) {
      if (!mp.tienePrograma) {
        sinPrograma.push({
          materiaId: mp.materiaId,
          materiaNombre: mp.materiaNombre,
          materiaCodigo: mp.materiaCodigo,
        });
        continue;
      }

      hayContenido = true;
      const pendientes = 6 - mp.seccionesCompletas;

      // 6/6 secciones completas → programa íntegro, sin inconsistencia
      if (pendientes === 0) continue;

      const prioridad: 'ALTA' | 'MEDIA' = mp.seccionesCompletas <= 2 ? 'ALTA' : 'MEDIA';
      if (prioridad === 'ALTA') totalAlta++;
      else totalMedia++;

      inconsistencias.push({
        materiaId: mp.materiaId,
        materiaNombre: mp.materiaNombre,
        materiaCodigo: mp.materiaCodigo,
        estadoPrograma: mp.estadoPrograma!,
        seccionesCompletas: mp.seccionesCompletas,
        seccionesPendientes: pendientes,
        prioridad,
      });
    }

    const datosFaltantes = hayContenido
      ? [
          {
            campo: 'contenidosTematicos / bibliografiaBasica',
            entidad: 'ProgramaAsignatura',
            descripcion:
              'Los ítems repetidos dentro de un programa (FSD §6.2) no pueden detectarse ' +
              'automáticamente: el contenido está almacenado como texto libre. ' +
              'Requiere revisión manual o campo estructurado con listas de ítems.',
          },
        ]
      : [];

    return {
      codigo: 'R-11',
      contextoId: contexto.planEstudioId,
      tipoContexto: 'PLAN',
      estadoImplementacion: 'IMPLEMENTADO',
      estadoCalculo: EstadoCalculo.CALCULADO,
      valor: {
        planEstudioId: contexto.planEstudioId,
        totalMaterias: materiasProgramas.length,
        totalConPrograma: materiasProgramas.length - sinPrograma.length,
        totalSinPrograma: sinPrograma.length,
        totalInconsistencias: inconsistencias.length,
        totalAlta,
        totalMedia,
        inconsistencias,
        sinPrograma,
        estadoCalculo: EstadoCalculo.CALCULADO,
      },
      datosFaltantes,
      fechaEvaluacion: contexto.fechaEvaluacion,
    };
  }
}
