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
  estadoGeneralCalculo: EstadoCalculo;
}
