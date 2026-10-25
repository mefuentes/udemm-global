import { BadRequestException, Injectable } from '@nestjs/common';
import { ConsultasAcademicasService } from '../consultas-academicas/consultas-academicas.service';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type {
  ContextoEvaluacion,
  IndicadorEvaluador,
  ResultadoIndicador,
} from './indicadores.types';

// ── Tipos de resultado ────────────────────────────────────────────────────────

export interface DocenteDistribucionR15 {
  docenteId: string;
  nombre: string;
  nMaterias: number;
}

export interface DocenteAlertaR15 {
  docenteId: string;
  nombre: string;
  nMaterias: number;
  /** nMaterias - limite */
  exceso: number;
}

/**
 * Valor del indicador R-15 para una carrera.
 *
 * Unidad de conteo: materias DISTINTAS (distinct materiaId) por docenteId,
 * siempre limitado a la carrera solicitada (sin extensión cross-carrera).
 *
 * Estadísticas: mediana (principal), promedio, máximo — null cuando totalDocentes = 0.
 * limite: p03MaxMat configurado; null si la configuración de facultad no existe.
 * enAlerta: docentes con nMaterias > limite (comparación estricta).
 */
export interface ResultadoR15 {
  carreraId: string;
  /** p03MaxMat utilizado; null si config no existe. */
  limite: number | null;
  totalDocentes: number;
  promedio: number | null;
  mediana: number | null;
  maximo: number | null;
  distribucion: DocenteDistribucionR15[];
  totalEnAlerta: number;
  enAlerta: DocenteAlertaR15[];
}

// ── Evaluador ─────────────────────────────────────────────────────────────────

/**
 * Evaluador de R-15: Materias por docente limitado a la carrera seleccionada.
 *
 * Reutiliza la lógica de R-06 (mediana, promedio, máximo) y añade verificación
 * contra el límite p03MaxMat (FSD §5.3). A diferencia de R-07 (cross-carrera
 * con alcance facultad), R-15 evalúa SIEMPRE únicamente la carrera solicitada.
 *
 * Vinculaciones efectivas: estado = 'APROBADA' + docente.activo = true.
 * Unidad de conteo: distinct materiaId por docenteId (misma materia en distintas
 * cátedras cuenta como 1).
 *
 * Estado de cálculo:
 *   NO_APLICA:       sin vinculaciones APROBADAS activas en la carrera.
 *   NO_DETERMINABLE: config de facultad sin p03MaxMat (no puede determinar alertas).
 *   CALCULADO:       evaluación completa.
 */
@Injectable()
export class R15EvaluadorService implements IndicadorEvaluador<ResultadoR15> {
  constructor(private readonly consultas: ConsultasAcademicasService) {}

  async evaluar(contexto: ContextoEvaluacion): Promise<ResultadoIndicador<ResultadoR15>> {
    if (!contexto.carreraId) {
      throw new BadRequestException(
        'R-15 requiere carreraId. Proporcione el identificador de la carrera a evaluar.',
      );
    }

    const [vinculaciones, config] = await Promise.all([
      this.consultas.obtenerVinculacionesDeCarrera(
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

    const aprobadas = vinculaciones.filter((v) => v.estado === 'APROBADA' && v.docente.activo);
    const limite = config?.p03MaxMat ?? null;

    if (aprobadas.length === 0) {
      return {
        codigo: 'R-15',
        contextoId: contexto.carreraId,
        tipoContexto: 'CARRERA',
        estadoImplementacion: 'IMPLEMENTADO',
        estadoCalculo: EstadoCalculo.NO_APLICA,
        valor: {
          carreraId: contexto.carreraId,
          limite,
          totalDocentes: 0,
          promedio: null,
          mediana: null,
          maximo: null,
          distribucion: [],
          totalEnAlerta: 0,
          enAlerta: [],
        },
        datosFaltantes: [],
        fechaEvaluacion: contexto.fechaEvaluacion,
      };
    }

    // Aggregate: distinct materiaId per docenteId (same logic as R-06)
    const porDocente = new Map<string, { nombre: string; materias: Set<string> }>();
    for (const v of aprobadas) {
      const entry = porDocente.get(v.docenteId) ?? {
        nombre: `${v.docente.nombre} ${v.docente.apellido}`.trim(),
        materias: new Set<string>(),
      };
      entry.materias.add(v.materiaId);
      porDocente.set(v.docenteId, entry);
    }

    const distribucion: DocenteDistribucionR15[] = [];
    const nMats: number[] = [];

    for (const [docenteId, { nombre, materias }] of porDocente) {
      distribucion.push({ docenteId, nombre, nMaterias: materias.size });
      nMats.push(materias.size);
    }

    distribucion.sort((a, b) => b.nMaterias - a.nMaterias || a.nombre.localeCompare(b.nombre));

    const sorted = [...nMats].sort((a, b) => a - b);
    const promedio = nMats.reduce((a, b) => a + b, 0) / nMats.length;
    const mediana = calcMedian(sorted);
    const maximo = sorted[sorted.length - 1];

    if (limite === null) {
      return {
        codigo: 'R-15',
        contextoId: contexto.carreraId,
        tipoContexto: 'CARRERA',
        estadoImplementacion: 'IMPLEMENTADO',
        estadoCalculo: EstadoCalculo.NO_DETERMINABLE,
        valor: {
          carreraId: contexto.carreraId,
          limite: null,
          totalDocentes: distribucion.length,
          promedio,
          mediana,
          maximo,
          distribucion,
          totalEnAlerta: 0,
          enAlerta: [],
        },
        datosFaltantes: [
          {
            campo: 'p03MaxMat',
            entidad: 'AutoevaluacionConfigFacultad',
            descripcion: 'Límite máximo de materias por docente no configurado para la facultad.',
          },
        ],
        fechaEvaluacion: contexto.fechaEvaluacion,
      };
    }

    const enAlerta: DocenteAlertaR15[] = distribucion
      .filter((d) => d.nMaterias > limite)
      .map((d) => ({
        docenteId: d.docenteId,
        nombre: d.nombre,
        nMaterias: d.nMaterias,
        exceso: d.nMaterias - limite,
      }));

    return {
      codigo: 'R-15',
      contextoId: contexto.carreraId,
      tipoContexto: 'CARRERA',
      estadoImplementacion: 'IMPLEMENTADO',
      estadoCalculo: EstadoCalculo.CALCULADO,
      valor: {
        carreraId: contexto.carreraId,
        limite,
        totalDocentes: distribucion.length,
        promedio,
        mediana,
        maximo,
        distribucion,
        totalEnAlerta: enAlerta.length,
        enAlerta,
      },
      datosFaltantes: [],
      fechaEvaluacion: contexto.fechaEvaluacion,
    };
  }
}

function calcMedian(sorted: number[]): number {
  const m = sorted.length >> 1;
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}
