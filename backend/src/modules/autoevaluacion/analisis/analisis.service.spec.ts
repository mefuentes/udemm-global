import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AnalisisService } from './analisis.service';

// ── UUIDs de prueba ───────────────────────────────────────────────────────────

const FAC_ID  = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CAR_ID  = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PLAN_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const USER_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const EJEC_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

// ── Fixtures de resultados de tablero ─────────────────────────────────────────

function makeFacultadResult(estado = 'CALCULADO') {
  return {
    facultadId: FAC_ID,
    fechaEvaluacion: '2026-10-23T10:00:00.000Z',
    estadoGeneralCalculo: estado,
    composicion: { estadoCalculo: estado },
    formacion: { estadoCalculo: estado },
    investigacion: { estadoCalculo: estado },
    dedicaciones: { estadoCalculo: estado },
    cargaAcademica: { estadoCalculo: estado },
  };
}

function makeCarreraResult(estado = 'CALCULADO') {
  return {
    carreraId: CAR_ID,
    fechaEvaluacion: '2026-10-23T10:00:00.000Z',
    estadoGeneralCalculo: estado,
    ip01: { estadoCalculo: estado },
    ip02: { estadoCalculo: estado },
    ip03: { estadoCalculo: estado },
    ip04: { estadoCalculo: estado },
    ip08: { estadoCalculo: estado },
    ip09: { estadoCalculo: estado },
    ip10: { estadoCalculo: estado },
    ip13: { estadoCalculo: estado },
    r10:  { estadoCalculo: estado },
    r12:  { estadoCalculo: estado },
  };
}

function makePlanResult(estado = 'CALCULADO') {
  return {
    planEstudioId: PLAN_ID,
    fechaEvaluacion: '2026-10-23T10:00:00.000Z',
    estadoGeneralCalculo: estado,
    ipl01: { estadoCalculo: estado },
    ipl02: { estadoCalculo: estado },
    ipl03: { estadoCalculo: estado },
    ipl04: { estadoCalculo: estado },
    ipl05: { estadoCalculo: estado },
    r11:   { estadoCalculo: estado },
    r13:   { estadoCalculo: estado },
    r14:   { estadoCalculo: estado },
  };
}

// ── Mock de PrismaService ─────────────────────────────────────────────────────

function makeRegistro(overrides: object = {}) {
  return {
    id: EJEC_ID,
    ambito: 'FACULTAD',
    entidadId: FAC_ID,
    facultadId: FAC_ID,
    usuarioId: USER_ID,
    estado: 'COMPLETADO',
    fechaInicio: new Date('2026-10-23T10:00:00.000Z'),
    fechaFin:    new Date('2026-10-23T10:00:05.000Z'),
    errores: null,
    snapshot: null,
    versionFormato: '1',
    ...overrides,
  };
}

function makePrisma(overrides: {
  createResult?: object;
  updateResult?: object;
  findUniqueResult?: object | null;
  transactionResult?: [number, object[]];
} = {}) {
  const createResult  = overrides.createResult  ?? makeRegistro({ estado: 'EN_CURSO', fechaFin: null });
  const updateResult  = overrides.updateResult  ?? makeRegistro();
  const findUnique    = overrides.findUniqueResult !== undefined ? overrides.findUniqueResult : makeRegistro();
  const txResult      = overrides.transactionResult ?? [0, []];

  return {
    analisisEjecucion: {
      create:     jest.fn().mockResolvedValue(createResult),
      update:     jest.fn().mockResolvedValue(updateResult),
      findUnique: jest.fn().mockResolvedValue(findUnique),
      count:      jest.fn().mockResolvedValue(txResult[0]),
      findMany:   jest.fn().mockResolvedValue(txResult[1]),
    },
    carrera:          { findUnique: jest.fn().mockResolvedValue({ facultadId: FAC_ID }) },
    planEstudio:      { findUnique: jest.fn().mockResolvedValue({ carrera: { facultadId: FAC_ID }, carreraId: CAR_ID }) },
    usuarioFacultad:  { findFirst: jest.fn().mockResolvedValue({ facultadId: FAC_ID }) },
  };
}

function makeScope() {
  return { getCarrerasEnScope: jest.fn().mockResolvedValue([CAR_ID]) };
}

function makeService(opts: {
  tableroFacultad?: object;
  tableroCarrera?: object;
  tableroPlan?: object;
  prisma?: ReturnType<typeof makePrisma>;
} = {}) {
  const prisma = opts.prisma ?? makePrisma();
  const scope = makeScope();
  const tableroFacultad = {
    consultarFacultad: jest.fn().mockResolvedValue(makeFacultadResult()),
    ...opts.tableroFacultad,
  };
  const tableroCarrera = {
    consultarCarrera: jest.fn().mockResolvedValue(makeCarreraResult()),
    ...opts.tableroCarrera,
  };
  const tableroPlan = {
    consultarPlan: jest.fn().mockResolvedValue(makePlanResult()),
    ...opts.tableroPlan,
  };
  return {
    svc: new AnalisisService(prisma as any, scope as any, tableroFacultad as any, tableroCarrera as any, tableroPlan as any),
    prisma,
  };
}

// ── Separación de operaciones — tablero no genera ejecución ───────────────────

describe('AnalisisService — separación de operaciones', () => {
  it('ejecutarFacultad no llama tableroPlan ni tableroCarrera', async () => {
    const { svc } = makeService();
    await svc.ejecutarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect((svc as any).tableroCarrera.consultarCarrera).not.toHaveBeenCalled();
    expect((svc as any).tableroPlan.consultarPlan).not.toHaveBeenCalled();
  });

  it('ejecutarCarrera no llama tableroFacultad ni tableroPlan', async () => {
    const { svc } = makeService();
    await svc.ejecutarCarrera(CAR_ID, USER_ID, 'SECRETARIA_ACADEMICA');
    expect((svc as any).tableroFacultad.consultarFacultad).not.toHaveBeenCalled();
    expect((svc as any).tableroPlan.consultarPlan).not.toHaveBeenCalled();
  });

  it('ejecutarPlan no llama tableroFacultad ni tableroCarrera', async () => {
    const { svc } = makeService();
    await svc.ejecutarPlan(PLAN_ID, USER_ID, 'DIRECTOR_CARRERA');
    expect((svc as any).tableroFacultad.consultarFacultad).not.toHaveBeenCalled();
    expect((svc as any).tableroCarrera.consultarCarrera).not.toHaveBeenCalled();
  });
});

// ── Persistencia exitosa ──────────────────────────────────────────────────────

describe('AnalisisService — persistencia exitosa', () => {
  it('ejecutarFacultad persiste y retorna GUARDADO', async () => {
    const { svc, prisma } = makeService();
    const res = await svc.ejecutarFacultad(FAC_ID, USER_ID, 'DECANO');

    expect(prisma.analisisEjecucion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ambito: 'FACULTAD', entidadId: FAC_ID, estado: 'EN_CURSO' }) }),
    );
    expect(prisma.analisisEjecucion.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: 'COMPLETADO' }) }),
    );
    expect(res.metadata.estadoPersistencia).toBe('GUARDADO');
    expect(res.metadata.ejecucionId).toBe(EJEC_ID);
  });

  it('ejecutarCarrera persiste con facultadId correcto', async () => {
    const { svc, prisma } = makeService();
    await svc.ejecutarCarrera(CAR_ID, USER_ID, 'SECRETARIA_ACADEMICA');

    expect(prisma.carrera.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: CAR_ID } }),
    );
    expect(prisma.analisisEjecucion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ambito: 'CARRERA', facultadId: FAC_ID }) }),
    );
    expect(prisma.analisisEjecucion.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: 'COMPLETADO' }) }),
    );
  });

  it('ejecutarPlan resuelve facultadId vía plan→carrera', async () => {
    const { svc, prisma } = makeService();
    await svc.ejecutarPlan(PLAN_ID, USER_ID, 'DIRECTOR_CARRERA');

    expect(prisma.planEstudio.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: PLAN_ID } }),
    );
    expect(prisma.analisisEjecucion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ambito: 'PLAN', facultadId: FAC_ID }) }),
    );
  });

  it('snapshot guarda el resultado completo del tablero', async () => {
    const resultado = makeFacultadResult();
    const { svc, prisma } = makeService({
      tableroFacultad: { consultarFacultad: jest.fn().mockResolvedValue(resultado) },
    });
    await svc.ejecutarFacultad(FAC_ID, USER_ID, 'DECANO');

    const updateCall = (prisma.analisisEjecucion.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.data.snapshot).toEqual(resultado);
  });

  it('retorna estadoCalculo del resultado del tablero en metadata', async () => {
    const prisma = makePrisma({
      updateResult: makeRegistro({ snapshot: makeFacultadResult('PARCIAL') }),
    });
    const { svc } = makeService({
      tableroFacultad: { consultarFacultad: jest.fn().mockResolvedValue(makeFacultadResult('PARCIAL')) },
      prisma,
    });
    const res = await svc.ejecutarFacultad(FAC_ID, USER_ID, 'DECANO');
    expect(res.metadata.estadoCalculo).toBe('PARCIAL');
  });
});

// ── Persistencia de errores ───────────────────────────────────────────────────

describe('AnalisisService — errores de ejecución', () => {
  it('persiste estado ERROR cuando el tablero lanza', async () => {
    const { svc, prisma } = makeService({
      tableroFacultad: { consultarFacultad: jest.fn().mockRejectedValue(new Error('DB timeout')) },
    });
    await expect(svc.ejecutarFacultad(FAC_ID, USER_ID, 'DECANO')).rejects.toThrow('DB timeout');

    expect(prisma.analisisEjecucion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estado: 'ERROR', errores: 'DB timeout' }),
      }),
    );
  });

  it('persiste ERROR para carrera cuando el tablero falla', async () => {
    const { svc, prisma } = makeService({
      tableroCarrera: { consultarCarrera: jest.fn().mockRejectedValue(new Error('Plan not found')) },
    });
    await expect(svc.ejecutarCarrera(CAR_ID, USER_ID, 'SECRETARIA_ACADEMICA')).rejects.toThrow('Plan not found');
    expect(prisma.analisisEjecucion.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: 'ERROR' }) }),
    );
  });

  it('fallo en _facultadDeCarrera (carrera no existe) lanza NotFoundException antes de crear registro', async () => {
    const prisma = makePrisma();
    (prisma.carrera.findUnique as jest.Mock).mockResolvedValue(null);
    const { svc } = makeService({ prisma });
    await expect(svc.ejecutarCarrera(CAR_ID, USER_ID, 'SECRETARIA_ACADEMICA')).rejects.toThrow(NotFoundException);
    expect(prisma.analisisEjecucion.create).not.toHaveBeenCalled();
  });

  it('fallo en _facultadDePlan (plan no existe) lanza NotFoundException antes de crear registro', async () => {
    const prisma = makePrisma();
    (prisma.planEstudio.findUnique as jest.Mock).mockResolvedValue(null);
    const { svc } = makeService({ prisma });
    await expect(svc.ejecutarPlan(PLAN_ID, USER_ID, 'SECRETARIA_ACADEMICA')).rejects.toThrow(NotFoundException);
    expect(prisma.analisisEjecucion.create).not.toHaveBeenCalled();
  });
});

// ── Control de acceso ─────────────────────────────────────────────────────────

describe('AnalisisService — control de acceso', () => {
  it('DIRECTOR_CARRERA bloqueado en ejecutarFacultad', async () => {
    const { svc } = makeService();
    await expect(svc.ejecutarFacultad(FAC_ID, USER_ID, 'DIRECTOR_CARRERA')).rejects.toThrow(ForbiddenException);
  });

  it('DOCENTE bloqueado en ejecutarFacultad', async () => {
    const { svc } = makeService();
    await expect(svc.ejecutarFacultad(FAC_ID, USER_ID, 'DOCENTE')).rejects.toThrow(ForbiddenException);
  });

  it('DIRECTOR_CARRERA puede ejecutar análisis de carrera', async () => {
    const { svc } = makeService();
    const res = await svc.ejecutarCarrera(CAR_ID, USER_ID, 'DIRECTOR_CARRERA');
    expect(res.metadata.ambito).toBe('CARRERA');
  });

  it('DOCENTE bloqueado en ejecutarCarrera', async () => {
    const { svc } = makeService();
    await expect(svc.ejecutarCarrera(CAR_ID, USER_ID, 'DOCENTE')).rejects.toThrow(ForbiddenException);
  });

  it('DIRECTOR_CARRERA puede ejecutar análisis de plan', async () => {
    const { svc } = makeService();
    const res = await svc.ejecutarPlan(PLAN_ID, USER_ID, 'DIRECTOR_CARRERA');
    expect(res.metadata.ambito).toBe('PLAN');
  });

  it('DIRECTOR_CARRERA bloqueado en obtenerHistorialFacultad', async () => {
    const { svc } = makeService();
    await expect(svc.obtenerHistorialFacultad(FAC_ID, 'DIRECTOR_CARRERA')).rejects.toThrow(ForbiddenException);
  });

  it('DOCENTE bloqueado en obtenerHistorialCarrera', async () => {
    const { svc } = makeService();
    await expect(svc.obtenerHistorialCarrera(CAR_ID, 'DOCENTE')).rejects.toThrow(ForbiddenException);
  });

  it('DOCENTE bloqueado en obtenerDetalle', async () => {
    const { svc } = makeService();
    await expect(svc.obtenerDetalle(EJEC_ID, 'DOCENTE', USER_ID)).rejects.toThrow(ForbiddenException);
  });
});

// ── Historial vacío ───────────────────────────────────────────────────────────

describe('AnalisisService — historial vacío', () => {
  it('retorna total=0 e items=[] cuando no hay ejecuciones', async () => {
    const { svc } = makeService({ prisma: makePrisma({ transactionResult: [0, []] }) });
    const h = await svc.obtenerHistorialFacultad(FAC_ID, 'DECANO');
    expect(h.total).toBe(0);
    expect(h.items).toHaveLength(0);
    expect(h.ambito).toBe('FACULTAD');
    expect(h.entidadId).toBe(FAC_ID);
  });

  it('historial no tiene campo persistenciaPendiente', async () => {
    const { svc } = makeService({ prisma: makePrisma({ transactionResult: [0, []] }) });
    const h = await svc.obtenerHistorialFacultad(FAC_ID, 'DECANO');
    expect(h).not.toHaveProperty('persistenciaPendiente');
  });
});

// ── Historial con múltiples ejecuciones ───────────────────────────────────────

describe('AnalisisService — historial con ejecuciones', () => {
  const rows = [
    makeRegistro({ id: 'e1', fechaInicio: new Date('2026-10-23T10:00:00Z'), fechaFin: new Date('2026-10-23T10:00:05Z'), estado: 'COMPLETADO', snapshot: { estadoGeneralCalculo: 'CALCULADO' } }),
    makeRegistro({ id: 'e2', fechaInicio: new Date('2026-10-22T09:00:00Z'), fechaFin: new Date('2026-10-22T09:00:03Z'), estado: 'ERROR',      snapshot: null, errores: 'DB timeout' }),
  ];

  it('mapea cada fila a ItemHistorial con estadoEjecucion y estadoCalculo', async () => {
    const prisma = makePrisma({ transactionResult: [2, rows] });
    const { svc } = makeService({ prisma });
    const h = await svc.obtenerHistorialFacultad(FAC_ID, 'DECANO');

    expect(h.total).toBe(2);
    expect(h.items).toHaveLength(2);
    expect(h.items[0].estadoEjecucion).toBe('COMPLETADO');
    expect(h.items[0].estadoCalculo).toBe('CALCULADO');
    expect(h.items[1].estadoEjecucion).toBe('ERROR');
    expect(h.items[1].estadoCalculo).toBeNull();
    expect(h.items[1].errores).toBe('DB timeout');
  });

  it('incluye fechaInicio y fechaFin como strings ISO', async () => {
    const prisma = makePrisma({ transactionResult: [1, [rows[0]]] });
    const { svc } = makeService({ prisma });
    const h = await svc.obtenerHistorialFacultad(FAC_ID, 'DECANO');
    expect(h.items[0].fechaInicio).toBe('2026-10-23T10:00:00.000Z');
    expect(h.items[0].fechaFin).toBe('2026-10-23T10:00:05.000Z');
  });
});

// ── Paginación ────────────────────────────────────────────────────────────────

describe('AnalisisService — paginación', () => {
  it('usa skip/take correctos para pagina=2, porPagina=5', async () => {
    const prisma = makePrisma({ transactionResult: [12, []] });
    const { svc } = makeService({ prisma });
    const h = await svc.obtenerHistorialFacultad(FAC_ID, 'DECANO', 2, 5);

    expect(h.pagina).toBe(2);
    expect(h.porPagina).toBe(5);
    expect(h.total).toBe(12);
    expect(prisma.analisisEjecucion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    );
  });

  it('limita porPagina a 50 máximo', async () => {
    const prisma = makePrisma({ transactionResult: [100, []] });
    const { svc } = makeService({ prisma });
    await svc.obtenerHistorialFacultad(FAC_ID, 'DECANO', 1, 200);
    expect(prisma.analisisEjecucion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });

  it('filtra por ambito y entidadId en la query', async () => {
    const prisma = makePrisma({ transactionResult: [0, []] });
    const { svc } = makeService({ prisma });
    await svc.obtenerHistorialCarrera(CAR_ID, 'SECRETARIA_ACADEMICA');
    expect(prisma.analisisEjecucion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ambito: 'CARRERA', entidadId: CAR_ID }),
      }),
    );
  });

  it('aislamiento: historial de carrera no devuelve registros de otra carrera', async () => {
    const prisma = makePrisma({ transactionResult: [0, []] });
    const { svc } = makeService({ prisma });
    const h = await svc.obtenerHistorialCarrera('otra-carrera-id', 'SECRETARIA_ACADEMICA');
    expect(prisma.analisisEjecucion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ entidadId: 'otra-carrera-id' }),
      }),
    );
    expect(h.items).toHaveLength(0);
  });
});

// ── Detalle de ejecución ──────────────────────────────────────────────────────

describe('AnalisisService — obtenerDetalle', () => {
  it('retorna snapshot y metadata de la ejecución', async () => {
    const snap = makeFacultadResult();
    const prisma = makePrisma({ findUniqueResult: makeRegistro({ snapshot: snap }) });
    const { svc } = makeService({ prisma });
    const det = await svc.obtenerDetalle(EJEC_ID, 'DECANO', USER_ID);

    expect(det.ejecucionId).toBe(EJEC_ID);
    expect(det.snapshot).toEqual(snap);
    expect(det.estadoCalculo).toBe('CALCULADO');
    expect(det.estadoEjecucion).toBe('COMPLETADO');
  });

  it('retorna snapshot null y estadoCalculo null para ejecución con ERROR', async () => {
    const prisma = makePrisma({ findUniqueResult: makeRegistro({ estado: 'ERROR', snapshot: null, errores: 'timeout' }) });
    const { svc } = makeService({ prisma });
    const det = await svc.obtenerDetalle(EJEC_ID, 'DECANO', USER_ID);
    expect(det.snapshot).toBeNull();
    expect(det.estadoCalculo).toBeNull();
    expect(det.errores).toBe('timeout');
  });

  it('lanza NotFoundException si el id no existe', async () => {
    const prisma = makePrisma({ findUniqueResult: null });
    const { svc } = makeService({ prisma });
    await expect(svc.obtenerDetalle(EJEC_ID, 'DECANO', USER_ID)).rejects.toThrow(NotFoundException);
  });

  it('recupera snapshot íntegro sin modificaciones', async () => {
    const snap = makeCarreraResult();
    const prisma = makePrisma({ findUniqueResult: makeRegistro({ ambito: 'CARRERA', snapshot: snap }) });
    const { svc } = makeService({ prisma });
    const det = await svc.obtenerDetalle(EJEC_ID, 'SECRETARIA_ACADEMICA', USER_ID);
    expect(det.snapshot).toEqual(snap);
  });
});

// ── Consulta de tablero no genera ejecución ───────────────────────────────────

describe('AnalisisService — tablero no genera ejecución', () => {
  it('los métodos ejecutar* son los únicos que llaman prisma.create', async () => {
    const { svc, prisma } = makeService();
    // solo consultamos historial y detalle, sin ejecutar
    await svc.obtenerHistorialFacultad(FAC_ID, 'DECANO');
    await svc.obtenerDetalle(EJEC_ID, 'DECANO', USER_ID);
    expect(prisma.analisisEjecucion.create).not.toHaveBeenCalled();
  });
});
