import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { R06EvaluadorService } from '../indicadores/r06.evaluador';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type {
  BloqueCargaAcademica,
  BloqueComposicion,
  BloqueDedicaciones,
  BloqueDistribucionMaterias,
  BloqueFormacion,
  BloqueInvestigacion,
  TablroFacultadResponseDto,
} from './tablero-facultad.dto';

// ── Autorización ──────────────────────────────────────────────────────────────

const ROLES_MODAUT_FACULTAD = new Set([
  'ADMINISTRADOR_SISTEMA',
  'SECRETARIA_ACADEMICA',
  'RECTORADO',
  'DECANO',
]);

// ── Clasificación de cargos ───────────────────────────────────────────────────

const CARGOS_PROFESOR = new Set([
  'TITULAR', 'PROFESOR TITULAR', 'ASOCIADO', 'PROFESOR ASOCIADO',
  'ADJUNTO', 'PROFESOR ADJUNTO',
]);

const CARGOS_AUXILIAR = new Set([
  'JTP', 'JEFE DE TRABAJOS PRÁCTICOS', 'JEFE DE TRABAJOS PRACTICOS',
  'AYUDANTE GRADUADO', 'AYUDANTE NO GRADUADO',
]);

function categorizarCargo(nombre: string): 'P' | 'A' | 'O' {
  const n = nombre.trim().toUpperCase();
  if (CARGOS_PROFESOR.has(n)) return 'P';
  if (CARGOS_AUXILIAR.has(n)) return 'A';
  return 'O';
}

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

// ── Servicio ──────────────────────────────────────────────────────────────────

@Injectable()
export class TablroFacultadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r06: R06EvaluadorService,
  ) {}

  async consultarFacultad(
    facultadId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<TablroFacultadResponseDto> {
    if (!ROLES_MODAUT_FACULTAD.has(rolNombre)) {
      throw new ForbiddenException('Rol sin acceso al tablero de facultad');
    }

    const facultad = await this.prisma.facultad.findUnique({
      where: { id: facultadId },
      select: { id: true },
    });
    if (!facultad) throw new NotFoundException(`Facultad ${facultadId} no encontrada`);

    const fechaEvaluacion = new Date();

    const [composicion, formacion, investigacion, dedicaciones, cargaAcademica, distribucionMaterias] =
      await Promise.all([
        this.calcularComposicion(facultadId),
        this.calcularFormacion(facultadId),
        this.calcularInvestigacion(facultadId),
        this.calcularDedicaciones(facultadId),
        this.calcularCargaAcademica(facultadId),
        this.calcularDistribucionMaterias(facultadId, fechaEvaluacion),
      ]);

    return {
      facultadId,
      fechaEvaluacion: fechaEvaluacion.toISOString(),
      composicion,
      formacion,
      investigacion,
      dedicaciones,
      cargaAcademica,
      distribucionMaterias,
      estadoGeneralCalculo: estadoMasRestrictivo(
        composicion.estadoCalculo,
        formacion.estadoCalculo,
        investigacion.estadoCalculo,
        dedicaciones.estadoCalculo,
        cargaAcademica.estadoCalculo,
        distribucionMaterias.estadoCalculo,
      ),
    };
  }

  /**
   * Bloque 6 — Distribución de materias por docente (R-06).
   * Delega en R06EvaluadorService.evaluarPorFacultad; mapea el resultado al bloque DTO.
   */
  private async calcularDistribucionMaterias(
    facultadId: string,
    fechaEvaluacion: Date,
  ): Promise<BloqueDistribucionMaterias> {
    const resultado = await this.r06.evaluarPorFacultad(facultadId, fechaEvaluacion);
    // R-06 siempre es IMPLEMENTADO → estadoCalculo y valor nunca son null (ver invariante ResultadoIndicador)
    const v = resultado.valor!;
    return {
      totalDocentes: v.totalDocentes,
      promedio: v.promedio,
      mediana: v.mediana,
      maximo: v.maximo,
      distribucion: v.distribucion,
      estadoCalculo: resultado.estadoCalculo!,
    };
  }

  /**
   * Bloque 1 — Composición del plantel.
   * Docentes activos con al menos una vinculación APROBADA en la facultad.
   * Cargos desglosados por categoría P/A/Otros y por carrera.
   */
  private async calcularComposicion(facultadId: string): Promise<BloqueComposicion> {
    const vinculaciones = await this.prisma.vinculacionCatedra.findMany({
      where: { facultadId, estado: 'APROBADA', docente: { activo: true } },
      select: {
        docenteId: true,
        carreraId: true,
        carrera: { select: { nombre: true } },
        cargo: { select: { nombre: true } },
      },
    });

    if (vinculaciones.length === 0) {
      return {
        totalDocentes: 0,
        totalCargosP: 0,
        totalCargosA: 0,
        totalCargosOtros: 0,
        totalCargos: 0,
        porCarrera: [],
        estadoCalculo: EstadoCalculo.NO_APLICA,
      };
    }

    const docentesUnicos = new Set(vinculaciones.map((v) => v.docenteId));
    let totalCargosP = 0, totalCargosA = 0, totalCargosOtros = 0;

    for (const v of vinculaciones) {
      const cat = categorizarCargo(v.cargo.nombre);
      if (cat === 'P') totalCargosP++;
      else if (cat === 'A') totalCargosA++;
      else totalCargosOtros++;
    }

    // Agrupación por carrera
    const porCarreraMap = new Map<string, { nombre: string; docentes: Set<string>; cargos: number }>();
    for (const v of vinculaciones) {
      if (!porCarreraMap.has(v.carreraId)) {
        porCarreraMap.set(v.carreraId, { nombre: v.carrera.nombre, docentes: new Set(), cargos: 0 });
      }
      const entry = porCarreraMap.get(v.carreraId)!;
      entry.docentes.add(v.docenteId);
      entry.cargos++;
    }

    const porCarrera = Array.from(porCarreraMap.entries()).map(([carreraId, e]) => ({
      carreraId,
      nombreCarrera: e.nombre,
      totalDocentes: e.docentes.size,
      totalCargos: e.cargos,
    }));

    return {
      totalDocentes: docentesUnicos.size,
      totalCargosP,
      totalCargosA,
      totalCargosOtros,
      totalCargos: vinculaciones.length,
      porCarrera,
      estadoCalculo: EstadoCalculo.CALCULADO,
    };
  }

  /**
   * Bloque 2 — Formación docente.
   * Titulación de grado y posgrado del plantel activo.
   * completitudPromedio: porcentaje de docentes con tituloGrado (campo mínimo requerido).
   */
  private async calcularFormacion(facultadId: string): Promise<BloqueFormacion> {
    const docenteIds = await this.prisma.vinculacionCatedra.findMany({
      where: { facultadId, estado: 'APROBADA', docente: { activo: true } },
      select: { docenteId: true },
      distinct: ['docenteId'],
    });

    if (docenteIds.length === 0) {
      return {
        totalDocentes: 0,
        conTituloGrado: 0,
        conTituloPosgrado: 0,
        sinTituloGrado: 0,
        sinTituloPosgrado: 0,
        completitudPromedio: null,
        estadoCalculo: EstadoCalculo.NO_APLICA,
      };
    }

    const ids = docenteIds.map((d) => d.docenteId);
    const docentes = await this.prisma.docente.findMany({
      where: { id: { in: ids } },
      select: { id: true, tituloGrado: true, tituloPosgrado: true },
    });

    const conTituloGrado = docentes.filter((d) => !!d.tituloGrado).length;
    const conTituloPosgrado = docentes.filter((d) => !!d.tituloPosgrado).length;

    return {
      totalDocentes: docentes.length,
      conTituloGrado,
      conTituloPosgrado,
      sinTituloGrado: docentes.length - conTituloGrado,
      sinTituloPosgrado: docentes.length - conTituloPosgrado,
      completitudPromedio: Math.round((conTituloGrado / docentes.length) * 100),
      estadoCalculo: EstadoCalculo.CALCULADO,
    };
  }

  /**
   * Bloque 3 — Investigación y vinculación.
   * Docentes con proyecto de investigación y/o actividad de extensión declarados.
   */
  private async calcularInvestigacion(facultadId: string): Promise<BloqueInvestigacion> {
    const docenteIds = await this.prisma.vinculacionCatedra.findMany({
      where: { facultadId, estado: 'APROBADA', docente: { activo: true } },
      select: { docenteId: true },
      distinct: ['docenteId'],
    });

    if (docenteIds.length === 0) {
      return {
        totalDocentes: 0,
        conProyectoInvestigacion: 0,
        conActividadExtension: 0,
        conAmbasActividades: 0,
        sinNinguna: 0,
        estadoCalculo: EstadoCalculo.NO_APLICA,
      };
    }

    const ids = docenteIds.map((d) => d.docenteId);
    const docentes = await this.prisma.docente.findMany({
      where: { id: { in: ids } },
      select: { id: true, tituloProyectoInvestigacion: true, tituloActividadExtension: true },
    });

    let conPI = 0, conExt = 0, conAmbas = 0;
    for (const d of docentes) {
      const tienePI = !!d.tituloProyectoInvestigacion;
      const tieneExt = !!d.tituloActividadExtension;
      if (tienePI) conPI++;
      if (tieneExt) conExt++;
      if (tienePI && tieneExt) conAmbas++;
    }

    return {
      totalDocentes: docentes.length,
      conProyectoInvestigacion: conPI,
      conActividadExtension: conExt,
      conAmbasActividades: conAmbas,
      sinNinguna: docentes.length - (conPI + conExt - conAmbas),
      estadoCalculo: EstadoCalculo.CALCULADO,
    };
  }

  /**
   * Bloque 4 — Dedicaciones.
   * Docentes con cargaHorariaSemanal < p02BajaH (umbral de baja dedicación).
   * Si no existe config, usa 20h como umbral por defecto.
   */
  private async calcularDedicaciones(facultadId: string): Promise<BloqueDedicaciones> {
    const [docenteIds, config] = await Promise.all([
      this.prisma.vinculacionCatedra.findMany({
        where: { facultadId, estado: 'APROBADA', docente: { activo: true } },
        select: { docenteId: true },
        distinct: ['docenteId'],
      }),
      this.prisma.autoevaluacionConfigFacultad.findUnique({
        where: { facultadId },
        select: { p02BajaH: true },
      }),
    ]);

    const umbral = config?.p02BajaH ?? 20;

    if (docenteIds.length === 0) {
      return {
        totalDocentes: 0,
        umbral,
        totalBajaDedicacion: 0,
        totalSinDatos: 0,
        enAlerta: [],
        estadoCalculo: EstadoCalculo.NO_APLICA,
      };
    }

    const ids = docenteIds.map((d) => d.docenteId);
    const docentes = await this.prisma.docente.findMany({
      where: { id: { in: ids } },
      select: { id: true, nombre: true, apellido: true },
    });

    // cargaHorariaSemanal está en Materia, no en Docente.
    // Obtenemos la suma de horas por docente via vinculaciones.
    const horasPorDocente = await this.prisma.vinculacionCatedra.groupBy({
      by: ['docenteId'],
      where: {
        facultadId,
        estado: 'APROBADA',
        docente: { activo: true },
        materia: { cargaHorariaSemanal: { not: null } },
      },
      _sum: { horasSemana: true },
    });

    const horasMap = new Map(horasPorDocente.map((h) => [h.docenteId, h._sum.horasSemana ?? 0]));

    const enAlerta: BloqueDedicaciones['enAlerta'] = [];
    let totalSinDatos = 0;

    for (const d of docentes) {
      const horas = horasMap.get(d.id);
      if (horas === undefined) {
        totalSinDatos++;
      } else if (horas < umbral) {
        enAlerta.push({
          docenteId: d.id,
          nombre: `${d.apellido}, ${d.nombre}`,
          cargaHorariaSemanal: horas,
        });
      }
    }

    const ec =
      enAlerta.length === 0 && totalSinDatos === 0
        ? EstadoCalculo.CALCULADO
        : totalSinDatos > 0 && enAlerta.length === 0
        ? EstadoCalculo.PARCIAL
        : EstadoCalculo.CALCULADO;

    return {
      totalDocentes: docentes.length,
      umbral,
      totalBajaDedicacion: enAlerta.length,
      totalSinDatos,
      enAlerta,
      estadoCalculo: ec,
    };
  }

  /**
   * Bloque 5 — Carga académica.
   * Docentes sobreasignados a nivel facultad (nMaterias > p03MaxMat).
   * Universo: docentes activos con vinculaciones APROBADAS en la facultad.
   * Unidad de conteo: (planEstudioId, materiaId, catedraId) distintos por docenteId.
   */
  private async calcularCargaAcademica(facultadId: string): Promise<BloqueCargaAcademica> {
    const config = await this.prisma.autoevaluacionConfigFacultad.findUnique({
      where: { facultadId },
      select: { p03MaxMat: true },
    });

    if (!config) {
      return {
        totalDocentes: 0,
        limiteMaxMat: null,
        totalSobreasignados: 0,
        sobreasignados: [],
        estadoCalculo: EstadoCalculo.NO_DETERMINABLE,
      };
    }

    const limite = config.p03MaxMat;

    const vinculaciones = await this.prisma.vinculacionCatedra.findMany({
      where: { facultadId, estado: 'APROBADA', docente: { activo: true } },
      select: {
        docenteId: true,
        planEstudioId: true,
        materiaId: true,
        catedraId: true,
        docente: { select: { nombre: true, apellido: true } },
      },
    });

    if (vinculaciones.length === 0) {
      return {
        totalDocentes: 0,
        limiteMaxMat: limite,
        totalSobreasignados: 0,
        sobreasignados: [],
        estadoCalculo: EstadoCalculo.NO_APLICA,
      };
    }

    // Conteo de combinaciones (planEstudioId, materiaId, catedraId) distintas por docente
    type Key = string;
    const asignacionesPorDocente = new Map<string, { nombre: string; claves: Set<Key> }>();

    for (const v of vinculaciones) {
      if (!asignacionesPorDocente.has(v.docenteId)) {
        asignacionesPorDocente.set(v.docenteId, {
          nombre: `${v.docente.apellido}, ${v.docente.nombre}`,
          claves: new Set(),
        });
      }
      const entry = asignacionesPorDocente.get(v.docenteId)!;
      entry.claves.add(`${v.planEstudioId}:${v.materiaId}:${v.catedraId}`);
    }

    const sobreasignados: BloqueCargaAcademica['sobreasignados'] = [];

    for (const [docenteId, entry] of asignacionesPorDocente) {
      const n = entry.claves.size;
      if (n > limite) {
        sobreasignados.push({
          docenteId,
          nombre: entry.nombre,
          nMaterias: n,
          exceso: n - limite,
        });
      }
    }

    return {
      totalDocentes: asignacionesPorDocente.size,
      limiteMaxMat: limite,
      totalSobreasignados: sobreasignados.length,
      sobreasignados,
      estadoCalculo: EstadoCalculo.CALCULADO,
    };
  }
}
