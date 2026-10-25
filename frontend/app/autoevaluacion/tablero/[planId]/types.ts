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
  estadoCalculo: EstadoCalculo;
}

export interface ResultadoIPL03 {
  sinResponsable: number;
  inciertas: number;
  conResponsable: number;
  totalMaterias: number;
  estadoCalculo: EstadoCalculo;
}

export interface ResultadoIPL04 {
  paresConAlerta: number;
  paresInciertos: number;
  totalMaterias: number;
  estadoCalculo: EstadoCalculo;
}

export interface EvaluacionBloqueIPL05 {
  bloque: 'CB' | 'TB' | 'TA' | 'CX' | 'TOTAL';
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

// ── R-13 — Distribución de asignaturas por tipo ────────────────────────────────

export interface MateriaFormacionPracticaR13 {
  id: string;
  nombre: string;
  codigo: string;
  tipoAsignatura: string;
  cargaHorariaTotal: number | null;
}

export interface ResultadoR13 {
  planEstudioId: string;
  totalMaterias: number;
  porTipo: Record<string, number>;
  tienePPS: boolean;
  tienePI: boolean;
  horasPPS: number | null;
  horasPI: number | null;
  materiasPPS: MateriaFormacionPracticaR13[];
  materiasPI: MateriaFormacionPracticaR13[];
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
