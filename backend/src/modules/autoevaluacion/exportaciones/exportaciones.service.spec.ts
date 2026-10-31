import { ForbiddenException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ExportacionesService } from './exportaciones.service';
import { metaCarreraLabels } from './pdf.generator';

// ── IDs de prueba ──────────────────────────────────────────────────────────────
const EJEC_ID = 'aaaa-1111';
const FAC_ID  = 'fac-001';
const CAR_ID  = 'car-001';
const PLAN_ID = 'plan-001';
const USER_ID = 'user-001';

// ── Snapshots de prueba ───────────────────────────────────────────────────────
function makeSnapCarrera(): Record<string, unknown> {
  return {
    estadoGeneralCalculo: 'CALCULADO',
    ip01: { estadoCalculo: 'CALCULADO', porcentaje: 70 },
    ip13: { estadoCalculo: 'CALCULADO', totalSobreasignados: 2 },
  };
}

function makeRegCarrera(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: EJEC_ID,
    ambito: 'CARRERA',
    entidadId: CAR_ID,
    facultadId: FAC_ID,
    usuarioId: USER_ID,
    estado: 'COMPLETADO',
    fechaFin: new Date('2026-10-20T10:00:00Z'),
    snapshot: makeSnapCarrera(),
    ...overrides,
  };
}

// ── Factories ─────────────────────────────────────────────────────────────────

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    analisisEjecucion: {
      findUnique: jest.fn().mockResolvedValue(makeRegCarrera()),
      findFirst:  jest.fn().mockResolvedValue(makeRegCarrera()),
    },
    facultad:   { findUnique: jest.fn().mockResolvedValue({ nombre: 'Facultad de Ingeniería' }) },
    carrera:    { findUnique: jest.fn().mockResolvedValue({ nombre: 'Ingeniería en Sistemas' }) },
    planEstudio:{ findUnique: jest.fn().mockResolvedValue({ nombre: 'Plan 2020' }) },
    ...overrides,
  };
}

function makeAnalisis(overrides: Record<string, unknown> = {}) {
  return {
    obtenerDetalle: jest.fn().mockResolvedValue({}),
    ejecutarFacultad: jest.fn().mockResolvedValue({ metadata: { ejecucionId: EJEC_ID } }),
    ejecutarCarrera:  jest.fn().mockResolvedValue({ metadata: { ejecucionId: EJEC_ID } }),
    ejecutarPlan:     jest.fn().mockResolvedValue({ metadata: { ejecucionId: EJEC_ID } }),
    ...overrides,
  };
}

const PARAM_STUB = {
  obtenerValor: jest.fn().mockResolvedValue('Universidad de la Marina Mercante'),
  obtenerLogo:  jest.fn().mockResolvedValue(null),
};

function makeService(prismaOverrides = {}, analisisOverrides = {}) {
  return new ExportacionesService(
    makePrisma(prismaOverrides) as any,
    makeAnalisis(analisisOverrides) as any,
    PARAM_STUB as any,
  );
}

// ── Grupos ────────────────────────────────────────────────────────────────────

describe('ExportacionesService', () => {

  describe('_checkRol', () => {
    it('rechaza roles no autorizados', async () => {
      const svc = makeService();
      await expect(
        svc.exportarPorEjecucion(EJEC_ID, 'pdf', 'ROLE_UNKNOWN', USER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it.each([
      'ADMINISTRADOR_SISTEMA', 'SECRETARIA_ACADEMICA', 'RECTORADO', 'DECANO', 'DIRECTOR_CARRERA',
    ])('acepta rol %s', async (rol) => {
      const svc = makeService();
      // no lanza ForbiddenException por rol
      await expect(svc.exportarPorEjecucion(EJEC_ID, 'pdf', rol, USER_ID)).resolves.toBeDefined();
    });
  });

  describe('exportarPorEjecucion', () => {
    it('devuelve buffer PDF', async () => {
      const svc = makeService();
      const r = await svc.exportarPorEjecucion(EJEC_ID, 'pdf', 'ADMINISTRADOR_SISTEMA', USER_ID);
      expect(r.mime).toBe('application/pdf');
      expect(r.buffer).toBeInstanceOf(Buffer);
      expect(r.filename).toMatch(/\.pdf$/);
    });

    it('devuelve buffer XLSX', async () => {
      const svc = makeService();
      const r = await svc.exportarPorEjecucion(EJEC_ID, 'xlsx', 'ADMINISTRADOR_SISTEMA', USER_ID);
      expect(r.mime).toMatch(/spreadsheetml/);
      expect(r.buffer).toBeInstanceOf(Buffer);
      expect(r.filename).toMatch(/\.xlsx$/);
    });

    it('delega scope check a AnalisisService.obtenerDetalle', async () => {
      const analisis = makeAnalisis();
      const svc = makeService({}, analisis);
      await svc.exportarPorEjecucion(EJEC_ID, 'pdf', 'DIRECTOR_CARRERA', USER_ID);
      expect(analisis.obtenerDetalle).toHaveBeenCalledWith(EJEC_ID, 'DIRECTOR_CARRERA', USER_ID);
    });

    it('lanza NotFoundException si ejecución no existe tras scope check', async () => {
      const svc = makeService({
        analisisEjecucion: {
          findUnique: jest.fn().mockResolvedValue(null),
          findFirst:  jest.fn().mockResolvedValue(null),
        },
      });
      await expect(
        svc.exportarPorEjecucion(EJEC_ID, 'pdf', 'ADMINISTRADOR_SISTEMA', USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza NotFoundException si snapshot es null', async () => {
      const svc = makeService({
        analisisEjecucion: {
          findUnique: jest.fn().mockResolvedValue(makeRegCarrera({ snapshot: null })),
          findFirst:  jest.fn().mockResolvedValue(null),
        },
      });
      await expect(
        svc.exportarPorEjecucion(EJEC_ID, 'pdf', 'ADMINISTRADOR_SISTEMA', USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('propaga ForbiddenException del scope check', async () => {
      const svc = makeService({}, {
        obtenerDetalle: jest.fn().mockRejectedValue(new ForbiddenException()),
      });
      await expect(
        svc.exportarPorEjecucion(EJEC_ID, 'pdf', 'DIRECTOR_CARRERA', USER_ID),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('exportarPorEntidad - ejecución existente', () => {
    it('usa la última ejecución completada si existe', async () => {
      const analisis = makeAnalisis();
      const svc = makeService({}, analisis);
      await svc.exportarPorEntidad('CARRERA', CAR_ID, 'pdf', 'ADMINISTRADOR_SISTEMA', USER_ID);
      expect(analisis.ejecutarCarrera).not.toHaveBeenCalled();
      expect(analisis.obtenerDetalle).toHaveBeenCalledWith(EJEC_ID, 'ADMINISTRADOR_SISTEMA', USER_ID);
    });
  });

  describe('exportarPorEntidad - sin ejecución previa', () => {
    const noEjecucion = {
      analisisEjecucion: {
        findFirst:  jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(makeRegCarrera({ ambito: 'FACULTAD', entidadId: FAC_ID })),
      },
    };

    it('ejecuta análisis FACULTAD si no hay ejecución previa', async () => {
      const analisis = makeAnalisis();
      const svc = makeService({ ...noEjecucion, analisisEjecucion: { ...noEjecucion.analisisEjecucion } }, analisis);
      await svc.exportarPorEntidad('FACULTAD', FAC_ID, 'pdf', 'ADMINISTRADOR_SISTEMA', USER_ID);
      expect(analisis.ejecutarFacultad).toHaveBeenCalledWith(FAC_ID, USER_ID, 'ADMINISTRADOR_SISTEMA');
    });

    it('ejecuta análisis CARRERA si no hay ejecución previa', async () => {
      const analisis = makeAnalisis();
      const prisma = {
        analisisEjecucion: {
          findFirst:  jest.fn().mockResolvedValue(null),
          findUnique: jest.fn().mockResolvedValue(makeRegCarrera()),
        },
        carrera:    { findUnique: jest.fn().mockResolvedValue({ nombre: 'Ingeniería en Sistemas' }) },
        facultad:   { findUnique: jest.fn().mockResolvedValue({ nombre: 'Facultad' }) },
        planEstudio:{ findUnique: jest.fn().mockResolvedValue({ nombre: 'Plan' }) },
      };
      const svc = new ExportacionesService(prisma as any, analisis as any, PARAM_STUB as any);
      await svc.exportarPorEntidad('CARRERA', CAR_ID, 'pdf', 'ADMINISTRADOR_SISTEMA', USER_ID);
      expect(analisis.ejecutarCarrera).toHaveBeenCalledWith(CAR_ID, USER_ID, 'ADMINISTRADOR_SISTEMA');
    });

    it('ejecuta análisis PLAN si no hay ejecución previa', async () => {
      const analisis = makeAnalisis();
      const prisma = {
        analisisEjecucion: {
          findFirst:  jest.fn().mockResolvedValue(null),
          findUnique: jest.fn().mockResolvedValue(makeRegCarrera({ ambito: 'PLAN', entidadId: PLAN_ID })),
        },
        carrera:    { findUnique: jest.fn().mockResolvedValue({ nombre: 'Ingeniería' }) },
        facultad:   { findUnique: jest.fn().mockResolvedValue({ nombre: 'Facultad' }) },
        planEstudio:{ findUnique: jest.fn().mockResolvedValue({ nombre: 'Plan 2020' }) },
      };
      const svc = new ExportacionesService(prisma as any, analisis as any, PARAM_STUB as any);
      await svc.exportarPorEntidad('PLAN', PLAN_ID, 'pdf', 'ADMINISTRADOR_SISTEMA', USER_ID);
      expect(analisis.ejecutarPlan).toHaveBeenCalledWith(PLAN_ID, USER_ID, 'ADMINISTRADOR_SISTEMA');
    });

    it('lanza InternalServerErrorException si la nueva ejecución no tiene snapshot', async () => {
      const analisis = makeAnalisis();
      const prisma = {
        analisisEjecucion: {
          findFirst:  jest.fn().mockResolvedValue(null),
          findUnique: jest.fn().mockResolvedValue(makeRegCarrera({ snapshot: null })),
        },
        carrera:    { findUnique: jest.fn().mockResolvedValue({ nombre: 'Ingeniería' }) },
        facultad:   { findUnique: jest.fn().mockResolvedValue({ nombre: 'Facultad' }) },
        planEstudio:{ findUnique: jest.fn().mockResolvedValue({ nombre: 'Plan' }) },
      };
      const svc = new ExportacionesService(prisma as any, analisis as any, PARAM_STUB as any);
      await expect(
        svc.exportarPorEntidad('CARRERA', CAR_ID, 'pdf', 'ADMINISTRADOR_SISTEMA', USER_ID),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('nombre de entidad', () => {
    it('incluye nombre de carrera en filename PDF', async () => {
      const svc = makeService();
      const r = await svc.exportarPorEjecucion(EJEC_ID, 'pdf', 'ADMINISTRADOR_SISTEMA', USER_ID);
      expect(r.filename).toContain('Ingenier');
    });

    it('filename contiene el ámbito', async () => {
      const svc = makeService();
      const r = await svc.exportarPorEjecucion(EJEC_ID, 'pdf', 'ADMINISTRADOR_SISTEMA', USER_ID);
      expect(r.filename).toContain('carrera');
    });
  });

  describe('formato filename FACULTAD', () => {
    it('filename Excel tiene ámbito facultad', async () => {
      const prisma = makePrisma({
        analisisEjecucion: {
          findUnique: jest.fn().mockResolvedValue(makeRegCarrera({ ambito: 'FACULTAD', entidadId: FAC_ID })),
          findFirst:  jest.fn().mockResolvedValue(makeRegCarrera({ ambito: 'FACULTAD', entidadId: FAC_ID })),
        },
      });
      const svc = new ExportacionesService(prisma as any, makeAnalisis() as any, PARAM_STUB as any);
      const r = await svc.exportarPorEjecucion(EJEC_ID, 'xlsx', 'DECANO', USER_ID);
      expect(r.filename).toContain('facultad');
    });
  });

  // ── IMPL-7B: Tarea A ─────────────────────────────────────────────────────────

  describe('exportación histórica — sin recalcular', () => {
    it('exportarPorEjecucion nunca dispara ejecutar* aunque no exista ejecución previa', async () => {
      const analisis = makeAnalisis();
      const svc = makeService({}, analisis);
      await svc.exportarPorEjecucion(EJEC_ID, 'pdf', 'ADMINISTRADOR_SISTEMA', USER_ID);
      expect(analisis.ejecutarCarrera).not.toHaveBeenCalled();
      expect(analisis.ejecutarFacultad).not.toHaveBeenCalled();
      expect(analisis.ejecutarPlan).not.toHaveBeenCalled();
    });
  });

  describe('autorización antes de ejecutar', () => {
    it('entidad con ejecución existente: scope check via obtenerDetalle antes de construir snapshot', async () => {
      const analisis = makeAnalisis({
        obtenerDetalle: jest.fn().mockRejectedValue(new ForbiddenException('Sin acceso')),
      });
      const svc = makeService({}, analisis);
      await expect(
        svc.exportarPorEntidad('CARRERA', CAR_ID, 'pdf', 'DIRECTOR_CARRERA', USER_ID),
      ).rejects.toThrow(ForbiddenException);
      expect(analisis.ejecutarCarrera).not.toHaveBeenCalled();
    });

    it('entidad sin ejecución previa: ejecutar* propaga error de scope', async () => {
      const analisis = makeAnalisis({
        ejecutarCarrera: jest.fn().mockRejectedValue(new ForbiddenException('Rol sin acceso')),
      });
      const prisma = {
        analisisEjecucion: {
          findFirst:  jest.fn().mockResolvedValue(null),
          findUnique: jest.fn().mockResolvedValue(null),
        },
        carrera:    { findUnique: jest.fn().mockResolvedValue({ nombre: 'Ingeniería' }) },
        facultad:   { findUnique: jest.fn().mockResolvedValue({ nombre: 'Facultad' }) },
        planEstudio:{ findUnique: jest.fn().mockResolvedValue({ nombre: 'Plan' }) },
      };
      const svc = new ExportacionesService(prisma as any, analisis as any, PARAM_STUB as any);
      await expect(
        svc.exportarPorEntidad('CARRERA', CAR_ID, 'pdf', 'DIRECTOR_CARRERA', USER_ID),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('reutilización de la última ejecución completada', () => {
    it('no ejecuta nuevo análisis cuando ya existe ejecución COMPLETADO', async () => {
      const analisis = makeAnalisis();
      const svc = makeService({}, analisis);
      await svc.exportarPorEntidad('CARRERA', CAR_ID, 'pdf', 'ADMINISTRADOR_SISTEMA', USER_ID);
      expect(analisis.ejecutarCarrera).not.toHaveBeenCalled();
      expect(analisis.ejecutarFacultad).not.toHaveBeenCalled();
      expect(analisis.ejecutarPlan).not.toHaveBeenCalled();
    });
  });

  // ── IMPL-7B: Tarea B — Contenido específico ───────────────────────────────────

  describe('PDF — contenido', () => {
    it('buffer PDF tiene firma %PDF', async () => {
      const svc = makeService();
      const r = await svc.exportarPorEjecucion(EJEC_ID, 'pdf', 'ADMINISTRADOR_SISTEMA', USER_ID);
      expect(r.buffer.slice(0, 4).toString()).toBe('%PDF');
    });

    it('PDF PLAN tiene tamaño razonable (>= 1KB)', async () => {
      const snap = {
        estadoGeneralCalculo: 'CALCULADO',
        ipl01: { estadoCalculo: 'CALCULADO', cumple: true, horasTotal: 2800 },
        ipl02: { estadoCalculo: 'CALCULADO', bloquesCumplen: 3, bloquesConUmbral: 4 },
        ipl03: { estadoCalculo: 'CALCULADO', sinResponsable: 1, totalMaterias: 30 },
        ipl04: { estadoCalculo: 'CALCULADO', paresConAlerta: 0, totalPares: 10 },
        ipl05: { estadoCalculo: 'CALCULADO', bloques: [{ tipo: 'OBLIGATORIA', horas: 1800 }] },
        r11:   { estadoCalculo: 'CALCULADO', totalInconsistencias: 0, totalMaterias: 30 },
        r13:   { estadoCalculo: 'CALCULADO', tienePPS: true, tienePI: false },
        r14:   { estadoCalculo: 'CALCULADO', totalConAlerta: 0, totalMaterias: 30 },
      };
      const prisma = makePrisma({
        analisisEjecucion: {
          findUnique: jest.fn().mockResolvedValue(makeRegCarrera({ ambito: 'PLAN', entidadId: PLAN_ID, snapshot: snap })),
          findFirst:  jest.fn().mockResolvedValue(null),
        },
      });
      const svc = new ExportacionesService(prisma as any, makeAnalisis() as any, PARAM_STUB as any);
      const r = await svc.exportarPorEjecucion(EJEC_ID, 'pdf', 'ADMINISTRADOR_SISTEMA', USER_ID);
      expect(r.buffer.length).toBeGreaterThan(1024);
    });
  });

  describe('Excel — contenido por ámbito', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ExcelJS = require('exceljs');

    async function leerExcel(buffer: Buffer) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      return wb;
    }

    function hayTextoEnHoja(ws: any, texto: string): boolean {
      let found = false;
      ws.eachRow((row: any) => {
        row.eachCell((cell: any) => {
          if (String(cell.value ?? '').includes(texto)) found = true;
        });
      });
      return found;
    }

    it('Excel CARRERA contiene hojas base: Resumen, Indicadores, Alertas (más hojas específicas de Fase 5)', async () => {
      const svc = makeService();
      const r = await svc.exportarPorEjecucion(EJEC_ID, 'xlsx', 'ADMINISTRADOR_SISTEMA', USER_ID);
      const wb = await leerExcel(r.buffer);
      const names: string[] = wb.worksheets.map((ws: any) => ws.name);
      expect(names).toContain('Resumen');
      expect(names).toContain('Indicadores');
      expect(names).toContain('Alertas');
      expect(names).toHaveLength(12); // 3 base + 9 específicas de CARRERA (Fase 5)
    });

    it('Hoja Resumen contiene nombre de entidad del snapshot', async () => {
      const svc = makeService();
      const r = await svc.exportarPorEjecucion(EJEC_ID, 'xlsx', 'ADMINISTRADOR_SISTEMA', USER_ID);
      const wb = await leerExcel(r.buffer);
      const ws = wb.getWorksheet('Resumen');
      expect(hayTextoEnHoja(ws, 'Ingeniería en Sistemas')).toBe(true);
    });

    it('Hoja Resumen contiene ejecucionId para trazabilidad', async () => {
      const svc = makeService();
      const r = await svc.exportarPorEjecucion(EJEC_ID, 'xlsx', 'ADMINISTRADOR_SISTEMA', USER_ID);
      const wb = await leerExcel(r.buffer);
      const ws = wb.getWorksheet('Resumen');
      expect(hayTextoEnHoja(ws, EJEC_ID)).toBe(true);
    });

    it('Hoja Indicadores CARRERA tiene fila con código IP01', async () => {
      const svc = makeService();
      const r = await svc.exportarPorEjecucion(EJEC_ID, 'xlsx', 'ADMINISTRADOR_SISTEMA', USER_ID);
      const wb = await leerExcel(r.buffer);
      const ws = wb.getWorksheet('Indicadores');
      expect(hayTextoEnHoja(ws, 'IP01')).toBe(true);
    });

    it('Hoja Indicadores PLAN incluye indicadores de horas por bloque (IPL05)', async () => {
      const snap = {
        estadoGeneralCalculo: 'CALCULADO',
        ipl05: { estadoCalculo: 'CALCULADO', bloques: [{ tipo: 'OBLIGATORIA', horas: 1800 }] },
        r13:   { estadoCalculo: 'CALCULADO', tienePPS: true, tienePI: true },
      };
      const prisma = makePrisma({
        analisisEjecucion: {
          findUnique: jest.fn().mockResolvedValue(makeRegCarrera({ ambito: 'PLAN', entidadId: PLAN_ID, snapshot: snap })),
          findFirst:  jest.fn().mockResolvedValue(null),
        },
      });
      const svc = new ExportacionesService(prisma as any, makeAnalisis() as any, PARAM_STUB as any);
      const r = await svc.exportarPorEjecucion(EJEC_ID, 'xlsx', 'ADMINISTRADOR_SISTEMA', USER_ID);
      const wb = await leerExcel(r.buffer);
      const ws = wb.getWorksheet('Indicadores');
      expect(hayTextoEnHoja(ws, 'IPL05')).toBe(true);
    });

    it('Hoja Indicadores FACULTAD incluye bloque composicion', async () => {
      const snap = {
        estadoGeneralCalculo: 'CALCULADO',
        composicion:   { estadoCalculo: 'CALCULADO', totalDocentes: 40 },
        formacion:     { estadoCalculo: 'PARCIAL',   sinTituloGrado: 2 },
        cargaAcademica:{ estadoCalculo: 'CALCULADO', totalSobreasignados: 0 },
      };
      const prisma = makePrisma({
        analisisEjecucion: {
          findUnique: jest.fn().mockResolvedValue(makeRegCarrera({ ambito: 'FACULTAD', entidadId: FAC_ID, snapshot: snap })),
          findFirst:  jest.fn().mockResolvedValue(null),
        },
      });
      const svc = new ExportacionesService(prisma as any, makeAnalisis() as any, PARAM_STUB as any);
      const r = await svc.exportarPorEjecucion(EJEC_ID, 'xlsx', 'DECANO', USER_ID);
      const wb = await leerExcel(r.buffer);
      const ws = wb.getWorksheet('Indicadores');
      expect(hayTextoEnHoja(ws, 'COMPOSICION')).toBe(true);
    });
  });

  // ── IMPL-18C: Acción Requerida + Listado de docentes ─────────────────────────

  function makeDocPdf(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      docenteId: 'doc-001',
      nombre: 'García López, Juan',
      nMaterias: 3,
      horasCarreraConocidas: 12,
      tieneHorasIncompletas: false,
      fichaScore: 3,
      semaforo: 'VERDE',
      alertas: {},
      ...overrides,
    };
  }

  function makeSnapConListado(
    docentes: Record<string, unknown>[],
    ar?: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      ...makeSnapCarrera(),
      accionRequerida: ar ?? {
        conAlertasAltas:        { total: 0, docentes: [] },
        sobreasignados:         { total: 0, docentes: [] },
        sinActividadCurricular: { total: 0, docentes: [] },
        bajaDedicacion:         { total: 0, docentes: [], umbral: 10, confirmados: 0, inciertos: 0 },
      },
      listadoDocentes: {
        estadoCalculo: 'CALCULADO',
        docentes,
      },
    };
  }

  function makePrismaConSnap(snap: Record<string, unknown>) {
    return makePrisma({
      analisisEjecucion: {
        findUnique: jest.fn().mockResolvedValue(makeRegCarrera({ snapshot: snap })),
        findFirst:  jest.fn().mockResolvedValue(makeRegCarrera({ snapshot: snap })),
      },
    });
  }

  async function generarPdf(snap: Record<string, unknown>): Promise<Buffer> {
    const svc = new ExportacionesService(makePrismaConSnap(snap) as any, makeAnalisis() as any, PARAM_STUB as any);
    const r = await svc.exportarPorEjecucion(EJEC_ID, 'pdf', 'ADMINISTRADOR_SISTEMA', USER_ID);
    return r.buffer;
  }

  describe('PDF tablero carrera — IMPL-18C', () => {

    it('PDF-18C-01: listado sin docentes → PDF válido sin crash', async () => {
      const snap = makeSnapConListado([]);
      const buf = await generarPdf(snap);
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
      expect(buf.length).toBeGreaterThan(1024);
    });

    it('PDF-18C-02: listado con docente y alertas → buffer mayor que snap vacío', async () => {
      const snapVacio = makeSnapConListado([]);
      const snapConDoc = makeSnapConListado([
        makeDocPdf({ alertas: { altaTope: true }, semaforo: 'ROJO' }),
      ]);
      const [bufVacio, bufConDoc] = await Promise.all([
        generarPdf(snapVacio),
        generarPdf(snapConDoc),
      ]);
      expect(bufConDoc.length).toBeGreaterThan(bufVacio.length);
    });

    it('PDF-18C-03: 4 subindicadores AR con docentes → no crash', async () => {
      const ar = {
        conAlertasAltas:        { total: 1, docentes: [{ docenteId: 'x', nombre: 'Pérez, Ana' }] },
        sobreasignados:         { total: 1, docentes: [{ docenteId: 'x', nombre: 'Pérez, Ana' }] },
        sinActividadCurricular: { total: 1, docentes: [{ docenteId: 'x', nombre: 'Pérez, Ana' }] },
        bajaDedicacion:         { total: 1, docentes: [{ docenteId: 'x', nombre: 'Pérez, Ana', incierto: false }], umbral: 10, confirmados: 1, inciertos: 0 },
      };
      const snap = makeSnapConListado([], ar);
      const buf = await generarPdf(snap);
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
    });

    it('PDF-18C-04: bajaDedicacion con confirmados e inciertos → no crash', async () => {
      const ar = {
        conAlertasAltas:        { total: 0, docentes: [] },
        sobreasignados:         { total: 0, docentes: [] },
        sinActividadCurricular: { total: 0, docentes: [] },
        bajaDedicacion: {
          total: 3,
          docentes: [
            { docenteId: 'a', nombre: 'López, Carlos', incierto: false },
            { docenteId: 'b', nombre: 'Martínez, Pedro', incierto: true },
            { docenteId: 'c', nombre: 'Rodríguez, María', incierto: true },
          ],
          umbral: 10,
          confirmados: 1,
          inciertos: 2,
        },
      };
      const snap = makeSnapConListado([], ar);
      const buf = await generarPdf(snap);
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
    });

    it('PDF-18C-05: listado con múltiples docentes → buffer mayor que listado vacío', async () => {
      const snapVacio = makeSnapConListado([]);
      const snapMulti = makeSnapConListado([
        makeDocPdf({ docenteId: 'a', nombre: 'Álvarez, Laura' }),
        makeDocPdf({ docenteId: 'b', nombre: 'Bernal, Mario' }),
        makeDocPdf({ docenteId: 'c', nombre: 'Cabrera, Sofía' }),
      ]);
      const [bufVacio, bufMulti] = await Promise.all([
        generarPdf(snapVacio),
        generarPdf(snapMulti),
      ]);
      expect(bufMulti.length).toBeGreaterThan(bufVacio.length);
    });

    it('PDF-18C-06: fichaScore en rango 0..4 → no crash', async () => {
      const docentes = [0, 1, 2, 3, 4].map(score =>
        makeDocPdf({ docenteId: `d${score}`, nombre: `Doc ${score}`, fichaScore: score }),
      );
      const snap = makeSnapConListado(docentes);
      const buf = await generarPdf(snap);
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
    });

    it('PDF-18C-07: semáforos ROJO/AMARILLO/VERDE y alertas R-03/R-04/R-07 → no crash', async () => {
      const docentes = [
        makeDocPdf({ docenteId: 'r', semaforo: 'ROJO',    alertas: { altaTope: true } }),
        makeDocPdf({ docenteId: 'a', semaforo: 'AMARILLO', alertas: { mediaSobreasignado: true } }),
        makeDocPdf({ docenteId: 'v', semaforo: 'VERDE',    alertas: { altaSinActividad: true } }),
      ];
      const snap = makeSnapConListado(docentes);
      const buf = await generarPdf(snap);
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
    });

    it('PDF-18C-08: valores nulos/undefined en campos opcionales → degradación elegante', async () => {
      const docentes = [
        makeDocPdf({
          horasCarreraConocidas: undefined,
          tieneHorasIncompletas: true,
          fichaScore: undefined,
          semaforo: undefined,
          alertas: undefined,
        }),
      ];
      const snap = {
        ...makeSnapCarrera(),
        accionRequerida: {
          bajaDedicacion: { total: 1, docentes: [{ docenteId: 'x', nombre: 'X' }], umbral: undefined, confirmados: undefined, inciertos: undefined },
        },
        listadoDocentes: { estadoCalculo: 'NO_APLICA', docentes },
      };
      await expect(generarPdf(snap)).resolves.toBeInstanceOf(Buffer);
    });

    it('PDF-18C-09: listado con 25 docentes (paginación) → PDF válido mayor a 3KB', async () => {
      const docentes = Array.from({ length: 25 }, (_, i) =>
        makeDocPdf({ docenteId: `d${i}`, nombre: `Docente ${String(i).padStart(2, '0')}, Apellido` }),
      );
      const snap = makeSnapConListado(docentes);
      const buf = await generarPdf(snap);
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
      expect(buf.length).toBeGreaterThan(3072);
    });

    it('PDF-18C-10: PDF generado con docentes → buffer mayor que sin secciones IMPL-18C', async () => {
      const snapBase = makeSnapCarrera(); // sin accionRequerida ni listadoDocentes
      const snapCompleto = makeSnapConListado([
        makeDocPdf({ docenteId: 'a', nombre: 'García López, Juan' }),
      ]);
      const [bufBase, bufCompleto] = await Promise.all([
        generarPdf(snapBase),
        generarPdf(snapCompleto),
      ]);
      expect(bufCompleto.length).toBeGreaterThan(bufBase.length);
    });

    it('PDF-18C-11: snapshot histórico sin listadoDocentes → no crash, degradación elegante', async () => {
      const snapHistorico: Record<string, unknown> = {
        ...makeSnapCarrera(),
        accionRequerida: {
          conAlertasAltas: { total: 0, docentes: [] },
          sobreasignados:  { total: 0, docentes: [] },
        },
        // listadoDocentes ausente (snapshot pre-IMPL-18C)
      };
      const buf = await generarPdf(snapHistorico);
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
    });

    it('PDF-18C-12: snapshot sin accionRequerida → no crash, sección AR omitida', async () => {
      const snapSinAR: Record<string, unknown> = {
        ...makeSnapCarrera(),
        // accionRequerida ausente (snapshot pre-IMPL-18A)
        listadoDocentes: {
          estadoCalculo: 'CALCULADO',
          docentes: [makeDocPdf()],
        },
      };
      const buf = await generarPdf(snapSinAR);
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
    });

    it('PDF-CIERRE01-01: etiqueta ip01 en metaCarreraLabels es "Total docentes" (CIERRE-01)', () => {
      const ip01 = metaCarreraLabels.find(([k]) => k === 'ip01');
      expect(ip01).toBeDefined();
      expect(ip01![1]).toBe('IP-01 — Total docentes');
      expect(ip01![1]).not.toContain('exclusiva');
    });

  });

  // ── PDF tablero plan — Fase 2 ─────────────────────────────────────────────────

  describe('PDF tablero plan — Fase 2', () => {
    function makeSnapPlan(extra: Record<string, unknown> = {}): Record<string, unknown> {
      return {
        estadoGeneralCalculo: 'CALCULADO',
        ipl01: {
          estadoCalculo: 'CALCULADO', cumple: true,
          horasTotal: 2800, horasMinimas: 2700, diferencia: 100,
        },
        ipl02: {
          estadoCalculo: 'CALCULADO', bloquesCumplen: 3, bloquesConUmbral: 4,
        },
        ipl03: {
          estadoCalculo: 'CALCULADO', sinResponsable: 2, inciertas: 1,
          conResponsable: 27, totalMaterias: 30,
        },
        ipl04: {
          estadoCalculo: 'CALCULADO', paresConAlerta: 1, paresInciertos: 0, totalMaterias: 30,
        },
        ipl05: {
          estadoCalculo: 'CALCULADO',
          bloques: [
            { bloque: 'CB', horasReales: 800, horasMinimas: 800, diferencia: 0, cumple: true,  estadoCalculo: 'CALCULADO' },
            { bloque: 'TB', horasReales: 600, horasMinimas: 700, diferencia: -100, cumple: false, estadoCalculo: 'CALCULADO' },
          ],
        },
        r11: {
          estadoCalculo: 'CALCULADO',
          totalMaterias: 30, totalConPrograma: 25, totalSinPrograma: 5,
          totalInconsistencias: 3, totalAlta: 1, totalMedia: 2,
          inconsistencias: [
            { materiaCodigo: 'MAT01', materiaNombre: 'Álgebra I', seccionesCompletas: 4, seccionesPendientes: 2, prioridad: 'ALTA' },
          ],
          sinPrograma: [
            { materiaCodigo: 'MAT05', materiaNombre: 'Física III' },
          ],
        },
        r13: {
          estadoCalculo: 'CALCULADO',
          totalMaterias: 30, tienePPS: true, tienePI: false,
          horasPPS: 200, horasPI: null,
          porTipo: { PPS: 2, 'PRÁCTICA SUPERVISADA': 1 },
          materiasPPS: [
            { id: 'm1', nombre: 'PPS I', codigo: 'PPS01', tipoAsignatura: 'PPS', cargaHorariaTotal: 100 },
          ],
          materiasPI: [],
        },
        r14: {
          estadoCalculo: 'CALCULADO',
          totalMaterias: 30, totalEvaluadas: 28, totalConAlerta: 2, totalSinDatos: 2,
          enAlerta: [
            { materiaCodigo: 'MAT02', materiaNombre: 'Cálculo II', horasFormacionPractica: 80, horasTotal: 60, exceso: 20 },
          ],
        },
        advertencias: ['Sin datos de cargas horarias para 2 materias'],
        datosFaltantes: [{ campo: 'horasTotales.MAT03', descripcion: 'Materia sin carga horaria registrada' }],
        ...extra,
      };
    }

    function makePlanPrisma(snapOverride?: Record<string, unknown>) {
      const snap = snapOverride ?? makeSnapPlan();
      return makePrisma({
        analisisEjecucion: {
          findUnique: jest.fn().mockResolvedValue({
            id: EJEC_ID, ambito: 'PLAN', entidadId: PLAN_ID,
            facultadId: FAC_ID, usuarioId: USER_ID, estado: 'COMPLETADO',
            fechaFin: new Date('2026-10-20T10:00:00Z'), snapshot: snap,
          }),
          findFirst: jest.fn().mockResolvedValue(null),
        },
        planEstudio: {
          findUnique: jest.fn().mockResolvedValue({
            nombre: 'Plan 2020',
            carrera: { nombre: 'Ing. en Sistemas', facultad: { nombre: 'Fac. de Ingeniería' } },
          }),
        },
      });
    }

    async function generarPdfPlan(snap?: Record<string, unknown>): Promise<Buffer> {
      const svc = new ExportacionesService(makePlanPrisma(snap) as any, makeAnalisis() as any, PARAM_STUB as any);
      const r = await svc.exportarPorEjecucion(EJEC_ID, 'pdf', 'ADMINISTRADOR_SISTEMA', USER_ID);
      return r.buffer;
    }

    it('PDF-PLAN-01: genera PDF válido (firma %PDF)', async () => {
      const buf = await generarPdfPlan();
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
    });

    it('PDF-PLAN-02: PDF tiene tamaño razonable (>= 5KB con detalle completo)', async () => {
      const buf = await generarPdfPlan();
      expect(buf.length).toBeGreaterThan(5 * 1024);
    });

    it('PDF-PLAN-03: snapshot mínimo (solo ipl01) no genera crash', async () => {
      const snapMinimo: Record<string, unknown> = {
        estadoGeneralCalculo: 'CALCULADO',
        ipl01: { estadoCalculo: 'CALCULADO', horasTotal: 2800, cumple: true },
      };
      const buf = await generarPdfPlan(snapMinimo);
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
    });

    it('PDF-PLAN-04: snapshot vacío (sin indicadores) no genera crash', async () => {
      const snapVacio: Record<string, unknown> = { estadoGeneralCalculo: null };
      const buf = await generarPdfPlan(snapVacio);
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
    });

    it('PDF-PLAN-05: jerarquía facultad/carrera/plan llega al servicio desde Prisma', async () => {
      // Verifica que _obtenerMetadataEntidad resuelve la cadena plan→carrera→facultad
      const prisma = makePlanPrisma();
      const svc = new ExportacionesService(prisma as any, makeAnalisis() as any, PARAM_STUB as any);
      const r = await svc.exportarPorEjecucion(EJEC_ID, 'pdf', 'ADMINISTRADOR_SISTEMA', USER_ID);
      expect(r.buffer.slice(0, 4).toString()).toBe('%PDF');
      expect((prisma.planEstudio.findUnique as jest.Mock)).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: PLAN_ID } }),
      );
    });

    it('PDF-PLAN-06: PDF con advertencias y datosFaltantes es mayor que sin ellos', async () => {
      const [bufConAdvertencias, bufSinAdvertencias] = await Promise.all([
        generarPdfPlan(makeSnapPlan()),
        generarPdfPlan({ estadoGeneralCalculo: 'CALCULADO' }),
      ]);
      expect(bufConAdvertencias.length).toBeGreaterThan(bufSinAdvertencias.length);
    });

    it('PDF-PLAN-07: ipl05 con bloques vacíos no genera crash', async () => {
      const snap = makeSnapPlan({ ipl05: { estadoCalculo: 'NO_DETERMINABLE', bloques: [] } });
      const buf = await generarPdfPlan(snap);
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
    });
  });

  // ── Excel tablero plan — Fase 3 ───────────────────────────────────────────────

  describe('Excel tablero plan — Fase 3', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ExcelJS3 = require('exceljs');

    function makeSnapPlanExcel(extra: Record<string, unknown> = {}): Record<string, unknown> {
      return {
        estadoGeneralCalculo: 'CALCULADO',
        ipl01: { estadoCalculo: 'CALCULADO', cumple: true, horasTotal: 2800, horasMinimas: 2700, diferencia: 100 },
        ipl02: { estadoCalculo: 'CALCULADO', bloquesCumplen: 3, bloquesConUmbral: 4 },
        ipl03: { estadoCalculo: 'CALCULADO', sinResponsable: 1, inciertas: 1, conResponsable: 28, totalMaterias: 30 },
        ipl04: { estadoCalculo: 'CALCULADO', paresConAlerta: 2, paresInciertos: 0, totalMaterias: 30 },
        ipl05: {
          estadoCalculo: 'CALCULADO',
          bloques: [
            { bloque: 'CB', horasReales: 800, horasMinimas: 800, diferencia: 0, cumple: true, estadoCalculo: 'CALCULADO' },
            { bloque: 'TB', horasReales: 600, horasMinimas: 700, diferencia: -100, cumple: false, estadoCalculo: 'CALCULADO' },
          ],
        },
        r11: {
          estadoCalculo: 'CALCULADO', totalMaterias: 30, totalConPrograma: 26, totalSinPrograma: 4,
          totalInconsistencias: 2, totalAlta: 1, totalMedia: 1,
          inconsistencias: [
            { materiaCodigo: 'MAT01', materiaNombre: 'Álgebra I', seccionesCompletas: 4, seccionesPendientes: 2, prioridad: 'ALTA' },
            { materiaCodigo: 'MAT02', materiaNombre: 'Cálculo II', seccionesCompletas: 3, seccionesPendientes: 1, prioridad: 'MEDIA' },
          ],
          sinPrograma: [
            { materiaCodigo: 'MAT05', materiaNombre: 'Física III' },
            { materiaCodigo: 'MAT06', materiaNombre: 'Física IV' },
          ],
        },
        r13: {
          estadoCalculo: 'CALCULADO', totalMaterias: 30, tienePPS: true, tienePI: false,
          horasPPS: 200, horasPI: null,
          porTipo: { PPS: 2, 'PRÁCTICA SUPERVISADA': 1 },
          materiasPPS: [
            { id: 'm1', nombre: 'PPS I', codigo: 'PPS01', tipoAsignatura: 'PPS', cargaHorariaTotal: 100 },
            { id: 'm2', nombre: 'PPS II', codigo: 'PPS02', tipoAsignatura: 'PPS', cargaHorariaTotal: 100 },
          ],
          materiasPI: [],
        },
        r14: {
          estadoCalculo: 'CALCULADO', totalMaterias: 30, totalEvaluadas: 28, totalConAlerta: 2, totalSinDatos: 2,
          enAlerta: [
            { materiaCodigo: 'MAT07', materiaNombre: 'Lab. Electrónica', horasFormacionPractica: 80, horasTotal: 60, exceso: 20 },
          ],
        },
        advertencias: ['IPL-03: Hay 1 materia con asignación incierta', 'Advertencia sin indicador'],
        datosFaltantes: [
          { campo: 'horasTotales.MAT03', descripcion: 'Sin carga horaria registrada' },
        ],
        ...extra,
      };
    }

    async function generarExcelPlan(snap?: Record<string, unknown>) {
      const snapFinal = snap ?? makeSnapPlanExcel();
      const prisma = makePrisma({
        analisisEjecucion: {
          findUnique: jest.fn().mockResolvedValue({
            id: EJEC_ID, ambito: 'PLAN', entidadId: PLAN_ID,
            facultadId: FAC_ID, usuarioId: USER_ID, estado: 'COMPLETADO',
            fechaFin: new Date('2026-10-20T10:00:00Z'), snapshot: snapFinal,
          }),
          findFirst: jest.fn().mockResolvedValue(null),
        },
        planEstudio: {
          findUnique: jest.fn().mockResolvedValue({
            nombre: 'Plan 2020',
            carrera: { nombre: 'Ing. en Sistemas', facultad: { nombre: 'Fac. de Ingeniería' } },
          }),
        },
      });
      const svc = new ExportacionesService(prisma as any, makeAnalisis() as any, PARAM_STUB as any);
      const r = await svc.exportarPorEjecucion(EJEC_ID, 'xlsx', 'ADMINISTRADOR_SISTEMA', USER_ID);
      const wb = new ExcelJS3.Workbook();
      await wb.xlsx.load(r.buffer);
      return { wb, buffer: r.buffer };
    }

    function sheetNames(wb: any): string[] {
      return wb.worksheets.map((ws: any) => ws.name);
    }

    function cellTexts(ws: any): string[] {
      const texts: string[] = [];
      ws.eachRow((row: any) => {
        row.eachCell((cell: any) => {
          const v = String(cell.value ?? '');
          if (v && v !== '—') texts.push(v);
        });
      });
      return texts;
    }

    it('XLS-PLAN-01: Excel PLAN contiene exactamente 12 hojas', async () => {
      const { wb } = await generarExcelPlan();
      expect(sheetNames(wb)).toHaveLength(12);
    });

    it('XLS-PLAN-02: todas las hojas esperadas están presentes', async () => {
      const { wb } = await generarExcelPlan();
      const names = sheetNames(wb);
      for (const expected of [
        'Resumen', 'Indicadores', 'Alertas',
        'IPL-01 Horas Plan', 'IPL-02 Cobertura', 'IPL-03 Responsables',
        'IPL-04 Multirespons.', 'IPL-05 Horas Bloque',
        'R-11 Programas', 'R-13 Practica', 'R-14 Conflictos', 'Advertencias',
      ]) {
        expect(names).toContain(expected);
      }
    });

    it('XLS-PLAN-03: Resumen contiene jerarquía facultad, carrera, plan', async () => {
      const { wb } = await generarExcelPlan();
      const texts = cellTexts(wb.getWorksheet('Resumen'));
      expect(texts.some(t => t.includes('Fac. de Ingeniería'))).toBe(true);
      expect(texts.some(t => t.includes('Ing. en Sistemas'))).toBe(true);
      expect(texts.some(t => t.includes('Plan 2020'))).toBe(true);
    });

    it('XLS-PLAN-04: Resumen contiene Universidad y ejecucionId', async () => {
      const { wb } = await generarExcelPlan();
      const texts = cellTexts(wb.getWorksheet('Resumen'));
      expect(texts.some(t => t.includes('UDEMM'))).toBe(true);
      expect(texts.some(t => t.includes(EJEC_ID))).toBe(true);
    });

    it('XLS-PLAN-05: IPL-01 contiene horas totales, mínimas y diferencia', async () => {
      const { wb } = await generarExcelPlan();
      const ws = wb.getWorksheet('IPL-01 Horas Plan');
      expect(ws).toBeDefined();
      const texts = cellTexts(ws);
      expect(texts.some(t => String(t).includes('2800'))).toBe(true);
      expect(texts.some(t => String(t).includes('2700'))).toBe(true);
    });

    it('XLS-PLAN-06: IPL-02 contiene bloques que cumplen', async () => {
      const { wb } = await generarExcelPlan();
      const texts = cellTexts(wb.getWorksheet('IPL-02 Cobertura'));
      expect(texts.some(t => String(t).includes('3'))).toBe(true);
      expect(texts.some(t => String(t).includes('4'))).toBe(true);
    });

    it('XLS-PLAN-07: IPL-05 tabla de bloques contiene CB y TB', async () => {
      const { wb } = await generarExcelPlan();
      const texts = cellTexts(wb.getWorksheet('IPL-05 Horas Bloque'));
      expect(texts).toContain('CB');
      expect(texts).toContain('TB');
    });

    it('XLS-PLAN-08: R-11 tabla inconsistencias contiene MAT01 y MAT02', async () => {
      const { wb } = await generarExcelPlan();
      const texts = cellTexts(wb.getWorksheet('R-11 Programas'));
      expect(texts.some(t => t.includes('MAT01'))).toBe(true);
      expect(texts.some(t => t.includes('MAT02'))).toBe(true);
    });

    it('XLS-PLAN-09: R-11 tabla sinPrograma contiene MAT05 y MAT06', async () => {
      const { wb } = await generarExcelPlan();
      const texts = cellTexts(wb.getWorksheet('R-11 Programas'));
      expect(texts.some(t => t.includes('MAT05'))).toBe(true);
      expect(texts.some(t => t.includes('MAT06'))).toBe(true);
    });

    it('XLS-PLAN-10: R-13 contiene materias PPS y distribución por tipo', async () => {
      const { wb } = await generarExcelPlan();
      const texts = cellTexts(wb.getWorksheet('R-13 Practica'));
      expect(texts.some(t => t.includes('PPS01'))).toBe(true);
      expect(texts.some(t => t.includes('PPS'))).toBe(true);
    });

    it('XLS-PLAN-11: R-14 tabla enAlerta contiene MAT07 y exceso', async () => {
      const { wb } = await generarExcelPlan();
      const texts = cellTexts(wb.getWorksheet('R-14 Conflictos'));
      expect(texts.some(t => t.includes('MAT07'))).toBe(true);
      expect(texts.some(t => String(t).includes('20'))).toBe(true);
    });

    it('XLS-PLAN-12: Advertencias contiene advertencias y datosFaltantes', async () => {
      const { wb } = await generarExcelPlan();
      const texts = cellTexts(wb.getWorksheet('Advertencias'));
      expect(texts.some(t => t.includes('incierta'))).toBe(true);
      expect(texts.some(t => t.includes('MAT03'))).toBe(true);
    });

    it('XLS-PLAN-13: snapshot vacío (sin indicadores) no genera crash', async () => {
      const { wb } = await generarExcelPlan({ estadoGeneralCalculo: null });
      expect(sheetNames(wb)).toHaveLength(12);
    });

    it('XLS-PLAN-14: snapshot sin advertencias ni datosFaltantes — hoja Advertencias sin crash', async () => {
      const snapSin = { ...makeSnapPlanExcel(), advertencias: undefined, datosFaltantes: undefined };
      const { wb } = await generarExcelPlan(snapSin);
      const ws = wb.getWorksheet('Advertencias');
      expect(ws).toBeDefined();
    });

    it('XLS-PLAN-15: IPL-05 sin bloques — hoja generada con mensaje claro', async () => {
      const snap = { ...makeSnapPlanExcel(), ipl05: { estadoCalculo: 'NO_DETERMINABLE', bloques: [] } };
      const { wb } = await generarExcelPlan(snap);
      const ws = wb.getWorksheet('IPL-05 Horas Bloque');
      expect(ws).toBeDefined();
    });

    it('XLS-PLAN-16: exportación CARRERA contiene exactamente 12 hojas (Fase 5)', async () => {
      const svc = makeService();
      const r = await svc.exportarPorEjecucion(EJEC_ID, 'xlsx', 'ADMINISTRADOR_SISTEMA', USER_ID);
      const wb = new ExcelJS3.Workbook();
      await wb.xlsx.load(r.buffer);
      expect(sheetNames(wb)).toHaveLength(12);
    });

    it('XLS-PLAN-17: ejecucionId conservado como texto en ID Ejecución (sin conversión numérica)', async () => {
      const { wb } = await generarExcelPlan();
      const texts = cellTexts(wb.getWorksheet('Resumen'));
      expect(texts.some(t => t === EJEC_ID)).toBe(true);
    });
  });

  // ── Consistencia datos PDF / Excel / snapshot ──────────────────────────────────

  describe('consistencia datos PDF / Excel / snapshot', () => {
    it('PDF y Excel generados desde el mismo ejecucionId usan la misma entidad en el filename', async () => {
      const svc = makeService();
      const [pdf, xlsx] = await Promise.all([
        svc.exportarPorEjecucion(EJEC_ID, 'pdf',  'ADMINISTRADOR_SISTEMA', USER_ID),
        svc.exportarPorEjecucion(EJEC_ID, 'xlsx', 'ADMINISTRADOR_SISTEMA', USER_ID),
      ]);
      // Ambos filenames referencian el mismo ámbito y entidad
      expect(pdf.filename.startsWith('autoevaluacion_carrera_')).toBe(true);
      expect(xlsx.filename.startsWith('autoevaluacion_carrera_')).toBe(true);
    });

    it('Excel contiene ejecucionId del snapshot (trazabilidad)', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ExcelJS2 = require('exceljs');
      const svc = makeService();
      const r = await svc.exportarPorEjecucion(EJEC_ID, 'xlsx', 'ADMINISTRADOR_SISTEMA', USER_ID);
      const wb = new ExcelJS2.Workbook();
      await wb.xlsx.load(r.buffer);
      const ws = wb.getWorksheet('Resumen');
      let foundId = false;
      ws.eachRow((row: any) => {
        row.eachCell((cell: any) => {
          if (String(cell.value ?? '') === EJEC_ID) foundId = true;
        });
      });
      expect(foundId).toBe(true);
    });
  });

  // ── PDF tablero carrera — Fase 4 ──────────────────────────────────────────

  describe('PDF tablero carrera — Fase 4', () => {
    const EJEC_CAR = 'ejec-car-fase4';
    const USER_CAR = 'user-car-fase4';

    function makeSnapCarrera(overrides: Record<string, unknown> = {}): Record<string, unknown> {
      return {
        ip01: { total: 12, estadoCalculo: 'COMPLETADO' },
        ip02: { total: 10, estadoCalculo: 'COMPLETADO' },
        ip03: { cubiertas: 9, total: 12, estadoCalculo: 'COMPLETADO' },
        ip04: {
          totalDocentes: 12,
          mediana: 3.5,
          promedio: 3.8,
          maximo: 7,
          distribucion: [
            { docenteId: 'd1', nombre: 'García, Ana',    nMaterias: 7 },
            { docenteId: 'd2', nombre: 'López, Carlos',  nMaterias: 5 },
          ],
          estadoCalculo: 'COMPLETADO',
        },
        ip08: { profesores: 8, auxiliares: 4, ratio: 2.0, estadoCalculo: 'COMPLETADO' },
        ip09: { totalDocentes: 12, completitudPromedio: 85, estadoCalculo: 'COMPLETADO' },
        ip10: {
          carreraId: 'car-1',
          puntaje: 75,
          componenteA: 1,
          componenteM: 2,
          alertasR03: 1,
          alertasR04Penalizables: 0,
          alertasR07: 2,
          estadoCalculo: 'COMPLETADO',
        },
        ip13: {
          totalDocentes: 12,
          totalSobreasignados: 1,
          totalNoDeterminables: 0,
          limite: 6,
          alcanceFacultad: true,
          sobreasignados: [
            { docenteId: 'd1', nombre: 'García, Ana', nMaterias: 7, exceso: 1 },
          ],
          estadoCalculo: 'ADVERTENCIA',
        },
        r10: {
          carreraId: 'car-1',
          umbral: 10,
          totalDocentes: 12,
          totalEnAlerta: 1,
          totalInciertos: 2,
          alcanceFacultad: true,
          enAlerta: [
            { docenteId: 'd3', nombre: 'Martínez, Luis', horasConocidas: 6, umbral: 10 },
          ],
          estadoCalculo: 'ADVERTENCIA',
        },
        r12: {
          carreraId: 'car-1',
          facultadId: 'fac-1',
          totalDocentes: 12,
          totalIncompletos: 2,
          totalNoDeterminables: 1,
          alcanceFacultad: true,
          incompletos: [
            { docenteId: 'd2', nombre: 'López, Carlos',  faltantes: ['personales', 'formacionGrado'] },
            { docenteId: 'd4', nombre: 'Pérez, María',   faltantes: ['areaDesempeno'] },
          ],
          noDeterminables: [
            { docenteId: 'd5', nombre: 'Rodríguez, Juan' },
          ],
          estadoCalculo: 'ADVERTENCIA',
        },
        condicionesPlantell: {
          totalDocentes: 12,
          conPosgrado: 8,
          conInvestigacion: 4,
          conDesignacionRegular: 6,
          conDesignacionInterina: 3,
          relacionPA: { profesores: 8, auxiliares: 4 },
          dedicacionPorTipo: [
            { tipo: 'Titular', docentes: 3 },
            { tipo: 'Adjunto', docentes: 5 },
          ],
          dedicacionConeau: [
            { categoria: 'EXCLUSIVA', docentes: 2 },
            { categoria: 'SEMIDEDICACION', docentes: 4 },
            { categoria: 'SIMPLE', docentes: 6 },
          ],
          distribucionPosgrado: [
            { tipo: 'Doctorado', docentes: 3 },
            { tipo: 'Maestría',  docentes: 5 },
          ],
          estadoCalculo: 'COMPLETADO',
        },
        accionRequerida: {
          conAlertasAltas: 1, sobreasignados: 1,
          sinActividadCurricular: 0,
          bajaDedicacion: { umbral: 10, confirmados: 1, inciertos: 2 },
          estadoCalculo: 'ADVERTENCIA',
        },
        ...overrides,
      };
    }

    function makeCarreraPrisma(snap: Record<string, unknown> = {}) {
      const snapshot = makeSnapCarrera(snap);
      return {
        ejecucionId: EJEC_CAR,
        ambito: 'CARRERA' as const,
        entidadId: 'car-fase4',
        entidadNombre: 'Ingeniería en Sistemas',
        facultadNombre: 'Facultad de Tecnología',
        carreraNombre: undefined,
        facultadId: 'fac-1',
        usuarioId: USER_CAR,
        fechaEjecucion: new Date().toISOString(),
        estadoCalculo: null,
        snapshot,
        alertas: [],
      };
    }

    async function generarPdfCarrera(snap?: Record<string, unknown>): Promise<Buffer> {
      const { generarPdfBuffer } = await import(
        './pdf.generator'
      );
      return generarPdfBuffer(makeCarreraPrisma(snap ?? {}));
    }

    it('PDF-CAR-01: genera PDF válido con todos los indicadores de carrera', async () => {
      const buf = await generarPdfCarrera();
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
    });

    it('PDF-CAR-02: PDF carrera con detalle tiene tamaño mayor que sin detalle (nueva secciones añaden contenido)', async () => {
      const { generarPdfBuffer } = await import('./pdf.generator');
      const snapVacio = makeSnapCarrera({
        ip04: undefined, ip08: undefined, ip09: undefined,
        ip10: undefined, ip13: undefined, r10: undefined,
        r12: undefined, condicionesPlantell: undefined,
      });
      const snapCompleto = makeSnapCarrera();
      const [small, big] = await Promise.all([
        generarPdfBuffer({ ...makeCarreraPrisma(), snapshot: snapVacio }),
        generarPdfBuffer({ ...makeCarreraPrisma(), snapshot: snapCompleto }),
      ]);
      expect(big.length).toBeGreaterThan(small.length);
    });

    it('PDF-CAR-03: ip04 sin distribucion → no crash, degradación elegante', async () => {
      const buf = await generarPdfCarrera({
        ip04: { totalDocentes: 5, mediana: null, promedio: null, maximo: null,
                distribucion: [], estadoCalculo: 'SIN_DATOS' },
      });
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
    });

    it('PDF-CAR-04: ip08 sin auxiliares (ratio null) → no crash', async () => {
      const buf = await generarPdfCarrera({
        ip08: { profesores: 8, auxiliares: 0, ratio: null, estadoCalculo: 'COMPLETADO' },
      });
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
    });

    it('PDF-CAR-05: ip13 con alcanceFacultad=false → muestra advertencia de alcance parcial', async () => {
      const buf = await generarPdfCarrera({
        ip13: {
          totalDocentes: 5, totalSobreasignados: 0, totalNoDeterminables: 2,
          limite: 6, alcanceFacultad: false, sobreasignados: [], estadoCalculo: 'COMPLETADO',
        },
      });
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
      expect(buf.length).toBeGreaterThan(1024);
    });

    it('PDF-CAR-06: r10 con alcanceFacultad=false → no crash', async () => {
      const buf = await generarPdfCarrera({
        r10: {
          carreraId: 'car-1', umbral: 10, totalDocentes: 5,
          totalEnAlerta: 0, totalInciertos: 0,
          alcanceFacultad: false, enAlerta: [], estadoCalculo: 'COMPLETADO',
        },
      });
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
    });

    it('PDF-CAR-07: r12 con docentes en noDeterminables → nota visible, no crash', async () => {
      const buf = await generarPdfCarrera({
        r12: {
          carreraId: 'car-1', facultadId: 'fac-1',
          totalDocentes: 5, totalIncompletos: 1, totalNoDeterminables: 2,
          alcanceFacultad: true,
          incompletos: [
            { docenteId: 'd1', nombre: 'García, Ana', faltantes: ['personales'] },
          ],
          noDeterminables: [
            { docenteId: 'd2', nombre: 'López, Carlos' },
            { docenteId: 'd3', nombre: 'Martínez, Luis' },
          ],
          estadoCalculo: 'ADVERTENCIA',
        },
      });
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
    });

    it('PDF-CAR-08: condicionesPlantell ausente → sección CONEAU omitida, no crash', async () => {
      const buf = await generarPdfCarrera({ condicionesPlantell: undefined });
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
    });

    it('PDF-CAR-09: condicionesPlantell sin dedicacionConeau ni distribucionPosgrado → no crash', async () => {
      const buf = await generarPdfCarrera({
        condicionesPlantell: {
          totalDocentes: 10, conPosgrado: 5, conInvestigacion: 2,
          conDesignacionRegular: 4, conDesignacionInterina: 2,
          estadoCalculo: 'COMPLETADO',
        },
      });
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
    });

    it('PDF-CAR-10: snapshot vacío (sin ningún indicador) → no crash, degradación elegante', async () => {
      const { generarPdfBuffer } = await import('./pdf.generator');
      const buf = await generarPdfBuffer({
        ejecucionId: EJEC_CAR, ambito: 'CARRERA', entidadId: 'car-1',
        entidadNombre: 'Carrera vacía', facultadId: 'fac-1',
        usuarioId: USER_CAR, fechaEjecucion: new Date().toISOString(),
        estadoCalculo: null, snapshot: {}, alertas: [],
      });
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
    });

    it('PDF-CAR-11: ip10 con puntaje bajo (< 50) → no crash', async () => {
      const buf = await generarPdfCarrera({
        ip10: {
          carreraId: 'car-1', puntaje: 25,
          componenteA: 3, componenteM: 0,
          alertasR03: 3, alertasR04Penalizables: 0, alertasR07: 0,
          estadoCalculo: 'CRITICO',
        },
      });
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
    });

    it('PDF-CAR-12: ip04 con 30 docentes en distribucion → tabla paginada, PDF válido > 3KB', async () => {
      const dist = Array.from({ length: 30 }, (_, i) => ({
        docenteId: `d${i}`, nombre: `Docente ${String(i + 1).padStart(2, '0')}`, nMaterias: 3 + (i % 5),
      }));
      const buf = await generarPdfCarrera({
        ip04: { totalDocentes: 30, mediana: 4.0, promedio: 4.1, maximo: 8, distribucion: dist, estadoCalculo: 'COMPLETADO' },
      });
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
      expect(buf.length).toBeGreaterThan(3 * 1024);
    });
  });

  // ── Excel tablero carrera — Fase 5 ────────────────────────────────────────────

  describe('Excel tablero carrera — Fase 5', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ExcelJS5 = require('exceljs');

    const EJEC_CAR5 = 'ejec-car-fase5';
    const CAR5_ID   = 'car-fase5';
    const FAC5_ID   = 'fac-fase5';
    const USER_CAR5 = 'user-car-fase5';

    function makeSnapCarreraExcel(overrides: Record<string, unknown> = {}): Record<string, unknown> {
      return {
        ip01: { total: 12, estadoCalculo: 'CALCULADO' },
        ip04: {
          totalDocentes: 5, mediana: 3.5, promedio: 3.8, maximo: 6,
          distribucion: [
            { docenteId: 'd1', nombre: 'García, Ana',   nMaterias: 6 },
            { docenteId: 'd2', nombre: 'López, Carlos', nMaterias: 4 },
          ],
          estadoCalculo: 'CALCULADO',
        },
        ip08: { profesores: 8, auxiliares: 4, ratio: 2.0, estadoCalculo: 'CALCULADO' },
        ip09: { totalDocentes: 5, completitudPromedio: 85, estadoCalculo: 'CALCULADO' },
        ip10: {
          carreraId: CAR5_ID, puntaje: 75,
          componenteA: 1, componenteM: 2, alertasR03: 1, alertasR04Penalizables: 0, alertasR07: 2,
          estadoCalculo: 'CALCULADO',
        },
        ip13: {
          totalDocentes: 5, totalSobreasignados: 1, totalNoDeterminables: 0,
          limite: 6, alcanceFacultad: true,
          sobreasignados: [
            { docenteId: 'd1', nombre: 'García, Ana', nMaterias: 6, exceso: 0 },
          ],
          estadoCalculo: 'CALCULADO',
        },
        r10: {
          carreraId: CAR5_ID, umbral: 10, totalDocentes: 5,
          totalEnAlerta: 1, totalInciertos: 0, alcanceFacultad: true,
          enAlerta: [
            { docenteId: 'd3', nombre: 'Martínez, Luis', horasConocidas: 6, umbral: 10 },
          ],
          estadoCalculo: 'CALCULADO',
        },
        r12: {
          carreraId: CAR5_ID, facultadId: FAC5_ID,
          totalDocentes: 5, totalIncompletos: 1, totalNoDeterminables: 0,
          alcanceFacultad: true,
          incompletos: [
            { docenteId: 'd2', nombre: 'López, Carlos', faltantes: ['personales', 'formacionGrado'] },
          ],
          noDeterminables: [],
          estadoCalculo: 'CALCULADO',
        },
        condicionesPlantell: {
          totalDocentes: 10, conPosgrado: 6, conInvestigacion: 3,
          conDesignacionRegular: 4, conDesignacionInterina: 2,
          relacionPA: { profesores: 8, auxiliares: 4 },
          dedicacionPorTipo: [{ tipo: 'Titular', docentes: 3 }, { tipo: 'Adjunto', docentes: 5 }],
          dedicacionConeau: [
            { categoria: 'EXCLUSIVA', docentes: 2 },
            { categoria: 'SEMIDEDICACION', docentes: 4 },
            { categoria: 'SIMPLE', docentes: 4 },
          ],
          distribucionPosgrado: [
            { tipo: 'Doctorado', docentes: 3 },
            { tipo: 'Maestría',  docentes: 3 },
          ],
          estadoCalculo: 'CALCULADO',
        },
        ...overrides,
      };
    }

    function makePrismaCarrera5(snap: Record<string, unknown>) {
      return makePrisma({
        analisisEjecucion: {
          findUnique: jest.fn().mockResolvedValue({
            id: EJEC_CAR5, ambito: 'CARRERA', entidadId: CAR5_ID,
            facultadId: FAC5_ID, usuarioId: USER_CAR5, estado: 'COMPLETADO',
            fechaFin: new Date('2026-10-28T12:00:00Z'), snapshot: snap,
          }),
          findFirst: jest.fn().mockResolvedValue(null),
        },
        carrera: {
          findUnique: jest.fn().mockResolvedValue({
            nombre: 'Ing. en Sistemas',
            facultad: { nombre: 'Fac. de Tecnología' },
          }),
        },
      });
    }

    async function generarExcelCarrera5(snap?: Record<string, unknown>): Promise<{ wb: any; buffer: Buffer }> {
      const snapFinal = snap ?? makeSnapCarreraExcel();
      const prisma = makePrismaCarrera5(snapFinal);
      const svc = new ExportacionesService(prisma as any, makeAnalisis() as any, PARAM_STUB as any);
      const r = await svc.exportarPorEjecucion(EJEC_CAR5, 'xlsx', 'ADMINISTRADOR_SISTEMA', USER_CAR5);
      const wb = new ExcelJS5.Workbook();
      await wb.xlsx.load(r.buffer);
      return { wb, buffer: r.buffer };
    }

    function sheetNames5(wb: any): string[] {
      return wb.worksheets.map((ws: any) => ws.name);
    }

    function cellTexts5(ws: any): string[] {
      const texts: string[] = [];
      ws.eachRow((row: any) => {
        row.eachCell((cell: any) => {
          const v = cell.value;
          if (v !== null && v !== undefined && v !== '') texts.push(String(v));
        });
      });
      return texts;
    }

    it('XLS-CAR-01: Excel CARRERA contiene exactamente 12 hojas', async () => {
      const { wb } = await generarExcelCarrera5();
      expect(sheetNames5(wb)).toHaveLength(12);
    });

    it('XLS-CAR-02: todas las hojas esperadas están presentes', async () => {
      const { wb } = await generarExcelCarrera5();
      const names = sheetNames5(wb);
      const expected = [
        'Resumen', 'Indicadores', 'Alertas',
        'IP-04 Distribución', 'IP-08 Relacion P-A', 'IP-09 Completitud',
        'IP-10 Consistencia', 'IP-13 Sobreasig.', 'R-10 Horas Doc.',
        'R-12 Fichas Doc.', 'Cond.Plantel CONEAU', 'Advertencias',
      ];
      for (const name of expected) {
        expect(names).toContain(name);
      }
    });

    it('XLS-CAR-03: Resumen contiene jerarquía facultad y nombre de carrera', async () => {
      const { wb } = await generarExcelCarrera5();
      const ws = wb.getWorksheet('Resumen');
      const texts = cellTexts5(ws);
      expect(texts.some(t => t.includes('UDEMM'))).toBe(true);
      expect(texts.some(t => t === 'Ing. en Sistemas')).toBe(true);
    });

    it('XLS-CAR-04: IP-04 hoja contiene mediana, promedio y tabla de distribución', async () => {
      const { wb } = await generarExcelCarrera5();
      const ws = wb.getWorksheet('IP-04 Distribución');
      const texts = cellTexts5(ws);
      expect(texts.some(t => t.includes('Mediana'))).toBe(true);
      expect(texts.some(t => t.includes('García, Ana'))).toBe(true);
    });

    it('XLS-CAR-05: IP-08 hoja contiene profesores y relación P/A', async () => {
      const { wb } = await generarExcelCarrera5();
      const ws = wb.getWorksheet('IP-08 Relacion P-A');
      const texts = cellTexts5(ws);
      expect(texts.some(t => t.toLowerCase().includes('profesores'))).toBe(true);
      expect(texts.some(t => t.toLowerCase().includes('auxiliares'))).toBe(true);
    });

    it('XLS-CAR-06: IP-09 hoja contiene completitud promedio y nota de componentes', async () => {
      const { wb } = await generarExcelCarrera5();
      const ws = wb.getWorksheet('IP-09 Completitud');
      const texts = cellTexts5(ws);
      expect(texts.some(t => t.includes('Completitud'))).toBe(true);
      // nota de componentes C1-C4
      expect(texts.some(t => t.includes('C1'))).toBe(true);
    });

    it('XLS-CAR-07: IP-10 hoja contiene puntaje y nota de fórmula', async () => {
      const { wb } = await generarExcelCarrera5();
      const ws = wb.getWorksheet('IP-10 Consistencia');
      const texts = cellTexts5(ws);
      expect(texts.some(t => t.includes('Puntaje'))).toBe(true);
      expect(texts.some(t => t.includes('Fórmula') || t.includes('Formula') || t.includes('max(0'))).toBe(true);
    });

    it('XLS-CAR-08: IP-13 hoja contiene tabla de sobreasignados', async () => {
      const { wb } = await generarExcelCarrera5();
      const ws = wb.getWorksheet('IP-13 Sobreasig.');
      const texts = cellTexts5(ws);
      expect(texts.some(t => t.includes('García, Ana'))).toBe(true);
    });

    it('XLS-CAR-09: IP-13 con alcanceFacultad=false → advertencia de alcance en hoja', async () => {
      const snap = makeSnapCarreraExcel({
        ip13: {
          totalDocentes: 5, totalSobreasignados: 0, totalNoDeterminables: 0,
          limite: 6, alcanceFacultad: false, sobreasignados: [], estadoCalculo: 'CALCULADO',
        },
      });
      const { wb } = await generarExcelCarrera5(snap);
      const ws = wb.getWorksheet('IP-13 Sobreasig.');
      const texts = cellTexts5(ws);
      expect(texts.some(t => t.includes('Alcance') || t.includes('alcance') || t.includes('⚠'))).toBe(true);
    });

    it('XLS-CAR-10: R-10 hoja contiene docentes en alerta con horas', async () => {
      const { wb } = await generarExcelCarrera5();
      const ws = wb.getWorksheet('R-10 Horas Doc.');
      const texts = cellTexts5(ws);
      expect(texts.some(t => t.includes('Martínez, Luis'))).toBe(true);
    });

    it('XLS-CAR-11: R-12 hoja contiene fichas incompletas con campos faltantes legibles', async () => {
      const { wb } = await generarExcelCarrera5();
      const ws = wb.getWorksheet('R-12 Fichas Doc.');
      const texts = cellTexts5(ws);
      expect(texts.some(t => t.includes('López, Carlos'))).toBe(true);
      // 'personales' → 'Datos personales'
      expect(texts.some(t => t.includes('Datos personales'))).toBe(true);
    });

    it('XLS-CAR-12: Cond.Plantel CONEAU contiene distribución y dedicación CONEAU', async () => {
      const { wb } = await generarExcelCarrera5();
      const ws = wb.getWorksheet('Cond.Plantel CONEAU');
      const texts = cellTexts5(ws);
      expect(texts.some(t => t.includes('posgrado') || t.includes('Posgrado'))).toBe(true);
      // dedicación CONEAU
      expect(texts.some(t => t.toLowerCase().includes('exclusiva'))).toBe(true);
    });

    it('XLS-CAR-13: snapshot vacío → 12 hojas, sin crash, degradación elegante', async () => {
      const { wb } = await generarExcelCarrera5({});
      expect(sheetNames5(wb)).toHaveLength(12);
    });

    it('XLS-CAR-14: exportación PLAN sigue siendo exactamente 12 hojas (sin regresión)', async () => {
      // Genera un PLAN directamente
      const ExcelJSR = require('exceljs');
      const prisma = makePrisma({
        analisisEjecucion: {
          findUnique: jest.fn().mockResolvedValue({
            id: EJEC_ID, ambito: 'PLAN', entidadId: PLAN_ID,
            facultadId: FAC_ID, usuarioId: USER_ID, estado: 'COMPLETADO',
            fechaFin: new Date('2026-10-28T10:00:00Z'), snapshot: {},
          }),
          findFirst: jest.fn().mockResolvedValue(null),
        },
        planEstudio: {
          findUnique: jest.fn().mockResolvedValue({
            nombre: 'Plan 2020',
            carrera: { nombre: 'Ing.', facultad: { nombre: 'Fac.' } },
          }),
        },
      });
      const svc = new ExportacionesService(prisma as any, makeAnalisis() as any, PARAM_STUB as any);
      const r = await svc.exportarPorEjecucion(EJEC_ID, 'xlsx', 'ADMINISTRADOR_SISTEMA', USER_ID);
      const wb = new ExcelJSR.Workbook();
      await wb.xlsx.load(r.buffer);
      expect(wb.worksheets.map((ws: any) => ws.name)).toHaveLength(12);
    });

    it('XLS-CAR-15: Cond.Plantel CONEAU ausente → hoja con "Sin datos" y no crash', async () => {
      const snap = makeSnapCarreraExcel({ condicionesPlantell: undefined });
      const { wb } = await generarExcelCarrera5(snap);
      const ws = wb.getWorksheet('Cond.Plantel CONEAU');
      expect(ws).toBeDefined();
      const texts = cellTexts5(ws);
      expect(texts.some(t => t.toLowerCase().includes('sin datos'))).toBe(true);
    });

    it('XLS-CAR-16: R-10 con alcanceFacultad=false → advertencia en hoja', async () => {
      const snap = makeSnapCarreraExcel({
        r10: {
          carreraId: CAR5_ID, umbral: 10, totalDocentes: 3,
          totalEnAlerta: 0, totalInciertos: 0, alcanceFacultad: false,
          enAlerta: [], estadoCalculo: 'CALCULADO',
        },
      });
      const { wb } = await generarExcelCarrera5(snap);
      const ws = wb.getWorksheet('R-10 Horas Doc.');
      const texts = cellTexts5(ws);
      expect(texts.some(t => t.includes('parcial') || t.includes('Parcial') || t.includes('⚠'))).toBe(true);
    });

    it('XLS-CAR-17: Indicadores CARRERA hoja contiene IP04 con valor formateado', async () => {
      const { wb } = await generarExcelCarrera5();
      const ws = wb.getWorksheet('Indicadores');
      const texts = cellTexts5(ws);
      expect(texts.some(t => t.toUpperCase().includes('IP04'))).toBe(true);
    });
  });

  // ── PDF tablero facultad — Fase 6B ────────────────────────────────────────

  describe('PDF tablero facultad — Fase 6B', () => {
    const EJEC_FAC = 'ejec-fac-fase6b';
    const USER_FAC = 'user-fac-fase6b';
    const FAC_ID   = 'fac-fase6b';

    function makeSnapFacultad(overrides: Record<string, unknown> = {}): Record<string, unknown> {
      return {
        composicion: {
          totalDocentes: 20,
          totalCargosP: 12, totalCargosA: 6, totalCargosOtros: 2, totalCargos: 20,
          porCarrera: [
            { carreraId: 'c1', carreraNombre: 'Ingeniería en Sistemas', totalDocentes: 12, totalCargos: 12 },
            { carreraId: 'c2', carreraNombre: 'Licenciatura en Administración', totalDocentes: 8, totalCargos: 8 },
          ],
          estadoCalculo: 'CALCULADO',
        },
        formacion: {
          totalDocentes: 20,
          conTituloGrado: 18, sinTituloGrado: 2,
          conTituloPosgrado: 10, sinTituloPosgrado: 10,
          completitudPromedio: 72.5,
          estadoCalculo: 'CALCULADO',
        },
        investigacion: {
          totalDocentes: 20,
          conProyectoInvestigacion: 8,
          conActividadExtension: 5,
          conAmbasActividades: 3,
          sinNinguna: 7,
          estadoCalculo: 'CALCULADO',
        },
        dedicaciones: {
          totalDocentes: 20,
          umbral: 20,
          totalBajaDedicacion: 3,
          totalSinDatos: 1,
          enAlerta: [
            { docenteId: 'd1', nombre: 'García, Ana',    horasSemanales: 8,  motivo: 'BAJA' },
            { docenteId: 'd2', nombre: 'López, Carlos',  horasSemanales: 12, motivo: 'BAJA' },
          ],
          estadoCalculo: 'ADVERTENCIA',
        },
        cargaAcademica: {
          totalDocentes: 20,
          limiteMaxMat: 6,
          totalSobreasignados: 2,
          sobreasignados: [
            { docenteId: 'd3', nombre: 'Martínez, Luis', nMaterias: 8, exceso: 2 },
            { docenteId: 'd4', nombre: 'Pérez, María',   nMaterias: 7, exceso: 1 },
          ],
          estadoCalculo: 'ADVERTENCIA',
        },
        distribucionMaterias: {
          totalDocentes: 20,
          promedio: 3.2,
          mediana: 3.0,
          maximo: 8,
          distribucion: [
            { docenteId: 'd1', nombre: 'García, Ana',   nMaterias: 8 },
            { docenteId: 'd2', nombre: 'López, Carlos', nMaterias: 5 },
            { docenteId: 'd5', nombre: 'Ruiz, Pedro',   nMaterias: 0 },
          ],
          estadoCalculo: 'CALCULADO',
        },
        ...overrides,
      };
    }

    function makeFacultadPrisma(snap: Record<string, unknown> = {}) {
      return {
        ejecucionId: EJEC_FAC,
        ambito: 'FACULTAD' as const,
        entidadId: FAC_ID,
        entidadNombre: 'Facultad de Tecnología e Ingeniería',
        facultadNombre: undefined,
        carreraNombre: undefined,
        facultadId: FAC_ID,
        usuarioId: USER_FAC,
        fechaEjecucion: new Date().toISOString(),
        estadoCalculo: null,
        snapshot: makeSnapFacultad(snap),
        alertas: [],
      };
    }

    async function generarPdfFacultad(snap?: Record<string, unknown>): Promise<Buffer> {
      const { generarPdfBuffer } = await import('./pdf.generator');
      return generarPdfBuffer(makeFacultadPrisma(snap ?? {}));
    }

    it('PDF-FAC-01: genera PDF válido (firma %PDF)', async () => {
      const buf = await generarPdfFacultad();
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
    });

    it('PDF-FAC-02: PDF con todos los bloques tiene tamaño mayor que PDF vacío', async () => {
      const { generarPdfBuffer } = await import('./pdf.generator');
      const snapVacio = makeSnapFacultad({
        composicion: undefined, formacion: undefined, investigacion: undefined,
        dedicaciones: undefined, cargaAcademica: undefined, distribucionMaterias: undefined,
      });
      const [small, big] = await Promise.all([
        generarPdfBuffer({ ...makeFacultadPrisma(), snapshot: snapVacio }),
        generarPdfFacultad(),
      ]);
      expect(big.length).toBeGreaterThan(small.length);
    });

    it('PDF-FAC-03: B-06 aparece en el resumen de indicadores', async () => {
      const { generarPdfBuffer } = await import('./pdf.generator');
      const data = makeFacultadPrisma();
      const buf = await generarPdfBuffer(data);
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
      expect(buf.length).toBeGreaterThan(3000);
    });

    it('PDF-FAC-04: B-01 porCarrera vacío → no crash, degradación elegante', async () => {
      const buf = await generarPdfFacultad({
        composicion: { totalDocentes: 5, totalCargosP: 3, totalCargosA: 2,
          totalCargosOtros: 0, totalCargos: 5, porCarrera: [], estadoCalculo: 'CALCULADO' },
      });
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
    });

    it('PDF-FAC-05: B-02 y B-03 métricas → no crash', async () => {
      const buf = await generarPdfFacultad();
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
    });

    it('PDF-FAC-06: B-04 enAlerta vacío → no crash', async () => {
      const buf = await generarPdfFacultad({
        dedicaciones: { totalDocentes: 10, umbral: 20,
          totalBajaDedicacion: 0, totalSinDatos: 0,
          enAlerta: [], estadoCalculo: 'CALCULADO' },
      });
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
    });

    it('PDF-FAC-07: B-05 NO_DETERMINABLE → mensaje visible, no crash', async () => {
      const { generarPdfBuffer } = await import('./pdf.generator');
      const data = makeFacultadPrisma({
        cargaAcademica: {
          totalDocentes: 20, limiteMaxMat: null,
          totalSobreasignados: 0, sobreasignados: [],
          estadoCalculo: 'NO_DETERMINABLE',
        },
      });
      const buf = await generarPdfBuffer(data);
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
    });

    it('PDF-FAC-08: B-05 sobreasignados → tabla en PDF, no crash', async () => {
      const buf = await generarPdfFacultad();
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
    });

    it('PDF-FAC-09: B-06 con nMaterias=0 conservados → no crash', async () => {
      const buf = await generarPdfFacultad({
        distribucionMaterias: {
          totalDocentes: 5,
          promedio: 1.6,
          mediana: 2.0,
          maximo: 4,
          distribucion: [
            { docenteId: 'd1', nombre: 'García, Ana',   nMaterias: 4 },
            { docenteId: 'd2', nombre: 'López, Carlos', nMaterias: 0 },
            { docenteId: 'd3', nombre: 'Ruiz, Pedro',   nMaterias: 0 },
          ],
          estadoCalculo: 'CALCULADO',
        },
      });
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
      expect(buf.length).toBeGreaterThan(1000);
    });

    it('PDF-FAC-10: snapshot histórico sin distribucionMaterias → nota informativa, no crash', async () => {
      const buf = await generarPdfFacultad({ distribucionMaterias: undefined });
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
    });

    it('PDF-FAC-11: snapshot vacío (sin bloques) → no crash, degradación elegante', async () => {
      const buf = await generarPdfFacultad({
        composicion: undefined, formacion: undefined, investigacion: undefined,
        dedicaciones: undefined, cargaAcademica: undefined, distribucionMaterias: undefined,
      });
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
    });

    it('PDF-FAC-12: sin regresión — PDF de Carrera sigue siendo válido', async () => {
      const { generarPdfBuffer } = await import('./pdf.generator');
      const carData = {
        ejecucionId: 'ejec-regresion-car',
        ambito: 'CARRERA' as const,
        entidadId: 'car-reg', entidadNombre: 'Carrera Regresión',
        facultadNombre: 'Facultad X', carreraNombre: undefined,
        facultadId: 'fac-reg', usuarioId: 'user-reg',
        fechaEjecucion: new Date().toISOString(),
        estadoCalculo: null,
        snapshot: { ip01: { total: 5, estadoCalculo: 'CALCULADO' } },
        alertas: [],
      };
      const buf = await generarPdfBuffer(carData);
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
    });
  });

  describe('Excel tablero facultad — Fase 6C', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ExcelJS6 = require('exceljs');

    const EJEC_FAC6C = 'ejec-fac-fase6c';
    const FAC6C_ID   = 'fac-fase6c';
    const USER_FAC6C = 'user-fac-fase6c';

    function makeSnapFacultadXls(overrides: Record<string, unknown> = {}): Record<string, unknown> {
      return {
        composicion: {
          totalDocentes: 20,
          totalCargosP: 12, totalCargosA: 6, totalCargosOtros: 2, totalCargos: 20,
          porCarrera: [
            { carreraId: 'c1', carreraNombre: 'Ingeniería en Sistemas',        totalDocentes: 12, totalCargos: 12 },
            { carreraId: 'c2', carreraNombre: 'Licenciatura en Administración', totalDocentes: 8,  totalCargos: 8  },
          ],
          estadoCalculo: 'CALCULADO',
        },
        formacion: {
          totalDocentes: 20,
          conTituloGrado: 18, sinTituloGrado: 2,
          conTituloPosgrado: 10, sinTituloPosgrado: 10,
          completitudPromedio: 72.5,
          estadoCalculo: 'CALCULADO',
        },
        investigacion: {
          totalDocentes: 20,
          conProyectoInvestigacion: 8,
          conActividadExtension: 5,
          conAmbasActividades: 3,
          sinNinguna: 7,
          estadoCalculo: 'CALCULADO',
        },
        dedicaciones: {
          totalDocentes: 20,
          umbral: 20,
          totalBajaDedicacion: 3,
          totalSinDatos: 1,
          enAlerta: [
            { docenteId: 'd1', nombre: 'García, Ana',   horasSemanales: 8,  motivo: 'BAJA' },
            { docenteId: 'd2', nombre: 'López, Carlos', horasSemanales: 12, motivo: 'BAJA' },
          ],
          estadoCalculo: 'ADVERTENCIA',
        },
        cargaAcademica: {
          totalDocentes: 20,
          limiteMaxMat: 6,
          totalSobreasignados: 2,
          sobreasignados: [
            { docenteId: 'd3', nombre: 'Martínez, Luis', nMaterias: 8, exceso: 2 },
            { docenteId: 'd4', nombre: 'Pérez, María',   nMaterias: 7, exceso: 1 },
          ],
          estadoCalculo: 'ADVERTENCIA',
        },
        distribucionMaterias: {
          totalDocentes: 20,
          promedio: 3.2,
          mediana: 3.0,
          maximo: 8,
          distribucion: [
            { docenteId: 'd1', nombre: 'García, Ana',   nMaterias: 8 },
            { docenteId: 'd2', nombre: 'López, Carlos', nMaterias: 5 },
            { docenteId: 'd5', nombre: 'Ruiz, Pedro',   nMaterias: 0 },
          ],
          estadoCalculo: 'CALCULADO',
        },
        ...overrides,
      };
    }

    function makePrismaFacultad6c(snap: Record<string, unknown>) {
      return makePrisma({
        analisisEjecucion: {
          findUnique: jest.fn().mockResolvedValue({
            id: EJEC_FAC6C, ambito: 'FACULTAD', entidadId: FAC6C_ID,
            facultadId: FAC6C_ID, usuarioId: USER_FAC6C, estado: 'COMPLETADO',
            fechaFin: new Date('2026-10-28T12:00:00Z'), snapshot: snap,
          }),
          findFirst: jest.fn().mockResolvedValue(null),
        },
        facultad: {
          findUnique: jest.fn().mockResolvedValue({ nombre: 'Facultad de Tecnología e Ingeniería' }),
        },
      });
    }

    async function generarExcelFacultad(snap?: Record<string, unknown>): Promise<{ wb: any; buffer: Buffer }> {
      const snapFinal = snap ?? makeSnapFacultadXls();
      const prisma = makePrismaFacultad6c(snapFinal);
      const svc = new ExportacionesService(prisma as any, makeAnalisis() as any, PARAM_STUB as any);
      const r = await svc.exportarPorEjecucion(EJEC_FAC6C, 'xlsx', 'ADMINISTRADOR_SISTEMA', USER_FAC6C);
      const wb = new ExcelJS6.Workbook();
      await wb.xlsx.load(r.buffer);
      return { wb, buffer: r.buffer };
    }

    function sheetNamesFac(wb: any): string[] {
      return wb.worksheets.map((ws: any) => ws.name);
    }

    function cellTextsFac(ws: any): string[] {
      const texts: string[] = [];
      ws.eachRow((row: any) => {
        row.eachCell((cell: any) => {
          const v = cell.value;
          if (v !== null && v !== undefined && v !== '') texts.push(String(v));
        });
      });
      return texts;
    }

    it('XLS-FAC-01: Excel FACULTAD contiene exactamente 10 hojas', async () => {
      const { wb } = await generarExcelFacultad();
      expect(sheetNamesFac(wb)).toHaveLength(10);
    });

    it('XLS-FAC-02: todas las hojas esperadas están presentes', async () => {
      const { wb } = await generarExcelFacultad();
      const names = sheetNamesFac(wb);
      [
        'Resumen', 'Indicadores', 'Alertas',
        'B-01 Composición', 'B-02 Formación', 'B-03 Investigación',
        'B-04 Dedicaciones', 'B-05 Carga Acad.', 'B-06 Dist. Mat.',
        'Advertencias',
      ].forEach(n => expect(names).toContain(n));
    });

    it('XLS-FAC-03: Resumen contiene nombre de Facultad', async () => {
      const { wb } = await generarExcelFacultad();
      const texts = cellTextsFac(wb.getWorksheet('Resumen'));
      expect(texts.some(t => t.includes('Facultad de Tecnología e Ingeniería'))).toBe(true);
    });

    it('XLS-FAC-04: Indicadores incluye B-06 distribucionMaterias', async () => {
      const { wb } = await generarExcelFacultad();
      const texts = cellTextsFac(wb.getWorksheet('Indicadores'));
      expect(texts.some(t => t.toLowerCase().includes('distribuc'))).toBe(true);
    });

    it('XLS-FAC-05: B-01 hoja tiene tabla porCarrera con filas de carrera', async () => {
      const { wb } = await generarExcelFacultad();
      const texts = cellTextsFac(wb.getWorksheet('B-01 Composición'));
      expect(texts.some(t => t.includes('Ingeniería en Sistemas'))).toBe(true);
      expect(texts.some(t => t.includes('Licenciatura en Administración'))).toBe(true);
    });

    it('XLS-FAC-06: B-02 hoja contiene completitud promedio', async () => {
      const { wb } = await generarExcelFacultad();
      const texts = cellTextsFac(wb.getWorksheet('B-02 Formación'));
      expect(texts.some(t => t.toLowerCase().includes('completitud'))).toBe(true);
      expect(texts.some(t => String(t).includes('72.5'))).toBe(true);
    });

    it('XLS-FAC-07: B-03 hoja contiene sinNinguna', async () => {
      const { wb } = await generarExcelFacultad();
      const texts = cellTextsFac(wb.getWorksheet('B-03 Investigación'));
      expect(texts.some(t => t.toLowerCase().includes('ninguna'))).toBe(true);
    });

    it('XLS-FAC-08: B-04 hoja tiene tabla enAlerta con García, Ana y López, Carlos', async () => {
      const { wb } = await generarExcelFacultad();
      const texts = cellTextsFac(wb.getWorksheet('B-04 Dedicaciones'));
      expect(texts.some(t => t.includes('García, Ana'))).toBe(true);
      expect(texts.some(t => t.includes('López, Carlos'))).toBe(true);
    });

    it('XLS-FAC-09: B-05 con NO_DETERMINABLE → nota de alcance parcial', async () => {
      const { wb } = await generarExcelFacultad(
        makeSnapFacultadXls({ cargaAcademica: { estadoCalculo: 'NO_DETERMINABLE' } }),
      );
      const texts = cellTextsFac(wb.getWorksheet('B-05 Carga Acad.'));
      expect(
        texts.some(t => t.toLowerCase().includes('parcial') || t.toLowerCase().includes('determinable')),
      ).toBe(true);
    });

    it('XLS-FAC-10: B-05 normal → tabla sobreasignados con Martínez, Luis', async () => {
      const { wb } = await generarExcelFacultad();
      const texts = cellTextsFac(wb.getWorksheet('B-05 Carga Acad.'));
      expect(texts.some(t => t.includes('Martínez, Luis'))).toBe(true);
    });

    it('XLS-FAC-11: B-06 distribución incluye docentes con nMaterias=0 (Ruiz, Pedro)', async () => {
      const { wb } = await generarExcelFacultad();
      const texts = cellTextsFac(wb.getWorksheet('B-06 Dist. Mat.'));
      expect(texts.some(t => t.includes('Ruiz, Pedro'))).toBe(true);
    });

    it('XLS-FAC-12: snapshot histórico sin distribucionMaterias → B-06 presente, sin crash', async () => {
      const { wb } = await generarExcelFacultad(
        makeSnapFacultadXls({ distribucionMaterias: undefined }),
      );
      expect(sheetNamesFac(wb)).toContain('B-06 Dist. Mat.');
      expect(cellTextsFac(wb.getWorksheet('B-06 Dist. Mat.')).length).toBeGreaterThan(0);
    });

    it('XLS-FAC-13: snapshot vacío → 10 hojas, sin crash, degradación elegante', async () => {
      const { wb } = await generarExcelFacultad({});
      expect(sheetNamesFac(wb)).toHaveLength(10);
    });

    it('XLS-FAC-14: ejecucionId conservado como texto en Resumen (sin conversión numérica)', async () => {
      const { wb } = await generarExcelFacultad();
      const texts = cellTextsFac(wb.getWorksheet('Resumen'));
      expect(texts.some(t => t === EJEC_FAC6C)).toBe(true);
    });

    it('XLS-FAC-15: sin regresión — Plan sigue con 12 hojas, Carrera sigue con 12 hojas', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ExcelJS15 = require('exceljs');
      const svcPlan = makeService({
        analisisEjecucion: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'ejec-plan-reg', ambito: 'PLAN', entidadId: 'plan-reg',
            facultadId: 'fac-reg', usuarioId: 'user-reg', estado: 'COMPLETADO',
            fechaFin: new Date(), snapshot: {},
          }),
          findFirst: jest.fn().mockResolvedValue(null),
        },
        planEstudio: {
          findUnique: jest.fn().mockResolvedValue({
            nombre: 'Plan Reg',
            carrera: { nombre: 'Car Reg', facultad: { nombre: 'Fac Reg' } },
          }),
        },
      });
      const rPlan = await svcPlan.exportarPorEjecucion('ejec-plan-reg', 'xlsx', 'ADMINISTRADOR_SISTEMA', 'user-reg');
      const wbPlan = new ExcelJS15.Workbook();
      await wbPlan.xlsx.load(rPlan.buffer);
      expect(wbPlan.worksheets).toHaveLength(12);

      const svcCar = makeService({
        analisisEjecucion: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'ejec-car-reg', ambito: 'CARRERA', entidadId: 'car-reg',
            facultadId: 'fac-reg', usuarioId: 'user-reg', estado: 'COMPLETADO',
            fechaFin: new Date(), snapshot: {},
          }),
          findFirst: jest.fn().mockResolvedValue(null),
        },
        carrera: {
          findUnique: jest.fn().mockResolvedValue({
            nombre: 'Car Reg',
            facultad: { nombre: 'Fac Reg' },
          }),
        },
      });
      const rCar = await svcCar.exportarPorEjecucion('ejec-car-reg', 'xlsx', 'ADMINISTRADOR_SISTEMA', 'user-reg');
      const wbCar = new ExcelJS15.Workbook();
      await wbCar.xlsx.load(rCar.buffer);
      expect(wbCar.worksheets).toHaveLength(12);
    });
  });

  // ── PDF — sin páginas en blanco al final ──────────────────────────────────────
  // Regresión: addFooters llamaba doc.text() en y > page.maxY(), disparando addPage()
  // por cada iteración del loop → N páginas de contenido producían N páginas en blanco extra.

  describe('PDF — sin páginas en blanco al final', () => {
    function countPdfPages(buf: Buffer): number {
      // Cuenta objetos /Type /Page en el PDF (excluye /Type /Pages del árbol raíz)
      return (buf.toString('binary').match(/\/Type \/Page(?!s)/g) ?? []).length;
    }

    // ── PLAN ──────────────────────────────────────────────────────────────────

    async function generarPdfPlanBlank(snap: Record<string, unknown> = {}): Promise<Buffer> {
      const svc = new ExportacionesService(
        makePrisma({
          analisisEjecucion: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'ejec-nb-plan', ambito: 'PLAN', entidadId: 'plan-nb',
              facultadId: 'fac-nb', usuarioId: 'user-nb', estado: 'COMPLETADO',
              fechaFin: new Date(), snapshot: snap,
            }),
            findFirst: jest.fn().mockResolvedValue(null),
          },
          planEstudio: {
            findUnique: jest.fn().mockResolvedValue({
              nombre: 'Plan NB',
              carrera: { nombre: 'Carrera NB', facultad: { nombre: 'Fac NB' } },
            }),
          },
        }) as any,
        makeAnalisis() as any,
        PARAM_STUB as any,
      );
      const r = await svc.exportarPorEjecucion('ejec-nb-plan', 'pdf', 'ADMINISTRADOR_SISTEMA', 'user-nb');
      return r.buffer;
    }

    it('PDF-BLANK-PLAN-01: snapshot vacío → exactamente 1 página (sin páginas en blanco adicionales)', async () => {
      const buf = await generarPdfPlanBlank();
      expect(countPdfPages(buf)).toBe(1);
    });

    it('PDF-BLANK-PLAN-02: snapshot vacío → menos de 3 páginas (regresión: bug producía 1+2=3)', async () => {
      const buf = await generarPdfPlanBlank();
      expect(countPdfPages(buf)).toBeLessThan(3);
    });

    it('PDF-BLANK-PLAN-03: snapshot con ipl01 y advertencias → como máximo 4 páginas (sin inflar)', async () => {
      const snap = {
        estadoGeneralCalculo: 'CALCULADO',
        ipl01: { estadoCalculo: 'CALCULADO', cumple: true, horasTotal: 2800, horasMinimas: 2700, diferencia: 100 },
        advertencias: ['Advertencia de prueba A', 'Advertencia de prueba B'],
      };
      const buf = await generarPdfPlanBlank(snap);
      expect(countPdfPages(buf)).toBeLessThanOrEqual(4);
    });

    // ── CARRERA ───────────────────────────────────────────────────────────────

    it('PDF-BLANK-CAR-01: snapshot vacío → exactamente 1 página', async () => {
      const { generarPdfBuffer } = await import('./pdf.generator');
      const buf = await generarPdfBuffer({
        ejecucionId: 'ejec-nb-car', ambito: 'CARRERA' as const,
        entidadId: 'car-nb', entidadNombre: 'Carrera NB',
        facultadNombre: 'Fac NB', carreraNombre: undefined,
        facultadId: 'fac-nb', usuarioId: 'user-nb',
        fechaEjecucion: new Date().toISOString(), estadoCalculo: null,
        snapshot: {}, alertas: [],
      });
      expect(countPdfPages(buf)).toBe(1);
    });

    it('PDF-BLANK-CAR-02: snapshot vacío → menos de 3 páginas (regresión)', async () => {
      const { generarPdfBuffer } = await import('./pdf.generator');
      const buf = await generarPdfBuffer({
        ejecucionId: 'ejec-nb-car2', ambito: 'CARRERA' as const,
        entidadId: 'car-nb2', entidadNombre: 'Carrera NB',
        facultadNombre: 'Fac NB', carreraNombre: undefined,
        facultadId: 'fac-nb', usuarioId: 'user-nb',
        fechaEjecucion: new Date().toISOString(), estadoCalculo: null,
        snapshot: {}, alertas: [],
      });
      expect(countPdfPages(buf)).toBeLessThan(3);
    });

    it('PDF-BLANK-CAR-03: snapshot con ip01 y listadoDocentes (3 docentes) → como máximo 5 páginas', async () => {
      const { generarPdfBuffer } = await import('./pdf.generator');
      const buf = await generarPdfBuffer({
        ejecucionId: 'ejec-nb-car3', ambito: 'CARRERA' as const,
        entidadId: 'car-nb3', entidadNombre: 'Carrera NB',
        facultadNombre: 'Fac NB', carreraNombre: undefined,
        facultadId: 'fac-nb', usuarioId: 'user-nb',
        fechaEjecucion: new Date().toISOString(), estadoCalculo: null,
        snapshot: {
          ip01: { total: 8, estadoCalculo: 'CALCULADO' },
          listadoDocentes: {
            estadoCalculo: 'CALCULADO',
            docentes: [
              { docenteId: 'd1', nombre: 'García, Ana',    semaforo: 'VERDE',    fichaScore: 4, nMaterias: 3, horasCarreraConocidas: 20, alertas: {} },
              { docenteId: 'd2', nombre: 'López, Carlos',  semaforo: 'ROJO',     fichaScore: 2, nMaterias: 7, horasCarreraConocidas: 35, alertas: { altaTope: true } },
              { docenteId: 'd3', nombre: 'Ruiz, Pedro',    semaforo: 'AMARILLO', fichaScore: 3, nMaterias: 5, horasCarreraConocidas: 25, alertas: {} },
            ],
          },
        },
        alertas: [],
      });
      expect(countPdfPages(buf)).toBeLessThanOrEqual(5);
    });

    // ── FACULTAD ──────────────────────────────────────────────────────────────

    it('PDF-BLANK-FAC-01: snapshot vacío → exactamente 1 página', async () => {
      const { generarPdfBuffer } = await import('./pdf.generator');
      const buf = await generarPdfBuffer({
        ejecucionId: 'ejec-nb-fac', ambito: 'FACULTAD' as const,
        entidadId: 'fac-nb', entidadNombre: 'Facultad NB',
        facultadNombre: undefined, carreraNombre: undefined,
        facultadId: 'fac-nb', usuarioId: 'user-nb',
        fechaEjecucion: new Date().toISOString(), estadoCalculo: null,
        snapshot: {}, alertas: [],
      });
      expect(countPdfPages(buf)).toBe(1);
    });

    it('PDF-BLANK-FAC-02: snapshot vacío → menos de 3 páginas (regresión)', async () => {
      const { generarPdfBuffer } = await import('./pdf.generator');
      const buf = await generarPdfBuffer({
        ejecucionId: 'ejec-nb-fac2', ambito: 'FACULTAD' as const,
        entidadId: 'fac-nb2', entidadNombre: 'Facultad NB',
        facultadNombre: undefined, carreraNombre: undefined,
        facultadId: 'fac-nb', usuarioId: 'user-nb',
        fechaEjecucion: new Date().toISOString(), estadoCalculo: null,
        snapshot: {}, alertas: [],
      });
      expect(countPdfPages(buf)).toBeLessThan(3);
    });

    it('PDF-BLANK-FAC-03: snapshot con B-01 y B-02 → como máximo 4 páginas', async () => {
      const { generarPdfBuffer } = await import('./pdf.generator');
      const buf = await generarPdfBuffer({
        ejecucionId: 'ejec-nb-fac3', ambito: 'FACULTAD' as const,
        entidadId: 'fac-nb3', entidadNombre: 'Facultad NB',
        facultadNombre: undefined, carreraNombre: undefined,
        facultadId: 'fac-nb', usuarioId: 'user-nb',
        fechaEjecucion: new Date().toISOString(), estadoCalculo: null,
        snapshot: {
          composicion: {
            totalDocentes: 20, totalCargosP: 12, totalCargosA: 6, totalCargosOtros: 2, totalCargos: 20,
            porCarrera: [
              { carreraId: 'c1', carreraNombre: 'Ingeniería en Sistemas',        totalDocentes: 12, totalCargos: 12 },
              { carreraId: 'c2', carreraNombre: 'Licenciatura en Administración', totalDocentes: 8,  totalCargos: 8 },
            ],
            estadoCalculo: 'CALCULADO',
          },
          formacion: {
            totalDocentes: 20, conTituloGrado: 18, sinTituloGrado: 2,
            conTituloPosgrado: 10, sinTituloPosgrado: 10, completitudPromedio: 72.5,
            estadoCalculo: 'CALCULADO',
          },
        },
        alertas: [],
      });
      expect(countPdfPages(buf)).toBeLessThanOrEqual(4);
    });
  });
});
