import {
  horasSemanalesVigentes,
  horasSemanalesHistoricas,
  resolverHorasSemanales,
  horasSemanalesDesincronizadas,
} from './horas-semanales.utils';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function materia(cargaHorariaSemanal: number | null) {
  return { cargaHorariaSemanal };
}

function vinculacion(horasSemana: number | null) {
  return { horasSemana };
}

// ── horasSemanalesVigentes ────────────────────────────────────────────────────

describe('horasSemanalesVigentes', () => {

  it('retorna el valor de Materia.cargaHorariaSemanal cuando está definido', () => {
    expect(horasSemanalesVigentes(materia(4))).toBe(4);
  });

  it('retorna null cuando Materia.cargaHorariaSemanal es null — sin fallback al snapshot', () => {
    expect(horasSemanalesVigentes(materia(null))).toBeNull();
  });

  it('retorna null cuando cargaHorariaSemanal es undefined', () => {
    expect(horasSemanalesVigentes({ cargaHorariaSemanal: undefined })).toBeNull();
  });

  it('no usa VinculacionCatedra.horasSemana como fallback — siempre retorna null si materia no tiene valor', () => {
    // Aunque la vinculación tenga 4 h/sem, la función solo recibe la materia
    const result = horasSemanalesVigentes(materia(null));
    expect(result).toBeNull();
  });

  it('refleja un cambio de carga horaria: nuevo valor vigente difiere del original', () => {
    const original = horasSemanalesVigentes(materia(4));
    const actualizado = horasSemanalesVigentes(materia(5)); // Plan de Estudios modificado
    expect(original).toBe(4);
    expect(actualizado).toBe(5);
    expect(actualizado).not.toBe(original);
  });

  it('múltiples vinculaciones a la misma materia → mismo valor vigente para todas', () => {
    const materiaShared = materia(6);
    expect(horasSemanalesVigentes(materiaShared)).toBe(6);
    expect(horasSemanalesVigentes(materiaShared)).toBe(6); // idem para segunda vinculación
  });

});

// ── horasSemanalesHistoricas ──────────────────────────────────────────────────

describe('horasSemanalesHistoricas', () => {

  it('retorna el snapshot de VinculacionCatedra.horasSemana', () => {
    expect(horasSemanalesHistoricas(vinculacion(4))).toBe(4);
  });

  it('retorna null cuando horasSemana es null', () => {
    expect(horasSemanalesHistoricas(vinculacion(null))).toBeNull();
  });

  it('retorna null cuando horasSemana es undefined', () => {
    expect(horasSemanalesHistoricas({ horasSemana: undefined })).toBeNull();
  });

  it('conserva el valor histórico aunque la materia haya cambiado a un valor diferente', () => {
    // La vinculación fue creada cuando la materia tenía 4 h/sem
    const historicas = horasSemanalesHistoricas(vinculacion(4));
    // La materia ahora tiene 5 h/sem — el histórico permanece en 4
    expect(historicas).toBe(4);
  });

  it('dos vinculaciones creadas en momentos distintos pueden tener históricos diferentes', () => {
    const vinc1 = horasSemanalesHistoricas(vinculacion(4)); // creada cuando era 4
    const vinc2 = horasSemanalesHistoricas(vinculacion(5)); // creada después del cambio a 5
    expect(vinc1).toBe(4);
    expect(vinc2).toBe(5);
  });

});

// ── resolverHorasSemanales ────────────────────────────────────────────────────

describe('resolverHorasSemanales', () => {

  it('retorna ambos valores cuando ambos están definidos', () => {
    const result = resolverHorasSemanales({
      materia: materia(5),
      vinculacion: vinculacion(4),
    });
    expect(result.vigentes).toBe(5);
    expect(result.historicas).toBe(4);
  });

  it('vigentes=null, historicas=4 cuando la materia no tiene carga definida', () => {
    const result = resolverHorasSemanales({
      materia: materia(null),
      vinculacion: vinculacion(4),
    });
    expect(result.vigentes).toBeNull();
    expect(result.historicas).toBe(4); // snapshot se conserva aunque la materia esté sin carga
  });

  it('vigentes=4, historicas=null cuando la vinculación no tiene snapshot', () => {
    const result = resolverHorasSemanales({
      materia: materia(4),
      vinculacion: vinculacion(null),
    });
    expect(result.vigentes).toBe(4);
    expect(result.historicas).toBeNull();
  });

  it('ambos null cuando ninguno tiene valor', () => {
    const result = resolverHorasSemanales({
      materia: materia(null),
      vinculacion: vinculacion(null),
    });
    expect(result.vigentes).toBeNull();
    expect(result.historicas).toBeNull();
  });

  it('vigentes === historicas cuando el Plan de Estudios no cambió desde la vinculación', () => {
    const result = resolverHorasSemanales({
      materia: materia(4),
      vinculacion: vinculacion(4),
    });
    expect(result.vigentes).toBe(result.historicas);
  });

});

// ── horasSemanalesDesincronizadas ─────────────────────────────────────────────

describe('horasSemanalesDesincronizadas', () => {

  it('true cuando vigentes difieren del snapshot histórico', () => {
    expect(horasSemanalesDesincronizadas({
      materia: materia(5),    // Plan de Estudios actualizado
      vinculacion: vinculacion(4), // snapshot desactualizado
    })).toBe(true);
  });

  it('false cuando vigentes y snapshot coinciden', () => {
    expect(horasSemanalesDesincronizadas({
      materia: materia(4),
      vinculacion: vinculacion(4),
    })).toBe(false);
  });

  it('false cuando vigentes es null — no hay base de comparación', () => {
    expect(horasSemanalesDesincronizadas({
      materia: materia(null),
      vinculacion: vinculacion(4),
    })).toBe(false);
  });

  it('false cuando histórico es null — no hay base de comparación', () => {
    expect(horasSemanalesDesincronizadas({
      materia: materia(4),
      vinculacion: vinculacion(null),
    })).toBe(false);
  });

  it('detecta el escenario de desincronización del análisis H/SEM: cambio de régimen cuatrimestral→anual', () => {
    // Antes: 64h cuatrimestral = 4 h/sem (snapshot)
    // Después: 64h anual = 2 h/sem (vigente)
    expect(horasSemanalesDesincronizadas({
      materia: materia(2),
      vinculacion: vinculacion(4),
    })).toBe(true);
  });

});
