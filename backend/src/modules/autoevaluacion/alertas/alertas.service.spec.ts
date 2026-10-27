import { ForbiddenException } from '@nestjs/common';
import { AlertasService } from './alertas.service';
import type { RespuestaBandeja } from './alertas.dto';

// ── Factories ──────────────────────────────────────────────────────────────────

function makeSnapCarrera(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    estadoGeneralCalculo: 'CALCULADO',
    ip03: { total: 10, cubiertas: 10 },
    ip10: { alertasR03: 0 },
    ip13: { totalSobreasignados: 0 },
    r10:  { totalEnAlerta: 0 },
    r12:  { totalIncompletos: 0 },
    ...overrides,
  };
}

function makeSnapFacultad(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    estadoGeneralCalculo: 'CALCULADO',
    formacion:      { sinTituloGrado: 0 },
    dedicaciones:   { totalBajaDedicacion: 0 },
    cargaAcademica: { totalSobreasignados: 0 },
    ...overrides,
  };
}

function makeSnapPlan(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    estadoGeneralCalculo: 'CALCULADO',
    ipl01: { cumple: true, horasTotal: 2800, horasMinimas: 2400 },
    ipl02: { bloquesCumplen: 3, bloquesConUmbral: 3 },
    ipl03: { sinResponsable: 0 },
    ipl04: { paresConAlerta: 0 },
    ...overrides,
  };
}

const EJECUCION_CARRERA = {
  id: 'ej-carrera-1',
  ambito: 'CARRERA',
  entidadId: 'carrera-1',
  facultadId: 'fac-1',
  fechaFin: new Date('2026-10-21T10:00:00Z'),
  snapshot: makeSnapCarrera(),
};

const EJECUCION_PLAN = {
  id: 'ej-plan-1',
  ambito: 'PLAN',
  entidadId: 'plan-1',
  facultadId: 'fac-1',
  fechaFin: new Date('2026-10-22T11:00:00Z'),
  snapshot: makeSnapPlan(),
};

const EJECUCION_FACULTAD = {
  id: 'ej-fac-1',
  ambito: 'FACULTAD',
  entidadId: 'fac-1',
  facultadId: 'fac-1',
  fechaFin: new Date('2026-10-22T12:00:00Z'),
  snapshot: makeSnapFacultad(),
};

function makePrisma(
  ejecuciones: typeof EJECUCION_CARRERA[] = [],
  overrides: Record<string, unknown> = {},
) {
  return {
    analisisEjecucion: {
      findMany: jest.fn().mockResolvedValue(ejecuciones),
    },
    usuarioFacultad: {
      findFirst: jest.fn().mockResolvedValue({ facultadId: 'fac-1' }),
    },
    planEstudio: {
      findMany: jest.fn().mockResolvedValue([{ id: 'plan-1' }]),
    },
    ...overrides,
  };
}

function makeScopeService(carreraIds: string[] | null = null) {
  return {
    getCarrerasEnScope: jest.fn().mockResolvedValue(carreraIds),
  };
}

function makeService(prisma: unknown, scope: unknown) {
  return new AlertasService(prisma as never, scope as never);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('AlertasService — control de acceso', () => {
  it('lanza ForbiddenException para rol no autorizado', async () => {
    const svc = makeService(makePrisma(), makeScopeService());
    await expect(svc.obtenerBandeja('u1', 'DOCENTE')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lanza ForbiddenException para rol ADMINISTRATIVO', async () => {
    const svc = makeService(makePrisma(), makeScopeService());
    await expect(svc.obtenerBandeja('u1', 'ADMINISTRATIVO')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rol ADMINISTRADOR_SISTEMA tiene acceso global', async () => {
    const svc = makeService(makePrisma([]), makeScopeService());
    const res = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA');
    expect(res.items).toHaveLength(0);
  });

  it('DIRECTOR_CARRERA sin carreras asignadas retorna bandeja vacía', async () => {
    const svc = makeService(makePrisma(), makeScopeService([]));
    const res = await svc.obtenerBandeja('u1', 'DIRECTOR_CARRERA');
    expect(res.total).toBe(0);
    expect(res.items).toHaveLength(0);
  });

  it('DECANO sin facultad asignada retorna bandeja vacía', async () => {
    const prisma = makePrisma([], {
      usuarioFacultad: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    const svc = makeService(prisma, makeScopeService());
    const res = await svc.obtenerBandeja('u1', 'DECANO');
    expect(res.total).toBe(0);
  });
});

describe('AlertasService — sin ejecuciones persistidas', () => {
  it('retorna bandeja vacía cuando no hay ejecuciones', async () => {
    const svc = makeService(makePrisma([]), makeScopeService());
    const res = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA');
    expect(res).toEqual<RespuestaBandeja>({ total: 0, pagina: 1, porPagina: 20, tieneAnalisis: false, items: [] });
  });
});

describe('AlertasService — sin alertas (snapshot limpio)', () => {
  it('retorna bandeja vacía cuando el snapshot no tiene alertas', async () => {
    const svc = makeService(makePrisma([EJECUCION_CARRERA]), makeScopeService());
    const res = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA');
    expect(res.total).toBe(0);
    expect(res.items).toHaveLength(0);
  });
});

describe('AlertasService — alertas de ejecuciones persistidas', () => {
  it('extrae alerta ALTA R-03 de snapshot carrera', async () => {
    const snap = makeSnapCarrera({ ip10: { alertasR03: 2 } });
    const ej   = { ...EJECUCION_CARRERA, snapshot: snap };
    const svc  = makeService(makePrisma([ej]), makeScopeService());
    const res  = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA');
    expect(res.items[0].regla).toBe('R-03');
    expect(res.items[0].prioridad).toBe('ALTA');
    expect(res.items[0].ejecucionId).toBe('ej-carrera-1');
  });

  it('extrae alerta ALTA IP-13 de snapshot carrera', async () => {
    const snap = makeSnapCarrera({ ip13: { totalSobreasignados: 3 } });
    const ej   = { ...EJECUCION_CARRERA, snapshot: snap };
    const svc  = makeService(makePrisma([ej]), makeScopeService());
    const res  = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA');
    const alerta = res.items.find(a => a.regla === 'IP-13');
    expect(alerta).toBeDefined();
    expect(alerta!.prioridad).toBe('ALTA');
  });

  it('extrae alerta MEDIA R-12 de snapshot carrera', async () => {
    const snap = makeSnapCarrera({ r12: { totalIncompletos: 5 } });
    const ej   = { ...EJECUCION_CARRERA, snapshot: snap };
    const svc  = makeService(makePrisma([ej]), makeScopeService());
    const res  = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA');
    expect(res.items[0].regla).toBe('R-12');
    expect(res.items[0].prioridad).toBe('MEDIA');
  });

  it('extrae alerta INFORMATIVA R-10 de snapshot carrera', async () => {
    const snap = makeSnapCarrera({ r10: { totalEnAlerta: 4 } });
    const ej   = { ...EJECUCION_CARRERA, snapshot: snap };
    const svc  = makeService(makePrisma([ej]), makeScopeService());
    const res  = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA');
    expect(res.items[0].regla).toBe('R-10');
    expect(res.items[0].prioridad).toBe('INFORMATIVA');
  });

  it('extrae alerta ALTA IPL-01 de snapshot plan', async () => {
    const snap = makeSnapPlan({ ipl01: { cumple: false, horasTotal: 2000, horasMinimas: 2400 } });
    const ej   = { ...EJECUCION_PLAN, snapshot: snap };
    const prisma = makePrisma([ej]);
    const svc  = makeService(prisma, makeScopeService());
    const res  = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA');
    expect(res.items[0].regla).toBe('IPL-01');
    expect(res.items[0].prioridad).toBe('ALTA');
  });

  it('extrae alerta ALTA IPL-03 de snapshot plan', async () => {
    const snap = makeSnapPlan({ ipl03: { sinResponsable: 2 } });
    const ej   = { ...EJECUCION_PLAN, snapshot: snap };
    const svc  = makeService(makePrisma([ej]), makeScopeService());
    const res  = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA');
    const a = res.items.find(x => x.regla === 'IPL-03');
    expect(a).toBeDefined();
    expect(a!.prioridad).toBe('ALTA');
  });

  it('extrae alerta MEDIA R-07 de snapshot facultad (sobreasignados)', async () => {
    const snap = makeSnapFacultad({ cargaAcademica: { totalSobreasignados: 1 } });
    const ej   = { ...EJECUCION_FACULTAD, snapshot: snap };
    const svc  = makeService(makePrisma([ej]), makeScopeService());
    const res  = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA');
    const a = res.items.find(x => x.regla === 'R-07');
    expect(a).toBeDefined();
    expect(a!.prioridad).toBe('MEDIA');
  });

  it('extrae alerta MEDIA R-12 de snapshot facultad (sin título de grado)', async () => {
    const snap = makeSnapFacultad({ formacion: { sinTituloGrado: 3 } });
    const ej   = { ...EJECUCION_FACULTAD, snapshot: snap };
    const svc  = makeService(makePrisma([ej]), makeScopeService());
    const res  = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA');
    const a = res.items.find(x => x.regla === 'R-12');
    expect(a).toBeDefined();
    expect(a!.prioridad).toBe('MEDIA');
  });

  it('extrae alerta INFORMATIVA R-10 de snapshot facultad (baja dedicación)', async () => {
    const snap = makeSnapFacultad({ dedicaciones: { totalBajaDedicacion: 2 } });
    const ej   = { ...EJECUCION_FACULTAD, snapshot: snap };
    const svc  = makeService(makePrisma([ej]), makeScopeService());
    const res  = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA');
    const a = res.items.find(x => x.regla === 'R-10');
    expect(a).toBeDefined();
    expect(a!.prioridad).toBe('INFORMATIVA');
  });

  it('mantiene trazabilidad ejecucionId en cada alerta', async () => {
    const snap = makeSnapCarrera({ ip13: { totalSobreasignados: 2 } });
    const ej   = { ...EJECUCION_CARRERA, id: 'ej-trace-99', snapshot: snap };
    const svc  = makeService(makePrisma([ej]), makeScopeService());
    const res  = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA');
    expect(res.items[0].ejecucionId).toBe('ej-trace-99');
  });
});

describe('AlertasService — duplicados históricos', () => {
  it('sólo usa la ejecución más reciente por (ambito, entidadId)', async () => {
    const snapAntiguo = makeSnapCarrera({ ip13: { totalSobreasignados: 3 } });
    const snapNuevo   = makeSnapCarrera({ ip13: { totalSobreasignados: 0 } });
    // findMany returns them desc — first is newest
    const ejecuciones = [
      { ...EJECUCION_CARRERA, id: 'ej-nuevo', snapshot: snapNuevo, fechaFin: new Date('2026-10-22T10:00:00Z') },
      { ...EJECUCION_CARRERA, id: 'ej-viejo', snapshot: snapAntiguo, fechaFin: new Date('2026-10-20T10:00:00Z') },
    ];
    const svc = makeService(makePrisma(ejecuciones), makeScopeService());
    const res = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA');
    // The old execution had IP-13 alert — but newest has no alerts, so total is 0
    expect(res.total).toBe(0);
  });

  it('dos entidades distintas generan alertas independientes', async () => {
    const snap1 = makeSnapCarrera({ ip13: { totalSobreasignados: 1 } });
    const snap2 = makeSnapCarrera({ ip13: { totalSobreasignados: 2 } });
    const ej1 = { ...EJECUCION_CARRERA, id: 'ej-c1', entidadId: 'carrera-1', snapshot: snap1 };
    const ej2 = { ...EJECUCION_CARRERA, id: 'ej-c2', entidadId: 'carrera-2', snapshot: snap2 };
    const svc = makeService(makePrisma([ej1, ej2]), makeScopeService());
    const res = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA');
    expect(res.total).toBe(2);
    const ids = res.items.map(a => a.ejecucionId);
    expect(ids).toContain('ej-c1');
    expect(ids).toContain('ej-c2');
  });
});

describe('AlertasService — filtros', () => {
  it('filtro por ambito=CARRERA excluye alertas de plan y facultad', async () => {
    const snapC = makeSnapCarrera({ ip13: { totalSobreasignados: 1 } });
    const snapP = makeSnapPlan({ ipl01: { cumple: false, horasTotal: 2000, horasMinimas: 2400 } });
    const svc   = makeService(
      makePrisma([
        { ...EJECUCION_CARRERA, snapshot: snapC },
        { ...EJECUCION_PLAN,    snapshot: snapP },
      ]),
      makeScopeService(),
    );
    const res = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA', 1, 20, { ambito: 'CARRERA' });
    expect(res.items.every(a => a.ambito === 'CARRERA')).toBe(true);
    expect(res.items.length).toBeGreaterThan(0);
  });

  it('filtro por prioridad=ALTA excluye MEDIA e INFORMATIVA', async () => {
    const snap = makeSnapCarrera({
      ip13: { totalSobreasignados: 1 },
      r12:  { totalIncompletos: 2 },
      r10:  { totalEnAlerta: 3 },
    });
    const svc = makeService(makePrisma([{ ...EJECUCION_CARRERA, snapshot: snap }]), makeScopeService());
    const res = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA', 1, 20, { prioridad: 'ALTA' });
    expect(res.items.every(a => a.prioridad === 'ALTA')).toBe(true);
  });

  it('filtro por regla retorna solo esa regla', async () => {
    const snap = makeSnapCarrera({
      ip13: { totalSobreasignados: 1 },
      r12:  { totalIncompletos: 2 },
    });
    const svc = makeService(makePrisma([{ ...EJECUCION_CARRERA, snapshot: snap }]), makeScopeService());
    const res = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA', 1, 20, { regla: 'R-12' });
    expect(res.items.every(a => a.regla === 'R-12')).toBe(true);
    expect(res.items).toHaveLength(1);
  });
});

describe('AlertasService — paginación', () => {
  it('respeta el límite porPagina y offset', async () => {
    const snap = makeSnapCarrera({
      ip13: { totalSobreasignados: 1 },
      r12:  { totalIncompletos: 1 },
      r10:  { totalEnAlerta: 1 },
      ip03: { total: 5, cubiertas: 3 },
    });
    const svc = makeService(makePrisma([{ ...EJECUCION_CARRERA, snapshot: snap }]), makeScopeService());
    const res = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA', 1, 2);
    expect(res.items).toHaveLength(2);
    expect(res.total).toBeGreaterThan(2);
  });

  it('segunda página retorna los siguientes items', async () => {
    const snap = makeSnapCarrera({
      ip13: { totalSobreasignados: 1 },
      r12:  { totalIncompletos: 1 },
      r10:  { totalEnAlerta: 1 },
    });
    const svc = makeService(makePrisma([{ ...EJECUCION_CARRERA, snapshot: snap }]), makeScopeService());
    const p1 = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA', 1, 2);
    const p2 = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA', 2, 2);
    const ids1 = p1.items.map(a => a.regla);
    const ids2 = p2.items.map(a => a.regla);
    expect(ids1.some(r => ids2.includes(r))).toBe(false);
  });

  it('porPagina no supera el máximo de 100', async () => {
    const snap = makeSnapCarrera({ ip13: { totalSobreasignados: 1 } });
    const svc = makeService(makePrisma([{ ...EJECUCION_CARRERA, snapshot: snap }]), makeScopeService());
    const res = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA', 1, 999);
    expect(res.porPagina).toBe(100);
  });
});

describe('AlertasService — ordenamiento', () => {
  it('ALTA aparece antes que MEDIA y INFORMATIVA', async () => {
    const snap = makeSnapCarrera({
      ip13: { totalSobreasignados: 1 },
      r12:  { totalIncompletos: 1 },
      r10:  { totalEnAlerta: 1 },
    });
    const svc = makeService(makePrisma([{ ...EJECUCION_CARRERA, snapshot: snap }]), makeScopeService());
    const res = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA');
    const prioridades = res.items.map(a => a.prioridad);
    const altaIdx = prioridades.indexOf('ALTA');
    const mediaIdx = prioridades.indexOf('MEDIA');
    const infIdx = prioridades.indexOf('INFORMATIVA');
    if (altaIdx !== -1 && mediaIdx !== -1) expect(altaIdx).toBeLessThan(mediaIdx);
    if (mediaIdx !== -1 && infIdx !== -1)   expect(mediaIdx).toBeLessThan(infIdx);
  });
});

describe('AlertasService — scope DECANO', () => {
  it('DECANO ve alertas de su facultad', async () => {
    const snap = makeSnapCarrera({ ip13: { totalSobreasignados: 1 } });
    const ej   = { ...EJECUCION_CARRERA, facultadId: 'fac-1', snapshot: snap };
    const prisma = makePrisma([ej]);
    (prisma.analisisEjecucion.findMany as jest.Mock).mockImplementation((args: unknown) => {
      const where = (args as { where?: Record<string, unknown> })?.where;
      return Promise.resolve(
        where?.['facultadId'] === 'fac-1' ? [ej] : [],
      );
    });
    const svc = makeService(prisma, makeScopeService());
    const res = await svc.obtenerBandeja('u1', 'DECANO');
    expect(res.total).toBeGreaterThan(0);
  });
});

describe('AlertasService — scope DIRECTOR_CARRERA', () => {
  it('DIRECTOR_CARRERA ve alertas de su carrera y sus planes', async () => {
    const snapC = makeSnapCarrera({ ip13: { totalSobreasignados: 1 } });
    const ejC   = { ...EJECUCION_CARRERA, entidadId: 'carrera-1', snapshot: snapC };
    const prisma = makePrisma([ejC]);
    const scope  = makeScopeService(['carrera-1']);
    (prisma.analisisEjecucion.findMany as jest.Mock).mockResolvedValue([ejC]);
    const svc = makeService(prisma, scope);
    const res = await svc.obtenerBandeja('u1', 'DIRECTOR_CARRERA');
    expect(res.total).toBeGreaterThan(0);
  });

  it('DIRECTOR_CARRERA no ve alertas de otras carreras', async () => {
    const prisma = makePrisma([]);
    const scope  = makeScopeService(['carrera-propia']);
    (prisma.analisisEjecucion.findMany as jest.Mock).mockResolvedValue([]);
    const svc = makeService(prisma, scope);
    const res = await svc.obtenerBandeja('u1', 'DIRECTOR_CARRERA');
    expect(res.total).toBe(0);
  });
});

describe('AlertasService — regresión analisis/historial', () => {
  it('AlertasService no modifica snapshots existentes', async () => {
    const snapOriginal = makeSnapCarrera({ ip13: { totalSobreasignados: 1 } });
    const ej = { ...EJECUCION_CARRERA, snapshot: snapOriginal };
    const svc = makeService(makePrisma([ej]), makeScopeService());
    await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA');
    // Snapshot unchanged after query
    expect((ej.snapshot as Record<string, unknown>)['ip13']).toEqual({ totalSobreasignados: 1 });
  });
});

// ── Filtros grupoAmbito (B-05) ────────────────────────────────────────────────

describe('AlertasService — filtro grupoAmbito (B-05)', () => {
  /**
   * Snaps con alertas en los tres grupos más alertas que no pertenecen a ninguno,
   * para verificar que el filtro es selectivo y no mezcla grupos.
   */
  function makeSnapsConTodo() {
    const snapC = makeSnapCarrera({
      ip10: { alertasR03: 1 },      // R-03  → DOCENTES
      ip13: { totalSobreasignados: 1 }, // IP-13 → DOCENTES
      r12:  { totalIncompletos: 1 }, // R-12  → DOCENTES
      r10:  { totalEnAlerta: 1 },    // R-10  → DOCENTES
      ip03: { total: 5, cubiertas: 3 }, // IP-03 → PLANES
    });
    const snapP = makeSnapPlan({
      ipl01: { cumple: false, horasTotal: 2000, horasMinimas: 2400 }, // IPL-01 → PLANES
      ipl02: { bloquesCumplen: 1, bloquesConUmbral: 2 },              // IPL-02 → PLANES
      ipl03: { sinResponsable: 1 },  // IPL-03 → CRUZADAS
      ipl04: { paresConAlerta: 1 },  // IPL-04 → CRUZADAS
    });
    const snapF = makeSnapFacultad({
      cargaAcademica: { totalSobreasignados: 1 }, // R-07 → DOCENTES
    });
    return {
      ejC: { ...EJECUCION_CARRERA, snapshot: snapC },
      ejP: { ...EJECUCION_PLAN,    snapshot: snapP },
      ejF: { ...EJECUCION_FACULTAD, snapshot: snapF },
    };
  }

  it('grupoAmbito=DOCENTES retorna solo R-03, R-07, R-10, R-12, IP-13', async () => {
    const { ejC, ejP, ejF } = makeSnapsConTodo();
    const svc = makeService(makePrisma([ejC, ejP, ejF]), makeScopeService());
    const res = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA', 1, 100, { grupoAmbito: 'DOCENTES' });
    const reglas = res.items.map(a => a.regla);
    expect(reglas.every(r => ['R-03', 'R-07', 'R-10', 'R-12', 'IP-13'].includes(r))).toBe(true);
    expect(res.total).toBeGreaterThan(0);
  });

  it('grupoAmbito=DOCENTES incluye IP-13 (sobreasignación por carrera)', async () => {
    const snap = makeSnapCarrera({ ip13: { totalSobreasignados: 2 } });
    const ej   = { ...EJECUCION_CARRERA, snapshot: snap };
    const svc  = makeService(makePrisma([ej]), makeScopeService());
    const res  = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA', 1, 20, { grupoAmbito: 'DOCENTES' });
    expect(res.items.find(a => a.regla === 'IP-13')).toBeDefined();
  });

  it('grupoAmbito=DOCENTES no incluye IPL-03 ni IPL-04 (son CRUZADAS)', async () => {
    const snap = makeSnapPlan({ ipl03: { sinResponsable: 2 }, ipl04: { paresConAlerta: 1 } });
    const ej   = { ...EJECUCION_PLAN, snapshot: snap };
    const svc  = makeService(makePrisma([ej]), makeScopeService());
    const res  = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA', 1, 20, { grupoAmbito: 'DOCENTES' });
    expect(res.items.find(a => a.regla === 'IPL-03')).toBeUndefined();
    expect(res.items.find(a => a.regla === 'IPL-04')).toBeUndefined();
  });

  it('grupoAmbito=PLANES retorna solo IPL-01, IPL-02, IP-03', async () => {
    const { ejC, ejP, ejF } = makeSnapsConTodo();
    const svc = makeService(makePrisma([ejC, ejP, ejF]), makeScopeService());
    const res = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA', 1, 100, { grupoAmbito: 'PLANES' });
    const reglas = res.items.map(a => a.regla);
    expect(reglas.every(r => ['IPL-01', 'IPL-02', 'IP-03'].includes(r))).toBe(true);
    expect(res.total).toBeGreaterThan(0);
  });

  it('grupoAmbito=PLANES no incluye IPL-03 ni IPL-04', async () => {
    const snap = makeSnapPlan({ ipl03: { sinResponsable: 2 }, ipl04: { paresConAlerta: 1 } });
    const ej   = { ...EJECUCION_PLAN, snapshot: snap };
    const svc  = makeService(makePrisma([ej]), makeScopeService());
    const res  = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA', 1, 20, { grupoAmbito: 'PLANES' });
    expect(res.items.find(a => a.regla === 'IPL-03')).toBeUndefined();
    expect(res.items.find(a => a.regla === 'IPL-04')).toBeUndefined();
  });

  it('grupoAmbito=CRUZADAS retorna solo IPL-03 e IPL-04', async () => {
    const { ejC, ejP, ejF } = makeSnapsConTodo();
    const svc = makeService(makePrisma([ejC, ejP, ejF]), makeScopeService());
    const res = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA', 1, 100, { grupoAmbito: 'CRUZADAS' });
    const reglas = res.items.map(a => a.regla);
    expect(reglas.every(r => ['IPL-03', 'IPL-04'].includes(r))).toBe(true);
    expect(res.total).toBeGreaterThan(0);
  });

  it('grupoAmbito=CRUZADAS incluye IPL-03 (derivado de R-08)', async () => {
    const snap = makeSnapPlan({ ipl03: { sinResponsable: 3 } });
    const ej   = { ...EJECUCION_PLAN, snapshot: snap };
    const svc  = makeService(makePrisma([ej]), makeScopeService());
    const res  = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA', 1, 20, { grupoAmbito: 'CRUZADAS' });
    expect(res.items.find(a => a.regla === 'IPL-03')).toBeDefined();
  });

  it('grupoAmbito=CRUZADAS incluye IPL-04 (derivado de R-02)', async () => {
    const snap = makeSnapPlan({ ipl04: { paresConAlerta: 2 } });
    const ej   = { ...EJECUCION_PLAN, snapshot: snap };
    const svc  = makeService(makePrisma([ej]), makeScopeService());
    const res  = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA', 1, 20, { grupoAmbito: 'CRUZADAS' });
    expect(res.items.find(a => a.regla === 'IPL-04')).toBeDefined();
  });

  it('grupoAmbito=CRUZADAS no incluye IP-13 (es DOCENTES)', async () => {
    const snap = makeSnapCarrera({ ip13: { totalSobreasignados: 2 } });
    const ej   = { ...EJECUCION_CARRERA, snapshot: snap };
    const svc  = makeService(makePrisma([ej]), makeScopeService());
    const res  = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA', 1, 20, { grupoAmbito: 'CRUZADAS' });
    expect(res.items.find(a => a.regla === 'IP-13')).toBeUndefined();
  });

  it('grupoAmbito ausente retorna alertas de todos los grupos', async () => {
    const { ejC, ejP, ejF } = makeSnapsConTodo();
    const svc = makeService(makePrisma([ejC, ejP, ejF]), makeScopeService());
    const res = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA', 1, 100);
    const reglas = new Set(res.items.map(a => a.regla));
    expect(reglas.has('R-03')).toBe(true);
    expect(reglas.has('IPL-01')).toBe(true);
    expect(reglas.has('IPL-03')).toBe(true);
  });

  it('grupoAmbito=PLANES sin alertas de plan retorna vacío', async () => {
    const snap = makeSnapCarrera({ ip10: { alertasR03: 2 } });
    const ej   = { ...EJECUCION_CARRERA, snapshot: snap };
    const svc  = makeService(makePrisma([ej]), makeScopeService());
    const res  = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA', 1, 20, { grupoAmbito: 'PLANES' });
    expect(res.total).toBe(0);
  });

  it('grupoAmbito combinado con filtro prioridad=ALTA', async () => {
    const snap = makeSnapCarrera({
      ip10: { alertasR03: 1 }, // R-03 ALTA → DOCENTES
      r12:  { totalIncompletos: 1 }, // R-12 MEDIA → DOCENTES
    });
    const ej  = { ...EJECUCION_CARRERA, snapshot: snap };
    const svc = makeService(makePrisma([ej]), makeScopeService());
    const res = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA', 1, 20, {
      grupoAmbito: 'DOCENTES',
      prioridad: 'ALTA',
    });
    expect(res.items.every(a => a.prioridad === 'ALTA')).toBe(true);
    expect(res.items.every(a => ['R-03', 'R-07', 'R-10', 'R-12', 'IP-13'].includes(a.regla))).toBe(true);
  });
});

// ── Navegación B-06 ───────────────────────────────────────────────────────────

describe('AlertasService — navegación B-06', () => {
  it('alertas de ámbito CARRERA incluyen carreraId igual a entidadId', async () => {
    const snap = makeSnapCarrera({ ip10: { alertasR03: 1 } });
    const ej   = { ...EJECUCION_CARRERA, entidadId: 'carrera-nav-1', snapshot: snap };
    const svc  = makeService(makePrisma([ej]), makeScopeService());
    const res  = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA');
    const alerta = res.items.find(a => a.regla === 'R-03');
    expect(alerta?.carreraId).toBe('carrera-nav-1');
  });

  it('alertas de ámbito PLAN no incluyen carreraId', async () => {
    const snap = makeSnapPlan({ ipl01: { cumple: false, horasTotal: 2000, horasMinimas: 2400 } });
    const ej   = { ...EJECUCION_PLAN, snapshot: snap };
    const svc  = makeService(makePrisma([ej]), makeScopeService());
    const res  = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA');
    const alerta = res.items.find(a => a.regla === 'IPL-01');
    expect(alerta?.carreraId).toBeUndefined();
  });

  it('alertas de ámbito FACULTAD no incluyen carreraId', async () => {
    const snap = makeSnapFacultad({ cargaAcademica: { totalSobreasignados: 1 } });
    const ej   = { ...EJECUCION_FACULTAD, snapshot: snap };
    const svc  = makeService(makePrisma([ej]), makeScopeService());
    const res  = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA');
    const alerta = res.items.find(a => a.regla === 'R-07');
    expect(alerta?.carreraId).toBeUndefined();
  });

  it('las alertas de carrera no tienen docenteId (alertas son agregadas)', async () => {
    const snap = makeSnapCarrera({ ip10: { alertasR03: 3 }, ip13: { totalSobreasignados: 2 } });
    const ej   = { ...EJECUCION_CARRERA, snapshot: snap };
    const svc  = makeService(makePrisma([ej]), makeScopeService());
    const res  = await svc.obtenerBandeja('u1', 'ADMINISTRADOR_SISTEMA');
    expect(res.items.every((a: any) => a.docenteId === undefined)).toBe(true);
  });
});
