import { BadRequestException } from '@nestjs/common';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type {
  DocenteVigenteR03,
  DocentesParaR03,
  ConfigFacultadAut,
} from '../consultas-academicas/consultas-academicas.types';
import type { ContextoEvaluacion } from './indicadores.types';
import { R10EvaluadorService, type ResultadoR10 } from './r10.evaluador';

// ── Constantes ────────────────────────────────────────────────────────────────

const USR      = 'usr-01';
const CAR_ID   = 'car-01';
const FAC_ID   = 'fac-01';
const FECHA    = new Date('2026-10-20T12:00:00.000Z');
const ADMIN    = 'ADMINISTRADOR_SISTEMA';
const DIRECTOR = 'DIRECTOR_CARRERA';

// ── Helpers ───────────────────────────────────────────────────────────────────

function mkCtx(overrides: Partial<ContextoEvaluacion> = {}): ContextoEvaluacion {
  return { usuarioId: USR, rolNombre: ADMIN, carreraId: CAR_ID, fechaEvaluacion: FECHA, ...overrides };
}

function mkDocente(overrides: Partial<DocenteVigenteR03> = {}): DocenteVigenteR03 {
  return {
    docenteId: 'doc-1',
    nombre: 'Ana',
    apellido: 'García',
    horasDocenciaConocidas: 0,
    tieneMateriaSinHoras: false,
    tiempoDedicacionGestionSemanal: null,
    fechaFinGestion: null,
    desempenoActualJson: null,
    ...overrides,
  };
}

function mkData(overrides: Partial<DocentesParaR03> = {}): DocentesParaR03 {
  return {
    docentes: [],
    facultadId: FAC_ID,
    alcanceFacultad: true,
    docentesMultiFacultad: new Set(),
    ...overrides,
  };
}

function mkConfig(overrides: Partial<ConfigFacultadAut> = {}): ConfigFacultadAut {
  return { facultadId: FAC_ID, p01TopeH: 60, p02BajaH: 10, p03MaxMat: 5, updatedAt: new Date(), ...overrides };
}

function makeSvc(data: DocentesParaR03, config: ConfigFacultadAut | null) {
  const consultas = {
    obtenerDocentesParaR03: jest.fn().mockResolvedValue(data),
    obtenerConfigDeCarrera: jest.fn().mockResolvedValue(config),
  };
  return { svc: new R10EvaluadorService(consultas as any), consultas };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('R10EvaluadorService', () => {
  it('TC-01: lanza BadRequestException cuando carreraId está ausente', async () => {
    const { svc } = makeSvc(mkData(), null);
    await expect(svc.evaluar(mkCtx({ carreraId: undefined }))).rejects.toThrow(BadRequestException);
  });

  it('TC-02: NO_APLICA cuando no hay docentes activos en el scope', async () => {
    const { svc } = makeSvc(mkData({ docentes: [] }), mkConfig());
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR10;
    expect(r.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    expect(v.totalDocentes).toBe(0);
    expect(v.enAlerta).toHaveLength(0);
  });

  it('TC-03: CALCULADO con alcanceFacultad=true y datos completos', async () => {
    const data = mkData({
      docentes: [mkDocente({ horasDocenciaConocidas: 15, tieneMateriaSinHoras: false })],
    });
    const { svc } = makeSvc(data, mkConfig({ p02BajaH: 20 }));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR10;
    expect(r.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect(v.totalEnAlerta).toBe(1);
    expect(v.enAlerta[0].incierto).toBe(false);
  });

  it('TC-04: PARCIAL cuando alcanceFacultad=false (DIRECTOR_CARRERA)', async () => {
    const data = mkData({
      alcanceFacultad: false,
      docentes: [mkDocente({ horasDocenciaConocidas: 25 })],
    });
    const { svc } = makeSvc(data, mkConfig());
    const r = await svc.evaluar(mkCtx({ rolNombre: DIRECTOR }));
    expect(r.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
  });

  it('TC-05: PARCIAL cuando hay materias sin horas (tieneMateriaSinHoras=true)', async () => {
    const data = mkData({
      docentes: [mkDocente({ horasDocenciaConocidas: 5, tieneMateriaSinHoras: true })],
    });
    const { svc } = makeSvc(data, mkConfig({ p02BajaH: 20 }));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR10;
    expect(r.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
    expect(v.enAlerta[0].incierto).toBe(true);
    expect(r.datosFaltantes).toHaveLength(1);
  });

  it('TC-06: umbral por defecto es 20 cuando config es null', async () => {
    const data = mkData({ docentes: [mkDocente({ horasDocenciaConocidas: 15 })] });
    const { svc } = makeSvc(data, null);
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR10;
    expect(v.umbral).toBe(20);
    expect(v.enAlerta[0].umbral).toBe(20);
  });

  it('TC-07: umbral personalizado desde config (p02BajaH)', async () => {
    const data = mkData({ docentes: [mkDocente({ horasDocenciaConocidas: 12 })] });
    const { svc } = makeSvc(data, mkConfig({ p02BajaH: 15 }));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR10;
    expect(v.umbral).toBe(15);
    expect(v.totalEnAlerta).toBe(1);
  });

  it('TC-08: incierto=true para docente cross-facultad; PARCIAL por docentesMultiFacultad', async () => {
    const data = mkData({
      docentes: [mkDocente({ docenteId: 'doc-x', horasDocenciaConocidas: 8 })],
      docentesMultiFacultad: new Set(['doc-x']),
    });
    const { svc } = makeSvc(data, mkConfig({ p02BajaH: 20 }));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR10;
    expect(v.enAlerta[0].incierto).toBe(true);
    expect(v.totalInciertos).toBe(1);
    expect(v.totalEnAlerta).toBe(0);
    expect(r.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
  });

  it('TC-09: enAlerta ordenado ASC por horasConocidas', async () => {
    const data = mkData({
      docentes: [
        mkDocente({ docenteId: 'doc-a', horasDocenciaConocidas: 12 }),
        mkDocente({ docenteId: 'doc-b', horasDocenciaConocidas: 5 }),
        mkDocente({ docenteId: 'doc-c', horasDocenciaConocidas: 9 }),
      ],
    });
    const { svc } = makeSvc(data, mkConfig({ p02BajaH: 20 }));
    const r = await svc.evaluar(mkCtx());
    const horas = (r.valor as ResultadoR10).enAlerta.map((a) => a.horasConocidas);
    expect(horas).toEqual([5, 9, 12]);
  });

  it('TC-10: totalEnAlerta e totalInciertos se cuentan por separado', async () => {
    const data = mkData({
      docentes: [
        mkDocente({ docenteId: 'doc-a', horasDocenciaConocidas: 5, tieneMateriaSinHoras: false }),
        mkDocente({ docenteId: 'doc-b', horasDocenciaConocidas: 8, tieneMateriaSinHoras: true }),
      ],
    });
    const { svc } = makeSvc(data, mkConfig({ p02BajaH: 20 }));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR10;
    expect(v.totalEnAlerta).toBe(1);
    expect(v.totalInciertos).toBe(1);
    expect(v.enAlerta).toHaveLength(2);
  });

  it('TC-11: docente con horas === umbral no entra en alerta (comparación estricta <)', async () => {
    const data = mkData({
      docentes: [mkDocente({ horasDocenciaConocidas: 20 })],
    });
    const { svc } = makeSvc(data, mkConfig({ p02BajaH: 20 }));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR10;
    expect(v.enAlerta).toHaveLength(0);
    expect(r.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
  });

  it('TC-12: PARCIAL cuando docentesMultiFacultad no vacío aunque docente no esté en alerta', async () => {
    const data = mkData({
      docentes: [mkDocente({ docenteId: 'doc-y', horasDocenciaConocidas: 25 })],
      docentesMultiFacultad: new Set(['doc-y']),
    });
    const { svc } = makeSvc(data, mkConfig({ p02BajaH: 20 }));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR10;
    expect(r.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
    expect(v.enAlerta).toHaveLength(0);
  });
});
