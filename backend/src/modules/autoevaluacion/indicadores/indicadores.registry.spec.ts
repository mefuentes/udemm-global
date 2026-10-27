import { RegistroIndicadores } from './indicadores.registry';
import type { IndicadorEvaluador, ContextoEvaluacion, ResultadoIndicador } from './indicadores.types';

// Evaluador stub que nunca debería llamarse en estos tests
const stubEvaluador: IndicadorEvaluador<unknown> = {
  evaluar: jest.fn((_ctx: ContextoEvaluacion): Promise<ResultadoIndicador<unknown>> => {
    throw new Error('No debería ser invocado en tests de registro');
  }),
};

function makeEval(): IndicadorEvaluador<unknown> {
  return { evaluar: jest.fn().mockResolvedValue({}) };
}

// Códigos que deben existir en el catálogo MOD-AUT v2.0 (R-01 y R-05 eliminados)
const CODIGOS_ESPERADOS = ['R-02', 'R-03', 'R-04', 'R-06', 'R-07', 'R-08', 'R-09', 'R-10', 'R-11', 'R-12', 'R-13', 'R-14', 'R-15'];

describe('RegistroIndicadores — estado estático', () => {
  let registro: RegistroIndicadores;

  beforeEach(() => {
    registro = new RegistroIndicadores();
  });

  it('contiene exactamente los 13 indicadores esperados', () => {
    const codigos = registro.listar().map(d => d.codigo).sort();
    expect(codigos).toEqual([...CODIGOS_ESPERADOS].sort());
  });

  it('R-01 y R-05 no están en el catálogo (eliminados en MOD-DOC v8.1)', () => {
    expect(registro.obtener('R-01')).toBeUndefined();
    expect(registro.obtener('R-05')).toBeUndefined();
  });

  it('no existe ningún código duplicado', () => {
    const codigos = registro.listar().map(d => d.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
  });

  it('R-13 es IMPLEMENTADO en el registro estático (post-IMPL-14B)', () => {
    const r13 = registro.obtener('R-13');
    expect(r13?.estadoImplementacion).toBe('IMPLEMENTADO');
    expect(r13?.motivoPendiente).toBeUndefined();
  });

  it('R-13 tiene parámetros P-FP1 y P-FP2 como configurables', () => {
    const r13 = registro.obtener('R-13');
    const pfp1 = r13?.parametros.find(p => p.codigo === 'P-FP1');
    const pfp2 = r13?.parametros.find(p => p.codigo === 'P-FP2');
    expect(pfp1?.configurable).toBe(true);
    expect(pfp1?.dependenciaPendiente).toBeUndefined();
    expect(pfp2?.configurable).toBe(true);
    expect(pfp2?.dependenciaPendiente).toBeUndefined();
  });

  it('ninguna regla tiene estadoImplementacion NO_IMPLEMENTADO en el registro estático', () => {
    const noImpl = registro.listar().filter(d => d.estadoImplementacion === 'NO_IMPLEMENTADO');
    expect(noImpl).toHaveLength(0);
  });

  it('reglas previamente diferidas a Fase 2B.3.2 son ahora IMPLEMENTADO', () => {
    const antes_diferidas = ['R-02', 'R-04', 'R-07', 'R-08', 'R-09', 'R-11', 'R-12'];
    for (const codigo of antes_diferidas) {
      const def = registro.obtener(codigo);
      expect(def?.estadoImplementacion).toBe('IMPLEMENTADO');
      expect(def?.motivoPendiente).toBeUndefined();
    }
  });
});

describe('RegistroIndicadores — estado efectivo post-asignación', () => {
  let registro: RegistroIndicadores;

  beforeEach(() => {
    registro = new RegistroIndicadores();
    // Simula lo que hace IndicadoresService en su constructor
    for (const codigo of CODIGOS_ESPERADOS) {
      registro.asignarEvaluador(codigo, makeEval());
    }
  });

  it('todos los indicadores tienen evaluador asignado', () => {
    for (const codigo of CODIGOS_ESPERADOS) {
      expect(registro.tieneEvaluador(codigo)).toBe(true);
    }
  });

  it('todos los indicadores están IMPLEMENTADO tras asignación, excepto R-10 y R-03 que son PARCIAL', () => {
    const parciales = new Set(['R-10', 'R-03']);
    for (const d of registro.listar()) {
      if (parciales.has(d.codigo)) {
        expect(d.estadoImplementacion).toBe('PARCIAL');
      } else {
        expect(d.estadoImplementacion).toBe('IMPLEMENTADO');
      }
    }
  });

  it('ningún indicador tiene motivoPendiente tras asignación, excepto R-10 y R-03', () => {
    const conMotivo = new Set(['R-10', 'R-03']);
    for (const d of registro.listar()) {
      if (conMotivo.has(d.codigo)) {
        expect(d.motivoPendiente).toBeDefined();
      } else {
        expect(d.motivoPendiente).toBeUndefined();
      }
    }
  });

  it('R-13 sigue IMPLEMENTADO y sin motivoPendiente después de asignarEvaluador', () => {
    const r13 = registro.obtener('R-13');
    expect(r13?.estadoImplementacion).toBe('IMPLEMENTADO');
    expect(r13?.motivoPendiente).toBeUndefined();
  });

  it('R-13 P-FP1 y P-FP2 siguen configurables después de asignarEvaluador', () => {
    const r13 = registro.obtener('R-13');
    for (const p of r13?.parametros ?? []) {
      if (p.codigo === 'P-FP1' || p.codigo === 'P-FP2') {
        expect(p.configurable).toBe(true);
      }
    }
  });
});

describe('RegistroIndicadores — asignarEvaluador no modifica IMPLEMENTADO ni PARCIAL', () => {
  it('asignarEvaluador sobre IMPLEMENTADO no altera el estado', () => {
    const reg = new RegistroIndicadores();
    // R-07 arranca en IMPLEMENTADO en el registro estático
    reg.asignarEvaluador('R-07', stubEvaluador);
    expect(reg.obtener('R-07')?.estadoImplementacion).toBe('IMPLEMENTADO');
  });

  it('asignarEvaluador sobre PARCIAL preserva el estado PARCIAL', () => {
    // R-03 arranca en PARCIAL; asignarEvaluador no lo promueve a IMPLEMENTADO
    const reg = new RegistroIndicadores();
    const antesR03 = reg.obtener('R-03')?.estadoImplementacion;
    reg.asignarEvaluador('R-03', stubEvaluador);
    expect(reg.obtener('R-03')?.estadoImplementacion).toBe(antesR03);
    expect(reg.obtener('R-03')?.estadoImplementacion).toBe('PARCIAL');
  });

  it('asignarEvaluador solo auto-promueve desde NO_IMPLEMENTADO', () => {
    // Verificamos que PARCIAL no se promueve a IMPLEMENTADO al asignar evaluador
    const reg = new RegistroIndicadores();
    const r03antes = reg.obtener('R-03')?.estadoImplementacion;
    reg.asignarEvaluador('R-03', stubEvaluador);
    expect(reg.obtener('R-03')?.estadoImplementacion).toBe(r03antes);
  });
});

describe('RegistroIndicadores — integridad de parámetros de configuración', () => {
  it('R-03 tiene parámetro P-01 configurable en FACULTAD', () => {
    const reg = new RegistroIndicadores();
    const p01 = reg.obtener('R-03')?.parametros[0];
    expect(p01?.codigo).toBe('P-01');
    expect(p01?.configurable).toBe(true);
    expect(p01?.origen).toBe('FACULTAD');
  });

  it('R-09 tiene 5 parámetros de umbral horario (P-10..P-14)', () => {
    const reg = new RegistroIndicadores();
    const params = reg.obtener('R-09')?.parametros ?? [];
    const codigos = params.map(p => p.codigo).sort();
    expect(codigos).toEqual(['P-10', 'P-11', 'P-12', 'P-13', 'P-14'].sort());
    for (const p of params) {
      expect(p.configurable).toBe(true);
      expect(p.origen).toBe('PLAN');
    }
  });

  it('R-13 P-FP1 apunta al campo porcentajeMinFormacion', () => {
    const reg = new RegistroIndicadores();
    const pfp1 = reg.obtener('R-13')?.parametros.find(p => p.codigo === 'P-FP1');
    expect(pfp1?.campoDb).toBe('porcentajeMinFormacion');
  });
});
