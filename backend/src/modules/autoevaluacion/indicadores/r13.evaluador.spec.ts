import { BadRequestException } from '@nestjs/common';
import { EstadoCalculo } from '../types/estado-calculo.types';
import { R13EvaluadorService } from './r13.evaluador';
import type { ContextoEvaluacion } from './indicadores.types';
import type { MateriaProgramaAut } from '../consultas-academicas/consultas-academicas.types';

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
  tipo: string,
  cargaHorariaTotal: number | null = 64,
  hsFormacionPractica: number | null = null,
  formacionPracticaJson: string | null = null,
): MateriaProgramaAut {
  return {
    materiaId: id,
    materiaNombre: nombre,
    materiaCodigo: codigo,
    tipoAsignatura: tipo,
    cargaHorariaTotal,
    tienePrograma: true,
    estadoPrograma: 'PENDIENTE',
    secciones: null,
    seccionesCompletas: 0,
    fechaAprobacion: null,
    anioVigencia: null,
    formacionPracticaJson,
    hsSincronicas: null,
    hsAsincronicas: null,
    hsPresenciales: null,
    hsFormacionPractica,
  };
}

/** Materia con D07 directo */
function makeMateriaD07(id: string, nombre: string, tipo: string, hsFP: number): MateriaProgramaAut {
  return makeMateria(id, nombre, `COD-${id}`, tipo, 64, hsFP, null);
}

/** Materia con JSON histórico */
function makeMateriaJson(id: string, nombre: string, tipo: string, horasClase: number[]): MateriaProgramaAut {
  const json = JSON.stringify(horasClase.map((h, i) => ({ intensidad: `Actividad ${i + 1}`, horasClase: h })));
  return makeMateria(id, nombre, `COD-${id}`, tipo, 64, null, json);
}

interface ConfigFormacion {
  requierePPS: boolean | null;
  requierePI: boolean | null;
  porcentajeMinFormacion: number | null;
  horasMinFormacionPractica: number | null;
}

const CONFIG_NULL: ConfigFormacion = {
  requierePPS: null, requierePI: null,
  porcentajeMinFormacion: null, horasMinFormacionPractica: null,
};

function makeConsultas(materias: MateriaProgramaAut[], config: ConfigFormacion = CONFIG_NULL) {
  return {
    obtenerMateriasProgramasDePlan: jest.fn().mockResolvedValue(materias),
    obtenerConfigFormacionPlan: jest.fn().mockResolvedValue({
      planEstudioId: PLAN_ID,
      ...config,
    }),
  };
}

const makeService = (consultas: ReturnType<typeof makeConsultas>) =>
  new R13EvaluadorService(consultas as any);

// ── Validación de contexto ────────────────────────────────────────────────────

describe('R13EvaluadorService — validación de contexto', () => {
  it('ausencia de planEstudioId → BadRequestException', async () => {
    const service = makeService(makeConsultas([]));
    await expect(service.evaluar(makeContexto({ planEstudioId: undefined }))).rejects.toThrow(
      BadRequestException,
    );
  });
});

// ── NO_APLICA ─────────────────────────────────────────────────────────────────

describe('R13EvaluadorService — NO_APLICA', () => {
  it('plan sin materias → NO_APLICA, totales en cero', async () => {
    const service = makeService(makeConsultas([]));
    const res = await service.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    expect(res.valor?.totalMaterias).toBe(0);
    expect(res.valor?.tienePPS).toBe(false);
    expect(res.valor?.tienePI).toBe(false);
    expect(res.valor?.totalHorasFormacionPractica).toBe(0);
  });
});

// ── CALCULADO — distribución por tipo ────────────────────────────────────────

describe('R13EvaluadorService — distribución por tipo', () => {
  it('solo materias OBLIGATORIA → porTipo.OBLIGATORIA correcto, tienePPS=false, tienePI=false', async () => {
    const materias = [
      makeMateriaD07('m1', 'Álgebra', 'OBLIGATORIA', 0),
      makeMateriaD07('m2', 'Física',  'OBLIGATORIA', 0),
    ];
    const service = makeService(makeConsultas(materias));
    const res = await service.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect(res.valor?.porTipo.OBLIGATORIA).toBe(2);
    expect(res.valor?.porTipo.PPS).toBe(0);
    expect(res.valor?.porTipo.PI).toBe(0);
    expect(res.valor?.tienePPS).toBe(false);
    expect(res.valor?.tienePI).toBe(false);
  });

  it('mix de tipos → conteos correctos', async () => {
    const materias = [
      makeMateriaD07('m1', 'Álgebra',   'OBLIGATORIA', 0),
      makeMateriaD07('m2', 'Electiva1', 'ELECTIVA',    0),
      makeMateriaD07('m3', 'PPS I',     'PPS',        120),
      makeMateriaD07('m4', 'PI',        'PI',          80),
      makeMateriaD07('m5', 'Especial',  'ESPECIAL',    0),
    ];
    const service = makeService(makeConsultas(materias));
    const res = await service.evaluar(makeContexto());
    expect(res.valor?.totalMaterias).toBe(5);
    expect(res.valor?.porTipo.OBLIGATORIA).toBe(1);
    expect(res.valor?.porTipo.ELECTIVA).toBe(1);
    expect(res.valor?.porTipo.PPS).toBe(1);
    expect(res.valor?.porTipo.PI).toBe(1);
    expect(res.valor?.porTipo.OTRO).toBe(1);
    expect(res.valor?.tienePPS).toBe(true);
    expect(res.valor?.tienePI).toBe(true);
  });

  it('tipoAsignatura en minúscula → se normaliza correctamente', async () => {
    const materias = [makeMateriaD07('m1', 'PPS I', 'pps', 120)];
    const service = makeService(makeConsultas(materias));
    const res = await service.evaluar(makeContexto());
    expect(res.valor?.porTipo.PPS).toBe(1);
    expect(res.valor?.tienePPS).toBe(true);
  });
});

// ── D07 directo ───────────────────────────────────────────────────────────────

describe('R13EvaluadorService — D07 directo', () => {
  it('todas las materias con hsFormacionPractica → suma correcta, conDatosFP=total, CALCULADO', async () => {
    const materias = [
      makeMateriaD07('m1', 'Álgebra', 'OBLIGATORIA', 10),
      makeMateriaD07('m2', 'PPS I',   'PPS',         80),
      makeMateriaD07('m3', 'PI',      'PI',           50),
    ];
    const service = makeService(makeConsultas(materias));
    const res = await service.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect(res.valor?.totalHorasFormacionPractica).toBe(140);
    expect(res.valor?.conDatosFP).toBe(3);
    expect(res.valor?.sinDatosFP).toBe(0);
  });

  it('materia con hsFormacionPractica=0 → conDatosFP (no sinDatosFP), aporte 0', async () => {
    const materias = [makeMateriaD07('m1', 'Álgebra', 'OBLIGATORIA', 0)];
    const service = makeService(makeConsultas(materias));
    const res = await service.evaluar(makeContexto());
    expect(res.valor?.conDatosFP).toBe(1);
    expect(res.valor?.sinDatosFP).toBe(0);
    expect(res.valor?.totalHorasFormacionPractica).toBe(0);
  });
});

// ── Fallback histórico (JSON) ─────────────────────────────────────────────────

describe('R13EvaluadorService — fallback histórico (formacionPracticaJson)', () => {
  it('materia sin D07 con JSON válido → usa suma del JSON, CALCULADO', async () => {
    const materias = [makeMateriaJson('m1', 'Álgebra', 'OBLIGATORIA', [30, 20, 10])];
    const service = makeService(makeConsultas(materias));
    const res = await service.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect(res.valor?.totalHorasFormacionPractica).toBe(60);
    expect(res.valor?.conDatosFP).toBe(1);
    expect(res.valor?.sinDatosFP).toBe(0);
  });

  it('D07 tiene prioridad sobre JSON cuando ambos presentes', async () => {
    const materia = makeMateria('m1', 'Álgebra', 'COD', 'OBLIGATORIA', 64, 45,
      JSON.stringify([{ intensidad: 'A', horasClase: 10 }]));
    const service = makeService(makeConsultas([materia]));
    const res = await service.evaluar(makeContexto());
    expect(res.valor?.totalHorasFormacionPractica).toBe(45); // usa D07, ignora JSON
  });

  it('materia sin D07 y sin JSON → sinDatosFP++', async () => {
    const materias = [makeMateria('m1', 'Álgebra', 'ALG', 'OBLIGATORIA', 64, null, null)];
    const service = makeService(makeConsultas(materias));
    const res = await service.evaluar(makeContexto());
    expect(res.valor?.sinDatosFP).toBe(1);
    expect(res.valor?.conDatosFP).toBe(0);
    expect(res.valor?.totalHorasFormacionPractica).toBe(0);
  });

  it('JSON inválido → sinDatosFP (no se interpreta como 0)', async () => {
    const materia = makeMateria('m1', 'Álgebra', 'ALG', 'OBLIGATORIA', 64, null, 'not-json');
    const service = makeService(makeConsultas([materia]));
    const res = await service.evaluar(makeContexto());
    expect(res.valor?.sinDatosFP).toBe(1);
    expect(res.valor?.conDatosFP).toBe(0);
  });
});

// ── Estado PARCIAL ────────────────────────────────────────────────────────────

describe('R13EvaluadorService — estado PARCIAL', () => {
  it('sinDatosFP>0 Y horasMinFormacionPractica configurado → PARCIAL', async () => {
    const materias = [
      makeMateriaD07('m1', 'PPS I', 'PPS', 80),
      makeMateria('m2', 'Sin datos', 'ALG', 'OBLIGATORIA', 64, null, null), // sin FP
    ];
    const config = { ...CONFIG_NULL, horasMinFormacionPractica: 100 };
    const service = makeService(makeConsultas(materias, config));
    const res = await service.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
    expect(res.valor?.sinDatosFP).toBe(1);
    // PARCIAL → no evalúa el umbral
    const violMin = res.valor?.violacionesFormacion.find(v => /insuficiente/i.test(v));
    expect(violMin).toBeUndefined();
  });

  it('sinDatosFP>0 pero SIN umbral configurado → CALCULADO (no hay umbral que verificar)', async () => {
    const materias = [
      makeMateria('m1', 'Sin datos', 'ALG', 'OBLIGATORIA', 64, null, null),
    ];
    const service = makeService(makeConsultas(materias, CONFIG_NULL));
    const res = await service.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
  });

  it('PARCIAL → datosFaltantes incluye nota sobre programas sin FP', async () => {
    const materias = [
      makeMateriaD07('m1', 'PPS I', 'PPS', 80),
      makeMateria('m2', 'Sin datos', 'ALG', 'OBLIGATORIA', 64, null, null),
    ];
    const config = { ...CONFIG_NULL, horasMinFormacionPractica: 100 };
    const service = makeService(makeConsultas(materias, config));
    const res = await service.evaluar(makeContexto());
    const df = res.datosFaltantes.find(d => d.entidad === 'ProgramaAsignatura');
    expect(df).toBeDefined();
    expect(df?.campo).toContain('hsFormacionPractica');
  });
});

// ── Violaciones de formación práctica ────────────────────────────────────────

describe('R13EvaluadorService — violaciones de formación práctica', () => {
  it('requierePPS=true y tienePPS=false → violación PPS', async () => {
    const materias = [makeMateriaD07('m1', 'Álgebra', 'OBLIGATORIA', 0)];
    const config = { ...CONFIG_NULL, requierePPS: true };
    const svc = makeService(makeConsultas(materias, config));
    const res = await svc.evaluar(makeContexto());
    expect(res.valor?.violacionesFormacion).toHaveLength(1);
    expect(res.valor?.violacionesFormacion[0]).toMatch(/PPS/i);
  });

  it('requierePPS=false y tienePPS=false → sin violación PPS', async () => {
    const materias = [makeMateriaD07('m1', 'Álgebra', 'OBLIGATORIA', 0)];
    const config = { ...CONFIG_NULL, requierePPS: false };
    const svc = makeService(makeConsultas(materias, config));
    const res = await svc.evaluar(makeContexto());
    const violPPS = res.valor?.violacionesFormacion.filter(v => /pps/i.test(v));
    expect(violPPS).toHaveLength(0);
  });

  it('requierePI=true y tienePI=false → violación PI', async () => {
    const materias = [makeMateriaD07('m1', 'Álgebra', 'OBLIGATORIA', 0)];
    const config = { ...CONFIG_NULL, requierePI: true };
    const svc = makeService(makeConsultas(materias, config));
    const res = await svc.evaluar(makeContexto());
    expect(res.valor?.violacionesFormacion).toHaveLength(1);
    expect(res.valor?.violacionesFormacion[0]).toMatch(/PI/i);
  });

  it('horasMinFormacionPractica=200 y total < 200 → violación insuficiente', async () => {
    const materias = [
      makeMateriaD07('m1', 'Álgebra', 'OBLIGATORIA', 50),
      makeMateriaD07('m2', 'PPS I',   'PPS',         80),
      makeMateriaD07('m3', 'PI',      'PI',           40),
    ];
    const config = { ...CONFIG_NULL, horasMinFormacionPractica: 200 };
    const svc = makeService(makeConsultas(materias, config));
    const res = await svc.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    const viol = res.valor?.violacionesFormacion.find(v => /insuficiente/i.test(v));
    expect(viol).toBeDefined();
    expect(viol).toContain('170 h');
    expect(viol).toContain('200 h');
  });

  it('horasMinFormacionPractica=100 y total >= 100 → sin violación', async () => {
    const materias = [
      makeMateriaD07('m1', 'PPS I', 'PPS', 120),
    ];
    const config = { ...CONFIG_NULL, horasMinFormacionPractica: 100 };
    const svc = makeService(makeConsultas(materias, config));
    const res = await svc.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    const viol = res.valor?.violacionesFormacion.find(v => /insuficiente/i.test(v));
    expect(viol).toBeUndefined();
  });

  it('umbral exacto cumplido (total == min) → sin violación', async () => {
    const materias = [makeMateriaD07('m1', 'PPS I', 'PPS', 100)];
    const config = { ...CONFIG_NULL, horasMinFormacionPractica: 100 };
    const svc = makeService(makeConsultas(materias, config));
    const res = await svc.evaluar(makeContexto());
    expect(res.valor?.violacionesFormacion).toHaveLength(0);
  });

  it('umbral fallback JSON — materia histórica cumple el umbral con JSON', async () => {
    const materias = [makeMateriaJson('m1', 'PPS I', 'PPS', [50, 60])]; // 110 h
    const config = { ...CONFIG_NULL, horasMinFormacionPractica: 100 };
    const svc = makeService(makeConsultas(materias, config));
    const res = await svc.evaluar(makeContexto());
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect(res.valor?.totalHorasFormacionPractica).toBe(110);
    const viol = res.valor?.violacionesFormacion.find(v => /insuficiente/i.test(v));
    expect(viol).toBeUndefined();
  });
});

// ── datosFaltantes ────────────────────────────────────────────────────────────

describe('R13EvaluadorService — datosFaltantes', () => {
  it('config null → D-13 presente con campo horasMinFormacionPractica', async () => {
    const materias = [makeMateriaD07('m1', 'Álgebra', 'OBLIGATORIA', 0)];
    const service = makeService(makeConsultas(materias));
    const res = await service.evaluar(makeContexto());
    expect(res.datosFaltantes).toHaveLength(1);
    expect(res.datosFaltantes[0].entidad).toBe('PlanEstudio');
    expect(res.datosFaltantes[0].campo).toContain('horasMinFormacionPractica');
  });

  it('todas las config no nulas → D-13 removido', async () => {
    const materias = [makeMateriaD07('m1', 'PPS I', 'PPS', 80)];
    const config = { ...CONFIG_NULL, requierePPS: true, requierePI: false, horasMinFormacionPractica: 50 };
    const svc = makeService(makeConsultas(materias, config));
    const res = await svc.evaluar(makeContexto());
    const d13Schema = res.datosFaltantes.find(d => d.entidad === 'PlanEstudio');
    expect(d13Schema).toBeUndefined();
  });
});

// ── Metadatos ─────────────────────────────────────────────────────────────────

describe('R13EvaluadorService — metadatos', () => {
  it('codigo=R-13, tipoContexto=PLAN, estadoImplementacion=IMPLEMENTADO', async () => {
    const service = makeService(makeConsultas([]));
    const res = await service.evaluar(makeContexto());
    expect(res.codigo).toBe('R-13');
    expect(res.tipoContexto).toBe('PLAN');
    expect(res.estadoImplementacion).toBe('IMPLEMENTADO');
    expect(res.contextoId).toBe(PLAN_ID);
  });
});

// ── Fase B.3: tipoAsignatura determina PPS/PI (bloqueConocimiento independiente) ─

describe('R13EvaluadorService — tipoAsignatura es el único criterio para PPS/PI', () => {

  it('PPS detectada exclusivamente por tipoAsignatura="PPS"', async () => {
    const materias = [makeMateriaD07('m1', 'Práctica Profesional Supervisada', 'PPS', 160)];
    const service = makeService(makeConsultas(materias));
    const res = await service.evaluar(makeContexto());
    expect(res.valor?.porTipo.PPS).toBe(1);
    expect(res.valor?.tienePPS).toBe(true);
    expect(res.valor?.porTipo.PI).toBe(0);
  });

  it('PI detectada exclusivamente por tipoAsignatura="PI"', async () => {
    const materias = [makeMateriaD07('m1', 'Proyecto Integrador', 'PI', 120)];
    const service = makeService(makeConsultas(materias));
    const res = await service.evaluar(makeContexto());
    expect(res.valor?.porTipo.PI).toBe(1);
    expect(res.valor?.tienePI).toBe(true);
    expect(res.valor?.porTipo.PPS).toBe(0);
  });

  it('PPS y PI coexisten con OBLIGATORIA → conteos independientes por tipo', async () => {
    const materias = [
      makeMateriaD07('m1', 'Álgebra',  'OBLIGATORIA', 0),
      makeMateriaD07('m2', 'PPS I',    'PPS',         200),
      makeMateriaD07('m3', 'PI Final', 'PI',          160),
    ];
    const service = makeService(makeConsultas(materias));
    const res = await service.evaluar(makeContexto());
    expect(res.valor?.tienePPS).toBe(true);
    expect(res.valor?.tienePI).toBe(true);
    expect(res.valor?.porTipo.OBLIGATORIA).toBe(1);
    expect(res.valor?.porTipo.PPS).toBe(1);
    expect(res.valor?.porTipo.PI).toBe(1);
    expect(res.valor?.totalHorasFormacionPractica).toBe(360);
  });

});

// ════════════════════════════════════════════════════════════════════════════
// F.1 — electiva con menor FP (§6: el alumno cursa UNA electiva)
// ════════════════════════════════════════════════════════════════════════════

describe('R13EvaluadorService — F.1 electiva con menor FP (§6)', () => {

  it('dos electivas → totalHorasFormacionPractica usa sólo la de menor FP', async () => {
    // OBLIGATORIA=0, ELECTIVA_A=32h, ELECTIVA_B=64h → debe usar 32h (mínimo)
    const materias = [
      makeMateriaD07('m1', 'Álgebra',      'OBLIGATORIA',  0),
      makeMateriaD07('m2', 'Electiva A',   'ELECTIVA',    32),
      makeMateriaD07('m3', 'Electiva B',   'ELECTIVA',    64),
    ];
    const res = await makeService(makeConsultas(materias)).evaluar(makeContexto());
    expect(res.valor?.totalHorasFormacionPractica).toBe(32);
  });

  it('tres electivas → usa sólo el mínimo, no la suma', async () => {
    // ELECTIVA: 20h, 40h, 60h → min = 20h
    const materias = [
      makeMateriaD07('e1', 'Electiva 1', 'ELECTIVA', 20),
      makeMateriaD07('e2', 'Electiva 2', 'ELECTIVA', 40),
      makeMateriaD07('e3', 'Electiva 3', 'ELECTIVA', 60),
    ];
    const res = await makeService(makeConsultas(materias)).evaluar(makeContexto());
    expect(res.valor?.totalHorasFormacionPractica).toBe(20);
  });

  it('una sola electiva → usa su FP directamente', async () => {
    const materias = [
      makeMateriaD07('m1', 'PPS I',     'PPS',       100),
      makeMateriaD07('e1', 'Electiva',  'ELECTIVA',   50),
    ];
    const res = await makeService(makeConsultas(materias)).evaluar(makeContexto());
    expect(res.valor?.totalHorasFormacionPractica).toBe(150);
  });

  it('sin electivas → el total no cambia respecto al comportamiento previo', async () => {
    const materias = [
      makeMateriaD07('m1', 'Álgebra', 'OBLIGATORIA', 100),
      makeMateriaD07('m2', 'PPS I',   'PPS',          200),
      makeMateriaD07('m3', 'PI',      'PI',            80),
    ];
    const res = await makeService(makeConsultas(materias)).evaluar(makeContexto());
    expect(res.valor?.totalHorasFormacionPractica).toBe(380);
  });

  it('electivas con FP iguales → usa ese valor (mínimo de iguales)', async () => {
    const materias = [
      makeMateriaD07('e1', 'Electiva A', 'ELECTIVA', 48),
      makeMateriaD07('e2', 'Electiva B', 'ELECTIVA', 48),
    ];
    const res = await makeService(makeConsultas(materias)).evaluar(makeContexto());
    expect(res.valor?.totalHorasFormacionPractica).toBe(48);
  });

  it('electiva con null FP → va a sinDatosFP; min se calcula de las que tienen dato', async () => {
    // ELECTIVA_A=32h (dato), ELECTIVA_B=null (sin dato)
    // Total: usa 32h; sinDatosFP=1 por electiva sin dato
    const materias = [
      makeMateriaD07('e1', 'Electiva A', 'ELECTIVA', 32),
      makeMateria('e2', 'Electiva B', 'COD-E2', 'ELECTIVA', 64, null, null),
    ];
    const res = await makeService(makeConsultas(materias)).evaluar(makeContexto());
    expect(res.valor?.totalHorasFormacionPractica).toBe(32);
    expect(res.valor?.sinDatosFP).toBe(1);
    expect(res.valor?.conDatosFP).toBe(1);
  });

  it('todas las electivas con null FP → no hay contribución de electiva al total', async () => {
    const materias = [
      makeMateriaD07('m1', 'PPS I',     'PPS',       100),
      makeMateria('e1', 'Electiva A', 'COD-E1', 'ELECTIVA', 64, null, null),
      makeMateria('e2', 'Electiva B', 'COD-E2', 'ELECTIVA', 64, null, null),
    ];
    const res = await makeService(makeConsultas(materias)).evaluar(makeContexto());
    expect(res.valor?.totalHorasFormacionPractica).toBe(100);
    expect(res.valor?.sinDatosFP).toBe(2);
  });

  it('regresión 806h → 774h: dos electivas, diferencia 32h (§6 selecciona la menor)', async () => {
    // Escenario calibrado: non-elec=764h (6×OBL 100h + PPS 100h + PI 64h),
    // ELECTIVA_A=10h (min), ELECTIVA_B=32h
    // Suma antigua (todas electivas): 764 + 10 + 32 = 806h
    // Suma nueva   (sólo menor FP):   764 + 10      = 774h
    const materias = [
      makeMateriaD07('ob1', 'Matemática',   'OBLIGATORIA', 100),
      makeMateriaD07('ob2', 'Física',       'OBLIGATORIA', 100),
      makeMateriaD07('ob3', 'Química',      'OBLIGATORIA', 100),
      makeMateriaD07('ob4', 'Programación', 'OBLIGATORIA', 100),
      makeMateriaD07('ob5', 'Redes',        'OBLIGATORIA', 100),
      makeMateriaD07('ob6', 'Sistemas',     'OBLIGATORIA', 100),
      makeMateriaD07('p1',  'PPS I',        'PPS',         100),
      makeMateriaD07('pi1', 'PI',           'PI',           64),
      makeMateriaD07('e1',  'Electiva A',   'ELECTIVA',    10),
      makeMateriaD07('e2',  'Electiva B',   'ELECTIVA',    32),
    ];
    const res = await makeService(makeConsultas(materias)).evaluar(makeContexto());
    expect(res.valor?.totalHorasFormacionPractica).toBe(774);
  });

  it('porTipo sigue contando TODAS las electivas (distribución por tipo no cambia)', async () => {
    const materias = [
      makeMateriaD07('e1', 'Electiva A', 'ELECTIVA', 24),
      makeMateriaD07('e2', 'Electiva B', 'ELECTIVA', 56),
    ];
    const res = await makeService(makeConsultas(materias)).evaluar(makeContexto());
    expect(res.valor?.porTipo.ELECTIVA).toBe(2);
    expect(res.valor?.totalHorasFormacionPractica).toBe(24); // usa el mínimo
  });

});

// ════════════════════════════════════════════════════════════════════════════
// E.2 — universo de materias vigentes (ACTIVO)
// ════════════════════════════════════════════════════════════════════════════

describe('R13EvaluadorService — E.2 universo de materias vigentes (ACTIVO)', () => {

  it('totalHorasFormacionPractica suma sólo las materias devueltas por consultas', async () => {
    // Consultas devuelve 2 materias ACTIVO con hsFormacionPractica conocido
    const materias = [
      makeMateriaD07('m1', 'PPS I',    'PPS',         200),
      makeMateriaD07('m2', 'PI Final', 'PI',          100),
    ];
    const res = await makeService(makeConsultas(materias)).evaluar(makeContexto());
    expect(res.valor?.totalHorasFormacionPractica).toBe(300);
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
  });

  it('porTipo refleja la distribución de las N materias del universo vigente', async () => {
    const materias = [
      makeMateriaD07('m1', 'Álgebra', 'OBLIGATORIA', 0),
      makeMateriaD07('m2', 'PPS I',   'PPS',         120),
    ];
    const res = await makeService(makeConsultas(materias)).evaluar(makeContexto());
    expect(res.valor?.porTipo.OBLIGATORIA).toBe(1);
    expect(res.valor?.porTipo.PPS).toBe(1);
    expect(res.valor?.totalMaterias).toBe(2);
  });
});
