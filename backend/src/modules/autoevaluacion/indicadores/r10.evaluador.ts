import { BadRequestException, Injectable } from '@nestjs/common';
import { ConsultasAcademicasService } from '../consultas-academicas/consultas-academicas.service';
import { EstadoCalculo } from '../types/estado-calculo.types';
import { parsearHorasGestion } from './r03.evaluador';
import type {
  ContextoEvaluacion,
  IndicadorEvaluador,
  ResultadoIndicador,
} from './indicadores.types';
import type { DocentesParaR10 } from '../consultas-academicas/consultas-academicas.types';

// ── Constante ─────────────────────────────────────────────────────────────────

/** Umbral por defecto cuando p02BajaH no está configurado (FSD §5.3). */
const UMBRAL_DEFAULT = 20;

// ── Tipos de resultado ────────────────────────────────────────────────────────

/**
 * Desglose de componentes horarios para R-10 (FSD §6: dedicación total).
 * Dedicación total = docencia + gestión + investigación + vinculación.
 *
 * NOTA: desempeño no académico (desempenoActualJson) NO forma parte de esta fórmula;
 * pertenece a R-03 (carga para el tope). Ver FSD §6 distinción entre R-03 y R-10.
 */
export interface ComponentesHorasR10 {
  horasDocencia: number;
  horasGestion: number;
  horasInvestigacion: number;
  horasVinculacion: number;
  /** true = tiempoDedicacionGestionSemanal tiene valor pero no es numérico parseable,
   *  O funcionGestion declarada pero tiempoDedicacionGestionSemanal vacía (FSD §3). */
  gestionIndeterminada: boolean;
  /** true = tiempoInvestigacion no numérico, o proyecto declarado sin horas (FSD §3). */
  investigacionIndeterminada: boolean;
  /** true = tiempoExtension no numérico, o actividad declarada sin horas (FSD §3). */
  vinculacionIndeterminada: boolean;
}

export interface DocenteAlertaR10 {
  docenteId: string;
  nombre: string;
  /**
   * Total de horas determinadas: docencia + gestión + investigación + vinculación.
   * Puede estar subestimado cuando incierto=true.
   */
  horasConocidas: number;
  umbral: number;
  /**
   * true cuando el total real podría superar horasConocidas:
   * materias sin cargaHorariaSemanal, asignaciones cross-facultad,
   * o algún componente indeterminado (valor no numérico o actividad declarada sin horas).
   */
  incierto: boolean;
  componentes: ComponentesHorasR10;
}

/**
 * Valor del indicador R-10 para una carrera.
 *
 * - umbral: p02BajaH configurado o 20h por defecto.
 * - totalEnAlerta: docentes con horasConocidas < umbral e incierto=false (confirmados).
 * - totalInciertos: docentes con horasConocidas < umbral e incierto=true (posible alerta).
 * - enAlerta: lista combinada ordenada por horasConocidas ASC.
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
 * Evaluador de R-10: Docentes con baja dedicación horaria total (FSD §6).
 *
 * Fórmula: dedicación total = docencia + gestión + investigación + vinculación.
 * Umbral: p02BajaH de AutoevaluacionConfigFacultad; 20h semanales si no configurado.
 *
 * Reglas de indeterminación (FSD §3 — no asumir 0h):
 *   - Campo de horas no numérico → indeterminado.
 *   - Actividad declarada (funcionGestion / tituloProyectoInvestigacion /
 *     rolActividadExtension) pero campo de horas vacío → indeterminado.
 *   - Actividad no declarada y campo de horas vacío → 0h (opcional ausente).
 *
 * Fuente: obtenerDocentesParaR10 (agrega por docenteId, incluye campos investigación/vinculación).
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
      this.consultas.obtenerDocentesParaR10(
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
    const { docentes, alcanceFacultad, docentesMultiFacultad } = datos as DocentesParaR10;

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

      const esCrossFacultad = docentesMultiFacultad.has(d.docenteId);

      const g = parsearHorasGestion(
        d.tiempoDedicacionGestionSemanal,
        d.fechaFinGestion,
        contexto.fechaEvaluacion,
        !!(d.funcionGestion?.trim()),
      );
      const inv = parsearHorasGestion(
        d.tiempoInvestigacion,
        d.fechaFinProyectoInvestigacion,
        contexto.fechaEvaluacion,
        !!(d.tituloProyectoInvestigacion?.trim()),
      );
      const vin = parsearHorasGestion(
        d.tiempoExtension,
        d.finEstadoActividadExtension,
        contexto.fechaEvaluacion,
        !!(d.rolActividadExtension?.trim()),
      );

      const tieneComponentesIndeterminados =
        g.indeterminado || inv.indeterminado || vin.indeterminado;
      if (tieneComponentesIndeterminados) hayDatosIncompletos = true;

      const horasConocidas =
        d.horasDocenciaConocidas + g.horas + inv.horas + vin.horas;

      if (horasConocidas < umbral) {
        const incierto =
          d.tieneMateriaSinHoras || esCrossFacultad || tieneComponentesIndeterminados;
        enAlerta.push({
          docenteId: d.docenteId,
          nombre: `${d.nombre} ${d.apellido}`.trim(),
          horasConocidas,
          umbral,
          incierto,
          componentes: {
            horasDocencia: d.horasDocenciaConocidas,
            horasGestion: g.horas,
            horasInvestigacion: inv.horas,
            horasVinculacion: vin.horas,
            gestionIndeterminada: g.indeterminado,
            investigacionIndeterminada: inv.indeterminado,
            vinculacionIndeterminada: vin.indeterminado,
          },
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
              campo:
                'cargaHorariaSemanal / tiempoDedicacionGestionSemanal / tiempoInvestigacion / tiempoExtension',
              entidad: 'Materia / Docente',
              descripcion:
                'Algunas horas no son determinables: materias sin cargaHorariaSemanal, ' +
                'gestión/investigación/vinculación con valores no numéricos o actividades declaradas sin horas.',
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
