export type EstadoCalculo = 'CALCULADO' | 'PARCIAL' | 'NO_DETERMINABLE' | 'NO_APLICA';

export interface DatoFaltante {
  campo: string;
  descripcion?: string;
}

export interface ResultadoIPL01 {
  horasTotal: number | null;
  horasMinimas: number | null;
  diferencia: number | null;
  cumple: boolean | null;
  estadoCalculo: EstadoCalculo;
}

export interface ResultadoIPL02 {
  bloquesCumplen: number;
  bloquesConUmbral: number;
  /** Bloques con horas < mínimo (cumple === false). Disponible desde MOD-AUT v2.1. */
  bloquesDebajo?: number;
  /** Bloques con horas no determinables (cumple === null). Disponible desde MOD-AUT v2.1. */
  bloquesInciertos?: number;
  estadoCalculo: EstadoCalculo;
}

export interface ResultadoIPL03 {
  sinResponsable: number;
  inciertas: number;
  conResponsable: number;
  totalMaterias: number;
  estadoCalculo: EstadoCalculo;
}

export interface AlertaR02 {
  materiaId: string;
  materiaNombre: string;
  materiaCodigo: string;
  catedraId: string;
  catedraNombre?: string;
  cantidadResponsables: number;
}

export interface ParIncierto02 {
  materiaId: string;
  materiaNombre: string;
  materiaCodigo: string;
  catedraId: string;
  catedraNombre?: string;
  confirmedTrue: number;
  sinClasificar: number;
}

export interface ResultadoIPL04 {
  paresConAlerta: number;
  paresInciertos: number;
  totalMaterias: number;
  estadoCalculo: EstadoCalculo;
  detalleAlertas: AlertaR02[];
  detalleInciertos: ParIncierto02[];
}

export interface EvaluacionBloqueIPL05 {
  bloque: 'CB' | 'TB' | 'TA' | 'CTC' | 'TOTAL';
  horasReales: number | null;
  horasMinimas: number | null;
  diferencia: number | null;
  cumple: boolean | null;
  estadoCalculo: EstadoCalculo;
}

export interface ResultadoIPL05 {
  bloques: EvaluacionBloqueIPL05[];
  estadoCalculo: EstadoCalculo;
}

// ── R-11 — Inconsistencias en programas de asignatura ──────────────────────────

export interface ProgramaInconsistenteR11 {
  materiaId: string;
  materiaNombre: string;
  materiaCodigo: string;
  seccionesCompletas: number;
  seccionesPendientes: number;
  prioridad: 'ALTA' | 'MEDIA';
}

export interface MateriaSinProgramaR11 {
  materiaId: string;
  materiaNombre: string;
  materiaCodigo: string;
}

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

// ── R-13 — Formación práctica ──────────────────────────────────────────────────

export interface ResultadoR13 {
  planEstudioId: string;
  totalMaterias: number;
  porTipo: Record<string, number>;
  tienePPS: boolean;
  tienePI: boolean;
  totalHorasFormacionPractica: number;
  conDatosFP: number;
  sinDatosFP: number;
  configuracionPlan: {
    requierePPS: boolean | null;
    requierePI: boolean | null;
    horasMinFormacionPractica: number | null;
  };
  violacionesFormacion: string[];
  estadoCalculo: EstadoCalculo;
}

// ── R-14 — Horas de formación práctica vs horas totales ───────────────────────

export interface MateriaAlertaR14 {
  materiaId: string;
  materiaNombre: string;
  materiaCodigo: string;
  horasFormacionPractica: number;
  horasTotal: number;
  exceso: number;
}

export interface ResultadoR14 {
  planEstudioId: string;
  totalMaterias: number;
  totalEvaluadas: number;
  totalConAlerta: number;
  totalSinDatos: number;
  enAlerta: MateriaAlertaR14[];
  estadoCalculo: EstadoCalculo;
}

// ── Respuesta del endpoint ─────────────────────────────────────────────────────

export interface TablroPlanResponse {
  planEstudioId: string;
  fechaEvaluacion: string;
  ipl01: ResultadoIPL01;
  ipl02: ResultadoIPL02;
  ipl03: ResultadoIPL03;
  ipl04: ResultadoIPL04;
  ipl05: ResultadoIPL05;
  r11: ResultadoR11;
  r13: ResultadoR13;
  r14: ResultadoR14;
  estadoGeneralCalculo: EstadoCalculo;
  datosFaltantes: DatoFaltante[];
  advertencias: string[];
}
