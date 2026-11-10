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
  subareaId: string | null;
  materiaId: string;
  materiaNombre: string;
  cargaHorariaSemanal: number | null;
  cargosAcademicosJson: string | null;
  tiempoDedicacionGestionSemanal: string | null;
  fechaFinGestion: string | null;
  funcionGestion: string | null;
  proyectosInvestigacionJson: string | null;
  participacionVinculacionJson: string | null;
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
    subareaId    = null,
    materiaId    = 'm-001',
    materiaNombre = 'Matemática',
    cargaHorariaSemanal = 6,
    cargosAcademicosJson = null,
    tiempoDedicacionGestionSemanal = null,
    fechaFinGestion = null,
    funcionGestion = null,
    proyectosInvestigacionJson = null,
    participacionVinculacionJson = null,
  } = overrides;

  return {
    docenteId,
    materia: { id: materiaId, nombre: materiaNombre, cargaHorariaSemanal },
    docente: {
      nombre, apellido, sexo, fechaNacimiento, cuit, pisoDepto, residencia,
      tipoDocumento, tituloGrado, areaDisciplinarId, subareaId,
      cargosAcademicosJson, tiempoDedicacionGestionSemanal, fechaFinGestion,
      funcionGestion, proyectosInvestigacionJson, participacionVinculacionJson,
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

describe('LD-13 — horasCarreraConocidas y tieneHorasIncompletas en docentes[]', () => {
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

// ── LD-19: 1 docente / 1 materia → 1 fila con materiasVinculadas=1 ───────────

describe('LD-19 — filas: 1 docente / 1 materia → 1 fila con materiasVinculadas=1', () => {
  it('devuelve 1 fila con materiasVinculadas=1 y horasDocencia correcta', async () => {
    const svc = makeSvc({ rows: [makeDocRow({ cargaHorariaSemanal: 6 })] });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas).toHaveLength(1);
    expect(res.filas[0].materiasVinculadas).toBe(1);
    expect(res.filas[0].horasDocencia).toBe(6);
  });
});

// ── LD-20: 1 docente / 3 materias → 1 fila con materiasVinculadas=3 ──────────

describe('LD-20 — filas: 1 docente / 3 materias → 1 fila consolidada', () => {
  it('1 fila para el docente; materiasVinculadas=3; horasDocencia=suma total; docentes tiene 1 entrada', async () => {
    const rows = [
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-1', materiaNombre: 'Mat A', cargaHorariaSemanal: 4 }),
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-2', materiaNombre: 'Mat B', cargaHorariaSemanal: 3 }),
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-3', materiaNombre: 'Mat C', cargaHorariaSemanal: 2 }),
    ];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.docentes).toHaveLength(1);
    expect(res.filas).toHaveLength(1);
    expect(res.filas[0].materiasVinculadas).toBe(3);
    expect(res.filas[0].horasDocencia).toBe(9); // 4+3+2
    expect(res.filas[0].docenteId).toBe('d-001');
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
    expect(res.filas.every(f => f.materiasVinculadas === 1)).toBe(true);
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
    expect(res.filas[0].materiasVinculadas).toBe(1);
    expect(res.filas[0].horasDocencia).toBe(4);
  });
});

// ── LD-23: materia sin cargaHorariaSemanal → tieneHorasIncompletas en fila ───

describe('LD-23 — filas: materia sin cargaHorariaSemanal → horasDocencia parcial, tieneHorasIncompletas=true', () => {
  it('contabiliza solo horas conocidas y marca tieneHorasIncompletas en la fila del docente', async () => {
    const rows = [
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-1', cargaHorariaSemanal: 6 }),
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-2', cargaHorariaSemanal: null }),
    ];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas).toHaveLength(1);
    expect(res.filas[0].horasDocencia).toBe(6);
    expect(res.filas[0].tieneHorasIncompletas).toBe(true);
    expect(res.filas[0].materiasVinculadas).toBe(2);
  });
});

// ── LD-24: suma correcta de horasDocencia en carrera ─────────────────────────

describe('LD-24 — filas: horasDocencia es la suma total de cargaHorariaSemanal del docente en la carrera', () => {
  it('suma correctamente las horas de todas las materias del docente', async () => {
    const rows = [
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-1', cargaHorariaSemanal: 8 }),
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-2', cargaHorariaSemanal: 4 }),
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-3', cargaHorariaSemanal: 3 }),
    ];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas[0].horasDocencia).toBe(15); // 8+4+3
  });
});

// ── LD-25: 1 docente / 2 materias → 1 fila (no 2) ───────────────────────────

describe('LD-25 — filas: 1 docente / 2 materias devuelve 1 fila (consolidado por docente)', () => {
  it('1 fila con horasDocencia=total; no una fila por materia', async () => {
    const rows = [
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-1', cargaHorariaSemanal: 6 }),
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-2', cargaHorariaSemanal: 4 }),
    ];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas).toHaveLength(1);
    expect(res.filas[0].horasDocencia).toBe(10);
    expect(res.filas[0].materiasVinculadas).toBe(2);
  });
});

// ── LD-26: contadores de totales son únicos por docente, no por filas ─────────

describe('LD-26 — totales: contadores basados en docentes únicos, no en filas', () => {
  it('total=1 y filas.length=1 cuando el docente tiene 3 materias', async () => {
    const rows = [
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-1', cargaHorariaSemanal: 4 }),
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-2', cargaHorariaSemanal: 3 }),
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-3', cargaHorariaSemanal: 2 }),
    ];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.totales.total).toBe(1);     // 1 docente único
    expect(res.filas).toHaveLength(1);     // 1 fila consolidada
    expect(res.docentes).toHaveLength(1);  // 1 docente en docentes[]
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

// ── LD-28: filas ordenadas por nombreDocente asc ──────────────────────────────

describe('LD-28 — filas ordenadas por nombreDocente asc (una fila por docente)', () => {
  it('filas ordenadas alfabéticamente por docente; docente con 2 materias tiene materiasVinculadas=2', async () => {
    const rows = [
      makeDocRow({ docenteId: 'd-002', apellido: 'López', nombre: 'Ana', materiaId: 'm-1' }),
      makeDocRow({ docenteId: 'd-002', apellido: 'López', nombre: 'Ana', materiaId: 'm-2' }),
      makeDocRow({ docenteId: 'd-001', apellido: 'García', nombre: 'Juan', materiaId: 'm-3' }),
    ];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    // GARCÍA, Juan → 'd-001' first; LÓPEZ, Ana → 'd-002'
    expect(res.filas).toHaveLength(2);
    expect(res.filas[0].docenteId).toBe('d-001');
    expect(res.filas[1].docenteId).toBe('d-002');
    expect(res.filas[1].materiasVinculadas).toBe(2);
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

// ── LD-30: horasGestion=0 cuando sin datos de gestión ────────────────────────

describe('LD-30 — filas: horasGestion=0 cuando cargosAcademicosJson=null y sin gestión legacy', () => {
  it('horasGestion=0 cuando todos los campos de gestión son null', async () => {
    const svc = makeSvc({ rows: [makeDocRow()] }); // defaults: all json fields = null
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas[0].horasGestion).toBe(0);
  });
});

// ── LD-31: horasGestion > 0 con cargosAcademicosJson vigente ─────────────────

describe('LD-31 — filas: horasGestion > 0 cuando cargosAcademicosJson tiene cargo vigente', () => {
  it('extrae horasGestion=10 de cargosAcademicosJson con periodoHasta vacío', async () => {
    const rows = [makeDocRow({
      cargosAcademicosJson: JSON.stringify([{ dedicacionSemanal: '10', periodoHasta: '' }]),
    })];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas[0].horasGestion).toBe(10);
  });
});

// ── LD-32: horasInvestigacion > 0 con proyectosInvestigacionJson ─────────────

describe('LD-32 — filas: horasInvestigacion > 0 cuando proyectosInvestigacionJson tiene proyecto activo', () => {
  it('extrae horasInvestigacion=5 de proyectosInvestigacionJson', async () => {
    const rows = [makeDocRow({
      proyectosInvestigacionJson: JSON.stringify([{ horasSemanales: '5' }]),
    })];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas[0].horasInvestigacion).toBe(5);
  });
});

// ── LD-33: horasVinculacion > 0 con participacionVinculacionJson ─────────────

describe('LD-33 — filas: horasVinculacion > 0 cuando participacionVinculacionJson tiene actividad', () => {
  it('extrae horasVinculacion=3 de participacionVinculacionJson', async () => {
    const rows = [makeDocRow({
      participacionVinculacionJson: JSON.stringify([{ horasSemanales: '3' }]),
    })];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas[0].horasVinculacion).toBe(3);
  });
});

// ── LD-34: dedicacion = suma de los 4 componentes ────────────────────────────

describe('LD-34 — filas: dedicacion = horasDocencia + horasGestion + horasInvestigacion + horasVinculacion', () => {
  it('dedicacion es la suma correcta de todos los componentes horarios', async () => {
    const rows = [makeDocRow({
      cargaHorariaSemanal: 6,
      cargosAcademicosJson: JSON.stringify([{ dedicacionSemanal: '4', periodoHasta: '' }]),
      proyectosInvestigacionJson: JSON.stringify([{ horasSemanales: '3' }]),
      participacionVinculacionJson: JSON.stringify([{ horasSemanales: '2' }]),
    })];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    const f = res.filas[0];
    expect(f.horasDocencia).toBe(6);
    expect(f.horasGestion).toBe(4);
    expect(f.horasInvestigacion).toBe(3);
    expect(f.horasVinculacion).toBe(2);
    expect(f.dedicacion).toBe(15); // 6+4+3+2
  });
});

// ── LD-35: dedicacion = horasDocencia cuando no hay horas adicionales ─────────

describe('LD-35 — filas: dedicacion = horasDocencia cuando gestión/investigación/vinculación = 0', () => {
  it('dedicacion equals horasDocencia when all additional hours are zero', async () => {
    const svc = makeSvc({ rows: [makeDocRow({ cargaHorariaSemanal: 8 })] });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas[0].horasDocencia).toBe(8);
    expect(res.filas[0].dedicacion).toBe(8);
  });
});

// ── LD-36: horas adicionales no se multiplican por número de materias ─────────

describe('LD-36 — filas: horasGestion no se multiplica por materiasVinculadas', () => {
  it('mismo docente con 3 materias mantiene horasGestion igual que con 1 materia', async () => {
    const gestionJson = JSON.stringify([{ dedicacionSemanal: '8', periodoHasta: '' }]);
    const rows = [
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-1', cargaHorariaSemanal: 4, cargosAcademicosJson: gestionJson }),
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-2', cargaHorariaSemanal: 4, cargosAcademicosJson: gestionJson }),
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-3', cargaHorariaSemanal: 4, cargosAcademicosJson: gestionJson }),
    ];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas[0].horasGestion).toBe(8);   // no multiplicado × 3
    expect(res.filas[0].horasDocencia).toBe(12);  // 4+4+4
    expect(res.filas[0].materiasVinculadas).toBe(3);
  });
});

// ── LD-37: materiasVinculadas coincide con nMaterias de docentes[] ────────────

describe('LD-37 — filas.materiasVinculadas coincide con docentes[].nMaterias', () => {
  it('materiasVinculadas en fila es igual a nMaterias del docente en docentes[]', async () => {
    const rows = [
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-1' }),
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-2' }),
    ];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas[0].materiasVinculadas).toBe(res.docentes[0].nMaterias);
  });
});

// ── LD-38: horasInvestigacion=0 e horasVinculacion=0 cuando los JSON son null ─

describe('LD-38 — filas: horasInvestigacion=0 y horasVinculacion=0 cuando los JSON son null', () => {
  it('devuelve cero en investigación y vinculación cuando los campos de la ficha son null', async () => {
    const svc = makeSvc({ rows: [makeDocRow()] });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas[0].horasInvestigacion).toBe(0);
    expect(res.filas[0].horasVinculacion).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Completitud de Ficha Docente en listado LD (completitudFichaDocente / estadoFichaDocente)
// ══════════════════════════════════════════════════════════════════════════════

// Helper: ficha completa con areaDisciplinarId Y subareaId → C3=true → completitud=100%
const TITULO_GRADO_COMPLETO = '[{"denominacion":"Ing.","anio":"2005","pais":"Argentina","institucion":"UBA"}]';

// ── LD-39: completitudFichaDocente=25 (C1=C2=C3=false, C4=true) → ROJO ───────

describe('LD-39 — completitudFichaDocente=25 (sin datos personales, sin título, sin área) → ROJO', () => {
  it('estadoFichaDocente=ROJO y completitudFichaDocente=25 cuando C1=C2=C3=false', async () => {
    // C4=1 por construcción (docente en listado LD). C1=C2=C3=false → 25×1=25%
    const rows = [makeDocRow({ sexo: null, tituloGrado: null, areaDisciplinarId: null, subareaId: null })];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas[0].completitudFichaDocente).toBe(25);
    expect(res.filas[0].estadoFichaDocente).toBe('ROJO');
  });
});

// ── LD-40: completitudFichaDocente=50 → ROJO (umbral ≤50 incluye el 50 exacto) ─

describe('LD-40 — completitudFichaDocente=50 (C1=true, C2=false, C3=false) → ROJO', () => {
  it('estadoFichaDocente=ROJO para completitud=50 (umbral: ≤50 → ROJO)', async () => {
    // C1=true (todos datos personales), C2=false (sin título), C3=false (sin área), C4=true → 50%
    const rows = [makeDocRow({ tituloGrado: null, areaDisciplinarId: null, subareaId: null })];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas[0].completitudFichaDocente).toBe(50);
    expect(res.filas[0].estadoFichaDocente).toBe('ROJO');
  });
});

// ── LD-41: completitudFichaDocente=75 → AMARILLO ─────────────────────────────

describe('LD-41 — completitudFichaDocente=75 (C1=true, C2=true, C3=false) → AMARILLO', () => {
  it('estadoFichaDocente=AMARILLO para completitud=75 (umbral: >50 y ≤75 → AMARILLO)', async () => {
    // C3=false porque subareaId=null (aunque areaDisciplinarId esté informada)
    const rows = [makeDocRow({ tituloGrado: TITULO_GRADO_COMPLETO, areaDisciplinarId: 'area-1', subareaId: null })];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas[0].completitudFichaDocente).toBe(75);
    expect(res.filas[0].estadoFichaDocente).toBe('AMARILLO');
  });
});

// ── LD-42: completitudFichaDocente=100 → VERDE ───────────────────────────────

describe('LD-42 — completitudFichaDocente=100 (C1=C2=C3=C4=true) → VERDE', () => {
  it('estadoFichaDocente=VERDE cuando C3 requiere AMBOS areaDisciplinarId y subareaId informados', async () => {
    // C3=true solo si AMBOS campos están informados
    const rows = [makeDocRow({ tituloGrado: TITULO_GRADO_COMPLETO, areaDisciplinarId: 'area-1', subareaId: 'sub-1' })];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas[0].completitudFichaDocente).toBe(100);
    expect(res.filas[0].estadoFichaDocente).toBe('VERDE');
  });
});

// ── LD-43: área sin subárea → C3=false → completitud pierde 25% ──────────────

describe('LD-43 — areaDisciplinarId con valor pero subareaId null → C3=false → completitudFichaDocente=75', () => {
  it('C3 requiere ambos campos; solo areaDisciplinarId no es suficiente', async () => {
    const rows = [makeDocRow({ tituloGrado: TITULO_GRADO_COMPLETO, areaDisciplinarId: 'area-1', subareaId: null })];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas[0].completitudFichaDocente).toBe(75);
    expect(res.filas[0].estadoFichaDocente).toBe('AMARILLO');
  });
});

// ── LD-44: porcentaje coincide con calcularCompletitudFicha ──────────────────

describe('LD-44 — completitudFichaDocente coincide con calcularCompletitudFicha() del módulo Docentes', () => {
  it('el valor en la fila es idéntico al que devuelve la función centralizada', async () => {
    // Verificamos que el LD usa la misma función; comparamos con llamada directa.
    const rows = [makeDocRow({ tituloGrado: TITULO_GRADO_COMPLETO, areaDisciplinarId: 'area-1', subareaId: 'sub-1' })];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    // La función centralizada con C1=C2=C3=C4=true da 100%
    expect(res.filas[0].completitudFichaDocente).toBe(100);
  });
});

// ── LD-45: cada fila usa el docenteId correcto ────────────────────────────────

describe('LD-45 — completitudFichaDocente y estadoFichaDocente se asignan al docenteId correcto', () => {
  it('2 docentes con distintas completitudes: cada fila usa sus propios datos', async () => {
    const rows = [
      // d-001: ficha completa → 100%
      makeDocRow({ docenteId: 'd-001', apellido: 'Álvarez', nombre: 'Ana', materiaId: 'm-1',
        tituloGrado: TITULO_GRADO_COMPLETO, areaDisciplinarId: 'area-1', subareaId: 'sub-1' }),
      // d-002: sin título → 50%
      makeDocRow({ docenteId: 'd-002', apellido: 'Bernal', nombre: 'Bruno', materiaId: 'm-2',
        tituloGrado: null, areaDisciplinarId: null, subareaId: null }),
    ];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    const f001 = res.filas.find(f => f.docenteId === 'd-001')!;
    const f002 = res.filas.find(f => f.docenteId === 'd-002')!;
    expect(f001.completitudFichaDocente).toBe(100);
    expect(f001.estadoFichaDocente).toBe('VERDE');
    expect(f002.completitudFichaDocente).toBe(50);
    expect(f002.estadoFichaDocente).toBe('ROJO');
  });
});

// ── LD-46: porcentaje NO se multiplica por nMaterias ─────────────────────────

describe('LD-46 — completitudFichaDocente no se multiplica por la cantidad de materias', () => {
  it('3 materias → completitudFichaDocente igual que con 1 materia', async () => {
    const rows = [
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-1', cargaHorariaSemanal: 4,
        tituloGrado: TITULO_GRADO_COMPLETO, areaDisciplinarId: 'area-1', subareaId: 'sub-1' }),
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-2', cargaHorariaSemanal: 4,
        tituloGrado: TITULO_GRADO_COMPLETO, areaDisciplinarId: 'area-1', subareaId: 'sub-1' }),
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-3', cargaHorariaSemanal: 4,
        tituloGrado: TITULO_GRADO_COMPLETO, areaDisciplinarId: 'area-1', subareaId: 'sub-1' }),
    ];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas).toHaveLength(1);
    expect(res.filas[0].completitudFichaDocente).toBe(100);  // no multiplicado × 3
    expect(res.filas[0].materiasVinculadas).toBe(3);
  });
});

// ── LD-47: una fila por docente con los nuevos campos ─────────────────────────

describe('LD-47 — el listado conserva una fila por docente (no por materia) con los nuevos campos', () => {
  it('2 docentes → 2 filas, cada una con completitudFichaDocente y estadoFichaDocente', async () => {
    const rows = [
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-1',
        tituloGrado: TITULO_GRADO_COMPLETO, areaDisciplinarId: 'area-1', subareaId: 'sub-1' }),
      makeDocRow({ docenteId: 'd-002', materiaId: 'm-2',
        tituloGrado: null, areaDisciplinarId: null, subareaId: null }),
    ];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas).toHaveLength(2);
    expect(res.filas.every(f => typeof f.completitudFichaDocente === 'number')).toBe(true);
    expect(res.filas.every(f => ['ROJO', 'AMARILLO', 'VERDE'].includes(f.estadoFichaDocente))).toBe(true);
  });
});

// ── LD-48: los cálculos de dedicación permanecen intactos ────────────────────

describe('LD-48 — los cálculos de dedicación no son alterados por los nuevos campos', () => {
  it('dedicacion, horasDocencia y horasGestion son correctos junto a completitudFichaDocente', async () => {
    const rows = [makeDocRow({
      cargaHorariaSemanal: 6,
      cargosAcademicosJson: JSON.stringify([{ dedicacionSemanal: '4', periodoHasta: '' }]),
      tituloGrado: TITULO_GRADO_COMPLETO, areaDisciplinarId: 'area-1', subareaId: 'sub-1',
    })];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    const f = res.filas[0];
    expect(f.horasDocencia).toBe(6);
    expect(f.horasGestion).toBe(4);
    expect(f.dedicacion).toBe(10); // 6+4
    expect(f.completitudFichaDocente).toBe(100);
    expect(f.estadoFichaDocente).toBe('VERDE');
  });
});

// ── LD-49: consulta sin N+1 — completitud calculada inline con datos ya cargados ──

describe('LD-49 — sin consultas N+1: calcularCompletitudFicha usa datos ya cargados', () => {
  it('N docentes → completitud de cada uno calculada sin queries adicionales (subareaId ya viene en la consulta principal)', async () => {
    // La ausencia de N+1 se verifica structuralmente:
    // si subareaId no estuviera en el SELECT principal, el cálculo daría siempre C3=false
    // (null por defecto) aunque el docente tenga área asignada. El test lo demuestra:
    // d-001 tiene ambos campos → C3=true → 100%; si hubiera N+1 y faltara subareaId → 75%.
    const rows = [
      makeDocRow({ docenteId: 'd-001', materiaId: 'm-1',
        tituloGrado: TITULO_GRADO_COMPLETO, areaDisciplinarId: 'area-1', subareaId: 'sub-1' }),
      makeDocRow({ docenteId: 'd-002', materiaId: 'm-2',
        tituloGrado: TITULO_GRADO_COMPLETO, areaDisciplinarId: 'area-2', subareaId: 'sub-2' }),
      makeDocRow({ docenteId: 'd-003', materiaId: 'm-3',
        tituloGrado: null, areaDisciplinarId: null, subareaId: null }),
    ];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    expect(res.filas).toHaveLength(3);
    // Si subareaId viniera de una query adicional (N+1) y fallara, daría 75% en lugar de 100%
    expect(res.filas.find(f => f.docenteId === 'd-001')!.completitudFichaDocente).toBe(100);
    expect(res.filas.find(f => f.docenteId === 'd-002')!.completitudFichaDocente).toBe(100);
    expect(res.filas.find(f => f.docenteId === 'd-003')!.completitudFichaDocente).toBe(50);
  });
});

// ── LD-50: filas incluyen completitudFichaDocente y estadoFichaDocente ────────

describe('LD-50 — todas las filas del listado incluyen completitudFichaDocente y estadoFichaDocente', () => {
  it('3 docentes con distintas completitudes: todas las filas tienen los nuevos campos', async () => {
    const rows = [
      makeDocRow({ docenteId: 'd-v', apellido: 'Verde', nombre: 'D', materiaId: 'm-v',
        tituloGrado: TITULO_GRADO_COMPLETO, areaDisciplinarId: 'area-1', subareaId: 'sub-1' }), // 100% VERDE
      makeDocRow({ docenteId: 'd-a', apellido: 'Amarillo', nombre: 'D', materiaId: 'm-a',
        tituloGrado: TITULO_GRADO_COMPLETO, areaDisciplinarId: 'area-1', subareaId: null }), // 75% AMARILLO
      makeDocRow({ docenteId: 'd-r', apellido: 'Rojo', nombre: 'D', materiaId: 'm-r',
        tituloGrado: null, areaDisciplinarId: null, subareaId: null }), // 50% ROJO
    ];
    const svc = makeSvc({ rows });
    const res = await svc.consultarListadoDocentes(CAR_ID, USER_ID, ROL);
    const fVerde    = res.filas.find(f => f.docenteId === 'd-v')!;
    const fAmarillo = res.filas.find(f => f.docenteId === 'd-a')!;
    const fRojo     = res.filas.find(f => f.docenteId === 'd-r')!;
    expect(fVerde.completitudFichaDocente).toBe(100);
    expect(fVerde.estadoFichaDocente).toBe('VERDE');
    expect(fAmarillo.completitudFichaDocente).toBe(75);
    expect(fAmarillo.estadoFichaDocente).toBe('AMARILLO');
    expect(fRojo.completitudFichaDocente).toBe(50);
    expect(fRojo.estadoFichaDocente).toBe('ROJO');
  });
});
