import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoCalculo } from '../types/estado-calculo.types';
import { IndicadoresService } from '../indicadores/indicadores.service';
import type { ResultadoR02 } from '../indicadores/r02.evaluador';
import type { ResultadoR08 } from '../indicadores/r08.evaluador';
import type { EvaluacionDimension, ResultadoR09 } from '../indicadores/r09.evaluador';
import type { ResultadoR11 } from '../indicadores/r11.evaluador';
import type { ResultadoR13 } from '../indicadores/r13.evaluador';
import type { ResultadoR14 } from '../indicadores/r14.evaluador';
import type { DatoFaltante, ResultadoIndicador } from '../indicadores/indicadores.types';
import type {
  EvaluacionBloqueIPL05,
  ResultadoIPL01,
  ResultadoIPL02,
  ResultadoIPL03,
  ResultadoIPL04,
  ResultadoIPL05,
  TablroPlanResponseDto,
} from './tablero-plan.dto';

const PESO_ESTADO: Record<EstadoCalculo, number> = {
  [EstadoCalculo.CALCULADO]: 1,
  [EstadoCalculo.NO_APLICA]: 2,
  [EstadoCalculo.PARCIAL]: 3,
  [EstadoCalculo.NO_DETERMINABLE]: 4,
};

function estadoMasRestrictivo(...estados: EstadoCalculo[]): EstadoCalculo {
  return estados.reduce((a, b) => (PESO_ESTADO[b] > PESO_ESTADO[a] ? b : a));
}

function estadoParaBloque(ev: EvaluacionDimension, r09Estado: EstadoCalculo): EstadoCalculo {
  if (r09Estado === EstadoCalculo.NO_APLICA) return EstadoCalculo.NO_APLICA;
  if (ev.horasMinimas === null) return EstadoCalculo.NO_APLICA;
  if (ev.horasReales === null) {
    return r09Estado === EstadoCalculo.NO_DETERMINABLE
      ? EstadoCalculo.NO_DETERMINABLE
      : EstadoCalculo.PARCIAL;
  }
  return EstadoCalculo.CALCULADO;
}

/**
 * Agrega los resultados de R-08 y R-09 en los cuatro indicadores por plan de estudios
 * definidos en FSD §8 Tabla 25: IPL-01, IPL-02, IPL-03 e IPL-05.
 *
 * La autorización se delega a IndicadoresService.evaluar(), que verifica rol y scope
 * antes de ejecutar los evaluadores. Los errores de autorización (ForbiddenException,
 * NotFoundException) se re-lanzan inmediatamente sin derivar indicadores parciales.
 */
@Injectable()
export class TablroPlanService {
  constructor(private readonly indicadores: IndicadoresService) {}

  async consultarPlan(
    planEstudioId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<TablroPlanResponseDto> {
    const fechaEvaluacion = new Date();
    const contexto = { usuarioId, rolNombre, planEstudioId, fechaEvaluacion };

    const [r02settled, r08settled, r09settled, r11settled, r13settled, r14settled] =
      await Promise.allSettled([
        this.indicadores.evaluar({ codigoIndicador: 'R-02', contexto }),
        this.indicadores.evaluar({ codigoIndicador: 'R-08', contexto }),
        this.indicadores.evaluar({ codigoIndicador: 'R-09', contexto }),
        this.indicadores.evaluar({ codigoIndicador: 'R-11', contexto }),
        this.indicadores.evaluar({ codigoIndicador: 'R-13', contexto }),
        this.indicadores.evaluar({ codigoIndicador: 'R-14', contexto }),
      ]);

    // Re-lanzar errores de autorización inmediatamente antes de derivar indicadores.
    for (const settled of [
      r02settled,
      r08settled,
      r09settled,
      r11settled,
      r13settled,
      r14settled,
    ]) {
      if (settled.status === 'rejected') {
        const err = settled.reason as Error;
        if (err instanceof ForbiddenException || err instanceof NotFoundException) throw err;
      }
    }

    const r02 =
      r02settled.status === 'fulfilled'
        ? (r02settled.value as ResultadoIndicador<ResultadoR02>)
        : null;
    const r08 =
      r08settled.status === 'fulfilled'
        ? (r08settled.value as ResultadoIndicador<ResultadoR08>)
        : null;
    const r09 =
      r09settled.status === 'fulfilled'
        ? (r09settled.value as ResultadoIndicador<ResultadoR09>)
        : null;
    const r11 =
      r11settled.status === 'fulfilled'
        ? (r11settled.value as ResultadoIndicador<ResultadoR11>)
        : null;
    const r13 =
      r13settled.status === 'fulfilled'
        ? (r13settled.value as ResultadoIndicador<ResultadoR13>)
        : null;
    const r14 =
      r14settled.status === 'fulfilled'
        ? (r14settled.value as ResultadoIndicador<ResultadoR14>)
        : null;

    const datosFaltantes: DatoFaltante[] = [
      ...(r02?.datosFaltantes ?? []),
      ...(r08?.datosFaltantes ?? []),
      ...(r09?.datosFaltantes ?? []),
      ...(r11?.datosFaltantes ?? []),
      ...(r13?.datosFaltantes ?? []),
      ...(r14?.datosFaltantes ?? []),
    ];
    const advertencias: string[] = [];

    const ipl01 = this.derivarIPL01(r09, advertencias);
    const ipl02 = this.derivarIPL02(r09, advertencias);
    const ipl03 = this.derivarIPL03(r08);
    const ipl04 = this.derivarIPL04(r02);
    const ipl05 = this.derivarIPL05(r09, advertencias);
    const r11Result = this.derivarR11(r11);
    const r13Result = this.derivarR13(r13);
    const r14Result = this.derivarR14(r14);

    const estadoGeneralCalculo = estadoMasRestrictivo(
      ipl01.estadoCalculo,
      ipl02.estadoCalculo,
      ipl03.estadoCalculo,
      ipl04.estadoCalculo,
      ipl05.estadoCalculo,
      r11Result.estadoCalculo,
      r13Result.estadoCalculo,
      r14Result.estadoCalculo,
    );

    return {
      planEstudioId,
      fechaEvaluacion: fechaEvaluacion.toISOString(),
      ipl01,
      ipl02,
      ipl03,
      ipl04,
      ipl05,
      r11: r11Result,
      r13: r13Result,
      r14: r14Result,
      estadoGeneralCalculo,
      datosFaltantes,
      advertencias,
    };
  }

  private derivarIPL01(
    r09: ResultadoIndicador<ResultadoR09> | null,
    advertencias: string[],
  ): ResultadoIPL01 {
    if (!r09?.valor) {
      return {
        horasTotal: null,
        horasMinimas: null,
        diferencia: null,
        cumple: null,
        estadoCalculo: EstadoCalculo.NO_DETERMINABLE,
      };
    }
    const ev = r09.valor.evaluaciones.total;
    const estadoCalculo = r09.estadoCalculo ?? EstadoCalculo.NO_DETERMINABLE;
    if (estadoCalculo === EstadoCalculo.PARCIAL) {
      advertencias.push(
        'IPL-01: Cálculo parcial por materias sin carga horaria registrada.',
      );
    }
    return {
      horasTotal: r09.valor.horasTotal,
      horasMinimas: ev.horasMinimas,
      diferencia: ev.diferencia,
      cumple: ev.cumple,
      estadoCalculo,
    };
  }

  private derivarIPL02(
    r09: ResultadoIndicador<ResultadoR09> | null,
    advertencias: string[],
  ): ResultadoIPL02 {
    if (!r09?.valor) {
      return {
        bloquesCumplen: 0,
        bloquesConUmbral: 0,
        estadoCalculo: EstadoCalculo.NO_DETERMINABLE,
      };
    }

    const evs = r09.valor.evaluaciones;
    let bloquesConUmbral = 0;
    let bloquesCumplen = 0;

    for (const key of ['CB', 'TB', 'TA', 'CX'] as const) {
      const ev = evs[key];
      if (ev.horasMinimas !== null) {
        bloquesConUmbral++;
        if (ev.cumple === true) bloquesCumplen++;
      }
    }

    if (bloquesConUmbral === 0) {
      advertencias.push(
        'IPL-02: Ningún bloque tiene umbral configurado. El indicador «N de M» no tiene denominador.',
      );
      return { bloquesCumplen: 0, bloquesConUmbral: 0, estadoCalculo: EstadoCalculo.NO_APLICA };
    }

    const estadoCalculo = r09.estadoCalculo ?? EstadoCalculo.NO_DETERMINABLE;
    return { bloquesCumplen, bloquesConUmbral, estadoCalculo };
  }

  private derivarIPL03(r08: ResultadoIndicador<ResultadoR08> | null): ResultadoIPL03 {
    if (!r08?.valor) {
      return {
        sinResponsable: 0,
        inciertas: 0,
        conResponsable: 0,
        totalMaterias: 0,
        estadoCalculo: EstadoCalculo.NO_DETERMINABLE,
      };
    }
    return {
      sinResponsable: r08.valor.materiasConAlerta.length,
      inciertas: r08.valor.materiasInciertas.length,
      conResponsable: r08.valor.totalConResponsable,
      totalMaterias: r08.valor.totalMaterias,
      estadoCalculo: r08.estadoCalculo ?? EstadoCalculo.NO_DETERMINABLE,
    };
  }

  private derivarIPL04(r02: ResultadoIndicador<ResultadoR02> | null): ResultadoIPL04 {
    if (!r02?.valor) {
      return {
        paresConAlerta: 0,
        paresInciertos: 0,
        totalMaterias: 0,
        estadoCalculo: EstadoCalculo.NO_DETERMINABLE,
      };
    }
    return {
      paresConAlerta: r02.valor.paresConAlerta.length,
      paresInciertos: r02.valor.paresInciertos.length,
      totalMaterias: r02.valor.totalMaterias,
      estadoCalculo: r02.estadoCalculo ?? EstadoCalculo.NO_DETERMINABLE,
    };
  }

  private derivarR11(r11: ResultadoIndicador<ResultadoR11> | null): ResultadoR11 {
    if (!r11?.valor) {
      return {
        planEstudioId: '',
        totalMaterias: 0,
        totalConPrograma: 0,
        totalSinPrograma: 0,
        totalInconsistencias: 0,
        totalAlta: 0,
        totalMedia: 0,
        inconsistencias: [],
        sinPrograma: [],
        estadoCalculo: EstadoCalculo.NO_DETERMINABLE,
      };
    }
    return r11.valor;
  }

  private derivarR13(r13: ResultadoIndicador<ResultadoR13> | null): ResultadoR13 {
    if (!r13?.valor) {
      return {
        planEstudioId: '',
        totalMaterias: 0,
        porTipo: { OBLIGATORIA: 0, ELECTIVA: 0, PPS: 0, PI: 0, OTRO: 0 },
        tienePPS: false,
        tienePI: false,
        horasPPS: null,
        horasPI: null,
        materiasPPS: [],
        materiasPI: [],
        configuracionPlan: { requierePPS: null, requierePI: null, porcentajeMinFormacion: null },
        violacionesFormacion: [],
        estadoCalculo: EstadoCalculo.NO_DETERMINABLE,
      };
    }
    return r13.valor;
  }

  private derivarR14(r14: ResultadoIndicador<ResultadoR14> | null): ResultadoR14 {
    if (!r14?.valor) {
      return {
        planEstudioId: '',
        totalMaterias: 0,
        totalEvaluadas: 0,
        totalSinDatos: 0,
        totalConAlerta: 0,
        enAlerta: [],
        estadoCalculo: EstadoCalculo.NO_DETERMINABLE,
      };
    }
    return r14.valor;
  }

  private derivarIPL05(
    r09: ResultadoIndicador<ResultadoR09> | null,
    advertencias: string[],
  ): ResultadoIPL05 {
    if (!r09?.valor) {
      return { bloques: [], estadoCalculo: EstadoCalculo.NO_DETERMINABLE };
    }

    const evs = r09.valor.evaluaciones;
    const r09Estado = r09.estadoCalculo ?? EstadoCalculo.NO_DETERMINABLE;

    const bloques: EvaluacionBloqueIPL05[] = (
      ['CB', 'TB', 'TA', 'CX'] as const
    ).map((key) => {
      const ev = evs[key];
      return {
        bloque: key,
        horasReales: ev.horasReales,
        horasMinimas: ev.horasMinimas,
        diferencia: ev.diferencia,
        cumple: ev.cumple,
        estadoCalculo: estadoParaBloque(ev, r09Estado),
      };
    });

    const totalEv = evs.total;
    bloques.push({
      bloque: 'TOTAL',
      horasReales: totalEv.horasReales,
      horasMinimas: totalEv.horasMinimas,
      diferencia: totalEv.diferencia,
      cumple: totalEv.cumple,
      estadoCalculo: estadoParaBloque(totalEv, r09Estado),
    });

    if (r09Estado === EstadoCalculo.PARCIAL) {
      advertencias.push(
        'IPL-05: Horas por bloque parciales por materias sin carga horaria o con bloque indeterminado.',
      );
    }

    return { bloques, estadoCalculo: r09Estado };
  }
}
