export type EstadoCalculo = 'CALCULADO' | 'PARCIAL' | 'NO_DETERMINABLE' | 'NO_APLICA';

// ── Bloque 1 — Composición ────────────────────────────────────────────────────

export interface DistribucionCarreraFacultad {
  carreraId: string;
  nombreCarrera: string;
  totalDocentes: number;
  totalCargos: number;
}

export interface BloqueComposicion {
  totalDocentes: number;
  totalCargosP: number;
  totalCargosA: number;
  totalCargosOtros: number;
  totalCargos: number;
  porCarrera: DistribucionCarreraFacultad[];
  estadoCalculo: EstadoCalculo;
}

// ── Bloque 2 — Formación ──────────────────────────────────────────────────────

export interface BloqueFormacion {
  totalDocentes: number;
  conTituloGrado: number;
  conTituloPosgrado: number;
  sinTituloGrado: number;
  sinTituloPosgrado: number;
  completitudPromedio: number | null;
  estadoCalculo: EstadoCalculo;
}

// ── Bloque 3 — Investigación y vinculación ────────────────────────────────────

export interface BloqueInvestigacion {
  totalDocentes: number;
  conProyectoInvestigacion: number;
  conActividadExtension: number;
  conAmbasActividades: number;
  sinNinguna: number;
  estadoCalculo: EstadoCalculo;
}

// ── Bloque 4 — Dedicaciones ───────────────────────────────────────────────────

export interface DocenteBajaDedicacion {
  docenteId: string;
  nombre: string;
  cargaHorariaSemanal: number;
}

export interface BloqueDedicaciones {
  totalDocentes: number;
  umbral: number;
  totalBajaDedicacion: number;
  totalSinDatos: number;
  enAlerta: DocenteBajaDedicacion[];
  estadoCalculo: EstadoCalculo;
}

// ── Bloque 5 — Carga académica ────────────────────────────────────────────────

export interface DocenteSobreasignadoFacultad {
  docenteId: string;
  nombre: string;
  nMaterias: number;
  exceso: number;
}

export interface BloqueCargaAcademica {
  totalDocentes: number;
  limiteMaxMat: number | null;
  totalSobreasignados: number;
  sobreasignados: DocenteSobreasignadoFacultad[];
  estadoCalculo: EstadoCalculo;
}

// ── Bloque 6 — Distribución de materias por docente (R-06) ───────────────────

export interface BloqueDistribucionMaterias {
  totalDocentes: number;
  promedio: number | null;
  mediana: number | null;
  maximo: number | null;
  distribucion: { docenteId: string; nombre: string; nMaterias: number }[];
  estadoCalculo: EstadoCalculo;
}

// ── Respuesta del endpoint ────────────────────────────────────────────────────

export interface TablroFacultadResponse {
  facultadId: string;
  fechaEvaluacion: string;
  composicion: BloqueComposicion;
  formacion: BloqueFormacion;
  investigacion: BloqueInvestigacion;
  dedicaciones: BloqueDedicaciones;
  cargaAcademica: BloqueCargaAcademica;
  distribucionMaterias: BloqueDistribucionMaterias;
  estadoGeneralCalculo: EstadoCalculo;
}
