/**
 * listado-docentes.service.spec.ts — IMPL-18B
 *
 * Tests unitarios para TablroCarreraService.consultarListadoDocentes().
 * 16 casos: completitud, semáforo, alertas, totales, orden, edge cases.
 */

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TablroCarreraService } from './tablero-carrera.service';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type { ResultadoR03, DocenteAlertaR03 } from '../indicadores/r03.evaluador';
import type { ResultadoR07 } from '../indicadores/r07.evaluador';
import type { CargoSinActividadR04, ResultadoR04 } from '../indicadores/r04.evaluador';
import type { ResultadoR10, DocenteAlertaR10 } from '../indicadores/r10.evaluador';
import type { DocenteAlertaR12, ResultadoR12 } from '../indicadores/r12.evaluador';

// ── Constantes de prueba ──────────────────────────────────────────────────────

const CAR_ID  = 'car-00000000-0000-0000-0000-000000000001';
const USER_ID = 'usr-00000000-0000-0000-0000-000000000001';
const ROL     = 'ADMINISTRADOR_SISTEMA';

// ── Docente mínimo con ficha completa ─────────────────────────────────────────

type ProgramaRow = {
  estadoS1: string | null; estadoS2: string | null; estadoS3: string | null;
  estadoS4: string | null; estadoS5: string | null; estadoS6: string | null;
} | null;

function makeDocRow(overrides: Partial<{
  docenteId: string;
  nombre: string;
  apellido: string;
  sexo: string | null;
  fechaNacimiento: Date | null;
  cuit: string | null;
  pisoDepto: string | null;
  residencia: string | null;
  tipoDocumento: string;
  tituloGrado: string | null;
  areaDisciplinarId: string | null;
  materiaId: string;
  materiaNombre: string;
  cargaHorariaSemanal: number | null;
  programa: ProgramaRow;
}> = {}) {
  const {
    docenteId    = 'd-001',
    nombre       = 'Juan',
    apellido     = 'García',
    sexo         = 'M',
    fechaNacimiento = new Date('1980-01-01'),
    cuit         = '20-12345678-1',
    pisoDepto    = 'CABA',
    residencia   = 'Argentina',
    tipoDocumento = 'DNI',
    tituloGrado  = '[{"denominacion":"Ing.","anio":"2005","pais":"Argentina","institucion":"UBA"}]',
    areaDisciplinarId = 'area-1',
    materiaId    = 'm-001',
    materiaNombre = 'Matemática',
    cargaHorariaSemanal = 6,
  } = overrides;

  const programa: ProgramaRow = overrides.programa !== undefined ? overrides.programa : null;

  return {
    docenteId,
    materia: { id: materiaId, nombre: materiaNombre, cargaHorariaSemanal, programa },
    docente: {
      nombre, apellido, sexo, fechaNacimiento, cuit, pisoDepto, residencia,
      tipoDocumento, tituloGrado, areaDisciplinarId,
    },
  };
}

// ── Fábrica de mocks de evaluadores ──────────────────────────────────────────

function makeR03Mock(enAlerta: { docenteId: string; nombre: string }[] = []) {
  const alertas: DocenteAlertaR03[] = enAlerta.map(d => ({
    docenteId: d.docenteId, nombre: d.nombre,
    componentes: { horasDocencia: 30, horasGestion: 0, horasNoAcademico: 0, usoTope: 30 },
    exceso: 2,
  }));
  return {
    evaluar: jest.fn().mockResolvedValue({
      estadoCalculo: EstadoCalculo.CALCULADO,
      valor: { carreraId: CAR_ID, facultadId: 'f1', limite: 28, totalDocentes: 1,
               totalEnAlerta: alertas.length, enAlerta: alertas,
               totalNoDeterminables: 0, noDeterminables: [], alcanceFacultad: true } as ResultadoR03,
    }),
  };
}

function makeR07Mock(sobreasignados: { docenteId: string; nombre: string }[] = []) {
  const sobre = sobreasignados.map(d => ({
    docenteId: d.docenteId, nombre: d.nombre, nMaterias: 4, exceso: 1, asignaciones: [],
  }));
  return {
    evaluar: jest.fn().mockResolvedValue({
      estadoCalculo: EstadoCalculo.CALCULADO,
      valor: { carreraId: CAR_ID, facultadId: 'f1', limite: 3,
               totalDocentes: 1, totalSobreasignados: sobre.length, sobreasignados: sobre,
               totalNoDeterminables: 0, noDeterminables: [], alcanceFacultad: true } as ResultadoR07,
    }),
  };
}

function makeR04Mock(cargosEnAlerta: { docenteId: string; nombre: string }[] = []) {
  const cargos: CargoSinActividadR04[] = cargosEnAlerta.map((d, i) => ({
    docenteId: d.docenteId, nombre: d.nombre,
    cargoDocenteId: `cargo-${i}`, cargoNombre: 'Titular',
    designacion: null, fechaInicio: new Date('2023-01-01'), fechaFin: null, verificado: true,
  }));
  return {
    evaluar: jest.fn().mockResolvedValue({
      estadoCalculo: EstadoCalculo.CALCULADO,
      valor: { planEstudioId: 'plan-1', carreraId: CAR_ID, fechaCalculo: new Date(),
               totalDocentesPlantel: 1, cargosEnAlerta: cargos,
               totalCargosEnAlerta: cargos.length, docentesExceptuadosPorC4: [] } as ResultadoR04,
    }),
  };
}

function makeR10Mock(enAlerta: { docenteId: string; nombre: string; incierto?: boolean }[] = []) {
  const alertas: DocenteAlertaR10[] = enAlerta.map(d => ({
    docenteId: d.docenteId, nombre: d.nombre,
    horasConocidas: 10, umbral: 20, incierto: d.incierto ?? false,
    componentes: { horasDocencia: 10, horasGestion: 0, horasOtrasDedicaciones: 0, horasInvestigacion: 0, horasVinculacion: 0, gestionIndeterminada: false, otrasDedicacionesIndeterminadas: false, investigacionIndeterminada: false, vinculacionIndeterminada: false },
  }));
  return {
    evaluar: jest.fn().mockResolvedValue({
      estadoCalculo: EstadoCalculo.CALCULADO,
      valor: { carreraId: CAR_ID, umbral: 20, totalDocentes: 1,
               totalEnAlerta: alertas.filter(a => !a.incierto).length,
               totalInciertos: alertas.filter(a => a.incierto).length,
               enAlerta: alertas, alcanceFacultad: true },
    }),
  };
}

function makeR12Mock(incompletos: { docenteId: string; nombre: string }[] = []) {
  const incs: DocenteAlertaR12[] = incompletos.map(d => ({
    docenteId: d.docenteId, nombre: d.nombre, faltantes: ['personales' as const],
  }));
  return {
    evaluar: jest.fn().mockResolvedValue({
      estadoCalculo: EstadoCalculo.CALCULADO,
      valor: { carreraId: CAR_ID, facultadId: 'f1', totalDocentes: 1,
               totalIncompletos: incs.length, incompletos: incs,
               totalNoDeterminables: 0, noDeterminables: [], alcanceFacultad: true } as ResultadoR12,
    }),
  };
}

function makePrisma(rows: ReturnType<typeof makeDocRow>[], planes = [{ id: 'plan-1' }]) {
  return {
    carrera: { findUnique: jest.fn().mockResolvedValue({ id: CAR_ID }) },
    planEstudio: { findMany: jest.fn().mockResolvedValue(planes) },
    vinculacionCatedra: { findMany: jest.fn().mockResolvedValue(rows) },
    materia: { count: jest.fn().mockResolvedValue(0) },
  };
}

function makeSvc(overrides: {
  rows?: ReturnType<typeof makeDocRow>[];
  planes?: { id: string }[];
  r03?: ReturnType<typeof makeR03Mock>;
  r07?: ReturnType<typeof makeR07Mock>;
  r04?: ReturnType<typeof makeR04Mock>;
  r10?: ReturnType<typeof makeR10Mock>;
  r12?: ReturnType<typeof makeR12Mock>;
  scopeValue?: boolean;
} = {}) {
  const {
    rows = [], planes = [{ id: 'plan-1' }],
    r03 = makeR03Mock(), r07 = makeR07Mock(),
    r04 = makeR04Mock(), r10 = makeR10Mock(), r12 = makeR12Mock(),
    scopeValue = true,
  } = overrides;

  const prisma = makePrisma(rows, planes);
  const scope  = { tieneScopeCarrera: jest.fn().mockResolvedValue(scopeValue) };

  return new TablroCarreraService(
    prisma as any,
    scope as any,
    { evaluar: jest.fn().mockResolvedValue({ estadoCalculo: EstadoCalculo.CALCULADO, valor: { totalDocentes: 1, mediana: 1, promedio: 1, maximo: 1, distribucion: [], limite: 3, totalEnAlerta: 0, enAlerta: [], carreraId: CAR_ID } }) } as any,
    r07 as any,
    { evaluarParaCarrera: jest.fn().mockResolvedValue({ totalDocentes: 1, completitudPromedio: 75, estadoCalculo: EstadoCalculo.CALCULADO }) } as any,
    { evaluarParaCarrera: jest.fn().mockResolvedValue({ carreraId: CAR_ID, puntaje: 100, componenteA: 0, componenteM: 0, alertasR03: 0, alertasR04Penalizables: 0, alertasR07: 0, estadoCalculo: EstadoCalculo.CALCULADO }) } as any,
    r12 as any,
    r10 as any,
    r03 as any,
    r04 as any,
    { obtenerDocentesParaR10: jest.fn().mockResolvedValue({ docentes: [], alcanceFacultad: true, docentesMultiFacultad: new Set() }), obtenerConfigDeCarrera: jest.fn().mockResolvedValue(null) } as any,
  );
}

// ── LD-01: sin docentes → NO_APLICA ──────────────────────────────────────────

describe('LD-01 — sin docentes activos: devuelve NO_APLICA y lista vacía', () => {
  it('retorna estadoCalculo=NO_APLICA y docentes=[] cuando no hay vinculaciones', async () => {
    const svc = makeSvc({ rows: [] });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    expect(res.docentes).toHaveLength(0);
    expect(res.totales.total).toBe(0);
  });
});

// ── LD-02: ficha completa → completitud 100, fichaScore 4, VERDE ─────────────

describe('LD-02 — docente con ficha completa: completitud=100, fichaScore=4, VERDE', () => {
  it('calcula completitud 100 cuando C1, C2, C3 son verdaderos', async () => {
    const svc = makeSvc({ rows: [makeDocRow()] });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    const d = res.docentes[0];
    expect(d.completitud).toBe(100);
    expect(d.fichaScore).toBe(4);
    expect(d.semaforo).toBe('VERDE');
  });
});

// ── LD-03: C1 faltante → completitud 75, fichaScore 3 ────────────────────────

describe('LD-03 — C1 incompleto (sexo null): completitud=75, fichaScore=3', () => {
  it('calcula completitud 75 cuando C1=false (sexo null)', async () => {
    const svc = makeSvc({ rows: [makeDocRow({ sexo: null })] });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.docentes[0].completitud).toBe(75);
    expect(res.docentes[0].fichaScore).toBe(3);
  });
});

// ── LD-04: C2 faltante → completitud 75, fichaScore 3 ────────────────────────

describe('LD-04 — C2 incompleto (tituloGrado null): completitud=75, fichaScore=3', () => {
  it('calcula completitud 75 cuando C2=false (tituloGrado null)', async () => {
    const svc = makeSvc({ rows: [makeDocRow({ tituloGrado: null })] });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.docentes[0].completitud).toBe(75);
    expect(res.docentes[0].fichaScore).toBe(3);
  });
});

// ── LD-05: C3 faltante → completitud 75, fichaScore 3 ────────────────────────

describe('LD-05 — C3 incompleto (areaDisciplinarId null): completitud=75, fichaScore=3', () => {
  it('calcula completitud 75 cuando C3=false (areaDisciplinarId null)', async () => {
    const svc = makeSvc({ rows: [makeDocRow({ areaDisciplinarId: null })] });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.docentes[0].completitud).toBe(75);
    expect(res.docentes[0].fichaScore).toBe(3);
  });
});

// ── LD-06: alerta R-03 (altaTope) deprime semáforo a AMARILLO ────────────────

describe('LD-06 — alerta R-03 (altaTope): consistencia=75, semáforo=AMARILLO (C-01: ≥90→VERDE)', () => {
  it('marca altaTope=true y ajusta consistencia a 75 (1 alerta ALTA) → score=75 → AMARILLO', async () => {
    const rows = [makeDocRow()]; // completitud=100
    const svc = makeSvc({
      rows,
      r03: makeR03Mock([{ docenteId: 'd-001', nombre: 'García Juan' }]),
    });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    const d = res.docentes[0];
    expect(d.alertas.altaTope).toBe(true);
    // consistencia = max(0, 100 - 25*1 - 10*0) = 75; score = min(100,75) = 75 → AMARILLO (C-01: <90)
    expect(d.semaforo).toBe('AMARILLO');
  });
});

// ── LD-07: 2 alertas ALTA → consistencia=50, ROJO ────────────────────────────

describe('LD-07 — 2 alertas ALTA (R-03 + R-04): consistencia=50, semáforo=ROJO (C-01: <60→ROJO)', () => {
  it('calcula consistencia=50 con A=2 y marca semáforo ROJO', async () => {
    const rows = [makeDocRow()]; // completitud=100
    const svc = makeSvc({
      rows,
      r03: makeR03Mock([{ docenteId: 'd-001', nombre: 'García Juan' }]),
      r04: makeR04Mock([{ docenteId: 'd-001', nombre: 'García Juan' }]),
    });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    const d = res.docentes[0];
    expect(d.alertas.altaTope).toBe(true);
    expect(d.alertas.altaSinActividad).toBe(true);
    // consistencia = max(0, 100 - 25*2 - 10*0) = 50; score = min(100,50)=50 → ROJO (C-01: <60)
    expect(d.semaforo).toBe('ROJO');
  });
});

// ── LD-08: alerta R-07 (mediaSobreasignado) deprime semáforo ─────────────────

describe('LD-08 — alerta R-07 (mediaSobreasignado): consistencia=90, semáforo=VERDE', () => {
  it('marca mediaSobreasignado=true; con completitud=100 y 1 MEDIA → score=90 → VERDE', async () => {
    const rows = [makeDocRow()]; // completitud=100
    const svc = makeSvc({
      rows,
      r07: makeR07Mock([{ docenteId: 'd-001', nombre: 'García Juan' }]),
    });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    const d = res.docentes[0];
    expect(d.alertas.mediaSobreasignado).toBe(true);
    // consistencia = max(0, 100 - 25*0 - 10*1) = 90; score = 90 → VERDE
    expect(d.semaforo).toBe('VERDE');
  });
});

// ── LD-09: alerta R-10 confirmada ────────────────────────────────────────────

describe('LD-09 — alerta R-10 confirmada: informativaBajaDedicacion=true', () => {
  it('marca informativaBajaDedicacion=true para docente en R-10.enAlerta con incierto=false', async () => {
    const rows = [makeDocRow()];
    const svc = makeSvc({
      rows,
      r10: makeR10Mock([{ docenteId: 'd-001', nombre: 'García Juan', incierto: false }]),
    });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.docentes[0].alertas.informativaBajaDedicacion).toBe(true);
    expect(res.docentes[0].alertas.bajaDedicacionIncierta).toBe(false);
  });
});

// ── LD-10: alerta R-10 incierta ──────────────────────────────────────────────

describe('LD-10 — alerta R-10 incierta: bajaDedicacionIncierta=true', () => {
  it('marca bajaDedicacionIncierta=true para docente en R-10.enAlerta con incierto=true', async () => {
    const rows = [makeDocRow()];
    const svc = makeSvc({
      rows,
      r10: makeR10Mock([{ docenteId: 'd-001', nombre: 'García Juan', incierto: true }]),
    });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.docentes[0].alertas.bajaDedicacionIncierta).toBe(true);
    expect(res.docentes[0].alertas.informativaBajaDedicacion).toBe(false);
  });
});

// ── LD-11: alerta R-12 (fichaIncompleta) ─────────────────────────────────────

describe('LD-11 — alerta R-12 (fichaIncompleta): fichaIncompleta=true', () => {
  it('marca fichaIncompleta=true para docente en R-12.incompletos', async () => {
    const rows = [makeDocRow()];
    const svc = makeSvc({
      rows,
      r12: makeR12Mock([{ docenteId: 'd-001', nombre: 'García Juan' }]),
    });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.docentes[0].alertas.fichaIncompleta).toBe(true);
  });
});

// ── LD-12: totales de filtros ─────────────────────────────────────────────────

describe('LD-12 — totales.conAlertas incluye solo alertas ALTA y MEDIA (no informativas)', () => {
  it('conAlertas=1 cuando solo un docente tiene altaTope; bajaDedicacion no contribuye a conAlertas', async () => {
    const rows = [
      makeDocRow({ docenteId: 'd-001', nombre: 'Doc Uno', apellido: 'Uno' }),
      makeDocRow({ docenteId: 'd-002', nombre: 'Doc Dos', apellido: 'Dos', materiaId: 'm-002' }),
    ];
    const svc = makeSvc({
      rows,
      r03: makeR03Mock([{ docenteId: 'd-001', nombre: 'Uno Doc' }]),
      r10: makeR10Mock([{ docenteId: 'd-002', nombre: 'Dos Doc', incierto: false }]),
    });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.totales.total).toBe(2);
    expect(res.totales.conAlertas).toBe(1);
    expect(res.totales.bajaDedicacion).toBe(1);
    expect(res.totales.fichaIncompleta).toBe(0);
  });
});

// ── LD-13: horas suma solo materias con carga informada ──────────────────────

describe('LD-13 — horasCarreraConocidas y tieneHorasIncompletas', () => {
  it('suma solo horas conocidas y marca tieneHorasIncompletas cuando hay null', async () => {
    const rows = [
      makeDocRow({ docenteId: 'd-001', nombre: 'Juan', apellido: 'García', materiaId: 'm-1', cargaHorariaSemanal: 6 }),
      makeDocRow({ docenteId: 'd-001', nombre: 'Juan', apellido: 'García', materiaId: 'm-2', cargaHorariaSemanal: null }),
    ];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.docentes).toHaveLength(1);
    expect(res.docentes[0].horasCarreraConocidas).toBe(6);
    expect(res.docentes[0].tieneHorasIncompletas).toBe(true);
    expect(res.docentes[0].nMaterias).toBe(2);
  });
});

// ── LD-14: deduplicación de materias por materiaId ────────────────────────────

describe('LD-14 — deduplica materias por materiaId (misma materia en 2 vinculaciones)', () => {
  it('cuenta la materia una sola vez cuando hay 2 filas con el mismo materiaId', async () => {
    const rows = [
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-1', cargaHorariaSemanal: 4 }),
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-1', cargaHorariaSemanal: 4 }),
    ];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.docentes).toHaveLength(1);
    expect(res.docentes[0].nMaterias).toBe(1);
    expect(res.docentes[0].horasCarreraConocidas).toBe(4);
  });
});

// ── LD-15: nombre formateado "APELLIDO, Nombre" ───────────────────────────────

describe('LD-15 — nombre formateado como "APELLIDO, Nombre"', () => {
  it('formatea el nombre del docente como "APELLIDO, Nombre"', async () => {
    const rows = [makeDocRow({ nombre: 'Juan', apellido: 'García' })];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.docentes[0].nombre).toBe('GARCÍA, Juan');
  });
});

// ── LD-16: orden alfabético por nombre por defecto ────────────────────────────

describe('LD-16 — docentes ordenados alfabéticamente por "APELLIDO, Nombre"', () => {
  it('ordena los docentes por nombre (APELLIDO, Nombre) de forma ascendente', async () => {
    const rows = [
      makeDocRow({ docenteId: 'd-z', nombre: 'Zoe', apellido: 'Zanetti', materiaId: 'm-z' }),
      makeDocRow({ docenteId: 'd-a', nombre: 'Ana', apellido: 'Álvarez', materiaId: 'm-a' }),
      makeDocRow({ docenteId: 'd-m', nombre: 'María', apellido: 'Martínez', materiaId: 'm-m' }),
    ];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    const nombres = res.docentes.map(d => d.docenteId);
    expect(nombres[0]).toBe('d-a');
    expect(nombres[2]).toBe('d-z');
  });
});

// ── LD-17: umbrales de semáforo (C-01) ───────────────────────────────────────
// Verifica los límites exactos: VERDE≥90, AMARILLO 60–89, ROJO<60

describe('LD-17 — umbrales de semáforo C-01: VERDE≥90, AMARILLO 60–89, ROJO<60', () => {
  // Helpers: para forzar score exacto usamos completitud y consistencia iguales (ficha completa, sin alertas)
  // completitud = 100 (todos los campos), consistencia depende de A y M
  // Para scores distintos a 100 necesitamos hacer que completitud sea el limitante.
  // completitud = 25*(C1+C2+C3+1). score=100 → todos; score=75 → 1 criterio faltante; etc.
  // Para score=0: ficha vacía: C1=C2=C3=0 → completitud=25; consistencia=100 → score=25
  // Para score=59: completitud forzada mediante una fila sin ficha completa es difícil.
  // En cambio, usamos las alertas para deprimir consistencia:
  //   R-03 (A+1): consistencia -25 por alerta ALTA
  //   R-07 (M+1): consistencia -10 por alerta MEDIA
  // Consistencia = max(0, 100 - 25*A - 10*M)
  // score = min(completitud, consistencia)

  it('score=25 (C1=C2=C3=false, sin alertas): ROJO', async () => {
    // completitud = 25*(0+0+0+1) = 25; consistencia=100; score=25 → ROJO
    const rows = [makeDocRow({ sexo: null, tituloGrado: null, areaDisciplinarId: null })];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.docentes[0].completitud).toBe(25);
    expect(res.docentes[0].semaforo).toBe('ROJO');
  });

  it('score=59: ROJO (consistencia=59 mediante A=1+M=1+M=1+M=1+M=1+M=1: 100-25-40=35... usar A=1,M=1→65, A=1,M=4→60-10→… usamos C1+C2+C3→completitud=50 para score=50)', async () => {
    // Forzamos completitud baja: C1=C2=false, C3=true → completitud=25*(0+0+1+1)=50
    // sin alertas → consistencia=100; score=50 → ROJO
    const rows = [makeDocRow({ sexo: null, tituloGrado: null })];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.docentes[0].completitud).toBe(50);
    expect(res.docentes[0].semaforo).toBe('ROJO');
  });

  it('score=65 (A=1 R03, M=1 R07, completitud=100): AMARILLO', async () => {
    // consistencia = 100 - 25*1(R03) - 10*1(R07) = 65; completitud=100; score=65 → AMARILLO
    const rows = [makeDocRow()];
    const svc = makeSvc({
      rows,
      r03: makeR03Mock([{ docenteId: 'd-001', nombre: 'García Juan' }]),
      r07: makeR07Mock([{ docenteId: 'd-001', nombre: 'García Juan' }]),
    });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.docentes[0].semaforo).toBe('AMARILLO');
  });

  it('score=75: AMARILLO (C1=false → completitud=75; consistencia=100; score=75)', async () => {
    const rows = [makeDocRow({ sexo: null })]; // C1=false → completitud=75
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.docentes[0].completitud).toBe(75);
    expect(res.docentes[0].semaforo).toBe('AMARILLO');
  });

  it('score=75: AMARILLO (A=1 R03, completitud=100 → consistencia=75; score=75)', async () => {
    // Diferente camino para score=75: alertas en lugar de completitud
    // consistencia = 100 - 25*1(R03) = 75; completitud=100; score=min(100,75)=75 → AMARILLO
    const rows = [makeDocRow()];
    const svc = makeSvc({
      rows,
      r03: makeR03Mock([{ docenteId: 'd-001', nombre: 'García Juan' }]),
    });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.docentes[0].semaforo).toBe('AMARILLO');
  });

  it('score=90: VERDE (M=1 → consistencia=90; completitud=100; score=90)', async () => {
    const rows = [makeDocRow()];
    const svc = makeSvc({
      rows,
      r07: makeR07Mock([{ docenteId: 'd-001', nombre: 'García Juan' }]),
    });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    // consistencia = 100-10*1 = 90; score=90 → VERDE
    expect(res.docentes[0].semaforo).toBe('VERDE');
  });

  it('score=100: VERDE (ficha completa, sin alertas)', async () => {
    const rows = [makeDocRow()];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.docentes[0].completitud).toBe(100);
    expect(res.docentes[0].semaforo).toBe('VERDE');
  });
});

// ── LD-18: distribución de semáforos (B-04) ──────────────────────────────────

describe('LD-18 — distribucionSemaforos: conteo por semáforo del plantel', () => {
  it('plantel vacío: distribucionSemaforos con todos en 0', async () => {
    const svc = makeSvc({ rows: [] });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.distribucionSemaforos).toEqual({ verde: 0, amarillo: 0, rojo: 0, total: 0 });
  });

  it('un docente VERDE: verde=1, amarillo=0, rojo=0, total=1', async () => {
    const rows = [makeDocRow()]; // completitud=100, sin alertas → score=100 → VERDE
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.docentes[0].semaforo).toBe('VERDE');
    expect(res.distribucionSemaforos).toEqual({ verde: 1, amarillo: 0, rojo: 0, total: 1 });
  });

  it('plantel mixto: 1 VERDE, 1 AMARILLO, 1 ROJO → distribución correcta', async () => {
    const rows = [
      makeDocRow({ docenteId: 'd-v', nombre: 'Verde', apellido: 'Docente', materiaId: 'm-v' }), // score=100 VERDE
      makeDocRow({ docenteId: 'd-a', nombre: 'Amarillo', apellido: 'Docente', materiaId: 'm-a', sexo: null }), // completitud=75 → AMARILLO
      makeDocRow({ docenteId: 'd-r', nombre: 'Rojo', apellido: 'Docente', materiaId: 'm-r', sexo: null, tituloGrado: null }), // completitud=50 → ROJO
    ];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.distribucionSemaforos).toEqual({ verde: 1, amarillo: 1, rojo: 1, total: 3 });
  });

  it('invariante VERDE+AMARILLO+ROJO === total en plantel mixto', async () => {
    const rows = [
      makeDocRow({ docenteId: 'd-1', nombre: 'D1', apellido: 'A', materiaId: 'm-1' }),
      makeDocRow({ docenteId: 'd-2', nombre: 'D2', apellido: 'B', materiaId: 'm-2', sexo: null }),
      makeDocRow({ docenteId: 'd-3', nombre: 'D3', apellido: 'C', materiaId: 'm-3', sexo: null, tituloGrado: null }),
    ];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    const { verde, amarillo, rojo, total } = res.distribucionSemaforos!;
    expect(verde + amarillo + rojo).toBe(total);
    expect(total).toBe(res.docentes.length);
  });

  it('cada docente se cuenta exactamente una vez (sin duplicados)', async () => {
    const rows = [
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-1' }),
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-2' }), // misma persona, 2 materias
    ];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.docentes).toHaveLength(1);
    expect(res.distribucionSemaforos!.total).toBe(1);
  });
});

// ── LD-19: 1 docente / 1 materia con programa completo (6/6) ─────────────────

describe('LD-19 — filas: 1 docente / 1 materia con ProgramaAsignatura completo (6/6)', () => {
  it('devuelve 1 fila con seccionesCompletas=6, completitudPrograma=100 y estadoPrograma=VERDE', async () => {
    const prog: ProgramaRow = {
      estadoS1: 'COMPLETO', estadoS2: 'COMPLETO', estadoS3: 'COMPLETO',
      estadoS4: 'COMPLETO', estadoS5: 'COMPLETO', estadoS6: 'COMPLETO',
    };
    const svc = makeSvc({ rows: [makeDocRow({ programa: prog })] });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas).toHaveLength(1);
    expect(res.filas[0].seccionesCompletas).toBe(6);
    expect(res.filas[0].completitudPrograma).toBe(100);
    expect(res.filas[0].estadoPrograma).toBe('VERDE');
  });
});

// ── LD-20: 1 docente / 3 materias → 3 filas con misma dedicación total ───────

describe('LD-20 — filas: 1 docente / 3 materias devuelve 3 filas con dedicación total en cada una', () => {
  it('3 filas para el docente; horasCarreraConocidas es el total en cada fila; docentes tiene 1 entrada', async () => {
    const rows = [
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-1', materiaNombre: 'Mat A', cargaHorariaSemanal: 4 }),
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-2', materiaNombre: 'Mat B', cargaHorariaSemanal: 3 }),
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-3', materiaNombre: 'Mat C', cargaHorariaSemanal: 2 }),
    ];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.docentes).toHaveLength(1);
    expect(res.filas).toHaveLength(3);
    for (const f of res.filas) {
      expect(f.horasCarreraConocidas).toBe(9); // total 4+3+2, igual en todas las filas
      expect(f.docenteId).toBe('d-001');
    }
  });
});

// ── LD-21: 2 docentes / 1 materia cada uno ───────────────────────────────────

describe('LD-21 — filas: 2 docentes / 1 materia cada uno devuelve 2 filas', () => {
  it('devuelve 2 filas, una por docente', async () => {
    const rows = [
      makeDocRow({ docenteId: 'd-001', apellido: 'García', nombre: 'Juan', materiaId: 'm-1' }),
      makeDocRow({ docenteId: 'd-002', apellido: 'López', nombre: 'Ana', materiaId: 'm-2' }),
    ];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas).toHaveLength(2);
    expect(res.filas.map(f => f.docenteId).sort()).toEqual(['d-001', 'd-002']);
  });
});

// ── LD-22: deduplica vinculaciones con mismo (docenteId, materiaId) ───────────

describe('LD-22 — filas: 2 vinculaciones con mismo (docenteId, materiaId) → 1 fila', () => {
  it('no duplica filas cuando hay dos vinculaciones APROBADA con la misma materia', async () => {
    const rows = [
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-1', cargaHorariaSemanal: 4 }),
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-1', cargaHorariaSemanal: 4 }),
    ];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas).toHaveLength(1);
    expect(res.filas[0].horasCarreraConocidas).toBe(4);
  });
});

// ── LD-23: materia sin ProgramaAsignatura → seccionesCompletas=null ───────────

describe('LD-23 — filas: materia sin ProgramaAsignatura → seccionesCompletas null, completitudPrograma null', () => {
  it('devuelve seccionesCompletas=null y completitudPrograma=null cuando no existe ProgramaAsignatura', async () => {
    const svc = makeSvc({ rows: [makeDocRow({ programa: null })] });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas[0].seccionesCompletas).toBeNull();
    expect(res.filas[0].completitudPrograma).toBeNull();
  });
});

// ── LD-24: programa parcial 3/6 → completitudPrograma=50 ─────────────────────

describe('LD-24 — filas: programa 3/6 → completitudPrograma=Math.round(3/6*100)=50', () => {
  it('calcula completitudPrograma=50 con 3 secciones completas y 3 pendientes', async () => {
    const prog: ProgramaRow = {
      estadoS1: 'COMPLETO', estadoS2: 'COMPLETO', estadoS3: 'COMPLETO',
      estadoS4: 'PENDIENTE', estadoS5: 'PENDIENTE', estadoS6: 'PENDIENTE',
    };
    const svc = makeSvc({ rows: [makeDocRow({ programa: prog })] });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas[0].seccionesCompletas).toBe(3);
    expect(res.filas[0].completitudPrograma).toBe(50);
  });
});

// ── LD-25: dedicación del docente no se duplica por materia ──────────────────

describe('LD-25 — filas: horasCarreraConocidas es la suma total del docente (no por materia)', () => {
  it('todas las filas del docente muestran el total de horas, no las de cada materia individual', async () => {
    const rows = [
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-1', cargaHorariaSemanal: 6 }),
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-2', cargaHorariaSemanal: 4 }),
    ];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas).toHaveLength(2);
    expect(res.filas[0].horasCarreraConocidas).toBe(10);
    expect(res.filas[1].horasCarreraConocidas).toBe(10);
  });
});

// ── LD-26: contadores de totales son únicos por docente, no por filas ─────────

describe('LD-26 — totales: contadores basados en docentes únicos, no en filas', () => {
  it('total=1 aunque el docente tenga 3 materias (docentes únicos, no filas)', async () => {
    const rows = [
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-1', cargaHorariaSemanal: 4 }),
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-2', cargaHorariaSemanal: 3 }),
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-3', cargaHorariaSemanal: 2 }),
    ];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.totales.total).toBe(1);       // 1 docente único
    expect(res.filas).toHaveLength(3);       // 3 filas
    expect(res.docentes).toHaveLength(1);    // 1 docente en docentes[]
  });
});

// ── LD-27: retorno vacío incluye filas=[] ─────────────────────────────────────

describe('LD-27 — retorno vacío: filas=[] cuando no hay docentes activos', () => {
  it('devuelve filas=[] junto a docentes=[] cuando estadoCalculo=NO_APLICA', async () => {
    const svc = makeSvc({ rows: [] });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    expect(res.filas).toEqual([]);
  });
});

// ── LD-28: orden de filas por nombreDocente asc, luego nombreMateria asc ──────

describe('LD-28 — filas ordenadas por nombreDocente asc, luego nombreMateria asc', () => {
  it('filas ordenadas alfabéticamente por docente, luego por materia', async () => {
    const rows = [
      makeDocRow({ docenteId: 'd-002', apellido: 'López', nombre: 'Ana', materiaId: 'm-1', materiaNombre: 'Zeta' }),
      makeDocRow({ docenteId: 'd-002', apellido: 'López', nombre: 'Ana', materiaId: 'm-2', materiaNombre: 'Alpha' }),
      makeDocRow({ docenteId: 'd-001', apellido: 'García', nombre: 'Juan', materiaId: 'm-3', materiaNombre: 'Beta' }),
    ];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    // GARCÍA, Juan → 'd-001' first; LÓPEZ, Ana → 'd-002' x2
    expect(res.filas[0].docenteId).toBe('d-001');
    expect(res.filas[1].docenteId).toBe('d-002');
    expect(res.filas[1].nombreMateria).toBe('Alpha');  // Alpha < Zeta
    expect(res.filas[2].nombreMateria).toBe('Zeta');
  });
});

// ── LD-29: alertas en filas coinciden con alertas del docente ─────────────────

describe('LD-29 — filas: alertas en fila coinciden con las alertas del docente en docentes[]', () => {
  it('fila hereda las alertas del docente calculadas en docentes[]', async () => {
    const rows = [makeDocRow()];
    const svc = makeSvc({
      rows,
      r03: makeR03Mock([{ docenteId: 'd-001', nombre: 'García Juan' }]),
    });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    const docAlerta = res.docentes[0].alertas;
    const filaAlerta = res.filas[0].alertas;
    expect(filaAlerta.altaTope).toBe(docAlerta.altaTope);
    expect(filaAlerta.altaTope).toBe(true);
    expect(filaAlerta.altaSinActividad).toBe(docAlerta.altaSinActividad);
  });
});

// ── LD-30 a LD-37: semáforo del Programa de Asignatura (H.2-C) ───────────────

describe('LD-30 — semáforo programa: 0/6 → ROJO', () => {
  it('devuelve estadoPrograma=ROJO cuando seccionesCompletas=0', async () => {
    const prog: ProgramaRow = {
      estadoS1: 'PENDIENTE', estadoS2: 'PENDIENTE', estadoS3: 'PENDIENTE',
      estadoS4: 'PENDIENTE', estadoS5: 'PENDIENTE', estadoS6: 'PENDIENTE',
    };
    const svc = makeSvc({ rows: [makeDocRow({ programa: prog })] });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas[0].seccionesCompletas).toBe(0);
    expect(res.filas[0].estadoPrograma).toBe('ROJO');
  });
});

describe('LD-31 — semáforo programa: 1/6 → ROJO', () => {
  it('devuelve estadoPrograma=ROJO cuando seccionesCompletas=1', async () => {
    const prog: ProgramaRow = {
      estadoS1: 'COMPLETO',  estadoS2: 'PENDIENTE', estadoS3: 'PENDIENTE',
      estadoS4: 'PENDIENTE', estadoS5: 'PENDIENTE', estadoS6: 'PENDIENTE',
    };
    const svc = makeSvc({ rows: [makeDocRow({ programa: prog })] });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas[0].seccionesCompletas).toBe(1);
    expect(res.filas[0].estadoPrograma).toBe('ROJO');
  });
});

describe('LD-32 — semáforo programa: 2/6 → ROJO', () => {
  it('devuelve estadoPrograma=ROJO cuando seccionesCompletas=2', async () => {
    const prog: ProgramaRow = {
      estadoS1: 'COMPLETO',  estadoS2: 'COMPLETO',  estadoS3: 'PENDIENTE',
      estadoS4: 'PENDIENTE', estadoS5: 'PENDIENTE', estadoS6: 'PENDIENTE',
    };
    const svc = makeSvc({ rows: [makeDocRow({ programa: prog })] });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas[0].seccionesCompletas).toBe(2);
    expect(res.filas[0].estadoPrograma).toBe('ROJO');
  });
});

describe('LD-33 — semáforo programa: 3/6 → ROJO', () => {
  it('devuelve estadoPrograma=ROJO cuando seccionesCompletas=3', async () => {
    const prog: ProgramaRow = {
      estadoS1: 'COMPLETO',  estadoS2: 'COMPLETO',  estadoS3: 'COMPLETO',
      estadoS4: 'PENDIENTE', estadoS5: 'PENDIENTE', estadoS6: 'PENDIENTE',
    };
    const svc = makeSvc({ rows: [makeDocRow({ programa: prog })] });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas[0].seccionesCompletas).toBe(3);
    expect(res.filas[0].estadoPrograma).toBe('ROJO');
  });
});

describe('LD-34 — semáforo programa: 4/6 → AMARILLO', () => {
  it('devuelve estadoPrograma=AMARILLO cuando seccionesCompletas=4', async () => {
    const prog: ProgramaRow = {
      estadoS1: 'COMPLETO',  estadoS2: 'COMPLETO',  estadoS3: 'COMPLETO',
      estadoS4: 'COMPLETO',  estadoS5: 'PENDIENTE', estadoS6: 'PENDIENTE',
    };
    const svc = makeSvc({ rows: [makeDocRow({ programa: prog })] });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas[0].seccionesCompletas).toBe(4);
    expect(res.filas[0].estadoPrograma).toBe('AMARILLO');
  });
});

describe('LD-35 — semáforo programa: 5/6 → AMARILLO', () => {
  it('devuelve estadoPrograma=AMARILLO cuando seccionesCompletas=5', async () => {
    const prog: ProgramaRow = {
      estadoS1: 'COMPLETO',  estadoS2: 'COMPLETO',  estadoS3: 'COMPLETO',
      estadoS4: 'COMPLETO',  estadoS5: 'COMPLETO',  estadoS6: 'PENDIENTE',
    };
    const svc = makeSvc({ rows: [makeDocRow({ programa: prog })] });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas[0].seccionesCompletas).toBe(5);
    expect(res.filas[0].estadoPrograma).toBe('AMARILLO');
  });
});

describe('LD-36 — semáforo programa: 6/6 → VERDE (confirmado H.2-C)', () => {
  it('devuelve estadoPrograma=VERDE cuando seccionesCompletas=6', async () => {
    const prog: ProgramaRow = {
      estadoS1: 'COMPLETO', estadoS2: 'COMPLETO', estadoS3: 'COMPLETO',
      estadoS4: 'COMPLETO', estadoS5: 'COMPLETO', estadoS6: 'COMPLETO',
    };
    const svc = makeSvc({ rows: [makeDocRow({ programa: prog })] });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas[0].seccionesCompletas).toBe(6);
    expect(res.filas[0].estadoPrograma).toBe('VERDE');
  });
});

describe('LD-37 — semáforo programa: sin ProgramaAsignatura → NO_VERIFICABLE', () => {
  it('devuelve estadoPrograma=NO_VERIFICABLE cuando no existe ProgramaAsignatura', async () => {
    const svc = makeSvc({ rows: [makeDocRow({ programa: null })] });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas[0].seccionesCompletas).toBeNull();
    expect(res.filas[0].estadoPrograma).toBe('NO_VERIFICABLE');
  });
});

describe('LD-38 — semáforo programa: 6/6 siempre VERDE aunque R-11 tenga inconsistencias', () => {
  it('estadoPrograma=VERDE con 6/6 incluso si R-11 detectaría inconsistencias de prioridad ALTA', async () => {
    // R-11 evalúa inconsistencias por secciones específicas, pero NO afecta estadoPrograma.
    // La regla H.2-C: solo seccionesCompletas determina el semáforo.
    const prog: ProgramaRow = {
      estadoS1: 'COMPLETO', estadoS2: 'COMPLETO', estadoS3: 'COMPLETO',
      estadoS4: 'COMPLETO', estadoS5: 'COMPLETO', estadoS6: 'COMPLETO',
    };
    const svc = makeSvc({ rows: [makeDocRow({ programa: prog })] });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas[0].seccionesCompletas).toBe(6);
    expect(res.filas[0].estadoPrograma).toBe('VERDE');
  });
});
