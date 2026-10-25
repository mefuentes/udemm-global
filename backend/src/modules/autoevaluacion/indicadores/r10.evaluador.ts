import { BadRequestException, Injectable } from '@nestjs/common';
import { ConsultasAcademicasService } from '../consultas-academicas/consultas-academicas.service';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type {
  ContextoEvaluacion,
  IndicadorEvaluador,
  ResultadoIndicador,
} from './indicadores.types';

// ── Constante ─────────────────────────────────────────────────────────────────

/** Umbral por defecto cuando p02BajaH no está configurado (FSD §5.3). */
const UMBRAL_DEFAULT = 20;

// ── Tipos de resultado ────────────────────────────────────────────────────────

export interface DocenteAlertaR10 {
  docenteId: string;
  nombre: string;
  /** Suma de Materia.cargaHorariaSemanal de vinculaciones APROBADAS en el scope. */
  horasConocidas: number;
  umbral: number;
  /**
   * true cuando el docente tiene materias sin cargaHorariaSemanal O asignaciones
   * en otras facultades: el total real de horas podría superar horasConocidas.
   */
  incierto: boolean;
}

/**
 * Valor del indicador R-10 para una carrera.
 *
 * - umbral: p02BajaH configurado o 20 por defecto.
 * - totalEnAlerta: docentes con horasConocidas < umbral e incierto=false (alerta confirmada).
 * - totalInciertos: docentes con horasConocidas < umbral e incierto=true (posible alerta).
 * - enAlerta: lista combinada de confirmados e inciertos, ordenada por horasConocidas ASC.
 */
export interface ResultadoR10 {
  carreraId: string;
  umbral: number;
  totalDocentes: number;
  totalEnAlerta: number;
  totalInciertos: number;
  enAlerta: DocenteAlertaR10[];
  alcanceFacultad: boolean;
  estadoCalculo: EstadoCalculo;
}

// ── Evaluador ─────────────────────────────────────────────────────────────────

/**
 * Evaluador de R-10: Docentes con baja dedicación horaria.
 *
 * Umbral: p02BajaH de AutoevaluacionConfigFacultad; 20h semanales si no configurado.
 * Alertas INFORMATIVAS: no implican infracción directa ni penalización en el score.
 *
 * Fuente de horas: Materia.cargaHorariaSemanal sumado por vinculación APROBADA en scope
 * (misma fuente que R-03, vía obtenerDocentesParaR03 que ya agrega por docenteId).
 *
 * Si una materia no tiene cargaHorariaSemanal, la alerta se marca incierto=true
 * (el total real podría superar las horas conocidas).
 *
 * Alcance (vía obtenerDocentesParaR03):
 *   Roles globales y DECANO: toda la facultad (alcanceFacultad=true).
 *   DIRECTOR_CARRERA: solo la carrera solicitada (alcanceFacultad=false → PARCIAL).
 *
 * Estado de cálculo:
 *   NO_APLICA:  sin docentes activos con vinculaciones APROBADAS en el scope.
 *   CALCULADO:  alcanceFacultad=true y todas las materias tienen cargaHorariaSemanal.
 *   PARCIAL:    alcanceFacultad=false O alguna materia/docente sin horas completas.
 */
@Injectable()
export class R10EvaluadorService implements IndicadorEvaluador<ResultadoR10> {
  constructor(private readonly consultas: ConsultasAcademicasService) {}

  async evaluar(contexto: ContextoEvaluacion): Promise<ResultadoIndicador<ResultadoR10>> {
    if (!contexto.carreraId) {
      throw new BadRequestException(
        'R-10 requiere carreraId. Proporcione el identificador de la carrera a evaluar.',
      );
    }

    const [datos, config] = await Promise.all([
      this.consultas.obtenerDocentesParaR03(
        contexto.carreraId,
        contexto.usuarioId,
        contexto.rolNombre,
      ),
      this.consultas.obtenerConfigDeCarrera(
        contexto.carreraId,
        contexto.usuarioId,
        contexto.rolNombre,
      ),
    ]);

    const umbral = config?.p02BajaH ?? UMBRAL_DEFAULT;
    const { docentes, alcanceFacultad, docentesMultiFacultad } = datos;

    if (docentes.length === 0) {
      return {
        codigo: 'R-10',
        contextoId: contexto.carreraId,
        tipoContexto: 'CARRERA',
        estadoImplementacion: 'IMPLEMENTADO',
        estadoCalculo: EstadoCalculo.NO_APLICA,
        valor: {
          carreraId: contexto.carreraId,
          umbral,
          totalDocentes: 0,
          totalEnAlerta: 0,
          totalInciertos: 0,
          enAlerta: [],
          alcanceFacultad,
          estadoCalculo: EstadoCalculo.NO_APLICA,
        },
        datosFaltantes: [],
        fechaEvaluacion: contexto.fechaEvaluacion,
      };
    }

    const enAlerta: DocenteAlertaR10[] = [];
    let hayDatosIncompletos = false;

    for (const d of docentes) {
      if (d.tieneMateriaSinHoras) hayDatosIncompletos = true;

      // Docentes con asignaciones cross-facultad tienen horas fuera del scope visible
      const esCrossFacultad = docentesMultiFacultad.has(d.docenteId);

      if (d.horasDocenciaConocidas < umbral) {
        const incierto = d.tieneMateriaSinHoras || esCrossFacultad;
        enAlerta.push({
          docenteId: d.docenteId,
          nombre: `${d.nombre} ${d.apellido}`.trim(),
          horasConocidas: d.horasDocenciaConocidas,
          umbral,
          incierto,
        });
      }
    }

    if (docentesMultiFacultad.size > 0) hayDatosIncompletos = true;

    enAlerta.sort((a, b) => a.horasConocidas - b.horasConocidas);

    const estadoCalculo =
      !alcanceFacultad || hayDatosIncompletos
        ? EstadoCalculo.PARCIAL
        : EstadoCalculo.CALCULADO;

    const datosFaltantes =
      hayDatosIncompletos
        ? [
            {
              campo: 'cargaHorariaSemanal',
              entidad: 'Materia',
              descripcion:
                'Algunas materias no tienen cargaHorariaSemanal; las horas conocidas pueden estar subestimadas.',
            },
          ]
        : [];

    return {
      codigo: 'R-10',
      contextoId: contexto.carreraId,
      tipoContexto: 'CARRERA',
      estadoImplementacion: 'IMPLEMENTADO',
      estadoCalculo,
      valor: {
        carreraId: contexto.carreraId,
        umbral,
        totalDocentes: docentes.length,
        totalEnAlerta: enAlerta.filter((a) => !a.incierto).length,
        totalInciertos: enAlerta.filter((a) => a.incierto).length,
        enAlerta,
        alcanceFacultad,
        estadoCalculo,
      },
      datosFaltantes,
      fechaEvaluacion: contexto.fechaEvaluacion,
    };
  }
}
