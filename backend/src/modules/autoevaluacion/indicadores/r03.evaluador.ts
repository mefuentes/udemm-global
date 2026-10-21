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

export interface ComponentesUsoTopeR03 {
  horasDocencia: number;
  horasGestion: number;
  horasNoAcademico: number;
  /** Suma de los tres componentes conocidos. */
  usoTope: number;
}

export interface DocenteAlertaR03 {
  docenteId: string;
  nombre: string;
  componentes: ComponentesUsoTopeR03;
  exceso: number;
}

export type CausaNoDeterminableR03 = 'CROSS_FACULTAD' | 'DATOS_INCOMPLETOS';

export interface DocenteNoDeterminableR03 {
  docenteId: string;
  nombre: string;
  causa: CausaNoDeterminableR03;
  /** Suma parcial de horas conocidas; puede estar subestimada. */
  sumaParcialConocida: number;
  /** true cuando la suma parcial ya supera el límite (alerta confirmada a pesar de datos incompletos). */
  confirmadoEnAlerta: boolean;
  detalleDatos: string;
}

export interface ResultadoR03 {
  carreraId: string;
  facultadId: string;
  /** null cuando la configuración MOD-AUT no existe. */
  limite: number | null;
  totalDocentes: number;
  totalEnAlerta: number;
  enAlerta: DocenteAlertaR03[];
  totalNoDeterminables: number;
  noDeterminables: DocenteNoDeterminableR03[];
  alcanceFacultad: boolean;
}

// ── Parsing de componentes horarios ──────────────────────────────────────────

export interface ResultadoParseoGestion {
  horas: number;
  indeterminado: boolean;
}

/**
 * Parsea las horas del cargo de gestión académica (sección 5.1).
 *
 * Reglas:
 * - Sin dedicación declarada → 0h, no indeterminado (dato opcional ausente).
 * - Cargo vencido (fechaFin ≤ fechaCalculo) → 0h, no indeterminado.
 * - Vigente (fechaFin vacía o > fechaCalculo) con valor no entero → indeterminado.
 * - Vigente con valor entero → horas parseadas.
 */
export function parsearHorasGestion(
  tiempoDedicacionGestionSemanal: string | null | undefined,
  fechaFinGestion: string | null | undefined,
  fechaCalculo: Date,
): ResultadoParseoGestion {
  const dedicacion = tiempoDedicacionGestionSemanal?.trim() ?? '';
  if (dedicacion === '') return { horas: 0, indeterminado: false };

  const fin = fechaFinGestion?.trim() ?? '';
  if (fin !== '') {
    const hoy = fechaCalculo.toISOString().slice(0, 10); // 'YYYY-MM-DD'
    if (fin <= hoy) return { horas: 0, indeterminado: false }; // cargo vencido
  }

  if (!/^\d+$/.test(dedicacion)) return { horas: 0, indeterminado: true };

  return { horas: parseInt(dedicacion, 10), indeterminado: false };
}

export interface ResultadoParseoNoAcademico {
  horas: number;
  tieneIndeterminados: boolean;
}

/**
 * Parsea el JSON de desempeño no académico actual (sección 6.1).
 *
 * Reglas por ítem:
 * - dedicacionSeman ausente o vacío → 0h (opcional), no indeterminado.
 * - Formato no numérico (p. ej. "20h", "N/A", "-5") → ítem indeterminado.
 * - Valor válido /^\d+(\.\d+)?$/ y ≥ 0 → suma.
 * - JSON inválido o no-array → dato indeterminado global.
 */
export function parsearHorasNoAcademico(
  desempenoActualJson: string | null | undefined,
): ResultadoParseoNoAcademico {
  if (!desempenoActualJson?.trim()) return { horas: 0, tieneIndeterminados: false };

  let items: unknown[];
  try {
    const parsed: unknown = JSON.parse(desempenoActualJson);
    if (!Array.isArray(parsed)) return { horas: 0, tieneIndeterminados: false };
    items = parsed;
  } catch {
    return { horas: 0, tieneIndeterminados: true };
  }

  let horas = 0;
  let tieneIndeterminados = false;

  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue;
    const raw = (item as Record<string, unknown>)['dedicacionSeman'];
    if (raw === undefined || raw === null) continue;

    const str = String(raw).trim();
    if (str === '') continue;

    if (!/^\d+(\.\d+)?$/.test(str)) {
      tieneIndeterminados = true;
      continue;
    }
    const h = parseFloat(str);
    if (!isFinite(h) || h < 0) {
      tieneIndeterminados = true;
      continue;
    }
    horas += h;
  }

  return { horas, tieneIndeterminados };
}

// ── Constantes de datos faltantes estructurales ───────────────────────────────

const DP_SIN_CONFIG: DatoFaltante = {
  campo: 'p01TopeH',
  entidad: 'AutoevaluacionConfigFacultad',
  descripcion: 'Sin configuración MOD-AUT para la facultad; el tope semanal P-01 es necesario para calcular R-03.',
};

const DP_GESTION_UN_CARGO: DatoFaltante = {
  campo: 'tiempoDedicacionGestionSemanal',
  entidad: 'Docente',
  descripcion:
    'DP-R03-1: El modelo almacena un único cargo de gestión (sección 5.1). ' +
    'Docentes con múltiples cargos de gestión vigentes pueden tener horas de gestión subestimadas.',
};

const DP_DESEMPENO_NO_VALIDADO: DatoFaltante = {
  campo: 'dedicacionSeman',
  entidad: 'Docente.desempenoActualJson',
  descripcion:
    'DP-R03-2: El campo dedicacionSeman de desempenoActualJson no tiene validación numérica en backend. ' +
    'Valores no numéricos se clasifican como indeterminados y no se incluyen en la suma.',
};

const DP_ALCANCE_PARCIAL: DatoFaltante = {
  campo: 'vinculacionesOtrasCarreras',
  entidad: 'VinculacionCatedra',
  descripcion:
    'DIRECTOR_CARRERA: la evaluación cubre solo la carrera solicitada. ' +
    'Las horas de docencia del docente en otras carreras de la misma facultad no están incluidas en el usoTope.',
};

// ── Evaluador ─────────────────────────────────────────────────────────────────

const ROLES_ALCANCE_FACULTAD = new Set([
  'ADMINISTRADOR_SISTEMA',
  'SECRETARIA_ACADEMICA',
  'RECTORADO',
  'DECANO',
]);

@Injectable()
export class R03EvaluadorService implements IndicadorEvaluador<ResultadoR03> {
  constructor(private readonly consultas: ConsultasAcademicasService) {}

  async evaluar(contexto: ContextoEvaluacion): Promise<ResultadoIndicador<ResultadoR03>> {
    if (!contexto.carreraId) {
      throw new BadRequestException('R-03 requiere carreraId en el contexto de evaluación.');
    }

    const [docentesData, config] = await Promise.all([
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

    const { docentes, facultadId, alcanceFacultad, docentesMultiFacultad } = docentesData;

    if (docentes.length === 0) {
      return this.buildResultado(contexto, {
        carreraId: contexto.carreraId,
        facultadId,
        limite: config?.p01TopeH ?? null,
        totalDocentes: 0,
        totalEnAlerta: 0,
        enAlerta: [],
        totalNoDeterminables: 0,
        noDeterminables: [],
        alcanceFacultad,
      }, EstadoCalculo.NO_APLICA, []);
    }

    if (config === null) {
      return this.buildResultado(contexto, {
        carreraId: contexto.carreraId,
        facultadId,
        limite: null,
        totalDocentes: docentes.length,
        totalEnAlerta: 0,
        enAlerta: [],
        totalNoDeterminables: docentes.length,
        noDeterminables: docentes.map((d) => ({
          docenteId: d.docenteId,
          nombre: `${d.nombre} ${d.apellido}`.trim(),
          causa: 'DATOS_INCOMPLETOS' as const,
          sumaParcialConocida: 0,
          confirmadoEnAlerta: false,
          detalleDatos: 'Configuración MOD-AUT inexistente; P-01 desconocido.',
        })),
        alcanceFacultad,
      }, EstadoCalculo.NO_DETERMINABLE, [DP_SIN_CONFIG]);
    }

    const limite = config.p01TopeH;
    const enAlerta: DocenteAlertaR03[] = [];
    const noDeterminables: DocenteNoDeterminableR03[] = [];

    for (const d of docentes) {
      const nombre = `${d.nombre} ${d.apellido}`.trim();

      if (alcanceFacultad && docentesMultiFacultad.has(d.docenteId)) {
        const g = parsearHorasGestion(
          d.tiempoDedicacionGestionSemanal,
          d.fechaFinGestion,
          contexto.fechaEvaluacion,
        );
        const na = parsearHorasNoAcademico(d.desempenoActualJson);
        const sumaParcial = d.horasDocenciaConocidas + g.horas + na.horas;
        noDeterminables.push({
          docenteId: d.docenteId,
          nombre,
          causa: 'CROSS_FACULTAD',
          sumaParcialConocida: sumaParcial,
          confirmadoEnAlerta: sumaParcial > limite,
          detalleDatos:
            'Docente con vinculaciones APROBADAS en más de una facultad; ' +
            'sus horas de docencia en otras facultades no son visibles desde este scope.',
        });
        continue;
      }

      const g = parsearHorasGestion(
        d.tiempoDedicacionGestionSemanal,
        d.fechaFinGestion,
        contexto.fechaEvaluacion,
      );
      const na = parsearHorasNoAcademico(d.desempenoActualJson);
      const tieneIndeterminados =
        d.tieneMateriaSinHoras || g.indeterminado || na.tieneIndeterminados;
      const sumaParcial = d.horasDocenciaConocidas + g.horas + na.horas;

      if (sumaParcial > limite) {
        enAlerta.push({
          docenteId: d.docenteId,
          nombre,
          componentes: {
            horasDocencia: d.horasDocenciaConocidas,
            horasGestion: g.horas,
            horasNoAcademico: na.horas,
            usoTope: sumaParcial,
          },
          exceso: sumaParcial - limite,
        });
      } else if (tieneIndeterminados) {
        const detalle = [
          d.tieneMateriaSinHoras ? 'materias sin cargaHorariaSemanal en MOD-PDE' : '',
          g.indeterminado ? 'tiempoDedicacionGestionSemanal con valor no numérico' : '',
          na.tieneIndeterminados
            ? 'dedicacionSeman con valores no numéricos en desempenoActualJson'
            : '',
        ]
          .filter(Boolean)
          .join('; ');
        noDeterminables.push({
          docenteId: d.docenteId,
          nombre,
          causa: 'DATOS_INCOMPLETOS',
          sumaParcialConocida: sumaParcial,
          confirmadoEnAlerta: false,
          detalleDatos: detalle,
        });
      }
    }

    enAlerta.sort((a, b) => b.exceso - a.exceso || a.nombre.localeCompare(b.nombre));

    const datosFaltantes: DatoFaltante[] = [];
    if (!alcanceFacultad) {
      datosFaltantes.push(DP_ALCANCE_PARCIAL);
    } else if (docentesMultiFacultad.size > 0) {
      datosFaltantes.push({
        campo: 'vinculacionesOtrasFacultades',
        entidad: 'VinculacionCatedra',
        descripcion:
          `${docentesMultiFacultad.size} docente(s) con vinculaciones APROBADAS en más de una facultad; ` +
          'sus horas de docencia en otras facultades no están incluidas en el usoTope calculado.',
      });
    }
    datosFaltantes.push(DP_GESTION_UN_CARGO, DP_DESEMPENO_NO_VALIDADO);

    const estadoCalculo =
      !alcanceFacultad || docentesMultiFacultad.size > 0
        ? EstadoCalculo.PARCIAL
        : EstadoCalculo.CALCULADO;

    return this.buildResultado(
      contexto,
      {
        carreraId: contexto.carreraId,
        facultadId,
        limite,
        totalDocentes: docentes.length,
        totalEnAlerta: enAlerta.length,
        enAlerta,
        totalNoDeterminables: noDeterminables.length,
        noDeterminables,
        alcanceFacultad,
      },
      estadoCalculo,
      datosFaltantes,
    );
  }

  private buildResultado(
    contexto: ContextoEvaluacion,
    valor: ResultadoR03,
    estadoCalculo: EstadoCalculo,
    datosFaltantes: DatoFaltante[],
  ): ResultadoIndicador<ResultadoR03> {
    return {
      codigo: 'R-03',
      contextoId: contexto.carreraId!,
      tipoContexto: 'DOCENTE',
      estadoImplementacion: 'IMPLEMENTADO',
      estadoCalculo,
      valor,
      datosFaltantes,
      fechaEvaluacion: contexto.fechaEvaluacion,
    };
  }
}

// Solo para uso interno de ROLES_ALCANCE_FACULTAD fuera del evaluador
export { ROLES_ALCANCE_FACULTAD as ROLES_ALCANCE_FACULTAD_R03 };
