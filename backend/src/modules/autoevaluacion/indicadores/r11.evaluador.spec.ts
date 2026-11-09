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
    hsSincronicas: null, hsAsincronicas: null, hsPresenciales: null, hsFormacionPractica: null,
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
  it('5/6 secciones (1 pendiente) → MEDIA (seccionesCompletas=5 > 2)', async () => {
    const m = makeMateria('m1', 'Álgebra', 'ALG', true, 'APROBADO', 5);
    const service = makeService(makeConsultas([m]));
    const res = await service.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect(res.valor?.totalMedia).toBe(1);
    expect(res.valor?.totalAlta).toBe(0);
    const inc = res.valor?.inconsistencias[0]!;
    expect(inc.prioridad).toBe('MEDIA');
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

  it('6/6 EN_REVISION → sin inconsistencia (estadoPrograma irrelevante cuando secciones completas)', async () => {
    const m = makeMateria('m1', 'Historia', 'HIS', true, 'EN_REVISION', 6);
    const service = makeService(makeConsultas([m]));
    const res = await service.evaluar(makeContexto());
    expect(res.valor?.totalMedia).toBe(0);
    expect(res.valor?.totalAlta).toBe(0);
    expect(res.valor?.totalInconsistencias).toBe(0);
    expect(res.valor?.inconsistencias).toHaveLength(0);
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
    expect(res.valor?.totalAlta).toBe(1);
    expect(res.valor?.totalMedia).toBe(0);
  });

  it('2/6 PENDIENTE + 4/6 PENDIENTE + sin programa → 1 ALTA + 1 MEDIA', async () => {
    const materias = [
      makeMateria('m1', 'Álgebra', 'ALG', true, 'APROBADO', 5),  // 5/6 → MEDIA
      makeMateria('m2', 'Física',  'FIS', true, 'PENDIENTE', 4), // 4/6 → MEDIA
      makeMateria('m3', 'Química', 'QUI', false, null, 0),        // sin programa
    ];
    const service = makeService(makeConsultas(materias));
    const res = await service.evaluar(makeContexto());
    expect(res.valor?.totalAlta).toBe(0);
    expect(res.valor?.totalMedia).toBe(2);
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

// ════════════════════════════════════════════════════════════════════════════
// E.2 — universo de materias vigentes (ACTIVO)
// ════════════════════════════════════════════════════════════════════════════

describe('R11EvaluadorService — E.2 universo de materias vigentes (ACTIVO)', () => {

  it('totalMaterias refleja exactamente las N materias devueltas por consultas', async () => {
    const materias = [
      makeMateria('m1', 'Álgebra', 'ALG', true, 'APROBADO', 6),
      makeMateria('m2', 'Física', 'FIS', true, 'APROBADO', 6),
    ];
    const res = await makeService(makeConsultas(materias)).evaluar(makeContexto());
    expect(res.valor?.totalMaterias).toBe(2);
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
  });

  it('materia sin programa no incluye materias ajenas al universo vigente en sinPrograma', async () => {
    // Consultas devuelve sólo las ACTIVO; resultado sinPrograma refleja ese universo
    const materias = [makeMateria('m1', 'Álgebra', 'ALG', false, null, 0)];
    const res = await makeService(makeConsultas(materias)).evaluar(makeContexto());
    expect(res.valor?.totalMaterias).toBe(1);
    expect(res.valor?.sinPrograma).toHaveLength(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// H.4 — Corrección R-11: secciones independientes del estado administrativo
// ════════════════════════════════════════════════════════════════════════════

describe('H.4 — secciones independientes del estado administrativo', () => {

  // ── 6/6 completas → sin inconsistencia (cualquier estadoPrograma) ────────

  it('H.4-01: 6/6 APROBADO → sin inconsistencia', async () => {
    const m = makeMateria('m1', 'Álgebra', 'ALG', true, 'APROBADO', 6);
    const res = await makeService(makeConsultas([m])).evaluar(makeContexto());
    expect(res.valor?.totalInconsistencias).toBe(0);
    expect(res.valor?.inconsistencias).toHaveLength(0);
  });

  it('H.4-02: 6/6 PENDIENTE → sin inconsistencia (KEY FIX: antes era MEDIA)', async () => {
    const m = makeMateria('m1', 'Física', 'FIS', true, 'PENDIENTE', 6);
    const res = await makeService(makeConsultas([m])).evaluar(makeContexto());
    expect(res.valor?.totalInconsistencias).toBe(0);
    expect(res.valor?.totalMedia).toBe(0);
    expect(res.valor?.inconsistencias).toHaveLength(0);
  });

  it('H.4-03: 6/6 EN_REVISION → sin inconsistencia (KEY FIX: antes era MEDIA)', async () => {
    const m = makeMateria('m1', 'Química', 'QUI', true, 'EN_REVISION', 6);
    const res = await makeService(makeConsultas([m])).evaluar(makeContexto());
    expect(res.valor?.totalInconsistencias).toBe(0);
    expect(res.valor?.totalMedia).toBe(0);
  });

  it('H.4-04: 6/6 BORRADOR → sin inconsistencia', async () => {
    const m = makeMateria('m1', 'Historia', 'HIS', true, 'BORRADOR', 6);
    const res = await makeService(makeConsultas([m])).evaluar(makeContexto());
    expect(res.valor?.totalInconsistencias).toBe(0);
  });

  // ── Límites ALTA (0–2 secciones completas) ──────────────────────────────

  it('H.4-05: 0/6 → ALTA', async () => {
    const m = makeMateria('m1', 'Biología', 'BIO', true, 'PENDIENTE', 0);
    const res = await makeService(makeConsultas([m])).evaluar(makeContexto());
    expect(res.valor?.inconsistencias[0].prioridad).toBe('ALTA');
    expect(res.valor?.inconsistencias[0].seccionesCompletas).toBe(0);
    expect(res.valor?.inconsistencias[0].seccionesPendientes).toBe(6);
  });

  it('H.4-06: 1/6 → ALTA', async () => {
    const m = makeMateria('m1', 'Biología', 'BIO', true, 'PENDIENTE', 1);
    const res = await makeService(makeConsultas([m])).evaluar(makeContexto());
    expect(res.valor?.inconsistencias[0].prioridad).toBe('ALTA');
  });

  it('H.4-07: 2/6 → ALTA (límite superior de ALTA)', async () => {
    const m = makeMateria('m1', 'Biología', 'BIO', true, 'PENDIENTE', 2);
    const res = await makeService(makeConsultas([m])).evaluar(makeContexto());
    expect(res.valor?.inconsistencias[0].prioridad).toBe('ALTA');
    expect(res.valor?.inconsistencias[0].seccionesCompletas).toBe(2);
  });

  // ── Límites MEDIA (3–5 secciones completas) ─────────────────────────────

  it('H.4-08: 3/6 → MEDIA (límite inferior de MEDIA)', async () => {
    const m = makeMateria('m1', 'Biología', 'BIO', true, 'PENDIENTE', 3);
    const res = await makeService(makeConsultas([m])).evaluar(makeContexto());
    expect(res.valor?.inconsistencias[0].prioridad).toBe('MEDIA');
    expect(res.valor?.inconsistencias[0].seccionesCompletas).toBe(3);
  });

  it('H.4-09: 4/6 → MEDIA', async () => {
    const m = makeMateria('m1', 'Biología', 'BIO', true, 'PENDIENTE', 4);
    const res = await makeService(makeConsultas([m])).evaluar(makeContexto());
    expect(res.valor?.inconsistencias[0].prioridad).toBe('MEDIA');
  });

  it('H.4-10: 5/6 → MEDIA', async () => {
    const m = makeMateria('m1', 'Biología', 'BIO', true, 'PENDIENTE', 5);
    const res = await makeService(makeConsultas([m])).evaluar(makeContexto());
    expect(res.valor?.inconsistencias[0].prioridad).toBe('MEDIA');
  });

  // ── Estado administrativo irrelevante para prioridad ────────────────────

  it('H.4-11: APROBADO con 2/6 → ALTA (estado no baja prioridad)', async () => {
    const m = makeMateria('m1', 'Álgebra', 'ALG', true, 'APROBADO', 2);
    const res = await makeService(makeConsultas([m])).evaluar(makeContexto());
    expect(res.valor?.inconsistencias[0].prioridad).toBe('ALTA');
    expect(res.valor?.totalAlta).toBe(1);
    expect(res.valor?.totalMedia).toBe(0);
  });

  it('H.4-12: APROBADO con 5/6 → MEDIA (estado no fuerza ALTA)', async () => {
    const m = makeMateria('m1', 'Álgebra', 'ALG', true, 'APROBADO', 5);
    const res = await makeService(makeConsultas([m])).evaluar(makeContexto());
    expect(res.valor?.inconsistencias[0].prioridad).toBe('MEDIA');
    expect(res.valor?.totalMedia).toBe(1);
    expect(res.valor?.totalAlta).toBe(0);
  });

  // ── Contract fix: materiaNombre / materiaCodigo ──────────────────────────

  it('H.4-13: inconsistencia expone materiaNombre correcto', async () => {
    const m = makeMateria('m1', 'Análisis Matemático I', 'AM1', true, 'PENDIENTE', 1);
    const res = await makeService(makeConsultas([m])).evaluar(makeContexto());
    expect(res.valor?.inconsistencias[0].materiaNombre).toBe('Análisis Matemático I');
  });

  it('H.4-14: inconsistencia expone materiaCodigo correcto', async () => {
    const m = makeMateria('m1', 'Análisis Matemático I', 'AM1', true, 'PENDIENTE', 1);
    const res = await makeService(makeConsultas([m])).evaluar(makeContexto());
    expect(res.valor?.inconsistencias[0].materiaCodigo).toBe('AM1');
  });

  it('H.4-15: sinPrograma expone materiaNombre correcto', async () => {
    const m = makeMateria('m1', 'Sociología', 'SOC', false, null, 0);
    const res = await makeService(makeConsultas([m])).evaluar(makeContexto());
    expect(res.valor?.sinPrograma[0].materiaNombre).toBe('Sociología');
  });

  it('H.4-16: sinPrograma expone materiaCodigo correcto', async () => {
    const m = makeMateria('m1', 'Sociología', 'SOC', false, null, 0);
    const res = await makeService(makeConsultas([m])).evaluar(makeContexto());
    expect(res.valor?.sinPrograma[0].materiaCodigo).toBe('SOC');
  });

  // ── Counts: 6/6 no aporta a totalInconsistencias ────────────────────────

  it('H.4-17: 6/6 no suma a totalInconsistencias ni a totalAlta/totalMedia', async () => {
    const materias = [
      makeMateria('m1', 'Álgebra', 'ALG', true, 'PENDIENTE', 6),
      makeMateria('m2', 'Física',  'FIS', true, 'APROBADO',  6),
    ];
    const res = await makeService(makeConsultas(materias)).evaluar(makeContexto());
    expect(res.valor?.totalInconsistencias).toBe(0);
    expect(res.valor?.totalAlta).toBe(0);
    expect(res.valor?.totalMedia).toBe(0);
  });

  it('H.4-18: totalAlta y totalMedia correctos con materias 6/6 excluidas', async () => {
    const materias = [
      makeMateria('m1', 'Álgebra', 'ALG', true, 'EN_REVISION', 6), // excluida
      makeMateria('m2', 'Física',  'FIS', true, 'PENDIENTE',   2), // ALTA
      makeMateria('m3', 'Química', 'QUI', true, 'PENDIENTE',   4), // MEDIA
    ];
    const res = await makeService(makeConsultas(materias)).evaluar(makeContexto());
    expect(res.valor?.totalAlta).toBe(1);
    expect(res.valor?.totalMedia).toBe(1);
    expect(res.valor?.totalInconsistencias).toBe(2);
  });

  // ── Mezcla compleja ──────────────────────────────────────────────────────

  it('H.4-19: 6/6 PENDIENTE + 2/6 APROBADO → 1 inconsistencia ALTA', async () => {
    const materias = [
      makeMateria('m1', 'Álgebra', 'ALG', true, 'PENDIENTE', 6), // 6/6 → excluida
      makeMateria('m2', 'Física',  'FIS', true, 'APROBADO',  2), // 2/6 → ALTA
    ];
    const res = await makeService(makeConsultas(materias)).evaluar(makeContexto());
    expect(res.valor?.totalInconsistencias).toBe(1);
    expect(res.valor?.totalAlta).toBe(1);
    expect(res.valor?.totalMedia).toBe(0);
    expect(res.valor?.inconsistencias[0].prioridad).toBe('ALTA');
  });

  it('H.4-20: mix 2 ALTA + 1 MEDIA + 1 sinPrograma + 1 consistente (6/6)', async () => {
    const materias = [
      makeMateria('m1', 'Álgebra',  'ALG', true,  'PENDIENTE',   0), // 0/6 → ALTA
      makeMateria('m2', 'Física',   'FIS', true,  'APROBADO',    2), // 2/6 → ALTA
      makeMateria('m3', 'Química',  'QUI', true,  'PENDIENTE',   4), // 4/6 → MEDIA
      makeMateria('m4', 'Biología', 'BIO', false, null,          0), // sin programa
      makeMateria('m5', 'Historia', 'HIS', true,  'EN_REVISION', 6), // 6/6 → excluida
    ];
    const res = await makeService(makeConsultas(materias)).evaluar(makeContexto());
    expect(res.valor?.totalMaterias).toBe(5);
    expect(res.valor?.totalConPrograma).toBe(4);
    expect(res.valor?.totalSinPrograma).toBe(1);
    expect(res.valor?.totalAlta).toBe(2);
    expect(res.valor?.totalMedia).toBe(1);
    expect(res.valor?.totalInconsistencias).toBe(3);
  });
});
