import type { EstadoCalculo } from '../types/estado-calculo.types';
import type { DocenteAlertaR10 } from '../indicadores/r10.evaluador';
import type { DocenteAlertaR12, DocenteNoDeterminableR12 } from '../indicadores/r12.evaluador';
export type { ItemFichaR12, DocenteAlertaR12, DocenteNoDeterminableR12 } from '../indicadores/r12.evaluador';
export type { DocenteAlertaR10 } from '../indicadores/r10.evaluador';
export type { DocenteAlertaR15, DocenteDistribucionR15 } from '../indicadores/r15.evaluador';

// ── R-12 ─────────────────────────────────────────────────────────────────────

/**
 * FSD MOD-AUT §3.1, R-12 — Campos obligatorios faltantes en la ficha docente.
 *
 * Universo: docentes activos con al menos una VinculacionCatedra APROBADA en la carrera.
 * Ítems evaluados: personales (fechaNacimiento, sexo), formacionGrado (tituloGrado),
 * areaDesempeno (areaDisciplinarId). El ítem docencia se delega a R-04.
 *
 * Estados:
 *   NO_APLICA:  sin vinculaciones APROBADAS activas en el alcance.
 *   PARCIAL:    alcanceFacultad=false (DIRECTOR_CARRERA) o docentes cross-facultad presentes.
 *   CALCULADO:  evaluación completa sin docentes cross-facultad.
 */
export interface ResultadoR12 {
  carreraId: string;
  facultadId: string;
  totalDocentes: number;
  totalIncompletos: number;
  incompletos: DocenteAlertaR12[];
  totalNoDeterminables: number;
  noDeterminables: DocenteNoDeterminableR12[];
  alcanceFacultad: boolean;
  estadoCalculo: EstadoCalculo;
}

// ── IP-04 / R-15 ──────────────────────────────────────────────────────────────

export interface DocenteDistribucionIP04 {
  docenteId: string;
  nombre: string;
  nMaterias: number;
}

export interface DocenteAlertaIP04 {
  docenteId: string;
  nombre: string;
  nMaterias: number;
  /** nMaterias - limite */
  exceso: number;
}

/**
 * FSD §7, IP-04 / R-15 — Materias por docente (carrera seleccionada).
 *
 * Unidad de conteo: distinct materiaId por docenteId con estado APROBADA y docente.activo=true.
 * Siempre limitado a la carrera solicitada (sin alcance cross-carrera).
 * Valor principal: mediana. Complementarios: promedio y máximo.
 * limite: p03MaxMat; null si config no existe (estadoCalculo → NO_DETERMINABLE).
 * enAlerta: docentes con nMaterias > limite (alertas informativas de sobreasignación local).
 * Null cuando totalDocentes = 0 (estadoCalculo → NO_APLICA).
 */
export interface ResultadoIP04 {
  totalDocentes: number;
  mediana: number | null;
  promedio: number | null;
  maximo: number | null;
  distribucion: DocenteDistribucionIP04[];
  /** p03MaxMat configurado; null si config no existe. */
  limite: number | null;
  totalEnAlerta: number;
  enAlerta: DocenteAlertaIP04[];
  estadoCalculo: EstadoCalculo;
}

// ── R-10 ─────────────────────────────────────────────────────────────────────

/**
 * FSD §5.3, R-10 — Docentes con baja dedicación horaria.
 *
 * Umbral: p02BajaH de AutoevaluacionConfigFacultad; 20h semanales si no configurado.
 * Alertas INFORMATIVAS: no implican infracción directa.
 * Universo: docentes activos con vinculaciones APROBADAS en el scope.
 * Alcance según rol: facultad completa (alcanceFacultad=true) o solo carrera (PARCIAL).
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

// ── IP-13 ─────────────────────────────────────────────────────────────────────

export interface DocenteAlertaIP13 {
  docenteId: string;
  nombre: string;
  nMaterias: number;
  exceso: number;
}

/**
 * FSD MOD-AUT §3.3 y §5.3, IP-13 — Docentes sobreasignados.
 *
 * Universo: docentes activos con vinculaciones APROBADAS en la facultad completa
 * (alcanceFacultad=true) o solo en la carrera solicitada (alcanceFacultad=false,
 * DIRECTOR_CARRERA → estadoCalculo PARCIAL).
 * Condición de alerta: nMaterias > limite (comparación estricta, FSD §5.3).
 * Unidad de conteo: combinaciones distintas (planEstudioId, materiaId, catedraId).
 * limite null indica que P-03 no está configurado (estadoCalculo → NO_DETERMINABLE).
 */
export interface ResultadoIP13 {
  /** Valor de P-03 (p03MaxMat) utilizado; null cuando la config no existe. */
  limite: number | null;
  totalDocentes: number;
  totalSobreasignados: number;
  sobreasignados: DocenteAlertaIP13[];
  /** Docentes con asignaciones cross-facultad cuya evaluación no pudo determinarse. */
  totalNoDeterminables: number;
  /** true cuando la evaluación cubrió toda la facultad; false (DIRECTOR_CARRERA) → PARCIAL. */
  alcanceFacultad: boolean;
  estadoCalculo: EstadoCalculo;
}

/**
 * FSD §7, IP-01 — Cantidad de docentes vigentes.
 * Distintos docenteId con ≥1 VinculacionCatedra estado='APROBADA' y docente.activo=true.
 */
export interface ResultadoIP01 {
  /** Docentes activos con al menos una asignación APROBADA en la carrera. */
  total: number;
  estadoCalculo: EstadoCalculo;
}

/**
 * FSD §7, IP-02 — Cantidad de cargos docentes vigentes.
 * Pares (docenteId, cargoId) distintos, estado='APROBADA', docente.activo=true.
 * No incluye cargos de gestión («Otros»); solo categorías P y A (FSD exclusión explícita).
 */
export interface ResultadoIP02 {
  /** Cargos docentes (P+A) con docente activo y asignación APROBADA. */
  total: number;
  estadoCalculo: EstadoCalculo;
}

/**
 * FSD §7, IP-03 — Materias cubiertas por el plantel de la carrera.
 *
 * «N de M asignaturas con al menos una asignación válida (estado APROBADA)
 * sobre el total de asignaturas en todos los planes de la carrera.»
 */
export interface ResultadoIP03 {
  /** Materias con al menos una VinculacionCatedra en estado APROBADA. */
  cubiertas: number;
  /** Total de materias en todos los planes de la carrera. */
  total: number;
  estadoCalculo: EstadoCalculo;
}

/**
 * FSD §7, IP-08 — Relación profesores / auxiliares del plantel de la carrera.
 *
 * P = cargos vigentes de categoría Titular, Asociado o Adjunto.
 * A = cargos vigentes de categoría JTP, Ayudante Graduado o Ayudante No Graduado.
 * «Otros» (gestión u otros tipos) no se cuenta.
 *
 * Unidad de conteo: pares (docenteId, cargoId) distintos con estado APROBADA.
 * Si A = 0 → ratio = null (mostrar «—» en la UI, según FSD).
 */
export interface ResultadoIP08 {
  profesores: number;
  auxiliares: number;
  /** profesores / auxiliares, redondeado a 1 decimal. null si auxiliares = 0. */
  ratio: number | null;
  estadoCalculo: EstadoCalculo;
}

/**
 * FSD §7, IP-09 — Completitud promedio del plantel de la carrera.
 *
 * completitudPromedio = round(mean(completitud_i)) donde
 *   completitud_i = 25 × (C1 + C2 + C3 + C4), C4 = 1 por construcción del universo.
 * Universo: docentes activos con ≥1 VinculacionCatedra APROBADA en la carrera.
 *
 * null cuando estadoCalculo = NO_APLICA (sin docentes en el universo).
 */
export interface ResultadoIP09 {
  totalDocentes: number;
  /** Promedio de completitud (0–100). null cuando estadoCalculo = NO_APLICA. */
  completitudPromedio: number | null;
  estadoCalculo: EstadoCalculo;
}

/**
 * FSD MOD-AUT §5, IP-10 — Consistencia del plantel docente.
 *
 * Fórmula: max(0, 100 − 25×A − 10×M).
 *   A = alertas ALTA penalizables: R-03 (tope horario) + R-04 (sin actividad curricular,
 *       excluyendo docentes sin ningún cargo con actividad en el plan — excepción C4).
 *   M = alertas MEDIA penalizables: R-07 (sobreasignados).
 */
export interface ResultadoIP10 {
  carreraId: string;
  /** max(0, 100 − 25×A − 10×M). 100 cuando estadoCalculo = NO_APLICA. */
  puntaje: number;
  /** Total de alertas ALTA penalizables (R-03 + R-04 no exceptuadas por C4). */
  componenteA: number;
  /** Total de alertas MEDIA penalizables (R-07 sobreasignados). */
  componenteM: number;
  alertasR03: number;
  alertasR04Penalizables: number;
  alertasR07: number;
  estadoCalculo: EstadoCalculo;
}

// ── Acción requerida ──────────────────────────────────────────────────────────

/** Docente referenciado en el panel «Acción requerida». */
export interface DocenteAccionRequerida {
  docenteId: string;
  nombre: string;
  /**
   * Solo presente en AR-04 (bajaDedicacion).
   * true: las horas conocidas están bajo el umbral pero la información es incompleta
   * (materias sin cargaHorariaSemanal o asignaciones cross-facultad).
   * El incumplimiento real no puede confirmarse.
   */
  incierto?: boolean;
}

/** Un subindicador del panel «Acción requerida». */
export interface SubindicadorAR {
  total: number;
  docentes: DocenteAccionRequerida[];
}

/**
 * Panel «Acción requerida» del tablero de carrera (FSD §9.2).
 * Todos los conteos son de docentes distintos, no de alertas ni cargos.
 *
 * Fuentes de datos vigentes (no snapshots históricos):
 *   conAlertasAltas:        R-03 (tope horario) ∪ IP-13 (sobreasignados), dedup por docenteId.
 *   sobreasignados:         IP-13 / R-07 (nMaterias > P-03).
 *   sinActividadCurricular: R-04 (cargos sin actividad en algún plan), dedup por docenteId entre planes.
 *   bajaDedicacion:         R-10 (horasConocidas < P-02), incluye inciertos.
 *
 * estadoCalculo: el más restrictivo entre R-03, IP-13, R-04 y R-10.
 * No participa en estadoGeneralCalculo (sus fuentes ya están representadas allí).
 */
export interface ResultadoAccionRequerida {
  /** AR-01: docentes con al menos una alerta ALTA (R-03 tope horario o IP-13 sobreasignados). */
  conAlertasAltas: SubindicadorAR;
  /** AR-02: docentes sobreasignados (nMaterias > P-03). Subset de conAlertasAltas. */
  sobreasignados: SubindicadorAR;
  /** AR-03: docentes con al menos un cargo sin actividad curricular en algún plan de la carrera. */
  sinActividadCurricular: SubindicadorAR;
  /**
   * AR-04: docentes con horasConocidas < P-02 (R-10.enAlerta, confirmados + inciertos).
   * confirmados: incierto=false — incumplimiento verificado.
   * inciertos:   incierto=true  — datos insuficientes; el total real podría superar el umbral.
   * total = confirmados + inciertos.
   */
  bajaDedicacion: SubindicadorAR & { umbral: number; confirmados: number; inciertos: number };
  estadoCalculo: EstadoCalculo;
}

// ── Listado de docentes (IMPL-18B, FSD §9.3) ─────────────────────────────────

/** Semáforo individual por docente: min(completitud_i, consistencia_i). */
export type SemaforoDocente = 'VERDE' | 'AMARILLO' | 'ROJO';

/**
 * Distribución de semáforos del plantel (B-04).
 * verde + amarillo + rojo = total (todos los docentes del listado).
 */
export interface DistribucionSemaforosDto {
  verde: number;
  amarillo: number;
  rojo: number;
  total: number;
}

/** Alertas activas para un docente en el contexto de la carrera. */
export interface AlertasDocente {
  /** R-03: tope horario semanal superado. Severidad ALTA. */
  altaTope: boolean;
  /** R-04: al menos un cargo vigente sin actividad curricular en algún plan. Severidad ALTA. */
  altaSinActividad: boolean;
  /** R-07/IP-13: nMaterias > P-03. Severidad MEDIA. */
  mediaSobreasignado: boolean;
  /** R-10: horas conocidas < P-02 (confirmado, incierto=false). Severidad INFORMATIVA. */
  informativaBajaDedicacion: boolean;
  /** R-10: horas conocidas < P-02 pero hay datos faltantes (incierto=true). */
  bajaDedicacionIncierta: boolean;
  /** R-12: al menos un ítem de ficha obligatorio incompleto. Severidad INFORMATIVA. */
  fichaIncompleta: boolean;
}

/**
 * Una fila del listado de docentes del tablero de carrera (FSD §9.3).
 *
 * semaforo = VERDE (≥90), AMARILLO (60–89), ROJO (<60),
 *   donde score = min(completitud_i, consistencia_i).
 * completitud_i = 25×(C1+C2+C3+1), C4=1 por construcción.
 * consistencia_i = max(0, 100 − 25×A − 10×M), A=ALTA alerts, M=MEDIA alerts.
 */
export interface FilaDocenteListado {
  docenteId: string;
  /** Formato: "APELLIDO, Nombre" */
  nombre: string;
  materias: { materiaId: string; nombre: string }[];
  nMaterias: number;
  /** Suma de cargaHorariaSemanal de materias con ese campo informado (solo esta carrera). */
  horasCarreraConocidas: number;
  /** true si alguna materia en esta carrera no tiene cargaHorariaSemanal. */
  tieneHorasIncompletas: boolean;
  /** 25×(C1+C2+C3+1). Valores posibles: 25, 50, 75, 100. */
  completitud: number;
  /** completitud/25. Valores posibles: 1, 2, 3, 4. */
  fichaScore: number;
  semaforo: SemaforoDocente;
  alertas: AlertasDocente;
}

/** Conteos para las pestañas de filtro del listado. */
export interface TotalesListadoDocentes {
  total: number;
  /** Docentes con al menos una alerta ALTA o MEDIA. */
  conAlertas: number;
  /** Docentes con mediaSobreasignado=true. */
  sobreasignados: number;
  /** Docentes con informativaBajaDedicacion=true o bajaDedicacionIncierta=true. */
  bajaDedicacion: number;
  /** Docentes con fichaIncompleta=true. */
  fichaIncompleta: number;
}

/**
 * Respuesta del endpoint POST /autoevaluacion/tablero/carrera/:carreraId/listado.
 *
 * estadoCalculo: NO_APLICA si no hay docentes activos; CALCULADO o PARCIAL según
 * las fuentes de datos disponibles (hereda el estado más restrictivo entre R-03, R-07,
 * R-04, R-10 y R-12).
 */
export interface ListadoDocentesCarreraDto {
  carreraId: string;
  fechaEvaluacion: string;
  docentes: FilaDocenteListado[];
  totales: TotalesListadoDocentes;
  distribucionSemaforos: DistribucionSemaforosDto;
  estadoCalculo: EstadoCalculo;
}

/** Un ítem de la distribución de dedicación docente por tipo de designación. */
export interface DedicacionTipoItem {
  tipo: string;
  docentes: number;
}

/** Un ítem de la distribución de docentes por nivel de posgrado CONEAU (D-06). */
export interface PosgradoTipoItem {
  /** Nombre canónico del nivel: 'DOCTORADO' | 'MAESTRIA' | 'ESPECIALIZACION'. */
  tipo: string;
  docentes: number;
}

/**
 * Categoría de dedicación horaria según CONEAU.
 * NO_DETERMINADA: valor de Docente.dedicacion ausente, vacío o con forma no reconocida.
 */
export type DedicacionConeau = 'EXCLUSIVA' | 'SEMIEXCLUSIVA' | 'SIMPLE' | 'NO_DETERMINADA';

/** Un ítem de la distribución CONEAU de dedicación docente (CIERRE-03 Fase A). */
export interface DedicacionConeauItem {
  categoria: DedicacionConeau;
  docentes: number;
}

/**
 * Bloque "Condiciones del plantel" para indicadores CONEAU (FSD §9.2, B-03).
 *
 * conPosgrado:            docentes con tituloPosgrado declarado (boolean).
 * conInvestigacion:       docentes con tituloProyectoInvestigacion declarado.
 * conDesignacionRegular:  docentes con al menos un CargoDocente vigente cuya
 *                         designacion contiene "Regular" (insensitive).
 * conDesignacionInterina: docentes con al menos un CargoDocente vigente cuya
 *                         designacion contiene "Interino" (insensitive).
 *                         No es el complemento de regulares — se consulta explícitamente.
 * relacionPA:             cargos P y A según IP-08 (FSD §9.2). Ausente cuando
 *                         ip08.estadoCalculo = NO_APLICA (sin cargos en la carrera).
 * dedicacionPorTipo:      distribución de docentes por Designacion.nombre
 *                         (VinculacionCatedra APROBADA). NOTA: la fuente actual
 *                         contiene categorías de designación académica
 *                         (REGULAR RENTADO, INTERINO RENTADO, etc.), no rangos de
 *                         dedicación horaria. Fuente de dedicación pendiente de
 *                         decisión institucional (PD-1, IMPL-19B.3-B.0).
 * dedicacionConeau:       distribución de docentes por categoría CONEAU, derivada de
 *                         Docente.dedicacion con normalización conservadora (CIERRE-03 Fase A).
 *                         Incluye NO_DETERMINADA para valores ausentes o no reconocidos.
 * distribucionPosgrado:   distribución de docentes por nivel máximo de posgrado CONEAU (D-06).
 *                         Solo incluye docentes clasificados (tipoPosgradoId != null).
 *                         Ausente cuando estadoCalculo = NO_APLICA.
 */
export interface CondicionesPlantellDto {
  totalDocentes: number;
  conPosgrado: number;
  conInvestigacion: number;
  conDesignacionRegular: number;
  /** Docentes con al menos un CargoDocente vigente cuya designacion contiene "Interino". */
  conDesignacionInterina: number;
  /**
   * Cargos profesores y auxiliares según IP-08.
   * Ausente cuando ip08.estadoCalculo = NO_APLICA.
   */
  relacionPA?: { profesores: number; auxiliares: number };
  dedicacionPorTipo: DedicacionTipoItem[];
  /**
   * Distribución CONEAU de dedicación docente (CIERRE-03 Fase A).
   * Fuente: Docente.dedicacion normalizado. Incluye las cuatro categorías siempre.
   */
  dedicacionConeau: DedicacionConeauItem[];
  /**
   * Distribución de docentes por nivel máximo de posgrado CONEAU (D-06).
   * Ordena: DOCTORADO, MAESTRIA, ESPECIALIZACION.
   * Solo incluye los niveles con al menos un docente clasificado.
   * Un docente con tipoPosgradoId = null no aparece en ningún bucket (null ≠ SIN_POSGRADO).
   */
  distribucionPosgrado?: PosgradoTipoItem[];
  estadoCalculo: EstadoCalculo;
}

/**
 * Respuesta del endpoint POST /autoevaluacion/tablero/carrera/:carreraId.
 *
 * estadoGeneralCalculo refleja el estado más restrictivo entre IP-01, IP-02,
 * IP-03, IP-04, IP-08, IP-09, IP-10, IP-13, R-10 y R-12.
 */
export interface TablroCarreraResponseDto {
  carreraId: string;
  /** ISO 8601 */
  fechaEvaluacion: string;
  ip01: ResultadoIP01;
  ip02: ResultadoIP02;
  ip03: ResultadoIP03;
  ip04: ResultadoIP04;
  ip08: ResultadoIP08;
  ip09: ResultadoIP09;
  ip10: ResultadoIP10;
  ip13: ResultadoIP13;
  r10: ResultadoR10;
  r12: ResultadoR12;
  /** Panel «Acción requerida» (FSD §9.2). Calculado con datos vigentes (no snapshots). */
  accionRequerida: ResultadoAccionRequerida;
  /**
   * Listado detallado de docentes del plantel (FSD §9.3).
   * Presente en ejecuciones ≥ v2.0 (IMPL-18C). Ausente en snapshots históricos anteriores.
   * El generador PDF degradará graciosamente si el campo está ausente.
   */
  listadoDocentes?: ListadoDocentesCarreraDto;
  /**
   * Bloque "Condiciones del plantel" CONEAU (FSD §9.2, B-03).
   * Presente en ejecuciones ≥ v2.1. Ausente en snapshots históricos anteriores.
   */
  condicionesPlantell?: CondicionesPlantellDto;
  estadoGeneralCalculo: EstadoCalculo;
}
