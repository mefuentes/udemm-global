import { BadRequestException } from '@nestjs/common';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type {
  VinculacionAut,
  ConfigFacultadAut,
} from '../consultas-academicas/consultas-academicas.types';
import type { ContextoEvaluacion } from './indicadores.types';
import { R15EvaluadorService, type ResultadoR15 } from './r15.evaluador';

// ── Constantes ────────────────────────────────────────────────────────────────

const USR    = 'usr-01';
const CAR_ID = 'car-01';
const FAC_ID = 'fac-01';
const FECHA  = new Date('2026-10-20T12:00:00.000Z');
const ADMIN  = 'ADMINISTRADOR_SISTEMA';

// ── Helpers ───────────────────────────────────────────────────────────────────

function mkCtx(overrides: Partial<ContextoEvaluacion> = {}): ContextoEvaluacion {
  return { usuarioId: USR, rolNombre: ADMIN, carreraId: CAR_ID, fechaEvaluacion: FECHA, ...overrides };
}

let _seq = 0;
function mkVinc(overrides: {
  materiaId?: string;
  docenteId?: string;
  catedraId?: string;
  estado?: string;
  activo?: boolean;
  nombre?: string;
  apellido?: string;
} = {}): VinculacionAut {
  const docenteId = overrides.docenteId ?? 'doc-1';
  return {
    id: `vinc-${++_seq}`,
    materiaId: overrides.materiaId ?? 'mat-1',
    docenteId,
    catedraId: overrides.catedraId ?? 'cat-1',
    planEstudioId: 'plan-1',
    carreraId: CAR_ID,
    estado: overrides.estado ?? 'APROBADA',
    esResponsableCatedra: null,
    horasSemana: null,
    docente: {
      id: docenteId,
      nombre: overrides.nombre ?? 'Ana',
      apellido: overrides.apellido ?? 'García',
      activo: overrides.activo ?? true,
      dedicacion: null,
      categoriaDocente: null,
    },
  };
}

function mkConfig(p03MaxMat = 5, overrides: Partial<ConfigFacultadAut> = {}): ConfigFacultadAut {
  return { facultadId: FAC_ID, p01TopeH: 60, p02BajaH: 10, p03MaxMat, updatedAt: new Date(), ...overrides };
}

function makeSvc(vinculaciones: VinculacionAut[], config: ConfigFacultadAut | null) {
  const consultas = {
    obtenerVinculacionesDeCarrera: jest.fn().mockResolvedValue(vinculaciones),
    obtenerConfigDeCarrera: jest.fn().mockResolvedValue(config),
  };
  return { svc: new R15EvaluadorService(consultas as any), consultas };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('R15EvaluadorService', () => {
  beforeEach(() => { _seq = 0; });

  it('TC-01: lanza BadRequestException cuando carreraId está ausente', async () => {
    const { svc } = makeSvc([], null);
    await expect(svc.evaluar(mkCtx({ carreraId: undefined }))).rejects.toThrow(BadRequestException);
  });

  it('TC-02: NO_APLICA cuando no hay vinculaciones', async () => {
    const { svc } = makeSvc([], mkConfig());
    const r = await svc.evaluar(mkCtx());
    expect(r.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    expect((r.valor as ResultadoR15).totalDocentes).toBe(0);
  });

  it('TC-03: NO_APLICA cuando vinculaciones no son APROBADAS', async () => {
    const { svc } = makeSvc(
      [mkVinc({ estado: 'PENDIENTE_DE_APROBACION' }), mkVinc({ estado: 'RECHAZADA' })],
      mkConfig(),
    );
    const r = await svc.evaluar(mkCtx());
    expect(r.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
  });

  it('TC-04: NO_APLICA cuando docentes están inactivos', async () => {
    const { svc } = makeSvc([mkVinc({ activo: false })], mkConfig());
    const r = await svc.evaluar(mkCtx());
    expect(r.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
  });

  it('TC-05: NO_DETERMINABLE cuando config es null (limite=null)', async () => {
    const { svc } = makeSvc([mkVinc()], null);
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR15;
    expect(r.estadoCalculo).toBe(EstadoCalculo.NO_DETERMINABLE);
    expect(v.limite).toBeNull();
    expect(v.totalEnAlerta).toBe(0);
    expect(r.datosFaltantes).toHaveLength(1);
  });

  it('TC-06: CALCULADO con docente en alerta cuando nMaterias > limite', async () => {
    const vincs = [
      mkVinc({ docenteId: 'doc-1', materiaId: 'mat-1' }),
      mkVinc({ docenteId: 'doc-1', materiaId: 'mat-2' }),
      mkVinc({ docenteId: 'doc-1', materiaId: 'mat-3' }),
    ];
    const { svc } = makeSvc(vincs, mkConfig(2));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR15;
    expect(r.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect(v.totalEnAlerta).toBe(1);
    expect(v.enAlerta[0].nMaterias).toBe(3);
    expect(v.enAlerta[0].exceso).toBe(1);
  });

  it('TC-07: misma materia en distintas cátedras cuenta como 1 (distinct materiaId)', async () => {
    const vincs = [
      mkVinc({ docenteId: 'doc-1', materiaId: 'mat-1', catedraId: 'cat-1' }),
      mkVinc({ docenteId: 'doc-1', materiaId: 'mat-1', catedraId: 'cat-2' }),
    ];
    const { svc } = makeSvc(vincs, mkConfig(2));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR15;
    expect(v.distribucion[0].nMaterias).toBe(1);
    expect(v.totalEnAlerta).toBe(0);
  });

  it('TC-08: nMaterias === limite no entra en alerta (comparación estricta >)', async () => {
    const vincs = [
      mkVinc({ docenteId: 'doc-1', materiaId: 'mat-1' }),
      mkVinc({ docenteId: 'doc-1', materiaId: 'mat-2' }),
    ];
    const { svc } = makeSvc(vincs, mkConfig(2));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR15;
    expect(v.totalEnAlerta).toBe(0);
    expect(r.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
  });

  it('TC-09: distribucion ordenada DESC por nMaterias', async () => {
    const vincs = [
      mkVinc({ docenteId: 'doc-a', materiaId: 'mat-1', nombre: 'Ana', apellido: 'García' }),
      mkVinc({ docenteId: 'doc-b', materiaId: 'mat-2', nombre: 'Carlos', apellido: 'López' }),
      mkVinc({ docenteId: 'doc-b', materiaId: 'mat-3', nombre: 'Carlos', apellido: 'López' }),
      mkVinc({ docenteId: 'doc-b', materiaId: 'mat-4', nombre: 'Carlos', apellido: 'López' }),
    ];
    const { svc } = makeSvc(vincs, mkConfig(5));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR15;
    expect(v.distribucion[0].docenteId).toBe('doc-b');
    expect(v.distribucion[0].nMaterias).toBe(3);
    expect(v.distribucion[1].docenteId).toBe('doc-a');
  });

  it('TC-10: mediana correcta con array par [1, 3] → 2', async () => {
    const vincs = [
      mkVinc({ docenteId: 'doc-a', materiaId: 'mat-1', nombre: 'Ana', apellido: 'A' }),
      mkVinc({ docenteId: 'doc-b', materiaId: 'mat-2', nombre: 'B', apellido: 'B' }),
      mkVinc({ docenteId: 'doc-b', materiaId: 'mat-3', nombre: 'B', apellido: 'B' }),
      mkVinc({ docenteId: 'doc-b', materiaId: 'mat-4', nombre: 'B', apellido: 'B' }),
    ];
    const { svc } = makeSvc(vincs, mkConfig(5));
    const r = await svc.evaluar(mkCtx());
    expect((r.valor as ResultadoR15).mediana).toBe(2);
  });

  it('TC-11: mediana correcta con array impar [1, 2, 3] → 2', async () => {
    const vincs = [
      mkVinc({ docenteId: 'doc-a', materiaId: 'mat-1', nombre: 'Ana', apellido: 'A' }),
      mkVinc({ docenteId: 'doc-b', materiaId: 'mat-2', nombre: 'B', apellido: 'B' }),
      mkVinc({ docenteId: 'doc-b', materiaId: 'mat-3', nombre: 'B', apellido: 'B' }),
      mkVinc({ docenteId: 'doc-c', materiaId: 'mat-4', nombre: 'C', apellido: 'C' }),
      mkVinc({ docenteId: 'doc-c', materiaId: 'mat-5', nombre: 'C', apellido: 'C' }),
      mkVinc({ docenteId: 'doc-c', materiaId: 'mat-6', nombre: 'C', apellido: 'C' }),
    ];
    const { svc } = makeSvc(vincs, mkConfig(5));
    const r = await svc.evaluar(mkCtx());
    expect((r.valor as ResultadoR15).mediana).toBe(2);
  });

  it('TC-12: promedio, maximo y enAlerta correctos para múltiples docentes', async () => {
    const vincs = [
      mkVinc({ docenteId: 'doc-a', materiaId: 'mat-1', nombre: 'A', apellido: 'A' }),
      mkVinc({ docenteId: 'doc-a', materiaId: 'mat-2', nombre: 'A', apellido: 'A' }),
      mkVinc({ docenteId: 'doc-b', materiaId: 'mat-3', nombre: 'B', apellido: 'B' }),
      mkVinc({ docenteId: 'doc-b', materiaId: 'mat-4', nombre: 'B', apellido: 'B' }),
      mkVinc({ docenteId: 'doc-b', materiaId: 'mat-5', nombre: 'B', apellido: 'B' }),
      mkVinc({ docenteId: 'doc-b', materiaId: 'mat-6', nombre: 'B', apellido: 'B' }),
    ];
    // doc-a: 2 materias, doc-b: 4 materias
    const { svc } = makeSvc(vincs, mkConfig(3));
    const r = await svc.evaluar(mkCtx());
    const v = r.valor as ResultadoR15;
    expect(v.promedio).toBe(3);
    expect(v.maximo).toBe(4);
    expect(v.totalEnAlerta).toBe(1);
    expect(v.enAlerta[0].docenteId).toBe('doc-b');
    expect(v.enAlerta[0].exceso).toBe(1);
  });
});
