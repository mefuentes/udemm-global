import { ForbiddenException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ExportacionesService } from './exportaciones.service';

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

function makeService(prismaOverrides = {}, analisisOverrides = {}) {
  return new ExportacionesService(
    makePrisma(prismaOverrides) as any,
    makeAnalisis(analisisOverrides) as any,
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
      const svc = new ExportacionesService(prisma as any, analisis as any);
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
      const svc = new ExportacionesService(prisma as any, analisis as any);
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
      const svc = new ExportacionesService(prisma as any, analisis as any);
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
      const svc = new ExportacionesService(prisma as any, makeAnalisis() as any);
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
      const svc = new ExportacionesService(prisma as any, analisis as any);
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
      const svc = new ExportacionesService(prisma as any, makeAnalisis() as any);
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

    it('Excel tiene exactamente 3 hojas: Resumen, Indicadores, Alertas', async () => {
      const svc = makeService();
      const r = await svc.exportarPorEjecucion(EJEC_ID, 'xlsx', 'ADMINISTRADOR_SISTEMA', USER_ID);
      const wb = await leerExcel(r.buffer);
      expect(wb.worksheets.map((ws: any) => ws.name)).toEqual(['Resumen', 'Indicadores', 'Alertas']);
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
      const svc = new ExportacionesService(prisma as any, makeAnalisis() as any);
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
      const svc = new ExportacionesService(prisma as any, makeAnalisis() as any);
      const r = await svc.exportarPorEjecucion(EJEC_ID, 'xlsx', 'DECANO', USER_ID);
      const wb = await leerExcel(r.buffer);
      const ws = wb.getWorksheet('Indicadores');
      expect(hayTextoEnHoja(ws, 'COMPOSICION')).toBe(true);
    });
  });

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
});
