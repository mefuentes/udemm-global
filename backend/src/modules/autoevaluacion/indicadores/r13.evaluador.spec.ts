import { BadRequestException } from '@nestjs/common';
import { EstadoCalculo } from '../types/estado-calculo.types';
import { R13EvaluadorService } from './r13.evaluador';
import type { ContextoEvaluacion } from './indicadores.types';

// ── UUIDs de prueba ───────────────────────────────────────────────────────────

const PLAN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const FECHA   = new Date('2026-10-01');

// ── Fábricas ──────────────────────────────────────────────────────────────────

function makeContexto(extra: Partial<ContextoEvaluacion> = {}): ContextoEvaluacion {
  return {
    usuarioId: USER_ID,
    rolNombre: 'SECRETARIA_ACADEMICA',
    planEstudioId: PLAN_ID,
    fechaEvaluacion: FECHA,
    ...extra,
  };
}

interface MateriaSimple {
  id: string;
  nombre: string;
  codigo: string;
  tipoAsignatura: string;
  cargaHorariaTotal: number | null;
}

function makeMateria(
  id: string,
  nombre: string,
  codigo: string,
  tipo: string,
  cargaHorariaTotal: number | null = 64,
): MateriaSimple {
  return { id, nombre, codigo, tipoAsignatura: tipo, cargaHorariaTotal };
}

interface ConfigFormacion {
  requierePPS: boolean | null;
  requierePI: boolean | null;
  porcentajeMinFormacion: number | null;
}

const CONFIG_NULL: ConfigFormacion = { requierePPS: null, requierePI: null, porcentajeMinFormacion: null };

function makeConsultas(materias: MateriaSimple[], config: ConfigFormacion = CONFIG_NULL) {
  return {
    obtenerMateriasDePlan: jest.fn().mockResolvedValue(materias),
    obtenerConfigFormacionPlan: jest.fn().mockResolvedValue({
      planEstudioId: PLAN_ID,
      ...config,
    }),
  };
}

const makeService = (consultas: ReturnType<typeof makeConsultas>) =>
  new R13EvaluadorService(consultas as any);

// ── Validación de contexto ────────────────────────────────────────────────────

describe('R13EvaluadorService — validación de contexto', () => {
  it('ausencia de planEstudioId → BadRequestException', async () => {
    const service = makeService(makeConsultas([]));
    await expect(service.evaluar(makeContexto({ planEstudioId: undefined }))).rejects.toThrow(
      BadRequestException,
    );
  });
});

// ── NO_APLICA ─────────────────────────────────────────────────────────────────

describe('R13EvaluadorService — NO_APLICA', () => {
  it('plan sin materias → NO_APLICA, totales en cero', async () => {
    const service = makeService(makeConsultas([]));
    const res = await service.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    expect(res.valor?.totalMaterias).toBe(0);
    expect(res.valor?.tienePPS).toBe(false);
    expect(res.valor?.tienePI).toBe(false);
    expect(res.valor?.materiasPPS).toHaveLength(0);
    expect(res.valor?.materiasPI).toHaveLength(0);
  });
});

// ── CALCULADO — distribución por tipo ────────────────────────────────────────

describe('R13EvaluadorService — distribución por tipo', () => {
  it('solo materias OBLIGATORIA → porTipo.OBLIGATORIA correcto, tienePPS=false, tienePI=false', async () => {
    const materias = [
      makeMateria('m1', 'Álgebra', 'ALG', 'OBLIGATORIA'),
      makeMateria('m2', 'Física',  'FIS', 'OBLIGATORIA'),
    ];
    const service = makeService(makeConsultas(materias));
    const res = await service.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect(res.valor?.porTipo.OBLIGATORIA).toBe(2);
    expect(res.valor?.porTipo.PPS).toBe(0);
    expect(res.valor?.porTipo.PI).toBe(0);
    expect(res.valor?.tienePPS).toBe(false);
    expect(res.valor?.tienePI).toBe(false);
  });

  it('mix de tipos → conteos correctos', async () => {
    const materias = [
      makeMateria('m1', 'Álgebra',   'ALG', 'OBLIGATORIA'),
      makeMateria('m2', 'Electiva1', 'EL1', 'ELECTIVA'),
      makeMateria('m3', 'PPS I',     'PPS', 'PPS', 120),
      makeMateria('m4', 'PI',        'PI1', 'PI', 80),
      makeMateria('m5', 'Especial',  'ESP', 'ESPECIAL'),
    ];
    const service = makeService(makeConsultas(materias));
    const res = await service.evaluar(makeContexto());
    expect(res.valor?.totalMaterias).toBe(5);
    expect(res.valor?.porTipo.OBLIGATORIA).toBe(1);
    expect(res.valor?.porTipo.ELECTIVA).toBe(1);
    expect(res.valor?.porTipo.PPS).toBe(1);
    expect(res.valor?.porTipo.PI).toBe(1);
    expect(res.valor?.porTipo.OTRO).toBe(1);
    expect(res.valor?.tienePPS).toBe(true);
    expect(res.valor?.tienePI).toBe(true);
  });

  it('tipoAsignatura en minúscula → se normaliza correctamente', async () => {
    const materias = [
      makeMateria('m1', 'PPS I', 'PPS', 'pps', 120),
    ];
    const service = makeService(makeConsultas(materias));
    const res = await service.evaluar(makeContexto());
    expect(res.valor?.porTipo.PPS).toBe(1);
    expect(res.valor?.tienePPS).toBe(true);
  });
});

// ── Horas por tipo ────────────────────────────────────────────────────────────

describe('R13EvaluadorService — horas por tipo', () => {
  it('PPS con cargaHorariaTotal → horasPPS = suma', async () => {
    const materias = [
      makeMateria('m1', 'PPS I',  'P1', 'PPS', 120),
      makeMateria('m2', 'PPS II', 'P2', 'PPS', 80),
    ];
    const service = makeService(makeConsultas(materias));
    const res = await service.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect(res.valor?.horasPPS).toBe(200);
    expect(res.valor?.materiasPPS).toHaveLength(2);
  });

  it('PI sin cargaHorariaTotal → horasPI = null, estadoCalculo = PARCIAL', async () => {
    const materias = [
      makeMateria('m1', 'PI', 'PI1', 'PI', null),
    ];
    const service = makeService(makeConsultas(materias));
    const res = await service.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
    expect(res.valor?.horasPI).toBeNull();
  });

  it('sin PPS → horasPPS = null (lista vacía)', async () => {
    const materias = [makeMateria('m1', 'Álgebra', 'ALG', 'OBLIGATORIA')];
    const service = makeService(makeConsultas(materias));
    const res = await service.evaluar(makeContexto());
    expect(res.valor?.horasPPS).toBeNull();
  });
});

// ── datosFaltantes ────────────────────────────────────────────────────────────

describe('R13EvaluadorService — datosFaltantes', () => {
  it('siempre incluye nota sobre campos de schema faltantes', async () => {
    const materias = [makeMateria('m1', 'Álgebra', 'ALG', 'OBLIGATORIA')];
    const service = makeService(makeConsultas(materias));
    const res = await service.evaluar(makeContexto());
    expect(res.datosFaltantes).toHaveLength(1);
    expect(res.datosFaltantes[0].entidad).toBe('PlanEstudio');
    expect(res.datosFaltantes[0].campo).toContain('porcentajeMinFormacion');
  });

  it('con PPS sin cargaHorariaTotal → 2 datos faltantes (schema + cargaHoraria)', async () => {
    const materias = [makeMateria('m1', 'PPS I', 'PPS', 'PPS', null)];
    const service = makeService(makeConsultas(materias));
    const res = await service.evaluar(makeContexto());
    expect(res.datosFaltantes).toHaveLength(2);
    const entidades = res.datosFaltantes.map(d => d.entidad);
    expect(entidades).toContain('PlanEstudio');
    expect(entidades).toContain('Materia');
  });
});

// ── Metadatos ─────────────────────────────────────────────────────────────────

describe('R13EvaluadorService — metadatos', () => {
  it('codigo=R-13, tipoContexto=PLAN, estadoImplementacion=IMPLEMENTADO', async () => {
    const service = makeService(makeConsultas([]));
    const res = await service.evaluar(makeContexto());
    expect(res.codigo).toBe('R-13');
    expect(res.tipoContexto).toBe('PLAN');
    expect(res.estadoImplementacion).toBe('IMPLEMENTADO');
    expect(res.contextoId).toBe(PLAN_ID);
  });
});

// ── Configuración del plan (nullable semantics) ───────────────────────────────

describe('R13EvaluadorService — configuracionPlan', () => {
  it('config nula → configuracionPlan refleja todos null, D-13 presente, sin violaciones', async () => {
    const materias = [makeMateria('m1', 'PPS I', 'P1', 'PPS', 120)];
    const svc = makeService(makeConsultas(materias, CONFIG_NULL));
    const res = await svc.evaluar(makeContexto());
    expect(res.valor?.configuracionPlan).toEqual(CONFIG_NULL);
    expect(res.valor?.violacionesFormacion).toHaveLength(0);
    const d13 = res.datosFaltantes.find(d => d.entidad === 'PlanEstudio');
    expect(d13).toBeDefined();
  });

  it('todas las config no nulas → D-13 removido', async () => {
    const materias = [makeMateria('m1', 'PPS I', 'P1', 'PPS', 120)];
    const svc = makeService(makeConsultas(materias, { requierePPS: true, requierePI: false, porcentajeMinFormacion: 10 }));
    const res = await svc.evaluar(makeContexto());
    const d13Schema = res.datosFaltantes.find(d => d.entidad === 'PlanEstudio');
    expect(d13Schema).toBeUndefined();
  });
});

// ── Lógica de cumplimiento (FSD §6.3) ────────────────────────────────────────

describe('R13EvaluadorService — violaciones de formación práctica', () => {
  it('requierePPS=true y tienePPS=false → violación PPS', async () => {
    const materias = [makeMateria('m1', 'Álgebra', 'ALG', 'OBLIGATORIA')];
    const svc = makeService(makeConsultas(materias, { requierePPS: true, requierePI: null, porcentajeMinFormacion: null }));
    const res = await svc.evaluar(makeContexto());
    expect(res.valor?.violacionesFormacion).toHaveLength(1);
    expect(res.valor?.violacionesFormacion[0]).toMatch(/PPS/i);
  });

  it('requierePPS=false y tienePPS=false → sin violación PPS', async () => {
    const materias = [makeMateria('m1', 'Álgebra', 'ALG', 'OBLIGATORIA')];
    const svc = makeService(makeConsultas(materias, { requierePPS: false, requierePI: null, porcentajeMinFormacion: null }));
    const res = await svc.evaluar(makeContexto());
    const violPPS = res.valor?.violacionesFormacion.filter(v => /pps/i.test(v));
    expect(violPPS).toHaveLength(0);
  });

  it('requierePI=true y tienePI=false → violación PI', async () => {
    const materias = [makeMateria('m1', 'Álgebra', 'ALG', 'OBLIGATORIA')];
    const svc = makeService(makeConsultas(materias, { requierePPS: null, requierePI: true, porcentajeMinFormacion: null }));
    const res = await svc.evaluar(makeContexto());
    expect(res.valor?.violacionesFormacion).toHaveLength(1);
    expect(res.valor?.violacionesFormacion[0]).toMatch(/PI/i);
  });

  it('porcentajeMinFormacion=20 y formación práctica < 20 % → violación porcentaje', async () => {
    // 80 horas prácticas sobre 400 totales = 20 % exacto... necesito 19 %
    const materias = [
      makeMateria('m1', 'Obligatoria 1', 'OB1', 'OBLIGATORIA', 300),
      makeMateria('m2', 'Obligatoria 2', 'OB2', 'OBLIGATORIA', 100),
      makeMateria('m3', 'PPS I',         'PPS', 'PPS',          80), // 80/480 = 16.7 %
    ];
    const svc = makeService(makeConsultas(materias, { requierePPS: null, requierePI: null, porcentajeMinFormacion: 20 }));
    const res = await svc.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    const violPct = res.valor?.violacionesFormacion.find(v => /insuficiente/i.test(v));
    expect(violPct).toBeDefined();
  });

  it('porcentajeMinFormacion=20 y formación práctica >= 20 % → sin violación', async () => {
    const materias = [
      makeMateria('m1', 'Obligatoria', 'OB1', 'OBLIGATORIA', 200),
      makeMateria('m2', 'PPS I',       'PPS', 'PPS',          60), // 60/260 = 23.1 %
    ];
    const svc = makeService(makeConsultas(materias, { requierePPS: null, requierePI: null, porcentajeMinFormacion: 20 }));
    const res = await svc.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    const violPct = res.valor?.violacionesFormacion.find(v => /insuficiente/i.test(v));
    expect(violPct).toBeUndefined();
  });

  it('porcentajeMinFormacion configurado pero alguna hora nula → PARCIAL (no evalúa porcentaje)', async () => {
    const materias = [
      makeMateria('m1', 'PPS I',       'PPS', 'PPS', null), // sin carga horaria
      makeMateria('m2', 'Obligatoria', 'OB1', 'OBLIGATORIA', 200),
    ];
    const svc = makeService(makeConsultas(materias, { requierePPS: null, requierePI: null, porcentajeMinFormacion: 20 }));
    const res = await svc.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
    // No puede evaluar porcentaje → no viola por porcentaje
    const violPct = res.valor?.violacionesFormacion.find(v => /insuficiente/i.test(v));
    expect(violPct).toBeUndefined();
  });
});
