import { BadRequestException } from '@nestjs/common';
import { EstadoCalculo } from '../types/estado-calculo.types';
import { R04EvaluadorService } from './r04.evaluador';
import type { CargosParaR04, CargoVigenteR04, DocenteConCargosR04 } from '../consultas-academicas/consultas-academicas.types';
import type { ContextoEvaluacion } from './indicadores.types';

// ── UUIDs de prueba (formato v4 válido: variante [89ab] en grupo 4) ──────────
const PLAN_ID    = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CARRERA_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const DOCENTE_A  = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const DOCENTE_B  = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CARGO_X    = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const CARGO_Y    = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const USER_ID    = '11111111-1111-4111-8111-111111111111';
const FECHA_HOY  = new Date('2026-10-01');

// ── Fábricas ─────────────────────────────────────────────────────────────────

function makeContexto(extra: Partial<ContextoEvaluacion> = {}): ContextoEvaluacion {
  return {
    usuarioId: USER_ID,
    rolNombre: 'SECRETARIA_ACADEMICA',
    planEstudioId: PLAN_ID,
    fechaEvaluacion: FECHA_HOY,
    ...extra,
  };
}

function makeCargoVigente(
  cargoDocenteId: string,
  verificado = true,
  tieneActividadEnPlan = false,
): CargoVigenteR04 {
  return {
    cargoDocenteId,
    cargoNombre: 'Profesor Adjunto',
    designacion: 'Reg. Ded. Exc.',
    fechaInicio: new Date('2022-01-01'),
    fechaFin: null,
    verificado,
    tieneActividadEnPlan,
  };
}

function makeDocente(
  docenteId: string,
  nombre: string,
  apellido: string,
  cargosVigentes: CargoVigenteR04[] = [],
): DocenteConCargosR04 {
  return {
    docenteId,
    nombre,
    apellido,
    relevamientoCargosCompleto: true,
    cargosVigentes,
  };
}

function makeCargosData(docentes: DocenteConCargosR04[]): CargosParaR04 {
  return { docentes, planEstudioId: PLAN_ID, carreraId: CARRERA_ID };
}

function makeConsultas(data: CargosParaR04) {
  return { obtenerCargosParaR04: jest.fn().mockResolvedValue(data) };
}

const makeService = (consultas: ReturnType<typeof makeConsultas>) =>
  new R04EvaluadorService(consultas as any);

// ── Validación de contexto ────────────────────────────────────────────────────

describe('R04EvaluadorService — validación de contexto', () => {
  it('ausencia de planEstudioId → BadRequestException', async () => {
    const service = makeService(makeConsultas(makeCargosData([])));
    await expect(service.evaluar(makeContexto({ planEstudioId: undefined }))).rejects.toThrow(
      BadRequestException,
    );
  });
});

// ── Estado NO_APLICA ──────────────────────────────────────────────────────────

describe('R04EvaluadorService — NO_APLICA', () => {
  it('plantel vacío → NO_APLICA, 0 alertas, totalDocentesPlantel = 0', async () => {
    const service = makeService(makeConsultas(makeCargosData([])));
    const res = await service.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    expect(res.valor?.cargosEnAlerta).toHaveLength(0);
    expect(res.valor?.totalDocentesPlantel).toBe(0);
    expect(res.valor?.docentesExceptuadosPorC4).toEqual([]);
  });
});

// ── CALCULADO sin alertas ─────────────────────────────────────────────────────

describe('R04EvaluadorService — CALCULADO sin alertas', () => {
  it('docente sin cargos institucionales → no genera alerta', async () => {
    const doc = makeDocente(DOCENTE_A, 'Ana', 'García', []);
    const service = makeService(makeConsultas(makeCargosData([doc])));
    const res = await service.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect(res.valor?.cargosEnAlerta).toHaveLength(0);
    expect(res.valor?.totalDocentesPlantel).toBe(1);
  });

  it('cargo vigente con actividad en el plan → no genera alerta', async () => {
    const cargo = makeCargoVigente(CARGO_X, true, true);
    const doc = makeDocente(DOCENTE_A, 'Ana', 'García', [cargo]);
    const service = makeService(makeConsultas(makeCargosData([doc])));
    const res = await service.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect(res.valor?.cargosEnAlerta).toHaveLength(0);
  });

  it('todos con actividad → 0 alertas, datosFaltantes vacíos', async () => {
    const cargo = makeCargoVigente(CARGO_X, true, true);
    const doc = makeDocente(DOCENTE_A, 'Ana', 'García', [cargo]);
    const service = makeService(makeConsultas(makeCargosData([doc])));
    const res = await service.evaluar(makeContexto());
    expect(res.valor?.totalCargosEnAlerta).toBe(0);
    expect(res.datosFaltantes).toHaveLength(0);
  });
});

// ── CALCULADO con alertas (cargos verificados sin actividad) ──────────────────

describe('R04EvaluadorService — CALCULADO con alertas', () => {
  it('cargo vigente sin actividad, verificado=true → CALCULADO, 1 alerta', async () => {
    const cargo = makeCargoVigente(CARGO_X, true, false);
    const doc = makeDocente(DOCENTE_A, 'Ana', 'García', [cargo]);
    const service = makeService(makeConsultas(makeCargosData([doc])));
    const res = await service.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect(res.valor?.cargosEnAlerta).toHaveLength(1);
    expect(res.valor?.cargosEnAlerta[0].cargoDocenteId).toBe(CARGO_X);
    expect(res.valor?.totalCargosEnAlerta).toBe(1);
    expect(res.valor?.docentesExceptuadosPorC4).toEqual([DOCENTE_A]);
  });

  it('campos de alerta incluyen datos correctos del cargo y del docente', async () => {
    const cargo = makeCargoVigente(CARGO_X, true, false);
    const doc = makeDocente(DOCENTE_A, 'Ana', 'García', [cargo]);
    const service = makeService(makeConsultas(makeCargosData([doc])));
    const res = await service.evaluar(makeContexto());
    const alerta = res.valor!.cargosEnAlerta[0];
    expect(alerta.docenteId).toBe(DOCENTE_A);
    expect(alerta.nombre).toBe('Ana García');
    expect(alerta.cargoNombre).toBe('Profesor Adjunto');
    expect(alerta.designacion).toBe('Reg. Ded. Exc.');
    expect(alerta.verificado).toBe(true);
  });
});

// ── PARCIAL (cargos no verificados sin actividad) ─────────────────────────────

describe('R04EvaluadorService — PARCIAL', () => {
  it('cargo vigente sin actividad, verificado=false → PARCIAL, 1 alerta', async () => {
    const cargo = makeCargoVigente(CARGO_X, false, false);
    const doc = makeDocente(DOCENTE_A, 'Ana', 'García', [cargo]);
    const service = makeService(makeConsultas(makeCargosData([doc])));
    const res = await service.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
    expect(res.valor?.cargosEnAlerta).toHaveLength(1);
    expect(res.datosFaltantes).toHaveLength(1);
    expect(res.datosFaltantes[0].campo).toBe('verificado');
  });

  it('mix verificado=true y verificado=false sin actividad → PARCIAL, 2 alertas', async () => {
    const cargoVerificado   = makeCargoVigente(CARGO_X, true, false);
    const cargoNoVerificado = makeCargoVigente(CARGO_Y, false, false);
    const doc = makeDocente(DOCENTE_A, 'Ana', 'García', [cargoVerificado, cargoNoVerificado]);
    const service = makeService(makeConsultas(makeCargosData([doc])));
    const res = await service.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
    expect(res.valor?.cargosEnAlerta).toHaveLength(2);
  });
});

// ── Múltiples cargos y docentes ───────────────────────────────────────────────

describe('R04EvaluadorService — múltiples cargos y docentes', () => {
  it('cargo con actividad + cargo sin actividad → solo el segundo genera alerta', async () => {
    const conActividad = makeCargoVigente(CARGO_X, true, true);
    const sinActividad = makeCargoVigente(CARGO_Y, true, false);
    const doc = makeDocente(DOCENTE_A, 'Ana', 'García', [conActividad, sinActividad]);
    const service = makeService(makeConsultas(makeCargosData([doc])));
    const res = await service.evaluar(makeContexto());
    expect(res.valor?.cargosEnAlerta).toHaveLength(1);
    expect(res.valor?.cargosEnAlerta[0].cargoDocenteId).toBe(CARGO_Y);
    expect(res.valor?.docentesExceptuadosPorC4).toEqual([]);
  });

  it('docentes mixtos → solo el docente con cargo sin actividad genera alerta', async () => {
    const cargoConActividad = makeCargoVigente(CARGO_X, true, true);
    const cargoSinActividad = makeCargoVigente(CARGO_Y, true, false);
    const docLimpio   = makeDocente(DOCENTE_A, 'Ana',  'García', [cargoConActividad]);
    const docEnAlerta = makeDocente(DOCENTE_B, 'Luis', 'Pérez',  [cargoSinActividad]);
    const service = makeService(makeConsultas(makeCargosData([docLimpio, docEnAlerta])));
    const res = await service.evaluar(makeContexto());
    expect(res.valor?.cargosEnAlerta).toHaveLength(1);
    expect(res.valor?.cargosEnAlerta[0].docenteId).toBe(DOCENTE_B);
    expect(res.valor?.totalDocentesPlantel).toBe(2);
    expect(res.valor?.docentesExceptuadosPorC4).toEqual([DOCENTE_B]);
  });
});

// ── Ordenamiento ──────────────────────────────────────────────────────────────

describe('R04EvaluadorService — ordenamiento de alertas', () => {
  it('alertas ordenadas alfabéticamente por nombre del docente', async () => {
    const cargoZ = makeCargoVigente(CARGO_X, true, false);
    const cargoA = makeCargoVigente(CARGO_Y, true, false);
    const docZ = makeDocente(DOCENTE_A, 'Zeta',  'Álvarez', [cargoZ]);
    const docA = makeDocente(DOCENTE_B, 'Alfa',  'Burgos',  [cargoA]);
    const service = makeService(makeConsultas(makeCargosData([docZ, docA])));
    const res = await service.evaluar(makeContexto());
    expect(res.valor?.cargosEnAlerta[0].nombre).toBe('Alfa Burgos');
    expect(res.valor?.cargosEnAlerta[1].nombre).toBe('Zeta Álvarez');
  });
});

// ── Metadatos del resultado ───────────────────────────────────────────────────

describe('R04EvaluadorService — metadatos del resultado', () => {
  it('valor incluye planEstudioId y carreraId correctos', async () => {
    const service = makeService(makeConsultas(makeCargosData([])));
    const res = await service.evaluar(makeContexto());
    expect(res.valor?.planEstudioId).toBe(PLAN_ID);
    expect(res.valor?.carreraId).toBe(CARRERA_ID);
  });

  it('codigo = R-04, tipoContexto = DOCENTE, estadoImplementacion = IMPLEMENTADO', async () => {
    const service = makeService(makeConsultas(makeCargosData([])));
    const res = await service.evaluar(makeContexto());
    expect(res.codigo).toBe('R-04');
    expect(res.tipoContexto).toBe('DOCENTE');
    expect(res.estadoImplementacion).toBe('IMPLEMENTADO');
  });

  it('contextoId = planEstudioId del contexto de evaluación', async () => {
    const service = makeService(makeConsultas(makeCargosData([])));
    const res = await service.evaluar(makeContexto());
    expect(res.contextoId).toBe(PLAN_ID);
  });

  it('datosFaltantes vacíos cuando no hay alertas', async () => {
    const cargo = makeCargoVigente(CARGO_X, true, true);
    const doc = makeDocente(DOCENTE_A, 'Ana', 'García', [cargo]);
    const service = makeService(makeConsultas(makeCargosData([doc])));
    const res = await service.evaluar(makeContexto());
    expect(res.datosFaltantes).toHaveLength(0);
  });

  it('consultas.obtenerCargosParaR04 recibe planEstudioId, fechaCalculo, usuarioId, rolNombre', async () => {
    const consultas = makeConsultas(makeCargosData([]));
    const service = makeService(consultas);
    await service.evaluar(makeContexto());
    expect(consultas.obtenerCargosParaR04).toHaveBeenCalledWith(
      PLAN_ID,
      FECHA_HOY,
      USER_ID,
      'SECRETARIA_ACADEMICA',
    );
  });
});
