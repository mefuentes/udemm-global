import { BadRequestException } from '@nestjs/common';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type { DocenteVigenteR03, DocentesParaR03 } from '../consultas-academicas/consultas-academicas.types';
import type { ConfigFacultadAut } from '../consultas-academicas/consultas-academicas.types';
import type { ContextoEvaluacion } from './indicadores.types';
import {
  parsearHorasGestion,
  parsearHorasNoAcademico,
  R03EvaluadorService,
  type ResultadoR03,
} from './r03.evaluador';

// ── Constantes ────────────────────────────────────────────────────────────────

const USR    = 'usr-01';
const CAR_ID = 'car-01';
const FAC_ID = 'fac-01';
const FECHA  = new Date('2026-10-20T12:00:00.000Z');
const HOY    = '2026-10-20';
const ADMIN  = 'ADMINISTRADOR_SISTEMA';
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
    funcionGestion: null,
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

function mkConfig(p01TopeH = 60, overrides: Partial<ConfigFacultadAut> = {}): ConfigFacultadAut {
  return { facultadId: FAC_ID, p01TopeH, p02BajaH: 10, p03MaxMat: 5, updatedAt: new Date(), ...overrides };
}

function makeSvc(
  data: DocentesParaR03,
  config: ConfigFacultadAut | null,
) {
  const consultas = {
    obtenerDocentesParaR03: jest.fn().mockResolvedValue(data),
    obtenerConfigDeCarrera: jest.fn().mockResolvedValue(config),
  };
  return { svc: new R03EvaluadorService(consultas as any), consultas };
}

// ── parsearHorasGestion ───────────────────────────────────────────────────────

describe('parsearHorasGestion', () => {
  it('TC-G1: null dedicación → 0h, no indeterminado', () => {
    expect(parsearHorasGestion(null, null, FECHA)).toEqual({ horas: 0, indeterminado: false });
  });

  it('TC-G2: string vacío → 0h, no indeterminado', () => {
    expect(parsearHorasGestion('', null, FECHA)).toEqual({ horas: 0, indeterminado: false });
  });

  it('TC-G3: valor entero, sin fechaFin → horas parseadas', () => {
    expect(parsearHorasGestion('20', null, FECHA)).toEqual({ horas: 20, indeterminado: false });
  });

  it('TC-G4: valor entero, fechaFin futura → horas incluidas (cargo vigente)', () => {
    expect(parsearHorasGestion('15', '2027-01-01', FECHA)).toEqual({ horas: 15, indeterminado: false });
  });

  it('TC-G5: valor entero, fechaFin en pasado → 0h, no indeterminado (cargo vencido)', () => {
    expect(parsearHorasGestion('15', '2026-01-01', FECHA)).toEqual({ horas: 0, indeterminado: false });
  });

  it('TC-G6: valor entero, fechaFin = hoy (no estrictamente posterior) → 0h, cargo vencido', () => {
    expect(parsearHorasGestion('15', HOY, FECHA)).toEqual({ horas: 0, indeterminado: false });
  });

  it('TC-G7: valor "20h" (no solo dígitos) → 0h, indeterminado', () => {
    expect(parsearHorasGestion('20h', null, FECHA)).toEqual({ horas: 0, indeterminado: true });
  });

  it('TC-G8: valor "20.5" (punto decimal no permitido en gestión) → indeterminado', () => {
    expect(parsearHorasGestion('20.5', null, FECHA)).toEqual({ horas: 0, indeterminado: true });
  });

  it('TC-G_FUNC: actividad declarada (actividadDeclarada=true) pero dedicación vacía → INDETERMINADO', () => {
    expect(parsearHorasGestion(null, null, FECHA, true)).toEqual({ horas: 0, indeterminado: true });
    expect(parsearHorasGestion('', null, FECHA, true)).toEqual({ horas: 0, indeterminado: true });
  });

  it('TC-G_FUNC2: actividad NO declarada y dedicación vacía → 0h, no indeterminado', () => {
    expect(parsearHorasGestion(null, null, FECHA, false)).toEqual({ horas: 0, indeterminado: false });
    expect(parsearHorasGestion(null, null, FECHA, undefined)).toEqual({ horas: 0, indeterminado: false });
  });
});

// ── parsearHorasNoAcademico ───────────────────────────────────────────────────

describe('parsearHorasNoAcademico', () => {
  it('TC-NA1: null → 0h, no indeterminados', () => {
    expect(parsearHorasNoAcademico(null)).toEqual({ horas: 0, tieneIndeterminados: false });
  });

  it('TC-NA2: array vacío → 0h, no indeterminados', () => {
    expect(parsearHorasNoAcademico('[]')).toEqual({ horas: 0, tieneIndeterminados: false });
  });

  it('TC-NA3: ítem con dedicacionSeman numérico entero → suma', () => {
    expect(parsearHorasNoAcademico('[{"dedicacionSeman":"10"}]'))
      .toEqual({ horas: 10, tieneIndeterminados: false });
  });

  it('TC-NA4: ítem con dedicacionSeman con decimales → suma', () => {
    expect(parsearHorasNoAcademico('[{"dedicacionSeman":"4.5"}]'))
      .toEqual({ horas: 4.5, tieneIndeterminados: false });
  });

  it('TC-NA5: múltiples ítems válidos → suma acumulada', () => {
    const json = '[{"dedicacionSeman":"10"},{"dedicacionSeman":"5"},{"dedicacionSeman":"3"}]';
    expect(parsearHorasNoAcademico(json)).toEqual({ horas: 18, tieneIndeterminados: false });
  });

  it('TC-NA6: ítem con dedicacionSeman vacío → se omite (0), no indeterminado', () => {
    expect(parsearHorasNoAcademico('[{"dedicacionSeman":""}]'))
      .toEqual({ horas: 0, tieneIndeterminados: false });
  });

  it('TC-NA7: ítem sin campo dedicacionSeman → se omite, no indeterminado', () => {
    expect(parsearHorasNoAcademico('[{"institucion":"UBA"}]'))
      .toEqual({ horas: 0, tieneIndeterminados: false });
  });

  it('TC-NA8: "20h" no es numérico → tieneIndeterminados=true', () => {
    expect(parsearHorasNoAcademico('[{"dedicacionSeman":"20h"}]'))
      .toMatchObject({ tieneIndeterminados: true });
  });

  it('TC-NA9: JSON malformado → tieneIndeterminados=true', () => {
    expect(parsearHorasNoAcademico('{invalid json}')).toEqual({ horas: 0, tieneIndeterminados: true });
  });

  it('TC-NA10: mix de ítems válidos e inválidos → suma lo válido, tieneIndeterminados=true', () => {
    const json = '[{"dedicacionSeman":"10"},{"dedicacionSeman":"N/A"}]';
    expect(parsearHorasNoAcademico(json)).toEqual({ horas: 10, tieneIndeterminados: true });
  });
});

// ── R03EvaluadorService.evaluar ───────────────────────────────────────────────

describe('R03EvaluadorService', () => {
  it('TC-01: sin carreraId → lanza BadRequestException', async () => {
    const { svc } = makeSvc(mkData(), mkConfig());
    await expect(svc.evaluar(mkCtx({ carreraId: undefined }))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('TC-02: sin docentes activos → NO_APLICA', async () => {
    const { svc } = makeSvc(mkData({ docentes: [] }), mkConfig());
    const r = await svc.evaluar(mkCtx());
    expect(r.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    expect((r.valor as ResultadoR03).totalDocentes).toBe(0);
  });

  it('TC-03: sin config MOD-AUT → NO_DETERMINABLE, limite=null', async () => {
    const { svc } = makeSvc(mkData({ docentes: [mkDocente({ horasDocenciaConocidas: 30 })] }), null);
    const r = await svc.evaluar(mkCtx());
    expect(r.estadoCalculo).toBe(EstadoCalculo.NO_DETERMINABLE);
    expect((r.valor as ResultadoR03).limite).toBeNull();
    expect(r.datosFaltantes.some((d) => d.campo === 'p01TopeH')).toBe(true);
  });

  it('TC-04: docente con suma < P-01 → cumple (no en alerta)', async () => {
    const doc = mkDocente({ horasDocenciaConocidas: 30 });
    const { svc } = makeSvc(mkData({ docentes: [doc] }), mkConfig(60));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR03;
    expect(v.totalEnAlerta).toBe(0);
    expect(v.totalNoDeterminables).toBe(0);
    expect(r.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
  });

  it('TC-05: docente con suma == P-01 → no alerta (no estrictamente mayor)', async () => {
    const doc = mkDocente({ horasDocenciaConocidas: 60 });
    const { svc } = makeSvc(mkData({ docentes: [doc] }), mkConfig(60));
    const r = await svc.evaluar(mkCtx());
    expect((r.valor as ResultadoR03).totalEnAlerta).toBe(0);
  });

  it('TC-06: docente con suma > P-01 → alerta con exceso correcto', async () => {
    const doc = mkDocente({ docenteId: 'doc-1', horasDocenciaConocidas: 65 });
    const { svc } = makeSvc(mkData({ docentes: [doc] }), mkConfig(60));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR03;
    expect(v.totalEnAlerta).toBe(1);
    expect(v.enAlerta[0].exceso).toBe(5);
    expect(v.enAlerta[0].componentes.usoTope).toBe(65);
  });

  it('TC-07: P-01 no es 60 hardcodeado — usa el valor de config', async () => {
    const doc = mkDocente({ horasDocenciaConocidas: 45 }); // supera 40 pero no 60
    const { svc } = makeSvc(mkData({ docentes: [doc] }), mkConfig(40));
    const r = await svc.evaluar(mkCtx());
    expect((r.valor as ResultadoR03).totalEnAlerta).toBe(1);
    expect((r.valor as ResultadoR03).limite).toBe(40);
  });

  it('TC-08: horas de gestión vigentes se suman', async () => {
    const doc = mkDocente({
      horasDocenciaConocidas: 40,
      tiempoDedicacionGestionSemanal: '25',
      fechaFinGestion: null,
    });
    const { svc } = makeSvc(mkData({ docentes: [doc] }), mkConfig(60));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR03;
    expect(v.totalEnAlerta).toBe(1);
    expect(v.enAlerta[0].componentes.horasGestion).toBe(25);
    expect(v.enAlerta[0].componentes.usoTope).toBe(65);
  });

  it('TC-09: gestión vencida no suma horas', async () => {
    const doc = mkDocente({
      horasDocenciaConocidas: 30,
      tiempoDedicacionGestionSemanal: '25',
      fechaFinGestion: '2026-01-01', // pasado
    });
    const { svc } = makeSvc(mkData({ docentes: [doc] }), mkConfig(60));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR03;
    expect(v.totalEnAlerta).toBe(0); // 30 < 60
    expect(v.enAlerta[0]?.componentes.horasGestion ?? 0).toBe(0);
  });

  it('TC-10: gestión con valor inválido + suma conocida < P-01 → noDeterminable', async () => {
    const doc = mkDocente({
      horasDocenciaConocidas: 30,
      tiempoDedicacionGestionSemanal: '20h', // inválido
    });
    const { svc } = makeSvc(mkData({ docentes: [doc] }), mkConfig(60));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR03;
    expect(v.totalEnAlerta).toBe(0);
    expect(v.totalNoDeterminables).toBe(1);
    expect(v.noDeterminables[0].causa).toBe('DATOS_INCOMPLETOS');
    expect(v.noDeterminables[0].confirmadoEnAlerta).toBe(false);
    expect(v.noDeterminables[0].detalleDatos).toContain('tiempoDedicacionGestionSemanal');
  });

  it('TC-11: materia sin cargaHorariaSemanal + suma conocida < P-01 → noDeterminable', async () => {
    const doc = mkDocente({ horasDocenciaConocidas: 30, tieneMateriaSinHoras: true });
    const { svc } = makeSvc(mkData({ docentes: [doc] }), mkConfig(60));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR03;
    expect(v.totalNoDeterminables).toBe(1);
    expect(v.noDeterminables[0].detalleDatos).toContain('cargaHorariaSemanal');
  });

  it('TC-12: materia sin horas + suma conocida > P-01 → alerta confirmada (no noDeterminable)', async () => {
    const doc = mkDocente({ horasDocenciaConocidas: 65, tieneMateriaSinHoras: true });
    const { svc } = makeSvc(mkData({ docentes: [doc] }), mkConfig(60));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR03;
    expect(v.totalEnAlerta).toBe(1);
    expect(v.totalNoDeterminables).toBe(0);
    expect(v.enAlerta[0].componentes.usoTope).toBe(65);
  });

  it('TC-13: desempeño con dedicacionSeman inválido + suma conocida < P-01 → noDeterminable', async () => {
    const doc = mkDocente({
      horasDocenciaConocidas: 20,
      desempenoActualJson: '[{"dedicacionSeman":"N/A"}]',
    });
    const { svc } = makeSvc(mkData({ docentes: [doc] }), mkConfig(60));
    const r = await svc.evaluar(mkCtx());
    expect((r.valor as ResultadoR03).totalNoDeterminables).toBe(1);
    expect((r.valor as ResultadoR03).noDeterminables[0].detalleDatos).toContain('dedicacionSeman');
  });

  it('TC-14: desempeño válido suma sus horas al total', async () => {
    const doc = mkDocente({
      horasDocenciaConocidas: 40,
      desempenoActualJson: '[{"dedicacionSeman":"25"}]',
    });
    const { svc } = makeSvc(mkData({ docentes: [doc] }), mkConfig(60));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR03;
    expect(v.totalEnAlerta).toBe(1);
    expect(v.enAlerta[0].componentes.horasNoAcademico).toBe(25);
    expect(v.enAlerta[0].componentes.usoTope).toBe(65);
  });

  it('TC-15: los tres componentes se suman (docencia+gestion+noAcad)', async () => {
    const doc = mkDocente({
      horasDocenciaConocidas: 20,
      tiempoDedicacionGestionSemanal: '20',
      desempenoActualJson: '[{"dedicacionSeman":"25"}]',
    });
    const { svc } = makeSvc(mkData({ docentes: [doc] }), mkConfig(60));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR03;
    expect(v.totalEnAlerta).toBe(1);
    expect(v.enAlerta[0].componentes).toEqual({
      horasDocencia: 20, horasGestion: 20, horasNoAcademico: 25, usoTope: 65,
    });
    expect(v.enAlerta[0].exceso).toBe(5);
  });

  it('TC-16: docente cross-facultad → noDeterminable CROSS_FACULTAD', async () => {
    const doc = mkDocente({ docenteId: 'doc-multi', horasDocenciaConocidas: 30 });
    const data = mkData({
      docentes: [doc],
      alcanceFacultad: true,
      docentesMultiFacultad: new Set(['doc-multi']),
    });
    const { svc } = makeSvc(data, mkConfig(60));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR03;
    expect(v.totalEnAlerta).toBe(0);
    expect(v.totalNoDeterminables).toBe(1);
    expect(v.noDeterminables[0].causa).toBe('CROSS_FACULTAD');
  });

  it('TC-17: cross-facultad + suma parcial > P-01 → confirmadoEnAlerta=true', async () => {
    const doc = mkDocente({ docenteId: 'doc-multi', horasDocenciaConocidas: 65 });
    const data = mkData({
      docentes: [doc],
      alcanceFacultad: true,
      docentesMultiFacultad: new Set(['doc-multi']),
    });
    const { svc } = makeSvc(data, mkConfig(60));
    const r = await svc.evaluar(mkCtx());
    expect((r.valor as ResultadoR03).noDeterminables[0].confirmadoEnAlerta).toBe(true);
  });

  it('TC-18: DIRECTOR_CARRERA → alcanceFacultad=false → estadoCalculo=PARCIAL', async () => {
    const doc = mkDocente({ horasDocenciaConocidas: 30 });
    const data = mkData({ docentes: [doc], alcanceFacultad: false });
    const { svc } = makeSvc(data, mkConfig(60));
    const r = await svc.evaluar(mkCtx({ rolNombre: DIRECTOR }));
    expect(r.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
    expect(r.datosFaltantes.some((d) => d.campo === 'vinculacionesOtrasCarreras')).toBe(true);
  });

  it('TC-19: rol global, sin cross-facultad → estadoCalculo=CALCULADO', async () => {
    const doc = mkDocente({ horasDocenciaConocidas: 30 });
    const data = mkData({ docentes: [doc], alcanceFacultad: true, docentesMultiFacultad: new Set() });
    const { svc } = makeSvc(data, mkConfig(60));
    const r = await svc.evaluar(mkCtx());
    expect(r.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
  });

  it('TC-20: rol global con cross-facultad → estadoCalculo=PARCIAL', async () => {
    const doc = mkDocente({ docenteId: 'doc-x', horasDocenciaConocidas: 20 });
    const data = mkData({
      docentes: [doc],
      alcanceFacultad: true,
      docentesMultiFacultad: new Set(['doc-x']),
    });
    const { svc } = makeSvc(data, mkConfig(60));
    const r = await svc.evaluar(mkCtx());
    expect(r.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
    expect(r.datosFaltantes.some((d) => d.campo === 'vinculacionesOtrasFacultades')).toBe(true);
  });

  it('TC-21: listado de alertas ordenado por exceso descendente', async () => {
    const d1 = mkDocente({ docenteId: 'doc-1', nombre: 'Ana', apellido: 'Z', horasDocenciaConocidas: 65 }); // exceso 5
    const d2 = mkDocente({ docenteId: 'doc-2', nombre: 'Beto', apellido: 'A', horasDocenciaConocidas: 80 }); // exceso 20
    const data = mkData({ docentes: [d1, d2] });
    const { svc } = makeSvc(data, mkConfig(60));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR03;
    expect(v.enAlerta[0].exceso).toBe(20);
    expect(v.enAlerta[1].exceso).toBe(5);
  });

  it('TC-22: múltiples docentes → mixtura de alertas, cumplidos y noDeterminables', async () => {
    const dCumple = mkDocente({ docenteId: 'doc-ok', horasDocenciaConocidas: 30 });
    const dAlerta = mkDocente({ docenteId: 'doc-al', horasDocenciaConocidas: 70 });
    const dIndet  = mkDocente({ docenteId: 'doc-id', horasDocenciaConocidas: 20, tieneMateriaSinHoras: true });
    const data = mkData({ docentes: [dCumple, dAlerta, dIndet] });
    const { svc } = makeSvc(data, mkConfig(60));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR03;
    expect(v.totalDocentes).toBe(3);
    expect(v.totalEnAlerta).toBe(1);
    expect(v.totalNoDeterminables).toBe(1);
  });

  it('TC-23: nombre de docente en alerta usa nombre y apellido concatenados', async () => {
    const doc = mkDocente({ docenteId: 'd', nombre: 'Luis', apellido: 'Pérez', horasDocenciaConocidas: 70 });
    const { svc } = makeSvc(mkData({ docentes: [doc] }), mkConfig(60));
    const r = await svc.evaluar(mkCtx());
    expect((r.valor as ResultadoR03).enAlerta[0].nombre).toBe('Luis Pérez');
  });

  it('TC-24: datosFaltantes incluye siempre DP-R03-1 y DP-R03-2 al calcular', async () => {
    const doc = mkDocente({ horasDocenciaConocidas: 30 });
    const { svc } = makeSvc(mkData({ docentes: [doc] }), mkConfig(60));
    const r = await svc.evaluar(mkCtx());
    const campos = r.datosFaltantes.map((d) => d.campo);
    expect(campos).toContain('tiempoDedicacionGestionSemanal');
    expect(campos).toContain('dedicacionSeman');
  });

  it('TC-25: código de resultado siempre es R-03', async () => {
    const { svc } = makeSvc(mkData(), mkConfig());
    const r = await svc.evaluar(mkCtx());
    expect(r.codigo).toBe('R-03');
    expect(r.tipoContexto).toBe('DOCENTE');
    expect(r.estadoImplementacion).toBe('IMPLEMENTADO');
  });

  it('TC-G_FUNC_EVAL: funcionGestion declarada pero tiempoDedicacionGestionSemanal null → noDeterminable', async () => {
    const doc = mkDocente({
      horasDocenciaConocidas: 20,
      funcionGestion: 'Secretario Académico',
      tiempoDedicacionGestionSemanal: null,
    });
    const { svc } = makeSvc(mkData({ docentes: [doc] }), mkConfig(60));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR03;
    expect(v.totalNoDeterminables).toBe(1);
    expect(v.noDeterminables[0].causa).toBe('DATOS_INCOMPLETOS');
    expect(v.noDeterminables[0].detalleDatos).toContain('tiempoDedicacionGestionSemanal');
  });

  it('TC-26: gestión con fechaFin un día futuro → cargo vigente, horas incluidas', async () => {
    const doc = mkDocente({
      horasDocenciaConocidas: 50,
      tiempoDedicacionGestionSemanal: '15',
      fechaFinGestion: '2026-10-21', // mañana respecto a FECHA
    });
    const { svc } = makeSvc(mkData({ docentes: [doc] }), mkConfig(60));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR03;
    expect(v.totalEnAlerta).toBe(1);
    expect(v.enAlerta[0].componentes.horasGestion).toBe(15);
  });
});
