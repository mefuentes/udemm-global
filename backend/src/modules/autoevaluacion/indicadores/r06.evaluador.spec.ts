import { BadRequestException } from '@nestjs/common';
import { EstadoCalculo } from '../types/estado-calculo.types';
import { R06EvaluadorService } from './r06.evaluador';
import type { ContextoEvaluacion } from './indicadores.types';
import type { VinculacionesParaR07 } from '../consultas-academicas/consultas-academicas.types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeContexto(overrides: Partial<ContextoEvaluacion> = {}): ContextoEvaluacion {
  return {
    usuarioId: 'u-1',
    rolNombre: 'ADMINISTRADOR_SISTEMA',
    carreraId: 'car-1',
    fechaEvaluacion: new Date('2026-01-01'),
    ...overrides,
  } as ContextoEvaluacion;
}

function makeVinc(
  docenteId: string,
  materiaId: string,
  carreraId = 'car-1',
  estado = 'APROBADA',
): VinculacionesParaR07['vinculaciones'][number] {
  return {
    id: `${docenteId}-${materiaId}`,
    materiaId,
    docenteId,
    catedraId: `cat-${materiaId}`,
    planEstudioId: `plan-${carreraId}`,
    carreraId,
    estado,
    esResponsableCatedra: null,
    horasSemana: null,
    docente: {
      id: docenteId,
      nombre: `Nombre${docenteId}`,
      apellido: `Apellido${docenteId}`,
      activo: true,
      dedicacion: null,
      categoriaDocente: null,
    },
  };
}

function makeConsultas(result: VinculacionesParaR07) {
  return {
    obtenerVinculacionesParaR06: jest.fn().mockResolvedValue(result),
  } as any;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('R06EvaluadorService', () => {
  describe('sin carreraId en contexto', () => {
    it('lanza BadRequestException', async () => {
      const svc = new R06EvaluadorService({} as any);
      await expect(
        svc.evaluar(makeContexto({ carreraId: undefined })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('sin vinculaciones APROBADAS', () => {
    it('devuelve NO_APLICA con distribucion vacía', async () => {
      const result = await new R06EvaluadorService(
        makeConsultas({
          vinculaciones: [],
          facultadId: 'fac-1',
          alcanceFacultad: true,
          docentesMultiFacultad: new Set(),
        }),
      ).evaluar(makeContexto());

      expect(result.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
      expect(result.valor!.totalDocentes).toBe(0);
      expect(result.valor!.distribucion).toHaveLength(0);
      expect(result.valor!.alcanceFacultad).toBe(true);
    });
  });

  describe('alcanceFacultad=true (roles globales / DECANO)', () => {
    it('agrega materias de una sola carrera', async () => {
      const vinculaciones = [
        makeVinc('d1', 'm1'),
        makeVinc('d1', 'm2'),
        makeVinc('d2', 'm3'),
      ];
      const result = await new R06EvaluadorService(
        makeConsultas({
          vinculaciones,
          facultadId: 'fac-1',
          alcanceFacultad: true,
          docentesMultiFacultad: new Set(),
        }),
      ).evaluar(makeContexto());

      expect(result.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(result.estadoImplementacion).toBe('IMPLEMENTADO');
      expect(result.tipoContexto).toBe('FACULTAD');
      expect(result.contextoId).toBe('fac-1');
      expect(result.valor!.facultadId).toBe('fac-1');
      expect(result.valor!.alcanceFacultad).toBe(true);
      expect(result.valor!.carreraId).toBeUndefined();
      expect(result.valor!.totalDocentes).toBe(2);
      expect(result.valor!.maximo).toBe(2);
      expect(result.datosFaltantes).toHaveLength(0);
    });

    it('deduplica materias cross-carrera: mismo docente en dos carreras acumula materias de ambas', async () => {
      const vinculaciones = [
        makeVinc('d1', 'm1', 'car-1'), // docente d1 en carrera 1
        makeVinc('d1', 'm2', 'car-2'), // docente d1 en carrera 2
        makeVinc('d2', 'm3', 'car-1'),
      ];
      const result = await new R06EvaluadorService(
        makeConsultas({
          vinculaciones,
          facultadId: 'fac-1',
          alcanceFacultad: true,
          docentesMultiFacultad: new Set(),
        }),
      ).evaluar(makeContexto());

      expect(result.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(result.valor!.totalDocentes).toBe(2);

      const d1 = result.valor!.distribucion.find((d) => d.docenteId === 'd1');
      expect(d1?.nMaterias).toBe(2); // m1 + m2, ambas cuentan

      const d2 = result.valor!.distribucion.find((d) => d.docenteId === 'd2');
      expect(d2?.nMaterias).toBe(1);

      expect(result.valor!.maximo).toBe(2);
      expect(result.valor!.promedio).toBeCloseTo(1.5);
    });

    it('deduplica la misma materia en múltiples cátedras del mismo docente', async () => {
      // misma materiaId, dos vinculaciones para el mismo docente
      const vinculaciones = [
        makeVinc('d1', 'm1'),
        { ...makeVinc('d1', 'm1'), id: 'd1-m1-bis', catedraId: 'cat-otra' },
      ];
      const result = await new R06EvaluadorService(
        makeConsultas({
          vinculaciones,
          facultadId: 'fac-1',
          alcanceFacultad: true,
          docentesMultiFacultad: new Set(),
        }),
      ).evaluar(makeContexto());

      expect(result.valor!.totalDocentes).toBe(1);
      expect(result.valor!.distribucion[0].nMaterias).toBe(1); // dedup: m1 cuenta una vez
    });

    it('ignora vinculaciones no APROBADAS', async () => {
      const vinculaciones = [
        makeVinc('d1', 'm1', 'car-1', 'PENDIENTE_DE_APROBACION'),
        makeVinc('d2', 'm2', 'car-1', 'APROBADA'),
      ];
      const result = await new R06EvaluadorService(
        makeConsultas({
          vinculaciones,
          facultadId: 'fac-1',
          alcanceFacultad: true,
          docentesMultiFacultad: new Set(),
        }),
      ).evaluar(makeContexto());

      expect(result.valor!.totalDocentes).toBe(1);
      expect(result.valor!.distribucion[0].docenteId).toBe('d2');
    });

    it('ordena distribución por nMaterias DESC y luego nombre ASC', async () => {
      const vinculaciones = [
        makeVinc('d1', 'm1'),
        makeVinc('d2', 'm2'),
        makeVinc('d2', 'm3'),
      ];
      const result = await new R06EvaluadorService(
        makeConsultas({
          vinculaciones,
          facultadId: 'fac-1',
          alcanceFacultad: true,
          docentesMultiFacultad: new Set(),
        }),
      ).evaluar(makeContexto());

      const dist = result.valor!.distribucion;
      expect(dist[0].docenteId).toBe('d2'); // 2 materias → primero
      expect(dist[1].docenteId).toBe('d1'); // 1 materia → segundo
    });

    it('calcula estadísticas correctamente con 4 docentes', async () => {
      // nMats = [1, 2, 3, 4]
      const vinculaciones = [
        makeVinc('d1', 'm1'),
        makeVinc('d2', 'm2'), makeVinc('d2', 'm3'),
        makeVinc('d3', 'm4'), makeVinc('d3', 'm5'), makeVinc('d3', 'm6'),
        makeVinc('d4', 'm7'), makeVinc('d4', 'm8'), makeVinc('d4', 'm9'), makeVinc('d4', 'm10'),
      ];
      const result = await new R06EvaluadorService(
        makeConsultas({
          vinculaciones,
          facultadId: 'fac-1',
          alcanceFacultad: true,
          docentesMultiFacultad: new Set(),
        }),
      ).evaluar(makeContexto());

      expect(result.valor!.totalDocentes).toBe(4);
      expect(result.valor!.maximo).toBe(4);
      expect(result.valor!.promedio).toBeCloseTo(2.5);
      expect(result.valor!.mediana).toBeCloseTo(2.5); // (2+3)/2
    });
  });

  describe('alcanceFacultad=false (DIRECTOR_CARRERA)', () => {
    it('devuelve PARCIAL con carreraId y datosFaltantes', async () => {
      const vinculaciones = [makeVinc('d1', 'm1', 'car-1')];
      const result = await new R06EvaluadorService(
        makeConsultas({
          vinculaciones,
          facultadId: 'fac-1',
          alcanceFacultad: false,
          docentesMultiFacultad: new Set(),
        }),
      ).evaluar(makeContexto({ rolNombre: 'DIRECTOR_CARRERA', carreraId: 'car-1' }));

      expect(result.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
      expect(result.estadoImplementacion).toBe('IMPLEMENTADO');
      expect(result.valor!.alcanceFacultad).toBe(false);
      expect(result.valor!.carreraId).toBe('car-1');
      expect(result.valor!.facultadId).toBe('fac-1');
      expect(result.datosFaltantes).toHaveLength(1);
      expect(result.datosFaltantes[0].campo).toBe('carrerasRestantes');
    });

    it('PARCIAL con sin docentes devuelve NO_APLICA', async () => {
      const result = await new R06EvaluadorService(
        makeConsultas({
          vinculaciones: [],
          facultadId: 'fac-1',
          alcanceFacultad: false,
          docentesMultiFacultad: new Set(),
        }),
      ).evaluar(makeContexto({ rolNombre: 'DIRECTOR_CARRERA', carreraId: 'car-1' }));

      expect(result.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
      expect(result.valor!.carreraId).toBe('car-1');
      expect(result.datosFaltantes).toHaveLength(1);
    });
  });
});
