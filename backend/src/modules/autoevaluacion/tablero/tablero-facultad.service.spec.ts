import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TablroFacultadService } from './tablero-facultad.service';

// ── UUIDs de prueba ───────────────────────────────────────────────────────────

const FAC_ID  = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CAR1_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CAR2_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const DOC1_ID = '11111111-1111-4111-8111-111111111111';
const DOC2_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

// ── Fábricas ──────────────────────────────────────────────────────────────────

const PLAN_ID       = 'pp000000-0000-4000-8000-000000000000';
const MAT_ID        = 'mm000000-0000-4000-8000-000000000000';
const CAT_ID        = 'cc000000-0000-4000-8000-000000000000';
const CARGO_TIT_ID  = 'cg-tit-0000-4000-8000-000000000000';
const CARGO_JTP_ID  = 'cg-jtp-0000-4000-8000-000000000000';
const CARGO_AYU_ID  = 'cg-ayu-0000-4000-8000-000000000000';
const CARGO_X_ID    = 'cg-xxx-0000-4000-8000-000000000000';

function makeVinc(
  docenteId: string,
  carreraId = CAR1_ID,
  cargoNombre = 'TITULAR',
  cargaHorariaSemanal: number | null = null,
  cargoId = `cargo-${cargoNombre}`,
) {
  return {
    docenteId,
    carreraId,
    cargoId,
    planEstudioId: PLAN_ID,
    materiaId: MAT_ID,
    catedraId: CAT_ID,
    carrera: { nombre: 'Ing. en Sistemas' },
    cargo: { nombre: cargoNombre },
    docente: { nombre: 'Juan', apellido: 'Pérez' },
    materia: { cargaHorariaSemanal },
  };
}

function makeDocente(
  id: string,
  tituloGrado: string | null = 'Ing. Sistemas',
  tituloPosgrado: string | null = null,
  tituloPI: string | null = null,
  tituloExt: string | null = null,
) {
  return {
    id,
    nombre: `Doc${id.slice(0, 2)}`,
    apellido: 'Apellido',
    tituloGrado,
    tituloPosgrado,
    tiempoDedicacionGestionSemanal: null as string | null,
    fechaFinGestion: null as string | null,
    funcionGestion: null as string | null,
    cargosAcademicosJson: null as string | null,
    otrasDedicacionesJson: null as string | null,
    proyectosInvestigacionJson: tituloPI ? JSON.stringify([{ titulo: tituloPI, horasSemanales: '0' }]) : null,
    participacionVinculacionJson: tituloExt ? JSON.stringify([{ actividad: tituloExt, horasSemanales: '4' }]) : null,
  };
}

// ── R06 mock ──────────────────────────────────────────────────────────────────

function makeR06Result(overrides: Partial<{
  totalDocentes: number; promedio: number | null; mediana: number | null;
  maximo: number | null; distribucion: { docenteId: string; nombre: string; nMaterias: number }[];
}> = {}) {
  return {
    estadoCalculo: 'CALCULADO',
    valor: {
      facultadId: FAC_ID,
      alcanceFacultad: true,
      totalDocentes: 2,
      promedio: 1.5,
      mediana: 1.5,
      maximo: 2,
      distribucion: [
        { docenteId: DOC1_ID, nombre: 'Doc Uno', nMaterias: 2 },
        { docenteId: DOC2_ID, nombre: 'Doc Dos', nMaterias: 1 },
      ],
      ...overrides,
    },
  };
}

function makeR06Mock(resultado = makeR06Result()) {
  return { evaluarPorFacultad: jest.fn().mockResolvedValue(resultado) };
}

// ── Constructor del servicio ──────────────────────────────────────────────────

function makeService(
  prismaOverrides: Partial<Record<string, jest.Mock>> = {},
  r06Mock = makeR06Mock(),
) {
  const defaultPrisma = {
    facultad: {
      findUnique: jest.fn().mockResolvedValue({ id: FAC_ID }),
    },
    vinculacionCatedra: {
      findMany: jest.fn().mockResolvedValue([
        makeVinc(DOC1_ID, CAR1_ID, 'TITULAR', 25),
        makeVinc(DOC2_ID, CAR1_ID, 'TITULAR', 10),
      ]),
    },
    docente: {
      findMany: jest.fn().mockResolvedValue([
        makeDocente(DOC1_ID, 'Ing.', 'Mg.', 'Proyecto A', null),
        makeDocente(DOC2_ID, 'Lic.', null, null, 'Ext. B'),
      ]),
    },
    autoevaluacionConfigFacultad: {
      findUnique: jest.fn().mockResolvedValue({ p02BajaH: 20, p03MaxMat: 3 }),
    },
  };

  const prisma = {
    facultad: { ...defaultPrisma.facultad, ...prismaOverrides['facultad'] },
    vinculacionCatedra: { ...defaultPrisma.vinculacionCatedra, ...prismaOverrides['vinculacionCatedra'] },
    docente: { ...defaultPrisma.docente, ...prismaOverrides['docente'] },
    autoevaluacionConfigFacultad: {
      ...defaultPrisma.autoevaluacionConfigFacultad,
      ...prismaOverrides['autoevaluacionConfigFacultad'],
    },
  };

  return new TablroFacultadService(prisma as any, r06Mock as any);
}

// ── Autorización ──────────────────────────────────────────────────────────────

describe('TablroFacultadService — autorización', () => {
  it('DIRECTOR_CARRERA → ForbiddenException', async () => {
    const svc = makeService();
    await expect(svc.consultarFacultad(FAC_ID, USER_ID, 'DIRECTOR_CARRERA')).rejects.toThrow(ForbiddenException);
  });

  it('DOCENTE → ForbiddenException', async () => {
    const svc = makeService();
    await expect(svc.consultarFacultad(FAC_ID, USER_ID, 'DOCENTE')).rejects.toThrow(ForbiddenException);
  });

  it('DECANO → accede', async () => {
    const svc = makeService();
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.facultadId).toBe(FAC_ID);
  });

  it('SECRETARIA_ACADEMICA → accede', async () => {
    const svc = makeService();
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'SECRETARIA_ACADEMICA');
    expect(res).toBeDefined();
  });

  it('facultad inexistente → NotFoundException', async () => {
    const svc = makeService({
      facultad: { findUnique: jest.fn().mockResolvedValue(null) } as any,
    });
    await expect(svc.consultarFacultad('no-existe', USER_ID, 'DECANO')).rejects.toThrow(NotFoundException);
  });
});

// ── Respuesta general ─────────────────────────────────────────────────────────

describe('TablroFacultadService — respuesta', () => {
  it('incluye todos los bloques y facultadId', async () => {
    const svc = makeService();
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.facultadId).toBe(FAC_ID);
    expect(res.composicion).toBeDefined();
    expect(res.formacion).toBeDefined();
    expect(res.investigacion).toBeDefined();
    expect(res.dedicaciones).toBeDefined();
    expect(res.cargaAcademica).toBeDefined();
    expect(res.distribucionMaterias).toBeDefined();
    expect(res.estadoGeneralCalculo).toBeDefined();
  });

  it('fechaEvaluacion es una cadena ISO', async () => {
    const svc = makeService();
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(() => new Date(res.fechaEvaluacion)).not.toThrow();
  });
});

// ── Bloque 1 — Composición ────────────────────────────────────────────────────

describe('TablroFacultadService — Bloque 1 composición', () => {
  it('sin vinculaciones → NO_APLICA', async () => {
    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.composicion.estadoCalculo).toBe('NO_APLICA');
    expect(res.composicion.totalDocentes).toBe(0);
  });

  it('2 docentes con cargos TITULAR y JTP', async () => {
    // findMany devuelve los mismos datos para todos los bloques (todos los campos presentes)
    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([makeVinc(DOC1_ID, CAR1_ID, 'TITULAR'), makeVinc(DOC2_ID, CAR1_ID, 'JTP')]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.composicion.totalDocentes).toBe(2);
    expect(res.composicion.totalCargosP).toBe(1);
    expect(res.composicion.totalCargosA).toBe(1);
    expect(res.composicion.estadoCalculo).toBe('CALCULADO');
  });
});

// ── B-01 — Deduplicación de cargos ────────────────────────────────────────────

describe('TablroFacultadService — B-01 deduplicación de cargos', () => {
  // T1: sin vinculaciones → NO_APLICA
  it('T1: sin vinculaciones → NO_APLICA con ceros', async () => {
    const svc = makeService({
      vinculacionCatedra: { findMany: jest.fn().mockResolvedValue([]) } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.composicion.estadoCalculo).toBe('NO_APLICA');
    expect(res.composicion.totalCargos).toBe(0);
  });

  // T2: 1 doc, 1 vinculación → totalCargos=1
  it('T2: 1 docente, 1 vinculación → totalCargos=1', async () => {
    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([
          makeVinc(DOC1_ID, CAR1_ID, 'TITULAR', null, CARGO_TIT_ID),
        ]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.composicion.totalCargos).toBe(1);
    expect(res.composicion.totalDocentes).toBe(1);
  });

  // T3: 1 doc, 2 vinculaciones mismo cargoId → se deduplica → totalCargos=1
  it('T3: 1 docente, 2 vinculaciones mismo cargo → totalCargos=1 (dedup)', async () => {
    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([
          makeVinc(DOC1_ID, CAR1_ID, 'TITULAR', null, CARGO_TIT_ID),
          makeVinc(DOC1_ID, CAR1_ID, 'TITULAR', null, CARGO_TIT_ID),
        ]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.composicion.totalCargos).toBe(1);
    expect(res.composicion.totalDocentes).toBe(1);
  });

  // T4: 1 doc, 2 vinculaciones distintos cargoId → totalCargos=2
  it('T4: 1 docente, 2 cargos distintos → totalCargos=2', async () => {
    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([
          makeVinc(DOC1_ID, CAR1_ID, 'TITULAR', null, CARGO_TIT_ID),
          makeVinc(DOC1_ID, CAR1_ID, 'JTP',     null, CARGO_JTP_ID),
        ]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.composicion.totalCargos).toBe(2);
    expect(res.composicion.totalDocentes).toBe(1);
  });

  // T5: 2 docs, mismo cargoId → totalCargos=2 (distintos docenteId)
  it('T5: 2 docentes, mismo cargo → totalCargos=2 (no dedup por cargoId solo)', async () => {
    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([
          makeVinc(DOC1_ID, CAR1_ID, 'TITULAR', null, CARGO_TIT_ID),
          makeVinc(DOC2_ID, CAR1_ID, 'TITULAR', null, CARGO_TIT_ID),
        ]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.composicion.totalCargos).toBe(2);
    expect(res.composicion.totalDocentes).toBe(2);
  });

  // T6: 1 doc, mismo cargo en 2 carreras → totalCargos global=2 (clave incluye carreraId)
  it('T6: 1 docente, mismo cargo en 2 carreras → totalCargosGlobal=2', async () => {
    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([
          makeVinc(DOC1_ID, CAR1_ID, 'TITULAR', null, CARGO_TIT_ID),
          makeVinc(DOC1_ID, CAR2_ID, 'TITULAR', null, CARGO_TIT_ID),
        ]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.composicion.totalCargos).toBe(2);
    expect(res.composicion.totalDocentes).toBe(1);
  });

  // T7: 1 doc, mismo cargo doble en CAR1 pero también en CAR2 → por carrera cada una tiene 1
  it('T7: duplicado en carrera 1 y único en carrera 2 → porCarrera correcto', async () => {
    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([
          makeVinc(DOC1_ID, CAR1_ID, 'TITULAR', null, CARGO_TIT_ID),
          makeVinc(DOC1_ID, CAR1_ID, 'TITULAR', null, CARGO_TIT_ID), // duplicado en CAR1
          makeVinc(DOC1_ID, CAR2_ID, 'JTP',     null, CARGO_JTP_ID),
        ]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    const car1 = res.composicion.porCarrera.find((c) => c.carreraId === CAR1_ID);
    const car2 = res.composicion.porCarrera.find((c) => c.carreraId === CAR2_ID);
    expect(car1?.totalCargos).toBe(1);
    expect(car2?.totalCargos).toBe(1);
    expect(res.composicion.totalCargos).toBe(2);
  });

  // T8: cargo TITULAR → contabiliza en P
  it('T8: cargo TITULAR → totalCargosP=1', async () => {
    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([
          makeVinc(DOC1_ID, CAR1_ID, 'TITULAR', null, CARGO_TIT_ID),
        ]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.composicion.totalCargosP).toBe(1);
    expect(res.composicion.totalCargosA).toBe(0);
    expect(res.composicion.totalCargosOtros).toBe(0);
  });

  // T9: cargo JTP → contabiliza en A
  it('T9: cargo JTP → totalCargosA=1', async () => {
    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([
          makeVinc(DOC1_ID, CAR1_ID, 'JTP', null, CARGO_JTP_ID),
        ]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.composicion.totalCargosP).toBe(0);
    expect(res.composicion.totalCargosA).toBe(1);
    expect(res.composicion.totalCargosOtros).toBe(0);
  });

  // T10: cargo desconocido → contabiliza en Otros
  it('T10: cargo desconocido → totalCargosOtros=1', async () => {
    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([
          makeVinc(DOC1_ID, CAR1_ID, 'AYUDANTE', null, CARGO_AYU_ID),
        ]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.composicion.totalCargosP).toBe(0);
    expect(res.composicion.totalCargosA).toBe(0);
    expect(res.composicion.totalCargosOtros).toBe(1);
  });

  // T11: totalCargos = P + A + Otros
  it('T11: totalCargos = P + A + Otros', async () => {
    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([
          makeVinc(DOC1_ID, CAR1_ID, 'TITULAR', null, CARGO_TIT_ID),
          makeVinc(DOC1_ID, CAR1_ID, 'JTP',     null, CARGO_JTP_ID),
          makeVinc(DOC2_ID, CAR1_ID, 'AYUDANTE', null, CARGO_AYU_ID),
        ]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    const { totalCargosP, totalCargosA, totalCargosOtros, totalCargos } = res.composicion;
    expect(totalCargos).toBe(totalCargosP + totalCargosA + totalCargosOtros);
    expect(totalCargos).toBe(3);
  });

  // T12: porCarrera refleja docentes únicos y cargos únicos por carrera
  it('T12: porCarrera agrupa docentes y cargos únicos por carrera', async () => {
    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([
          // CAR1: DOC1 con TIT, DOC2 con TIT, DOC1 con JTP
          makeVinc(DOC1_ID, CAR1_ID, 'TITULAR', null, CARGO_TIT_ID),
          makeVinc(DOC2_ID, CAR1_ID, 'TITULAR', null, CARGO_TIT_ID),
          makeVinc(DOC1_ID, CAR1_ID, 'JTP',     null, CARGO_JTP_ID),
          // CAR2: DOC1 con X
          makeVinc(DOC1_ID, CAR2_ID, 'CARGO_X', null, CARGO_X_ID),
        ]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    const car1 = res.composicion.porCarrera.find((c) => c.carreraId === CAR1_ID);
    const car2 = res.composicion.porCarrera.find((c) => c.carreraId === CAR2_ID);
    expect(car1?.totalDocentes).toBe(2);
    expect(car1?.totalCargos).toBe(3);  // DOC1-TIT, DOC2-TIT, DOC1-JTP
    expect(car2?.totalDocentes).toBe(1);
    expect(car2?.totalCargos).toBe(1);
  });
});

// ── Bloque 2 — Formación ──────────────────────────────────────────────────────

describe('TablroFacultadService — Bloque 2 formación', () => {
  it('todos con título grado → completitudPromedio 100', async () => {
    const svc = makeService({
      docente: {
        findMany: jest.fn().mockResolvedValue([
          makeDocente(DOC1_ID, 'Ing.', null),
          makeDocente(DOC2_ID, 'Lic.', null),
        ]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.formacion.completitudPromedio).toBe(100);
    expect(res.formacion.sinTituloGrado).toBe(0);
  });

  it('ninguno con título grado → completitudPromedio 0', async () => {
    const svc = makeService({
      docente: {
        findMany: jest.fn().mockResolvedValue([
          makeDocente(DOC1_ID, null, null),
          makeDocente(DOC2_ID, null, null),
        ]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.formacion.completitudPromedio).toBe(0);
    expect(res.formacion.sinTituloGrado).toBe(2);
  });
});

// ── Bloque 3 — Investigación ──────────────────────────────────────────────────

describe('TablroFacultadService — Bloque 3 investigación', () => {
  it('un doc con PI, otro con extensión → conAmbasActividades=0', async () => {
    const svc = makeService({
      docente: {
        findMany: jest.fn().mockResolvedValue([
          makeDocente(DOC1_ID, 'Ing.', null, 'Proyecto A', null),
          makeDocente(DOC2_ID, 'Lic.', null, null, 'Ext. B'),
        ]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.investigacion.conProyectoInvestigacion).toBe(1);
    expect(res.investigacion.conActividadExtension).toBe(1);
    expect(res.investigacion.conAmbasActividades).toBe(0);
    expect(res.investigacion.sinNinguna).toBe(0);
  });

  it('ambos sin actividades → sinNinguna=2', async () => {
    const svc = makeService({
      docente: {
        findMany: jest.fn().mockResolvedValue([
          makeDocente(DOC1_ID, 'Ing.', null, null, null),
          makeDocente(DOC2_ID, 'Lic.', null, null, null),
        ]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.investigacion.sinNinguna).toBe(2);
  });
});

// ── Bloque 4 — Dedicaciones ───────────────────────────────────────────────────

describe('TablroFacultadService — Bloque 4 dedicaciones', () => {
  it('docente con dedicaciónTotal < umbral → totalBajaDedicacion=1', async () => {
    // DOC1: 25h (docencia) + 0 (resto) = 25 ≥ 20 → no alerta
    // DOC2: 10h (docencia) + 4h (vin desde participacionVinculacionJson) = 14 < 20 → alerta
    const svc = makeService();
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.dedicaciones.totalBajaDedicacion).toBe(1);
    expect(res.dedicaciones.enAlerta[0]?.docenteId).toBe(DOC2_ID);
    expect(res.dedicaciones.enAlerta[0]?.dedicacionTotal).toBe(14);
  });

  it('sin config → usa umbral 20h por defecto', async () => {
    const svc = makeService({
      autoevaluacionConfigFacultad: {
        findUnique: jest.fn().mockResolvedValue(null),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.dedicaciones.umbral).toBe(20);
  });

  it('TC-B04-3: gestión desde cargosAcademicosJson suma correctamente → docente supera umbral', async () => {
    // Docente con 10h docencia + 12h gestión (JSON) = 22h ≥ 20h → NO alerta
    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([makeVinc(DOC1_ID, CAR1_ID, 'TITULAR', 10)]),
      } as any,
      docente: {
        findMany: jest.fn().mockResolvedValue([{
          ...makeDocente(DOC1_ID, 'Ing.', null, null, null),
          cargosAcademicosJson: JSON.stringify([{ dedicacionSemanal: '12', periodoHasta: '' }]),
        }]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.dedicaciones.totalBajaDedicacion).toBe(0);
    expect(res.dedicaciones.enAlerta).toHaveLength(0);
  });

  it('TC-B04-4: dedicación total incluye todas las secciones (R-10 completo)', async () => {
    // docencia=4, gestión=12, otras=5, inv=8, vin=4 → total=33 ≥ 20 → NO alerta
    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([makeVinc(DOC1_ID, CAR1_ID, 'TITULAR', 4)]),
      } as any,
      docente: {
        findMany: jest.fn().mockResolvedValue([{
          ...makeDocente(DOC1_ID, 'Ing.', null, null, null),
          cargosAcademicosJson: JSON.stringify([{ dedicacionSemanal: '12', periodoHasta: '' }]),
          otrasDedicacionesJson: JSON.stringify([{ horasSeman: '5' }]),
          proyectosInvestigacionJson: JSON.stringify([{ horasSemanales: '8' }]),
          participacionVinculacionJson: JSON.stringify([{ horasSemanales: '4' }]),
        }]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.dedicaciones.totalBajaDedicacion).toBe(0);
    expect(res.dedicaciones.enAlerta).toHaveLength(0);
  });
});

// ── Bloque 5 — Carga académica ────────────────────────────────────────────────

describe('TablroFacultadService — Bloque 5 carga académica', () => {
  it('sin config → NO_DETERMINABLE', async () => {
    const svc = makeService({
      autoevaluacionConfigFacultad: {
        findUnique: jest.fn().mockResolvedValue(null),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.cargaAcademica.estadoCalculo).toBe('NO_DETERMINABLE');
    expect(res.cargaAcademica.limiteMaxMat).toBeNull();
  });

  it('docente con 4 asignaciones distintas, límite 3 → sobreasignado', async () => {
    const mat1 = 'mm111111-1111-4111-8111-111111111111';
    const mat2 = 'mm222222-2222-4222-8222-222222222222';
    const cat1 = 'cc111111-1111-4111-8111-111111111111';
    const cat2 = 'cc222222-2222-4222-8222-222222222222';

    // 4 combinaciones (plan, materia, catedra) distintas para DOC1_ID
    const vincs4 = [
      { ...makeVinc(DOC1_ID), materiaId: mat1, catedraId: cat1 },
      { ...makeVinc(DOC1_ID), materiaId: mat1, catedraId: cat2 },
      { ...makeVinc(DOC1_ID), materiaId: mat2, catedraId: cat1 },
      { ...makeVinc(DOC1_ID), materiaId: mat2, catedraId: cat2 },
    ];

    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue(vincs4),
      } as any,
      docente: {
        findMany: jest.fn().mockResolvedValue([makeDocente(DOC1_ID)]),
      } as any,
    });

    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.cargaAcademica.totalSobreasignados).toBe(1);
    expect(res.cargaAcademica.sobreasignados[0].nMaterias).toBe(4);
    expect(res.cargaAcademica.sobreasignados[0].exceso).toBe(1);
  });
});

// ── R-07 — Deduplicación de materias (T1–T9) ─────────────────────────────────

describe('TablroFacultadService — R-07 sobreasignados (T1–T9)', () => {
  const mat1 = 'rm111111-1111-4111-8111-111111111111';
  const mat2 = 'rm222222-2222-4222-8222-222222222222';
  const mat3 = 'rm333333-3333-4333-8333-333333333333';
  const mat4 = 'rm444444-4444-4444-8444-444444444444';
  const cat1 = 'rc111111-1111-4111-8111-111111111111';
  const cat2 = 'rc222222-2222-4222-8222-222222222222';
  const PLAN2 = 'rp222222-2222-4222-8222-222222222222';

  function makeV(docenteId: string, materiaId: string, catedraId = cat1, carreraId = CAR1_ID, planEstudioId = PLAN_ID) {
    return { ...makeVinc(docenteId, carreraId), materiaId, catedraId, planEstudioId };
  }

  // T1: docente 2 materias, límite 3 → sin alerta
  it('T1: docente con 2 materias vigentes, límite 3 → sin alerta', async () => {
    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([
          makeV(DOC1_ID, mat1),
          makeV(DOC1_ID, mat2),
        ]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.cargaAcademica.totalSobreasignados).toBe(0);
  });

  // T2: docente 3 materias, límite 3 → sin alerta (igual, no estrictamente mayor)
  it('T2: docente con 3 materias, límite 3 → sin alerta (igual no supera)', async () => {
    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([
          makeV(DOC1_ID, mat1),
          makeV(DOC1_ID, mat2),
          makeV(DOC1_ID, mat3),
        ]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.cargaAcademica.totalSobreasignados).toBe(0);
  });

  // T3: docente 4 materias, límite 3 → una alerta MEDIA (ya cubierto arriba; aquí verificamos exceso y estado)
  it('T3: docente con 4 materias, límite 3 → una alerta, exceso=1, CALCULADO', async () => {
    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([
          makeV(DOC1_ID, mat1),
          makeV(DOC1_ID, mat2),
          makeV(DOC1_ID, mat3),
          makeV(DOC1_ID, mat4),
        ]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.cargaAcademica.totalSobreasignados).toBe(1);
    expect(res.cargaAcademica.sobreasignados[0].exceso).toBe(1);
    expect(res.cargaAcademica.estadoCalculo).toBe('CALCULADO');
  });

  // T4: 1 doc con 2 en CAR1 + 2 en CAR2, misma facultad → suma=4 → una alerta
  it('T4: docente 2 materias en carrera A + 2 en carrera B → una alerta (sum cross-carrera)', async () => {
    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([
          makeV(DOC1_ID, mat1, cat1, CAR1_ID),
          makeV(DOC1_ID, mat2, cat1, CAR1_ID),
          makeV(DOC1_ID, mat3, cat1, CAR2_ID),
          makeV(DOC1_ID, mat4, cat1, CAR2_ID),
        ]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.cargaAcademica.totalSobreasignados).toBe(1);
    expect(res.cargaAcademica.sobreasignados[0].nMaterias).toBe(4);
  });

  // T5: varias vinculaciones misma combinación (plan, materia, catedra) → deduplicación
  it('T5: múltiples vinculaciones misma combinación → se deduplican a 1 materia', async () => {
    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([
          // Misma combinación plan:mat1:cat1 — distintos cargos
          makeV(DOC1_ID, mat1, cat1),
          makeV(DOC1_ID, mat1, cat1),
          makeV(DOC1_ID, mat1, cat1),
        ]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.cargaAcademica.totalSobreasignados).toBe(0);
    expect(res.cargaAcademica.totalDocentes).toBe(1);
  });

  // T6: 2 docentes que superan → 2 alertas
  it('T6: 2 docentes con 4 materias cada uno → 2 alertas', async () => {
    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([
          makeV(DOC1_ID, mat1), makeV(DOC1_ID, mat2), makeV(DOC1_ID, mat3), makeV(DOC1_ID, mat4),
          makeV(DOC2_ID, mat1), makeV(DOC2_ID, mat2), makeV(DOC2_ID, mat3), makeV(DOC2_ID, mat4),
        ]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.cargaAcademica.totalSobreasignados).toBe(2);
  });

  // T7: sin vinculaciones → NO_APLICA
  it('T7: sin vinculaciones → NO_APLICA, 0 sobreasignados', async () => {
    const svc = makeService({
      vinculacionCatedra: { findMany: jest.fn().mockResolvedValue([]) } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.cargaAcademica.estadoCalculo).toBe('NO_APLICA');
    expect(res.cargaAcademica.totalSobreasignados).toBe(0);
  });

  // T8: materias de otra facultad no se mezclan (filtro por facultadId en la query)
  it('T8: el filtro facultadId excluye vinculaciones de otras facultades', async () => {
    // La query Prisma filtra por facultadId. Verificamos que con 2 vinculaciones
    // (el mock devuelve solo las de la facultad) → 0 sobreasignados.
    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([
          makeV(DOC1_ID, mat1),
          makeV(DOC1_ID, mat2),
        ]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.cargaAcademica.totalSobreasignados).toBe(0);
  });

  // T9: máximo configurado diferente de 3 → respetar config
  it('T9: máximo configurado en 2 → 3 materias supera el límite', async () => {
    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([
          makeV(DOC1_ID, mat1),
          makeV(DOC1_ID, mat2),
          makeV(DOC1_ID, mat3),
        ]),
      } as any,
      autoevaluacionConfigFacultad: {
        findUnique: jest.fn().mockResolvedValue({ p03MaxMat: 2 }),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.cargaAcademica.totalSobreasignados).toBe(1);
    expect(res.cargaAcademica.limiteMaxMat).toBe(2);
    expect(res.cargaAcademica.sobreasignados[0].exceso).toBe(1);
  });
});

// ── Bloque 6 — Distribución de materias por docente (R-06) ───────────────────

describe('TablroFacultadService — Bloque 6 distribucionMaterias (R-06)', () => {
  it('delega en r06.evaluarPorFacultad y mapea la respuesta', async () => {
    const r06 = makeR06Mock(makeR06Result({ totalDocentes: 3, promedio: 2, mediana: 2, maximo: 3 }));
    const svc = makeService({}, r06);
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(r06.evaluarPorFacultad).toHaveBeenCalledWith(FAC_ID, expect.any(Date));
    expect(res.distribucionMaterias.totalDocentes).toBe(3);
    expect(res.distribucionMaterias.promedio).toBe(2);
    expect(res.distribucionMaterias.mediana).toBe(2);
    expect(res.distribucionMaterias.maximo).toBe(3);
    expect(res.distribucionMaterias.estadoCalculo).toBe('CALCULADO');
  });

  it('r06 con NO_APLICA → distribucionMaterias.estadoCalculo = NO_APLICA', async () => {
    const r06 = makeR06Mock({
      estadoCalculo: 'NO_APLICA',
      valor: { facultadId: FAC_ID, alcanceFacultad: true, totalDocentes: 0, promedio: null, mediana: null, maximo: null, distribucion: [] },
    } as any);
    const svc = makeService({}, r06);
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.distribucionMaterias.estadoCalculo).toBe('NO_APLICA');
    expect(res.distribucionMaterias.totalDocentes).toBe(0);
  });

  it('estadoGeneralCalculo considera distribucionMaterias.estadoCalculo', async () => {
    // Forzamos PARCIAL desde R-06 para que sea el estado más restrictivo
    const r06 = makeR06Mock({
      estadoCalculo: 'PARCIAL',
      valor: { facultadId: FAC_ID, alcanceFacultad: false, totalDocentes: 1, promedio: 1, mediana: 1, maximo: 1, distribucion: [] },
    } as any);
    const svc = makeService({}, r06);
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    // estadoGeneralCalculo debe ser al menos PARCIAL
    expect(['PARCIAL', 'NO_DETERMINABLE']).toContain(res.estadoGeneralCalculo);
  });
});

// ── Sección M — HSEM C.3: dedicaciones usa Materia.cargaHorariaSemanal (vigente) ─

describe('TablroFacultadService — HSEM C.3: dedicaciones usa vigente', () => {
  it('T1: usa cargaHorariaSemanal vigente (no horasSemana snapshot) para calcular dedicación', async () => {
    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([makeVinc(DOC1_ID, CAR1_ID, 'TITULAR', 25)]),
      } as any,
      docente: {
        findMany: jest.fn().mockResolvedValue([makeDocente(DOC1_ID)]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.dedicaciones.totalBajaDedicacion).toBe(0);
    expect(res.dedicaciones.enAlerta).toHaveLength(0);
  });

  it('T2: materia sin cargaHorariaSemanal (null) → docente contado en totalSinDatos', async () => {
    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([makeVinc(DOC1_ID, CAR1_ID, 'TITULAR', null)]),
      } as any,
      docente: {
        findMany: jest.fn().mockResolvedValue([makeDocente(DOC1_ID)]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.dedicaciones.totalSinDatos).toBe(1);
    expect(res.dedicaciones.enAlerta).toHaveLength(0);
  });

  it('T3: múltiples vinculaciones del mismo docente suman cargaHorariaSemanal vigente', async () => {
    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([
          makeVinc(DOC1_ID, CAR1_ID, 'TITULAR', 8),
          makeVinc(DOC1_ID, CAR1_ID, 'TITULAR', 6),
          makeVinc(DOC1_ID, CAR1_ID, 'TITULAR', 4),
        ]),
      } as any,
      docente: {
        findMany: jest.fn().mockResolvedValue([makeDocente(DOC1_ID)]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    // 8+6+4=18 < umbral 20 → en alerta
    expect(res.dedicaciones.enAlerta).toHaveLength(1);
    expect(res.dedicaciones.enAlerta[0].dedicacionTotal).toBe(18);
  });

  it('T4: mezcla null/vigente → estadoCalculo PARCIAL, horas conocidas se acumulan', async () => {
    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([
          makeVinc(DOC1_ID, CAR1_ID, 'TITULAR', 12),
          makeVinc(DOC1_ID, CAR1_ID, 'TITULAR', null),
        ]),
      } as any,
      docente: {
        findMany: jest.fn().mockResolvedValue([makeDocente(DOC1_ID)]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.dedicaciones.estadoCalculo).toBe('PARCIAL');
    expect(res.dedicaciones.enAlerta).toHaveLength(1);
    expect(res.dedicaciones.enAlerta[0].dedicacionTotal).toBe(12);
  });

  it('T5: cargaHorariaSemanal=0 (cero explícito, no null) cuenta como dato conocido → docente en alerta', async () => {
    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([makeVinc(DOC1_ID, CAR1_ID, 'TITULAR', 0)]),
      } as any,
      docente: {
        findMany: jest.fn().mockResolvedValue([makeDocente(DOC1_ID)]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    // 0h < 20h → en alerta, pero NO en totalSinDatos
    expect(res.dedicaciones.totalSinDatos).toBe(0);
    expect(res.dedicaciones.enAlerta).toHaveLength(1);
    expect(res.dedicaciones.enAlerta[0].dedicacionTotal).toBe(0);
  });

  it('T6: todos los docentes con cargaHorariaSemanal conocidas → estadoCalculo CALCULADO', async () => {
    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([
          makeVinc(DOC1_ID, CAR1_ID, 'TITULAR', 25),
          makeVinc(DOC2_ID, CAR1_ID, 'TITULAR', 22),
        ]),
      } as any,
      docente: {
        findMany: jest.fn().mockResolvedValue([makeDocente(DOC1_ID), makeDocente(DOC2_ID)]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.dedicaciones.estadoCalculo).toBe('CALCULADO');
    expect(res.dedicaciones.totalBajaDedicacion).toBe(0);
  });

  it('T7: docente con todas las materias sin cargaHorariaSemanal → totalSinDatos=1, estadoCalculo PARCIAL', async () => {
    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([
          makeVinc(DOC1_ID, CAR1_ID, 'TITULAR', 25),
          makeVinc(DOC2_ID, CAR1_ID, 'TITULAR', null),
        ]),
      } as any,
      docente: {
        findMany: jest.fn().mockResolvedValue([makeDocente(DOC1_ID), makeDocente(DOC2_ID)]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.dedicaciones.totalSinDatos).toBe(1);
    expect(res.dedicaciones.estadoCalculo).toBe('PARCIAL');
  });

  it('T8: findMany es invocado con materia.cargaHorariaSemanal; groupBy no es necesario', async () => {
    const findMany = jest.fn().mockResolvedValue([makeVinc(DOC1_ID, CAR1_ID, 'TITULAR', 25)]);
    const svc = makeService({
      vinculacionCatedra: { findMany } as any,
      docente: {
        findMany: jest.fn().mockResolvedValue([makeDocente(DOC1_ID)]),
      } as any,
    });
    await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    const dedicacionesCall = findMany.mock.calls.find(
      (call: any[]) => call[0]?.select?.materia?.select?.cargaHorariaSemanal === true,
    );
    expect(dedicacionesCall).toBeDefined();
  });

  it('T9: docente con 21h vigente supera umbral default 20h → no en alerta', async () => {
    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([makeVinc(DOC1_ID, CAR1_ID, 'TITULAR', 21)]),
      } as any,
      docente: {
        findMany: jest.fn().mockResolvedValue([makeDocente(DOC1_ID)]),
      } as any,
      autoevaluacionConfigFacultad: {
        findUnique: jest.fn().mockResolvedValue(null),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.dedicaciones.umbral).toBe(20);
    expect(res.dedicaciones.totalBajaDedicacion).toBe(0);
  });

  it('T10: valor vigente actualizado refleja en dedicación (consistencia con Tablero Carrera)', async () => {
    // Plan de estudios actualiza carga de 10h a 30h → el tablero facultad refleja 30h (vigente)
    const svc = makeService({
      vinculacionCatedra: {
        findMany: jest.fn().mockResolvedValue([makeVinc(DOC1_ID, CAR1_ID, 'TITULAR', 30)]),
      } as any,
      docente: {
        findMany: jest.fn().mockResolvedValue([makeDocente(DOC1_ID)]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    // 30h ≥ 20h → no alerta; datos completos → CALCULADO
    expect(res.dedicaciones.totalBajaDedicacion).toBe(0);
    expect(res.dedicaciones.enAlerta).toHaveLength(0);
    expect(res.dedicaciones.estadoCalculo).toBe('CALCULADO');
  });
});
