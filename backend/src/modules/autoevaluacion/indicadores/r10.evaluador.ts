import { BadRequestException, Injectable } from '@nestjs/common';
import { ConsultasAcademicasService } from '../consultas-academicas/consultas-academicas.service';
import { EstadoCalculo } from '../types/estado-calculo.types';
import { parsearHorasGestion, parsearCargosAcademicosJson } from './r03.evaluador';
import type {
  ContextoEvaluacion,
  IndicadorEvaluador,
  ResultadoIndicador,
} from './indicadores.types';
import type { DocentesParaR10 } from '../consultas-academicas/consultas-academicas.types';

// ── Constante ─────────────────────────────────────────────────────────────────

/** Umbral por defecto cuando p02BajaH no está configurado (FSD §5.3). */
const UMBRAL_DEFAULT = 20;

// ── Parsers de secciones JSON de ficha docente ────────────────────────────────

/**
 * Resultado común de los parsers de arrays JSON de dedicación.
 * horas: suma de horas determinadas; indeterminado: algún ítem declarado sin horas parseables.
 */
interface ResultadoParserJson {
  horas: number;
  indeterminado: boolean;
}

const REGEX_HORAS = /^\d+(\.\d+)?$/;

/**
 * Parsea otrasDedicacionesJson (sección 5.2).
 * Estructura: [{horasSeman: string}]. Si un ítem existe sin horasSeman numérico → indeterminado.
 */
export function parsearOtrasDedicaciones(json: string | null | undefined): ResultadoParserJson {
  if (!json?.trim()) return { horas: 0, indeterminado: false };
  let items: Array<{ horasSeman?: unknown }>;
  try { items = JSON.parse(json); } catch { return { horas: 0, indeterminado: false }; }
  if (!Array.isArray(items) || items.length === 0) return { horas: 0, indeterminado: false };
  let horas = 0;
  let indeterminado = false;
  for (const item of items) {
    const raw = String(item?.horasSeman ?? '').trim();
    if (REGEX_HORAS.test(raw)) {
      horas += parseFloat(raw);
    } else {
      indeterminado = true;
    }
  }
  return { horas, indeterminado };
}

/**
 * Parsea proyectosInvestigacionJson (sección 7.2).
 * Estructura: [{horasSemanales: string, ...}]. Ítem en array = actividad declarada.
 * horasSemanales vacío/no numérico en cualquier ítem → indeterminado (FSD §3).
 */
export function parsearProyectosInvestigacion(json: string | null | undefined): ResultadoParserJson {
  if (!json?.trim()) return { horas: 0, indeterminado: false };
  let items: Array<{ horasSemanales?: unknown }>;
  try { items = JSON.parse(json); } catch { return { horas: 0, indeterminado: false }; }
  if (!Array.isArray(items) || items.length === 0) return { horas: 0, indeterminado: false };
  let horas = 0;
  let indeterminado = false;
  for (const item of items) {
    const raw = String(item?.horasSemanales ?? '').trim();
    if (REGEX_HORAS.test(raw)) {
      horas += parseFloat(raw);
    } else {
      indeterminado = true;
    }
  }
  return { horas, indeterminado };
}

/**
 * Parsea participacionVinculacionJson (sección 7.3).
 * Estructura: [{horasSemanales: string, ...}]. Mismo criterio que investigación.
 */
export function parsearParticipacionVinculacion(json: string | null | undefined): ResultadoParserJson {
  if (!json?.trim()) return { horas: 0, indeterminado: false };
  let items: Array<{ horasSemanales?: unknown }>;
  try { items = JSON.parse(json); } catch { return { horas: 0, indeterminado: false }; }
  if (!Array.isArray(items) || items.length === 0) return { horas: 0, indeterminado: false };
  let horas = 0;
  let indeterminado = false;
  for (const item of items) {
    const raw = String(item?.horasSemanales ?? '').trim();
    if (REGEX_HORAS.test(raw)) {
      horas += parseFloat(raw);
    } else {
      indeterminado = true;
    }
  }
  return { horas, indeterminado };
}

/**
 * Verifica si un docente tiene al menos un proyecto de investigación declarado (IP-06).
 * Participante = al menos un ítem en el array JSON.
 */
export function tieneProyectoInvestigacion(json: string | null | undefined): boolean {
  if (!json?.trim()) return false;
  try {
    const items = JSON.parse(json);
    return Array.isArray(items) && items.length > 0;
  } catch { return false; }
}

/**
 * Verifica si un docente tiene participación de vinculación con horas > 0 (IP-06 vinculación).
 * Participante = al menos un ítem con horasSemanales > 0.
 */
export function tieneVinculacionConHoras(json: string | null | undefined): boolean {
  if (!json?.trim()) return false;
  try {
    const items: Array<{ horasSemanales?: unknown }> = JSON.parse(json);
    if (!Array.isArray(items)) return false;
    return items.some((item) => {
      const raw = String(item?.horasSemanales ?? '').trim();
      return REGEX_HORAS.test(raw) && parseFloat(raw) > 0;
    });
  } catch { return false; }
}

// ── Tipos de resultado ────────────────────────────────────────────────────────

/**
 * Desglose de componentes horarios para R-10 (FSD §6: dedicación total).
 * DEDICACIÓN TOTAL = docencia(4.1) + gestión(5.1) + otras(5.2) + investigación(7.2) + vinculación(7.3).
 *
 * NOTA: desempeño no académico (desempenoActualJson, sección 6.1) NO forma parte de esta fórmula;
 * pertenece a R-03 (carga para el tope = 4.1 + 5.1 + 6.1). Ver FSD §6 distinción entre R-03 y R-10.
 */
export interface ComponentesHorasR10 {
  horasDocencia: number;
  horasGestion: number;
  /** Sección 5.2: otras dedicaciones universitarias. */
  horasOtrasDedicaciones: number;
  horasInvestigacion: number;
  horasVinculacion: number;
  /** true = tiempoDedicacionGestionSemanal tiene valor pero no es numérico parseable,
   *  O funcionGestion declarada pero tiempoDedicacionGestionSemanal vacía (FSD §3). */
  gestionIndeterminada: boolean;
  /** true = algún ítem en otrasDedicacionesJson sin horasSeman numérico (FSD §3). */
  otrasDedicacionesIndeterminadas: boolean;
  /** true = algún ítem en proyectosInvestigacionJson sin horasSemanales numérico (FSD §3). */
  investigacionIndeterminada: boolean;
  /** true = algún ítem en participacionVinculacionJson sin horasSemanales numérico (FSD §3). */
  vinculacionIndeterminada: boolean;
}

export interface DocenteAlertaR10 {
  docenteId: string;
  nombre: string;
  /**
   * Total de horas determinadas: docencia + gestión + investigación + vinculación.
   * Puede estar subestimado cuando incierto=true.
   */
  horasConocidas: number;
  umbral: number;
  /**
   * true cuando el total real podría superar horasConocidas:
   * vinculaciones sin horasSemana (fuente 4.1), asignaciones cross-facultad,
   * o algún componente indeterminado (valor no numérico o actividad declarada sin horas).
   */
  incierto: boolean;
  componentes: ComponentesHorasR10;
}

/**
 * Valor del indicador R-10 para una carrera.
 *
 * - umbral: p02BajaH configurado o 20h por defecto.
 * - totalEnAlerta: docentes con horasConocidas < umbral e incierto=false (confirmados).
 * - totalInciertos: docentes con horasConocidas < umbral e incierto=true (posible alerta).
 * - enAlerta: lista combinada ordenada por horasConocidas ASC.
 */
export interface ResultadoR10 {
  carreraId: string;
  umbral: number;
  totalDocentes: number;
  totalEnAlerta: number;
  totalInciertos: number;
  enAlerta: DocenteAlertaR10[];
  alcanceFacultad: boolean;
  estadoCalculo: EstadoCalculo;
}

// ── Evaluador ─────────────────────────────────────────────────────────────────

/**
 * Evaluador de R-10: Docentes con baja dedicación horaria total (FSD §6).
 *
 * Fórmula: DEDICACIÓN TOTAL = docencia(4.1) + gestión(5.1) + otras(5.2) + investigación(7.2) + vinculación(7.3).
 * Umbral: p02BajaH de AutoevaluacionConfigFacultad; 20h semanales si no configurado.
 *
 * Reglas de indeterminación (FSD §3 — no asumir 0h):
 *   - Array JSON con al menos un ítem sin horasSeman/horasSemanales numérico → indeterminado.
 *   - Array JSON vacío o null → 0h (sección no declarada).
 *
 * Fuente: obtenerDocentesParaR10 (agrega por docenteId, incluye otrasDedicacionesJson, proyectosInvestigacionJson, participacionVinculacionJson).
 */
@Injectable()
export class R10EvaluadorService implements IndicadorEvaluador<ResultadoR10> {
  constructor(private readonly consultas: ConsultasAcademicasService) {}

  async evaluar(contexto: ContextoEvaluacion): Promise<ResultadoIndicador<ResultadoR10>> {
    if (!contexto.carreraId) {
      throw new BadRequestException(
        'R-10 requiere carreraId. Proporcione el identificador de la carrera a evaluar.',
      );
    }

    const [datos, config] = await Promise.all([
      this.consultas.obtenerDocentesParaR10(
        contexto.carreraId,
        contexto.usuarioId,
        contexto.rolNombre,
      ),
      this.consultas.obtenerConfigDeCarrera(
        contexto.carreraId,
        contexto.usuarioId,
        contexto.rolNombre,
      ),
    ]);

    const umbral = config?.p02BajaH ?? UMBRAL_DEFAULT;
    const { docentes, alcanceFacultad, docentesMultiFacultad } = datos as DocentesParaR10;

    if (docentes.length === 0) {
      return {
        codigo: 'R-10',
        contextoId: contexto.carreraId,
        tipoContexto: 'CARRERA',
        estadoImplementacion: 'IMPLEMENTADO',
        estadoCalculo: EstadoCalculo.NO_APLICA,
        valor: {
          carreraId: contexto.carreraId,
          umbral,
          totalDocentes: 0,
          totalEnAlerta: 0,
          totalInciertos: 0,
          enAlerta: [],
          alcanceFacultad,
          estadoCalculo: EstadoCalculo.NO_APLICA,
        },
        datosFaltantes: [],
        fechaEvaluacion: contexto.fechaEvaluacion,
      };
    }

    const enAlerta: DocenteAlertaR10[] = [];
    let hayDatosIncompletos = false;

    for (const d of docentes) {
      if (d.tieneMateriaSinHoras) hayDatosIncompletos = true;

      const esCrossFacultad = docentesMultiFacultad.has(d.docenteId);

      const g = d.cargosAcademicosJson?.trim()
        ? parsearCargosAcademicosJson(d.cargosAcademicosJson, contexto.fechaEvaluacion)
        : parsearHorasGestion(d.tiempoDedicacionGestionSemanal, d.fechaFinGestion, contexto.fechaEvaluacion, !!(d.funcionGestion?.trim()));
      const otras = parsearOtrasDedicaciones(d.otrasDedicacionesJson);
      const inv   = parsearProyectosInvestigacion(d.proyectosInvestigacionJson);
      const vin   = parsearParticipacionVinculacion(d.participacionVinculacionJson);

      const tieneComponentesIndeterminados =
        g.indeterminado || otras.indeterminado || inv.indeterminado || vin.indeterminado;
      if (tieneComponentesIndeterminados) hayDatosIncompletos = true;

      // DEDICACIÓN TOTAL = docencia(4.1) + gestión(5.1) + otras(5.2) + investigación(7.2) + vinculación(7.3)
      const horasConocidas =
        d.horasDocenciaConocidas + g.horas + otras.horas + inv.horas + vin.horas;

      if (horasConocidas < umbral) {
        const incierto =
          d.tieneMateriaSinHoras || esCrossFacultad || tieneComponentesIndeterminados;
        enAlerta.push({
          docenteId: d.docenteId,
          nombre: `${d.nombre} ${d.apellido}`.trim(),
          horasConocidas,
          umbral,
          incierto,
          componentes: {
            horasDocencia: d.horasDocenciaConocidas,
            horasGestion: g.horas,
            horasOtrasDedicaciones: otras.horas,
            horasInvestigacion: inv.horas,
            horasVinculacion: vin.horas,
            gestionIndeterminada: g.indeterminado,
            otrasDedicacionesIndeterminadas: otras.indeterminado,
            investigacionIndeterminada: inv.indeterminado,
            vinculacionIndeterminada: vin.indeterminado,
          },
        });
      }
    }

    if (docentesMultiFacultad.size > 0) hayDatosIncompletos = true;

    enAlerta.sort((a, b) => a.horasConocidas - b.horasConocidas);

    const estadoCalculo =
      !alcanceFacultad || hayDatosIncompletos
        ? EstadoCalculo.PARCIAL
        : EstadoCalculo.CALCULADO;

    const datosFaltantes =
      hayDatosIncompletos
        ? [
            {
              campo:
                'horasSemana / tiempoDedicacionGestionSemanal / otrasDedicacionesJson / proyectosInvestigacionJson / participacionVinculacionJson',
              entidad: 'VinculacionCatedra / Docente',
              descripcion:
                'Algunas horas no son determinables: vinculaciones sin horasSemana (fuente 4.1), ' +
                'gestión/otras-dedicaciones/investigación/vinculación con ítems sin horas numéricas (FSD §3).',
            },
          ]
        : [];

    return {
      codigo: 'R-10',
      contextoId: contexto.carreraId,
      tipoContexto: 'CARRERA',
      estadoImplementacion: 'IMPLEMENTADO',
      estadoCalculo,
      valor: {
        carreraId: contexto.carreraId,
        umbral,
        totalDocentes: docentes.length,
        totalEnAlerta: enAlerta.filter((a) => !a.incierto).length,
        totalInciertos: enAlerta.filter((a) => a.incierto).length,
        enAlerta,
        alcanceFacultad,
        estadoCalculo,
      },
      datosFaltantes,
      fechaEvaluacion: contexto.fechaEvaluacion,
    };
  }
}
