import { BadRequestException, Injectable } from '@nestjs/common';
import { ConsultasAcademicasService } from '../consultas-academicas/consultas-academicas.service';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type { VinculacionesParaR07 } from '../consultas-academicas/consultas-academicas.types';
import type {
  ContextoEvaluacion,
  DatoFaltante,
  IndicadorEvaluador,
  ResultadoIndicador,
} from './indicadores.types';

// ── Tipos de resultado ────────────────────────────────────────────────────────

export interface DocenteDistribucionR06 {
  docenteId: string;
  /** Nombre completo: docente.nombre + ' ' + docente.apellido */
  nombre: string;
  nMaterias: number;
}

/**
 * Valor del indicador R-06 para la facultad (o carrera cuando alcanceFacultad=false).
 *
 * Unidad de conteo: materias DISTINTAS (distinct materiaId) por docenteId.
 * Una misma materia en múltiples cátedras o planes cuenta como 1 materia.
 *
 * alcanceFacultad=true:  distribucion abarca TODAS las carreras de la facultad (dedup cross-carrera).
 * alcanceFacultad=false: distribucion limitada a la carrera indicada (DIRECTOR_CARRERA → PARCIAL).
 *
 * - totalDocentes: docentes con ≥1 vinculación APROBADA en el alcance.
 * - promedio / mediana / maximo: null si totalDocentes = 0 (estadoCalculo NO_APLICA).
 * - distribucion: ordenada por nMaterias DESC, luego nombre ASC.
 */
export interface ResultadoR06 {
  facultadId: string;
  /** Solo presente cuando alcanceFacultad=false; identifica la carrera evaluada */
  carreraId?: string;
  alcanceFacultad: boolean;
  totalDocentes: number;
  promedio: number | null;
  mediana: number | null;
  maximo: number | null;
  distribucion: DocenteDistribucionR06[];
}

// ── Evaluador ─────────────────────────────────────────────────────────────────

/**
 * Evaluador de R-06: Distribución de materias por docente a nivel facultad.
 *
 * Definición funcional (prototipo MOD-AUT v5.1 líneas 349, 319-324, 603, 622):
 *   "Materias por docente: promedio, mediana y máximo."
 *
 * Vinculaciones efectivas:
 *   estado = 'APROBADA', docente.activo = true. Los demás estados no se computan.
 *
 * Universo de docentes:
 *   Docentes con ≥1 vinculación APROBADA en el alcance del rol.
 *   Roles globales y DECANO: todas las carreras de la facultad.
 *   DIRECTOR_CARRERA: solo su carrera (alcanceFacultad=false → EstadoCalculo.PARCIAL).
 *
 * Unidad de conteo:
 *   Distinct materiaId por docenteId. Una misma materia en distintas cátedras o planes = 1 materia.
 *   Dedup cross-carrera: el mismo docente en dos carreras acumula materias de ambas.
 *
 * Parámetro obligatorio:
 *   carreraId en ContextoEvaluacion (usado como punto de entrada para resolución de facultad).
 */
@Injectable()
export class R06EvaluadorService implements IndicadorEvaluador<ResultadoR06> {
  constructor(private readonly consultas: ConsultasAcademicasService) {}

  async evaluar(contexto: ContextoEvaluacion): Promise<ResultadoIndicador<ResultadoR06>> {
    if (!contexto.carreraId) {
      throw new BadRequestException(
        'R-06 requiere carreraId como punto de entrada. Proporcione el identificador de la carrera.',
      );
    }

    const data = await this.consultas.obtenerVinculacionesParaR06(
      contexto.carreraId,
      contexto.usuarioId,
      contexto.rolNombre,
    );

    return this.computarDesdeVinculaciones(
      data,
      data.facultadId,
      contexto.carreraId,
      contexto.fechaEvaluacion,
    );
  }

  /**
   * Evaluación directa por facultadId, sin verificación de scope/rol.
   * Usada por TablroFacultadService, que ya autorizó al usuario.
   */
  async evaluarPorFacultad(
    facultadId: string,
    fechaEvaluacion: Date,
  ): Promise<ResultadoIndicador<ResultadoR06>> {
    const data = await this.consultas.obtenerVinculacionesParaR06PorFacultad(facultadId);
    return this.computarDesdeVinculaciones(data, facultadId, undefined, fechaEvaluacion);
  }

  private computarDesdeVinculaciones(
    data: VinculacionesParaR07,
    contextoId: string,
    carreraId: string | undefined,
    fechaEvaluacion: Date,
  ): ResultadoIndicador<ResultadoR06> {
    const { vinculaciones, facultadId, alcanceFacultad } = data;
    const aprobadas = vinculaciones.filter((v) => v.estado === 'APROBADA' && v.docente.activo);

    const datosFaltantes: DatoFaltante[] = alcanceFacultad
      ? []
      : [
          {
            campo: 'carrerasRestantes',
            entidad: 'Facultad',
            descripcion:
              'DIRECTOR_CARRERA evalúa solo su carrera; el indicador no puede abarcar toda la facultad.',
          },
        ];

    if (aprobadas.length === 0) {
      return {
        codigo: 'R-06',
        contextoId,
        tipoContexto: 'FACULTAD',
        estadoImplementacion: 'IMPLEMENTADO',
        estadoCalculo: EstadoCalculo.NO_APLICA,
        valor: {
          facultadId,
          carreraId: alcanceFacultad ? undefined : carreraId,
          alcanceFacultad,
          totalDocentes: 0,
          promedio: null,
          mediana: null,
          maximo: null,
          distribucion: [],
        },
        datosFaltantes,
        fechaEvaluacion,
      };
    }

    // Dedup: distinct materiaId por docenteId (cross-carrera cuando alcanceFacultad=true)
    const porDocente = new Map<string, { nombre: string; materias: Set<string> }>();
    for (const v of aprobadas) {
      const entry = porDocente.get(v.docenteId) ?? {
        nombre: `${v.docente.nombre} ${v.docente.apellido}`.trim(),
        materias: new Set<string>(),
      };
      entry.materias.add(v.materiaId);
      porDocente.set(v.docenteId, entry);
    }

    const distribucion: DocenteDistribucionR06[] = [];
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

    return {
      codigo: 'R-06',
      contextoId,
      tipoContexto: 'FACULTAD',
      estadoImplementacion: 'IMPLEMENTADO',
      estadoCalculo: alcanceFacultad ? EstadoCalculo.CALCULADO : EstadoCalculo.PARCIAL,
      valor: {
        facultadId,
        carreraId: alcanceFacultad ? undefined : carreraId,
        alcanceFacultad,
        totalDocentes: distribucion.length,
        promedio,
        mediana,
        maximo,
        distribucion,
      },
      datosFaltantes,
      fechaEvaluacion,
    };
  }
}

function calcMedian(sorted: number[]): number {
  const m = sorted.length >> 1;
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}
