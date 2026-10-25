/**
 * Tipos consolidados para la capa de recuperación de datos académicos de MOD-AUT.
 *
 * Convenciones:
 * - Los campos nullable conservan null (nunca se convierten en 0 o "").
 * - Los estados son strings literales que reflejan los valores reales de la BD.
 * - BloqueNormalizado es el mapeado interno de MOD-AUT; bloqueConocimientoRaw
 *   conserva el valor original para trazabilidad.
 */

// ── Bloques curriculares ──────────────────────────────────────────────────────

/**
 * Cuatro bloques que MOD-AUT reconoce como clasificados.
 * null = bloque ausente o con valor no reconocido en el sistema.
 *
 * Valor canonical → campo de umbral en PlanEstudio:
 *   CB  → horasMinCB
 *   TB  → horasMinTB
 *   TA  → horasMinTA
 *   CX  → horasMinCTX  (Ciencias y Tecnologías Complementarias)
 *
 * Se reconocen como equivalentes a CX: "CTX" (nombre del campo Prisma) y "CTC" (prototipo HTML v5.1).
 */
export type BloqueNormalizado = 'CB' | 'TB' | 'TA' | 'CX' | null;

// ── Estructura institucional ──────────────────────────────────────────────────

export interface FacultadAut {
  id: string;
  nombre: string;
  estado: string;
  codigo: string | null;
}

export interface CarreraAut {
  id: string;
  nombre: string;
  facultadId: string;
  estado: string;
  codigo: string | null;
}

export interface UmbralesAut {
  /** null = umbral no configurado; R-09 no evalúa ese bloque */
  horasMinTotales: number | null;
  horasMinCB: number | null;
  horasMinTB: number | null;
  horasMinTA: number | null;
  /** Umbral del bloque CX (Ciencias y Tecnologías Complementarias). El campo Prisma conserva el nombre horasMinCTX. */
  horasMinCTX: number | null;
}

export interface PlanEstudioAut {
  id: string;
  nombre: string;
  carreraId: string;
  version: string | null;
  anio: number | null;
  estado: string;
  fechaAprobacion: Date | null;
  umbrales: UmbralesAut;
}

// ── Materias ──────────────────────────────────────────────────────────────────

export interface MateriaAut {
  id: string;
  codigo: string;
  nombre: string;
  planEstudioId: string;
  estado: string;
  anio: number | null;
  cuatrimestre: number | null;
  /** Valor original del campo bloqueConocimiento tal como está en la BD */
  bloqueConocimientoRaw: string | null;
  /** Bloque normalizado a los cuatro reconocidos; null si ausente o desconocido */
  bloqueNormalizado: BloqueNormalizado;
  /** null preservado — nunca convertido a 0 */
  cargaHorariaSemanal: number | null;
  /** null preservado — nunca convertido a 0 */
  cargaHorariaTotal: number | null;
  tipoAsignatura: string;
}

// ── Docentes y vinculaciones ──────────────────────────────────────────────────

export interface DocenteAut {
  id: string;
  nombre: string;
  apellido: string;
  activo: boolean;
  /** String libre o null — no se infiere ni normaliza en esta fase */
  dedicacion: string | null;
  categoriaDocente: string | null;
}

export interface VinculacionAut {
  id: string;
  materiaId: string;
  /**
   * Nombre de la materia; poblado solo por obtenerVinculacionesParaR07.
   * undefined en otros métodos de consulta.
   */
  materiaNombre?: string;
  docenteId: string;
  catedraId: string;
  planEstudioId: string;
  carreraId: string;
  /**
   * 'PENDIENTE_DE_APROBACION' | 'APROBADA' | 'RECHAZADA' | 'DESVINCULADA'
   * Todos los estados se preservan; el consumidor decide cómo filtrarlos.
   */
  estado: string;
  /**
   * true = responsable confirmado, false = confirmado como no responsable,
   * null = sin clasificar. Responsable efectivo = APROBADA + true.
   */
  esResponsableCatedra: boolean | null;
  /** null preservado — copia de materia.cargaHorariaSemanal al crear */
  horasSemana: number | null;
  docente: DocenteAut;
}

// ── Programas de asignatura ───────────────────────────────────────────────────

export type EstadoSeccion = 'PENDIENTE' | 'COMPLETO';

export interface SeccionesPrograma {
  s1: EstadoSeccion;
  s2: EstadoSeccion;
  s3: EstadoSeccion;
  s4: EstadoSeccion;
  s5: EstadoSeccion;
  s6: EstadoSeccion;
}

export interface ProgramaAut {
  id: string;
  materiaId: string;
  /** 'PENDIENTE' | 'EN_REVISION' | 'APROBADO' */
  estadoPrograma: string;
  secciones: SeccionesPrograma;
  fechaAprobacion: Date | null;
  anioVigencia: number | null;
  /** Discriminante explícito: siempre true en este tipo */
  readonly tienePrograma: true;
}

// ── Configuraciones ───────────────────────────────────────────────────────────

export interface ConfigFacultadAut {
  facultadId: string;
  p01TopeH: number;
  p02BajaH: number;
  p03MaxMat: number;
  updatedAt: Date;
}

// ── R-07: consulta cross-carrera ──────────────────────────────────────────────

/**
 * Resultado de la consulta de vinculaciones para el evaluador R-07.
 * Incluye el alcance real de la consulta según el rol del usuario.
 *
 * alcanceFacultad = true:  vinculaciones de TODAS las carreras de la facultad.
 * alcanceFacultad = false: vinculaciones de la carrera solicitada únicamente.
 *   → R-07 debe devolver EstadoCalculo.PARCIAL cuando alcanceFacultad = false.
 *
 * docentesMultiFacultad: subconjunto de docenteIds del scope que también tienen
 *   vinculaciones APROBADAS en otras facultades. Vacío cuando alcanceFacultad = false
 *   (sin detección en scope parcial). Calculado internamente; no expone datos externos.
 */
export interface VinculacionesParaR07 {
  vinculaciones: VinculacionAut[];
  facultadId: string;
  alcanceFacultad: boolean;
  docentesMultiFacultad: Set<string>;
}

// ── R-13: configuración de formación práctica ─────────────────────────────────

/**
 * Configuración de formación práctica de un Plan de Estudio (FSD §6.3).
 * Todos los campos son nullable: null = no configurado ≠ false = explícitamente no requerido.
 *
 * Usado por R-13 para evaluar cumplimiento de mínimos de PPS, PI y porcentaje práctico.
 */
export interface ConfigFormacionPracticaAut {
  planEstudioId: string;
  /** null = no configurado; true = requerido; false = explícitamente no requerido */
  requierePPS: boolean | null;
  /** null = no configurado; true = requerido; false = explícitamente no requerido */
  requierePI: boolean | null;
  /** null = no configurado; 0–100 = porcentaje mínimo de horas prácticas sobre total del plan */
  porcentajeMinFormacion: number | null;
}

// ── R-12: ficha de docente ────────────────────────────────────────────────────

/**
 * Datos de ficha docente requeridos por el evaluador R-12.
 * Solo incluye los campos relevantes para la evaluación de completitud;
 * no incluye dedicacion ni categoriaDocente (no evaluados por R-12).
 */
export interface DocenteFichaAut {
  docenteId: string;
  nombre: string;
  apellido: string;
  activo: boolean;
  /** Título de grado; null = no informado (ítem formacionGrado incompleto). */
  tituloGrado: string | null;
  /** FK a AreaDisciplinar; null = área no asignada (ítem areaDesempeno incompleto). */
  areaDisciplinarId: string | null;
  /** null = ítem personales potencialmente incompleto (R12-DP-01). */
  fechaNacimiento: Date | null;
  /** null o vacío = ítem personales potencialmente incompleto (R12-DP-01). */
  sexo: string | null;
}

/**
 * Resultado de la consulta de docentes para el evaluador R-12.
 * Paralela a VinculacionesParaR07 pero centrada en ficha, no en vinculaciones.
 *
 * alcanceFacultad = true:  docentes de TODAS las carreras de la facultad con APROBADA.
 * alcanceFacultad = false: docentes de la carrera solicitada únicamente (DIRECTOR_CARRERA → PARCIAL).
 * docentesMultiFacultad: subconjunto de docenteIds con vinculaciones APROBADAS en otras facultades.
 */
export interface DocentesParaR12 {
  docentes: DocenteFichaAut[];
  facultadId: string;
  alcanceFacultad: boolean;
  docentesMultiFacultad: Set<string>;
}

// ── IP-09: completitud del plantel ────────────────────────────────────────────

/**
 * Datos de ficha docente requeridos para calcular IP-09 (Completitud promedio, FSD §6.1).
 *
 * C1 — seis campos nullable con reglas de excepción:
 *   sexo, fechaNacimiento        → siempre requeridos
 *   cuit                         → requerido, excepto si tipoDocumento = 'PASAPORTE'
 *   pisoDepto (Depto/Partido)    → requerido, excepto si residencia ≠ Argentina
 * C2 — tituloGrado almacena JSON [{denominacion,anio,pais,institucion}]; texto legacy → incompleto
 * C3 — areaDisciplinarId; null → incompleto
 * C4 — 1 por construcción del universo (VinculacionCatedra APROBADA)
 */
export interface DocenteVigenteIP09 {
  docenteId: string;
  nombre: string;
  apellido: string;
  sexo: string | null;
  fechaNacimiento: Date | null;
  cuit: string | null;
  /** Departamento/Partido (campo pisoDepto del modelo). */
  pisoDepto: string | null;
  residencia: string | null;
  tipoDocumento: string;
  tituloGrado: string | null;
  areaDisciplinarId: string | null;
}

/** Resultado de la consulta de docentes para IP-09. */
export interface DocentesParaIP09 {
  docentes: DocenteVigenteIP09[];
}

// ── R-03: tope semanal de horas docentes ─────────────────────────────────────

/**
 * Datos de un docente activo con al menos una VinculacionCatedra APROBADA en el scope,
 * necesarios para evaluar R-03 (FSD §5.3).
 *
 * horasDocenciaConocidas: suma de Materia.cargaHorariaSemanal de las vinculaciones
 *   APROBADAS del scope con ese campo no nulo. Si alguna vinculación apunta a una
 *   materia sin ese campo, tieneMateriaSinHoras=true y la suma puede estar subestimada.
 * tiempoDedicacionGestionSemanal: sección 5.1 de la ficha, almacenado como String?.
 *   Vigencia verificada mediante fechaFinGestion.
 * desempenoActualJson: JSON de sección 6.1; cada ítem incluye dedicacionSeman:string.
 */
export interface DocenteVigenteR03 {
  docenteId: string;
  nombre: string;
  apellido: string;
  /** Suma de Materia.cargaHorariaSemanal de vinculaciones APROBADAS con ese campo presente. */
  horasDocenciaConocidas: number;
  /** true si alguna materia del docente en el scope no tiene cargaHorariaSemanal cargada. */
  tieneMateriaSinHoras: boolean;
  tiempoDedicacionGestionSemanal: string | null;
  fechaFinGestion: string | null;
  desempenoActualJson: string | null;
}

/**
 * Resultado de la consulta de docentes para el evaluador R-03.
 *
 * alcanceFacultad=true:  docentes de TODAS las carreras de la facultad.
 * alcanceFacultad=false: docentes de la carrera solicitada (DIRECTOR_CARRERA → PARCIAL).
 * docentesMultiFacultad: subconjunto con vinculaciones APROBADAS en otras facultades;
 *   sus horas de docencia en esas facultades no son visibles desde este scope.
 */
export interface DocentesParaR03 {
  docentes: DocenteVigenteR03[];
  facultadId: string;
  alcanceFacultad: boolean;
  docentesMultiFacultad: Set<string>;
}

/**
 * DECISIONES DE DISEÑO R-03 — Recuperación de datos docentes (FSD §5.3)
 *
 * R-03a (resuelto): tiempoDedicacionGestionSemanal en String?
 *   Se parsea con parseInt; se rechaza si contiene caracteres no numéricos (indeterminado).
 *   Vigencia por fechaFinGestion: vigente = fechaFin nula O estrictamente posterior a hoy.
 *
 * R-03b (resuelto): Desempeño no académico
 *   desempenoActualJson (sección 6.1) registra actividades fuera del aula.
 *   dedicacionSeman:string no tiene validación numérica en backend; se rechaza si
 *   no cumple /^\d+(\.\d+)?$/ (indeterminado).
 *
 * R-03c (resuelto): Consulta centrada en el docente
 *   obtenerDocentesParaR03 agrega por docenteId acumulando Materia.cargaHorariaSemanal
 *   de todas las VinculacionCatedra APROBADAS del scope.
 *
 * R-03d (decisión): Sin deduplicación por (materiaId, catedraId)
 *   El FSD establece "cada asignación aporta las horas completas de la asignatura".
 *   Dos vinculaciones del mismo docente en la misma (materia, cátedra) son datos
 *   anómalos que MOD-DOC debe corregir en la fuente, no silenciar en el cálculo.
 */

// ── R-04: cargos sin actividad curricular ─────────────────────────────────────

/**
 * Cargo institucional vigente de un docente al fechaCalculo (filtrado por K-D6 en la consulta).
 * tieneActividadEnPlan: al menos una VinculacionCatedra APROBADA en el plan evaluado
 *   tiene cargoDocenteId = este cargoDocenteId.
 */
export interface CargoVigenteR04 {
  cargoDocenteId: string;
  cargoNombre: string;
  designacion: string | null;
  fechaInicio: Date;
  fechaFin: Date | null;
  verificado: boolean;
  tieneActividadEnPlan: boolean;
}

/**
 * Docente del plantel del plan con sus cargos vigentes al fechaCalculo.
 * Solo se incluyen docentes con al menos una VinculacionCatedra APROBADA en el plan.
 */
export interface DocenteConCargosR04 {
  docenteId: string;
  nombre: string;
  apellido: string;
  /** true = secretaría confirmó que los cargos en CargoDocente son exhaustivos. */
  relevamientoCargosCompleto: boolean;
  cargosVigentes: CargoVigenteR04[];
}

/** Resultado de la consulta de cargos para el evaluador R-04. */
export interface CargosParaR04 {
  docentes: DocenteConCargosR04[];
  planEstudioId: string;
  carreraId: string;
}

// ── R-11 / R-13 / R-14: materias con programa de asignatura ──────────────────

/**
 * Estado consolidado de una materia del plan junto con su programa de asignatura.
 * Usado por R-11 (inconsistencias), R-13 (formación práctica) y R-14 (horas).
 *
 * Cuando tienePrograma=false, todos los campos derivados del programa son null/0.
 * seccionesCompletas es un conteo derivado [0–6], siempre presente.
 */
export interface MateriaProgramaAut {
  materiaId: string;
  materiaNombre: string;
  materiaCodigo: string;
  /** Valor del campo Materia.tipoAsignatura; default 'OBLIGATORIA'. */
  tipoAsignatura: string;
  /** null preservado — nunca convertido a 0. */
  cargaHorariaTotal: number | null;
  tienePrograma: boolean;
  /** null cuando tienePrograma=false. */
  estadoPrograma: string | null;
  /** null cuando tienePrograma=false. */
  secciones: SeccionesPrograma | null;
  /** Conteo de secciones con estado 'COMPLETO'. 0 cuando tienePrograma=false. */
  seccionesCompletas: number;
  fechaAprobacion: Date | null;
  anioVigencia: number | null;
  /**
   * JSON raw de ProgramaAsignatura.formacionPracticaJson.
   * Estructura: Array<{ intensidad: string; horasClase: number }>.
   * null cuando no hay programa o el campo no fue cargado.
   * Usado por R-14 para derivar horasFormacionPractica.
   */
  formacionPracticaJson: string | null;
}
