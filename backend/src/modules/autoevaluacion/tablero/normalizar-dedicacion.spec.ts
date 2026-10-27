import {
  normalizarDedicacionConeau,
  ORDEN_DEDICACION_CONEAU,
  type DedicacionConeau,
} from './normalizar-dedicacion';

describe('normalizarDedicacionConeau', () => {
  // ── Exclusiva ────────────────────────────────────────────────────────────

  it.each([
    'exclusiva',
    'Exclusiva',
    'EXCLUSIVA',
    'Dedicacion Exclusiva',
    'dedicación exclusiva',
    'excl',
    'excl.',
    'EXCL.',
    ' exclusiva ',
  ])('reconoce "%s" como EXCLUSIVA', (raw) => {
    expect(normalizarDedicacionConeau(raw)).toBe('EXCLUSIVA');
  });

  // ── Semiexclusiva ────────────────────────────────────────────────────────

  it.each([
    'semiexclusiva',
    'Semiexclusiva',
    'SEMIEXCLUSIVA',
    'semi exclusiva',
    'Semi Exclusiva',
    'semi-exclusiva',
    'Semi-Exclusiva',
    'Dedicacion Semiexclusiva',
    'dedicación semiexclusiva',
    'semiexcl',
    'semiexcl.',
    ' semiexclusiva ',
  ])('reconoce "%s" como SEMIEXCLUSIVA', (raw) => {
    expect(normalizarDedicacionConeau(raw)).toBe('SEMIEXCLUSIVA');
  });

  // ── Simple ───────────────────────────────────────────────────────────────

  it.each([
    'simple',
    'Simple',
    'SIMPLE',
    'Dedicacion Simple',
    'dedicación simple',
    ' simple ',
  ])('reconoce "%s" como SIMPLE', (raw) => {
    expect(normalizarDedicacionConeau(raw)).toBe('SIMPLE');
  });

  // ── NO_DETERMINADA: nulo / vacío ─────────────────────────────────────────

  it.each([null, undefined, '', '   '])(
    'devuelve NO_DETERMINADA para valor nulo/vacío: %s',
    (raw) => {
      expect(normalizarDedicacionConeau(raw)).toBe('NO_DETERMINADA');
    },
  );

  // ── NO_DETERMINADA: valores ambiguos y desconocidos ──────────────────────

  it.each([
    'regular',
    'REGULAR',
    'interino',
    'contratado',
    'ad honorem',
    'part-time',
    'tiempo completo',
    'TC',
    'TP',
    '40hs',
    '20',
    'excl extra',
    'parcial',
    'otra dedicacion',
  ])('devuelve NO_DETERMINADA para "%s" (ambiguo / designación / no reconocido)', (raw) => {
    expect(normalizarDedicacionConeau(raw)).toBe('NO_DETERMINADA');
  });

  // ── No infiere desde formas con prefijo parcial ──────────────────────────

  it('no infiere EXCLUSIVA desde "excl extra" (coincidencia parcial)', () => {
    expect(normalizarDedicacionConeau('excl extra')).toBe('NO_DETERMINADA');
  });

  it('no infiere SEMIEXCLUSIVA desde "semi" solo', () => {
    expect(normalizarDedicacionConeau('semi')).toBe('NO_DETERMINADA');
  });
});

describe('ORDEN_DEDICACION_CONEAU', () => {
  it('contiene las cuatro categorías en orden canónico CONEAU', () => {
    expect(ORDEN_DEDICACION_CONEAU).toEqual([
      'EXCLUSIVA',
      'SEMIEXCLUSIVA',
      'SIMPLE',
      'NO_DETERMINADA',
    ]);
  });

  it('cubre todas las categorías posibles de DedicacionConeau', () => {
    const todas: DedicacionConeau[] = ['EXCLUSIVA', 'SEMIEXCLUSIVA', 'SIMPLE', 'NO_DETERMINADA'];
    expect(new Set(ORDEN_DEDICACION_CONEAU)).toEqual(new Set(todas));
  });
});

// ── CIERRE-03 Fase B: compatibilidad histórica y no pérdida de datos ─────────

describe('compatibilidad histórica — D-05', () => {
  it('no clasifica automáticamente "REGULAR" como ninguna categoría CONEAU', () => {
    expect(normalizarDedicacionConeau('REGULAR')).toBe('NO_DETERMINADA');
  });

  it('no clasifica automáticamente "INTERINO" como ninguna categoría CONEAU', () => {
    expect(normalizarDedicacionConeau('INTERINO')).toBe('NO_DETERMINADA');
  });

  it('no clasifica automáticamente "CONTRATADO" como ninguna categoría CONEAU', () => {
    expect(normalizarDedicacionConeau('CONTRATADO')).toBe('NO_DETERMINADA');
  });

  it('un valor de dedicación histórica no reconocido devuelve NO_DETERMINADA, no excepción', () => {
    const historicos = ['40hs semanales', 'TC full', 'media jornada', '20h', 'Reemplazante', 'Ad-honorem'];
    for (const v of historicos) {
      expect(() => normalizarDedicacionConeau(v)).not.toThrow();
      expect(normalizarDedicacionConeau(v)).toBe('NO_DETERMINADA');
    }
  });

  it('un valor null no genera excepción (dato faltante en historial)', () => {
    expect(() => normalizarDedicacionConeau(null)).not.toThrow();
    expect(normalizarDedicacionConeau(null)).toBe('NO_DETERMINADA');
  });

  it('preserva la distinción: "simple" no es clasificado como ninguna otra categoría', () => {
    const resultado = normalizarDedicacionConeau('simple');
    expect(resultado).toBe('SIMPLE');
    expect(resultado).not.toBe('EXCLUSIVA');
    expect(resultado).not.toBe('SEMIEXCLUSIVA');
  });

  it('no infiere categoría desde prefijos: "exclusiv" solo no es EXCLUSIVA', () => {
    expect(normalizarDedicacionConeau('exclusiv')).toBe('NO_DETERMINADA');
  });

  it('normalización es idempotente: aplicada dos veces da el mismo resultado', () => {
    const valores = ['exclusiva', 'Semiexclusiva', 'SIMPLE', 'regular', null, undefined, ''];
    for (const v of valores) {
      const primera = normalizarDedicacionConeau(v);
      // La segunda llamada convierte el resultado de la primera
      // (que ya es NO_DETERMINADA / EXCLUSIVA / etc.) en texto:
      // NO_DETERMINADA → NO_DETERMINADA (sigue siendo texto no reconocido → NO_DETERMINADA) ✓
      // EXCLUSIVA → 'exclusiva' normalizado de nuevo → EXCLUSIVA ✓
      if (primera !== 'NO_DETERMINADA') {
        expect(normalizarDedicacionConeau(primera.toLowerCase())).toBe(primera);
      } else {
        expect(normalizarDedicacionConeau(primera)).toBe('NO_DETERMINADA');
      }
    }
  });
});
