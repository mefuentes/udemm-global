import { EstadoCalculo } from '../types/estado-calculo.types';
import { IP10EvaluadorService } from './ip10.evaluador';

// ── UUIDs de prueba ───────────────────────────────────────────────────────────
const CARRERA_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PLAN_1     = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PLAN_2     = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const D1         = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const D2         = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const D3         = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const D4         = '11111111-1111-4111-8111-111111111111';
const D5         = '22222222-2222-4222-8222-222222222222';
const D_EXT      = '99999999-9999-4999-8999-999999999999'; // NO pertenece a la carrera

const CTX = {
  carreraId: CARRERA_ID,
  usuarioId: D4,
  rolNombre: 'SECRETARIA_ACADEMICA',
  fechaEvaluacion: new Date('2026-10-01'),
};

// ── Fábricas de stubs ─────────────────────────────────────────────────────────

function r03(docenteIds: string[], estado = EstadoCalculo.CALCULADO) {
  return {
    evaluar: jest.fn().mockResolvedValue({
      estadoCalculo: estado,
      valor: {
        totalEnAlerta: docenteIds.length,
        enAlerta: docenteIds.map(id => ({
          docenteId: id,
          nombre: `Docente ${id.slice(0, 4)}`,
          componentes: { horasDocencia: 30, horasGestion: 0, horasNoAcademico: 0, usoTope: 30 },
          exceso: 2,
        })),
      },
      datosFaltantes: [],
    }),
  };
}

function r07(docenteIds: string[], estado = EstadoCalculo.CALCULADO) {
  return {
    evaluar: jest.fn().mockResolvedValue({
      estadoCalculo: estado,
      valor: {
        totalSobreasignados: docenteIds.length,
        sobreasignados: docenteIds.map(id => ({
          docenteId: id,
          nombre: `Docente ${id.slice(0, 4)}`,
          nMaterias: 5,
          exceso: 2,
          asignaciones: [],
        })),
      },
      datosFaltantes: [],
    }),
  };
}

function r04(
  cargosEnAlerta: { docenteId: string }[],
  docentesExceptuadosPorC4: string[] = [],
  estado = EstadoCalculo.CALCULADO,
) {
  return {
    evaluar: jest.fn().mockResolvedValue({
      estadoCalculo: estado,
      valor: { cargosEnAlerta, docentesExceptuadosPorC4, totalCargosEnAlerta: cargosEnAlerta.length },
      datosFaltantes: [],
    }),
  };
}

function db(planIds: string[], docenteIds: string[]) {
  return {
    planEstudio: {
      findMany: jest.fn().mockResolvedValue(planIds.map(id => ({ id }))),
    },
    vinculacionCatedra: {
      findMany: jest.fn().mockResolvedValue(docenteIds.map(id => ({ docenteId: id }))),
    },
  };
}

function svc(
  prisma: ReturnType<typeof db>,
  stub03: ReturnType<typeof r03>,
  stub07: ReturnType<typeof r07>,
  stub04: ReturnType<typeof r04>,
) {
  return new IP10EvaluadorService(prisma as any, stub03 as any, stub04 as any, stub07 as any);
}

// ── T1: sin alertas → puntaje = 100 ──────────────────────────────────────────

describe('T1: sin alertas → puntaje = 100 (CALCULADO)', () => {
  it('N=2, ningún evaluador genera alertas → puntaje=100', async () => {
    const service = svc(db([PLAN_1], [D1, D2]), r03([]), r07([]), r04([]));
    const res = await service.evaluarParaCarrera(CARRERA_ID, CTX.usuarioId, CTX.rolNombre, CTX.fechaEvaluacion);
    expect(res.puntaje).toBe(100);
    expect(res.componenteA).toBe(0);
    expect(res.componenteM).toBe(0);
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
  });
});

// ── T2: N=1, 1 alerta alta R-03 → puntaje = 75 ───────────────────────────────

describe('T2: 1 docente con R-03 → puntaje = 75', () => {
  it('N=1, D1 en alerta R-03 → C_d=max(0,100−25)=75, puntaje=75', async () => {
    const service = svc(db([PLAN_1], [D1]), r03([D1]), r07([]), r04([]));
    const res = await service.evaluarParaCarrera(CARRERA_ID, CTX.usuarioId, CTX.rolNombre, CTX.fechaEvaluacion);
    expect(res.puntaje).toBe(75);
    expect(res.alertasR03).toBe(1);
    expect(res.componenteA).toBe(1);
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
  });
});

// ── T3: N=5, 1 con alerta alta → puntaje = 95 ────────────────────────────────

describe('T3: 5 docentes, 1 con R-03 → puntaje = 95', () => {
  it('N=5, D1 con R-03 → (75+100×4)/5 = 95', async () => {
    const service = svc(db([PLAN_1], [D1, D2, D3, D4, D5]), r03([D1]), r07([]), r04([]));
    const res = await service.evaluarParaCarrera(CARRERA_ID, CTX.usuarioId, CTX.rolNombre, CTX.fechaEvaluacion);
    expect(res.puntaje).toBe(95);
  });
});

// ── T4: N=1, 1 alerta media R-07 → puntaje = 90 ──────────────────────────────

describe('T4: 1 docente con R-07 → puntaje = 90', () => {
  it('N=1, D1 sobreasignado (R-07) → C_d=max(0,100−10)=90, puntaje=90', async () => {
    const service = svc(db([PLAN_1], [D1]), r03([]), r07([D1]), r04([]));
    const res = await service.evaluarParaCarrera(CARRERA_ID, CTX.usuarioId, CTX.rolNombre, CTX.fechaEvaluacion);
    expect(res.puntaje).toBe(90);
    expect(res.alertasR07).toBe(1);
    expect(res.componenteM).toBe(1);
  });
});

// ── T5: 2 docentes con alertas distintas → promedio con redondeo ──────────────

describe('T5: 2 docentes con alertas distintas → promedio correcto', () => {
  it('D1 con R-03 (C=75), D2 con R-07 (C=90) → round((75+90)/2)=83', async () => {
    // D1: A_d=1 (R-03), M_d=0 → C_1=75
    // D2: A_d=0, M_d=1 (R-07) → C_2=90
    // puntaje = Math.round(165/2) = Math.round(82.5) = 83
    const service = svc(db([PLAN_1], [D1, D2]), r03([D1]), r07([D2]), r04([]));
    const res = await service.evaluarParaCarrera(CARRERA_ID, CTX.usuarioId, CTX.rolNombre, CTX.fechaEvaluacion);
    expect(res.puntaje).toBe(83);
  });
});

// ── T6: excepción C4 → docente exceptuado no resta en IP-10 ──────────────────

describe('T6: excepción C4 → R-04 no resta', () => {
  it('D1 con cargo R-04 pero en docentesExceptuadosPorC4 → puntaje=100', async () => {
    const service = svc(
      db([PLAN_1], [D1]),
      r03([]),
      r07([]),
      r04([{ docenteId: D1 }], [D1]),  // D1 en alerta pero exceptuado por C4
    );
    const res = await service.evaluarParaCarrera(CARRERA_ID, CTX.usuarioId, CTX.rolNombre, CTX.fechaEvaluacion);
    expect(res.puntaje).toBe(100);
    expect(res.alertasR04Penalizables).toBe(0);
    expect(res.componenteA).toBe(0);
  });
});

// ── T7: todas las alertas en un docente → puntaje mínimo posible (40) ─────────

describe('T7: todas las alertas en 1 docente → puntaje = 40', () => {
  it('N=1, D1 con R-03 + R-04 + R-07 → A_d=2, M_d=1 → C_d=max(0,100−50−10)=40', async () => {
    const service = svc(
      db([PLAN_1], [D1]),
      r03([D1]),
      r07([D1]),
      r04([{ docenteId: D1 }]),
    );
    const res = await service.evaluarParaCarrera(CARRERA_ID, CTX.usuarioId, CTX.rolNombre, CTX.fechaEvaluacion);
    expect(res.puntaje).toBe(40);
    expect(res.puntaje).toBeGreaterThanOrEqual(0);
  });
});

// ── T8: docente en múltiples vinculaciones → contado una sola vez ─────────────

describe('T8: docente con vinculaciones duplicadas → N=1 (dedup)', () => {
  it('prisma devuelve D1 dos veces → Set dedup → N=1, puntaje=75', async () => {
    // La DB real retorna distinct; aquí verificamos que el código tolera duplicados.
    const prismaDoble = {
      planEstudio: { findMany: jest.fn().mockResolvedValue([{ id: PLAN_1 }]) },
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([{ docenteId: D1 }, { docenteId: D1 }]),
      },
    };
    const service = new IP10EvaluadorService(
      prismaDoble as any, r03([D1]) as any, r04([]) as any, r07([]) as any,
    );
    const res = await service.evaluarParaCarrera(CARRERA_ID, CTX.usuarioId, CTX.rolNombre, CTX.fechaEvaluacion);
    // N=1 (Set dedup), D1 con R-03 → C_d=75
    expect(res.puntaje).toBe(75);
  });
});

// ── T9: alertas de docentes externos no penalizan ─────────────────────────────

describe('T9: alertas de docentes externos → no penalizan la carrera', () => {
  it('R-03 devuelve D_EXT (no en carrera) y D1 (en carrera) → solo D1 resta', async () => {
    // Universo: solo D1
    const stub03 = {
      evaluar: jest.fn().mockResolvedValue({
        estadoCalculo: EstadoCalculo.CALCULADO,
        valor: {
          totalEnAlerta: 2,
          enAlerta: [
            { docenteId: D1,    nombre: 'D1',    componentes: {}, exceso: 2 },
            { docenteId: D_EXT, nombre: 'D_EXT', componentes: {}, exceso: 2 },
          ],
        },
        datosFaltantes: [],
      }),
    };
    const service = svc(db([PLAN_1], [D1]), stub03 as any, r07([]) as any, r04([]) as any);
    const res = await service.evaluarParaCarrera(CARRERA_ID, CTX.usuarioId, CTX.rolNombre, CTX.fechaEvaluacion);
    expect(res.alertasR03).toBe(1);    // solo D1 (D_EXT filtrado)
    expect(res.puntaje).toBe(75);      // N=1, C_1=75
  });

  it('R-07 devuelve D_EXT (no en carrera) → no penaliza', async () => {
    const stub07 = {
      evaluar: jest.fn().mockResolvedValue({
        estadoCalculo: EstadoCalculo.CALCULADO,
        valor: {
          totalSobreasignados: 1,
          sobreasignados: [{ docenteId: D_EXT, nombre: 'D_EXT', nMaterias: 5, exceso: 2, asignaciones: [] }],
        },
        datosFaltantes: [],
      }),
    };
    // Universo: D1 (sin alertas propias)
    const service = svc(db([PLAN_1], [D1]), r03([]) as any, stub07 as any, r04([]) as any);
    const res = await service.evaluarParaCarrera(CARRERA_ID, CTX.usuarioId, CTX.rolNombre, CTX.fechaEvaluacion);
    expect(res.alertasR07).toBe(0);
    expect(res.puntaje).toBe(100);     // D1 sin alertas → C_1=100
  });
});

// ── T10: NO_APLICA global ─────────────────────────────────────────────────────

describe('T10: universo vacío / NO_APLICA global', () => {
  it('R-03, R-07 y R-04 todos NO_APLICA → estadoCalculo=NO_APLICA, puntaje=100', async () => {
    const service = svc(
      db([PLAN_1], []),
      r03([], EstadoCalculo.NO_APLICA),
      r07([], EstadoCalculo.NO_APLICA),
      r04([], [], EstadoCalculo.NO_APLICA),
    );
    const res = await service.evaluarParaCarrera(CARRERA_ID, CTX.usuarioId, CTX.rolNombre, CTX.fechaEvaluacion);
    expect(res.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    expect(res.puntaje).toBe(100);
    expect(res.componenteA).toBe(0);
    expect(res.componenteM).toBe(0);
  });

  it('sin planes y R-03/R-07 NO_APLICA → NO_APLICA', async () => {
    const service = svc(
      db([], []),
      r03([], EstadoCalculo.NO_APLICA),
      r07([], EstadoCalculo.NO_APLICA),
      r04([]),
    );
    const res = await service.evaluarParaCarrera(CARRERA_ID, CTX.usuarioId, CTX.rolNombre, CTX.fechaEvaluacion);
    expect(res.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    expect(res.puntaje).toBe(100);
  });
});

// ── T11: R-04 cargo de docente externo → no afecta puntaje ───────────────────

describe('T11: R-04 con docenteId fuera del universo → no afecta puntaje', () => {
  it('D_EXT tiene cargo en alerta pero no está en docenteIdsCarrera → D1 sin penalización', async () => {
    // R-04 devuelve cargo de D_EXT; D1 está en la carrera sin alertas
    const service = svc(
      db([PLAN_1], [D1]),
      r03([]),
      r07([]),
      r04([{ docenteId: D_EXT }]),  // cargo de docente externo
    );
    const res = await service.evaluarParaCarrera(CARRERA_ID, CTX.usuarioId, CTX.rolNombre, CTX.fechaEvaluacion);
    // El cargo de D_EXT suma a alertasR04Penalizables (pre-existing: R-04 no filtra por carrera)
    // pero NO afecta C_d de D1 en el promedio
    expect(res.puntaje).toBe(100);  // D1 no tiene alertas → C_1=100
  });
});

// ── T12: mismo docente en múltiples planes → fórmula binaria, puntaje = 75 ───

describe('T12: mismo docente en 2 planes con R-04 → A_d binario = 1, puntaje = 75', () => {
  it('D1 con cargo R-04 en plan 1 y plan 2 → r04AlertSet tiene D1 una sola vez', async () => {
    // Sin deduplicación por cargoId, alertasR04Penalizables sería 2.
    // Con la fórmula binaria, r04AlertSet.has(D1) = true → A_d=1 → C_d=75.
    const r04DosPlanesD1 = {
      evaluar: jest.fn()
        .mockResolvedValueOnce({
          estadoCalculo: EstadoCalculo.CALCULADO,
          valor: { cargosEnAlerta: [{ docenteId: D1 }], docentesExceptuadosPorC4: [], totalCargosEnAlerta: 1 },
          datosFaltantes: [],
        })
        .mockResolvedValueOnce({
          estadoCalculo: EstadoCalculo.CALCULADO,
          valor: { cargosEnAlerta: [{ docenteId: D1 }], docentesExceptuadosPorC4: [], totalCargosEnAlerta: 1 },
          datosFaltantes: [],
        }),
    };
    const service = new IP10EvaluadorService(
      db([PLAN_1, PLAN_2], [D1]) as any,
      r03([]) as any,
      r04DosPlanesD1 as any,
      r07([]) as any,
    );
    const res = await service.evaluarParaCarrera(CARRERA_ID, CTX.usuarioId, CTX.rolNombre, CTX.fechaEvaluacion);
    expect(res.puntaje).toBe(75);  // A_d=1 (binario), C_d=75, N=1
  });
});

// ── Estado: propagación de NO_DETERMINABLE y PARCIAL ─────────────────────────

describe('Propagación de estado', () => {
  it('R-07 NO_DETERMINABLE → estadoCalculo = NO_DETERMINABLE', async () => {
    const service = svc(
      db([PLAN_1], [D1]),
      r03([], EstadoCalculo.CALCULADO),
      r07([], EstadoCalculo.NO_DETERMINABLE),
      r04([], [], EstadoCalculo.CALCULADO),
    );
    const res = await service.evaluarParaCarrera(CARRERA_ID, CTX.usuarioId, CTX.rolNombre, CTX.fechaEvaluacion);
    expect(res.estadoCalculo).toBe(EstadoCalculo.NO_DETERMINABLE);
  });

  it('R-03 PARCIAL → estadoCalculo = PARCIAL', async () => {
    const service = svc(
      db([PLAN_1], [D1]),
      r03([], EstadoCalculo.PARCIAL),
      r07([], EstadoCalculo.CALCULADO),
      r04([], [], EstadoCalculo.CALCULADO),
    );
    const res = await service.evaluarParaCarrera(CARRERA_ID, CTX.usuarioId, CTX.rolNombre, CTX.fechaEvaluacion);
    expect(res.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
  });
});

// ── Metadatos del resultado ───────────────────────────────────────────────────

describe('Metadatos', () => {
  it('resultado incluye el carreraId correcto', async () => {
    const service = svc(
      db([], []),
      r03([], EstadoCalculo.NO_APLICA),
      r07([], EstadoCalculo.NO_APLICA),
      r04([]),
    );
    const res = await service.evaluarParaCarrera(CARRERA_ID, CTX.usuarioId, CTX.rolNombre, CTX.fechaEvaluacion);
    expect(res.carreraId).toBe(CARRERA_ID);
  });
});
