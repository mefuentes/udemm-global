import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TablroPlanService } from './tablero-plan.service';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type { ResultadoIndicador } from '../indicadores/indicadores.types';
import type { AlertaR02, ResultadoR02 } from '../indicadores/r02.evaluador';
import type { AlertaMateria, ResultadoR08 } from '../indicadores/r08.evaluador';
import type { ResultadoR09 } from '../indicadores/r09.evaluador';

// ── Constantes ────────────────────────────────────────────────────────────────

const PLAN_ID = 'plan-00000000-0000-4000-8000-000000000001';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeR02Result(
  estadoCalculo: EstadoCalculo = EstadoCalculo.CALCULADO,
  options: { alertas?: number; inciertos?: number; totalMaterias?: number } = {},
): ResultadoIndicador<ResultadoR02> {
  const { alertas = 0, inciertos = 0, totalMaterias = 5 } = options;
  const paresConAlerta: AlertaR02[] = Array.from({ length: alertas }, (_, i) => ({
    materiaId: `mat-${i + 1}`,
    materiaNombre: `Materia ${i + 1}`,
    materiaCodigo: `M0${i + 1}`,
    catedraId: `cat-${i + 1}`,
    cantidadResponsables: 2,
  }));
  const paresInciertos = Array.from({ length: inciertos }, (_, i) => ({
    materiaId: `mat-inc-${i + 1}`,
    materiaNombre: `Materia Inc ${i + 1}`,
    materiaCodigo: `MI0${i + 1}`,
    catedraId: `cat-inc-${i + 1}`,
    confirmedTrue: 1,
    sinClasificar: 1,
  }));
  return {
    codigo: 'R-02',
    contextoId: PLAN_ID,
    tipoContexto: 'PLAN',
    estadoImplementacion: 'IMPLEMENTADO',
    estadoCalculo,
    valor: { paresConAlerta, paresInciertos, totalMaterias },
    datosFaltantes: [],
    fechaEvaluacion: new Date(),
  };
}

function makeAlertaMateria(i: number, prefix: string): AlertaMateria {
  return {
    materiaId: `mat-${prefix}-${i + 1}`,
    nombre: `Materia ${prefix} ${i + 1}`,
    codigo: `${prefix.toUpperCase()}0${i + 1}`,
    tieneVinculacionesAprobadas: false,
  };
}

function makeR08Result(
  estadoCalculo: EstadoCalculo = EstadoCalculo.CALCULADO,
  options: { sinResponsable?: number; inciertas?: number; conResponsable?: number; total?: number } = {},
): ResultadoIndicador<ResultadoR08> {
  const { sinResponsable = 0, inciertas = 0, conResponsable = 4, total = 5 } = options;
  return {
    codigo: 'R-08',
    contextoId: PLAN_ID,
    tipoContexto: 'PLAN',
    estadoImplementacion: 'IMPLEMENTADO',
    estadoCalculo,
    valor: {
      materiasConAlerta: Array.from({ length: sinResponsable }, (_, i) => makeAlertaMateria(i, 'sr')),
      materiasInciertas: Array.from({ length: inciertas }, (_, i) => makeAlertaMateria(i, 'inc')),
      totalConResponsable: conResponsable,
      totalMaterias: total,
    },
    datosFaltantes: [],
    fechaEvaluacion: new Date(),
  };
}

function makeR09Result(
  estadoCalculo: EstadoCalculo = EstadoCalculo.CALCULADO,
  options: { horasTotal?: number; horasMinTotales?: number } = {},
): ResultadoIndicador<ResultadoR09> {
  const { horasTotal = 3000, horasMinTotales = 2800 } = options;
  const diferencia = horasTotal - horasMinTotales;
  return {
    codigo: 'R-09',
    contextoId: PLAN_ID,
    tipoContexto: 'PLAN',
    estadoImplementacion: 'IMPLEMENTADO',
    estadoCalculo,
    valor: {
      planEstudioId: PLAN_ID,
      totalMaterias: 20,
      materiasSinHoras: [],
      materiasConBloqueIndeterminado: [],
      horasTotal,
      horasPorBloque: { CB: 600, TB: 800, TA: 900, CX: 400 },
      evaluaciones: {
        CB: { horasReales: 600, horasMinimas: 500, diferencia: 100, cumple: true },
        TB: { horasReales: 800, horasMinimas: 700, diferencia: 100, cumple: true },
        TA: { horasReales: 900, horasMinimas: 800, diferencia: 100, cumple: true },
        CX: { horasReales: 400, horasMinimas: 300, diferencia: 100, cumple: true },
        total: {
          horasReales: horasTotal,
          horasMinimas: horasMinTotales,
          diferencia,
          cumple: diferencia >= 0,
        },
      },
    },
    datosFaltantes: [],
    fechaEvaluacion: new Date(),
  };
}

function makeDefaultResult(codigo: string): ResultadoIndicador<Record<string, unknown>> {
  return {
    codigo,
    contextoId: PLAN_ID,
    tipoContexto: 'PLAN',
    estadoImplementacion: 'IMPLEMENTADO',
    estadoCalculo: EstadoCalculo.CALCULADO,
    // valor must carry estadoCalculo because derivarR11/R13/R14 return r11.valor directly
    valor: { estadoCalculo: EstadoCalculo.CALCULADO },
    datosFaltantes: [],
    fechaEvaluacion: new Date(),
  };
}

function makeIndicadoresSvc(
  r02Result: ResultadoIndicador<ResultadoR02> | Error = makeR02Result(),
  r08Result: ResultadoIndicador<ResultadoR08> | Error = makeR08Result(),
  r09Result: ResultadoIndicador<ResultadoR09> | Error = makeR09Result(),
) {
  return {
    evaluar: jest.fn().mockImplementation(({ codigoIndicador }: { codigoIndicador: string }) => {
      if (codigoIndicador === 'R-02') {
        return r02Result instanceof Error
          ? Promise.reject(r02Result)
          : Promise.resolve(r02Result);
      }
      if (codigoIndicador === 'R-08') {
        return r08Result instanceof Error
          ? Promise.reject(r08Result)
          : Promise.resolve(r08Result);
      }
      if (codigoIndicador === 'R-09') {
        return r09Result instanceof Error
          ? Promise.reject(r09Result)
          : Promise.resolve(r09Result);
      }
      // R-11, R-13, R-14 devuelven CALCULADO por defecto en este suite
      if (['R-11', 'R-13', 'R-14'].includes(codigoIndicador)) {
        return Promise.resolve(makeDefaultResult(codigoIndicador));
      }
      return Promise.reject(new Error(`Indicador no mockeado: ${codigoIndicador}`));
    }),
  };
}

function makeSvc(
  r02: ResultadoIndicador<ResultadoR02> | Error = makeR02Result(),
  r08: ResultadoIndicador<ResultadoR08> | Error = makeR08Result(),
  r09: ResultadoIndicador<ResultadoR09> | Error = makeR09Result(),
) {
  return new TablroPlanService(makeIndicadoresSvc(r02, r08, r09) as any);
}

const USR = { usuarioId: 'usr-1', rolNombre: 'SECRETARIA_ACADEMICA' };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TablroPlanService', () => {
  // ── IPL-04 — R-02 múltiples responsables ────────────────────────────────────

  describe('IPL-04 — Pares materia/cátedra con múltiples responsables (R-02)', () => {
    it('CALCULADO sin alertas: paresConAlerta=0, paresInciertos=0', async () => {
      const res = await makeSvc().consultarPlan(PLAN_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ipl04.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(res.ipl04.paresConAlerta).toBe(0);
      expect(res.ipl04.paresInciertos).toBe(0);
      expect(res.ipl04.totalMaterias).toBe(5);
    });

    it('CALCULADO con alertas: paresConAlerta > 0', async () => {
      const res = await makeSvc(makeR02Result(EstadoCalculo.CALCULADO, { alertas: 3 }))
        .consultarPlan(PLAN_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ipl04.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(res.ipl04.paresConAlerta).toBe(3);
      expect(res.ipl04.paresInciertos).toBe(0);
    });

    it('PARCIAL: paresInciertos > 0 cuando R-02 retorna PARCIAL', async () => {
      const res = await makeSvc(makeR02Result(EstadoCalculo.PARCIAL, { inciertos: 2 }))
        .consultarPlan(PLAN_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ipl04.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
      expect(res.ipl04.paresInciertos).toBe(2);
    });

    it('NO_APLICA: totalMaterias=0 y paresConAlerta=0', async () => {
      const res = await makeSvc(makeR02Result(EstadoCalculo.NO_APLICA, { totalMaterias: 0 }))
        .consultarPlan(PLAN_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ipl04.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
      expect(res.ipl04.totalMaterias).toBe(0);
      expect(res.ipl04.paresConAlerta).toBe(0);
    });

    it('NO_DETERMINABLE cuando R-02 falla (error no de autorización)', async () => {
      const res = await makeSvc(new Error('DB timeout'))
        .consultarPlan(PLAN_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ipl04.estadoCalculo).toBe(EstadoCalculo.NO_DETERMINABLE);
      expect(res.ipl04.paresConAlerta).toBe(0);
    });

    it('CALCULADO sin alertas ni inciertos — paresConAlerta=0, paresInciertos=0', async () => {
      const res = await makeSvc(
        makeR02Result(EstadoCalculo.CALCULADO, { alertas: 0, inciertos: 0, totalMaterias: 8 }),
      ).consultarPlan(PLAN_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ipl04.paresConAlerta).toBe(0);
      expect(res.ipl04.paresInciertos).toBe(0);
      expect(res.ipl04.totalMaterias).toBe(8);
    });

    it('múltiples alertas: paresConAlerta refleja el conteo de R-02', async () => {
      const res = await makeSvc(
        makeR02Result(EstadoCalculo.CALCULADO, { alertas: 5, totalMaterias: 10 }),
      ).consultarPlan(PLAN_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ipl04.paresConAlerta).toBe(5);
      expect(res.ipl04.totalMaterias).toBe(10);
    });
  });

  // ── IPL-03 — R-08 materias sin responsable (regresión) ──────────────────────

  describe('IPL-03 — Materias sin responsable de cátedra (R-08) — regresión', () => {
    it('CALCULADO: sinResponsable y conResponsable reflejan R-08', async () => {
      const res = await makeSvc(
        makeR02Result(),
        makeR08Result(EstadoCalculo.CALCULADO, { sinResponsable: 2, inciertas: 1, conResponsable: 2, total: 5 }),
      ).consultarPlan(PLAN_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ipl03.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(res.ipl03.sinResponsable).toBe(2);
      expect(res.ipl03.inciertas).toBe(1);
      expect(res.ipl03.conResponsable).toBe(2);
      expect(res.ipl03.totalMaterias).toBe(5);
    });

    it('NO_DETERMINABLE cuando R-08 falla', async () => {
      const res = await makeSvc(makeR02Result(), new Error('DB error'))
        .consultarPlan(PLAN_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ipl03.estadoCalculo).toBe(EstadoCalculo.NO_DETERMINABLE);
    });
  });

  // ── estadoGeneralCalculo incluye IPL-04 ──────────────────────────────────────

  describe('estadoGeneralCalculo — incluye todos los indicadores', () => {
    it('todos CALCULADO → estadoGeneralCalculo CALCULADO', async () => {
      const res = await makeSvc().consultarPlan(PLAN_ID, USR.usuarioId, USR.rolNombre);
      expect(res.estadoGeneralCalculo).toBe(EstadoCalculo.CALCULADO);
    });

    it('IPL-04 PARCIAL eleva estadoGeneralCalculo', async () => {
      const res = await makeSvc(makeR02Result(EstadoCalculo.PARCIAL, { inciertos: 1 }))
        .consultarPlan(PLAN_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ipl04.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
      expect(res.estadoGeneralCalculo).toBe(EstadoCalculo.PARCIAL);
    });

    it('IPL-04 NO_DETERMINABLE eleva estadoGeneralCalculo', async () => {
      const res = await makeSvc(new Error('timeout'))
        .consultarPlan(PLAN_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ipl04.estadoCalculo).toBe(EstadoCalculo.NO_DETERMINABLE);
      expect(res.estadoGeneralCalculo).toBe(EstadoCalculo.NO_DETERMINABLE);
    });

    it('IPL-03 NO_DETERMINABLE eleva estadoGeneralCalculo (regresión R-08)', async () => {
      const res = await makeSvc(makeR02Result(), new Error('r08 fail'))
        .consultarPlan(PLAN_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ipl03.estadoCalculo).toBe(EstadoCalculo.NO_DETERMINABLE);
      expect(res.estadoGeneralCalculo).toBe(EstadoCalculo.NO_DETERMINABLE);
    });
  });

  // ── Autorización — re-lanzado ForbiddenException / NotFoundException ─────────

  describe('autorización — re-lanza errores de autorización inmediatamente', () => {
    it('ForbiddenException de R-02 se re-lanza', async () => {
      await expect(
        makeSvc(new ForbiddenException('Sin scope'))
          .consultarPlan(PLAN_ID, USR.usuarioId, USR.rolNombre),
      ).rejects.toThrow(ForbiddenException);
    });

    it('NotFoundException de R-02 se re-lanza', async () => {
      await expect(
        makeSvc(new NotFoundException('Plan no encontrado'))
          .consultarPlan(PLAN_ID, USR.usuarioId, USR.rolNombre),
      ).rejects.toThrow(NotFoundException);
    });

    it('ForbiddenException de R-08 se re-lanza', async () => {
      await expect(
        makeSvc(makeR02Result(), new ForbiddenException())
          .consultarPlan(PLAN_ID, USR.usuarioId, USR.rolNombre),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ForbiddenException de R-09 se re-lanza', async () => {
      await expect(
        makeSvc(makeR02Result(), makeR08Result(), new ForbiddenException())
          .consultarPlan(PLAN_ID, USR.usuarioId, USR.rolNombre),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── Estructura de respuesta ──────────────────────────────────────────────────

  describe('estructura de respuesta', () => {
    it('respuesta incluye ipl01, ipl02, ipl03, ipl04, ipl05, estadoGeneralCalculo', async () => {
      const res = await makeSvc().consultarPlan(PLAN_ID, USR.usuarioId, USR.rolNombre);
      expect(res.planEstudioId).toBe(PLAN_ID);
      expect(res.fechaEvaluacion).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(res.ipl01).toBeDefined();
      expect(res.ipl02).toBeDefined();
      expect(res.ipl03).toBeDefined();
      expect(res.ipl04).toBeDefined();
      expect(res.ipl05).toBeDefined();
      expect(res.estadoGeneralCalculo).toBeDefined();
      expect(res.datosFaltantes).toBeInstanceOf(Array);
      expect(res.advertencias).toBeInstanceOf(Array);
    });

    it('datosFaltantes acumula datos de R-02, R-08 y R-09', async () => {
      const r02WithDf = makeR02Result();
      (r02WithDf as any).datosFaltantes = [{ campo: 'r02campo', entidad: 'E', descripcion: 'R02' }];
      const r08WithDf = makeR08Result();
      (r08WithDf as any).datosFaltantes = [{ campo: 'r08campo', entidad: 'E', descripcion: 'R08' }];
      const res = await makeSvc(r02WithDf, r08WithDf).consultarPlan(PLAN_ID, USR.usuarioId, USR.rolNombre);
      expect(res.datosFaltantes).toHaveLength(2);
      expect(res.datosFaltantes.map((d) => d.campo)).toContain('r02campo');
      expect(res.datosFaltantes.map((d) => d.campo)).toContain('r08campo');
    });
  });
});
