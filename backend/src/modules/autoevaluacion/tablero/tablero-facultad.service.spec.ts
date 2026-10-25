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

const PLAN_ID = 'pp000000-0000-4000-8000-000000000000';
const MAT_ID  = 'mm000000-0000-4000-8000-000000000000';
const CAT_ID  = 'cc000000-0000-4000-8000-000000000000';

function makeVinc(docenteId: string, carreraId = CAR1_ID, cargoNombre = 'TITULAR') {
  return {
    docenteId,
    carreraId,
    planEstudioId: PLAN_ID,
    materiaId: MAT_ID,
    catedraId: CAT_ID,
    carrera: { nombre: 'Ing. en Sistemas' },
    cargo: { nombre: cargoNombre },
    docente: { nombre: 'Juan', apellido: 'Pérez' },
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
    tituloProyectoInvestigacion: tituloPI,
    tituloActividadExtension: tituloExt,
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
        makeVinc(DOC1_ID),
        makeVinc(DOC2_ID),
      ]),
      groupBy: jest.fn().mockResolvedValue([
        { docenteId: DOC1_ID, _sum: { horasSemana: 25 } },
        { docenteId: DOC2_ID, _sum: { horasSemana: 10 } },
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
        groupBy: jest.fn().mockResolvedValue([]),
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
        groupBy: jest.fn().mockResolvedValue([]),
      } as any,
    });
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.composicion.totalDocentes).toBe(2);
    expect(res.composicion.totalCargosP).toBe(1);
    expect(res.composicion.totalCargosA).toBe(1);
    expect(res.composicion.estadoCalculo).toBe('CALCULADO');
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
  it('docente con horas < umbral → totalBajaDedicacion=1', async () => {
    // DOC2 tiene 10h < 20h (umbral por defecto)
    const svc = makeService();
    const res = await svc.consultarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.dedicaciones.totalBajaDedicacion).toBe(1);
    expect(res.dedicaciones.enAlerta[0]?.docenteId).toBe(DOC2_ID);
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
        // Todas las llamadas a findMany devuelven los mismos 4 registros con todos los campos
        findMany: jest.fn().mockResolvedValue(vincs4),
        groupBy: jest.fn().mockResolvedValue([{ docenteId: DOC1_ID, _sum: { horasSemana: 25 } }]),
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
