import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ScopeService } from '../../scopes/scope.service';
import { IP09EvaluadorService } from '../indicadores/ip09.evaluador';
import { IP10EvaluadorService } from '../indicadores/ip10.evaluador';
import { R03EvaluadorService } from '../indicadores/r03.evaluador';
import { R04EvaluadorService } from '../indicadores/r04.evaluador';
import { R07EvaluadorService } from '../indicadores/r07.evaluador';
import { R10EvaluadorService } from '../indicadores/r10.evaluador';
import { R12EvaluadorService } from '../indicadores/r12.evaluador';
import { R15EvaluadorService } from '../indicadores/r15.evaluador';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type { ResultadoIndicador } from '../indicadores/indicadores.types';
import type { ResultadoR03 } from '../indicadores/r03.evaluador';
import type { ResultadoR04 } from '../indicadores/r04.evaluador';
import { normalizarDedicacionConeau, ORDEN_DEDICACION_CONEAU } from './normalizar-dedicacion';
import { JERARQUIA_POSGRADO } from '../catalogo/tipo-posgrado.service';
import type {
  AlertasDocente,
  CondicionesPlantellDto,
  DedicacionConeauItem,
  DedicacionTipoItem,
  DistribucionSemaforosDto,
  PosgradoTipoItem,
  DocenteAccionRequerida,
  FilaDocenteListado,
  ListadoDocentesCarreraDto,
  ResultadoAccionRequerida,
  ResultadoIP01,
  ResultadoIP02,
  ResultadoIP03,
  ResultadoIP04,
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

    const [[ip01, ip02, ip03, ip08, ip04, ip09, ip10, ip13, r10, r12], [r03result, r04Results]] =
      await Promise.all([mainP, arP]);

    const accionRequerida = this.buildAccionRequerida(ip13, r10, r03result, r04Results);

    // Listado de docentes: calculado con los mismos datos vigentes; incluido en el
    // snapshot para garantizar consistencia temporal en exportaciones PDF posteriores.
    // Un fallo en el listado no interrumpe el análisis principal.
    let listadoDocentes: import('./tablero-carrera.dto').ListadoDocentesCarreraDto | undefined;
    try {
      listadoDocentes = await this.consultarListadoDocentes(carreraId, usuarioId, rolNombre);
    } catch { /* listado no disponible — snapshot guardará el campo como ausente */ }

    // Condiciones del plantel (B-03): fallo gracioso igual que listadoDocentes.
    // ip08 ya está calculado — se reutiliza para evitar una segunda consulta de cargos.
    let condicionesPlantell: CondicionesPlantellDto | undefined;
    try {
      condicionesPlantell = await this.calcularCondicionesPlantell(carreraId, fechaEvaluacion, ip08);
    } catch { /* campo ausente en snapshot si falla */ }

    return {
      carreraId,
      fechaEvaluacion: fechaEvaluacion.toISOString(),
      ip01,
      ip02,
      ip03,
      ip04,
      ip08,
      ip09,
      ip10,
      ip13,
      r10,
      r12,
      accionRequerida,
      listadoDocentes,
      condicionesPlantell,
      estadoGeneralCalculo: estadoMasRestrictivo(
        ip01.estadoCalculo, ip02.estadoCalculo,
        ip03.estadoCalculo, ip04.estadoCalculo, ip08.estadoCalculo,
        ip09.estadoCalculo, ip10.estadoCalculo, ip13.estadoCalculo,
        r10.estadoCalculo, r12.estadoCalculo,
      ),
    };
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
   * Total = todas las materias en planes de la carrera (sin filtro de estado de materia,
   * consistente con R-08 que evalúa todas las materias del plan).
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
      this.prisma.materia.count({ where: { planEstudioId: { in: planIds } } }),
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
        materia: { select: { id: true, nombre: true, cargaHorariaSemanal: true } },
        docente: {
          select: {
            nombre: true, apellido: true,
            sexo: true, fechaNacimiento: true, cuit: true,
            pisoDepto: true, residencia: true, tipoDocumento: true,
            tituloGrado: true, areaDisciplinarId: true,
          },
        },
      },
    });

    type MatEntry = { materiaId: string; nombre: string; cargaHorariaSemanal: number | null };
    type DocEntry = {
      nombre: string; apellido: string;
      sexo: string | null; fechaNacimiento: Date | null; cuit: string | null;
      pisoDepto: string | null; residencia: string | null; tipoDocumento: string;
      tituloGrado: string | null; areaDisciplinarId: string | null;
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
        totales: { total: 0, conAlertas: 0, sobreasignados: 0, bajaDedicacion: 0, fichaIncompleta: 0 },
        distribucionSemaforos: { verde: 0, amarillo: 0, rojo: 0, total: 0 },
        estadoCalculo: EstadoCalculo.NO_APLICA,
      };
    }

    // ── Evaluadores en paralelo ────────────────────────────────────────────────
    const args = { carreraId, usuarioId, rolNombre, fechaEvaluacion };
    const planes = await this.prisma.planEstudio.findMany({
      where: { carreraId },
      select: { id: true },
    });

    const [r03result, r07result, r10result, r12result, r04Results] = await Promise.all([
      this.r03.evaluar(args),
      this.r07.evaluar(args),
      this.r10.evaluar(args),
      this.r12.evaluar(args),
      planes.length === 0
        ? Promise.resolve([] as Awaited<ReturnType<typeof this.r04.evaluar>>[])
        : Promise.all(planes.map(p => this.r04.evaluar({ ...args, planEstudioId: p.id }))),
    ]);

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
      totales,
      distribucionSemaforos,
      estadoCalculo,
    };
  }

  /**
   * B-03: Condiciones del plantel (FSD §9.2).
   *
   * Indicadores CONEAU derivados sin modificar esquema:
   *   conPosgrado:          Docente.tituloPosgrado not null (boolean).
   *   conInvestigacion:     Docente.tituloProyectoInvestigacion not null.
   *   conDesignacionRegular: CargoDocente vigente con designacion contiene "Regular".
   *   dedicacionPorTipo:    distribución por Designacion.nombre vía VinculacionCatedra APROBADA.
   */
  private async calcularCondicionesPlantell(
    carreraId: string,
    fechaCalculo: Date,
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
        dedicacionConeau: [],
        estadoCalculo: EstadoCalculo.NO_APLICA,
      };
    }

    const docenteIds = vincsIds.map(v => v.docenteId);

    const [docentes, cargosRegulares, cargosInterinos, vincsConDesig] = await Promise.all([
      this.prisma.docente.findMany({
        where: { id: { in: docenteIds } },
        select: { id: true, tituloPosgrado: true, tituloProyectoInvestigacion: true, dedicacion: true, tipoPosgrado: { select: { nombre: true } } },
      }),
      this.prisma.cargoDocente.findMany({
        where: {
          docenteId: { in: docenteIds },
          fechaInicio: { lte: fechaCalculo },
          OR: [{ fechaFin: null }, { fechaFin: { gt: fechaCalculo } }],
          designacion: { contains: 'Regular', mode: 'insensitive' },
        },
        select: { docenteId: true },
        distinct: ['docenteId'],
      }),
      this.prisma.cargoDocente.findMany({
        where: {
          docenteId: { in: docenteIds },
          fechaInicio: { lte: fechaCalculo },
          OR: [{ fechaFin: null }, { fechaFin: { gt: fechaCalculo } }],
          designacion: { contains: 'Interino', mode: 'insensitive' },
        },
        select: { docenteId: true },
        distinct: ['docenteId'],
      }),
      this.prisma.vinculacionCatedra.findMany({
        where: { carreraId, estado: 'APROBADA', docente: { activo: true } },
        select: { docenteId: true, designacion: { select: { nombre: true } } },
        distinct: ['docenteId', 'designacionId'],
      }),
    ]);

    const conPosgrado      = docentes.filter(d => !!d.tituloPosgrado).length;
    const conInvestigacion = docentes.filter(d => !!d.tituloProyectoInvestigacion).length;

    // D-06: distribución por nivel máximo de posgrado CONEAU (null = no clasificado, no es SIN_POSGRADO)
    const posgradoConteo = new Map<string, number>();
    for (const d of docentes) {
      if (d.tipoPosgrado) {
        posgradoConteo.set(d.tipoPosgrado.nombre, (posgradoConteo.get(d.tipoPosgrado.nombre) ?? 0) + 1);
      }
    }
    const distribucionPosgrado: PosgradoTipoItem[] = JERARQUIA_POSGRADO
      .filter(nombre => posgradoConteo.has(nombre))
      .map(nombre => ({ tipo: nombre, docentes: posgradoConteo.get(nombre)! }));

    // Primera designación encontrada por docente determina su categoría.
    // Nota: los valores son categorías de designación (REGULAR RENTADO, INTERINO RENTADO…),
    // no rangos de dedicación horaria. Fuente de dedicación pendiente (PD-1, IMPL-19B.3-B.0).
    const dedMap = new Map<string, string>();
    for (const v of vincsConDesig) {
      if (!dedMap.has(v.docenteId)) dedMap.set(v.docenteId, v.designacion.nombre);
    }
    const conteoPorTipo = new Map<string, number>();
    for (const tipo of dedMap.values()) {
      conteoPorTipo.set(tipo, (conteoPorTipo.get(tipo) ?? 0) + 1);
    }
    const dedicacionPorTipo: DedicacionTipoItem[] = [...conteoPorTipo.entries()]
      .map(([tipo, docentes]) => ({ tipo, docentes }))
      .sort((a, b) => b.docentes - a.docentes);

    const relacionPA: CondicionesPlantellDto['relacionPA'] =
      ip08.estadoCalculo !== EstadoCalculo.NO_APLICA
        ? { profesores: ip08.profesores, auxiliares: ip08.auxiliares }
        : undefined;

    // Distribución CONEAU por Docente.dedicacion (normalización conservadora)
    const coneauConteo = new Map<string, number>();
    for (const d of docentes) {
      const cat = normalizarDedicacionConeau(d.dedicacion);
      coneauConteo.set(cat, (coneauConteo.get(cat) ?? 0) + 1);
    }
    const dedicacionConeau: DedicacionConeauItem[] = ORDEN_DEDICACION_CONEAU
      .filter(cat => coneauConteo.has(cat))
      .map(cat => ({ categoria: cat, docentes: coneauConteo.get(cat)! }));

    return {
      totalDocentes: docenteIds.length,
      conPosgrado,
      conInvestigacion,
      conDesignacionRegular: cargosRegulares.length,
      conDesignacionInterina: cargosInterinos.length,
      relacionPA,
      dedicacionPorTipo,
      dedicacionConeau,
      distribucionPosgrado,
      estadoCalculo: EstadoCalculo.CALCULADO,
    };
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
}
