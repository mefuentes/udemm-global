import { BadRequestException } from '@nestjs/common';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type {
  DocenteVigenteR10,
  DocentesParaR10,
  ConfigFacultadAut,
} from '../consultas-academicas/consultas-academicas.types';
import type { ContextoEvaluacion } from './indicadores.types';
import {
  R10EvaluadorService,
  parsearOtrasDedicaciones,
  parsearProyectosInvestigacion,
  parsearParticipacionVinculacion,
  tieneProyectoInvestigacion,
  tieneVinculacionConHoras,
  type ResultadoR10,
} from './r10.evaluador';

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
    cargosAcademicosJson: null,
    otrasDedicacionesJson: null,
    proyectosInvestigacionJson: null,
    participacionVinculacionJson: null,
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

  // ── FSD §6: fórmula correcta — DEDICACIÓN TOTAL = docencia + gestión + otras + investigación + vinculación ─

  it('TC-13: docencia + gestión + otras + investigación + vinculación suman al docente fuera del umbral', async () => {
    const data = mkData({
      docentes: [
        mkDocente({
          horasDocenciaConocidas: 6,
          tiempoDedicacionGestionSemanal: '4',
          otrasDedicacionesJson: JSON.stringify([{ horasSeman: '3' }]),
          proyectosInvestigacionJson: JSON.stringify([{ titulo: 'IA', horasSemanales: '4' }]),
          participacionVinculacionJson: JSON.stringify([{ actividad: 'Ext', horasSemanales: '4' }]),
        }),
      ],
    });
    const { svc } = makeSvc(data, mkConfig({ p02BajaH: 20 }));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR10;
    // 6 + 4 + 3 + 4 + 4 = 21 ≥ 20 → sin alerta
    expect(v.enAlerta).toHaveLength(0);
    expect(r.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
  });

  it('TC-14: investigación "0" explícito → horas=0, no indeterminado → incierto=false', async () => {
    const data = mkData({
      docentes: [mkDocente({
        horasDocenciaConocidas: 5,
        proyectosInvestigacionJson: JSON.stringify([{ titulo: 'IA', horasSemanales: '0' }]),
      })],
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

  it('TC-15: proyectosInvestigacionJson null (sin proyectos) → 0h, no indeterminado', async () => {
    const data = mkData({
      docentes: [mkDocente({
        horasDocenciaConocidas: 5,
        proyectosInvestigacionJson: null,
      })],
    });
    const { svc } = makeSvc(data, mkConfig({ p02BajaH: 20 }));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR10;
    expect(v.enAlerta[0].componentes.horasInvestigacion).toBe(0);
    expect(v.enAlerta[0].componentes.investigacionIndeterminada).toBe(false);
    expect(v.enAlerta[0].incierto).toBe(false);
  });

  it('TC-16: proyecto con horasSemanales no numérico → investigacionIndeterminada=true → incierto=true, PARCIAL', async () => {
    const data = mkData({
      docentes: [
        mkDocente({
          horasDocenciaConocidas: 5,
          proyectosInvestigacionJson: JSON.stringify([{ titulo: 'X', horasSemanales: 'N/A' }]),
        }),
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

  it('TC-17: proyecto declarado con horasSemanales vacío → INDETERMINADO (FSD §3)', async () => {
    const data = mkData({
      docentes: [
        mkDocente({
          horasDocenciaConocidas: 8,
          proyectosInvestigacionJson: JSON.stringify([{ titulo: 'IA aplicada', horasSemanales: '' }]),
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
          proyectosInvestigacionJson: JSON.stringify([{ titulo: 'X', horasSemanales: '6' }]),
          participacionVinculacionJson: JSON.stringify([{ actividad: 'Y', horasSemanales: '4' }]),
        }),
      ],
    });
    const { svc } = makeSvc(data, mkConfig({ p02BajaH: 20 }));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR10;
    // 10 + 0 + 0 + 6 + 4 = 20 → no estrictamente menor
    expect(v.enAlerta).toHaveLength(0);
    expect(r.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
  });

  it('TC-19: componentes refleja los cinco valores (docencia+gestión+otras+inv+vin) en entrada de alerta', async () => {
    const data = mkData({
      docentes: [
        mkDocente({
          horasDocenciaConocidas: 3,
          tiempoDedicacionGestionSemanal: '2',
          otrasDedicacionesJson: JSON.stringify([{ horasSeman: '1' }]),
          proyectosInvestigacionJson: JSON.stringify([{ titulo: 'X', horasSemanales: '2' }]),
          participacionVinculacionJson: JSON.stringify([{ actividad: 'Y', horasSemanales: '1' }]),
        }),
      ],
    });
    const { svc } = makeSvc(data, mkConfig({ p02BajaH: 20 }));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR10;
    // 3 + 2 + 1 + 2 + 1 = 9 < 20 → en alerta
    expect(v.enAlerta).toHaveLength(1);
    const comp = v.enAlerta[0].componentes;
    expect(comp.horasDocencia).toBe(3);
    expect(comp.horasGestion).toBe(2);
    expect(comp.horasOtrasDedicaciones).toBe(1);
    expect(comp.horasInvestigacion).toBe(2);
    expect(comp.horasVinculacion).toBe(1);
    expect(comp.gestionIndeterminada).toBe(false);
    expect(comp.otrasDedicacionesIndeterminadas).toBe(false);
    expect(comp.investigacionIndeterminada).toBe(false);
    expect(comp.vinculacionIndeterminada).toBe(false);
    expect(v.enAlerta[0].horasConocidas).toBe(9);
    expect(v.enAlerta[0].incierto).toBe(false);
  });

  it('TC-20: vinculación con horasSemanales vacío → vinculacionIndeterminada=true, PARCIAL (FSD §3)', async () => {
    const data = mkData({
      docentes: [
        mkDocente({
          horasDocenciaConocidas: 6,
          participacionVinculacionJson: JSON.stringify([{ actividad: 'Coordinación', horasSemanales: '' }]),
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

  // ── Parsers de JSON — tests unitarios ─────────────────────────────────────────

  describe('parsearOtrasDedicaciones', () => {
    it('null → {horas:0, indeterminado:false}', () => {
      expect(parsearOtrasDedicaciones(null)).toEqual({ horas: 0, indeterminado: false });
    });
    it('array vacío → {horas:0, indeterminado:false}', () => {
      expect(parsearOtrasDedicaciones('[]')).toEqual({ horas: 0, indeterminado: false });
    });
    it('suma ítems numéricos', () => {
      const json = JSON.stringify([{ horasSeman: '3' }, { horasSeman: '2' }]);
      expect(parsearOtrasDedicaciones(json)).toEqual({ horas: 5, indeterminado: false });
    });
    it('ítem con horasSeman vacío → indeterminado=true', () => {
      const json = JSON.stringify([{ horasSeman: '' }]);
      expect(parsearOtrasDedicaciones(json)).toEqual({ horas: 0, indeterminado: true });
    });
    it('JSON inválido → {horas:0, indeterminado:false}', () => {
      expect(parsearOtrasDedicaciones('no-json')).toEqual({ horas: 0, indeterminado: false });
    });
  });

  describe('parsearProyectosInvestigacion', () => {
    it('null → {horas:0, indeterminado:false}', () => {
      expect(parsearProyectosInvestigacion(null)).toEqual({ horas: 0, indeterminado: false });
    });
    it('suma ítems numéricos', () => {
      const json = JSON.stringify([{ horasSemanales: '8' }, { horasSemanales: '4' }]);
      expect(parsearProyectosInvestigacion(json)).toEqual({ horas: 12, indeterminado: false });
    });
    it('ítem con horasSemanales vacío → indeterminado=true', () => {
      const json = JSON.stringify([{ titulo: 'X', horasSemanales: '' }]);
      expect(parsearProyectosInvestigacion(json)).toEqual({ horas: 0, indeterminado: true });
    });
    it('"0" explícito → horas=0, no indeterminado', () => {
      const json = JSON.stringify([{ horasSemanales: '0' }]);
      expect(parsearProyectosInvestigacion(json)).toEqual({ horas: 0, indeterminado: false });
    });
  });

  describe('parsearParticipacionVinculacion', () => {
    it('null → {horas:0, indeterminado:false}', () => {
      expect(parsearParticipacionVinculacion(null)).toEqual({ horas: 0, indeterminado: false });
    });
    it('suma ítems numéricos', () => {
      const json = JSON.stringify([{ horasSemanales: '5' }, { horasSemanales: '3' }]);
      expect(parsearParticipacionVinculacion(json)).toEqual({ horas: 8, indeterminado: false });
    });
    it('ítem no numérico → indeterminado=true', () => {
      const json = JSON.stringify([{ horasSemanales: 'parcial' }]);
      expect(parsearParticipacionVinculacion(json)).toEqual({ horas: 0, indeterminado: true });
    });
  });

  describe('tieneProyectoInvestigacion', () => {
    it('null → false', () => expect(tieneProyectoInvestigacion(null)).toBe(false));
    it('array vacío → false', () => expect(tieneProyectoInvestigacion('[]')).toBe(false));
    it('un ítem → true', () => {
      expect(tieneProyectoInvestigacion(JSON.stringify([{ titulo: 'X' }]))).toBe(true);
    });
  });

  describe('tieneVinculacionConHoras', () => {
    it('null → false', () => expect(tieneVinculacionConHoras(null)).toBe(false));
    it('"0" → false (no tiene horas > 0)', () => {
      expect(tieneVinculacionConHoras(JSON.stringify([{ horasSemanales: '0' }]))).toBe(false);
    });
    it('"5" → true', () => {
      expect(tieneVinculacionConHoras(JSON.stringify([{ horasSemanales: '5' }]))).toBe(true);
    });
    it('varios ítems: al menos uno > 0 → true', () => {
      const json = JSON.stringify([{ horasSemanales: '0' }, { horasSemanales: '3' }]);
      expect(tieneVinculacionConHoras(json)).toBe(true);
    });
  });

  // ── Separación de fórmulas R-03 / R-10 ───────────────────────────────────────

  it('TC-INT-6: secciones 5.2+7.2+7.3 acumulan DedicaciónTotal alta sin afectar Carga R-03', async () => {
    // docencia=5h, otras(5.2)=25h, inv(7.2)=20h, vin(7.3)=15h
    // → DedTotal R-10 = 5+0+25+20+15 = 65h ≥ 20 → sin alerta R-10
    // → Carga R-03 = docencia(5)+gestión(0)+desempeño(0) = 5h < 60 → sin alerta R-03
    // (DocenteVigenteR03 no expone otrasDedicacionesJson/proyectosInvestigacionJson/
    //  participacionVinculacionJson → R-03 no puede contarlos: garantía de tipo TS)
    const data = mkData({
      docentes: [
        mkDocente({
          horasDocenciaConocidas: 5,
          otrasDedicacionesJson: JSON.stringify([{ horasSeman: '25' }]),
          proyectosInvestigacionJson: JSON.stringify([{ titulo: 'IA', horasSemanales: '20' }]),
          participacionVinculacionJson: JSON.stringify([{ actividad: 'Ext', horasSemanales: '15' }]),
        }),
      ],
    });
    const { svc } = makeSvc(data, mkConfig({ p02BajaH: 20 }));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR10;
    // DedTotal = 65 ≥ 20 → sin alerta
    expect(v.enAlerta).toHaveLength(0);
    expect(r.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
  });

  it('TC-INT-7: sección 6.1 (desempeño no académico) no contribuye a Dedicación Total R-10', async () => {
    // docencia=20h, gestión=20h, desempeño(6.1)=25h
    // → Carga R-03 = 20+20+25 = 65h > 60 → alerta R-03
    // → DedTotal R-10 = 20+20+0+0+0 = 40h (desempeñoActualJson ignorado por R-10)
    const data = mkData({
      docentes: [
        mkDocente({
          horasDocenciaConocidas: 20,
          tiempoDedicacionGestionSemanal: '20',
          desempenoActualJson: '[{"dedicacionSeman":"25"}]',
        }),
      ],
    });
    const { svc } = makeSvc(data, mkConfig({ p02BajaH: 50 }));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR10;
    // R-10 ignora desempenoActualJson: DedTotal = 40 < 50 → alerta
    expect(v.enAlerta).toHaveLength(1);
    expect(v.enAlerta[0].horasConocidas).toBe(40);
    const comp = v.enAlerta[0].componentes;
    expect(comp.horasDocencia).toBe(20);
    expect(comp.horasGestion).toBe(20);
    expect(comp.horasOtrasDedicaciones).toBe(0);
    expect(comp.horasInvestigacion).toBe(0);
    expect(comp.horasVinculacion).toBe(0);
  });

  it('TC-INT-8: gestión desde cargosAcademicosJson vigente suma correctamente (caso PROFE INDUSTRIAL)', async () => {
    const data = mkData({
      docentes: [
        mkDocente({
          horasDocenciaConocidas: 4,
          cargosAcademicosJson: JSON.stringify([{ dedicacionSemanal: '12', periodoHasta: '11-2026' }]),
          otrasDedicacionesJson: JSON.stringify([{ horasSeman: '5' }]),
          proyectosInvestigacionJson: JSON.stringify([{ titulo: 'PROY-TEC', horasSemanales: '8' }]),
          participacionVinculacionJson: JSON.stringify([{ actividad: 'PVF-001', horasSemanales: '4' }]),
        }),
      ],
    });
    const { svc } = makeSvc(data, mkConfig({ p02BajaH: 30 }));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR10;
    // R-10 = 4+12+5+8+4 = 33 ≥ 30 → NO alerta
    expect(v.enAlerta).toHaveLength(0);
    expect(r.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
  });

  it('TC-INT-9: cargosAcademicosJson vencido se ignora y el scalar también nulo → gestion=0', async () => {
    const data = mkData({
      docentes: [
        mkDocente({
          horasDocenciaConocidas: 4,
          cargosAcademicosJson: JSON.stringify([{ dedicacionSemanal: '12', periodoHasta: '09-2026' }]),
        }),
      ],
    });
    const { svc } = makeSvc(data, mkConfig({ p02BajaH: 10 }));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR10;
    // cargo vencido (sep 2026 < oct 2026) → gestión=0, total=4 < 10 → alerta
    expect(v.enAlerta).toHaveLength(1);
    expect(v.enAlerta[0].componentes.horasGestion).toBe(0);
    expect(v.enAlerta[0].horasConocidas).toBe(4);
  });
});
