import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FichaDocenteService } from './ficha-docente.service';

// ── Constantes ────────────────────────────────────────────────────────────────

const DOC_ID   = 'doc-0001-0000-0000-000000000001';
const DOC_ID_2 = 'doc-0002-0000-0000-000000000002';
const CAR_ID   = 'car-0001-0000-0000-000000000001';
const CAR_ID_2 = 'car-0002-0000-0000-000000000002';
const PLAN_ID  = 'pla-0001-0000-0000-000000000001';
const FAC_ID   = 'fac-0001-0000-0000-000000000001';
const FAC_ID_2 = 'fac-0002-0000-0000-000000000002';
const VIN_ID   = 'vin-0001-0000-0000-000000000001';
const CARGO_ID = 'carg-001-0000-0000-000000000001';
const EJ_ID    = 'eje-0001-0000-0000-000000000001';
const USR_ID   = 'usr-0001-0000-0000-000000000001';

const ROL_ADMIN    = 'ADMINISTRADOR_SISTEMA';
const ROL_SEC      = 'SECRETARIA_ACADEMICA';
const ROL_RECTO    = 'RECTORADO';
const ROL_DECANO   = 'DECANO';
const ROL_DIRECTOR = 'DIRECTOR_CARRERA';
const ROL_DOCENTE  = 'DOCENTE';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeVinculacion(overrides: Partial<{
  id: string;
  carreraId: string;
  facultadId: string;
  planEstudioId: string;
  estado: string;
}> = {}) {
  return {
    id:           overrides.id ?? VIN_ID,
    carreraId:    overrides.carreraId ?? CAR_ID,
    facultadId:   overrides.facultadId ?? FAC_ID,
    planEstudioId: overrides.planEstudioId ?? PLAN_ID,
    estado:       overrides.estado ?? 'APROBADA',
    esResponsableCatedra: true,
    horasSemana:  6,
    anioInicio:   2024,
    fechaCreacion: new Date('2024-01-01'),
    materia:     { id: 'mat-001', nombre: 'Análisis Matemático I' },
    carrera:     { id: overrides.carreraId ?? CAR_ID, nombre: 'Ingeniería en Sistemas' },
    planEstudio: { id: overrides.planEstudioId ?? PLAN_ID, nombre: 'Plan 2020' },
    facultad:    { id: overrides.facultadId ?? FAC_ID, nombre: 'Facultad de Tecnología' },
  };
}

function makeDocente(overrides: Partial<{
  id: string;
  tituloGrado: string | null;
  tituloPosgrado: string | null;
  proyectosInvestigacionJson: string | null;
  dedicacion: string | null;
  vinculaciones: ReturnType<typeof makeVinculacion>[];
  cargosInstitucionales: unknown[];
}> = {}) {
  const o = overrides;
  return {
    id:                         o.id ?? DOC_ID,
    nombre:                     'María',
    apellido:                   'García',
    tipoDocumento:              'DNI',
    numeroDocumento:            '30000001',
    correoElectronico:          'maria@udemm.edu.ar',
    activo:                     true,
    dedicacion:                 o.dedicacion !== undefined ? o.dedicacion : 'SEMI_EXCLUSIVA',
    categoriaDocente:           'TITULAR',
    tituloGrado:                o.tituloGrado !== undefined ? o.tituloGrado : 'Ingeniera en Sistemas',
    tituloPosgrado:             o.tituloPosgrado !== undefined ? o.tituloPosgrado : 'Magíster en Educación',
    otrosTitulos:               null,
    actividadesPosgradoJson:    null,
    relevamientoCargosCompleto: true,
    tituloProyectoInvestigacion: 'IA aplicada',
    proyectosInvestigacionJson:  o.proyectosInvestigacionJson !== undefined ? o.proyectosInvestigacionJson : '[{"titulo":"IA"}]',
    produccionCientificaJson:    null,
    vinculaciones:               o.vinculaciones ?? [makeVinculacion()],
    cargosInstitucionales:       o.cargosInstitucionales ?? [
      {
        id:          CARGO_ID,
        designacion: 'Simple',
        fechaInicio: new Date('2022-01-01'),
        fechaFin:    null,
        verificado:  true,
        fuente:      'SECRETARIA',
        cargo:       { nombre: 'Profesor Titular' },
      },
    ],
  };
}

function makeEjecucion(ambito: 'CARRERA' | 'PLAN', entidadId: string) {
  return {
    id:         EJ_ID,
    ambito,
    entidadId,
    facultadId: FAC_ID,
    fechaFin:   new Date('2026-10-01'),
    snapshot:   { estadoGeneralCalculo: 'CALCULADO' },
  };
}

// ── Fábrica del servicio ───────────────────────────────────────────────────────

function buildService(overrides: {
  docenteFindUnique?: jest.Mock;
  usuarioFacultadFindFirst?: jest.Mock;
  analisisEjecucionFindMany?: jest.Mock;
  getCarrerasEnScope?: jest.Mock;
}) {
  const prisma = {
    docente: {
      findUnique: overrides.docenteFindUnique ?? jest.fn().mockResolvedValue(makeDocente()),
    },
    usuarioFacultad: {
      findFirst: overrides.usuarioFacultadFindFirst ?? jest.fn().mockResolvedValue({ facultadId: FAC_ID }),
    },
    analisisEjecucion: {
      findMany: overrides.analisisEjecucionFindMany ?? jest.fn().mockResolvedValue([]),
    },
  } as any;

  const scopeSvc = {
    getCarrerasEnScope: overrides.getCarrerasEnScope ?? jest.fn().mockResolvedValue([CAR_ID]),
  } as any;

  return new FichaDocenteService(prisma, scopeSvc);
}

// ════════════════════════════════════════════════════════════════════════════
// 1. Docente completo — retorna ficha con todos los campos
// ════════════════════════════════════════════════════════════════════════════

describe('G1: docente completo', () => {
  it('retorna todos los campos de identificación', async () => {
    const svc = buildService({});
    const ficha = await svc.obtenerFicha(DOC_ID, USR_ID, ROL_ADMIN);
    expect(ficha.identificacion.id).toBe(DOC_ID);
    expect(ficha.identificacion.nombreCompleto).toBe('García, María');
    expect(ficha.identificacion.tituloGrado).toBe('Ingeniera en Sistemas');
    expect(ficha.identificacion.tituloPosgrado).toBe('Magíster en Educación');
    expect(ficha.identificacion.dedicacion).toBe('SEMI_EXCLUSIVA');
  });

  it('retorna formación académica', async () => {
    const svc = buildService({});
    const ficha = await svc.obtenerFicha(DOC_ID, USR_ID, ROL_SEC);
    expect(ficha.formacionAcademica.tituloGrado).toBe('Ingeniera en Sistemas');
    expect(ficha.formacionAcademica.tituloPosgrado).toBe('Magíster en Educación');
  });

  it('retorna actividades de investigación', async () => {
    const svc = buildService({});
    const ficha = await svc.obtenerFicha(DOC_ID, USR_ID, ROL_RECTO);
    expect(ficha.actividadesInvestigacion.tituloProyectoInvestigacion).toBe('IA aplicada');
    expect(ficha.actividadesInvestigacion.proyectosInvestigacionJson).toBe('[{"titulo":"IA"}]');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. Docente parcial — campos opcionales ausentes
// ════════════════════════════════════════════════════════════════════════════

describe('G2: docente sin formación completa', () => {
  it('devuelve null en campos de formación vacíos', async () => {
    const svc = buildService({
      docenteFindUnique: jest.fn().mockResolvedValue(makeDocente({
        tituloGrado: null,
        tituloPosgrado: null,
        proyectosInvestigacionJson: null,
        dedicacion: null,
      })),
    });
    const ficha = await svc.obtenerFicha(DOC_ID, USR_ID, ROL_ADMIN);
    expect(ficha.identificacion.tituloGrado).toBeNull();
    expect(ficha.identificacion.tituloPosgrado).toBeNull();
    expect(ficha.identificacion.dedicacion).toBeNull();
    expect(ficha.actividadesInvestigacion.proyectosInvestigacionJson).toBeNull();
  });

  it('completitud.porcentaje es 0 con todos los campos vacíos', async () => {
    const svc = buildService({
      docenteFindUnique: jest.fn().mockResolvedValue(makeDocente({
        tituloGrado: null,
        tituloPosgrado: null,
        proyectosInvestigacionJson: null,
        dedicacion: null,
      })),
    });
    const ficha = await svc.obtenerFicha(DOC_ID, USR_ID, ROL_ADMIN);
    expect(ficha.completitud.porcentaje).toBe(0);
    expect(ficha.completitud.tieneFormacionBasica).toBe(false);
    expect(ficha.completitud.tienePosgrado).toBe(false);
    expect(ficha.completitud.tieneActividadInvestigacion).toBe(false);
    expect(ficha.completitud.tieneDedicacion).toBe(false);
  });

  it('completitud.porcentaje es 100 con todos los campos llenos', async () => {
    const svc = buildService({});
    const ficha = await svc.obtenerFicha(DOC_ID, USR_ID, ROL_ADMIN);
    expect(ficha.completitud.porcentaje).toBe(100);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. Múltiples cargos — lista todos
// ════════════════════════════════════════════════════════════════════════════

describe('G3: múltiples cargos institucionales', () => {
  it('lista todos los cargos del docente', async () => {
    const cargos = [
      {
        id:          'cargo-01',
        designacion: 'Exclusiva',
        fechaInicio: new Date('2020-01-01'),
        fechaFin:    null,
        verificado:  true,
        fuente:      'SECRETARIA',
        cargo:       { nombre: 'Profesor Titular' },
      },
      {
        id:          'cargo-02',
        designacion: 'Simple',
        fechaInicio: new Date('2018-03-01'),
        fechaFin:    new Date('2022-12-31'),
        verificado:  false,
        fuente:      'IMPORTADO',
        cargo:       { nombre: 'Jefe de Trabajos Prácticos' },
      },
    ];
    const svc = buildService({
      docenteFindUnique: jest.fn().mockResolvedValue(makeDocente({ cargosInstitucionales: cargos })),
    });
    const ficha = await svc.obtenerFicha(DOC_ID, USR_ID, ROL_ADMIN);
    expect(ficha.cargosInstitucionales).toHaveLength(2);
    expect(ficha.cargosInstitucionales[0].cargoNombre).toBe('Profesor Titular');
    expect(ficha.cargosInstitucionales[1].cargoNombre).toBe('Jefe de Trabajos Prácticos');
  });

  it('retorna lista vacía cuando no hay cargos', async () => {
    const svc = buildService({
      docenteFindUnique: jest.fn().mockResolvedValue(makeDocente({ cargosInstitucionales: [] })),
    });
    const ficha = await svc.obtenerFicha(DOC_ID, USR_ID, ROL_ADMIN);
    expect(ficha.cargosInstitucionales).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. Vigencia de cargos
// ════════════════════════════════════════════════════════════════════════════

describe('G4: vigencia de cargos', () => {
  it('cargo sin fechaFin es vigente', async () => {
    const svc = buildService({});
    const ficha = await svc.obtenerFicha(DOC_ID, USR_ID, ROL_ADMIN);
    expect(ficha.cargosInstitucionales[0].vigente).toBe(true);
    expect(ficha.cargosInstitucionales[0].fechaFin).toBeNull();
  });

  it('cargo con fechaFin en el pasado no es vigente', async () => {
    const cargos = [
      {
        id:          'cargo-hist',
        designacion: null,
        fechaInicio: new Date('2015-01-01'),
        fechaFin:    new Date('2020-01-01'),
        verificado:  true,
        fuente:      'SECRETARIA',
        cargo:       { nombre: 'Auxiliar Docente' },
      },
    ];
    const svc = buildService({
      docenteFindUnique: jest.fn().mockResolvedValue(makeDocente({ cargosInstitucionales: cargos })),
    });
    const ficha = await svc.obtenerFicha(DOC_ID, USR_ID, ROL_ADMIN);
    expect(ficha.cargosInstitucionales[0].vigente).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. Alertas históricas del scope
// ════════════════════════════════════════════════════════════════════════════

describe('G5: alertas históricas en scope', () => {
  it('extrae alertas de la última ejecución COMPLETADA de la carrera del docente', async () => {
    const snapConAlerta = {
      estadoGeneralCalculo: 'PARCIAL',
      ip13: { totalSobreasignados: 2, estadoCalculo: 'CALCULADO' },
    };
    const svc = buildService({
      analisisEjecucionFindMany: jest.fn()
        .mockResolvedValueOnce([
          { id: EJ_ID, ambito: 'CARRERA', entidadId: CAR_ID, facultadId: FAC_ID, fechaFin: new Date('2026-10-01'), snapshot: snapConAlerta },
        ])
        .mockResolvedValueOnce([]),
    });
    const ficha = await svc.obtenerFicha(DOC_ID, USR_ID, ROL_ADMIN);
    expect(ficha.alertasEnScope.length).toBeGreaterThan(0);
    expect(ficha.alertasEnScope[0].regla).toBe('IP-13');
    expect(ficha.alertasEnScope[0].ambito).toBe('CARRERA');
    expect(ficha.alertasEnScope[0].entidadId).toBe(CAR_ID);
  });

  it('solo toma la ejecución más reciente cuando hay varias para la misma carrera', async () => {
    const snapViejo = { estadoGeneralCalculo: 'PARCIAL', ip13: { totalSobreasignados: 1, estadoCalculo: 'CALCULADO' } };
    const snapNuevo = { estadoGeneralCalculo: 'CALCULADO' };
    const svc = buildService({
      analisisEjecucionFindMany: jest.fn()
        .mockResolvedValueOnce([
          { id: 'ej-new', ambito: 'CARRERA', entidadId: CAR_ID, facultadId: FAC_ID, fechaFin: new Date('2026-10-02'), snapshot: snapNuevo },
          { id: 'ej-old', ambito: 'CARRERA', entidadId: CAR_ID, facultadId: FAC_ID, fechaFin: new Date('2026-09-01'), snapshot: snapViejo },
        ])
        .mockResolvedValueOnce([]),
    });
    const ficha = await svc.obtenerFicha(DOC_ID, USR_ID, ROL_ADMIN);
    // snapNuevo no genera alertas IP-13
    const alertasIP13 = ficha.alertasEnScope.filter(a => a.regla === 'IP-13');
    expect(alertasIP13).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. Sin alertas
// ════════════════════════════════════════════════════════════════════════════

describe('G6: sin alertas en scope', () => {
  it('retorna alertasEnScope vacío cuando no hay ejecuciones', async () => {
    const svc = buildService({
      analisisEjecucionFindMany: jest.fn().mockResolvedValue([]),
    });
    const ficha = await svc.obtenerFicha(DOC_ID, USR_ID, ROL_ADMIN);
    expect(ficha.alertasEnScope).toEqual([]);
  });

  it('retorna alertasEnScope vacío para docente sin vinculaciones', async () => {
    const svc = buildService({
      docenteFindUnique: jest.fn().mockResolvedValue(makeDocente({ vinculaciones: [] })),
    });
    const ficha = await svc.obtenerFicha(DOC_ID, USR_ID, ROL_ADMIN);
    expect(ficha.alertasEnScope).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 7. Aislamiento por facultad (DECANO)
// ════════════════════════════════════════════════════════════════════════════

describe('G7: aislamiento por facultad — DECANO', () => {
  it('DECANO con facultad coincidente puede ver la ficha', async () => {
    const svc = buildService({
      usuarioFacultadFindFirst: jest.fn().mockResolvedValue({ facultadId: FAC_ID }),
    });
    await expect(svc.obtenerFicha(DOC_ID, USR_ID, ROL_DECANO)).resolves.toBeDefined();
  });

  it('DECANO de otra facultad recibe 403', async () => {
    const svc = buildService({
      usuarioFacultadFindFirst: jest.fn().mockResolvedValue({ facultadId: FAC_ID_2 }),
    });
    await expect(svc.obtenerFicha(DOC_ID, USR_ID, ROL_DECANO)).rejects.toThrow(ForbiddenException);
  });

  it('DECANO sin UsuarioFacultad recibe 403', async () => {
    const svc = buildService({
      usuarioFacultadFindFirst: jest.fn().mockResolvedValue(null),
    });
    await expect(svc.obtenerFicha(DOC_ID, USR_ID, ROL_DECANO)).rejects.toThrow(ForbiddenException);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 8. Aislamiento por carrera (DIRECTOR_CARRERA)
// ════════════════════════════════════════════════════════════════════════════

describe('G8: aislamiento por carrera — DIRECTOR_CARRERA', () => {
  it('DIRECTOR con scope coincidente puede ver la ficha', async () => {
    const svc = buildService({
      getCarrerasEnScope: jest.fn().mockResolvedValue([CAR_ID]),
    });
    await expect(svc.obtenerFicha(DOC_ID, USR_ID, ROL_DIRECTOR)).resolves.toBeDefined();
  });

  it('DIRECTOR de otra carrera recibe 403', async () => {
    const svc = buildService({
      getCarrerasEnScope: jest.fn().mockResolvedValue([CAR_ID_2]),
    });
    await expect(svc.obtenerFicha(DOC_ID, USR_ID, ROL_DIRECTOR)).rejects.toThrow(ForbiddenException);
  });

  it('DIRECTOR sin scope recibe 403', async () => {
    const svc = buildService({
      getCarrerasEnScope: jest.fn().mockResolvedValue([]),
    });
    await expect(svc.obtenerFicha(DOC_ID, USR_ID, ROL_DIRECTOR)).rejects.toThrow(ForbiddenException);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 9. Roles autorizados y denegados
// ════════════════════════════════════════════════════════════════════════════

describe('G9: control de acceso por rol', () => {
  it.each([ROL_ADMIN, ROL_SEC, ROL_RECTO])('%s → puede obtener ficha', async (rol) => {
    const svc = buildService({});
    await expect(svc.obtenerFicha(DOC_ID, USR_ID, rol)).resolves.toBeDefined();
  });

  it('DOCENTE → 403', async () => {
    const svc = buildService({});
    await expect(svc.obtenerFicha(DOC_ID, USR_ID, ROL_DOCENTE)).rejects.toThrow(ForbiddenException);
  });

  it('ADMINISTRATIVO → 403', async () => {
    const svc = buildService({});
    await expect(svc.obtenerFicha(DOC_ID, USR_ID, 'ADMINISTRATIVO')).rejects.toThrow(ForbiddenException);
  });

  it('docente inexistente → 404', async () => {
    const svc = buildService({
      docenteFindUnique: jest.fn().mockResolvedValue(null),
    });
    await expect(svc.obtenerFicha('no-existe', USR_ID, ROL_ADMIN)).rejects.toThrow(NotFoundException);
  });
});
