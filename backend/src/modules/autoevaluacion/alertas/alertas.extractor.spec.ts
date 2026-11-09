import { extraerAlertas } from './alertas.extractor';
import { EstadoCalculo } from '../types/estado-calculo.types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const CTX = {
  ambito:        'PLAN' as const,
  entidadId:    'plan-1',
  facultadId:   'fac-1',
  ejecucionId:  'ej-1',
  fechaEjecucion: '2026-11-08T00:00:00.000Z',
  estadoCalculo: EstadoCalculo.CALCULADO,
};

function snapPlan(ipl02: Record<string, unknown>): Record<string, unknown> {
  return {
    ipl01: { cumple: true },
    ipl02,
    ipl03: { sinResponsable: 0 },
    ipl04: { paresConAlerta: 0 },
  };
}

function alertasIPL02(ipl02: Record<string, unknown>) {
  const alertas = extraerAlertas(
    snapPlan(ipl02),
    CTX.ambito,
    CTX.entidadId,
    CTX.facultadId,
    CTX.ejecucionId,
    CTX.fechaEjecucion,
    CTX.estadoCalculo,
  );
  return alertas.filter(a => a.regla === 'IPL-02');
}

// ── Tests — generación de alertas IPL-02 ─────────────────────────────────────

describe('alertas.extractor — IPL-02', () => {

  it('sin alertas cuando todos los bloques cumplen', () => {
    const result = alertasIPL02({ bloquesCumplen: 4, bloquesConUmbral: 4, bloquesDebajo: 0, bloquesInciertos: 0 });
    expect(result).toHaveLength(0);
  });

  it('alerta ALTA cuando hay bloques debajo del umbral', () => {
    const result = alertasIPL02({ bloquesCumplen: 3, bloquesConUmbral: 4, bloquesDebajo: 1, bloquesInciertos: 0 });
    expect(result).toHaveLength(1);
    expect(result[0].prioridad).toBe('ALTA');
    expect(result[0].descripcion).toContain('1 bloque(s)');
    expect(result[0].descripcion).toContain('por debajo del umbral');
  });

  it('alerta MEDIA cuando hay bloques con horas indeterminadas', () => {
    const result = alertasIPL02({ bloquesCumplen: 0, bloquesConUmbral: 4, bloquesDebajo: 0, bloquesInciertos: 4 });
    expect(result).toHaveLength(1);
    expect(result[0].prioridad).toBe('MEDIA');
    expect(result[0].descripcion).toContain('4 bloque(s)');
    expect(result[0].descripcion).toContain('no determinadas');
  });

  it('dos alertas cuando hay tanto debajo como inciertos', () => {
    const result = alertasIPL02({ bloquesCumplen: 1, bloquesConUmbral: 4, bloquesDebajo: 1, bloquesInciertos: 2 });
    expect(result).toHaveLength(2);
    const alta  = result.find(a => a.prioridad === 'ALTA');
    const media = result.find(a => a.prioridad === 'MEDIA');
    expect(alta).toBeDefined();
    expect(media).toBeDefined();
    expect(alta!.descripcion).toContain('1 bloque(s)');
    expect(media!.descripcion).toContain('2 bloque(s)');
  });

  it('sin alertas cuando no hay umbrales configurados (bloquesConUmbral = 0)', () => {
    const result = alertasIPL02({ bloquesCumplen: 0, bloquesConUmbral: 0, bloquesDebajo: 0, bloquesInciertos: 0 });
    expect(result).toHaveLength(0);
  });

  it('sin alertas cuando los campos nuevos están ausentes (snapshot heredado)', () => {
    // Snapshot anterior sin bloquesDebajo/bloquesInciertos → no genera alerta
    const result = alertasIPL02({ bloquesCumplen: 1, bloquesConUmbral: 4 });
    expect(result).toHaveLength(0);
  });

  it('regresión Plan 2006 — solo TB incumple: 1 alerta ALTA', () => {
    // CB=272≥250 ✓, TB=40<50 ✗, TA=40≥40 ✓, CTC=384≥300 ✓
    const result = alertasIPL02({ bloquesCumplen: 3, bloquesConUmbral: 4, bloquesDebajo: 1, bloquesInciertos: 0 });
    expect(result).toHaveLength(1);
    expect(result[0].prioridad).toBe('ALTA');
    expect(result[0].descripcion).toMatch(/^1 bloque/);
  });

  it('múltiples bloques debajo: descripción refleja el conteo exacto', () => {
    const result = alertasIPL02({ bloquesCumplen: 0, bloquesConUmbral: 4, bloquesDebajo: 4, bloquesInciertos: 0 });
    expect(result).toHaveLength(1);
    expect(result[0].descripcion).toContain('4 bloque(s)');
  });

});
