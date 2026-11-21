/**
 * MOD-PDE-IND-01 — T1–T17: Indicadores Completitud y Consistencia del Plan de Estudios
 */

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { IndicesPlanService } from './indices-plan.service';
import { EstadoCalculo } from '../autoevaluacion/types/estado-calculo.types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PLAN_ID = 'plan-0000-0000-0000-0000-000000000001';
const USR_ID  = 'usr-0000-0000-0000-0000-000000000001';
const ROL     = 'DIRECTOR_CARRERA';

function materia(id: string) { return { id }; }

/** ProgramaAsignatura con todas las secciones completas */
function progCompleto(materiaId: string) {
  return {
    materiaId,
    estadoS1: 'COMPLETO', estadoS2: 'COMPLETO', estadoS3: 'COMPLETO',
    estadoS4: 'COMPLETO', estadoS5: 'COMPLETO', estadoS6: 'COMPLETO',
  };
}

/** ProgramaAsignatura con 4/6 secciones completas (≈ 67%) → round → 67 */
function progParcial(materiaId: string) {
  return {
    materiaId,
    estadoS1: 'COMPLETO', estadoS2: 'COMPLETO', estadoS3: 'COMPLETO',
    estadoS4: 'COMPLETO', estadoS5: 'PENDIENTE', estadoS6: 'PENDIENTE',
  };
}

/** Programa con 80% (≈ round(4.8/6*100) = round(80) = 80) → usa 5/6 completas → 83 */
function prog5de6(materiaId: string) {
  return {
    materiaId,
    estadoS1: 'COMPLETO', estadoS2: 'COMPLETO', estadoS3: 'COMPLETO',
    estadoS4: 'COMPLETO', estadoS5: 'COMPLETO', estadoS6: 'PENDIENTE',
  };
}

function vinculacionResponsable(materiaId: string) {
  return { materiaId };
}

function makeR09(fallaTotal: boolean, falaBloque = false) {
  const dim = (cumple: boolean | null) => ({ horasReales: 100, horasMinimas: 50, diferencia: 50, cumple });
  return {
    estadoCalculo: EstadoCalculo.CALCULADO,
    valor: {
      planEstudioId: PLAN_ID,
      totalMaterias: 10,
      materiasSinHoras: [],
      materiasConBloqueIndeterminado: [],
      horasTotal: 1000,
      horasPorBloque: { CB: 200, TB: 200, TA: 200, CTC: 200 },
      evaluaciones: {
        total: dim(fallaTotal ? false : true),
        CB:  dim(falaBloque ? false : true),
        TB:  dim(true),
        TA:  dim(true),
        CTC: dim(true),
      },
    },
    datosFaltantes: [],
  };
}

function makeR13(violaciones: string[] = []) {
  return {
    estadoCalculo: EstadoCalculo.CALCULADO,
    valor: {
      planEstudioId: PLAN_ID,
      totalMaterias: 10,
      porTipo: { OBLIGATORIA: 8, ELECTIVA: 1, PPS: 1, PI: 0, OTRO: 0 },
      tienePPS: true, tienePI: false,
      totalHorasFormacionPractica: 100,
      conDatosFP: 10, sinDatosFP: 0,
      configuracionPlan: { requierePPS: true, requierePI: null, horasMinFormacionPractica: null },
      violacionesFormacion: violaciones,
      estadoCalculo: EstadoCalculo.CALCULADO,
    },
    datosFaltantes: [],
  };
}

function makeR14(totalConAlerta: number) {
  return {
    estadoCalculo: EstadoCalculo.CALCULADO,
    valor: {
      planEstudioId: PLAN_ID,
      totalMaterias: 10,
      totalEvaluadas: 10,
      totalSinDatos: 0,
      totalConAlerta,
      enAlerta: Array.from({ length: totalConAlerta }, (_, i) => ({
        materiaId: `m-${i}`, nombre: `M${i}`, codigo: `C${i}`,
        horasFormacionPractica: 60, horasTotal: 50, exceso: 10,
      })),
      estadoCalculo: EstadoCalculo.CALCULADO,
    },
    datosFaltantes: [],
  };
}

function makePrisma(overrides: Record<string, any> = {}) {
  return {
    planEstudio: {
      findUnique: jest.fn().mockResolvedValue({ id: PLAN_ID }),
    },
    materia: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    programaAsignatura: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    vinculacionCatedra: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    ...overrides,
  };
}

function makeIndicadores(r09: any = makeR09(false), r13: any = makeR13(), r14: any = makeR14(0)) {
  return {
    evaluar: jest.fn()
      .mockResolvedValueOnce(r09)
      .mockResolvedValueOnce(r13)
      .mockResolvedValueOnce(r14),
  };
}

function makeSvc(prisma: any, indicadores: any = makeIndicadores()) {
  return new IndicesPlanService(prisma as any, indicadores as any);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('IndicesPlanService — MOD-PDE-IND-01 (T1–T17)', () => {

  // T1: Plan con todas las asignaturas sin programa → AP = 0%
  it('T1: plan con 5 asignaturas sin programa → AP = 0, Completitud depende de RC', async () => {
    const ms = [materia('m1'), materia('m2'), materia('m3'), materia('m4'), materia('m5')];
    const prisma = makePrisma({
      materia:            { findMany: jest.fn().mockResolvedValue(ms) },
      programaAsignatura: { findMany: jest.fn().mockResolvedValue([]) },
      vinculacionCatedra: { findMany: jest.fn().mockResolvedValue([]) },
    });
    const svc = makeSvc(prisma);
    const r = await svc.calcular(PLAN_ID, USR_ID, ROL);
    expect(r.completitud.ap).toBe(0);
    expect(r.completitud.materiasSinPrograma).toBe(5);
  });

  // T2: 20 asignaturas, 10 al 80% (5/6=83%), 10 sin programa → AP = 42 (round(416/20))
  it('T2: 20 asignaturas, 10 programas con 5/6 y 10 sin programa → AP ≈ 42', async () => {
    const ms = Array.from({ length: 20 }, (_, i) => materia(`m${i}`));
    const progs = ms.slice(0, 10).map(m => prog5de6(m.id));
    const prisma = makePrisma({
      materia:            { findMany: jest.fn().mockResolvedValue(ms) },
      programaAsignatura: { findMany: jest.fn().mockResolvedValue(progs) },
      vinculacionCatedra: { findMany: jest.fn().mockResolvedValue([]) },
    });
    const svc = makeSvc(prisma);
    const r = await svc.calcular(PLAN_ID, USR_ID, ROL);
    // 10 programas con round(5/6*100)=83 → suma=830, 10 sin programa=0 → AP=round(830/20)=42
    expect(r.completitud.ap).toBe(42);
    expect(r.completitud.materiasSinPrograma).toBe(10);
  });

  // T3: Plan con todos los programas completos → AP = 100%
  it('T3: todos los programas completos → AP = 100', async () => {
    const ms = [materia('m1'), materia('m2')];
    const prisma = makePrisma({
      materia:            { findMany: jest.fn().mockResolvedValue(ms) },
      programaAsignatura: { findMany: jest.fn().mockResolvedValue(ms.map(m => progCompleto(m.id))) },
      vinculacionCatedra: { findMany: jest.fn().mockResolvedValue([]) },
    });
    const svc = makeSvc(prisma);
    const r = await svc.calcular(PLAN_ID, USR_ID, ROL);
    expect(r.completitud.ap).toBe(100);
  });

  // T4: 10 asignaturas, 8 con responsable vigente → RC = 80%
  it('T4: 10 asignaturas, 8 responsables vigentes → RC = 80', async () => {
    const ms = Array.from({ length: 10 }, (_, i) => materia(`m${i}`));
    const prisma = makePrisma({
      materia:            { findMany: jest.fn().mockResolvedValue(ms) },
      programaAsignatura: { findMany: jest.fn().mockResolvedValue([]) },
      vinculacionCatedra: { findMany: jest.fn().mockResolvedValue(ms.slice(0, 8).map(m => vinculacionResponsable(m.id))) },
    });
    const svc = makeSvc(prisma);
    const r = await svc.calcular(PLAN_ID, USR_ID, ROL);
    expect(r.completitud.rc).toBe(80);
    expect(r.completitud.materiasConResponsable).toBe(8);
  });

  // T5: Responsable no vigente (estado !== APROBADA) → no suma a RC
  it('T5: responsable no vigente → no suma a RC (la query ya filtra por estado=APROBADA)', async () => {
    // La query Prisma filtra esResponsableCatedra:true Y estado:'APROBADA'
    // Este test verifica que el servicio usa el resultado de Prisma directamente
    const ms = [materia('m1')];
    const prisma = makePrisma({
      materia:            { findMany: jest.fn().mockResolvedValue(ms) },
      programaAsignatura: { findMany: jest.fn().mockResolvedValue([]) },
      vinculacionCatedra: { findMany: jest.fn().mockResolvedValue([]) }, // Prisma no devuelve nada
    });
    const svc = makeSvc(prisma);
    const r = await svc.calcular(PLAN_ID, USR_ID, ROL);
    expect(r.completitud.rc).toBe(0);
    expect(r.completitud.materiasConResponsable).toBe(0);
  });

  // T6: Múltiples vinculaciones de una asignatura → no duplican RC
  it('T6: múltiples vinculaciones para la misma asignatura → cuenta una sola vez en RC', async () => {
    const ms = [materia('m1')];
    // Dos filas con el mismo materiaId
    const vincDuplicadas = [{ materiaId: 'm1' }, { materiaId: 'm1' }, { materiaId: 'm1' }];
    const prisma = makePrisma({
      materia:            { findMany: jest.fn().mockResolvedValue(ms) },
      programaAsignatura: { findMany: jest.fn().mockResolvedValue([]) },
      vinculacionCatedra: { findMany: jest.fn().mockResolvedValue(vincDuplicadas) },
    });
    const svc = makeSvc(prisma);
    const r = await svc.calcular(PLAN_ID, USR_ID, ROL);
    expect(r.completitud.materiasConResponsable).toBe(1);
    expect(r.completitud.rc).toBe(100);
  });

  // T7: AP = 40, RC = 80 → Completitud = 60%
  it('T7: AP = 40, RC = 80 → Completitud = 60', async () => {
    // AP: 5 materias, 1 con 2/6 completas (round(33)), 4 sin programa → AP = round(33/5) = 7
    // Necesitamos exactamente AP=40, RC=80 → 2 materias, prog con 2/6+6/6 → AP=round((33+100)/2)=67 no
    // Usar 10 materias: 8 programas con round(3/6*100)=50, 2 sin prog → AP=round(400/10)=40
    const ms = Array.from({ length: 10 }, (_, i) => materia(`m${i}`));
    const progsMitad = ms.slice(0, 8).map(m => ({
      materiaId: m.id,
      estadoS1: 'COMPLETO', estadoS2: 'COMPLETO', estadoS3: 'COMPLETO',
      estadoS4: 'PENDIENTE', estadoS5: 'PENDIENTE', estadoS6: 'PENDIENTE',
    }));
    const prisma = makePrisma({
      materia:            { findMany: jest.fn().mockResolvedValue(ms) },
      programaAsignatura: { findMany: jest.fn().mockResolvedValue(progsMitad) },
      vinculacionCatedra: { findMany: jest.fn().mockResolvedValue(ms.slice(0, 8).map(m => ({ materiaId: m.id }))) },
    });
    const svc = makeSvc(prisma);
    const r = await svc.calcular(PLAN_ID, USR_ID, ROL);
    // AP = round(8*50/10)=40, RC = round(8/10*100)=80 → Completitud = round((40+80)/2)=60
    expect(r.completitud.ap).toBe(40);
    expect(r.completitud.rc).toBe(80);
    expect(r.completitud.valor).toBe(60);
  });

  // T8: AA = 0, AM = 0 → Consistencia = 100%
  it('T8: AA = 0, AM = 0 → Consistencia = 100', async () => {
    const prisma = makePrisma({
      materia: { findMany: jest.fn().mockResolvedValue([materia('m1')]) },
      programaAsignatura: { findMany: jest.fn().mockResolvedValue([]) },
      vinculacionCatedra: { findMany: jest.fn().mockResolvedValue([]) },
    });
    const svc = makeSvc(prisma, makeIndicadores(makeR09(false), makeR13([]), makeR14(0)));
    const r = await svc.calcular(PLAN_ID, USR_ID, ROL);
    expect(r.consistencia.aa).toBe(0);
    expect(r.consistencia.am).toBe(0);
    expect(r.consistencia.valor).toBe(100);
  });

  // T9: AA = 1 (1 falla en R-09), AM = 0 → Consistencia = 100 - 25*1 - 0 = 75
  it('T9: AA = 1, AM = 0 → Consistencia = 75', async () => {
    const prisma = makePrisma({
      materia: { findMany: jest.fn().mockResolvedValue([materia('m1')]) },
      programaAsignatura: { findMany: jest.fn().mockResolvedValue([]) },
      vinculacionCatedra: { findMany: jest.fn().mockResolvedValue([]) },
    });
    // R09: total.cumple=false → 1 alerta ALTA
    const svc = makeSvc(prisma, makeIndicadores(makeR09(true), makeR13([]), makeR14(0)));
    const r = await svc.calcular(PLAN_ID, USR_ID, ROL);
    expect(r.consistencia.aa).toBe(1);
    expect(r.consistencia.am).toBe(0);
    expect(r.consistencia.valor).toBe(75);
  });

  // T10: AA = 0, AM = 2 → Consistencia = 100 - 0 - 20 = 80
  it('T10: AA = 0, AM = 2 → Consistencia = 80', async () => {
    const prisma = makePrisma({
      materia: { findMany: jest.fn().mockResolvedValue([materia('m1')]) },
      programaAsignatura: { findMany: jest.fn().mockResolvedValue([]) },
      vinculacionCatedra: { findMany: jest.fn().mockResolvedValue([]) },
    });
    const svc = makeSvc(prisma, makeIndicadores(makeR09(false), makeR13([]), makeR14(2)));
    const r = await svc.calcular(PLAN_ID, USR_ID, ROL);
    expect(r.consistencia.aa).toBe(0);
    expect(r.consistencia.am).toBe(2);
    expect(r.consistencia.valor).toBe(80);
  });

  // T11: AA = 2 (1 R-09 + 1 R-13), AM = 1 → Consistencia = 100 - 50 - 10 = 40
  it('T11: AA = 2 (1 R09 + 1 R13), AM = 1 → Consistencia = 40', async () => {
    const prisma = makePrisma({
      materia: { findMany: jest.fn().mockResolvedValue([materia('m1')]) },
      programaAsignatura: { findMany: jest.fn().mockResolvedValue([]) },
      vinculacionCatedra: { findMany: jest.fn().mockResolvedValue([]) },
    });
    const svc = makeSvc(prisma, makeIndicadores(makeR09(true), makeR13(['violacion-pps']), makeR14(1)));
    const r = await svc.calcular(PLAN_ID, USR_ID, ROL);
    expect(r.consistencia.aa).toBe(2);
    expect(r.consistencia.am).toBe(1);
    expect(r.consistencia.valor).toBe(40);
  });

  // T12: Penalización superior a 100 → Consistencia mínima 0%
  it('T12: AA = 5, AM = 5 → Consistencia = max(0, 100-125-50) = 0', async () => {
    // AA=5 (4 bloque R09 + 1 R13-violacion + 1 total R09... need to simulate)
    // Simplify: use makeR09 with fallaTotal=true + falaBloque=true gives 2 from R09,
    // plus makeR13 with 3 violations = 5 total AA; makeR14(5) = 5 AM
    const indic = {
      evaluar: jest.fn()
        .mockResolvedValueOnce({
          estadoCalculo: EstadoCalculo.CALCULADO,
          valor: {
            planEstudioId: PLAN_ID, totalMaterias: 5, materiasSinHoras: [],
            materiasConBloqueIndeterminado: [], horasTotal: 100,
            horasPorBloque: { CB: 25, TB: 25, TA: 25, CTC: 25 },
            evaluaciones: {
              total: { horasReales: 10, horasMinimas: 50, diferencia: -40, cumple: false },
              CB:    { horasReales: 10, horasMinimas: 50, diferencia: -40, cumple: false },
              TB:    { horasReales: 10, horasMinimas: 50, diferencia: -40, cumple: false },
              TA:    { horasReales: 10, horasMinimas: 50, diferencia: -40, cumple: false },
              CTC:   { horasReales: 10, horasMinimas: 50, diferencia: -40, cumple: false },
            },
          },
          datosFaltantes: [],
        })
        .mockResolvedValueOnce(makeR13([]))
        .mockResolvedValueOnce(makeR14(5)),
    };
    const prisma = makePrisma({
      materia: { findMany: jest.fn().mockResolvedValue([materia('m1')]) },
      programaAsignatura: { findMany: jest.fn().mockResolvedValue([]) },
      vinculacionCatedra: { findMany: jest.fn().mockResolvedValue([]) },
    });
    const svc = makeSvc(prisma, indic);
    const r = await svc.calcular(PLAN_ID, USR_ID, ROL);
    // AA=5 (5 dimensiones fallas), AM=5 → 100 - 125 - 50 = -75 → max(0,-75) = 0
    expect(r.consistencia.valor).toBe(0);
  });

  // T13: Plan sin asignaturas → Completitud NO_APLICA, sin división por cero
  it('T13: plan sin asignaturas → estadoCalculo NO_APLICA, sin error de división', async () => {
    const prisma = makePrisma({
      materia:            { findMany: jest.fn().mockResolvedValue([]) },
      programaAsignatura: { findMany: jest.fn() },
      vinculacionCatedra: { findMany: jest.fn() },
    });
    const svc = makeSvc(prisma);
    const r = await svc.calcular(PLAN_ID, USR_ID, ROL);
    expect(r.completitud.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    expect(r.completitud.ap).toBeNull();
    expect(r.completitud.rc).toBeNull();
    expect(r.completitud.valor).toBeNull();
    // No debe llamar a programaAsignatura ni vinculacionCatedra si no hay materias
    expect(prisma.programaAsignatura.findMany).not.toHaveBeenCalled();
  });

  // T14: Asignaturas duplicadas en relaciones → no alteran resultados
  it('T14: programas duplicados (mismo materiaId) → solo cuenta una vez (último gana)', async () => {
    const ms = [materia('m1')];
    // Dos filas con el mismo materiaId (caso anómalo en BD)
    // new Map() conserva el último valor para claves duplicadas
    const programasDuplicados = [
      { materiaId: 'm1', estadoS1: 'PENDIENTE', estadoS2: 'PENDIENTE', estadoS3: 'PENDIENTE', estadoS4: 'PENDIENTE', estadoS5: 'PENDIENTE', estadoS6: 'PENDIENTE' },
      { materiaId: 'm1', estadoS1: 'COMPLETO',  estadoS2: 'COMPLETO',  estadoS3: 'COMPLETO',  estadoS4: 'COMPLETO',  estadoS5: 'COMPLETO',  estadoS6: 'COMPLETO' },
    ];
    const prisma = makePrisma({
      materia:            { findMany: jest.fn().mockResolvedValue(ms) },
      programaAsignatura: { findMany: jest.fn().mockResolvedValue(programasDuplicados) },
      vinculacionCatedra: { findMany: jest.fn().mockResolvedValue([]) },
    });
    const svc = makeSvc(prisma);
    const r = await svc.calcular(PLAN_ID, USR_ID, ROL);
    // Map usa el último valor → COMPLETO → AP = 100; totalMaterias = 1 (no duplicado)
    expect(r.completitud.ap).toBe(100);
    expect(r.completitud.totalMaterias).toBe(1);
  });

  // T15: Aislamiento entre planes — calcular para PLAN_A no afecta PLAN_B
  it('T15: dos planes distintos calculan indicadores independientes', async () => {
    const PLAN_B = 'plan-bbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    // Plan A: 2 materias, 2 programas completos, 2 responsables
    const msA = [materia('a1'), materia('a2')];
    // Plan B: 1 materia sin programa, sin responsable
    const msB = [materia('b1')];

    const prismaA = makePrisma({
      materia:            { findMany: jest.fn().mockResolvedValue(msA) },
      programaAsignatura: { findMany: jest.fn().mockResolvedValue(msA.map(m => progCompleto(m.id))) },
      vinculacionCatedra: { findMany: jest.fn().mockResolvedValue(msA.map(m => vinculacionResponsable(m.id))) },
    });
    const prismaB = makePrisma({
      planEstudio:        { findUnique: jest.fn().mockResolvedValue({ id: PLAN_B }) },
      materia:            { findMany: jest.fn().mockResolvedValue(msB) },
      programaAsignatura: { findMany: jest.fn().mockResolvedValue([]) },
      vinculacionCatedra: { findMany: jest.fn().mockResolvedValue([]) },
    });

    const rA = await makeSvc(prismaA).calcular(PLAN_ID, USR_ID, ROL);
    const rB = await makeSvc(prismaB).calcular(PLAN_B, USR_ID, ROL);

    expect(rA.completitud.ap).toBe(100);
    expect(rA.completitud.rc).toBe(100);
    expect(rB.completitud.ap).toBe(0);
    expect(rB.completitud.rc).toBe(0);
  });

  // T16: Regresión — calcAvance individual de Programa no se altera
  it('T16: programa con 4/6 completas → avance = 67 en servicio (igual que frontend)', async () => {
    const ms = [materia('m1')];
    const prisma = makePrisma({
      materia:            { findMany: jest.fn().mockResolvedValue(ms) },
      programaAsignatura: { findMany: jest.fn().mockResolvedValue([progParcial('m1')]) },
      vinculacionCatedra: { findMany: jest.fn().mockResolvedValue([]) },
    });
    const svc = makeSvc(prisma);
    const r = await svc.calcular(PLAN_ID, USR_ID, ROL);
    // 4/6 = 0.6666 → round(66.66) = 67
    expect(r.completitud.ap).toBe(67);
  });

  // T17: Regresión — R-09/R-13/R-14 sin modificaciones (retorno sin alterar)
  it('T17: evaluadores R-09/R-13/R-14 se invocan sin modificación a su resultado', async () => {
    const r09 = makeR09(false);
    const r13 = makeR13([]);
    const r14 = makeR14(0);
    const indicMock = {
      evaluar: jest.fn()
        .mockResolvedValueOnce(r09)
        .mockResolvedValueOnce(r13)
        .mockResolvedValueOnce(r14),
    };
    const prisma = makePrisma({
      materia: { findMany: jest.fn().mockResolvedValue([materia('m1')]) },
      programaAsignatura: { findMany: jest.fn().mockResolvedValue([]) },
      vinculacionCatedra: { findMany: jest.fn().mockResolvedValue([]) },
    });
    const svc = makeSvc(prisma, indicMock);
    await svc.calcular(PLAN_ID, USR_ID, ROL);
    expect(indicMock.evaluar).toHaveBeenCalledTimes(3);
    expect(indicMock.evaluar).toHaveBeenCalledWith(expect.objectContaining({ codigoIndicador: 'R-09' }));
    expect(indicMock.evaluar).toHaveBeenCalledWith(expect.objectContaining({ codigoIndicador: 'R-13' }));
    expect(indicMock.evaluar).toHaveBeenCalledWith(expect.objectContaining({ codigoIndicador: 'R-14' }));
  });

  // T_EXTRA: Plan no encontrado → NotFoundException
  it('plan inexistente → NotFoundException', async () => {
    const prisma = makePrisma({
      planEstudio: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const svc = makeSvc(prisma);
    await expect(svc.calcular('no-existe', USR_ID, ROL)).rejects.toThrow(NotFoundException);
  });

  // T_EXTRA: Rol sin acceso a autoevaluacion → Consistencia NO_DETERMINABLE
  it('rol DOCENTE → Consistencia NO_DETERMINABLE (ForbiddenException capturada)', async () => {
    const indicMock = { evaluar: jest.fn().mockRejectedValue(new ForbiddenException()) };
    const prisma = makePrisma({
      materia: { findMany: jest.fn().mockResolvedValue([materia('m1')]) },
      programaAsignatura: { findMany: jest.fn().mockResolvedValue([]) },
      vinculacionCatedra: { findMany: jest.fn().mockResolvedValue([]) },
    });
    const svc = makeSvc(prisma, indicMock);
    const r = await svc.calcular(PLAN_ID, USR_ID, 'DOCENTE');
    expect(r.consistencia.estadoCalculo).toBe(EstadoCalculo.NO_DETERMINABLE);
    expect(r.consistencia.aa).toBeNull();
    expect(r.consistencia.am).toBeNull();
    expect(r.consistencia.valor).toBeNull();
  });
});
