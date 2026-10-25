import { EstadoCalculo } from '../types/estado-calculo.types';
import { IP10EvaluadorService } from './ip10.evaluador';

// ── UUIDs de prueba ───────────────────────────────────────────────────────────
const CARRERA_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PLAN_ID_1  = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PLAN_ID_2  = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const DOCENTE_A  = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const DOCENTE_B  = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const CARGO_X    = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const USER_ID    = '11111111-1111-4111-8111-111111111111';
const FECHA_HOY  = new Date('2026-10-01');

const DEFAULT_CONTEXTO = {
  carreraId: CARRERA_ID,
  usuarioId: USER_ID,
  rolNombre: 'SECRETARIA_ACADEMICA',
  fechaEvaluacion: FECHA_HOY,
};

// ── Fábricas de stubs ─────────────────────────────────────────────────────────

function makeR03Stub(totalEnAlerta = 0, estadoCalculo = EstadoCalculo.CALCULADO) {
  return {
    evaluar: jest.fn().mockResolvedValue({
      estadoCalculo,
      valor: { totalEnAlerta },
      datosFaltantes: [],
    }),
  };
}

function makeR07Stub(totalSobreasignados = 0, estadoCalculo = EstadoCalculo.CALCULADO) {
  return {
    evaluar: jest.fn().mockResolvedValue({
      estadoCalculo,
      valor: { totalSobreasignados },
      datosFaltantes: [],
    }),
  };
}

function makeR04Stub(
  cargosEnAlerta: { docenteId: string }[] = [],
  docentesExceptuadosPorC4: string[] = [],
  estadoCalculo = EstadoCalculo.CALCULADO,
) {
  return {
    evaluar: jest.fn().mockResolvedValue({
      estadoCalculo,
      valor: { cargosEnAlerta, docentesExceptuadosPorC4, totalCargosEnAlerta: cargosEnAlerta.length },
      datosFaltantes: [],
    }),
  };
}

function makePrismaStub(planIds: string[] = [PLAN_ID_1]) {
  return {
    planEstudio: {
      findMany: jest.fn().mockResolvedValue(planIds.map(id => ({ id }))),
    },
  };
}

function makeSvc(
  prisma: ReturnType<typeof makePrismaStub>,
  r03: ReturnType<typeof makeR03Stub>,
  r07: ReturnType<typeof makeR07Stub>,
  r04: ReturnType<typeof makeR04Stub>,
) {
  return new IP10EvaluadorService(prisma as any, r03 as any, r04 as any, r07 as any);
}

// ── 1. NO_APLICA global ───────────────────────────────────────────────────────

describe('IP10EvaluadorService — NO_APLICA', () => {
  it('R-03, R-07 y R-04 todos NO_APLICA → estadoCalculo=NO_APLICA, puntaje=100', async () => {
    const svc = makeSvc(
      makePrismaStub([PLAN_ID_1]),
      makeR03Stub(0, EstadoCalculo.NO_APLICA),
      makeR07Stub(0, EstadoCalculo.NO_APLICA),
      makeR04Stub([], [], EstadoCalculo.NO_APLICA),
    );
    const res = await svc.evaluarParaCarrera(CARRERA_ID, USER_ID, 'SECRETARIA_ACADEMICA', FECHA_HOY);
    expect(res.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    expect(res.puntaje).toBe(100);
    expect(res.componenteA).toBe(0);
    expect(res.componenteM).toBe(0);
  });

  it('sin planes y R-03/R-07 NO_APLICA → NO_APLICA', async () => {
    const svc = makeSvc(
      makePrismaStub([]),
      makeR03Stub(0, EstadoCalculo.NO_APLICA),
      makeR07Stub(0, EstadoCalculo.NO_APLICA),
      makeR04Stub(),
    );
    const res = await svc.evaluarParaCarrera(CARRERA_ID, USER_ID, 'SECRETARIA_ACADEMICA', FECHA_HOY);
    expect(res.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    expect(res.puntaje).toBe(100);
  });
});

// ── 2. CALCULADO sin alertas ─────────────────────────────────────────────────

describe('IP10EvaluadorService — CALCULADO sin alertas', () => {
  it('sin alertas de ningún evaluador → puntaje=100, estadoCalculo=CALCULADO', async () => {
    const svc = makeSvc(
      makePrismaStub([PLAN_ID_1]),
      makeR03Stub(0, EstadoCalculo.CALCULADO),
      makeR07Stub(0, EstadoCalculo.CALCULADO),
      makeR04Stub([], [], EstadoCalculo.CALCULADO),
    );
    const res = await svc.evaluarParaCarrera(CARRERA_ID, USER_ID, 'SECRETARIA_ACADEMICA', FECHA_HOY);
    expect(res.puntaje).toBe(100);
    expect(res.componenteA).toBe(0);
    expect(res.componenteM).toBe(0);
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
  });
});

// ── 3. R-03 penaliza (ALTA) ───────────────────────────────────────────────────

describe('IP10EvaluadorService — R-03 ALTA', () => {
  it('1 alerta ALTA de R-03 → puntaje = 75 (100 − 25×1)', async () => {
    const svc = makeSvc(
      makePrismaStub([PLAN_ID_1]),
      makeR03Stub(1),
      makeR07Stub(0),
      makeR04Stub([], []),
    );
    const res = await svc.evaluarParaCarrera(CARRERA_ID, USER_ID, 'SECRETARIA_ACADEMICA', FECHA_HOY);
    expect(res.puntaje).toBe(75);
    expect(res.alertasR03).toBe(1);
    expect(res.componenteA).toBe(1);
  });
});

// ── 4. R-07 penaliza (MEDIA) ─────────────────────────────────────────────────

describe('IP10EvaluadorService — R-07 MEDIA', () => {
  it('1 sobreasignado de R-07 → puntaje = 90 (100 − 10×1)', async () => {
    const svc = makeSvc(
      makePrismaStub([PLAN_ID_1]),
      makeR03Stub(0),
      makeR07Stub(1),
      makeR04Stub([], []),
    );
    const res = await svc.evaluarParaCarrera(CARRERA_ID, USER_ID, 'SECRETARIA_ACADEMICA', FECHA_HOY);
    expect(res.puntaje).toBe(90);
    expect(res.alertasR07).toBe(1);
    expect(res.componenteM).toBe(1);
  });
});

// ── 5. R-04 penaliza (ALTA, sin excepción C4) ─────────────────────────────────

describe('IP10EvaluadorService — R-04 ALTA penalizable', () => {
  it('1 cargo R-04 sin excepción C4 → puntaje = 75 (100 − 25×1)', async () => {
    const svc = makeSvc(
      makePrismaStub([PLAN_ID_1]),
      makeR03Stub(0),
      makeR07Stub(0),
      makeR04Stub([{ docenteId: DOCENTE_A }], []),
    );
    const res = await svc.evaluarParaCarrera(CARRERA_ID, USER_ID, 'SECRETARIA_ACADEMICA', FECHA_HOY);
    expect(res.puntaje).toBe(75);
    expect(res.alertasR04Penalizables).toBe(1);
    expect(res.componenteA).toBe(1);
  });
});

// ── 6. R-04 excepción C4 (visible pero no penaliza) ──────────────────────────

describe('IP10EvaluadorService — R-04 excepción C4', () => {
  it('cargo R-04 con docenteId en docentesExceptuadosPorC4 → no penaliza, puntaje = 100', async () => {
    const svc = makeSvc(
      makePrismaStub([PLAN_ID_1]),
      makeR03Stub(0),
      makeR07Stub(0),
      makeR04Stub([{ docenteId: DOCENTE_A }], [DOCENTE_A]),
    );
    const res = await svc.evaluarParaCarrera(CARRERA_ID, USER_ID, 'SECRETARIA_ACADEMICA', FECHA_HOY);
    expect(res.puntaje).toBe(100);
    expect(res.alertasR04Penalizables).toBe(0);
    expect(res.componenteA).toBe(0);
  });
});

// ── 7. R-03 + R-07 combinados ────────────────────────────────────────────────

describe('IP10EvaluadorService — R-03 + R-07 combinados', () => {
  it('1 ALTA R-03 + 1 MEDIA R-07 → puntaje = 65 (100 − 25 − 10)', async () => {
    const svc = makeSvc(
      makePrismaStub([PLAN_ID_1]),
      makeR03Stub(1),
      makeR07Stub(1),
      makeR04Stub([], []),
    );
    const res = await svc.evaluarParaCarrera(CARRERA_ID, USER_ID, 'SECRETARIA_ACADEMICA', FECHA_HOY);
    expect(res.puntaje).toBe(65);
    expect(res.componenteA).toBe(1);
    expect(res.componenteM).toBe(1);
  });
});

// ── 8. Puntaje mínimo es 0 ────────────────────────────────────────────────────

describe('IP10EvaluadorService — piso en 0', () => {
  it('muchas alertas → puntaje no cae por debajo de 0', async () => {
    const svc = makeSvc(
      makePrismaStub([PLAN_ID_1]),
      makeR03Stub(10),
      makeR07Stub(10),
      makeR04Stub([{ docenteId: DOCENTE_A }, { docenteId: DOCENTE_B }], []),
    );
    const res = await svc.evaluarParaCarrera(CARRERA_ID, USER_ID, 'SECRETARIA_ACADEMICA', FECHA_HOY);
    expect(res.puntaje).toBe(0);
    expect(res.puntaje).toBeGreaterThanOrEqual(0);
  });
});

// ── 9. NO_DETERMINABLE se propaga ─────────────────────────────────────────────

describe('IP10EvaluadorService — propagación de estado', () => {
  it('R-07 NO_DETERMINABLE → estadoCalculo = NO_DETERMINABLE', async () => {
    const svc = makeSvc(
      makePrismaStub([PLAN_ID_1]),
      makeR03Stub(0, EstadoCalculo.CALCULADO),
      makeR07Stub(0, EstadoCalculo.NO_DETERMINABLE),
      makeR04Stub([], [], EstadoCalculo.CALCULADO),
    );
    const res = await svc.evaluarParaCarrera(CARRERA_ID, USER_ID, 'SECRETARIA_ACADEMICA', FECHA_HOY);
    expect(res.estadoCalculo).toBe(EstadoCalculo.NO_DETERMINABLE);
  });

  it('R-03 PARCIAL → estadoCalculo = PARCIAL', async () => {
    const svc = makeSvc(
      makePrismaStub([PLAN_ID_1]),
      makeR03Stub(0, EstadoCalculo.PARCIAL),
      makeR07Stub(0, EstadoCalculo.CALCULADO),
      makeR04Stub([], [], EstadoCalculo.CALCULADO),
    );
    const res = await svc.evaluarParaCarrera(CARRERA_ID, USER_ID, 'SECRETARIA_ACADEMICA', FECHA_HOY);
    expect(res.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
  });
});

// ── 10. Múltiples planes ──────────────────────────────────────────────────────

describe('IP10EvaluadorService — múltiples planes', () => {
  it('dos planes con R-04 agrega alertas penalizables de ambos', async () => {
    const r04Mock = {
      evaluar: jest.fn()
        .mockResolvedValueOnce({
          estadoCalculo: EstadoCalculo.CALCULADO,
          valor: {
            cargosEnAlerta: [{ docenteId: DOCENTE_A }],
            docentesExceptuadosPorC4: [],
            totalCargosEnAlerta: 1,
          },
          datosFaltantes: [],
        })
        .mockResolvedValueOnce({
          estadoCalculo: EstadoCalculo.CALCULADO,
          valor: {
            cargosEnAlerta: [{ docenteId: DOCENTE_B }],
            docentesExceptuadosPorC4: [],
            totalCargosEnAlerta: 1,
          },
          datosFaltantes: [],
        }),
    };

    const svc = new IP10EvaluadorService(
      makePrismaStub([PLAN_ID_1, PLAN_ID_2]) as any,
      makeR03Stub(0) as any,
      r04Mock as any,
      makeR07Stub(0) as any,
    );
    const res = await svc.evaluarParaCarrera(CARRERA_ID, USER_ID, 'SECRETARIA_ACADEMICA', FECHA_HOY);
    expect(res.alertasR04Penalizables).toBe(2);
    expect(res.componenteA).toBe(2);
    expect(res.puntaje).toBe(50);
  });
});

// ── 11. Regresión tablero de carrera ─────────────────────────────────────────

describe('IP10EvaluadorService — regresión tablero de carrera', () => {
  it('evaluar con contexto de tablero no interfiere entre R-03, R-04 y R-07', async () => {
    const r03 = makeR03Stub(1, EstadoCalculo.CALCULADO);
    const r07 = makeR07Stub(2, EstadoCalculo.CALCULADO);
    const r04 = makeR04Stub(
      [{ docenteId: DOCENTE_A }, { docenteId: DOCENTE_B }],
      [DOCENTE_B],
    );

    const svc = makeSvc(makePrismaStub([PLAN_ID_1]), r03, r07, r04);
    const res = await svc.evaluarParaCarrera(CARRERA_ID, USER_ID, 'SECRETARIA_ACADEMICA', FECHA_HOY);

    // R-03: 1 ALTA, R-04: 1 penalizable (DOCENTE_A), R-07: 2 MEDIA
    // A = 1 + 1 = 2, M = 2
    // puntaje = max(0, 100 - 25*2 - 10*2) = max(0, 100 - 50 - 20) = 30
    expect(res.alertasR03).toBe(1);
    expect(res.alertasR04Penalizables).toBe(1);
    expect(res.alertasR07).toBe(2);
    expect(res.componenteA).toBe(2);
    expect(res.componenteM).toBe(2);
    expect(res.puntaje).toBe(30);
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);

    // Verificar que cada evaluador fue llamado con los parámetros correctos
    expect(r03.evaluar).toHaveBeenCalledWith(
      expect.objectContaining({ carreraId: CARRERA_ID, usuarioId: USER_ID }),
    );
    expect(r07.evaluar).toHaveBeenCalledWith(
      expect.objectContaining({ carreraId: CARRERA_ID, usuarioId: USER_ID }),
    );
    expect(r04.evaluar).toHaveBeenCalledWith(
      expect.objectContaining({ planEstudioId: PLAN_ID_1, usuarioId: USER_ID }),
    );
  });
});

// ── 12. carreraId en el resultado ────────────────────────────────────────────

describe('IP10EvaluadorService — metadatos del resultado', () => {
  it('resultado incluye el carreraId correcto', async () => {
    const svc = makeSvc(
      makePrismaStub([]),
      makeR03Stub(0, EstadoCalculo.NO_APLICA),
      makeR07Stub(0, EstadoCalculo.NO_APLICA),
      makeR04Stub(),
    );
    const res = await svc.evaluarParaCarrera(CARRERA_ID, USER_ID, 'SECRETARIA_ACADEMICA', FECHA_HOY);
    expect(res.carreraId).toBe(CARRERA_ID);
  });
});
