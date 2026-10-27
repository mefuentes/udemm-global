import { BadRequestException } from '@nestjs/common';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type {
  DocenteVigenteR10,
  DocentesParaR10,
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

function mkDocente(overrides: Partial<DocenteVigenteR10> = {}): DocenteVigenteR10 {
  return {
    docenteId: 'doc-1',
    nombre: 'Ana',
    apellido: 'García',
    horasDocenciaConocidas: 0,
    tieneMateriaSinHoras: false,
    tiempoDedicacionGestionSemanal: null,
    fechaFinGestion: null,
    funcionGestion: null,
    desempenoActualJson: null,
    tiempoInvestigacion: null,
    tituloProyectoInvestigacion: null,
    fechaFinProyectoInvestigacion: null,
    tiempoExtension: null,
    rolActividadExtension: null,
    finEstadoActividadExtension: null,
    ...overrides,
  };
}

function mkData(overrides: Partial<DocentesParaR10> = {}): DocentesParaR10 {
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

function makeSvc(data: DocentesParaR10, config: ConfigFacultadAut | null) {
  const consultas = {
    obtenerDocentesParaR10: jest.fn().mockResolvedValue(data),
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

  it('TC-10: totalEnAlerta y totalInciertos se cuentan por separado', async () => {
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

  // ── FSD §6: fórmula correcta docencia + gestión + investigación + vinculación ─

  it('TC-13: docencia + gestión + investigación + vinculación sacan al docente del umbral', async () => {
    const data = mkData({
      docentes: [
        mkDocente({
          horasDocenciaConocidas: 6,
          tiempoDedicacionGestionSemanal: '4',
          tiempoInvestigacion: '5',
          tiempoExtension: '6',
        }),
      ],
    });
    const { svc } = makeSvc(data, mkConfig({ p02BajaH: 20 }));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR10;
    // 6 + 4 + 5 + 6 = 21 ≥ 20 → sin alerta
    expect(v.enAlerta).toHaveLength(0);
    expect(r.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
  });

  it('TC-14: investigación "0" explícito → horas=0, no indeterminado → incierto=false', async () => {
    const data = mkData({
      docentes: [mkDocente({ horasDocenciaConocidas: 5, tiempoInvestigacion: '0' })],
    });
    const { svc } = makeSvc(data, mkConfig({ p02BajaH: 20 }));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR10;
    expect(v.enAlerta).toHaveLength(1);
    expect(v.enAlerta[0].incierto).toBe(false);
    expect(v.enAlerta[0].componentes.horasInvestigacion).toBe(0);
    expect(v.enAlerta[0].componentes.investigacionIndeterminada).toBe(false);
    expect(r.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
  });

  it('TC-15: investigación null sin actividad declarada → 0h, no indeterminado', async () => {
    const data = mkData({
      docentes: [mkDocente({
        horasDocenciaConocidas: 5,
        tiempoInvestigacion: null,
        tituloProyectoInvestigacion: null, // sin actividad declarada
      })],
    });
    const { svc } = makeSvc(data, mkConfig({ p02BajaH: 20 }));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR10;
    expect(v.enAlerta[0].componentes.horasInvestigacion).toBe(0);
    expect(v.enAlerta[0].componentes.investigacionIndeterminada).toBe(false);
    expect(v.enAlerta[0].incierto).toBe(false);
  });

  it('TC-16: investigación con valor no numérico → investigacionIndeterminada=true → incierto=true, PARCIAL', async () => {
    const data = mkData({
      docentes: [
        mkDocente({ horasDocenciaConocidas: 5, tiempoInvestigacion: 'N/A' }),
      ],
    });
    const { svc } = makeSvc(data, mkConfig({ p02BajaH: 20 }));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR10;
    expect(v.enAlerta).toHaveLength(1);
    expect(v.enAlerta[0].incierto).toBe(true);
    expect(v.enAlerta[0].componentes.investigacionIndeterminada).toBe(true);
    expect(v.enAlerta[0].componentes.horasInvestigacion).toBe(0);
    expect(r.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
    expect(r.datosFaltantes).toHaveLength(1);
  });

  it('TC-17: proyecto investigación declarado (tituloProyectoInvestigacion) sin horas → INDETERMINADO (FSD §3)', async () => {
    const data = mkData({
      docentes: [
        mkDocente({
          horasDocenciaConocidas: 8,
          tiempoInvestigacion: null,
          tituloProyectoInvestigacion: 'Proyecto IA aplicada',
        }),
      ],
    });
    const { svc } = makeSvc(data, mkConfig({ p02BajaH: 20 }));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR10;
    expect(v.enAlerta[0].incierto).toBe(true);
    expect(v.enAlerta[0].componentes.investigacionIndeterminada).toBe(true);
    expect(r.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
  });

  it('TC-18: combinación — docencia + investigación + vinculación suma exacta al umbral → no entra', async () => {
    const data = mkData({
      docentes: [
        mkDocente({
          horasDocenciaConocidas: 10,
          tiempoInvestigacion: '6',
          tiempoExtension: '4',
        }),
      ],
    });
    const { svc } = makeSvc(data, mkConfig({ p02BajaH: 20 }));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR10;
    // 10 + 0 + 6 + 4 = 20 → no estrictamente menor
    expect(v.enAlerta).toHaveLength(0);
    expect(r.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
  });

  it('TC-19: componentes refleja los cuatro valores (docencia+gestión+inv+vin) en entrada de alerta', async () => {
    const data = mkData({
      docentes: [
        mkDocente({
          horasDocenciaConocidas: 3,
          tiempoDedicacionGestionSemanal: '2',
          tiempoInvestigacion: '2',
          tiempoExtension: '1',
        }),
      ],
    });
    const { svc } = makeSvc(data, mkConfig({ p02BajaH: 20 }));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR10;
    // 3 + 2 + 2 + 1 = 8 < 20 → en alerta
    expect(v.enAlerta).toHaveLength(1);
    const comp = v.enAlerta[0].componentes;
    expect(comp.horasDocencia).toBe(3);
    expect(comp.horasGestion).toBe(2);
    expect(comp.horasInvestigacion).toBe(2);
    expect(comp.horasVinculacion).toBe(1);
    expect(comp.gestionIndeterminada).toBe(false);
    expect(comp.investigacionIndeterminada).toBe(false);
    expect(comp.vinculacionIndeterminada).toBe(false);
    expect(v.enAlerta[0].horasConocidas).toBe(8);
    expect(v.enAlerta[0].incierto).toBe(false);
  });

  it('TC-20: vinculación con actividad declarada (rolActividadExtension) sin horas → INDETERMINADO (FSD §3)', async () => {
    const data = mkData({
      docentes: [
        mkDocente({
          horasDocenciaConocidas: 6,
          tiempoExtension: null,
          rolActividadExtension: 'Coordinador extensión',
        }),
      ],
    });
    const { svc } = makeSvc(data, mkConfig({ p02BajaH: 20 }));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR10;
    expect(v.enAlerta[0].incierto).toBe(true);
    expect(v.enAlerta[0].componentes.vinculacionIndeterminada).toBe(true);
    expect(r.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
  });
});
