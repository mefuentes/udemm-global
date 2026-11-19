/**
 * Centralización del dato H/SEM (horas semanales docentes).
 *
 * Contexto:
 *   Materia.cargaHorariaSemanal  — valor vigente, calculado desde el Plan de Estudios.
 *   VinculacionCatedra.horasSemana — snapshot histórico capturado al crear la vinculación.
 *
 * Regla: los consumidores que necesiten las horas curriculares actuales DEBEN usar
 * `horasSemanalesVigentes()`. Nunca deben caer silenciosamente al snapshot cuando
 * el valor vigente es null.
 */

export interface MateriaHorasInput {
  cargaHorariaSemanal: number | null | undefined;
}

export interface VinculacionHorasInput {
  horasSemana: number | null | undefined;
}

/** Resultado que distingue explícitamente ambas fuentes. */
export interface HorasSemanalesResult {
  /** Valor actual del Plan de Estudios (Materia.cargaHorariaSemanal). Null si no definido. */
  vigentes: number | null;
  /** Snapshot al momento de la vinculación (VinculacionCatedra.horasSemana). Null si no definido. */
  historicas: number | null;
}

/**
 * Retorna las horas semanales vigentes desde el Plan de Estudios.
 * NO cae en fallback silencioso al snapshot de la vinculación.
 * Si la materia no tiene carga horaria definida, retorna null.
 */
export function horasSemanalesVigentes(materia: MateriaHorasInput): number | null {
  return materia.cargaHorariaSemanal ?? null;
}

/**
 * Retorna las horas semanales históricas registradas en la vinculación.
 * Valor contractual al momento de la asignación — solo para trazabilidad.
 */
export function horasSemanalesHistoricas(vinculacion: VinculacionHorasInput): number | null {
  return vinculacion.horasSemana ?? null;
}

/**
 * Resuelve ambas fuentes en un único resultado tipado.
 * Para consumidores que necesitan presentar o comparar ambos valores.
 */
export function resolverHorasSemanales(params: {
  materia: MateriaHorasInput;
  vinculacion: VinculacionHorasInput;
}): HorasSemanalesResult {
  return {
    vigentes:   horasSemanalesVigentes(params.materia),
    historicas: horasSemanalesHistoricas(params.vinculacion),
  };
}

/**
 * Indica si el valor vigente difiere del snapshot histórico.
 * Útil para alertar al usuario o para que Fase B detecte vinculaciones desincronizadas.
 * Retorna false si alguno de los dos es null (no hay base de comparación).
 */
export function horasSemanalesDesincronizadas(params: {
  materia: MateriaHorasInput;
  vinculacion: VinculacionHorasInput;
}): boolean {
  const vigentes   = horasSemanalesVigentes(params.materia);
  const historicas = horasSemanalesHistoricas(params.vinculacion);
  if (vigentes === null || historicas === null) return false;
  return vigentes !== historicas;
}
