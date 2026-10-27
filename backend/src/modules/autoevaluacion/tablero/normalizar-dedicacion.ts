/**
 * Normalización conservadora de Docente.dedicacion → categoría CONEAU (CIERRE-03 Fase A).
 *
 * Reconoce únicamente variantes inequívocas de las tres categorías CONEAU.
 * Cualquier valor fuera de las formas reconocidas → NO_DETERMINADA.
 *
 * Regla de diseño:
 *  - Se trabaja en minúsculas sin acentos para comparar.
 *  - No se infiere dedicación desde designaciones (REGULAR, INTERINO, CONTRATADO).
 *  - Cero, nulo y vacío → NO_DETERMINADA (ausencia de dato, no es categoría de dedicación).
 *  - Formas con prefijo "dedicacion " o "dedicación " también se reconocen.
 */

export type DedicacionConeau = 'EXCLUSIVA' | 'SEMIEXCLUSIVA' | 'SIMPLE' | 'NO_DETERMINADA';

function sinAcentos(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const EXCLUSIVA_FORMAS = new Set([
  'exclusiva',
  'dedicacion exclusiva',
  'excl',
  'excl.',
]);

const SEMIEXCLUSIVA_FORMAS = new Set([
  'semiexclusiva',
  'semi exclusiva',
  'semi-exclusiva',
  'dedicacion semiexclusiva',
  'semiexcl',
  'semiexcl.',
]);

const SIMPLE_FORMAS = new Set([
  'simple',
  'dedicacion simple',
]);

export function normalizarDedicacionConeau(raw: string | null | undefined): DedicacionConeau {
  if (!raw?.trim()) return 'NO_DETERMINADA';
  const v = sinAcentos(raw.trim().toLowerCase());
  if (EXCLUSIVA_FORMAS.has(v)) return 'EXCLUSIVA';
  if (SEMIEXCLUSIVA_FORMAS.has(v)) return 'SEMIEXCLUSIVA';
  if (SIMPLE_FORMAS.has(v)) return 'SIMPLE';
  return 'NO_DETERMINADA';
}

export const ORDEN_DEDICACION_CONEAU: DedicacionConeau[] = [
  'EXCLUSIVA',
  'SEMIEXCLUSIVA',
  'SIMPLE',
  'NO_DETERMINADA',
];
