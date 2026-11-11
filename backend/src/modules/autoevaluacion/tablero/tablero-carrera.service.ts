import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ScopeService } from '../../scopes/scope.service';
import { ConsultasAcademicasService } from '../consultas-academicas/consultas-academicas.service';
import { IP09EvaluadorService } from '../indicadores/ip09.evaluador';
import { IP10EvaluadorService } from '../indicadores/ip10.evaluador';
import { R03EvaluadorService, parsearCargosAcademicosJson, parsearHorasGestion, parsearHorasNoAcademico } from '../indicadores/r03.evaluador';
import { R04EvaluadorService } from '../indicadores/r04.evaluador';
import { R07EvaluadorService } from '../indicadores/r07.evaluador';
import { R10EvaluadorService, tieneProyectoInvestigacion, parsearOtrasDedicaciones, parsearProyectosInvestigacion, parsearParticipacionVinculacion } from '../indicadores/r10.evaluador';
import { R12EvaluadorService } from '../indicadores/r12.evaluador';
import { R15EvaluadorService } from '../indicadores/r15.evaluador';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type { ResultadoIndicador } from '../indicadores/indicadores.types';
import type { ResultadoR03 } from '../indicadores/r03.evaluador';
import type { ResultadoR04 } from '../indicadores/r04.evaluador';
import { normalizarDedicacionConeau, ORDEN_DEDICACION_CONEAU } from './normalizar-dedicacion';
import { calcularCompletitudFicha } from '../../docentes/completitud-ficha';
import { JERARQUIA_POSGRADO } from '../catalogo/tipo-posgrado.service';
import type {
  AlertasDocente,
  AuditoriaDedicacionDto,
  ComponentesAuditoria,
  CondicionesPlantellDto,
  DedicacionConeauItem,
  DedicacionTipoItem,
  DesignacionDetalleItem,
  DistribucionSemaforosDto,
  JerarquiaCargoItem,
  JerarquiaDetalleDto,
  FilaAuditoriaDedicacion,
  FpResumenPlan,
  PosgradoTipoItem,
  DocenteAccionRequerida,
  FilaDocenteListado,
  FilaDocenteMateria,
  ListadoDocentesCarreraDto,
  ResultadoAccionRequerida,
  ResultadoIP01,
  ResultadoIP02,
  ResultadoIP03,
  ResultadoIP04,
  ResultadoIP05,
  ResultadoIP06,
  ResultadoIP07,
  ResultadoIP08,
  ResultadoIP09,
  ResultadoIP10,
  ResultadoIP13,
  ResultadoR10,
  ResultadoR12,
  SemaforoDocente,
  SubindicadorAR,
  TablroCarreraResponseDto,
  TotalesListadoDocentes,
} from './tablero-carrera.dto';
import { evaluarC1, evaluarC2, evaluarC3 } from '../indicadores/ip09.evaluador';

// ── Autorización ──────────────────────────────────────────────────────────────

const ROLES_MODAUT = new Set([
  'ADMINISTRADOR_SISTEMA',
  'SECRETARIA_ACADEMICA',
  'RECTORADO',
  'DECANO',
  'DIRECTOR_CARRERA',
]);

// ── Estado más restrictivo ────────────────────────────────────────────────────

const PESO_ESTADO: Record<EstadoCalculo, number> = {
  [EstadoCalculo.CALCULADO]: 1,
  [EstadoCalculo.NO_APLICA]: 2,
  [EstadoCalculo.PARCIAL]: 3,
  [EstadoCalculo.NO_DETERMINABLE]: 4,
};

function estadoMasRestrictivo(...estados: EstadoCalculo[]): EstadoCalculo {
  return estados.reduce((a, b) => (PESO_ESTADO[b] > PESO_ESTADO[a] ? b : a));
}

function determinarEstadoFichaDocente(porcentaje: number): import('./tablero-carrera.dto').EstadoFichaDocente {
  if (porcentaje <= 50) return 'ROJO';
  if (porcentaje <= 75) return 'AMARILLO';
  return 'VERDE';
}

function buildSubindicador(docentes: { docenteId: string; nombre: string }[]): SubindicadorAR {
  const sorted = [...docentes].sort((a, b) => a.nombre.localeCompare(b.nombre));
  return { total: sorted.length, docentes: sorted as DocenteAccionRequerida[] };
}

// ── Clasificación de cargos (FSD §7, IP-08) ───────────────────────────────────

/**
 * Categorías CONEAU reconocidas por el FSD para el cálculo P/A.
 * Los nombres se normalizan a mayúsculas antes de comparar.
 */
const CARGOS_PROFESOR = new Set([
  'TITULAR',
  'PROFESOR TITULAR',
  'ASOCIADO',
  'PROFESOR ASOCIADO',
  'ADJUNTO',
  'PROFESOR ADJUNTO',
]);

const CARGOS_AUXILIAR = new Set([
  'JTP',
  'JEFE DE TRABAJOS PRÁCTICOS',
  'JEFE DE TRABAJOS PRACTICOS',
  'AYUDANTE GRADUADO',
  'AYUDANTE NO GRADUADO',
]);

function categorizarCargo(nombre: string): 'P' | 'A' | null {
  const n = nombre.trim().toUpperCase();
  if (CARGOS_PROFESOR.has(n)) return 'P';
  if (CARGOS_AUXILIAR.has(n)) return 'A';
  return null;
}

// H.3.2: 'OTROS' va a Auxiliares; desconocidos → null (→ jerarquia.otros, no Auxiliar)
function categorizarCargoJerarquia(nombre: string): 'P' | 'A' | null {
  const n = nombre.trim().toUpperCase();
  if (CARGOS_PROFESOR.has(n)) return 'P';
  if (CARGOS_AUXILIAR.has(n) || n === 'OTROS') return 'A';
  return null;
}

// ── Servicio ──────────────────────────────────────────────────────────────────

/**
 * Calcula IP-01 (Docentes vigentes), IP-02 (Cargos docentes vigentes),
 * IP-03 (Materias cubiertas) e IP-08 (Relación profesores/auxiliares)
 * para el plantel de una carrera según FSD §7.
 *
 * Autorización: rol verificado localmente + scope territorial delegado a ScopeService.
 * Defensa en profundidad: la verificación de scope está tanto en el controlador
 * (vía RolesGuard) como en este servicio.
 */
@Injectable()
export class TablroCarreraService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly r15: R15EvaluadorService,
    private readonly r07: R07EvaluadorService,
    private readonly ip09: IP09EvaluadorService,
    private readonly ip10: IP10EvaluadorService,
    private readonly r12: R12EvaluadorService,
    private readonly r10: R10EvaluadorService,
    private readonly r03: R03EvaluadorService,
    private readonly r04: R04EvaluadorService,
    private readonly consultas: ConsultasAcademicasService,
  ) {}

  async consultarCarrera(
    carreraId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<TablroCarreraResponseDto> {
    if (!ROLES_MODAUT.has(rolNombre)) {
      throw new ForbiddenException('Rol sin acceso a MOD-AUT');
    }

    const carrera = await this.prisma.carrera.findUnique({
      where: { id: carreraId },
      select: { id: true },
    });
    if (!carrera) throw new NotFoundException(`Carrera ${carreraId} no encontrada`);

    const tieneScope = await this.scope.tieneScopeCarrera(usuarioId, rolNombre, carreraId);
    if (!tieneScope) throw new ForbiddenException();

    const fechaEvaluacion = new Date();

    // Todos los evaluadores arrancan en paralelo; mainP y arP no se bloquean entre sí.
    const mainP = Promise.all([
      this.calcularIP01(carreraId),
      this.calcularIP02(carreraId),
      this.calcularIP03(carreraId),
      this.calcularIP08(carreraId),
      this.calcularIP04(carreraId, usuarioId, rolNombre, fechaEvaluacion),
      this.calcularIP09(carreraId),
      this.calcularIP10(carreraId, usuarioId, rolNombre, fechaEvaluacion),
      this.calcularIP13(carreraId, usuarioId, rolNombre, fechaEvaluacion),
      this.calcularR10(carreraId, usuarioId, rolNombre, fechaEvaluacion),
      this.calcularR12(carreraId, usuarioId, rolNombre, fechaEvaluacion),
    ] as const);

    const arP = Promise.all([
      this.r03.evaluar({ carreraId, usuarioId, rolNombre, fechaEvaluacion }),
      this.calcularR04ParaCarrera(carreraId, usuarioId, rolNombre, fechaEvaluacion),
    ] as const);

    // Set de docenteIds que pertenecen a esta carrera. R-07/R-10/R-12/R-03 calculan
    // con alcance de facultad para roles privilegiados; las listas presentadas al
    // tablero de carrera se acotan a los docentes que pertenecen a la carrera pedida.
    const docenteIdsCarreraP = this.prisma.vinculacionCatedra.findMany({
      where: { carreraId, estado: 'APROBADA', docente: { activo: true } },
      select: { docenteId: true },
      distinct: ['docenteId'],
    }).then(rows => new Set(rows.map(r => r.docenteId)));

    const [[ip01, ip02, ip03, ip08, ip04, ip09, ip10, ip13, r10, r12], [r03result, r04Results], fpPorPlan, docenteIdsCarrera] =
      await Promise.all([mainP, arP, this.calcularFpPorPlan(carreraId), docenteIdsCarreraP]);

    const ip13Filtrado = this.filtrarIP13(ip13, docenteIdsCarrera);
    const r10Filtrado  = this.filtrarR10(r10, docenteIdsCarrera);
    const r12Filtrado  = this.filtrarR12(r12, docenteIdsCarrera);
    const r03Filtrado  = this.filtrarR03(r03result, docenteIdsCarrera);

    const accionRequerida = this.buildAccionRequerida(ip13Filtrado, r10Filtrado, r03Filtrado, r04Results);

    // Listado de docentes: calculado con los mismos datos vigentes; incluido en el
    // snapshot para garantizar consistencia temporal en exportaciones PDF posteriores.
    // Un fallo en el listado no interrumpe el análisis principal.
    let listadoDocentes: import('./tablero-carrera.dto').ListadoDocentesCarreraDto | undefined;
    try {
      listadoDocentes = await this.consultarListadoDocentes(carreraId, usuarioId, rolNombre);
    } catch { /* listado no disponible — snapshot guardará el campo como ausente */ }

    // Condiciones del plantel (B-03): fallo gracioso igual que listadoDocentes.
    // ip08 ya está calculado — se reutiliza para evitar una segunda consulta de cargos.
    // ip05/ip06/ip07 se derivan de condicionesPlantell sin consultas adicionales.
    let condicionesPlantell: CondicionesPlantellDto | undefined;
    let ip05: ResultadoIP05 | undefined;
    let ip06: ResultadoIP06 | undefined;
    let ip07: ResultadoIP07 | undefined;
    try {
      condicionesPlantell = await this.calcularCondicionesPlantell(carreraId, ip08);
      if (condicionesPlantell) {
        ip05 = this.derivarIP05(condicionesPlantell);
        ip06 = this.derivarIP06(condicionesPlantell);
        ip07 = this.derivarIP07(condicionesPlantell);
      }
    } catch { /* campo ausente en snapshot si falla */ }

    return {
      carreraId,
      fechaEvaluacion: fechaEvaluacion.toISOString(),
      ip01,
      ip02,
      ip03,
      ip04,
      ip05,
      ip06,
      ip07,
      ip08,
      ip09,
      ip10,
      ip13: ip13Filtrado,
      r10: r10Filtrado,
      r12: r12Filtrado,
      accionRequerida,
      listadoDocentes,
      condicionesPlantell,
      fpPorPlan,
      estadoGeneralCalculo: estadoMasRestrictivo(
        ip01.estadoCalculo, ip02.estadoCalculo,
        ip03.estadoCalculo, ip04.estadoCalculo, ip08.estadoCalculo,
        ip09.estadoCalculo, ip10.estadoCalculo, ip13Filtrado.estadoCalculo,
        r10Filtrado.estadoCalculo, r12Filtrado.estadoCalculo,
      ),
    };
  }

  // ── Filtrado de listas a scope de carrera ─────────────────────────────────────
  // Los evaluadores R-07/R-10/R-12/R-03 calculan con alcance de facultad para roles
  // privilegiados (correcto para la fórmula). Los siguientes métodos acotan las listas
  // presentadas al tablero de carrera a los docentes que pertenecen a la carrera pedida.

  private filtrarIP13(ip13: ResultadoIP13, docenteIds: Set<string>): ResultadoIP13 {
    if (ip13.estadoCalculo === EstadoCalculo.NO_APLICA) return ip13;
    const sobreasignados = ip13.sobreasignados.filter(d => docenteIds.has(d.docenteId));
    return {
      ...ip13,
      totalDocentes: docenteIds.size,
      totalSobreasignados: sobreasignados.length,
      sobreasignados,
    };
  }

  private filtrarR10(r10: ResultadoR10, docenteIds: Set<string>): ResultadoR10 {
    if (r10.estadoCalculo === EstadoCalculo.NO_APLICA) return r10;
    const enAlerta = r10.enAlerta.filter(d => docenteIds.has(d.docenteId));
    return {
      ...r10,
      totalDocentes: docenteIds.size,
      totalEnAlerta: enAlerta.filter(d => !d.incierto).length,
      totalInciertos: enAlerta.filter(d => d.incierto).length,
      enAlerta,
    };
  }

  private filtrarR12(r12: ResultadoR12, docenteIds: Set<string>): ResultadoR12 {
    if (r12.estadoCalculo === EstadoCalculo.NO_APLICA) return r12;
    const incompletos     = r12.incompletos.filter(d => docenteIds.has(d.docenteId));
    const noDeterminables = r12.noDeterminables.filter(d => docenteIds.has(d.docenteId));
    // R-12 produce PARCIAL por dos causas: alcanceFacultad=false (limitación de rol) o
    // noDeterminables.length > 0 (docentes cross-facultad). Si tras filtrar todos los
    // noDeterminables resultan externos a esta carrera y el alcance es de facultad, el
    // único motivo del PARCIAL original desapareció: se recalcula como CALCULADO.
    let estadoCalculo = r12.estadoCalculo;
    if (
      estadoCalculo === EstadoCalculo.PARCIAL &&
      r12.alcanceFacultad === true &&
      noDeterminables.length === 0
    ) {
      estadoCalculo = EstadoCalculo.CALCULADO;
    }
    return {
      ...r12,
      estadoCalculo,
      totalDocentes: docenteIds.size,
      totalIncompletos: incompletos.length,
      incompletos,
      totalNoDeterminables: noDeterminables.length,
      noDeterminables,
    };
  }

  private filtrarR03(
    r03result: ResultadoIndicador<ResultadoR03>,
    docenteIds: Set<string>,
  ): ResultadoIndicador<ResultadoR03> {
    if (!r03result.valor || r03result.estadoCalculo === EstadoCalculo.NO_APLICA) return r03result;
    const enAlerta = r03result.valor.enAlerta.filter(d => docenteIds.has(d.docenteId));
    return { ...r03result, valor: { ...r03result.valor, enAlerta } };
  }

  /** D07: Sumatoria de Formación Práctica por plan de estudios. */
  private async calcularFpPorPlan(carreraId: string): Promise<FpResumenPlan[]> {
    const planes = await this.prisma.planEstudio.findMany({
      where: { carreraId, estado: 'ACTIVO' },
      select: {
        id: true, nombre: true,
        materias: {
          where: { estado: 'ACTIVO' },
          select: {
            tipoAsignatura: true,
            programa: {
              select: {
                hsFormacionPractica: true,
                formacionPracticaJson: true,
              },
            },
          },
        },
      },
      orderBy: { nombre: 'asc' },
    });

    // Helper: FP de un programa usando D07 fallback.
    const fpDePrograma = (prog: { hsFormacionPractica: number | null; formacionPracticaJson: string | null } | null) => {
      if (!prog) return null;
      if (prog.hsFormacionPractica !== null) {
        return { fuente: 'nuevo' as const, valor: prog.hsFormacionPractica };
      }
      if (prog.formacionPracticaJson) {
        try {
          const rows: unknown = JSON.parse(prog.formacionPracticaJson);
          if (Array.isArray(rows)) {
            const suma = (rows as Array<{ horasClase?: unknown }>).reduce(
              (acc, r) => acc + (typeof r.horasClase === 'number' ? r.horasClase : 0),
              0,
            );
            return { fuente: 'historico' as const, valor: suma };
          }
        } catch { /* fall through */ }
      }
      return null;
    };

    return planes.map(plan => {
      let conDatosNuevos = 0, sumaHsNuevo = 0;
      let conDatosHistoricos = 0, sumaHsHistorico = 0;
      let sinDatos = 0;

      const addCount = (fp: { fuente: 'nuevo' | 'historico' }) => {
        if (fp.fuente === 'nuevo') conDatosNuevos++;
        else conDatosHistoricos++;
      };
      const addSum = (fp: { fuente: 'nuevo' | 'historico'; valor: number }) => {
        if (fp.fuente === 'nuevo') sumaHsNuevo += fp.valor;
        else sumaHsHistorico += fp.valor;
      };

      // §6: el alumno cursa UNA electiva — contribuye a la suma sólo la de menor FP.
      const noElectivas = plan.materias.filter(m => m.tipoAsignatura?.toUpperCase() !== 'ELECTIVA');
      const electivas   = plan.materias.filter(m => m.tipoAsignatura?.toUpperCase() === 'ELECTIVA');

      for (const mat of noElectivas) {
        const fp = fpDePrograma(mat.programa);
        if (fp) { addCount(fp); addSum(fp); } else sinDatos++;
      }

      if (electivas.length > 0) {
        const fpValores: Array<{ fuente: 'nuevo' | 'historico'; valor: number }> = [];
        for (const e of electivas) {
          const fp = fpDePrograma(e.programa);
          if (fp) { addCount(fp); fpValores.push(fp); } else sinDatos++;
        }
        if (fpValores.length > 0) {
          addSum(fpValores.reduce((min, x) => x.valor < min.valor ? x : min));
        }
      }

      return {
        planEstudioId: plan.id,
        planNombre: plan.nombre,
        totalMaterias: plan.materias.length,
        conDatosNuevos, sumaHsNuevo,
        conDatosHistoricos, sumaHsHistorico,
        sinDatos,
      };
    });
  }

  /**
   * IP-01: Docentes vigentes.
   * COUNT DISTINCT docenteId con estado='APROBADA' y docente.activo=true.
   */
  private async calcularIP01(carreraId: string): Promise<ResultadoIP01> {
    const docentes = await this.prisma.vinculacionCatedra.findMany({
      where: { carreraId, estado: 'APROBADA', docente: { activo: true } },
      select: { docenteId: true },
      distinct: ['docenteId'],
    });

    if (docentes.length === 0) {
      return { total: 0, estadoCalculo: EstadoCalculo.NO_APLICA };
    }

    return { total: docentes.length, estadoCalculo: EstadoCalculo.CALCULADO };
  }

  /**
   * IP-02: Cargos docentes vigentes.
   * COUNT DISTINCT (docenteId, cargoId) con estado='APROBADA', docente.activo=true.
   * Excluye cargos de gestión («Otros»): solo categorías P y A según CONEAU (FSD §7).
   */
  private async calcularIP02(carreraId: string): Promise<ResultadoIP02> {
    const cargos = await this.prisma.vinculacionCatedra.findMany({
      where: { carreraId, estado: 'APROBADA', docente: { activo: true } },
      select: {
        docenteId: true,
        cargoId: true,
        cargo: { select: { nombre: true } },
      },
      distinct: ['docenteId', 'cargoId'],
    });

    const total = cargos.filter((c) => categorizarCargo(c.cargo.nombre) !== null).length;

    if (total === 0) {
      return { total: 0, estadoCalculo: EstadoCalculo.NO_APLICA };
    }

    return { total, estadoCalculo: EstadoCalculo.CALCULADO };
  }

  /**
   * IP-03: Materias cubiertas.
   *
   * Total = materias ACTIVO en planes de la carrera (mismo criterio de vigencia que el resto del módulo).
   * Cubiertas = distintos materiaId con ≥1 VinculacionCatedra estado='APROBADA'.
   */
  private async calcularIP03(carreraId: string): Promise<ResultadoIP03> {
    const planes = await this.prisma.planEstudio.findMany({
      where: { carreraId },
      select: { id: true },
    });

    if (planes.length === 0) {
      return { cubiertas: 0, total: 0, estadoCalculo: EstadoCalculo.NO_APLICA };
    }

    const planIds = planes.map((p) => p.id);

    const [totalMaterias, materiasCubiertas] = await Promise.all([
      this.prisma.materia.count({ where: { planEstudioId: { in: planIds }, estado: 'ACTIVO' } }),
      this.prisma.vinculacionCatedra.findMany({
        where: { carreraId, estado: 'APROBADA' },
        select: { materiaId: true },
        distinct: ['materiaId'],
      }),
    ]);

    if (totalMaterias === 0) {
      return { cubiertas: 0, total: 0, estadoCalculo: EstadoCalculo.NO_APLICA };
    }

    return {
      cubiertas: materiasCubiertas.length,
      total: totalMaterias,
      estadoCalculo: EstadoCalculo.CALCULADO,
    };
  }

  /**
   * IP-04 / R-15: Materias por docente (FSD §7, §5.3).
   *
   * Delega en R15EvaluadorService que evalúa la carrera seleccionada sin extensión
   * cross-carrera:
   * - Universo: docentes con ≥1 vinculación APROBADA y activo=true en la carrera.
   * - Deduplicación: distinct materiaId por docenteId.
   * - Estadísticas: mediana (principal), promedio, máximo.
   * - Alertas: docentes con nMaterias > p03MaxMat (limite).
   *
   * estadoCalculo: NO_DETERMINABLE si config no existe, NO_APLICA si sin docentes,
   * CALCULADO si evaluación completa.
   */
  private async calcularIP04(
    carreraId: string,
    usuarioId: string,
    rolNombre: string,
    fechaEvaluacion: Date,
  ): Promise<ResultadoIP04> {
    const resultado = await this.r15.evaluar({ carreraId, usuarioId, rolNombre, fechaEvaluacion });
    const v = resultado.valor!;
    return {
      totalDocentes: v.totalDocentes,
      mediana: v.mediana,
      promedio: v.promedio,
      maximo: v.maximo,
      distribucion: v.distribucion,
      limite: v.limite,
      totalEnAlerta: v.totalEnAlerta,
      enAlerta: v.enAlerta,
      estadoCalculo: resultado.estadoCalculo ?? EstadoCalculo.NO_DETERMINABLE,
    };
  }

  /**
   * R-10: Docentes con baja dedicación horaria (FSD §5.3).
   *
   * Delega en R10EvaluadorService: compara horas semanales de docencia conocidas
   * contra el umbral p02BajaH (default 20h).
   * Alertas INFORMATIVAS: no penalizan el score de IP-10.
   */
  private async calcularR10(
    carreraId: string,
    usuarioId: string,
    rolNombre: string,
    fechaEvaluacion: Date,
  ): Promise<ResultadoR10> {
    const resultado = await this.r10.evaluar({ carreraId, usuarioId, rolNombre, fechaEvaluacion });
    const v = resultado.valor!;
    return {
      carreraId: v.carreraId,
      umbral: v.umbral,
      totalDocentes: v.totalDocentes,
      totalEnAlerta: v.totalEnAlerta,
      totalInciertos: v.totalInciertos,
      enAlerta: v.enAlerta,
      alcanceFacultad: v.alcanceFacultad,
      estadoCalculo: resultado.estadoCalculo ?? EstadoCalculo.NO_DETERMINABLE,
    };
  }

  /**
   * IP-13: Docentes sobreasignados (FSD MOD-AUT §3.3 y §5.3).
   *
   * Delega en R07EvaluadorService, que evalúa el plantel completo de la facultad
   * para roles con alcance suficiente (ADMIN/SECRETARIA/RECTORADO/DECANO), o
   * solo la carrera solicitada para DIRECTOR_CARRERA (→ PARCIAL).
   *
   * Condición de sobreasignación: nMaterias > P-03 (comparación estricta).
   * Unidad de conteo: combinaciones distintas (planEstudioId, materiaId, catedraId).
   *
   * El estado de IP-13 participa en estadoGeneralCalculo. PARCIAL indica evaluación
   * incompleta (no implica incumplimiento académico definitivo).
   */
  private async calcularIP13(
    carreraId: string,
    usuarioId: string,
    rolNombre: string,
    fechaEvaluacion: Date,
  ): Promise<ResultadoIP13> {
    const resultado = await this.r07.evaluar({ carreraId, usuarioId, rolNombre, fechaEvaluacion });
    const v = resultado.valor!;
    return {
      limite: v.limite,
      totalDocentes: v.totalDocentes,
      totalSobreasignados: v.totalSobreasignados,
      sobreasignados: v.sobreasignados.map((d) => ({
        docenteId: d.docenteId,
        nombre: d.nombre,
        nMaterias: d.nMaterias,
        exceso: d.exceso,
      })),
      totalNoDeterminables: v.totalNoDeterminables,
      alcanceFacultad: v.alcanceFacultad,
      estadoCalculo: resultado.estadoCalculo ?? EstadoCalculo.NO_DETERMINABLE,
    };
  }

  /**
   * IP-09: Completitud promedio del plantel (FSD §6.3).
   * Delega en IP09EvaluadorService: round(mean(25×(C1+C2+C3+C4))) por docente vigente.
   */
  private async calcularIP09(carreraId: string): Promise<ResultadoIP09> {
    return this.ip09.evaluarParaCarrera(carreraId);
  }

  /**
   * IP-10: Consistencia del plantel docente (FSD MOD-AUT §5).
   * Fórmula: max(0, 100 − 25×A − 10×M).
   *   A = R-03 ALTA + R-04 ALTA no exceptuadas por C4.
   *   M = R-07 MEDIA (sobreasignados).
   */
  private async calcularIP10(
    carreraId: string,
    usuarioId: string,
    rolNombre: string,
    fechaEvaluacion: Date,
  ): Promise<ResultadoIP10> {
    return this.ip10.evaluarParaCarrera(carreraId, usuarioId, rolNombre, fechaEvaluacion);
  }

  /**
   * R-12: Campos obligatorios faltantes en la ficha docente (FSD MOD-AUT §3.1).
   *
   * Delega en R12EvaluadorService: evalúa personales, formacionGrado y areaDesempeno
   * para todos los docentes activos con vinculación APROBADA en la carrera.
   */
  private async calcularR12(
    carreraId: string,
    usuarioId: string,
    rolNombre: string,
    fechaEvaluacion: Date,
  ): Promise<ResultadoR12> {
    const resultado = await this.r12.evaluar({ carreraId, usuarioId, rolNombre, fechaEvaluacion });
    const v = resultado.valor!;
    return {
      carreraId: v.carreraId,
      facultadId: v.facultadId,
      totalDocentes: v.totalDocentes,
      totalIncompletos: v.totalIncompletos,
      incompletos: v.incompletos,
      totalNoDeterminables: v.totalNoDeterminables,
      noDeterminables: v.noDeterminables,
      alcanceFacultad: v.alcanceFacultad,
      estadoCalculo: resultado.estadoCalculo ?? EstadoCalculo.NO_DETERMINABLE,
    };
  }

  /**
   * Obtiene los resultados de R-04 para todos los planes de la carrera.
   * R-04 opera por plan (requiere planEstudioId), por lo que se itera sobre
   * los planes activos de la carrera y se llama al evaluador una vez por plan.
   * El resultado es una lista que buildAccionRequerida consolida por docenteId.
   */
  private async calcularR04ParaCarrera(
    carreraId: string,
    usuarioId: string,
    rolNombre: string,
    fechaEvaluacion: Date,
  ): Promise<ResultadoIndicador<ResultadoR04>[]> {
    const planes = await this.prisma.planEstudio.findMany({
      where: { carreraId },
      select: { id: true },
    });
    if (planes.length === 0) return [];
    return Promise.all(
      planes.map(p => this.r04.evaluar({ planEstudioId: p.id, usuarioId, rolNombre, fechaEvaluacion })),
    );
  }

  /**
   * Construye el panel «Acción requerida» (FSD §9.2) a partir de los resultados
   * ya calculados por los evaluadores. No realiza consultas adicionales.
   *
   * Garantías:
   *   - Todos los conteos son de docentes distintos (dedup por docenteId).
   *   - sobreasignados es subset de conAlertasAltas.
   *   - sinActividadCurricular consolida cargos de todos los planes de la carrera.
   *   - bajaDedicacion.total = confirmados + inciertos; inciertos tienen datos de horas incompletos.
   */
  private buildAccionRequerida(
    ip13: ResultadoIP13,
    r10: ResultadoR10,
    r03result: ResultadoIndicador<ResultadoR03>,
    r04Results: ResultadoIndicador<ResultadoR04>[],
  ): ResultadoAccionRequerida {
    // AR-01: docentes con alertas ALTA (R-03 ∪ IP-13), dedup por docenteId
    const altasMap = new Map<string, string>();
    for (const d of (r03result.valor?.enAlerta ?? [])) {
      altasMap.set(d.docenteId, d.nombre);
    }
    for (const d of ip13.sobreasignados) {
      altasMap.set(d.docenteId, d.nombre);
    }
    const conAlertasAltas = buildSubindicador(
      [...altasMap.entries()].map(([docenteId, nombre]) => ({ docenteId, nombre })),
    );

    // AR-02: sobreasignados (IP-13 / R-07) — subset de AR-01
    const sobreasignados = buildSubindicador(
      ip13.sobreasignados.map(d => ({ docenteId: d.docenteId, nombre: d.nombre })),
    );

    // AR-03: cargos sin actividad curricular (R-04), consolidado por docenteId entre planes
    const sinActividadMap = new Map<string, string>();
    for (const r04res of r04Results) {
      for (const cargo of (r04res.valor?.cargosEnAlerta ?? [])) {
        sinActividadMap.set(cargo.docenteId, cargo.nombre);
      }
    }
    const sinActividadCurricular = buildSubindicador(
      [...sinActividadMap.entries()].map(([docenteId, nombre]) => ({ docenteId, nombre })),
    );

    // AR-04: baja dedicación (R-10) — preserva el flag incierto por docente
    const bajaDedDocentes = r10.enAlerta
      .map(d => ({ docenteId: d.docenteId, nombre: d.nombre, incierto: d.incierto }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
    const bajaDedicacion = {
      total:        bajaDedDocentes.length,
      docentes:     bajaDedDocentes as DocenteAccionRequerida[],
      umbral:       r10.umbral,
      confirmados:  r10.enAlerta.filter(d => !d.incierto).length,
      inciertos:    r10.enAlerta.filter(d =>  d.incierto).length,
    };

    // Estado: el más restrictivo entre R-03, IP-13, R-04 y R-10
    const estadosAR: EstadoCalculo[] = [
      r03result.estadoCalculo ?? EstadoCalculo.NO_DETERMINABLE,
      ip13.estadoCalculo,
      r10.estadoCalculo,
      ...(r04Results.length > 0
        ? r04Results.map(r => r.estadoCalculo ?? EstadoCalculo.NO_DETERMINABLE)
        : [EstadoCalculo.NO_APLICA]),
    ];

    return {
      conAlertasAltas,
      sobreasignados,
      sinActividadCurricular,
      bajaDedicacion,
      estadoCalculo: estadoMasRestrictivo(...estadosAR),
    };
  }

  // ── Listado de docentes (IMPL-18B, FSD §9.3) ─────────────────────────────────

  /**
   * Devuelve el listado detallado de docentes del plantel de una carrera (FSD §9.3).
   *
   * Cada fila incluye:
   *   - Materias en la carrera (nombres + conteo)
   *   - Horas semanales de docencia conocidas en la carrera (sin cross-carrera)
   *   - Completitud de ficha (C1–C4, fórmula IP-09)
   *   - Semáforo: VERDE/AMARILLO/ROJO según min(completitud_i, consistencia_i)
   *   - Alertas activas (R-03, R-04, R-07, R-10, R-12)
   *
   * Los contadores de filtro (totales) se calculan sobre el listado completo.
   */
  async consultarListadoDocentes(
    carreraId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<ListadoDocentesCarreraDto> {
    if (!ROLES_MODAUT.has(rolNombre)) {
      throw new ForbiddenException('Rol sin acceso a MOD-AUT');
    }

    const carrera = await this.prisma.carrera.findUnique({
      where: { id: carreraId },
      select: { id: true },
    });
    if (!carrera) throw new NotFoundException(`Carrera ${carreraId} no encontrada`);

    const tieneScope = await this.scope.tieneScopeCarrera(usuarioId, rolNombre, carreraId);
    if (!tieneScope) throw new ForbiddenException();

    const fechaEvaluacion = new Date();

    // ── Consulta de datos de docentes (inline, sin nueva dependencia) ─────────
    const rows = await this.prisma.vinculacionCatedra.findMany({
      where: { carreraId, estado: 'APROBADA', docente: { activo: true } },
      select: {
        docenteId: true,
        materia: {
          select: {
            id: true, nombre: true, cargaHorariaSemanal: true,
          },
        },
        docente: {
          select: {
            nombre: true, apellido: true,
            sexo: true, fechaNacimiento: true, cuit: true,
            pisoDepto: true, residencia: true, tipoDocumento: true,
            tituloGrado: true, areaDisciplinarId: true, subareaId: true,
            cargosAcademicosJson: true,
            tiempoDedicacionGestionSemanal: true,
            fechaFinGestion: true,
            funcionGestion: true,
            proyectosInvestigacionJson: true,
            participacionVinculacionJson: true,
          },
        },
      },
    });

    type MatEntry = { materiaId: string; nombre: string; cargaHorariaSemanal: number | null };
    type DocEntry = {
      nombre: string; apellido: string;
      sexo: string | null; fechaNacimiento: Date | null; cuit: string | null;
      pisoDepto: string | null; residencia: string | null; tipoDocumento: string;
      tituloGrado: string | null; areaDisciplinarId: string | null; subareaId: string | null;
      cargosAcademicosJson: string | null;
      tiempoDedicacionGestionSemanal: string | null;
      fechaFinGestion: string | null;
      funcionGestion: string | null;
      proyectosInvestigacionJson: string | null;
      participacionVinculacionJson: string | null;
      materias: Map<string, MatEntry>;
    };

    const byDocente = new Map<string, DocEntry>();
    for (const row of rows) {
      const existing = byDocente.get(row.docenteId);
      if (!existing) {
        byDocente.set(row.docenteId, {
          nombre: row.docente.nombre,
          apellido: row.docente.apellido,
          sexo: row.docente.sexo ?? null,
          fechaNacimiento: row.docente.fechaNacimiento ?? null,
          cuit: row.docente.cuit ?? null,
          pisoDepto: row.docente.pisoDepto ?? null,
          residencia: row.docente.residencia ?? null,
          tipoDocumento: row.docente.tipoDocumento,
          tituloGrado: row.docente.tituloGrado ?? null,
          areaDisciplinarId: row.docente.areaDisciplinarId ?? null,
          subareaId: row.docente.subareaId ?? null,
          cargosAcademicosJson: row.docente.cargosAcademicosJson ?? null,
          tiempoDedicacionGestionSemanal: row.docente.tiempoDedicacionGestionSemanal ?? null,
          fechaFinGestion: row.docente.fechaFinGestion ?? null,
          funcionGestion: row.docente.funcionGestion ?? null,
          proyectosInvestigacionJson: row.docente.proyectosInvestigacionJson ?? null,
          participacionVinculacionJson: row.docente.participacionVinculacionJson ?? null,
          materias: new Map([[row.materia.id, {
            materiaId: row.materia.id,
            nombre: row.materia.nombre,
            cargaHorariaSemanal: row.materia.cargaHorariaSemanal ?? null,
          }]]),
        });
      } else if (!existing.materias.has(row.materia.id)) {
        existing.materias.set(row.materia.id, {
          materiaId: row.materia.id,
          nombre: row.materia.nombre,
          cargaHorariaSemanal: row.materia.cargaHorariaSemanal ?? null,
        });
      }
    }

    if (byDocente.size === 0) {
      return {
        carreraId,
        fechaEvaluacion: fechaEvaluacion.toISOString(),
        docentes: [],
        filas: [],
        totales: { total: 0, conAlertas: 0, sobreasignados: 0, bajaDedicacion: 0, fichaIncompleta: 0 },
        distribucionSemaforos: { verde: 0, amarillo: 0, rojo: 0, total: 0 },
        estadoCalculo: EstadoCalculo.NO_APLICA,
      };
    }

    // ── Evaluadores + horas docentes de todas las carreras (§4.1 completa) ──────
    const args = { carreraId, usuarioId, rolNombre, fechaEvaluacion };
    const planes = await this.prisma.planEstudio.findMany({
      where: { carreraId },
      select: { id: true },
    });

    const [todasVincs, r03result, r07result, r10result, r12result, r04Results] = await Promise.all([
      // Segunda consulta: horas docentes de TODAS las carreras.
      // Determina el horasDocencia real (§4.1 — Situación Actual) sin filtrar por carrera.
      this.prisma.vinculacionCatedra.findMany({
        where: { docenteId: { in: [...byDocente.keys()] }, estado: 'APROBADA' },
        select: { docenteId: true, materia: { select: { id: true, cargaHorariaSemanal: true } } },
      }),
      this.r03.evaluar(args),
      this.r07.evaluar(args),
      this.r10.evaluar(args),
      this.r12.evaluar(args),
      planes.length === 0
        ? Promise.resolve([] as Awaited<ReturnType<typeof this.r04.evaluar>>[])
        : Promise.all(planes.map(p => this.r04.evaluar({ ...args, planEstudioId: p.id }))),
    ]);

    // Construir mapa de horas docentes totales (todas las carreras) por docenteId.
    // Se deduplica por (docenteId, materiaId) para evitar doble cómputo por múltiples vinculaciones.
    const horasAllCarreras = new Map<string, { horas: number; incompletas: boolean }>();
    const seenMatKey = new Set<string>();
    for (const v of todasVincs) {
      const k = `${v.docenteId}|${v.materia.id}`;
      if (seenMatKey.has(k)) continue;
      seenMatKey.add(k);
      const e = horasAllCarreras.get(v.docenteId) ?? { horas: 0, incompletas: false };
      if (v.materia.cargaHorariaSemanal === null) {
        e.incompletas = true;
      } else {
        e.horas += v.materia.cargaHorariaSemanal;
      }
      horasAllCarreras.set(v.docenteId, e);
    }

    // ── Sets de alertas por docenteId ──────────────────────────────────────────
    const topeSet      = new Set((r03result.valor?.enAlerta ?? []).map(d => d.docenteId));
    const sobreSet     = new Set((r07result.valor?.sobreasignados ?? []).map(d => d.docenteId));
    const sinActSet    = new Set<string>();
    for (const r of r04Results) {
      for (const c of (r.valor?.cargosEnAlerta ?? [])) sinActSet.add(c.docenteId);
    }
    const bajaDedConfSet   = new Set((r10result.valor?.enAlerta ?? []).filter(d => !d.incierto).map(d => d.docenteId));
    const bajaDedIncSet    = new Set((r10result.valor?.enAlerta ?? []).filter(d =>  d.incierto).map(d => d.docenteId));
    const fichaSet         = new Set((r12result.valor?.incompletos ?? []).map(d => d.docenteId));

    // ── Construcción de filas ──────────────────────────────────────────────────
    const docentes: FilaDocenteListado[] = [...byDocente.entries()]
      .map(([docenteId, d]) => {
        const materiasArr = [...d.materias.values()];
        const horasCarreraConocidas = materiasArr.reduce(
          (sum, m) => sum + (m.cargaHorariaSemanal ?? 0), 0,
        );
        const tieneHorasIncompletas = materiasArr.some(m => m.cargaHorariaSemanal === null);

        const c1 = evaluarC1(d) ? 1 : 0;
        const c2 = evaluarC2(d.tituloGrado) ? 1 : 0;
        const c3 = evaluarC3(d.areaDisciplinarId) ? 1 : 0;
        const completitud = 25 * (c1 + c2 + c3 + 1);
        const fichaScore  = c1 + c2 + c3 + 1;

        const altaTope        = topeSet.has(docenteId);
        const altaSinAct      = sinActSet.has(docenteId);
        const mediaSobre      = sobreSet.has(docenteId);
        const A               = (altaTope ? 1 : 0) + (altaSinAct ? 1 : 0);
        const M               = mediaSobre ? 1 : 0;
        const consistencia    = Math.max(0, 100 - 25 * A - 10 * M);
        const score           = Math.min(completitud, consistencia);
        const semaforo: SemaforoDocente = score >= 90 ? 'VERDE' : score >= 60 ? 'AMARILLO' : 'ROJO';

        const alertas: AlertasDocente = {
          altaTope,
          altaSinActividad:           altaSinAct,
          mediaSobreasignado:         mediaSobre,
          informativaBajaDedicacion:  bajaDedConfSet.has(docenteId),
          bajaDedicacionIncierta:     bajaDedIncSet.has(docenteId),
          fichaIncompleta:            fichaSet.has(docenteId),
        };

        return {
          docenteId,
          nombre: `${d.apellido.toUpperCase()}, ${d.nombre}`,
          materias: materiasArr.map(m => ({ materiaId: m.materiaId, nombre: m.nombre })),
          nMaterias: materiasArr.length,
          horasCarreraConocidas,
          tieneHorasIncompletas,
          completitud,
          fichaScore,
          semaforo,
          alertas,
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    // ── Construcción de filas Docente–Dedicación (H.4 consolidado) ──────────
    const alertasByDocente = new Map<string, AlertasDocente>(
      docentes.map(d => [d.docenteId, d.alertas]),
    );
    const filas: FilaDocenteMateria[] = [];
    for (const [docenteId, d] of byDocente.entries()) {
      const materiasArr = [...d.materias.values()];
      // horasDocencia: suma de §4.1 en TODAS las carreras del docente (no solo la carrera seleccionada).
      // tieneHorasIncompletas: verdadero si alguna materia del docente (en cualquier carrera) no tiene horas.
      const { horas: horasDocencia, incompletas: tieneHorasIncompletas } =
        horasAllCarreras.get(docenteId) ?? { horas: 0, incompletas: false };
      const nombreDocente = `${d.apellido.toUpperCase()}, ${d.nombre}`;
      const alertas = alertasByDocente.get(docenteId)!;

      const gestionDeclarada = !!(d.funcionGestion?.trim());
      const g = d.cargosAcademicosJson?.trim()
        ? parsearCargosAcademicosJson(d.cargosAcademicosJson, fechaEvaluacion)
        : parsearHorasGestion(d.tiempoDedicacionGestionSemanal, d.fechaFinGestion, fechaEvaluacion, gestionDeclarada);
      const inv = parsearProyectosInvestigacion(d.proyectosInvestigacionJson);
      const vin = parsearParticipacionVinculacion(d.participacionVinculacionJson);

      const completitudResult = calcularCompletitudFicha({
        sexo: d.sexo,
        fechaNacimiento: d.fechaNacimiento,
        cuit: d.cuit,
        tipoDocumento: d.tipoDocumento,
        tituloGrado: d.tituloGrado,
        areaDisciplinarId: d.areaDisciplinarId,
        subareaId: d.subareaId,
        // C4=1 por construcción: todos los docentes del listado tienen ≥1 vinculación APROBADA.
        vinculaciones: [{ estado: 'APROBADA' }],
      });

      filas.push({
        docenteId,
        nombreDocente,
        materiasVinculadas: materiasArr.length,
        horasDocencia,
        tieneHorasIncompletas,
        horasGestion: g.horas,
        horasInvestigacion: inv.horas,
        horasVinculacion: vin.horas,
        dedicacion: horasDocencia + g.horas + inv.horas + vin.horas,
        alertas,
        completitudFichaDocente: completitudResult.porcentaje,
        estadoFichaDocente: determinarEstadoFichaDocente(completitudResult.porcentaje),
      });
    }
    filas.sort((a, b) => a.nombreDocente.localeCompare(b.nombreDocente));

    // ── Totales para filtros ───────────────────────────────────────────────────
    const totales: TotalesListadoDocentes = {
      total: docentes.length,
      conAlertas: docentes.filter(d =>
        d.alertas.altaTope || d.alertas.altaSinActividad || d.alertas.mediaSobreasignado,
      ).length,
      sobreasignados:  docentes.filter(d => d.alertas.mediaSobreasignado).length,
      bajaDedicacion:  docentes.filter(d =>
        d.alertas.informativaBajaDedicacion || d.alertas.bajaDedicacionIncierta,
      ).length,
      fichaIncompleta: docentes.filter(d => d.alertas.fichaIncompleta).length,
    };

    // ── Distribución de semáforos (B-04) ──────────────────────────────────────
    const distribucionSemaforos: DistribucionSemaforosDto = {
      verde:    docentes.filter(d => d.semaforo === 'VERDE').length,
      amarillo: docentes.filter(d => d.semaforo === 'AMARILLO').length,
      rojo:     docentes.filter(d => d.semaforo === 'ROJO').length,
      total:    docentes.length,
    };

    const estadoCalculo = estadoMasRestrictivo(
      r03result.estadoCalculo  ?? EstadoCalculo.NO_DETERMINABLE,
      r07result.estadoCalculo  ?? EstadoCalculo.NO_DETERMINABLE,
      r10result.estadoCalculo  ?? EstadoCalculo.NO_DETERMINABLE,
      r12result.estadoCalculo  ?? EstadoCalculo.NO_DETERMINABLE,
      ...(r04Results.length > 0
        ? r04Results.map(r => r.estadoCalculo ?? EstadoCalculo.NO_DETERMINABLE)
        : [EstadoCalculo.NO_APLICA as EstadoCalculo]),
    );

    return {
      carreraId,
      fechaEvaluacion: fechaEvaluacion.toISOString(),
      docentes,
      filas,
      totales,
      distribucionSemaforos,
      estadoCalculo,
    };
  }

  /**
   * B-03: Condiciones del plantel (FSD §9.2, H.3).
   *
   * Indicadores CONEAU:
   *   conPosgrado:           Docente.tituloPosgrado not null.
   *   conInvestigacion:      docentes con al menos un proyecto en proyectosInvestigacionJson.
   *   conDesignacionRegular: docentes con VinculacionCatedra APROBADA cuya
   *                          Designacion.nombre contiene "REGULAR" (H.3 — fuente corregida).
   *   conDesignacionInterina: ídem con "INTERINO".
   *   dedicacionPorTipo:     distribución por Designacion.nombre (VinculacionCatedra APROBADA).
   *   designacionDetalle:    igual que dedicacionPorTipo con porcentaje por tipo (H.3).
   *   jerarquia:             desglose de cargos (pares docenteId/cargoId) por tipo CONEAU (H.3).
   */
  private async calcularCondicionesPlantell(
    carreraId: string,
    ip08: ResultadoIP08,
  ): Promise<CondicionesPlantellDto> {
    const vincsIds = await this.prisma.vinculacionCatedra.findMany({
      where: { carreraId, estado: 'APROBADA', docente: { activo: true } },
      select: { docenteId: true },
      distinct: ['docenteId'],
    });

    if (vincsIds.length === 0) {
      return {
        totalDocentes: 0,
        conPosgrado: 0,
        conInvestigacion: 0,
        conDesignacionRegular: 0,
        conDesignacionInterina: 0,
        dedicacionPorTipo: [],
        designacionDetalle: [],
        jerarquia: { profesores: [], totalProfesores: 0, auxiliares: [], totalAuxiliares: 0, otros: 0 },
        dedicacionConeau: [],
        estadoCalculo: EstadoCalculo.NO_APLICA,
      };
    }

    const docenteIds = vincsIds.map(v => v.docenteId);

    const [docentes, vincsConDesig, cargosJerarquia] = await Promise.all([
      this.prisma.docente.findMany({
        where: { id: { in: docenteIds } },
        select: { id: true, tituloPosgrado: true, proyectosInvestigacionJson: true, dedicacion: true, tipoPosgrado: { select: { nombre: true } } },
      }),
      this.prisma.vinculacionCatedra.findMany({
        where: { carreraId, estado: 'APROBADA', docente: { activo: true } },
        select: { docenteId: true, designacion: { select: { nombre: true } } },
        distinct: ['docenteId', 'designacionId'],
      }),
      // H.3.2: distinct por (docenteId, materiaId, cargoId) → una asignación por docente-materia-cargo
      this.prisma.vinculacionCatedra.findMany({
        where: { carreraId, estado: 'APROBADA', docente: { activo: true }, materia: { estado: 'ACTIVO' } },
        select: { docenteId: true, materiaId: true, cargoId: true, cargo: { select: { nombre: true } } },
        distinct: ['docenteId', 'materiaId', 'cargoId'],
      }),
    ]);

    const conPosgrado      = docentes.filter(d => !!d.tituloPosgrado).length;
    const conInvestigacion = docentes.filter(d => tieneProyectoInvestigacion(d.proyectosInvestigacionJson)).length;

    // D-06: distribución por nivel máximo de posgrado CONEAU
    const posgradoConteo = new Map<string, number>();
    for (const d of docentes) {
      if (d.tipoPosgrado) {
        posgradoConteo.set(d.tipoPosgrado.nombre, (posgradoConteo.get(d.tipoPosgrado.nombre) ?? 0) + 1);
      }
    }
    const distribucionPosgrado: PosgradoTipoItem[] = JERARQUIA_POSGRADO
      .filter(nombre => posgradoConteo.has(nombre))
      .map(nombre => ({ tipo: nombre, docentes: posgradoConteo.get(nombre)! }));

    // conDesignacionRegular / conDesignacionInterina desde VinculacionCatedra → Designacion.nombre (H.3)
    const regularSet  = new Set<string>();
    const interinoSet = new Set<string>();
    for (const v of vincsConDesig) {
      const nombre = v.designacion.nombre.toUpperCase();
      if (nombre.includes('REGULAR'))  regularSet.add(v.docenteId);
      if (nombre.includes('INTERINO')) interinoSet.add(v.docenteId);
    }

    // dedicacionPorTipo: primera designación por docente
    const dedMap = new Map<string, string>();
    for (const v of vincsConDesig) {
      if (!dedMap.has(v.docenteId)) dedMap.set(v.docenteId, v.designacion.nombre);
    }
    const conteoPorTipo = new Map<string, number>();
    for (const tipo of dedMap.values()) {
      conteoPorTipo.set(tipo, (conteoPorTipo.get(tipo) ?? 0) + 1);
    }
    const dedicacionPorTipo: DedicacionTipoItem[] = [...conteoPorTipo.entries()]
      .map(([tipo, dc]) => ({ tipo, docentes: dc }))
      .sort((a, b) => b.docentes - a.docentes);

    // designacionDetalle: igual que dedicacionPorTipo + porcentaje (H.3)
    const designacionDetalle: DesignacionDetalleItem[] = dedicacionPorTipo.map(item => ({
      tipo: item.tipo,
      docentes: item.docentes,
      porcentaje: docenteIds.length > 0 ? Math.round((item.docentes / docenteIds.length) * 100) : 0,
    }));

    const relacionPA: CondicionesPlantellDto['relacionPA'] =
      ip08.estadoCalculo !== EstadoCalculo.NO_APLICA
        ? { profesores: ip08.profesores, auxiliares: ip08.auxiliares }
        : undefined;

    // Distribución CONEAU por Docente.dedicacion
    const coneauConteo = new Map<string, number>();
    for (const d of docentes) {
      const cat = normalizarDedicacionConeau(d.dedicacion);
      coneauConteo.set(cat, (coneauConteo.get(cat) ?? 0) + 1);
    }
    const dedicacionConeau: DedicacionConeauItem[] = ORDEN_DEDICACION_CONEAU
      .filter(cat => coneauConteo.has(cat))
      .map(cat => ({ categoria: cat, docentes: coneauConteo.get(cat)! }));

    // H.3.2: una asignación por (docente, materia, cargo); 'OTROS'→Auxiliar; desconocidos→otros
    const cargoNombreConteo = new Map<string, number>();
    let totalProfesores = 0;
    let totalAuxiliares = 0;
    let otros = 0;
    for (const c of cargosJerarquia) {
      const nombre = c.cargo.nombre;
      const cat = categorizarCargoJerarquia(nombre);
      cargoNombreConteo.set(nombre, (cargoNombreConteo.get(nombre) ?? 0) + 1);
      if (cat === 'P') totalProfesores++;
      else if (cat === 'A') totalAuxiliares++;
      else otros++;
    }
    const profesoresCargos: JerarquiaCargoItem[] = [];
    const auxiliaresCargos: JerarquiaCargoItem[] = [];
    for (const [cargo, cargos] of cargoNombreConteo.entries()) {
      const cat = categorizarCargoJerarquia(cargo);
      if (cat === 'P') profesoresCargos.push({ cargo, cargos });
      else if (cat === 'A') auxiliaresCargos.push({ cargo, cargos });
    }
    const jerarquia: JerarquiaDetalleDto = {
      profesores: profesoresCargos.sort((a, b) => b.cargos - a.cargos),
      totalProfesores,
      auxiliares: auxiliaresCargos.sort((a, b) => b.cargos - a.cargos),
      totalAuxiliares,
      otros,
    };

    return {
      totalDocentes: docenteIds.length,
      conPosgrado,
      conInvestigacion,
      conDesignacionRegular: regularSet.size,
      conDesignacionInterina: interinoSet.size,
      relacionPA,
      dedicacionPorTipo,
      designacionDetalle,
      jerarquia,
      dedicacionConeau,
      distribucionPosgrado,
      estadoCalculo: EstadoCalculo.CALCULADO,
    };
  }

  // ── Derivaciones sin consulta adicional (IP-05, IP-06, IP-07) ───────────────

  private derivarIP05(cp: CondicionesPlantellDto): ResultadoIP05 {
    if (cp.estadoCalculo === EstadoCalculo.NO_APLICA) {
      return { conPosgrado: 0, totalDocentes: 0, porcentaje: null, estadoCalculo: EstadoCalculo.NO_APLICA };
    }
    const pct = cp.totalDocentes > 0 ? Math.round((cp.conPosgrado / cp.totalDocentes) * 100) : null;
    return { conPosgrado: cp.conPosgrado, totalDocentes: cp.totalDocentes, porcentaje: pct, estadoCalculo: EstadoCalculo.CALCULADO };
  }

  private derivarIP06(cp: CondicionesPlantellDto): ResultadoIP06 {
    if (cp.estadoCalculo === EstadoCalculo.NO_APLICA) {
      return { conInvestigacion: 0, totalDocentes: 0, porcentaje: null, estadoCalculo: EstadoCalculo.NO_APLICA };
    }
    const pct = cp.totalDocentes > 0 ? Math.round((cp.conInvestigacion / cp.totalDocentes) * 100) : null;
    return { conInvestigacion: cp.conInvestigacion, totalDocentes: cp.totalDocentes, porcentaje: pct, estadoCalculo: EstadoCalculo.CALCULADO };
  }

  private derivarIP07(cp: CondicionesPlantellDto): ResultadoIP07 {
    if (cp.estadoCalculo === EstadoCalculo.NO_APLICA) {
      return { conDesignacionRegular: 0, totalDocentes: 0, porcentaje: null, estadoCalculo: EstadoCalculo.NO_APLICA };
    }
    const pct = cp.totalDocentes > 0 ? Math.round((cp.conDesignacionRegular / cp.totalDocentes) * 100) : null;
    return { conDesignacionRegular: cp.conDesignacionRegular, totalDocentes: cp.totalDocentes, porcentaje: pct, estadoCalculo: EstadoCalculo.CALCULADO };
  }

  /**
   * IP-08: Relación profesores / auxiliares.
   *
   * Unidad: par (docenteId, cargoId) distinto con estado='APROBADA' en la carrera.
   * Clasificación: según CARGOS_PROFESOR y CARGOS_AUXILIAR (categorías CONEAU).
   * Cargos no clasificables → «Otros», no se cuentan.
   */
  private async calcularIP08(carreraId: string): Promise<ResultadoIP08> {
    const cargosVigentes = await this.prisma.vinculacionCatedra.findMany({
      where: { carreraId, estado: 'APROBADA' },
      select: {
        docenteId: true,
        cargoId: true,
        cargo: { select: { nombre: true } },
      },
      distinct: ['docenteId', 'cargoId'],
    });

    if (cargosVigentes.length === 0) {
      return { profesores: 0, auxiliares: 0, ratio: null, estadoCalculo: EstadoCalculo.NO_APLICA };
    }

    let profesores = 0;
    let auxiliares = 0;
    for (const c of cargosVigentes) {
      const cat = categorizarCargo(c.cargo.nombre);
      if (cat === 'P') profesores++;
      else if (cat === 'A') auxiliares++;
    }

    const ratio =
      auxiliares === 0 ? null : Math.round((profesores / auxiliares) * 10) / 10;

    return {
      profesores,
      auxiliares,
      ratio,
      estadoCalculo: EstadoCalculo.CALCULADO,
    };
  }

  // ── Auditoría de dedicación docente ──────────────────────────────────────────

  /**
   * Devuelve el desglose horario por componente (4.1, 5.1, 5.2, 6.1, 7.2, 7.3) para
   * cada docente vigente en la carrera, junto con los totales R-10 y R-03 y las
   * alertas correspondientes a p01TopeH y p02BajaH.
   *
   * Fuente de datos: obtenerDocentesParaR10 (incluye los 6 campos JSON de la ficha).
   * No realiza consultas adicionales: reutiliza los parsers de los evaluadores R-03 y R-10.
   */
  async consultarAuditoriaDedicacion(
    carreraId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<AuditoriaDedicacionDto> {
    if (!ROLES_MODAUT.has(rolNombre)) {
      throw new ForbiddenException('Rol sin acceso a MOD-AUT');
    }

    const carrera = await this.prisma.carrera.findUnique({
      where: { id: carreraId },
      select: { id: true },
    });
    if (!carrera) throw new NotFoundException(`Carrera ${carreraId} no encontrada`);

    const tieneScope = await this.scope.tieneScopeCarrera(usuarioId, rolNombre, carreraId);
    if (!tieneScope) throw new ForbiddenException();

    const fechaEvaluacion = new Date();

    const [datosR10, config] = await Promise.all([
      this.consultas.obtenerDocentesParaR10(carreraId, usuarioId, rolNombre),
      this.consultas.obtenerConfigDeCarrera(carreraId, usuarioId, rolNombre),
    ]);

    const { docentes } = datosR10;
    const p01TopeH = config?.p01TopeH ?? null;
    const p02BajaH = config?.p02BajaH ?? null;

    // Filtrar solo docentes que pertenecen a esta carrera
    const docenteIdsCarrera = await this.prisma.vinculacionCatedra.findMany({
      where: { carreraId, estado: 'APROBADA', docente: { activo: true } },
      select: { docenteId: true },
      distinct: ['docenteId'],
    }).then(rows => new Set(rows.map(r => r.docenteId)));

    let hayDatosIndeterminados = false;

    const filas: FilaAuditoriaDedicacion[] = docentes
      .filter(d => docenteIdsCarrera.has(d.docenteId))
      .map(d => {
        const gestionDeclarada = !!(d.funcionGestion?.trim());
        const g = d.cargosAcademicosJson?.trim()
          ? parsearCargosAcademicosJson(d.cargosAcademicosJson, fechaEvaluacion)
          : parsearHorasGestion(d.tiempoDedicacionGestionSemanal, d.fechaFinGestion, fechaEvaluacion, gestionDeclarada);
        const otras = parsearOtrasDedicaciones(d.otrasDedicacionesJson);
        const na    = parsearHorasNoAcademico(d.desempenoActualJson);
        const inv   = parsearProyectosInvestigacion(d.proyectosInvestigacionJson);
        const vin   = parsearParticipacionVinculacion(d.participacionVinculacionJson);

        const incierto =
          d.tieneMateriaSinHoras ||
          g.indeterminado ||
          otras.indeterminado ||
          na.tieneIndeterminados ||
          inv.indeterminado ||
          vin.indeterminado;

        if (incierto) hayDatosIndeterminados = true;

        const componentes: ComponentesAuditoria = {
          docencia: d.horasDocenciaConocidas,
          gestion: g.horas,
          otras: otras.horas,
          desempenoNoAcademico: na.horas,
          investigacion: inv.horas,
          vinculacion: vin.horas,
          gestionIndeterminada: g.indeterminado,
          otrasIndeterminadas: otras.indeterminado,
          desempenoIndeterminado: na.tieneIndeterminados,
          investigacionIndeterminada: inv.indeterminado,
          vinculacionIndeterminada: vin.indeterminado,
        };

        const dedicacionTotalR10 = d.horasDocenciaConocidas + g.horas + otras.horas + inv.horas + vin.horas;
        const cargaTopeR03       = d.horasDocenciaConocidas + g.horas + na.horas;

        const alertaR03 = p01TopeH !== null && cargaTopeR03 > p01TopeH;
        const alertaR10 = p02BajaH !== null && !incierto && dedicacionTotalR10 < p02BajaH;

        return {
          docenteId: d.docenteId,
          nombre: `${d.apellido.toUpperCase()}, ${d.nombre}`,
          componentes,
          dedicacionTotalR10,
          cargaTopeR03,
          alertaR03,
          alertaR10,
          incierto,
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    const estadoCalculo = hayDatosIndeterminados ? EstadoCalculo.PARCIAL : EstadoCalculo.CALCULADO;

    return {
      carreraId,
      fechaEvaluacion: fechaEvaluacion.toISOString(),
      p01TopeH,
      p02BajaH,
      filas,
      estadoCalculo,
    };
  }
}
