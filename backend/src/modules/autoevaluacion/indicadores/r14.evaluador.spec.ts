import { BadRequestException } from '@nestjs/common';
import { EstadoCalculo } from '../types/estado-calculo.types';
import { R14EvaluadorService } from './r14.evaluador';
import type { MateriaProgramaAut } from '../consultas-academicas/consultas-academicas.types';
import type { ContextoEvaluacion } from './indicadores.types';

// ── UUIDs de prueba ───────────────────────────────────────────────────────────

const PLAN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const FECHA   = new Date('2026-10-01');

// ── Fábricas ──────────────────────────────────────────────────────────────────

function makeContexto(extra: Partial<ContextoEvaluacion> = {}): ContextoEvaluacion {
  return {
    usuarioId: USER_ID,
    rolNombre: 'SECRETARIA_ACADEMICA',
    planEstudioId: PLAN_ID,
    fechaEvaluacion: FECHA,
    ...extra,
  };
}

function makeMateria(
  id: string,
  nombre: string,
  cargaHorariaTotal: number | null,
  formacionPracticaJson: string | null,
): MateriaProgramaAut {
  return {
    materiaId: id,
    materiaNombre: nombre,
    materiaCodigo: `COD-${id}`,
    tipoAsignatura: 'OBLIGATORIA',
    cargaHorariaTotal,
    tienePrograma: formacionPracticaJson !== null,
    estadoPrograma: formacionPracticaJson !== null ? 'APROBADO' : null,
    secciones: null,
    seccionesCompletas: formacionPracticaJson !== null ? 6 : 0,
    fechaAprobacion: null,
    anioVigencia: null,
    formacionPracticaJson,
  };
}

function makeConsultas(materias: MateriaProgramaAut[]) {
  return { obtenerMateriasProgramasDePlan: jest.fn().mockResolvedValue(materias) };
}

const makeService = (consultas: ReturnType<typeof makeConsultas>) =>
  new R14EvaluadorService(consultas as any);

// helpers para JSON de formación práctica
const fpJson = (horas: number) => JSON.stringify([{ intensidad: 'semanal', horasClase: horas }]);
const fpJsonMulti = (...horas: number[]) =>
  JSON.stringify(horas.map(h => ({ intensidad: 'semanal', horasClase: h })));

// ── Validación de contexto ────────────────────────────────────────────────────

describe('R14EvaluadorService — validación de contexto', () => {
  it('ausencia de planEstudioId → BadRequestException', async () => {
    const service = makeService(makeConsultas([]));
    await expect(service.evaluar(makeContexto({ planEstudioId: undefined }))).rejects.toThrow(
      BadRequestException,
    );
  });
});

// ── NO_APLICA ─────────────────────────────────────────────────────────────────

describe('R14EvaluadorService — NO_APLICA', () => {
  it('plan sin materias → NO_APLICA', async () => {
    const service = makeService(makeConsultas([]));
    const res = await service.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    expect(res.valor?.totalMaterias).toBe(0);
    expect(res.valor?.enAlerta).toHaveLength(0);
  });
});

// ── CALCULADO sin alertas ─────────────────────────────────────────────────────

describe('R14EvaluadorService — CALCULADO sin alertas', () => {
  it('sin formacionPracticaJson (null) → evaluada como 0 horas, sin alerta', async () => {
    const m = makeMateria('m1', 'Álgebra', 64, null);
    const service = makeService(makeConsultas([m]));
    const res = await service.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect(res.valor?.totalEvaluadas).toBe(1);
    expect(res.valor?.totalConAlerta).toBe(0);
  });

  it('formacionPracticaJson vacío ([]) → 0 horas, sin alerta', async () => {
    const m = makeMateria('m1', 'Álgebra', 64, '[]');
    const service = makeService(makeConsultas([m]));
    const res = await service.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect(res.valor?.totalConAlerta).toBe(0);
  });

  it('horasFormacion <= cargaHorariaTotal → sin alerta', async () => {
    const m = makeMateria('m1', 'Álgebra', 64, fpJson(32));
    const service = makeService(makeConsultas([m]));
    const res = await service.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect(res.valor?.enAlerta).toHaveLength(0);
  });

  it('horasFormacion === cargaHorariaTotal → sin alerta (límite exacto)', async () => {
    const m = makeMateria('m1', 'Álgebra', 64, fpJson(64));
    const service = makeService(makeConsultas([m]));
    const res = await service.evaluar(makeContexto());
    expect(res.valor?.enAlerta).toHaveLength(0);
  });
});

// ── CALCULADO con alertas ─────────────────────────────────────────────────────

describe('R14EvaluadorService — CALCULADO con alertas', () => {
  it('horasFormacion > cargaHorariaTotal → alerta MEDIA con exceso correcto', async () => {
    const m = makeMateria('m1', 'Álgebra', 64, fpJson(80));
    const service = makeService(makeConsultas([m]));
    const res = await service.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect(res.valor?.totalConAlerta).toBe(1);
    const alerta = res.valor?.enAlerta[0]!;
    expect(alerta.materiaId).toBe('m1');
    expect(alerta.horasFormacionPractica).toBe(80);
    expect(alerta.horasTotal).toBe(64);
    expect(alerta.exceso).toBe(16);
  });

  it('suma de múltiples filas > cargaHorariaTotal → alerta detectada', async () => {
    const m = makeMateria('m1', 'Álgebra', 64, fpJsonMulti(30, 40));
    const service = makeService(makeConsultas([m]));
    const res = await service.evaluar(makeContexto());
    expect(res.valor?.enAlerta[0].horasFormacionPractica).toBe(70);
    expect(res.valor?.enAlerta[0].exceso).toBe(6);
  });
});

// ── PARCIAL ───────────────────────────────────────────────────────────────────

describe('R14EvaluadorService — PARCIAL', () => {
  it('horasFormacion>0 pero cargaHorariaTotal=null → NO_DETERMINABLE (sin evaluadas), totalSinDatos++', async () => {
    const m = makeMateria('m1', 'Álgebra', null, fpJson(32));
    const service = makeService(makeConsultas([m]));
    const res = await service.evaluar(makeContexto());
    // Sin ninguna materia evaluada (totalEvaluadas=0), solo sin datos → NO_DETERMINABLE
    expect(res.estadoCalculo).toBe(EstadoCalculo.NO_DETERMINABLE);
    expect(res.valor?.totalSinDatos).toBe(1);
    expect(res.valor?.totalEvaluadas).toBe(0);
    expect(res.datosFaltantes.some(d => d.campo === 'cargaHorariaTotal')).toBe(true);
  });

  it('mix: una evaluada + una sin datos → PARCIAL', async () => {
    const materias = [
      makeMateria('m1', 'Álgebra', 64, fpJson(30)),
      makeMateria('m2', 'Física',  null, fpJson(20)),
    ];
    const service = makeService(makeConsultas(materias));
    const res = await service.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
    expect(res.valor?.totalEvaluadas).toBe(1);
    expect(res.valor?.totalSinDatos).toBe(1);
  });
});

// ── NO_DETERMINABLE ───────────────────────────────────────────────────────────

describe('R14EvaluadorService — NO_DETERMINABLE', () => {
  it('JSON inválido → totalSinDatos++, NO_DETERMINABLE si no hay evaluadas', async () => {
    const m = makeMateria('m1', 'Álgebra', 64, 'no-es-json');
    const service = makeService(makeConsultas([m]));
    const res = await service.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.NO_DETERMINABLE);
    expect(res.valor?.totalSinDatos).toBe(1);
    expect(res.valor?.totalEvaluadas).toBe(0);
    expect(res.datosFaltantes.some(d => d.campo === 'formacionPracticaJson')).toBe(true);
  });

  it('JSON no es array → totalSinDatos++, datosFaltantes con formacionPracticaJson', async () => {
    const m = makeMateria('m1', 'Álgebra', 64, '{"horasClase": 10}');
    const service = makeService(makeConsultas([m]));
    const res = await service.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.NO_DETERMINABLE);
    expect(res.datosFaltantes.some(d => d.campo === 'formacionPracticaJson')).toBe(true);
  });
});

// ── Metadatos ─────────────────────────────────────────────────────────────────

describe('R14EvaluadorService — metadatos', () => {
  it('codigo=R-14, tipoContexto=PLAN, estadoImplementacion=IMPLEMENTADO', async () => {
    const service = makeService(makeConsultas([]));
    const res = await service.evaluar(makeContexto());
    expect(res.codigo).toBe('R-14');
    expect(res.tipoContexto).toBe('PLAN');
    expect(res.estadoImplementacion).toBe('IMPLEMENTADO');
    expect(res.contextoId).toBe(PLAN_ID);
  });

  it('totalMaterias = tamaño del array devuelto por consultas', async () => {
    const materias = [
      makeMateria('m1', 'Álgebra', 64, fpJson(20)),
      makeMateria('m2', 'Física', 64, null),
    ];
    const service = makeService(makeConsultas(materias));
    const res = await service.evaluar(makeContexto());
    expect(res.valor?.totalMaterias).toBe(2);
  });
});
