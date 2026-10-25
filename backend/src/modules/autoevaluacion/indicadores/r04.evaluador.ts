import { BadRequestException, Injectable } from '@nestjs/common';
import { ConsultasAcademicasService } from '../consultas-academicas/consultas-academicas.service';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type {
  ContextoEvaluacion,
  DatoFaltante,
  IndicadorEvaluador,
  ResultadoIndicador,
} from './indicadores.types';

// ── Tipos de resultado ────────────────────────────────────────────────────────

export interface CargoSinActividadR04 {
  docenteId: string;
  nombre: string;
  cargoDocenteId: string;
  cargoNombre: string;
  designacion: string | null;
  fechaInicio: Date;
  fechaFin: Date | null;
  verificado: boolean;
}

export interface ResultadoR04 {
  planEstudioId: string;
  carreraId: string;
  fechaCalculo: Date;
  totalDocentesPlantel: number;
  cargosEnAlerta: CargoSinActividadR04[];
  totalCargosEnAlerta: number;
  /** Docentes cuyos TODOS los cargos vigentes carecen de actividad curricular en el plan.
   *  Sus alertas son visibles pero no penalizan IP-10 (excepción C4). */
  docentesExceptuadosPorC4: string[];
}

// ── Constante de dato faltante ────────────────────────────────────────────────

const DP_CARGO_NO_VERIFICADO: DatoFaltante = {
  campo: 'verificado',
  entidad: 'CargoDocente',
  descripcion:
    'Uno o más cargos vigentes sin actividad curricular no han sido verificados por secretaría. ' +
    'La alerta puede corresponder a datos no confirmados.',
};

// ── Evaluador ─────────────────────────────────────────────────────────────────

@Injectable()
export class R04EvaluadorService implements IndicadorEvaluador<ResultadoR04> {
  constructor(private readonly consultas: ConsultasAcademicasService) {}

  async evaluar(contexto: ContextoEvaluacion): Promise<ResultadoIndicador<ResultadoR04>> {
    if (!contexto.planEstudioId) {
      throw new BadRequestException('R-04 requiere planEstudioId en el contexto de evaluación.');
    }

    const data = await this.consultas.obtenerCargosParaR04(
      contexto.planEstudioId,
      contexto.fechaEvaluacion,
      contexto.usuarioId,
      contexto.rolNombre,
    );

    if (data.docentes.length === 0) {
      return this.buildResultado(
        contexto,
        {
          planEstudioId: data.planEstudioId,
          carreraId: data.carreraId,
          fechaCalculo: contexto.fechaEvaluacion,
          totalDocentesPlantel: 0,
          cargosEnAlerta: [],
          totalCargosEnAlerta: 0,
          docentesExceptuadosPorC4: [],
        },
        EstadoCalculo.NO_APLICA,
        [],
      );
    }

    const cargosEnAlerta: CargoSinActividadR04[] = [];
    const docentesConActividad = new Set<string>();
    let hayCargoNoVerificado = false;

    for (const docente of data.docentes) {
      const nombre = `${docente.nombre} ${docente.apellido}`.trim();
      for (const cargo of docente.cargosVigentes) {
        if (cargo.tieneActividadEnPlan) {
          docentesConActividad.add(docente.docenteId);
        } else {
          cargosEnAlerta.push({
            docenteId: docente.docenteId,
            nombre,
            cargoDocenteId: cargo.cargoDocenteId,
            cargoNombre: cargo.cargoNombre,
            designacion: cargo.designacion,
            fechaInicio: cargo.fechaInicio,
            fechaFin: cargo.fechaFin,
            verificado: cargo.verificado,
          });
          if (!cargo.verificado) hayCargoNoVerificado = true;
        }
      }
    }

    cargosEnAlerta.sort(
      (a, b) => a.nombre.localeCompare(b.nombre) || a.cargoNombre.localeCompare(b.cargoNombre),
    );

    const docentesConAlertas = new Set(cargosEnAlerta.map(c => c.docenteId));
    const docentesExceptuadosPorC4 = [...docentesConAlertas]
      .filter(id => !docentesConActividad.has(id))
      .sort();

    const estadoCalculo = hayCargoNoVerificado ? EstadoCalculo.PARCIAL : EstadoCalculo.CALCULADO;

    return this.buildResultado(
      contexto,
      {
        planEstudioId: data.planEstudioId,
        carreraId: data.carreraId,
        fechaCalculo: contexto.fechaEvaluacion,
        totalDocentesPlantel: data.docentes.length,
        cargosEnAlerta,
        totalCargosEnAlerta: cargosEnAlerta.length,
        docentesExceptuadosPorC4,
      },
      estadoCalculo,
      hayCargoNoVerificado ? [DP_CARGO_NO_VERIFICADO] : [],
    );
  }

  private buildResultado(
    contexto: ContextoEvaluacion,
    valor: ResultadoR04,
    estadoCalculo: EstadoCalculo,
    datosFaltantes: DatoFaltante[],
  ): ResultadoIndicador<ResultadoR04> {
    return {
      codigo: 'R-04',
      contextoId: contexto.planEstudioId!,
      tipoContexto: 'DOCENTE',
      estadoImplementacion: 'IMPLEMENTADO',
      estadoCalculo,
      valor,
      datosFaltantes,
      fechaEvaluacion: contexto.fechaEvaluacion,
    };
  }
}
