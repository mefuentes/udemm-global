export type EstadoCalculo = 'CALCULADO' | 'PARCIAL' | 'NO_DETERMINABLE' | 'NO_APLICA';

/** FSD §7, IP-01 — Cantidad de docentes vigentes (docente.activo=true, asignación APROBADA). */
export interface ResultadoIP01 {
  total: number;
  estadoCalculo: EstadoCalculo;
}

/** FSD §7, IP-02 — Cantidad de cargos docentes vigentes (P+A, docente.activo=true). No incluye gestión. */
export interface ResultadoIP02 {
  total: number;
  estadoCalculo: EstadoCalculo;
}

/** FSD §7, IP-03 — Materias cubiertas en los planes de la carrera. */
export interface ResultadoIP03 {
  cubiertas: number;
  total: number;
  estadoCalculo: EstadoCalculo;
}

/** FSD §7, IP-04 — Materias por docente. Mediana como valor principal. */
export interface DocenteDistribucionIP04 {
  docenteId: string;
  nombre: string;
  nMaterias: number;
}

export interface ResultadoIP04 {
  totalDocentes: number;
  mediana: number | null;
  promedio: number | null;
  maximo: number | null;
  distribucion: DocenteDistribucionIP04[];
  estadoCalculo: EstadoCalculo;
}

/** FSD MOD-AUT §3.3 y §5.3, IP-13 — Docentes sobreasignados. */
export interface DocenteAlertaIP13 {
  docenteId: string;
  nombre: string;
  nMaterias: number;
  exceso: number;
}

export interface ResultadoIP13 {
  limite: number | null;
  totalDocentes: number;
  totalSobreasignados: number;
  sobreasignados: DocenteAlertaIP13[];
  totalNoDeterminables: number;
  alcanceFacultad: boolean;
  estadoCalculo: EstadoCalculo;
}

/** FSD §7, IP-05 — Docentes con formación de posgrado. Derivado de condicionesPlantell. */
export interface ResultadoIP05 {
  conPosgrado: number;
  totalDocentes: number;
  /** round(conPosgrado / totalDocentes × 100). null cuando totalDocentes = 0. */
  porcentaje: number | null;
  estadoCalculo: EstadoCalculo;
}

/** FSD §7, IP-06 — Docentes con actividad de investigación. Derivado de condicionesPlantell. */
export interface ResultadoIP06 {
  conInvestigacion: number;
  totalDocentes: number;
  porcentaje: number | null;
  estadoCalculo: EstadoCalculo;
}

/** FSD §7, IP-07 — Docentes con designación regular. Derivado de condicionesPlantell. */
export interface ResultadoIP07 {
  conDesignacionRegular: number;
  totalDocentes: number;
  porcentaje: number | null;
  estadoCalculo: EstadoCalculo;
}

/** FSD §7, IP-08 — Relación profesores / auxiliares del plantel de la carrera. */
export interface ResultadoIP08 {
  profesores: number;
  auxiliares: number;
  /** P / A redondeado a 1 decimal. null si auxiliares = 0. */
  ratio: number | null;
  estadoCalculo: EstadoCalculo;
}

/** FSD §7, IP-09 — Completitud promedio del plantel de la carrera. */
export interface ResultadoIP09 {
  totalDocentes: number;
  /** round(mean(completitud_i)), 0–100. null cuando estadoCalculo = NO_APLICA. */
  completitudPromedio: number | null;
  estadoCalculo: EstadoCalculo;
}

/** FSD MOD-AUT §5, IP-10 — Consistencia del plantel docente. */
export interface ResultadoIP10 {
  carreraId: string;
  /** max(0, 100 − 25×A − 10×M). */
  puntaje: number;
  componenteA: number;
  componenteM: number;
  alertasR03: number;
  alertasR04Penalizables: number;
  alertasR07: number;
  estadoCalculo: EstadoCalculo;
}

/** FSD §5.3, R-10 — Docentes con baja dedicación horaria. */
export interface DocenteAlertaR10 {
  docenteId: string;
  nombre: string;
  horasConocidas: number;
  umbral: number;
}

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

/** FSD MOD-AUT §3.1, R-12 — Campos obligatorios faltantes en la ficha docente. */
export type ItemFichaR12 = 'personales' | 'formacionGrado' | 'areaDesempeno';

export interface DocenteAlertaR12 {
  docenteId: string;
  nombre: string;
  faltantes: ItemFichaR12[];
}

export interface DocenteNoDeterminableR12 {
  docenteId: string;
  nombre: string;
  causa: 'CROSS_FACULTAD';
}

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

/** Docente referenciado en el panel «Acción requerida». */
export interface DocenteAccionRequerida {
  docenteId: string;
  nombre: string;
  /** Solo presente en AR-04. true = datos de horas incompletos; el incumplimiento no está confirmado. */
  incierto?: boolean;
}

/** Un subindicador del panel «Acción requerida». */
export interface SubindicadorAR {
  total: number;
  docentes: DocenteAccionRequerida[];
}

/** Panel «Acción requerida» (FSD §9.2). Todos los conteos son de docentes distintos. */
export interface ResultadoAccionRequerida {
  /** AR-01: docentes con al menos una alerta ALTA (R-03 tope horario o IP-13 sobreasignados). */
  conAlertasAltas: SubindicadorAR;
  /** AR-02: docentes sobreasignados (nMaterias > P-03). */
  sobreasignados: SubindicadorAR;
  /** AR-03: docentes con al menos un cargo sin actividad curricular en algún plan. */
  sinActividadCurricular: SubindicadorAR;
  /** AR-04: docentes con horasConocidas < P-02. total = confirmados + inciertos. */
  bajaDedicacion: SubindicadorAR & { umbral: number; confirmados: number; inciertos: number };
  estadoCalculo: EstadoCalculo;
}

// ── Listado de docentes (IMPL-18B, FSD §9.3) ─────────────────────────────────

export type SemaforoDocente = 'VERDE' | 'AMARILLO' | 'ROJO';

export interface AlertasDocente {
  altaTope: boolean;
  altaSinActividad: boolean;
  mediaSobreasignado: boolean;
  informativaBajaDedicacion: boolean;
  bajaDedicacionIncierta: boolean;
  fichaIncompleta: boolean;
}

export interface FilaDocenteListado {
  docenteId: string;
  /** "APELLIDO, Nombre" */
  nombre: string;
  materias: { materiaId: string; nombre: string }[];
  nMaterias: number;
  horasCarreraConocidas: number;
  tieneHorasIncompletas: boolean;
  completitud: number;
  fichaScore: number;
  semaforo: SemaforoDocente;
  alertas: AlertasDocente;
}

export interface TotalesListadoDocentes {
  total: number;
  conAlertas: number;
  sobreasignados: number;
  bajaDedicacion: number;
  fichaIncompleta: number;
}

export interface DistribucionSemaforosCarrera {
  verde: number;
  amarillo: number;
  rojo: number;
  total: number;
}

/** Semáforo del Programa de Asignatura en el listado (H.2-C). Basado en completitud de las 6 secciones. */
export type EstadoProgramaListado = 'VERDE' | 'AMARILLO' | 'ROJO' | 'NO_VERIFICABLE';

/** Una fila del listado Docente–Asignatura (H.2-B). Una entrada por (docenteId, materiaId). */
export interface FilaDocenteMateria {
  docenteId: string;
  /** "APELLIDO, Nombre" */
  nombreDocente: string;
  materiaId: string;
  nombreMateria: string;
  horasCarreraConocidas: number;
  tieneHorasIncompletas: boolean;
  /** Secciones completas (0–6). null si no existe ProgramaAsignatura. */
  seccionesCompletas: number | null;
  /** Math.round(seccionesCompletas / 6 * 100). null si no hay programa. */
  completitudPrograma: number | null;
  estadoPrograma: EstadoProgramaListado;
  alertas: AlertasDocente;
}

export interface ListadoDocentesCarreraResponse {
  carreraId: string;
  fechaEvaluacion: string;
  docentes: FilaDocenteListado[];
  /** Una fila por (docenteId, materiaId). Presente en respuestas ≥ H.2-B. */
  filas?: FilaDocenteMateria[];
  totales: TotalesListadoDocentes;
  /** Distribución de semáforos del plantel (B-04). Presente en respuestas ≥ v2.1. */
  distribucionSemaforos?: DistribucionSemaforosCarrera;
  estadoCalculo: EstadoCalculo;
}

/** Un ítem de distribución de dedicación docente por tipo de designación. */
export interface DedicacionTipoItem {
  tipo: string;
  docentes: number;
}

/** Un ítem del desglose de designaciones con porcentaje sobre el plantel total (H.3). */
export interface DesignacionDetalleItem {
  tipo: string;
  docentes: number;
  porcentaje: number;
}

/** Un tipo de cargo con su conteo de asignaciones (H.3). */
export interface JerarquiaCargoItem {
  cargo: string;
  cargos: number;
}

/** Desglose de jerarquía docente por tipo de cargo CONEAU (H.3). */
export interface JerarquiaDetalleDto {
  profesores: JerarquiaCargoItem[];
  totalProfesores: number;
  auxiliares: JerarquiaCargoItem[];
  totalAuxiliares: number;
  otros: number;
}

/** Categoría CONEAU de dedicación docente (CIERRE-03 Fase A). */
export type DedicacionConeau = 'EXCLUSIVA' | 'SEMIEXCLUSIVA' | 'SIMPLE' | 'NO_DETERMINADA';

/** Ítem de distribución CONEAU de dedicación (CIERRE-03 Fase A). */
export interface DedicacionConeauItem {
  categoria: DedicacionConeau;
  docentes: number;
}

/** Ítem de distribución por nivel de posgrado CONEAU (D-06). */
export interface PosgradoTipoItem {
  /** Nombre canónico: 'DOCTORADO' | 'MAESTRIA' | 'ESPECIALIZACION'. */
  tipo: string;
  docentes: number;
}

/** Bloque "Condiciones del plantel" CONEAU (FSD §9.2, B-03). */
export interface CondicionesPlantellResponse {
  totalDocentes: number;
  conPosgrado: number;
  conInvestigacion: number;
  conDesignacionRegular: number;
  conDesignacionInterina: number;
  /** Cargos P/A (IP-08). Ausente cuando estadoCalculo = NO_APLICA. */
  relacionPA?: { profesores: number; auxiliares: number };
  dedicacionPorTipo: DedicacionTipoItem[];
  /** Desglose de designaciones con porcentaje (H.3). Presente en respuestas ≥ v2.5. */
  designacionDetalle?: DesignacionDetalleItem[];
  /** Desglose de cargos por jerarquía CONEAU (H.3). Presente en respuestas ≥ v2.5. */
  jerarquia?: JerarquiaDetalleDto;
  /** Distribución por categoría CONEAU de dedicación (CIERRE-03 Fase A). Presente en respuestas ≥ v2.2. */
  dedicacionConeau?: DedicacionConeauItem[];
  /** Distribución por nivel máximo de posgrado CONEAU (D-06). Solo docentes clasificados. Presente en respuestas ≥ v2.3. */
  distribucionPosgrado?: PosgradoTipoItem[];
  estadoCalculo: EstadoCalculo;
}

/** Sumatoria de Formación Práctica por plan (D07). */
export interface FpResumenPlan {
  planEstudioId: string;
  planNombre: string;
  totalMaterias: number;
  conDatosNuevos: number;
  sumaHsNuevo: number;
  conDatosHistoricos: number;
  sumaHsHistorico: number;
  sinDatos: number;
}

export interface TablroCarreraResponse {
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
  /** Panel «Acción requerida» (FSD §9.2). */
  accionRequerida: ResultadoAccionRequerida;
  /** IP-05 — Docentes con posgrado. Presente en ejecuciones ≥ v2.4. */
  ip05?: ResultadoIP05;
  /** IP-06 — Docentes con investigación. Presente en ejecuciones ≥ v2.4. */
  ip06?: ResultadoIP06;
  /** IP-07 — Docentes con designación regular. Presente en ejecuciones ≥ v2.4. */
  ip07?: ResultadoIP07;
  /** Condiciones del plantel CONEAU (FSD §9.2, B-03). Presente en ejecuciones ≥ v2.1. */
  condicionesPlantell?: CondicionesPlantellResponse;
  /** FP por plan (D07). Presente en ejecuciones ≥ v2.2. */
  fpPorPlan?: FpResumenPlan[];
  estadoGeneralCalculo: EstadoCalculo;
}

// ── Auditoría de dedicación docente ──────────────────────────────────────────

/** Desglose horario por componente de la ficha docente. */
export interface ComponentesAuditoria {
  docencia: number;
  gestion: number;
  otras: number;
  desempenoNoAcademico: number;
  investigacion: number;
  vinculacion: number;
  gestionIndeterminada: boolean;
  otrasIndeterminadas: boolean;
  desempenoIndeterminado: boolean;
  investigacionIndeterminada: boolean;
  vinculacionIndeterminada: boolean;
}

/** Una fila de la auditoría. R-10 = 4.1+5.1+5.2+7.2+7.3. R-03 = 4.1+5.1+6.1. */
export interface FilaAuditoriaDedicacion {
  docenteId: string;
  /** "APELLIDO, Nombre" */
  nombre: string;
  componentes: ComponentesAuditoria;
  dedicacionTotalR10: number;
  cargaTopeR03: number;
  alertaR03: boolean;
  alertaR10: boolean;
  incierto: boolean;
}

export interface AuditoriaDedicacionResponse {
  carreraId: string;
  fechaEvaluacion: string;
  p01TopeH: number | null;
  p02BajaH: number | null;
  filas: FilaAuditoriaDedicacion[];
  estadoCalculo: EstadoCalculo;
}
