import { BadRequestException } from '@nestjs/common';
import { EstadoCalculo } from '../types/estado-calculo.types';
import { R11EvaluadorService } from './r11.evaluador';
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
  codigo: string,
  tienePrograma: boolean,
  estadoPrograma: string | null,
  seccionesCompletas: number,
  formacionPracticaJson: string | null = null,
): MateriaProgramaAut {
  return {
    materiaId: id,
    materiaNombre: nombre,
    materiaCodigo: codigo,
    tipoAsignatura: 'OBLIGATORIA',
    cargaHorariaTotal: 64,
    tienePrograma,
    estadoPrograma,
    secciones: null,
    seccionesCompletas,
    fechaAprobacion: null,
    anioVigencia: null,
    formacionPracticaJson,
  };
}

function makeConsultas(materias: MateriaProgramaAut[]) {
  return { obtenerMateriasProgramasDePlan: jest.fn().mockResolvedValue(materias) };
}

const makeService = (consultas: ReturnType<typeof makeConsultas>) =>
  new R11EvaluadorService(consultas as any);

// ── Validación de contexto ────────────────────────────────────────────────────

describe('R11EvaluadorService — validación de contexto', () => {
  it('ausencia de planEstudioId → BadRequestException', async () => {
    const service = makeService(makeConsultas([]));
    await expect(service.evaluar(makeContexto({ planEstudioId: undefined }))).rejects.toThrow(
      BadRequestException,
    );
  });
});

// ── NO_APLICA ─────────────────────────────────────────────────────────────────

describe('R11EvaluadorService — NO_APLICA', () => {
  it('plan sin materias → NO_APLICA, listas vacías', async () => {
    const service = makeService(makeConsultas([]));
    const res = await service.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    expect(res.valor?.totalMaterias).toBe(0);
    expect(res.valor?.inconsistencias).toHaveLength(0);
    expect(res.valor?.sinPrograma).toHaveLength(0);
    expect(res.valor?.totalAlta).toBe(0);
    expect(res.valor?.totalMedia).toBe(0);
  });
});

// ── CALCULADO sin inconsistencias ─────────────────────────────────────────────

describe('R11EvaluadorService — CALCULADO sin inconsistencias', () => {
  it('materia APROBADA con todas las secciones completas → sin inconsistencia', async () => {
    const m = makeMateria('m1', 'Álgebra', 'ALG', true, 'APROBADO', 6);
    const service = makeService(makeConsultas([m]));
    const res = await service.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect(res.valor?.totalInconsistencias).toBe(0);
    expect(res.valor?.inconsistencias).toHaveLength(0);
  });

  it('materia sin programa → va a sinPrograma, no a inconsistencias', async () => {
    const m = makeMateria('m1', 'Física', 'FIS', false, null, 0);
    const service = makeService(makeConsultas([m]));
    const res = await service.evaluar(makeContexto());
    expect(res.valor?.totalSinPrograma).toBe(1);
    expect(res.valor?.sinPrograma[0].materiaId).toBe('m1');
    expect(res.valor?.totalInconsistencias).toBe(0);
  });

  it('metadatos del resultado: codigo, tipoContexto, estadoImplementacion', async () => {
    const service = makeService(makeConsultas([]));
    const res = await service.evaluar(makeContexto());
    expect(res.codigo).toBe('R-11');
    expect(res.tipoContexto).toBe('PLAN');
    expect(res.estadoImplementacion).toBe('IMPLEMENTADO');
    expect(res.contextoId).toBe(PLAN_ID);
  });
});

// ── Inconsistencias ALTA ──────────────────────────────────────────────────────

describe('R11EvaluadorService — inconsistencias ALTA', () => {
  it('APROBADO con 1 sección PENDIENTE → ALTA', async () => {
    const m = makeMateria('m1', 'Álgebra', 'ALG', true, 'APROBADO', 5);
    const service = makeService(makeConsultas([m]));
    const res = await service.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect(res.valor?.totalAlta).toBe(1);
    expect(res.valor?.totalMedia).toBe(0);
    const inc = res.valor?.inconsistencias[0]!;
    expect(inc.prioridad).toBe('ALTA');
    expect(inc.materiaId).toBe('m1');
    expect(inc.seccionesCompletas).toBe(5);
    expect(inc.seccionesPendientes).toBe(1);
  });

  it('APROBADO con todas las secciones PENDIENTE (0 completas) → ALTA', async () => {
    const m = makeMateria('m1', 'Química', 'QUI', true, 'APROBADO', 0);
    const service = makeService(makeConsultas([m]));
    const res = await service.evaluar(makeContexto());
    expect(res.valor?.inconsistencias[0].prioridad).toBe('ALTA');
    expect(res.valor?.inconsistencias[0].seccionesPendientes).toBe(6);
  });
});

// ── Inconsistencias MEDIA ─────────────────────────────────────────────────────

describe('R11EvaluadorService — inconsistencias MEDIA', () => {
  it('PENDIENTE con secciones incompletas → MEDIA', async () => {
    const m = makeMateria('m1', 'Biología', 'BIO', true, 'PENDIENTE', 3);
    const service = makeService(makeConsultas([m]));
    const res = await service.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect(res.valor?.totalMedia).toBe(1);
    expect(res.valor?.totalAlta).toBe(0);
    const inc = res.valor?.inconsistencias[0]!;
    expect(inc.prioridad).toBe('MEDIA');
    expect(inc.seccionesCompletas).toBe(3);
    expect(inc.seccionesPendientes).toBe(3);
  });

  it('EN_REVISION con todas las secciones completas → MEDIA (no incorporado al circuito)', async () => {
    const m = makeMateria('m1', 'Historia', 'HIS', true, 'EN_REVISION', 6);
    const service = makeService(makeConsultas([m]));
    const res = await service.evaluar(makeContexto());
    expect(res.valor?.totalMedia).toBe(1);
    const inc = res.valor?.inconsistencias[0]!;
    expect(inc.prioridad).toBe('MEDIA');
    expect(inc.seccionesPendientes).toBe(0);
    expect(inc.seccionesCompletas).toBe(6);
  });
});

// ── Mix de casos ──────────────────────────────────────────────────────────────

describe('R11EvaluadorService — mix de materias', () => {
  it('counters totalConPrograma y totalSinPrograma son correctos', async () => {
    const materias = [
      makeMateria('m1', 'Álgebra', 'ALG', true, 'APROBADO', 6),
      makeMateria('m2', 'Física',  'FIS', false, null, 0),
      makeMateria('m3', 'Química', 'QUI', true, 'PENDIENTE', 2),
    ];
    const service = makeService(makeConsultas(materias));
    const res = await service.evaluar(makeContexto());
    expect(res.valor?.totalMaterias).toBe(3);
    expect(res.valor?.totalConPrograma).toBe(2);
    expect(res.valor?.totalSinPrograma).toBe(1);
    expect(res.valor?.totalInconsistencias).toBe(1);
    expect(res.valor?.totalAlta).toBe(0);
    expect(res.valor?.totalMedia).toBe(1);
  });

  it('ALTA + MEDIA + sin programa en el mismo plan', async () => {
    const materias = [
      makeMateria('m1', 'Álgebra', 'ALG', true, 'APROBADO', 5),  // ALTA
      makeMateria('m2', 'Física',  'FIS', true, 'PENDIENTE', 4), // MEDIA
      makeMateria('m3', 'Química', 'QUI', false, null, 0),        // sin programa
    ];
    const service = makeService(makeConsultas(materias));
    const res = await service.evaluar(makeContexto());
    expect(res.valor?.totalAlta).toBe(1);
    expect(res.valor?.totalMedia).toBe(1);
    expect(res.valor?.totalSinPrograma).toBe(1);
    expect(res.valor?.totalInconsistencias).toBe(2);
  });
});

// ── datosFaltantes ────────────────────────────────────────────────────────────

describe('R11EvaluadorService — datosFaltantes', () => {
  it('sin materias con programa → datosFaltantes vacíos', async () => {
    const m = makeMateria('m1', 'Física', 'FIS', false, null, 0);
    const service = makeService(makeConsultas([m]));
    const res = await service.evaluar(makeContexto());
    expect(res.datosFaltantes).toHaveLength(0);
  });

  it('con programa cargado → datosFaltantes incluye nota sobre ítems repetidos', async () => {
    const m = makeMateria('m1', 'Álgebra', 'ALG', true, 'APROBADO', 6);
    const service = makeService(makeConsultas([m]));
    const res = await service.evaluar(makeContexto());
    expect(res.datosFaltantes).toHaveLength(1);
    expect(res.datosFaltantes[0].entidad).toBe('ProgramaAsignatura');
  });
});
