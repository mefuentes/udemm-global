import { Injectable } from '@nestjs/common';
import type {
  AlcanceIndicador,
  EstadoImplementacion,
  IndicadorEvaluador,
  SeveridadIndicador,
  TipoIndicador,
} from './indicadores.types';

/** Grupo de análisis al que pertenece la regla dentro del FSD MOD-AUT v2.0. */
export type GrupoAnalisis = 'CRUZADAS' | 'DOCENTES' | 'PLANES';

/**
 * Parámetro de configuración institucional asociado a una regla.
 * configurable=false indica que el campo de persistencia no existe en el schema actual.
 */
export interface ParametroRegla {
  /** Código del parámetro (P-01..P-14, P-FP1, P-FP2, P-FP3). */
  codigo: string;
  nombre: string;
  descripcion: string;
  unidad: string;
  /** Tabla/nivel donde se configura el valor. */
  origen: 'FACULTAD' | 'PLAN' | 'MATERIA';
  /** Nombre del campo en la base de datos, cuando configurable=true. */
  campoDb: string;
  /** true si el campo existe en el schema y puede modificarse vía API. */
  configurable: boolean;
  /** Motivo por el que el parámetro no es configurable (solo cuando configurable=false). */
  dependenciaPendiente?: string;
}

export interface DefinicionIndicador {
  codigo: string;
  nombre: string;
  descripcion: string;
  tipo: TipoIndicador;
  severidad: SeveridadIndicador;
  alcance: AlcanceIndicador;
  grupo: GrupoAnalisis;
  estadoImplementacion: EstadoImplementacion;
  /** Razón por la que la implementación no es completa. Presente en NO_IMPLEMENTADO y PARCIAL. */
  motivoPendiente?: string;
  /** Parámetros de configuración institucional que consume esta regla. */
  parametros: ParametroRegla[];
  evaluador?: IndicadorEvaluador<unknown>;
}

/**
 * Registro explícito de indicadores MOD-AUT.
 *
 * Diseño:
 * - Cada indicador se registra con sus metadatos funcionales.
 * - Los evaluadores se asignan en fases posteriores sin modificar la estructura.
 * - Los códigos deben ser únicos; el registro rechaza duplicados en tiempo de construcción.
 *
 * Fuente: prototipo Modulo_Autoevaluacion_v5_1.html + FSD_MODAUT_v1_1.docx.
 * R-01 y R-05 fueron eliminados en MOD-DOC v8.1 (dedicación y categoría no declaradas).
 */
@Injectable()
export class RegistroIndicadores {
  private readonly _mapa = new Map<string, DefinicionIndicador>();

  constructor() {
    this.registrarTodos();
  }

  private registrar(def: DefinicionIndicador): void {
    if (this._mapa.has(def.codigo)) {
      throw new Error(`Código duplicado en RegistroIndicadores: ${def.codigo}`);
    }
    this._mapa.set(def.codigo, { ...def });
  }

  obtener(codigo: string): DefinicionIndicador | undefined {
    return this._mapa.get(codigo);
  }

  listar(): DefinicionIndicador[] {
    return Array.from(this._mapa.values());
  }

  tieneEvaluador(codigo: string): boolean {
    return this._mapa.get(codigo)?.evaluador !== undefined;
  }

  /**
   * Asigna un evaluador concreto a un indicador registrado.
   * Solo promueve de NO_IMPLEMENTADO → IMPLEMENTADO; preserva PARCIAL y IMPLEMENTADO.
   */
  asignarEvaluador(codigo: string, evaluador: IndicadorEvaluador<unknown>): void {
    const def = this._mapa.get(codigo);
    if (!def) throw new Error(`No existe el indicador ${codigo} en el registro`);
    def.evaluador = evaluador;
    if (def.estadoImplementacion === 'NO_IMPLEMENTADO') {
      def.estadoImplementacion = 'IMPLEMENTADO';
      def.motivoPendiente = undefined;
    }
  }

  private registrarTodos(): void {
    // ── Cruzadas DOC ↔ PDE ────────────────────────────────────────────────────

    this.registrar({
      codigo: 'R-02',
      nombre: 'Doble responsable de cátedra',
      descripcion:
        'Una asignatura no puede tener dos responsables de cátedra activos al mismo tiempo. ' +
        'La unidad de evaluación es (materiaId, catedraId): dos responsables en cátedras ' +
        'diferentes no constituyen incumplimiento (prototipo v5.1, línea 387-390).',
      tipo: 'ALERTA',
      severidad: 'ALTA',
      alcance: 'PLAN',
      grupo: 'CRUZADAS',
      estadoImplementacion: 'IMPLEMENTADO',
      parametros: [],
    });

    this.registrar({
      codigo: 'R-04',
      nombre: 'Cargo sin actividad curricular',
      descripcion:
        'Cargo docente vigente sin ninguna asignación a cátedra.',
      tipo: 'ALERTA',
      severidad: 'ALTA',
      alcance: 'DOCENTE',
      grupo: 'CRUZADAS',
      estadoImplementacion: 'IMPLEMENTADO',
      parametros: [],
    });

    this.registrar({
      codigo: 'R-08',
      nombre: 'Materias sin responsable de cátedra',
      descripcion:
        'Listado de materias del plan que no tienen ningún responsable de cátedra vigente (APROBADA + esResponsableCatedra=true).',
      tipo: 'ALERTA',
      severidad: 'ALTA',
      alcance: 'PLAN',
      grupo: 'CRUZADAS',
      estadoImplementacion: 'IMPLEMENTADO',
      parametros: [],
    });

    // ── Docentes ──────────────────────────────────────────────────────────────

    this.registrar({
      codigo: 'R-03',
      nombre: 'Tope semanal de horas docentes',
      descripcion:
        'Docencia + gestión + desempeño no académico superan el tope semanal configurado (p01TopeH, ref. CONEAU Global).',
      tipo: 'ALERTA',
      severidad: 'ALTA',
      alcance: 'DOCENTE',
      grupo: 'DOCENTES',
      estadoImplementacion: 'IMPLEMENTADO',
      parametros: [
        {
          codigo: 'P-01',
          nombre: 'Tope semanal de horas docentes',
          descripcion: 'Máximo de horas semanales permitidas por docente (docencia + gestión + desempeño no académico).',
          unidad: 'h/semana',
          origen: 'FACULTAD',
          campoDb: 'p01TopeH',
          configurable: true,
        },
      ],
    });

    this.registrar({
      codigo: 'R-06',
      nombre: 'Distribución de materias por docente',
      descripcion:
        'Materias por docente del plantel a nivel FACULTAD: promedio, mediana y máximo. ' +
        'El evaluador agrega todas las carreras de la facultad (roles globales y DECANO); ' +
        'DIRECTOR_CARRERA obtiene un resultado PARCIAL limitado a su carrera.',
      tipo: 'INDICADOR',
      severidad: 'NINGUNA',
      alcance: 'FACULTAD',
      grupo: 'DOCENTES',
      estadoImplementacion: 'IMPLEMENTADO',
      parametros: [],
    });

    this.registrar({
      codigo: 'R-07',
      nombre: 'Docentes sobre-asignados',
      descripcion:
        'Listado de docentes con más materias vigentes que el máximo permitido (p03MaxMat).',
      tipo: 'ALERTA',
      severidad: 'ALTA',
      alcance: 'DOCENTE',
      grupo: 'DOCENTES',
      estadoImplementacion: 'IMPLEMENTADO',
      parametros: [
        {
          codigo: 'P-03',
          nombre: 'Máximo de materias por docente',
          descripcion: 'Cantidad máxima de materias vigentes permitidas simultáneamente por docente.',
          unidad: 'materias',
          origen: 'FACULTAD',
          campoDb: 'p03MaxMat',
          configurable: true,
        },
      ],
    });

    this.registrar({
      codigo: 'R-10',
      nombre: 'Docentes con baja dedicación',
      descripcion:
        'Docentes cuya carga horaria semanal (cargaHorariaSemanal numérico) es menor al umbral ' +
        'de baja dedicación (p02BajaH). Integrado en tablero de carrera. ' +
        'Usa datos numéricos de CargoDocente; no infiere categorías textuales.',
      tipo: 'DETALLE',
      severidad: 'INFORMATIVA',
      alcance: 'DOCENTE',
      grupo: 'DOCENTES',
      estadoImplementacion: 'IMPLEMENTADO',
      parametros: [
        {
          codigo: 'P-02',
          nombre: 'Umbral de baja dedicación',
          descripcion: 'Umbral de horas semanales por debajo del cual la dedicación se clasifica como baja.',
          unidad: 'h/semana',
          origen: 'FACULTAD',
          campoDb: 'p02BajaH',
          configurable: true,
        },
      ],
    });

    this.registrar({
      codigo: 'R-12',
      nombre: 'Ficha docente incompleta',
      descripcion:
        'Campos obligatorios faltantes en la ficha docente: datos personales, título de grado, área de desempeño o cargo vigente con vinculación.',
      tipo: 'ALERTA',
      severidad: 'MEDIA',
      alcance: 'DOCENTE',
      grupo: 'DOCENTES',
      estadoImplementacion: 'IMPLEMENTADO',
      parametros: [],
    });

    this.registrar({
      codigo: 'R-15',
      nombre: 'Materias por docente de la carrera',
      descripcion:
        'Distribución de materias distintas por docente activo con vinculaciones APROBADAS ' +
        'en la carrera seleccionada. Estadísticas: mediana, promedio, máximo. ' +
        'Genera alerta cuando un docente supera el límite p03MaxMat. ' +
        'A diferencia de R-07, el alcance está estrictamente limitado a la carrera evaluada ' +
        '(sin extensión cross-carrera). Integrado en el tablero de carrera como IP-04.',
      tipo: 'ALERTA',
      severidad: 'MEDIA',
      alcance: 'CARRERA',
      grupo: 'DOCENTES',
      estadoImplementacion: 'IMPLEMENTADO',
      parametros: [
        {
          codigo: 'P-03',
          nombre: 'Máximo de materias por docente',
          descripcion: 'Cantidad máxima de materias vigentes permitidas simultáneamente por docente.',
          unidad: 'materias',
          origen: 'FACULTAD',
          campoDb: 'p03MaxMat',
          configurable: true,
        },
      ],
    });

    // ── Planes de estudio ─────────────────────────────────────────────────────

    this.registrar({
      codigo: 'R-09',
      nombre: 'Umbrales horarios del plan de estudios',
      descripcion:
        'El plan debe superar las horas mínimas totales (horasMinTotales) y las de cada bloque curricular (CB, TB, TA, CX → horasMinCTX).',
      tipo: 'ALERTA',
      severidad: 'ALTA',
      alcance: 'PLAN',
      grupo: 'PLANES',
      estadoImplementacion: 'IMPLEMENTADO',
      parametros: [
        {
          codigo: 'P-10',
          nombre: 'Horas mínimas totales del plan',
          descripcion: 'Cantidad mínima de horas totales que debe acumular el plan de estudios.',
          unidad: 'horas',
          origen: 'PLAN',
          campoDb: 'horasMinTotales',
          configurable: true,
        },
        {
          codigo: 'P-11',
          nombre: 'Horas mínimas Ciclo Básico (CB)',
          descripcion: 'Horas mínimas del bloque Ciclo Básico del plan de estudios.',
          unidad: 'horas',
          origen: 'PLAN',
          campoDb: 'horasMinCB',
          configurable: true,
        },
        {
          codigo: 'P-12',
          nombre: 'Horas mínimas Técnico Básico (TB)',
          descripcion: 'Horas mínimas del bloque Técnico Básico del plan de estudios.',
          unidad: 'horas',
          origen: 'PLAN',
          campoDb: 'horasMinTB',
          configurable: true,
        },
        {
          codigo: 'P-13',
          nombre: 'Horas mínimas Técnico Avanzado (TA)',
          descripcion: 'Horas mínimas del bloque Técnico Avanzado del plan de estudios.',
          unidad: 'horas',
          origen: 'PLAN',
          campoDb: 'horasMinTA',
          configurable: true,
        },
        {
          codigo: 'P-14',
          nombre: 'Horas mínimas Contextuales (CTX)',
          descripcion: 'Horas mínimas del bloque Contextual del plan de estudios.',
          unidad: 'horas',
          origen: 'PLAN',
          campoDb: 'horasMinCTX',
          configurable: true,
        },
      ],
    });

    this.registrar({
      codigo: 'R-11',
      nombre: 'Inconsistencias en programas de asignatura',
      descripcion:
        'Campos incompletos o ítems repetidos en programas de asignatura del plan.',
      tipo: 'ALERTA',
      severidad: 'MEDIA',
      alcance: 'PLAN',
      grupo: 'PLANES',
      estadoImplementacion: 'IMPLEMENTADO',
      parametros: [],
    });

    this.registrar({
      codigo: 'R-13',
      nombre: 'Formación práctica insuficiente',
      descripcion:
        'Enumera materias PPS e PI del plan y reporta horas por tipo. ' +
        'Verifica la exigencia institucional (requierePPS, requierePI) y el porcentaje mínimo ' +
        'de formación práctica (porcentajeMinFormacion) cuando están configurados en el plan. ' +
        'Emite violaciones específicas cuando la configuración del plan detecta incumplimientos.',
      tipo: 'ALERTA',
      severidad: 'MEDIA',
      alcance: 'PLAN',
      grupo: 'PLANES',
      estadoImplementacion: 'IMPLEMENTADO',
      parametros: [
        {
          codigo: 'P-FP1',
          nombre: 'Porcentaje mínimo de formación práctica',
          descripcion: 'Porcentaje mínimo del plan que debe corresponder a formación práctica (PPS/PI).',
          unidad: '%',
          origen: 'PLAN',
          campoDb: 'porcentajeMinFormacion',
          configurable: true,
        },
        {
          codigo: 'P-FP2',
          nombre: 'Exigencia de materias PPS/PI',
          descripcion: 'Indicadores de si el plan requiere materias de Práctica Profesional Supervisada o Proyecto Integrador.',
          unidad: 'booleano',
          origen: 'PLAN',
          campoDb: 'requierePPS / requierePI',
          configurable: true,
        },
      ],
    });

    this.registrar({
      codigo: 'R-14',
      nombre: 'Horas de formación práctica superiores a horas totales',
      descripcion:
        'Detecta materias donde la suma de horasClase del programa (formacionPracticaJson) ' +
        'supera la cargaHorariaTotal de la asignatura. ' +
        'Opera sobre ProgramaAsignatura.formacionPracticaJson (JSON array {intensidad, horasClase}).',
      tipo: 'ALERTA',
      severidad: 'MEDIA',
      alcance: 'PLAN',
      grupo: 'PLANES',
      estadoImplementacion: 'IMPLEMENTADO',
      parametros: [
        {
          codigo: 'P-FP3',
          nombre: 'Horas de formación práctica por materia',
          descripcion: 'Máximo de horas de formación práctica por asignatura para validación contra la carga horaria total.',
          unidad: 'horas',
          origen: 'MATERIA',
          campoDb: 'horasFormacionPractica',
          configurable: false,
          dependenciaPendiente:
            'D-14: campo Materia.horasFormacionPractica ausente en el modelo de datos actual.',
        },
      ],
    });
  }
}
