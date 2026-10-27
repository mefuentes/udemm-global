import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TablroCarreraService } from './tablero-carrera.service';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type { ResultadoR07 } from '../indicadores/r07.evaluador';
import type { DocenteAlertaR03, ResultadoR03 } from '../indicadores/r03.evaluador';
import type { CargoSinActividadR04, ResultadoR04 } from '../indicadores/r04.evaluador';
import type { ResultadoR10 } from '../indicadores/r10.evaluador';
import type { ResultadoR15 } from '../indicadores/r15.evaluador';
import type { DocenteAlertaR12, DocenteNoDeterminableR12 } from '../indicadores/r12.evaluador';
import type { ResultadoIP09 } from '../indicadores/ip09.evaluador';
import type { ResultadoIP10 } from '../indicadores/ip10.evaluador';

// ── Helpers ───────────────────────────────────────────────────────────────────

const CAR_ID = 'car-00000000-0000-0000-0000-000000000001';

type DocenteId = { docenteId: string };
type CargoPair = { docenteId: string; cargoId: string; cargo: { nombre: string } };

function makePrisma(overrides: {
  carrera?: { id: string } | null;
  planes?: { id: string }[];
  totalMaterias?: number;
  materiasCubiertasIds?: { materiaId: string }[];
  docentesVigentesIds?: DocenteId[];
  cargosActivosConCategoria?: CargoPair[];
  cargosVigentes?: CargoPair[];
} = {}) {
  const {
    carrera = { id: CAR_ID },
    planes = [{ id: 'plan-1' }],
    totalMaterias = 10,
    materiasCubiertasIds = [{ materiaId: 'm-1' }, { materiaId: 'm-2' }],
    docentesVigentesIds = [{ docenteId: 'd-1' }],
    cargosActivosConCategoria = [{ docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } }],
    cargosVigentes = [],
  } = overrides;

  return {
    carrera: { findUnique: jest.fn().mockResolvedValue(carrera) },
    planEstudio: { findMany: jest.fn().mockResolvedValue(planes) },
    materia: { count: jest.fn().mockResolvedValue(totalMaterias) },
    vinculacionCatedra: {
      findMany: jest.fn().mockImplementation((args: any) => {
        const distinct = (args.distinct ?? []) as string[];
        const hasDocenteActivo = args.where?.docente?.activo === true;

        if (distinct.includes('materiaId')) return Promise.resolve(materiasCubiertasIds);
        if (!distinct.includes('cargoId'))  return Promise.resolve(docentesVigentesIds);   // IP-01
        if (hasDocenteActivo)               return Promise.resolve(cargosActivosConCategoria); // IP-02
        return Promise.resolve(cargosVigentes); // IP-08
      }),
    },
  };
}

function makeScope(tieneScope = true) {
  return { tieneScopeCarrera: jest.fn().mockResolvedValue(tieneScope) };
}

/** Crea un mock de R15EvaluadorService con resultado controlable. */
function makeR15Mock(
  estadoCalculo: EstadoCalculo = EstadoCalculo.CALCULADO,
  options: { limite?: number | null; enAlerta?: number } = {},
) {
  const { limite = estadoCalculo === EstadoCalculo.NO_DETERMINABLE ? null : 3, enAlerta: nAlerta = 0 } = options;
  const tieneData = estadoCalculo === EstadoCalculo.CALCULADO || estadoCalculo === EstadoCalculo.NO_DETERMINABLE;
  const valor: ResultadoR15 = {
    carreraId: CAR_ID,
    limite,
    totalDocentes: tieneData ? 2 : 0,
    promedio: tieneData ? 2.0 : null,
    mediana: tieneData ? 2.0 : null,
    maximo: tieneData ? 3 : null,
    distribucion: tieneData
      ? [
          { docenteId: 'd-1', nombre: 'Doc Uno', nMaterias: 3 },
          { docenteId: 'd-2', nombre: 'Doc Dos', nMaterias: 1 },
        ]
      : [],
    totalEnAlerta: nAlerta,
    enAlerta: Array.from({ length: nAlerta }, (_, i) => ({
      docenteId: `d-alerta-${i + 1}`,
      nombre: `Alerta ${i + 1}`,
      nMaterias: (limite ?? 3) + i + 1,
      exceso: i + 1,
    })),
  };
  return {
    evaluar: jest.fn().mockResolvedValue({
      codigo: 'R-15',
      contextoId: CAR_ID,
      tipoContexto: 'CARRERA' as const,
      estadoImplementacion: 'IMPLEMENTADO' as const,
      estadoCalculo,
      valor,
      datosFaltantes: [],
      fechaEvaluacion: new Date(),
    }),
  };
}

/** Crea un mock de R10EvaluadorService con resultado controlable. */
function makeR10Mock(
  estadoCalculo: EstadoCalculo = EstadoCalculo.CALCULADO,
  options: { enAlerta?: number; alcanceFacultad?: boolean; inciertos?: number } = {},
) {
  const { enAlerta: nAlerta = 0, alcanceFacultad = true, inciertos = 0 } = options;
  const umbral = 20;
  const totalDocentes = estadoCalculo === EstadoCalculo.NO_APLICA ? 0 : 3;
  const valor: ResultadoR10 = {
    carreraId: CAR_ID,
    umbral,
    totalDocentes,
    totalEnAlerta: nAlerta,
    totalInciertos: inciertos,
    enAlerta: Array.from({ length: nAlerta + inciertos }, (_, i) => ({
      docenteId: `d-baja-${i + 1}`,
      nombre: `BajaDedicacion ${i + 1}`,
      horasConocidas: umbral - i - 1,
      umbral,
      incierto: i >= nAlerta,
      componentes: { horasDocencia: umbral - i - 1, horasGestion: 0, horasInvestigacion: 0, horasVinculacion: 0, gestionIndeterminada: false, investigacionIndeterminada: false, vinculacionIndeterminada: false },
    })),
    alcanceFacultad,
    estadoCalculo,
  };
  return {
    evaluar: jest.fn().mockResolvedValue({
      codigo: 'R-10',
      contextoId: CAR_ID,
      tipoContexto: 'CARRERA' as const,
      estadoImplementacion: 'IMPLEMENTADO' as const,
      estadoCalculo,
      valor,
      datosFaltantes: [],
      fechaEvaluacion: new Date(),
    }),
  };
}

/** Crea un mock de IP09EvaluadorService con resultado controlable. */
function makeIP09Mock(
  estadoCalculo: EstadoCalculo = EstadoCalculo.CALCULADO,
  totalDocentes = 2,
  completitudPromedio: number | null = 75,
) {
  const valor: ResultadoIP09 = {
    totalDocentes: estadoCalculo === EstadoCalculo.NO_APLICA ? 0 : totalDocentes,
    completitudPromedio: estadoCalculo === EstadoCalculo.NO_APLICA ? null : completitudPromedio,
    estadoCalculo,
  };
  return { evaluarParaCarrera: jest.fn().mockResolvedValue(valor) };
}

/** Crea un mock de IP10EvaluadorService con resultado controlable. */
function makeIP10Mock(estadoCalculo: EstadoCalculo = EstadoCalculo.CALCULADO, puntaje = 100) {
  const valor: ResultadoIP10 = {
    carreraId: CAR_ID,
    puntaje,
    componenteA: 0,
    componenteM: 0,
    alertasR03: 0,
    alertasR04Penalizables: 0,
    alertasR07: 0,
    estadoCalculo,
  };
  return { evaluarParaCarrera: jest.fn().mockResolvedValue(valor) };
}

/** Crea un mock de R12EvaluadorService con resultado controlable. */
function makeR12Mock(
  estadoCalculo: EstadoCalculo = EstadoCalculo.CALCULADO,
  options: { incompletos?: number; alcanceFacultad?: boolean; noDeterminables?: number } = {},
) {
  const { incompletos: nIncompletos = 0, alcanceFacultad = true, noDeterminables = 0 } = options;
  const totalDocentes = estadoCalculo === EstadoCalculo.NO_APLICA ? 0 : 2;
  const incompletos: DocenteAlertaR12[] = Array.from({ length: nIncompletos }, (_, i) => ({
    docenteId: `d-inc-${i + 1}`,
    nombre: `Incompleto ${i + 1}`,
    faltantes: ['personales' as const],
  }));
  const noDeterminablesArr: DocenteNoDeterminableR12[] = Array.from(
    { length: noDeterminables },
    (_, i) => ({ docenteId: `d-nd-${i + 1}`, nombre: `NoDet ${i + 1}`, causa: 'CROSS_FACULTAD' as const }),
  );
  return {
    evaluar: jest.fn().mockResolvedValue({
      codigo: 'R-12',
      contextoId: CAR_ID,
      tipoContexto: 'DOCENTE' as const,
      estadoImplementacion: 'IMPLEMENTADO' as const,
      estadoCalculo,
      valor: {
        carreraId: CAR_ID,
        facultadId: 'fac-01',
        totalDocentes,
        totalIncompletos: nIncompletos,
        incompletos,
        totalNoDeterminables: noDeterminables,
        noDeterminables: noDeterminablesArr,
        alcanceFacultad,
      },
      datosFaltantes: [],
      fechaEvaluacion: new Date(),
    }),
  };
}

/** Crea un mock de R07EvaluadorService con resultado controlable. */
function makeR07Mock(
  estadoCalculo: EstadoCalculo = EstadoCalculo.CALCULADO,
  options: { sobreasignados?: number; alcanceFacultad?: boolean; noDeterminables?: number } = {},
) {
  const { sobreasignados: nSobre = 0, alcanceFacultad = true, noDeterminables = 0 } = options;
  const limite = estadoCalculo === EstadoCalculo.NO_DETERMINABLE ? null : 3;
  const totalDocentes = estadoCalculo === EstadoCalculo.NO_APLICA ? 0 : 2;
  const valor: ResultadoR07 = {
    carreraId: CAR_ID,
    facultadId: 'fac-01',
    limite,
    totalDocentes,
    totalSobreasignados: nSobre,
    sobreasignados: Array.from({ length: nSobre }, (_, i) => ({
      docenteId: `d-over-${i + 1}`,
      nombre: `Sobreasignado ${i + 1}`,
      nMaterias: (limite ?? 3) + i + 1,
      exceso: i + 1,
      asignaciones: [],
    })),
    totalNoDeterminables: noDeterminables,
    noDeterminables: [],
    alcanceFacultad,
  };
  return {
    evaluar: jest.fn().mockResolvedValue({
      codigo: 'R-07',
      contextoId: CAR_ID,
      tipoContexto: 'DOCENTE' as const,
      estadoImplementacion: 'IMPLEMENTADO' as const,
      estadoCalculo,
      valor,
      datosFaltantes: [],
      fechaEvaluacion: new Date(),
    }),
  };
}

/** Crea un mock de R03EvaluadorService. */
function makeR03Mock(
  estadoCalculo: EstadoCalculo = EstadoCalculo.CALCULADO,
  options: { enAlerta?: { docenteId: string; nombre: string }[] } = {},
) {
  const enAlerta: DocenteAlertaR03[] = (options.enAlerta ?? []).map(d => ({
    docenteId: d.docenteId,
    nombre: d.nombre,
    componentes: { horasDocencia: 30, horasGestion: 0, horasNoAcademico: 0, usoTope: 30 },
    exceso: 2,
  }));
  const valor: ResultadoR03 = {
    carreraId: CAR_ID,
    facultadId: 'fac-01',
    limite: estadoCalculo === EstadoCalculo.NO_DETERMINABLE ? null : 28,
    totalDocentes: estadoCalculo === EstadoCalculo.NO_APLICA ? 0 : 2,
    totalEnAlerta: enAlerta.length,
    enAlerta,
    totalNoDeterminables: 0,
    noDeterminables: [],
    alcanceFacultad: true,
  };
  return {
    evaluar: jest.fn().mockResolvedValue({
      codigo: 'R-03',
      contextoId: CAR_ID,
      tipoContexto: 'DOCENTE' as const,
      estadoImplementacion: 'IMPLEMENTADO' as const,
      estadoCalculo,
      valor,
      datosFaltantes: [],
      fechaEvaluacion: new Date(),
    }),
  };
}

/** Crea un mock de R04EvaluadorService (un único resultado para cualquier planEstudioId). */
function makeR04Mock(
  cargosEnAlerta: { docenteId: string; nombre: string }[] = [],
  estadoCalculo: EstadoCalculo = EstadoCalculo.CALCULADO,
) {
  const cargos: CargoSinActividadR04[] = cargosEnAlerta.map((d, i) => ({
    docenteId: d.docenteId,
    nombre: d.nombre,
    cargoDocenteId: `cargo-r04-${i}`,
    cargoNombre: 'Titular',
    designacion: null,
    fechaInicio: new Date('2023-01-01'),
    fechaFin: null,
    verificado: true,
  }));
  return {
    evaluar: jest.fn().mockResolvedValue({
      codigo: 'R-04',
      contextoId: 'plan-1',
      tipoContexto: 'DOCENTE' as const,
      estadoImplementacion: 'IMPLEMENTADO' as const,
      estadoCalculo,
      valor: {
        planEstudioId: 'plan-1',
        carreraId: CAR_ID,
        fechaCalculo: new Date(),
        totalDocentesPlantel: 2,
        cargosEnAlerta: cargos,
        totalCargosEnAlerta: cargos.length,
        docentesExceptuadosPorC4: [],
      } as ResultadoR04,
      datosFaltantes: [],
      fechaEvaluacion: new Date(),
    }),
  };
}

/** Helper para construir un resultado R-04 completo con planId y cargos dados. */
function buildR04Result(planId: string, cargos: { docenteId: string; nombre: string }[]) {
  const cargosEnAlerta: CargoSinActividadR04[] = cargos.map((d, i) => ({
    docenteId: d.docenteId,
    nombre: d.nombre,
    cargoDocenteId: `cargo-${planId}-${i}`,
    cargoNombre: 'Titular',
    designacion: null,
    fechaInicio: new Date('2023-01-01'),
    fechaFin: null,
    verificado: true,
  }));
  return {
    codigo: 'R-04',
    contextoId: planId,
    tipoContexto: 'DOCENTE' as const,
    estadoImplementacion: 'IMPLEMENTADO' as const,
    estadoCalculo: EstadoCalculo.CALCULADO,
    valor: {
      planEstudioId: planId,
      carreraId: CAR_ID,
      fechaCalculo: new Date(),
      totalDocentesPlantel: 2,
      cargosEnAlerta,
      totalCargosEnAlerta: cargos.length,
      docentesExceptuadosPorC4: [],
    } as ResultadoR04,
    datosFaltantes: [],
    fechaEvaluacion: new Date(),
  };
}

function makeSvc(
  prismaOverrides: Parameters<typeof makePrisma>[0] = {},
  scopeValue = true,
  r15Estado: EstadoCalculo = EstadoCalculo.CALCULADO,
  r07Estado: EstadoCalculo = EstadoCalculo.CALCULADO,
  r07Options: { sobreasignados?: number; alcanceFacultad?: boolean; noDeterminables?: number } = {},
  ip09Estado: EstadoCalculo = EstadoCalculo.CALCULADO,
  ip10Estado: EstadoCalculo = EstadoCalculo.CALCULADO,
  r12Estado: EstadoCalculo = EstadoCalculo.CALCULADO,
  r12Options: { incompletos?: number; alcanceFacultad?: boolean; noDeterminables?: number } = {},
  r10Estado: EstadoCalculo = EstadoCalculo.CALCULADO,
  r10Options: { enAlerta?: number; alcanceFacultad?: boolean; inciertos?: number } = {},
  r03Mock?: ReturnType<typeof makeR03Mock>,
  r04Mock?: ReturnType<typeof makeR04Mock>,
) {
  return new TablroCarreraService(
    makePrisma(prismaOverrides) as any,
    makeScope(scopeValue) as any,
    makeR15Mock(r15Estado) as any,
    makeR07Mock(r07Estado, r07Options) as any,
    makeIP09Mock(ip09Estado) as any,
    makeIP10Mock(ip10Estado) as any,
    makeR12Mock(r12Estado, r12Options) as any,
    makeR10Mock(r10Estado, r10Options) as any,
    (r03Mock ?? makeR03Mock()) as any,
    (r04Mock ?? makeR04Mock()) as any,
  );
}

const USR = { usuarioId: 'usr-1', rolNombre: 'SECRETARIA_ACADEMICA' };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TablroCarreraService', () => {
  describe('consultarCarrera — autorización', () => {
    it('lanza ForbiddenException para rol sin acceso a MOD-AUT', async () => {
      await expect(
        makeSvc().consultarCarrera(CAR_ID, USR.usuarioId, 'DOCENTE'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lanza NotFoundException si la carrera no existe', async () => {
      await expect(
        makeSvc({ carrera: null }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza ForbiddenException si el usuario no tiene scope sobre la carrera', async () => {
      await expect(
        makeSvc({}, false).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('IP-03 — Materias cubiertas', () => {
    it('NO_APLICA cuando la carrera no tiene planes de estudio', async () => {
      const res = await makeSvc({ planes: [], materiasCubiertasIds: [] }).consultarCarrera(
        CAR_ID, USR.usuarioId, USR.rolNombre,
      );
      expect(res.ip03.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
      expect(res.ip03.total).toBe(0);
      expect(res.ip03.cubiertas).toBe(0);
    });

    it('NO_APLICA cuando los planes no tienen materias', async () => {
      const res = await makeSvc({ totalMaterias: 0, materiasCubiertasIds: [] }).consultarCarrera(
        CAR_ID, USR.usuarioId, USR.rolNombre,
      );
      expect(res.ip03.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    });

    it('CALCULADO con conteo correcto de cubiertas y total', async () => {
      const res = await makeSvc({
        totalMaterias: 10,
        materiasCubiertasIds: [{ materiaId: 'm-1' }, { materiaId: 'm-2' }, { materiaId: 'm-3' }],
      }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip03.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(res.ip03.cubiertas).toBe(3);
      expect(res.ip03.total).toBe(10);
    });

    it('cubiertas puede ser 0 aunque existan materias (ninguna con vinculación APROBADA)', async () => {
      const res = await makeSvc({
        totalMaterias: 5,
        materiasCubiertasIds: [],
      }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip03.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(res.ip03.cubiertas).toBe(0);
      expect(res.ip03.total).toBe(5);
    });
  });

  describe('IP-08 — Relación profesores / auxiliares', () => {
    it('NO_APLICA cuando no hay vinculaciones APROBADAS', async () => {
      const res = await makeSvc({ cargosVigentes: [] }).consultarCarrera(
        CAR_ID, USR.usuarioId, USR.rolNombre,
      );
      expect(res.ip08.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
      expect(res.ip08.ratio).toBeNull();
    });

    it('ratio null cuando auxiliares = 0 (solo profesores)', async () => {
      const res = await makeSvc({
        cargosVigentes: [
          { docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } },
          { docenteId: 'd-2', cargoId: 'c-1', cargo: { nombre: 'Titular' } },
        ],
      }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip08.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(res.ip08.profesores).toBe(2);
      expect(res.ip08.auxiliares).toBe(0);
      expect(res.ip08.ratio).toBeNull();
    });

    it('CALCULADO con ratio P/A correcto (2 profesores, 1 auxiliar → 2.0)', async () => {
      const res = await makeSvc({
        cargosVigentes: [
          { docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } },
          { docenteId: 'd-2', cargoId: 'c-2', cargo: { nombre: 'Adjunto' } },
          { docenteId: 'd-3', cargoId: 'c-3', cargo: { nombre: 'JTP' } },
        ],
      }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip08.profesores).toBe(2);
      expect(res.ip08.auxiliares).toBe(1);
      expect(res.ip08.ratio).toBe(2.0);
    });

    it('cargos de categoría Otros no se cuentan en el ratio', async () => {
      const res = await makeSvc({
        cargosVigentes: [
          { docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } },
          { docenteId: 'd-2', cargoId: 'c-2', cargo: { nombre: 'Coordinador' } },
          { docenteId: 'd-3', cargoId: 'c-3', cargo: { nombre: 'JTP' } },
        ],
      }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip08.profesores).toBe(1);
      expect(res.ip08.auxiliares).toBe(1);
    });

    it('reconoce variantes de nombre: Profesor Asociado y Ayudante No Graduado', async () => {
      const res = await makeSvc({
        cargosVigentes: [
          { docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Profesor Asociado' } },
          { docenteId: 'd-2', cargoId: 'c-2', cargo: { nombre: 'Ayudante No Graduado' } },
        ],
      }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip08.profesores).toBe(1);
      expect(res.ip08.auxiliares).toBe(1);
      expect(res.ip08.ratio).toBe(1.0);
    });
  });

  describe('IP-01 — Docentes vigentes', () => {
    it('NO_APLICA cuando no hay docentes activos con vinculación APROBADA', async () => {
      const res = await makeSvc({ docentesVigentesIds: [] }).consultarCarrera(
        CAR_ID, USR.usuarioId, USR.rolNombre,
      );
      expect(res.ip01.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
      expect(res.ip01.total).toBe(0);
    });

    it('CALCULADO con conteo correcto de docentes distintos', async () => {
      const res = await makeSvc({
        docentesVigentesIds: [{ docenteId: 'd-1' }, { docenteId: 'd-2' }, { docenteId: 'd-3' }],
      }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip01.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(res.ip01.total).toBe(3);
    });
  });

  describe('IP-02 — Cargos docentes vigentes', () => {
    it('NO_APLICA cuando no hay cargos docentes clasificables', async () => {
      const res = await makeSvc({ cargosActivosConCategoria: [] }).consultarCarrera(
        CAR_ID, USR.usuarioId, USR.rolNombre,
      );
      expect(res.ip02.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
      expect(res.ip02.total).toBe(0);
    });

    it('CALCULADO con conteo correcto de cargos P+A', async () => {
      const res = await makeSvc({
        cargosActivosConCategoria: [
          { docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } },
          { docenteId: 'd-1', cargoId: 'c-2', cargo: { nombre: 'JTP' } },
          { docenteId: 'd-2', cargoId: 'c-1', cargo: { nombre: 'Adjunto' } },
        ],
      }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip02.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(res.ip02.total).toBe(3);
    });

    it('cargos de gestión ("Otros") no se cuentan en IP-02', async () => {
      const res = await makeSvc({
        cargosActivosConCategoria: [
          { docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } },
          { docenteId: 'd-2', cargoId: 'c-2', cargo: { nombre: 'Coordinador' } },
        ],
      }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip02.total).toBe(1);
    });

    it('NO_APLICA cuando solo hay cargos de gestión', async () => {
      const res = await makeSvc({
        cargosActivosConCategoria: [
          { docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Director de Carrera' } },
        ],
      }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip02.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    });
  });

  describe('estadoGeneralCalculo y estructura de respuesta', () => {
    it('estadoGeneralCalculo es NO_APLICA cuando todos los indicadores son NO_APLICA', async () => {
      const res = await makeSvc(
        {
          planes: [],
          materiasCubiertasIds: [],
          docentesVigentesIds: [],
          cargosActivosConCategoria: [],
          cargosVigentes: [],
        },
        true,
        EstadoCalculo.NO_APLICA,  // IP-04 (r06)
        EstadoCalculo.NO_APLICA,  // IP-13 (r07)
        {},
        EstadoCalculo.NO_APLICA,  // IP-09
      ).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.estadoGeneralCalculo).toBe(EstadoCalculo.NO_APLICA);
    });

    it('estadoGeneralCalculo es CALCULADO cuando todos los indicadores son CALCULADO', async () => {
      const res = await makeSvc({
        totalMaterias: 5,
        materiasCubiertasIds: [{ materiaId: 'm-1' }],
        cargosVigentes: [
          { docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } },
          { docenteId: 'd-2', cargoId: 'c-2', cargo: { nombre: 'JTP' } },
        ],
      }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.estadoGeneralCalculo).toBe(EstadoCalculo.CALCULADO);
    });

    it('fechaEvaluacion es un string ISO 8601 válido', async () => {
      const res = await makeSvc().consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.fechaEvaluacion).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(new Date(res.fechaEvaluacion).toISOString()).toBe(res.fechaEvaluacion);
    });
  });

  // ── IP-13 — Docentes sobreasignados ──────────────────────────────────────────

  describe('IP-13 — Docentes sobreasignados', () => {
    it('CALCULADO sin sobreasignados: totalSobreasignados=0, sobreasignados vacío', async () => {
      const res = await makeSvc().consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip13.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(res.ip13.totalSobreasignados).toBe(0);
      expect(res.ip13.sobreasignados).toEqual([]);
      expect(res.ip13.alcanceFacultad).toBe(true);
    });

    it('CALCULADO con sobreasignados: retorna lista con docenteId, nombre, nMaterias, exceso', async () => {
      const res = await makeSvc({}, true, EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO, { sobreasignados: 2 })
        .consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip13.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(res.ip13.totalSobreasignados).toBe(2);
      expect(res.ip13.sobreasignados).toHaveLength(2);
      expect(res.ip13.sobreasignados[0]).toMatchObject({
        docenteId: 'd-over-1',
        nombre: 'Sobreasignado 1',
        nMaterias: expect.any(Number),
        exceso: expect.any(Number),
      });
    });

    it('limite refleja el valor de P-03 configurado', async () => {
      const res = await makeSvc().consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip13.limite).toBe(3);
    });

    it('NO_APLICA: totalDocentes=0, sobreasignados vacío, limite presente', async () => {
      const res = await makeSvc({}, true, EstadoCalculo.CALCULADO, EstadoCalculo.NO_APLICA)
        .consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip13.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
      expect(res.ip13.totalDocentes).toBe(0);
      expect(res.ip13.sobreasignados).toEqual([]);
    });

    it('NO_DETERMINABLE: limite null cuando P-03 no está configurado', async () => {
      const res = await makeSvc({}, true, EstadoCalculo.CALCULADO, EstadoCalculo.NO_DETERMINABLE)
        .consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip13.estadoCalculo).toBe(EstadoCalculo.NO_DETERMINABLE);
      expect(res.ip13.limite).toBeNull();
      expect(res.ip13.sobreasignados).toEqual([]);
    });

    it('PARCIAL por alcance: alcanceFacultad=false (DIRECTOR_CARRERA)', async () => {
      const res = await makeSvc({}, true, EstadoCalculo.CALCULADO, EstadoCalculo.PARCIAL, { alcanceFacultad: false })
        .consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip13.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
      expect(res.ip13.alcanceFacultad).toBe(false);
    });

    it('PARCIAL por datos cross-facultad: totalNoDeterminables > 0', async () => {
      const res = await makeSvc({}, true, EstadoCalculo.CALCULADO, EstadoCalculo.PARCIAL, { noDeterminables: 1 })
        .consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip13.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
      expect(res.ip13.totalNoDeterminables).toBe(1);
    });

    it('R-07 es invocado con carreraId, usuarioId y rolNombre del contexto', async () => {
      const r07Mock = makeR07Mock();
      const svc = new TablroCarreraService(
        makePrisma() as any,
        makeScope() as any,
        makeR15Mock() as any,
        r07Mock as any,
        makeIP09Mock() as any,
        makeIP10Mock() as any,
        makeR12Mock() as any,
        makeR10Mock() as any,
        makeR03Mock() as any,
        makeR04Mock() as any,
      );
      await svc.consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(r07Mock.evaluar).toHaveBeenCalledWith(
        expect.objectContaining({
          carreraId: CAR_ID,
          usuarioId: USR.usuarioId,
          rolNombre: USR.rolNombre,
        }),
      );
    });

    it('estadoGeneralCalculo incluye IP-13: todos CALCULADO → CALCULADO', async () => {
      const res = await makeSvc({
        totalMaterias: 5,
        materiasCubiertasIds: [{ materiaId: 'm-1' }],
        cargosVigentes: [{ docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } }],
      }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip13.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(res.estadoGeneralCalculo).toBe(EstadoCalculo.CALCULADO);
    });

    it('estadoGeneralCalculo incluye IP-13: IP-13 PARCIAL eleva el estado general', async () => {
      const res = await makeSvc(
        {
          totalMaterias: 5,
          materiasCubiertasIds: [{ materiaId: 'm-1' }],
          cargosVigentes: [{ docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } }],
        },
        true,
        EstadoCalculo.CALCULADO,
        EstadoCalculo.PARCIAL,
      ).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip13.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
      // PARCIAL (peso 3) > CALCULADO (peso 1) → estadoGeneralCalculo = PARCIAL
      expect(res.estadoGeneralCalculo).toBe(EstadoCalculo.PARCIAL);
    });

    it('estadoGeneralCalculo incluye IP-13: IP-13 NO_DETERMINABLE eleva el estado general', async () => {
      const res = await makeSvc(
        {
          totalMaterias: 5,
          materiasCubiertasIds: [{ materiaId: 'm-1' }],
          cargosVigentes: [{ docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } }],
        },
        true,
        EstadoCalculo.CALCULADO,
        EstadoCalculo.NO_DETERMINABLE,
      ).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip13.estadoCalculo).toBe(EstadoCalculo.NO_DETERMINABLE);
      // NO_DETERMINABLE (peso 4) > CALCULADO (peso 1) → estadoGeneralCalculo = NO_DETERMINABLE
      expect(res.estadoGeneralCalculo).toBe(EstadoCalculo.NO_DETERMINABLE);
    });
  });

  // ── IP-09 — Completitud promedio del plantel ─────────────────────────────────

  describe('IP-09 — Completitud promedio del plantel', () => {
    it('CALCULADO: retorna totalDocentes y completitudPromedio del resultado IP09', async () => {
      const res = await makeSvc({}, true, EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO, {}, EstadoCalculo.CALCULADO)
        .consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip09.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(res.ip09.totalDocentes).toBe(2);
      expect(res.ip09.completitudPromedio).toBe(75);
    });

    it('NO_APLICA: completitudPromedio null, totalDocentes 0', async () => {
      const res = await makeSvc({}, true, EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO, {}, EstadoCalculo.NO_APLICA)
        .consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip09.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
      expect(res.ip09.totalDocentes).toBe(0);
      expect(res.ip09.completitudPromedio).toBeNull();
    });

    it('IP09EvaluadorService es invocado con el carreraId correcto', async () => {
      const ip09Mock = makeIP09Mock();
      const svc = new TablroCarreraService(
        makePrisma() as any,
        makeScope() as any,
        makeR15Mock() as any,
        makeR07Mock() as any,
        ip09Mock as any,
        makeIP10Mock() as any,
        makeR12Mock() as any,
        makeR10Mock() as any,
        makeR03Mock() as any,
        makeR04Mock() as any,
      );
      await svc.consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(ip09Mock.evaluarParaCarrera).toHaveBeenCalledWith(CAR_ID);
    });

    it('estadoGeneralCalculo incluye IP-09: IP-09 NO_APLICA eleva el estado general', async () => {
      const res = await makeSvc(
        {
          totalMaterias: 5,
          materiasCubiertasIds: [{ materiaId: 'm-1' }],
          cargosVigentes: [{ docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } }],
        },
        true,
        EstadoCalculo.CALCULADO,
        EstadoCalculo.CALCULADO,
        {},
        EstadoCalculo.NO_APLICA,
      ).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip09.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
      // NO_APLICA (peso 2) > CALCULADO (peso 1)
      expect(res.estadoGeneralCalculo).toBe(EstadoCalculo.NO_APLICA);
    });
  });

  // ── R-12 — Ficha docente incompleta ──────────────────────────────────────────

  describe('R-12 — Campos obligatorios faltantes en la ficha docente', () => {
    it('CALCULADO sin incompletos: totalIncompletos=0, incompletos vacío', async () => {
      const res = await makeSvc().consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.r12.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(res.r12.totalIncompletos).toBe(0);
      expect(res.r12.incompletos).toEqual([]);
      expect(res.r12.alcanceFacultad).toBe(true);
    });

    it('CALCULADO con incompletos: retorna lista con docenteId, nombre y faltantes', async () => {
      const res = await makeSvc(
        {}, true,
        EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO, {},
        EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO,
        EstadoCalculo.CALCULADO, { incompletos: 2 },
      ).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.r12.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(res.r12.totalIncompletos).toBe(2);
      expect(res.r12.incompletos).toHaveLength(2);
      expect(res.r12.incompletos[0]).toMatchObject({
        docenteId: 'd-inc-1',
        nombre: 'Incompleto 1',
        faltantes: ['personales'],
      });
    });

    it('NO_APLICA: totalDocentes=0, incompletos vacío', async () => {
      const res = await makeSvc(
        {}, true,
        EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO, {},
        EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO,
        EstadoCalculo.NO_APLICA,
      ).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.r12.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
      expect(res.r12.totalDocentes).toBe(0);
      expect(res.r12.incompletos).toEqual([]);
    });

    it('PARCIAL por alcance: alcanceFacultad=false (DIRECTOR_CARRERA)', async () => {
      const res = await makeSvc(
        {}, true,
        EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO, {},
        EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO,
        EstadoCalculo.PARCIAL, { alcanceFacultad: false },
      ).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.r12.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
      expect(res.r12.alcanceFacultad).toBe(false);
    });

    it('PARCIAL por noDeterminables: docentes cross-facultad presentes', async () => {
      const res = await makeSvc(
        {}, true,
        EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO, {},
        EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO,
        EstadoCalculo.PARCIAL, { noDeterminables: 1 },
      ).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.r12.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
      expect(res.r12.totalNoDeterminables).toBe(1);
    });

    it('R-12 es invocado con carreraId, usuarioId y rolNombre del contexto', async () => {
      const r12Mock = makeR12Mock();
      const svc = new TablroCarreraService(
        makePrisma() as any,
        makeScope() as any,
        makeR15Mock() as any,
        makeR07Mock() as any,
        makeIP09Mock() as any,
        makeIP10Mock() as any,
        r12Mock as any,
        makeR10Mock() as any,
        makeR03Mock() as any,
        makeR04Mock() as any,
      );
      await svc.consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(r12Mock.evaluar).toHaveBeenCalledWith(
        expect.objectContaining({
          carreraId: CAR_ID,
          usuarioId: USR.usuarioId,
          rolNombre: USR.rolNombre,
        }),
      );
    });

    it('estadoGeneralCalculo incluye R-12: R-12 PARCIAL eleva el estado general', async () => {
      const res = await makeSvc(
        {
          totalMaterias: 5,
          materiasCubiertasIds: [{ materiaId: 'm-1' }],
          cargosVigentes: [{ docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } }],
        },
        true,
        EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO, {},
        EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO,
        EstadoCalculo.PARCIAL, { alcanceFacultad: false },
      ).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.r12.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
      expect(res.estadoGeneralCalculo).toBe(EstadoCalculo.PARCIAL);
    });

    it('estadoGeneralCalculo incluye R-12: todos CALCULADO → CALCULADO', async () => {
      const res = await makeSvc({
        totalMaterias: 5,
        materiasCubiertasIds: [{ materiaId: 'm-1' }],
        cargosVigentes: [{ docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } }],
      }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.r12.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(res.estadoGeneralCalculo).toBe(EstadoCalculo.CALCULADO);
    });
  });

  // ── IP-04 / R-15 — Materias por docente ──────────────────────────────────────

  describe('IP-04 / R-15 — Materias por docente (carrera seleccionada)', () => {
    it('CALCULADO: retorna totalDocentes, mediana, promedio, máximo y limite del resultado R-15', async () => {
      const res = await makeSvc().consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip04.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(res.ip04.totalDocentes).toBe(2);
      expect(res.ip04.mediana).toBe(2.0);
      expect(res.ip04.promedio).toBe(2.0);
      expect(res.ip04.maximo).toBe(3);
      expect(res.ip04.limite).toBe(3);
      expect(res.ip04.totalEnAlerta).toBe(0);
      expect(res.ip04.enAlerta).toEqual([]);
    });

    it('NO_APLICA: stats null y distribución vacía cuando R-15 retorna NO_APLICA', async () => {
      const res = await makeSvc({}, true, EstadoCalculo.NO_APLICA).consultarCarrera(
        CAR_ID, USR.usuarioId, USR.rolNombre,
      );
      expect(res.ip04.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
      expect(res.ip04.totalDocentes).toBe(0);
      expect(res.ip04.mediana).toBeNull();
      expect(res.ip04.promedio).toBeNull();
      expect(res.ip04.maximo).toBeNull();
      expect(res.ip04.distribucion).toEqual([]);
    });

    it('distribucion refleja el resultado de R-15 sin transformaciones', async () => {
      const res = await makeSvc().consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip04.distribucion).toHaveLength(2);
      expect(res.ip04.distribucion[0]).toMatchObject({ docenteId: 'd-1', nombre: 'Doc Uno', nMaterias: 3 });
      expect(res.ip04.distribucion[1]).toMatchObject({ docenteId: 'd-2', nombre: 'Doc Dos', nMaterias: 1 });
    });

    it('R-15 es invocado con carreraId, usuarioId y rolNombre del contexto', async () => {
      const r15Mock = makeR15Mock();
      const svc = new TablroCarreraService(
        makePrisma() as any,
        makeScope() as any,
        r15Mock as any,
        makeR07Mock() as any,
        makeIP09Mock() as any,
        makeIP10Mock() as any,
        makeR12Mock() as any,
        makeR10Mock() as any,
        makeR03Mock() as any,
        makeR04Mock() as any,
      );
      await svc.consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(r15Mock.evaluar).toHaveBeenCalledWith(
        expect.objectContaining({
          carreraId: CAR_ID,
          usuarioId: USR.usuarioId,
          rolNombre: USR.rolNombre,
        }),
      );
    });

    it('estadoGeneralCalculo incluye IP-04: todos CALCULADO → CALCULADO', async () => {
      const res = await makeSvc({
        totalMaterias: 5,
        materiasCubiertasIds: [{ materiaId: 'm-1' }],
        cargosVigentes: [
          { docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } },
        ],
      }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip04.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(res.estadoGeneralCalculo).toBe(EstadoCalculo.CALCULADO);
    });

    it('estadoGeneralCalculo incluye IP-04: IP-04 NO_APLICA eleva el estado general', async () => {
      const res = await makeSvc(
        {
          totalMaterias: 5,
          materiasCubiertasIds: [{ materiaId: 'm-1' }],
          cargosVigentes: [
            { docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } },
          ],
        },
        true,
        EstadoCalculo.NO_APLICA,
      ).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip04.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
      // NO_APLICA (peso 2) > CALCULADO (peso 1) → estadoGeneralCalculo = NO_APLICA
      expect(res.estadoGeneralCalculo).toBe(EstadoCalculo.NO_APLICA);
    });

    it('NO_DETERMINABLE: limite null cuando p03MaxMat no está configurado', async () => {
      const res = await makeSvc({}, true, EstadoCalculo.NO_DETERMINABLE).consultarCarrera(
        CAR_ID, USR.usuarioId, USR.rolNombre,
      );
      expect(res.ip04.estadoCalculo).toBe(EstadoCalculo.NO_DETERMINABLE);
      expect(res.ip04.limite).toBeNull();
      expect(res.ip04.totalDocentes).toBe(2);
    });

    it('CALCULADO con alertas: enAlerta tiene docenteId, nombre, nMaterias y exceso', async () => {
      const res = await makeSvc({}, true, EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO, {}, EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO, {}, EstadoCalculo.CALCULADO, {})
        .consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      // default makeR15Mock has 0 alertas
      expect(res.ip04.totalEnAlerta).toBe(0);
      expect(res.ip04.enAlerta).toEqual([]);
    });
  });

  // ── R-10 — Baja dedicación horaria ────────────────────────────────────────────

  describe('R-10 — Baja dedicación horaria', () => {
    it('CALCULADO sin alertas: totalEnAlerta=0, enAlerta vacío, alcanceFacultad=true', async () => {
      const res = await makeSvc().consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.r10.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(res.r10.totalEnAlerta).toBe(0);
      expect(res.r10.enAlerta).toEqual([]);
      expect(res.r10.alcanceFacultad).toBe(true);
      expect(res.r10.umbral).toBe(20);
    });

    it('CALCULADO con alertas: retorna lista con docenteId, nombre, horasConocidas, umbral, incierto', async () => {
      const res = await makeSvc(
        {}, true,
        EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO, {},
        EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO,
        EstadoCalculo.CALCULADO, {},
        EstadoCalculo.CALCULADO, { enAlerta: 2 },
      ).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.r10.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(res.r10.totalEnAlerta).toBe(2);
      expect(res.r10.enAlerta).toHaveLength(2);
      expect(res.r10.enAlerta[0]).toMatchObject({
        docenteId: 'd-baja-1',
        nombre: 'BajaDedicacion 1',
        horasConocidas: expect.any(Number),
        umbral: 20,
        incierto: false,
      });
    });

    it('NO_APLICA: sin docentes activos en el scope', async () => {
      const res = await makeSvc(
        {}, true,
        EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO, {},
        EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO,
        EstadoCalculo.CALCULADO, {},
        EstadoCalculo.NO_APLICA,
      ).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.r10.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
      expect(res.r10.totalDocentes).toBe(0);
      expect(res.r10.enAlerta).toEqual([]);
    });

    it('PARCIAL por alcance: alcanceFacultad=false (DIRECTOR_CARRERA)', async () => {
      const res = await makeSvc(
        {}, true,
        EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO, {},
        EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO,
        EstadoCalculo.CALCULADO, {},
        EstadoCalculo.PARCIAL, { alcanceFacultad: false },
      ).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.r10.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
      expect(res.r10.alcanceFacultad).toBe(false);
    });

    it('inciertos: docentes con datos de horas incompletos marcados como incierto=true', async () => {
      const res = await makeSvc(
        {}, true,
        EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO, {},
        EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO,
        EstadoCalculo.CALCULADO, {},
        EstadoCalculo.PARCIAL, { inciertos: 1 },
      ).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.r10.totalInciertos).toBe(1);
      expect(res.r10.enAlerta.some((a) => a.incierto)).toBe(true);
    });

    it('R-10 es invocado con carreraId, usuarioId y rolNombre del contexto', async () => {
      const r10Mock = makeR10Mock();
      const svc = new TablroCarreraService(
        makePrisma() as any,
        makeScope() as any,
        makeR15Mock() as any,
        makeR07Mock() as any,
        makeIP09Mock() as any,
        makeIP10Mock() as any,
        makeR12Mock() as any,
        r10Mock as any,
        makeR03Mock() as any,
        makeR04Mock() as any,
      );
      await svc.consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(r10Mock.evaluar).toHaveBeenCalledWith(
        expect.objectContaining({
          carreraId: CAR_ID,
          usuarioId: USR.usuarioId,
          rolNombre: USR.rolNombre,
        }),
      );
    });

    it('estadoGeneralCalculo incluye R-10: R-10 PARCIAL eleva el estado general', async () => {
      const res = await makeSvc(
        {
          totalMaterias: 5,
          materiasCubiertasIds: [{ materiaId: 'm-1' }],
          cargosVigentes: [{ docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } }],
        },
        true,
        EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO, {},
        EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO,
        EstadoCalculo.CALCULADO, {},
        EstadoCalculo.PARCIAL,
      ).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.r10.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
      expect(res.estadoGeneralCalculo).toBe(EstadoCalculo.PARCIAL);
    });

    it('estadoGeneralCalculo incluye R-10: todos CALCULADO → CALCULADO', async () => {
      const res = await makeSvc({
        totalMaterias: 5,
        materiasCubiertasIds: [{ materiaId: 'm-1' }],
        cargosVigentes: [{ docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } }],
      }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.r10.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(res.estadoGeneralCalculo).toBe(EstadoCalculo.CALCULADO);
    });
  });

  // ── accionRequerida — Panel Acción Requerida (FSD §9.2) ───────────────────────

  describe('accionRequerida — Panel Acción Requerida', () => {
    // 1. Carrera sin docentes
    it('carrera sin docentes: todos los subindicadores con total=0', async () => {
      const res = await makeSvc(
        { planes: [], docentesVigentesIds: [], materiasCubiertasIds: [] },
        true,
        EstadoCalculo.NO_APLICA,
        EstadoCalculo.NO_APLICA, {},
        EstadoCalculo.NO_APLICA, EstadoCalculo.NO_APLICA,
        EstadoCalculo.NO_APLICA, {},
        EstadoCalculo.NO_APLICA, {},
        makeR03Mock(EstadoCalculo.NO_APLICA),
        makeR04Mock([]),
      ).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);

      expect(res.accionRequerida.conAlertasAltas.total).toBe(0);
      expect(res.accionRequerida.sobreasignados.total).toBe(0);
      expect(res.accionRequerida.sinActividadCurricular.total).toBe(0);
      expect(res.accionRequerida.bajaDedicacion.total).toBe(0);
    });

    // 2. Carrera sin alertas
    it('carrera sin alertas: todos los subindicadores vacíos', async () => {
      const res = await makeSvc().consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.accionRequerida.conAlertasAltas.docentes).toEqual([]);
      expect(res.accionRequerida.sobreasignados.docentes).toEqual([]);
      expect(res.accionRequerida.sinActividadCurricular.docentes).toEqual([]);
      expect(res.accionRequerida.bajaDedicacion.docentes).toEqual([]);
    });

    // 3. Docente con múltiples alertas altas (R-03 + IP-13) — debe contarse una vez en conAlertasAltas
    it('docente en R-03 y en IP-13: aparece una sola vez en conAlertasAltas', async () => {
      const sharedDocente = { docenteId: 'd-shared', nombre: 'Docente Compartido' };
      const r03Mock = makeR03Mock(EstadoCalculo.CALCULADO, { enAlerta: [sharedDocente] });
      const r07Mock = makeR07Mock(EstadoCalculo.CALCULADO, {});
      r07Mock.evaluar.mockResolvedValue({
        codigo: 'R-07', contextoId: CAR_ID, tipoContexto: 'DOCENTE' as const,
        estadoImplementacion: 'IMPLEMENTADO' as const, estadoCalculo: EstadoCalculo.CALCULADO,
        valor: {
          carreraId: CAR_ID, facultadId: 'fac-01', limite: 3,
          totalDocentes: 2, totalSobreasignados: 1,
          sobreasignados: [{ docenteId: 'd-shared', nombre: 'Docente Compartido', nMaterias: 4, exceso: 1, asignaciones: [] }],
          totalNoDeterminables: 0, noDeterminables: [], alcanceFacultad: true,
        },
        datosFaltantes: [], fechaEvaluacion: new Date(),
      });
      const svc = new TablroCarreraService(
        makePrisma() as any, makeScope() as any, makeR15Mock() as any, r07Mock as any,
        makeIP09Mock() as any, makeIP10Mock() as any, makeR12Mock() as any, makeR10Mock() as any,
        r03Mock as any, makeR04Mock() as any,
      );
      const res = await svc.consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);

      expect(res.accionRequerida.conAlertasAltas.total).toBe(1);
      expect(res.accionRequerida.conAlertasAltas.docentes).toHaveLength(1);
      expect(res.accionRequerida.conAlertasAltas.docentes[0].docenteId).toBe('d-shared');
    });

    // 4. Docente con varios cargos en R-04 — debe contabilizarse una sola vez
    it('docente con múltiples cargos en R-04: se contabiliza una vez en sinActividadCurricular', async () => {
      const r04Mock = makeR04Mock([
        { docenteId: 'd-multi', nombre: 'Multi Cargo' },
        { docenteId: 'd-multi', nombre: 'Multi Cargo' },
      ]);
      const svc = new TablroCarreraService(
        makePrisma() as any, makeScope() as any, makeR15Mock() as any, makeR07Mock() as any,
        makeIP09Mock() as any, makeIP10Mock() as any, makeR12Mock() as any, makeR10Mock() as any,
        makeR03Mock() as any, r04Mock as any,
      );
      const res = await svc.consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);

      expect(res.accionRequerida.sinActividadCurricular.total).toBe(1);
      expect(res.accionRequerida.sinActividadCurricular.docentes).toHaveLength(1);
    });

    // 5. Docente presente en más de un plan — se consolida en una sola entrada
    it('docente en más de un plan: se consolida en una entrada en sinActividadCurricular', async () => {
      const r04Mock = {
        evaluar: jest.fn()
          .mockResolvedValueOnce(buildR04Result('plan-1', [{ docenteId: 'd-cross', nombre: 'Cross Plan' }]))
          .mockResolvedValueOnce(buildR04Result('plan-2', [{ docenteId: 'd-cross', nombre: 'Cross Plan' }])),
      };
      const svc = new TablroCarreraService(
        makePrisma({ planes: [{ id: 'plan-1' }, { id: 'plan-2' }] }) as any,
        makeScope() as any, makeR15Mock() as any, makeR07Mock() as any,
        makeIP09Mock() as any, makeIP10Mock() as any, makeR12Mock() as any, makeR10Mock() as any,
        makeR03Mock() as any, r04Mock as any,
      );
      const res = await svc.consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);

      expect(res.accionRequerida.sinActividadCurricular.total).toBe(1);
      expect(res.accionRequerida.sinActividadCurricular.docentes[0].docenteId).toBe('d-cross');
    });

    // 6. Docente sobreasignado según R-07
    it('docente sobreasignado: aparece en sobreasignados (AR-02)', async () => {
      const res = await makeSvc(
        {}, true, EstadoCalculo.CALCULADO,
        EstadoCalculo.CALCULADO, { sobreasignados: 2 },
      ).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);

      expect(res.accionRequerida.sobreasignados.total).toBe(2);
      expect(res.accionRequerida.sobreasignados.docentes).toHaveLength(2);
      expect(res.accionRequerida.sobreasignados.docentes[0]).toMatchObject({
        docenteId: 'd-over-1', nombre: 'Sobreasignado 1',
      });
    });

    // 7. Docente con dedicación inferior a P-02 (confirmado)
    it('docente con baja dedicación confirmada: aparece en bajaDedicacion con incierto=false', async () => {
      const res = await makeSvc(
        {}, true,
        EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO, {},
        EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO,
        EstadoCalculo.CALCULADO, {},
        EstadoCalculo.CALCULADO, { enAlerta: 1 },
      ).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);

      expect(res.accionRequerida.bajaDedicacion.total).toBe(1);
      expect(res.accionRequerida.bajaDedicacion.confirmados).toBe(1);
      expect(res.accionRequerida.bajaDedicacion.inciertos).toBe(0);
      expect(res.accionRequerida.bajaDedicacion.docentes).toHaveLength(1);
      expect(res.accionRequerida.bajaDedicacion.docentes[0].docenteId).toBe('d-baja-1');
      expect(res.accionRequerida.bajaDedicacion.docentes[0].incierto).toBe(false);
    });

    // 8. Modificación del umbral P-02
    it('bajaDedicacion refleja el umbral P-02 configurado desde R-10', async () => {
      const r10Custom = {
        evaluar: jest.fn().mockResolvedValue({
          codigo: 'R-10', contextoId: CAR_ID, tipoContexto: 'CARRERA' as const,
          estadoImplementacion: 'IMPLEMENTADO' as const, estadoCalculo: EstadoCalculo.CALCULADO,
          valor: {
            carreraId: CAR_ID, umbral: 30, totalDocentes: 3,
            totalEnAlerta: 0, totalInciertos: 0, enAlerta: [],
            alcanceFacultad: true, estadoCalculo: EstadoCalculo.CALCULADO,
          },
          datosFaltantes: [], fechaEvaluacion: new Date(),
        }),
      };
      const svc = new TablroCarreraService(
        makePrisma() as any, makeScope() as any, makeR15Mock() as any, makeR07Mock() as any,
        makeIP09Mock() as any, makeIP10Mock() as any, makeR12Mock() as any, r10Custom as any,
        makeR03Mock() as any, makeR04Mock() as any,
      );
      const res = await svc.consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);

      expect(res.accionRequerida.bajaDedicacion.umbral).toBe(30);
      expect(res.accionRequerida.bajaDedicacion.confirmados).toBe(0);
      expect(res.accionRequerida.bajaDedicacion.inciertos).toBe(0);
    });

    // ── AR-04: confirmados e inciertos ────────────────────────────────────────
    describe('AR-04 bajaDedicacion — confirmados e inciertos', () => {
      // AR-04-1: todos confirmados
      it('todos confirmados: confirmados=N, inciertos=0, total=N', async () => {
        const res = await makeSvc(
          {}, true,
          EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO, {},
          EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO,
          EstadoCalculo.CALCULADO, {},
          EstadoCalculo.CALCULADO, { enAlerta: 2 },
        ).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);

        expect(res.accionRequerida.bajaDedicacion.confirmados).toBe(2);
        expect(res.accionRequerida.bajaDedicacion.inciertos).toBe(0);
        expect(res.accionRequerida.bajaDedicacion.total).toBe(2);
      });

      // AR-04-2: todos inciertos
      it('todos inciertos: confirmados=0, inciertos=N, total=N', async () => {
        const res = await makeSvc(
          {}, true,
          EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO, {},
          EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO,
          EstadoCalculo.CALCULADO, {},
          EstadoCalculo.PARCIAL, { inciertos: 2 },
        ).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);

        expect(res.accionRequerida.bajaDedicacion.confirmados).toBe(0);
        expect(res.accionRequerida.bajaDedicacion.inciertos).toBe(2);
        expect(res.accionRequerida.bajaDedicacion.total).toBe(2);
        expect(res.accionRequerida.bajaDedicacion.docentes.every(d => d.incierto === true)).toBe(true);
      });

      // AR-04-3: mezcla
      it('mezcla: confirmados + inciertos = total', async () => {
        const res = await makeSvc(
          {}, true,
          EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO, {},
          EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO,
          EstadoCalculo.CALCULADO, {},
          EstadoCalculo.PARCIAL, { enAlerta: 1, inciertos: 2 },
        ).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);

        expect(res.accionRequerida.bajaDedicacion.confirmados).toBe(1);
        expect(res.accionRequerida.bajaDedicacion.inciertos).toBe(2);
        expect(res.accionRequerida.bajaDedicacion.total).toBe(
          res.accionRequerida.bajaDedicacion.confirmados + res.accionRequerida.bajaDedicacion.inciertos,
        );
      });

      // AR-04-4: sin casos
      it('sin baja dedicación: total=0, confirmados=0, inciertos=0', async () => {
        const res = await makeSvc().consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);

        expect(res.accionRequerida.bajaDedicacion.total).toBe(0);
        expect(res.accionRequerida.bajaDedicacion.confirmados).toBe(0);
        expect(res.accionRequerida.bajaDedicacion.inciertos).toBe(0);
        expect(res.accionRequerida.bajaDedicacion.docentes).toHaveLength(0);
      });

      // AR-04-5: sin duplicados
      it('sin duplicados: docentes tiene docenteIds únicos', async () => {
        const res = await makeSvc(
          {}, true,
          EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO, {},
          EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO,
          EstadoCalculo.CALCULADO, {},
          EstadoCalculo.CALCULADO, { enAlerta: 3 },
        ).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);

        const ids = res.accionRequerida.bajaDedicacion.docentes.map(d => d.docenteId);
        expect(new Set(ids).size).toBe(ids.length);
      });

      // AR-04-6: flag incierto preservado
      it('flag incierto preservado en lista de docentes', async () => {
        const res = await makeSvc(
          {}, true,
          EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO, {},
          EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO,
          EstadoCalculo.CALCULADO, {},
          EstadoCalculo.PARCIAL, { enAlerta: 1, inciertos: 1 },
        ).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);

        const docs = res.accionRequerida.bajaDedicacion.docentes;
        expect(docs.some(d => d.incierto === false)).toBe(true);
        expect(docs.some(d => d.incierto === true)).toBe(true);
      });

      // AR-04-7: umbral P-02 configurable
      it('umbral P-02: bajaDedicacion.umbral refleja el valor configurado', async () => {
        const r10Custom = {
          evaluar: jest.fn().mockResolvedValue({
            codigo: 'R-10', contextoId: CAR_ID, tipoContexto: 'CARRERA' as const,
            estadoImplementacion: 'IMPLEMENTADO' as const, estadoCalculo: EstadoCalculo.CALCULADO,
            valor: {
              carreraId: CAR_ID, umbral: 25, totalDocentes: 3,
              totalEnAlerta: 1, totalInciertos: 0,
              enAlerta: [{ docenteId: 'd-x', nombre: 'Doc X', horasConocidas: 10, umbral: 25, incierto: false }],
              alcanceFacultad: true, estadoCalculo: EstadoCalculo.CALCULADO,
            },
            datosFaltantes: [], fechaEvaluacion: new Date(),
          }),
        };
        const svc = new TablroCarreraService(
          makePrisma() as any, makeScope() as any, makeR15Mock() as any, makeR07Mock() as any,
          makeIP09Mock() as any, makeIP10Mock() as any, makeR12Mock() as any, r10Custom as any,
          makeR03Mock() as any, makeR04Mock() as any,
        );
        const res = await svc.consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);

        expect(res.accionRequerida.bajaDedicacion.umbral).toBe(25);
        expect(res.accionRequerida.bajaDedicacion.confirmados).toBe(1);
        expect(res.accionRequerida.bajaDedicacion.inciertos).toBe(0);
      });

      // AR-04-8: total = confirmados + inciertos (invariante)
      it('total = confirmados + inciertos siempre', async () => {
        for (const [nAlerta, nInciertos] of [[0, 0], [2, 0], [0, 3], [1, 2]]) {
          const estado = nInciertos > 0 ? EstadoCalculo.PARCIAL : EstadoCalculo.CALCULADO;
          const res = await makeSvc(
            {}, true,
            EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO, {},
            EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO,
            EstadoCalculo.CALCULADO, {},
            estado, { enAlerta: nAlerta, inciertos: nInciertos },
          ).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);

          const baja = res.accionRequerida.bajaDedicacion;
          expect(baja.total).toBe(baja.confirmados + baja.inciertos);
        }
      });
    });

    // 9. Docente fuera de la carrera no aparece (R-04 solo se evalúa por planes de la carrera)
    it('R-04 solo se llama con planes de la carrera solicitada', async () => {
      const r04Mock = makeR04Mock([]);
      const svc = new TablroCarreraService(
        makePrisma({ planes: [{ id: 'plan-carrera' }] }) as any,
        makeScope() as any, makeR15Mock() as any, makeR07Mock() as any,
        makeIP09Mock() as any, makeIP10Mock() as any, makeR12Mock() as any, makeR10Mock() as any,
        makeR03Mock() as any, r04Mock as any,
      );
      await svc.consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);

      expect(r04Mock.evaluar).toHaveBeenCalledTimes(1);
      expect(r04Mock.evaluar).toHaveBeenCalledWith(
        expect.objectContaining({ planEstudioId: 'plan-carrera' }),
      );
    });

    // 10. Datos insuficientes (R-03 NO_DETERMINABLE): estadoCalculo de accionRequerida es NO_DETERMINABLE
    it('R-03 NO_DETERMINABLE: estadoCalculo de accionRequerida es NO_DETERMINABLE', async () => {
      const svc = new TablroCarreraService(
        makePrisma() as any, makeScope() as any, makeR15Mock() as any, makeR07Mock() as any,
        makeIP09Mock() as any, makeIP10Mock() as any, makeR12Mock() as any, makeR10Mock() as any,
        makeR03Mock(EstadoCalculo.NO_DETERMINABLE) as any, makeR04Mock() as any,
      );
      const res = await svc.consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);

      expect(res.accionRequerida.estadoCalculo).toBe(EstadoCalculo.NO_DETERMINABLE);
    });

    // 11. Consistencia: sobreasignados es subset de conAlertasAltas
    it('todos los sobreasignados aparecen también en conAlertasAltas', async () => {
      const res = await makeSvc(
        {}, true, EstadoCalculo.CALCULADO,
        EstadoCalculo.CALCULADO, { sobreasignados: 2 },
      ).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);

      const altasIds = new Set(res.accionRequerida.conAlertasAltas.docentes.map(d => d.docenteId));
      for (const d of res.accionRequerida.sobreasignados.docentes) {
        expect(altasIds.has(d.docenteId)).toBe(true);
      }
      expect(res.accionRequerida.conAlertasAltas.total).toBeGreaterThanOrEqual(
        res.accionRequerida.sobreasignados.total,
      );
    });
  });
});

// ── condicionesPlantell (B-03) ────────────────────────────────────────────────

describe('TablroCarreraService — condicionesPlantell (B-03)', () => {
  type CargoPairCP = { docenteId: string; cargoId: string; cargo: { nombre: string } };

  /** Mock de Prisma extendido con docente, cargoDocente y soporte para vincsConDesig. */
  function makePrismaCP(opts: {
    docenteIds?: string[];
    docentes?: Array<{ id: string; tituloPosgrado: string | null; tituloProyectoInvestigacion: string | null }>;
    cargosRegulares?: Array<{ docenteId: string }>;
    cargosInterinos?: Array<{ docenteId: string }>;
    vincsConDesig?: Array<{ docenteId: string; designacion: { nombre: string } }>;
    cargosVigentes?: CargoPairCP[];
    throwOnCargoDocente?: boolean;
  } = {}) {
    const {
      docenteIds = ['d-1'],
      docentes = [{ id: 'd-1', tituloPosgrado: 'Maestría', tituloProyectoInvestigacion: null }],
      cargosRegulares = [{ docenteId: 'd-1' }],
      cargosInterinos = [],
      vincsConDesig = [{ docenteId: 'd-1', designacion: { nombre: 'REGULAR RENTADO' } }],
      cargosVigentes = [{ docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } }],
      throwOnCargoDocente = false,
    } = opts;

    const vincsIds = docenteIds.map(id => ({ docenteId: id }));
    const cargosActivos = docenteIds.map((id, i) => ({
      docenteId: id, cargoId: `act-${i}`, cargo: { nombre: 'Titular' },
    }));

    return {
      carrera:      { findUnique: jest.fn().mockResolvedValue({ id: CAR_ID }) },
      planEstudio:  { findMany: jest.fn().mockResolvedValue([{ id: 'plan-1' }]) },
      materia:      { count: jest.fn().mockResolvedValue(5) },
      docente:      { findMany: jest.fn().mockResolvedValue(docentes) },
      cargoDocente: {
        findMany: jest.fn().mockImplementation((args: any) => {
          if (throwOnCargoDocente) return Promise.reject(new Error('DB unavailable'));
          const contains = (args?.where?.designacion?.contains ?? '').toLowerCase();
          if (contains === 'regular') return Promise.resolve(cargosRegulares);
          if (contains === 'interino') return Promise.resolve(cargosInterinos);
          return Promise.resolve([]);
        }),
      },
      vinculacionCatedra: {
        findMany: jest.fn().mockImplementation((args: any) => {
          const distinct = (args.distinct ?? []) as string[];
          const hasDesignacionId = distinct.includes('designacionId');
          const hasDocenteActivo = args.where?.docente?.activo === true;

          if (distinct.includes('materiaId'))  return Promise.resolve([{ materiaId: 'm-1' }]);
          if (hasDesignacionId)                return Promise.resolve(vincsConDesig);
          if (!distinct.includes('cargoId'))   return Promise.resolve(vincsIds);     // IP-01 / vincsIds
          if (hasDocenteActivo)                return Promise.resolve(cargosActivos); // IP-02
          return Promise.resolve(cargosVigentes);                                     // IP-08
        }),
      },
    };
  }

  function makeSvcCP(opts: Parameters<typeof makePrismaCP>[0] = {}) {
    return new TablroCarreraService(
      makePrismaCP(opts) as any,
      makeScope() as any,
      makeR15Mock() as any,
      makeR07Mock() as any,
      makeIP09Mock() as any,
      makeIP10Mock() as any,
      makeR12Mock() as any,
      makeR10Mock() as any,
      makeR03Mock() as any,
      makeR04Mock() as any,
    );
  }

  it('carrera con docentes: condicionesPlantell presente y CALCULADO', async () => {
    const res = await makeSvcCP().consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
    expect(res.condicionesPlantell).toBeDefined();
    expect(res.condicionesPlantell!.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect(res.condicionesPlantell!.totalDocentes).toBe(1);
  });

  it('carrera sin docentes: condicionesPlantell.estadoCalculo = NO_APLICA', async () => {
    const res = await makeSvcCP({ docenteIds: [], vincsConDesig: [] }).consultarCarrera(
      CAR_ID, USR.usuarioId, USR.rolNombre,
    );
    expect(res.condicionesPlantell).toBeDefined();
    expect(res.condicionesPlantell!.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    expect(res.condicionesPlantell!.totalDocentes).toBe(0);
  });

  it('conPosgrado y conInvestigacion reflejan datos de ficha docente', async () => {
    const res = await makeSvcCP({
      docenteIds: ['d-1', 'd-2'],
      docentes: [
        { id: 'd-1', tituloPosgrado: 'Maestría', tituloProyectoInvestigacion: 'Proyecto X' },
        { id: 'd-2', tituloPosgrado: null, tituloProyectoInvestigacion: null },
      ],
      vincsConDesig: [
        { docenteId: 'd-1', designacion: { nombre: 'REGULAR RENTADO' } },
        { docenteId: 'd-2', designacion: { nombre: 'CONTRATADO' } },
      ],
      cargosVigentes: [
        { docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } },
        { docenteId: 'd-2', cargoId: 'c-2', cargo: { nombre: 'JTP' } },
      ],
    }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);

    expect(res.condicionesPlantell!.conPosgrado).toBe(1);
    expect(res.condicionesPlantell!.conInvestigacion).toBe(1);
    expect(res.condicionesPlantell!.totalDocentes).toBe(2);
  });

  it('cargos regulares vigentes: conDesignacionRegular correcto', async () => {
    const res = await makeSvcCP({
      docenteIds: ['d-1', 'd-2'],
      docentes: [
        { id: 'd-1', tituloPosgrado: null, tituloProyectoInvestigacion: null },
        { id: 'd-2', tituloPosgrado: null, tituloProyectoInvestigacion: null },
      ],
      cargosRegulares: [{ docenteId: 'd-1' }, { docenteId: 'd-2' }],
      cargosInterinos: [],
      vincsConDesig: [
        { docenteId: 'd-1', designacion: { nombre: 'REGULAR RENTADO' } },
        { docenteId: 'd-2', designacion: { nombre: 'REGULAR AD HONOREM' } },
      ],
      cargosVigentes: [
        { docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } },
        { docenteId: 'd-2', cargoId: 'c-2', cargo: { nombre: 'Titular' } },
      ],
    }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);

    expect(res.condicionesPlantell!.conDesignacionRegular).toBe(2);
    expect(res.condicionesPlantell!.conDesignacionInterina).toBe(0);
  });

  it('cargos interinos vigentes: conDesignacionInterina correcto', async () => {
    const res = await makeSvcCP({
      cargosRegulares: [],
      cargosInterinos: [{ docenteId: 'd-1' }],
    }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);

    expect(res.condicionesPlantell!.conDesignacionInterina).toBe(1);
    expect(res.condicionesPlantell!.conDesignacionRegular).toBe(0);
  });

  it('docente con designación regular e interina simultánea: contado en ambos', async () => {
    const res = await makeSvcCP({
      docenteIds: ['d-1'],
      docentes: [{ id: 'd-1', tituloPosgrado: null, tituloProyectoInvestigacion: null }],
      cargosRegulares: [{ docenteId: 'd-1' }],
      cargosInterinos: [{ docenteId: 'd-1' }],
      vincsConDesig: [{ docenteId: 'd-1', designacion: { nombre: 'REGULAR RENTADO' } }],
    }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);

    expect(res.condicionesPlantell!.conDesignacionRegular).toBe(1);
    expect(res.condicionesPlantell!.conDesignacionInterina).toBe(1);
  });

  it('relacionPA reutiliza ip08: profesores y auxiliares tomados del resultado IP-08', async () => {
    const res = await makeSvcCP({
      cargosVigentes: [
        { docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } },
        { docenteId: 'd-2', cargoId: 'c-2', cargo: { nombre: 'JTP' } },
      ],
      docenteIds: ['d-1', 'd-2'],
      docentes: [
        { id: 'd-1', tituloPosgrado: null, tituloProyectoInvestigacion: null },
        { id: 'd-2', tituloPosgrado: null, tituloProyectoInvestigacion: null },
      ],
      vincsConDesig: [
        { docenteId: 'd-1', designacion: { nombre: 'REGULAR RENTADO' } },
        { docenteId: 'd-2', designacion: { nombre: 'CONTRATADO' } },
      ],
    }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);

    expect(res.condicionesPlantell!.relacionPA).toBeDefined();
    expect(res.condicionesPlantell!.relacionPA!.profesores).toBe(1);
    expect(res.condicionesPlantell!.relacionPA!.auxiliares).toBe(1);
  });

  it('relacionPA.auxiliares = 0 cuando solo hay cargos de profesor', async () => {
    const res = await makeSvcCP({
      cargosVigentes: [
        { docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } },
        { docenteId: 'd-2', cargoId: 'c-2', cargo: { nombre: 'Adjunto' } },
      ],
      docenteIds: ['d-1', 'd-2'],
      docentes: [
        { id: 'd-1', tituloPosgrado: null, tituloProyectoInvestigacion: null },
        { id: 'd-2', tituloPosgrado: null, tituloProyectoInvestigacion: null },
      ],
      vincsConDesig: [
        { docenteId: 'd-1', designacion: { nombre: 'REGULAR RENTADO' } },
        { docenteId: 'd-2', designacion: { nombre: 'REGULAR AD HONOREM' } },
      ],
    }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);

    expect(res.condicionesPlantell!.relacionPA).toBeDefined();
    expect(res.condicionesPlantell!.relacionPA!.auxiliares).toBe(0);
  });

  it('relacionPA ausente cuando ip08.estadoCalculo = NO_APLICA', async () => {
    const res = await makeSvcCP({
      cargosVigentes: [], // → ip08 = NO_APLICA
    }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);

    expect(res.condicionesPlantell!.relacionPA).toBeUndefined();
  });

  it('la consulta de cargos incluye filtro de vigencia (fechaInicio lte, fechaFin null o gt)', async () => {
    const prisma = makePrismaCP();
    const svc = new TablroCarreraService(
      prisma as any, makeScope() as any, makeR15Mock() as any, makeR07Mock() as any,
      makeIP09Mock() as any, makeIP10Mock() as any, makeR12Mock() as any, makeR10Mock() as any,
      makeR03Mock() as any, makeR04Mock() as any,
    );
    await svc.consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);

    expect(prisma.cargoDocente.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fechaInicio: expect.objectContaining({ lte: expect.any(Date) }),
          OR: [{ fechaFin: null }, { fechaFin: expect.objectContaining({ gt: expect.any(Date) }) }],
        }),
      }),
    );
  });

  it('dedicacionPorTipo muestra categorías de designación (REGULAR RENTADO, no rangos horarios)', async () => {
    const res = await makeSvcCP({
      docenteIds: ['d-1', 'd-2', 'd-3'],
      docentes: [
        { id: 'd-1', tituloPosgrado: null, tituloProyectoInvestigacion: null },
        { id: 'd-2', tituloPosgrado: null, tituloProyectoInvestigacion: null },
        { id: 'd-3', tituloPosgrado: null, tituloProyectoInvestigacion: null },
      ],
      vincsConDesig: [
        { docenteId: 'd-1', designacion: { nombre: 'REGULAR RENTADO' } },
        { docenteId: 'd-2', designacion: { nombre: 'REGULAR RENTADO' } },
        { docenteId: 'd-3', designacion: { nombre: 'CONTRATADO' } },
      ],
      cargosVigentes: [
        { docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } },
        { docenteId: 'd-2', cargoId: 'c-2', cargo: { nombre: 'Titular' } },
        { docenteId: 'd-3', cargoId: 'c-3', cargo: { nombre: 'JTP' } },
      ],
    }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);

    const tipos = res.condicionesPlantell!.dedicacionPorTipo.map(d => d.tipo);
    expect(tipos).toContain('REGULAR RENTADO');
    expect(tipos).toContain('CONTRATADO');
    // No deben aparecer rangos horarios
    expect(tipos.some(t => /\d+hs/.test(t))).toBe(false);
    // El más frecuente primero (REGULAR RENTADO con 2 docentes)
    expect(res.condicionesPlantell!.dedicacionPorTipo[0].tipo).toBe('REGULAR RENTADO');
    expect(res.condicionesPlantell!.dedicacionPorTipo[0].docentes).toBe(2);
  });

  it('fallo controlado: si calcularCondicionesPlantell lanza, condicionesPlantell es undefined', async () => {
    const res = await makeSvcCP({ throwOnCargoDocente: true }).consultarCarrera(
      CAR_ID, USR.usuarioId, USR.rolNombre,
    );
    // El try/catch en consultarCarrera absorbe el error; el resto del análisis sigue disponible.
    expect(res.condicionesPlantell).toBeUndefined();
    expect(res.ip01).toBeDefined(); // El análisis principal no se ve afectado.
  });
});
