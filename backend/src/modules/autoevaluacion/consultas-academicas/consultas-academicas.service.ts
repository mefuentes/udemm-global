import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ScopeService } from '../../scopes/scope.service';
import type {
  BloqueNormalizado,
  CargosParaR04,
  CarreraAut,
  ConfigFacultadAut,
  ConfigFormacionPracticaAut,
  DocenteConCargosR04,
  DocenteFichaAut,
  DocenteParaListado,
  DocentesParaIP09,
  DocentesParaR03,
  DocentesParaR10,
  DocentesParaR12,
  DocenteVigenteIP09,
  DocenteVigenteR03,
  DocenteVigenteR10,
  EstadoSeccion,
  FacultadAut,
  MateriaProgramaAut,
  MateriaAut,
  PlanEstudioAut,
  ProgramaAut,
  UmbralesAut,
  VinculacionAut,
  VinculacionesParaR07,
} from './consultas-academicas.types';

/**
 * Roles habilitados para acceder a MOD-AUT.
 * ADMINISTRATIVO queda excluido aunque ScopeService lo trate como global.
 */
const ROLES_MODAUT = new Set([
  'ADMINISTRADOR_SISTEMA',
  'SECRETARIA_ACADEMICA',
  'RECTORADO',
  'DECANO',
  'DIRECTOR_CARRERA',
]);

@Injectable()
export class ConsultasAcademicasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
  ) {}

  // ── helpers privados ──────────────────────────────────────────────────────

  private checkRol(rolNombre: string): void {
    if (!ROLES_MODAUT.has(rolNombre)) {
      throw new ForbiddenException('Rol sin acceso a MOD-AUT');
    }
  }

  /**
   * Normaliza el valor libre de bloqueConocimiento a los cuatro bloques
   * reconocidos por MOD-AUT. El valor original se conserva en bloqueConocimientoRaw.
   *
   * Mapeo:
   *   "CB"                 → 'CB'
   *   "TB"                 → 'TB'
   *   "TA"                 → 'TA'
   *   "CX" / "CTX" / "CTC" → 'CX'  (Ciencias y Tecnologías Complementarias)
   *   null o desconocido   → null   (dato no clasificado, no se inventa)
   */
  normalizarBloque(bloqueConocimiento: string | null | undefined): BloqueNormalizado {
    if (!bloqueConocimiento) return null;
    const v = bloqueConocimiento.trim().toUpperCase();
    if (v === 'CB') return 'CB';
    if (v === 'TB') return 'TB';
    if (v === 'TA') return 'TA';
    if (v === 'CTX' || v === 'CX' || v === 'CTC') return 'CX';
    return null;
  }

  private async verificarScopeFacultad(
    facultadId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<void> {
    const GLOBALES = new Set(['ADMINISTRADOR_SISTEMA', 'SECRETARIA_ACADEMICA', 'RECTORADO']);
    if (GLOBALES.has(rolNombre)) return;

    if (rolNombre === 'DECANO') {
      const asoc = await this.prisma.usuarioFacultad.findFirst({
        where: { usuarioId, facultadId },
      });
      if (!asoc) throw new ForbiddenException();
      return;
    }

    if (rolNombre === 'DIRECTOR_CARRERA') {
      const carrerasScope = await this.scope.getCarrerasEnScope(usuarioId, rolNombre);
      if (!carrerasScope || carrerasScope.length === 0) throw new ForbiddenException();
      const carreraEnFacultad = await this.prisma.carrera.findFirst({
        where: { id: { in: carrerasScope }, facultadId },
      });
      if (!carreraEnFacultad) throw new ForbiddenException();
      return;
    }

    throw new ForbiddenException();
  }

  private mapUmbrales(p: {
    horasMinTotales: number | null;
    horasMinCB: number | null;
    horasMinTB: number | null;
    horasMinTA: number | null;
    horasMinCTX: number | null;
  }): UmbralesAut {
    return {
      horasMinTotales: p.horasMinTotales,
      horasMinCB: p.horasMinCB,
      horasMinTB: p.horasMinTB,
      horasMinTA: p.horasMinTA,
      horasMinCTX: p.horasMinCTX,
    };
  }

  // ── Estructura institucional ──────────────────────────────────────────────

  /**
   * Devuelve las facultades accesibles según el alcance del usuario.
   * - Global: todas las facultades.
   * - DECANO/DIRECTOR_CARRERA: solo las facultades de sus carreras.
   */
  async obtenerFacultadesEnScope(
    usuarioId: string,
    rolNombre: string,
  ): Promise<FacultadAut[]> {
    this.checkRol(rolNombre);

    const carrerasScope = await this.scope.getCarrerasEnScope(usuarioId, rolNombre);

    if (carrerasScope === null) {
      return this.prisma.facultad.findMany({
        select: { id: true, nombre: true, estado: true, codigo: true },
        orderBy: { nombre: 'asc' },
      });
    }

    if (carrerasScope.length === 0) return [];

    const carreras = await this.prisma.carrera.findMany({
      where: { id: { in: carrerasScope } },
      select: { facultad: { select: { id: true, nombre: true, estado: true, codigo: true } } },
    });

    const seen = new Set<string>();
    const result: FacultadAut[] = [];
    for (const c of carreras) {
      if (!seen.has(c.facultad.id)) {
        seen.add(c.facultad.id);
        result.push(c.facultad);
      }
    }
    return result.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  /**
   * Devuelve las carreras accesibles en el alcance del usuario,
   * opcionalmente filtradas por facultad.
   */
  async obtenerCarrerasEnScope(
    facultadId: string | null,
    usuarioId: string,
    rolNombre: string,
  ): Promise<CarreraAut[]> {
    this.checkRol(rolNombre);

    const carrerasScope = await this.scope.getCarrerasEnScope(usuarioId, rolNombre);

    const where: Record<string, unknown> = {};
    if (facultadId) where['facultadId'] = facultadId;
    if (carrerasScope !== null) where['id'] = { in: carrerasScope };

    return this.prisma.carrera.findMany({
      where,
      select: { id: true, nombre: true, facultadId: true, estado: true, codigo: true },
      orderBy: { nombre: 'asc' },
    });
  }

  /**
   * Devuelve todos los planes de una carrera autorizada,
   * incluyendo sus umbrales horarios configurados.
   */
  async obtenerPlanesDeCarrera(
    carreraId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<PlanEstudioAut[]> {
    this.checkRol(rolNombre);

    const tieneScope = await this.scope.tieneScopeCarrera(usuarioId, rolNombre, carreraId);
    if (!tieneScope) throw new ForbiddenException();

    const planes = await this.prisma.planEstudio.findMany({
      where: { carreraId },
      select: {
        id: true, nombre: true, carreraId: true, version: true, anio: true,
        estado: true, fechaAprobacion: true,
        horasMinTotales: true, horasMinCB: true, horasMinTB: true,
        horasMinTA: true, horasMinCTX: true,
      },
      orderBy: [{ anio: 'desc' }, { nombre: 'asc' }],
    });

    return planes.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      carreraId: p.carreraId,
      version: p.version,
      anio: p.anio,
      estado: p.estado,
      fechaAprobacion: p.fechaAprobacion,
      umbrales: this.mapUmbrales(p),
    }));
  }

  // ── Materias y bloques curriculares ───────────────────────────────────────

  /**
   * Devuelve las materias de un plan con bloque normalizado.
   * Las cargas horarias NULL se conservan sin conversión.
   */
  async obtenerMateriasDePlan(
    planEstudioId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<MateriaAut[]> {
    this.checkRol(rolNombre);

    const plan = await this.prisma.planEstudio.findUnique({
      where: { id: planEstudioId },
      select: { carreraId: true },
    });
    if (!plan) throw new NotFoundException(`Plan ${planEstudioId} no encontrado`);

    const tieneScope = await this.scope.tieneScopeCarrera(usuarioId, rolNombre, plan.carreraId);
    if (!tieneScope) throw new ForbiddenException();

    const materias = await this.prisma.materia.findMany({
      where: { planEstudioId },
      select: {
        id: true, codigo: true, nombre: true, planEstudioId: true, estado: true,
        anio: true, cuatrimestre: true, bloqueConocimiento: true,
        cargaHorariaSemanal: true, cargaHorariaTotal: true, tipoAsignatura: true,
      },
      orderBy: [{ anio: 'asc' }, { cuatrimestre: 'asc' }, { nombre: 'asc' }],
    });

    return materias.map((m) => ({
      id: m.id,
      codigo: m.codigo,
      nombre: m.nombre,
      planEstudioId: m.planEstudioId,
      estado: m.estado,
      anio: m.anio,
      cuatrimestre: m.cuatrimestre,
      bloqueConocimientoRaw: m.bloqueConocimiento,
      bloqueNormalizado: this.normalizarBloque(m.bloqueConocimiento),
      cargaHorariaSemanal: m.cargaHorariaSemanal,
      cargaHorariaTotal: m.cargaHorariaTotal,
      tipoAsignatura: m.tipoAsignatura,
    }));
  }

  // ── Vinculaciones y docentes ──────────────────────────────────────────────

  /**
   * Devuelve todas las vinculaciones de un plan con datos del docente embebidos.
   * Se incluyen todos los estados (APROBADA, PENDIENTE, RECHAZADA, DESVINCULADA).
   * esResponsableCatedra null se conserva (no se convierte en false).
   *
   * Responsable efectivo = estado APROBADA + esResponsableCatedra = true.
   */
  async obtenerVinculacionesDePlan(
    planEstudioId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<VinculacionAut[]> {
    this.checkRol(rolNombre);

    const plan = await this.prisma.planEstudio.findUnique({
      where: { id: planEstudioId },
      select: { carreraId: true },
    });
    if (!plan) throw new NotFoundException(`Plan ${planEstudioId} no encontrado`);

    const tieneScope = await this.scope.tieneScopeCarrera(usuarioId, rolNombre, plan.carreraId);
    if (!tieneScope) throw new ForbiddenException();

    const vinculaciones = await this.prisma.vinculacionCatedra.findMany({
      where: { planEstudioId },
      select: {
        id: true, materiaId: true, docenteId: true, catedraId: true,
        planEstudioId: true, carreraId: true, estado: true,
        esResponsableCatedra: true, horasSemana: true,
        docente: {
          select: {
            id: true, nombre: true, apellido: true, activo: true,
            dedicacion: true, categoriaDocente: true,
          },
        },
      },
    });

    return vinculaciones.map((v) => ({
      id: v.id,
      materiaId: v.materiaId,
      docenteId: v.docenteId,
      catedraId: v.catedraId,
      planEstudioId: v.planEstudioId,
      carreraId: v.carreraId,
      estado: v.estado,
      esResponsableCatedra: v.esResponsableCatedra,
      horasSemana: v.horasSemana,
      docente: {
        id: v.docente.id,
        nombre: v.docente.nombre,
        apellido: v.docente.apellido,
        activo: v.docente.activo,
        dedicacion: v.docente.dedicacion,
        categoriaDocente: v.docente.categoriaDocente,
      },
    }));
  }

  /**
   * Devuelve todas las vinculaciones de una carrera con datos del docente embebidos.
   * Agrega vinculaciones de todos los planes de la carrera en una sola consulta.
   * Se incluyen todos los estados; el consumidor filtra por estado = 'APROBADA'.
   */
  async obtenerVinculacionesDeCarrera(
    carreraId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<VinculacionAut[]> {
    this.checkRol(rolNombre);

    const carrera = await this.prisma.carrera.findUnique({
      where: { id: carreraId },
      select: { id: true },
    });
    if (!carrera) throw new NotFoundException(`Carrera ${carreraId} no encontrada`);

    const tieneScope = await this.scope.tieneScopeCarrera(usuarioId, rolNombre, carreraId);
    if (!tieneScope) throw new ForbiddenException();

    const vinculaciones = await this.prisma.vinculacionCatedra.findMany({
      where: { carreraId },
      select: {
        id: true, materiaId: true, docenteId: true, catedraId: true,
        planEstudioId: true, carreraId: true, estado: true,
        esResponsableCatedra: true, horasSemana: true,
        docente: {
          select: {
            id: true, nombre: true, apellido: true, activo: true,
            dedicacion: true, categoriaDocente: true,
          },
        },
      },
    });

    return vinculaciones.map((v) => ({
      id: v.id,
      materiaId: v.materiaId,
      docenteId: v.docenteId,
      catedraId: v.catedraId,
      planEstudioId: v.planEstudioId,
      carreraId: v.carreraId,
      estado: v.estado,
      esResponsableCatedra: v.esResponsableCatedra,
      horasSemana: v.horasSemana,
      docente: {
        id: v.docente.id,
        nombre: v.docente.nombre,
        apellido: v.docente.apellido,
        activo: v.docente.activo,
        dedicacion: v.docente.dedicacion,
        categoriaDocente: v.docente.categoriaDocente,
      },
    }));
  }

  /**
   * Devuelve la config MOD-AUT de la facultad a la que pertenece la carrera.
   * Útil para evaluadores con alcance CARRERA que necesitan parámetros de facultad.
   * Retorna null si no existe configuración creada para la facultad.
   */
  async obtenerConfigDeCarrera(
    carreraId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<ConfigFacultadAut | null> {
    this.checkRol(rolNombre);

    const carrera = await this.prisma.carrera.findUnique({
      where: { id: carreraId },
      select: { facultadId: true },
    });
    if (!carrera) throw new NotFoundException(`Carrera ${carreraId} no encontrada`);

    const tieneScope = await this.scope.tieneScopeCarrera(usuarioId, rolNombre, carreraId);
    if (!tieneScope) throw new ForbiddenException();

    return this.obtenerConfigAut(carrera.facultadId, usuarioId, rolNombre);
  }

  // ── Vinculaciones para R-06 (cross-carrera / alcance facultad) ──────────

  /**
   * Devuelve las vinculaciones necesarias para el evaluador R-06 con el alcance
   * adecuado al rol del usuario.
   *
   * Roles globales (ADMIN/SECRETARIA/RECTORADO) y DECANO: devuelven TODAS las
   * vinculaciones de la facultad (alcanceFacultad=true).
   * DIRECTOR_CARRERA: devuelve solo la carrera solicitada (alcanceFacultad=false).
   *   El evaluador debe producir EstadoCalculo.PARCIAL en ese caso.
   *
   * Seguridad:
   * - El scope sobre carreraId se verifica vía tieneScopeCarrera antes de consultar.
   * - Para DECANO, tieneScopeCarrera ya garantiza que su facultad coincide con la carrera.
   */
  async obtenerVinculacionesParaR06(
    carreraId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<VinculacionesParaR07> {
    this.checkRol(rolNombre);

    const carrera = await this.prisma.carrera.findUnique({
      where: { id: carreraId },
      select: { id: true, facultadId: true },
    });
    if (!carrera) throw new NotFoundException(`Carrera ${carreraId} no encontrada`);

    const tieneScope = await this.scope.tieneScopeCarrera(usuarioId, rolNombre, carreraId);
    if (!tieneScope) throw new ForbiddenException();

    const { facultadId } = carrera;

    const ROLES_ALCANCE_FACULTAD = new Set([
      'ADMINISTRADOR_SISTEMA',
      'SECRETARIA_ACADEMICA',
      'RECTORADO',
      'DECANO',
    ]);
    const alcanceFacultad = ROLES_ALCANCE_FACULTAD.has(rolNombre);

    const rows = await this.prisma.vinculacionCatedra.findMany({
      where: alcanceFacultad ? { facultadId } : { carreraId },
      select: {
        id: true, materiaId: true, docenteId: true, catedraId: true,
        planEstudioId: true, carreraId: true, estado: true,
        esResponsableCatedra: true, horasSemana: true,
        docente: {
          select: {
            id: true, nombre: true, apellido: true, activo: true,
            dedicacion: true, categoriaDocente: true,
          },
        },
      },
    });

    const vinculaciones: VinculacionAut[] = rows.map((v) => ({
      id: v.id,
      materiaId: v.materiaId,
      docenteId: v.docenteId,
      catedraId: v.catedraId,
      planEstudioId: v.planEstudioId,
      carreraId: v.carreraId,
      estado: v.estado,
      esResponsableCatedra: v.esResponsableCatedra,
      horasSemana: v.horasSemana,
      docente: {
        id: v.docente.id,
        nombre: v.docente.nombre,
        apellido: v.docente.apellido,
        activo: v.docente.activo,
        dedicacion: v.docente.dedicacion,
        categoriaDocente: v.docente.categoriaDocente,
      },
    }));

    const docentesMultiFacultad = alcanceFacultad
      ? await this.detectarDocentesMultiFacultad(
          [...new Set(vinculaciones.map((v) => v.docenteId))],
          facultadId,
        )
      : new Set<string>();

    return { vinculaciones, facultadId, alcanceFacultad, docentesMultiFacultad };
  }

  // ── Vinculaciones para R-06 por facultadId (usado por tablero de facultad) ──

  /**
   * Versión del método para el tablero de facultad: entrada por facultadId.
   * Sin verificación de scope/rol: el tablero ya autorizó al usuario con ROLES_MODAUT_FACULTAD.
   * Siempre alcanceFacultad=true (el tablero solo es accesible por roles de alcance facultad).
   */
  async obtenerVinculacionesParaR06PorFacultad(
    facultadId: string,
  ): Promise<VinculacionesParaR07> {
    const rows = await this.prisma.vinculacionCatedra.findMany({
      where: { facultadId },
      select: {
        id: true, materiaId: true, docenteId: true, catedraId: true,
        planEstudioId: true, carreraId: true, estado: true,
        esResponsableCatedra: true, horasSemana: true,
        docente: {
          select: {
            id: true, nombre: true, apellido: true, activo: true,
            dedicacion: true, categoriaDocente: true,
          },
        },
      },
    });

    const vinculaciones: VinculacionAut[] = rows.map((v) => ({
      id: v.id,
      materiaId: v.materiaId,
      docenteId: v.docenteId,
      catedraId: v.catedraId,
      planEstudioId: v.planEstudioId,
      carreraId: v.carreraId,
      estado: v.estado,
      esResponsableCatedra: v.esResponsableCatedra,
      horasSemana: v.horasSemana,
      docente: {
        id: v.docente.id,
        nombre: v.docente.nombre,
        apellido: v.docente.apellido,
        activo: v.docente.activo,
        dedicacion: v.docente.dedicacion,
        categoriaDocente: v.docente.categoriaDocente,
      },
    }));

    const docentesMultiFacultad = await this.detectarDocentesMultiFacultad(
      [...new Set(vinculaciones.map((v) => v.docenteId))],
      facultadId,
    );

    return { vinculaciones, facultadId, alcanceFacultad: true, docentesMultiFacultad };
  }

  // ── Configuración de formación práctica para R-13 (FSD §6.3) ─────────────

  /**
   * Devuelve la configuración de formación práctica de un Plan de Estudio.
   * Campos nullable: null = no configurado.
   * Verifica scope sobre la carrera del plan.
   */
  async obtenerConfigFormacionPlan(
    planEstudioId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<ConfigFormacionPracticaAut> {
    this.checkRol(rolNombre);

    const plan = await this.prisma.planEstudio.findUnique({
      where: { id: planEstudioId },
      select: { id: true, carreraId: true, requierePPS: true, requierePI: true, porcentajeMinFormacion: true },
    });
    if (!plan) throw new NotFoundException(`Plan de estudio ${planEstudioId} no encontrado`);

    const tieneScope = await this.scope.tieneScopeCarrera(usuarioId, rolNombre, plan.carreraId);
    if (!tieneScope) throw new ForbiddenException();

    return {
      planEstudioId: plan.id,
      requierePPS: plan.requierePPS ?? null,
      requierePI: plan.requierePI ?? null,
      porcentajeMinFormacion: plan.porcentajeMinFormacion ?? null,
    };
  }

  // ── Vinculaciones para R-07 (cross-carrera / cross-facultad) ─────────────

  /**
   * Devuelve las vinculaciones necesarias para el evaluador R-07 con el alcance
   * adecuado al rol del usuario.
   *
   * Roles globales (ADMIN/SECRETARIA/RECTORADO) y DECANO: devuelven TODAS las
   * vinculaciones de la facultad (alcanceFacultad=true).
   * DIRECTOR_CARRERA: devuelve solo la carrera solicitada (alcanceFacultad=false).
   *   El evaluador debe producir EstadoCalculo.PARCIAL en ese caso.
   *
   * Seguridad:
   * - El scope sobre carreraId se verifica vía tieneScopeCarrera antes de consultar.
   * - Para DECANO, tieneScopeCarrera ya garantiza que su facultad coincide con la carrera.
   * - El contenido retornado pertenece exclusivamente al ámbito autorizado.
   * - No se devuelven vinculaciones de otras facultades.
   */
  async obtenerVinculacionesParaR07(
    carreraId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<VinculacionesParaR07> {
    this.checkRol(rolNombre);

    const carrera = await this.prisma.carrera.findUnique({
      where: { id: carreraId },
      select: { id: true, facultadId: true },
    });
    if (!carrera) throw new NotFoundException(`Carrera ${carreraId} no encontrada`);

    const tieneScope = await this.scope.tieneScopeCarrera(usuarioId, rolNombre, carreraId);
    if (!tieneScope) throw new ForbiddenException();

    const { facultadId } = carrera;

    const ROLES_ALCANCE_FACULTAD = new Set([
      'ADMINISTRADOR_SISTEMA',
      'SECRETARIA_ACADEMICA',
      'RECTORADO',
      'DECANO',
    ]);
    const alcanceFacultad = ROLES_ALCANCE_FACULTAD.has(rolNombre);

    const rows = await this.prisma.vinculacionCatedra.findMany({
      where: alcanceFacultad ? { facultadId } : { carreraId },
      select: {
        id: true, materiaId: true, docenteId: true, catedraId: true,
        planEstudioId: true, carreraId: true, estado: true,
        esResponsableCatedra: true, horasSemana: true,
        materia: { select: { nombre: true } },
        docente: {
          select: {
            id: true, nombre: true, apellido: true, activo: true,
            dedicacion: true, categoriaDocente: true,
          },
        },
      },
    });

    const vinculaciones: VinculacionAut[] = rows.map((v) => ({
      id: v.id,
      materiaId: v.materiaId,
      materiaNombre: v.materia?.nombre,
      docenteId: v.docenteId,
      catedraId: v.catedraId,
      planEstudioId: v.planEstudioId,
      carreraId: v.carreraId,
      estado: v.estado,
      esResponsableCatedra: v.esResponsableCatedra,
      horasSemana: v.horasSemana,
      docente: {
        id: v.docente.id,
        nombre: v.docente.nombre,
        apellido: v.docente.apellido,
        activo: v.docente.activo,
        dedicacion: v.docente.dedicacion,
        categoriaDocente: v.docente.categoriaDocente,
      },
    }));

    // Detección interna de docentes con asignaciones en otras facultades.
    // Solo se ejecuta cuando el scope cubre toda la facultad.
    // No expone datos de otras facultades; solo indica presencia (sí/no).
    const docentesMultiFacultad = alcanceFacultad
      ? await this.detectarDocentesMultiFacultad(
          [...new Set(vinculaciones.map((v) => v.docenteId))],
          facultadId,
        )
      : new Set<string>();

    return { vinculaciones, facultadId, alcanceFacultad, docentesMultiFacultad };
  }

  // ── Docentes para R-12 (ficha de completitud) ────────────────────────────

  /**
   * Devuelve los docentes con al menos una vinculación APROBADA en el alcance
   * del usuario, junto con sus campos de ficha relevantes para R-12.
   *
   * Alcance:
   * - Roles globales y DECANO: toda la facultad (alcanceFacultad=true).
   * - DIRECTOR_CARRERA: solo la carrera solicitada (alcanceFacultad=false → PARCIAL).
   *
   * Un docente que aparece en múltiples cátedras de la facultad se devuelve una sola vez.
   * La detección cross-facultad sigue la misma lógica que R-07.
   */
  async obtenerDocentesParaR12(
    carreraId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<DocentesParaR12> {
    this.checkRol(rolNombre);

    const carrera = await this.prisma.carrera.findUnique({
      where: { id: carreraId },
      select: { id: true, facultadId: true },
    });
    if (!carrera) throw new NotFoundException(`Carrera ${carreraId} no encontrada`);

    const tieneScope = await this.scope.tieneScopeCarrera(usuarioId, rolNombre, carreraId);
    if (!tieneScope) throw new ForbiddenException();

    const { facultadId } = carrera;

    const ROLES_ALCANCE_FACULTAD = new Set([
      'ADMINISTRADOR_SISTEMA',
      'SECRETARIA_ACADEMICA',
      'RECTORADO',
      'DECANO',
    ]);
    const alcanceFacultad = ROLES_ALCANCE_FACULTAD.has(rolNombre);

    const rows = await this.prisma.vinculacionCatedra.findMany({
      where: {
        ...(alcanceFacultad ? { facultadId } : { carreraId }),
        estado: 'APROBADA',
        docente: { activo: true },
      },
      select: {
        docenteId: true,
        docente: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            activo: true,
            tituloGrado: true,
            areaDisciplinarId: true,
            fechaNacimiento: true,
            sexo: true,
          },
        },
      },
      distinct: ['docenteId'],
    });

    const docentes: DocenteFichaAut[] = rows.map((r) => ({
      docenteId: r.docenteId,
      nombre: r.docente.nombre,
      apellido: r.docente.apellido,
      activo: r.docente.activo,
      tituloGrado: r.docente.tituloGrado ?? null,
      areaDisciplinarId: r.docente.areaDisciplinarId ?? null,
      fechaNacimiento: r.docente.fechaNacimiento ?? null,
      sexo: r.docente.sexo ?? null,
    }));

    const docentesMultiFacultad = alcanceFacultad
      ? await this.detectarDocentesMultiFacultad(
          docentes.map((d) => d.docenteId),
          facultadId,
        )
      : new Set<string>();

    return { docentes, facultadId, alcanceFacultad, docentesMultiFacultad };
  }

  // ── Docentes para R-03 (tope semanal de horas) ───────────────────────────

  /**
   * Devuelve los docentes con al menos una VinculacionCatedra APROBADA en el scope,
   * con las horas de docencia acumuladas y los campos de ficha necesarios para R-03.
   *
   * Alcance:
   * - Roles globales y DECANO: toda la facultad (alcanceFacultad=true).
   * - DIRECTOR_CARRERA: solo la carrera solicitada (alcanceFacultad=false → PARCIAL).
   *
   * Horas de docencia: suma de Materia.cargaHorariaSemanal por vinculación APROBADA.
   * Cada asignación aporta las horas completas (FSD §5.3 — sin deduplicación).
   * Si alguna materia no tiene cargaHorariaSemanal, tieneMateriaSinHoras=true.
   */
  async obtenerDocentesParaR03(
    carreraId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<DocentesParaR03> {
    this.checkRol(rolNombre);

    const carrera = await this.prisma.carrera.findUnique({
      where: { id: carreraId },
      select: { id: true, facultadId: true },
    });
    if (!carrera) throw new NotFoundException(`Carrera ${carreraId} no encontrada`);

    const tieneScope = await this.scope.tieneScopeCarrera(usuarioId, rolNombre, carreraId);
    if (!tieneScope) throw new ForbiddenException();

    const { facultadId } = carrera;

    const ROLES_ALCANCE_FACULTAD = new Set([
      'ADMINISTRADOR_SISTEMA',
      'SECRETARIA_ACADEMICA',
      'RECTORADO',
      'DECANO',
    ]);
    const alcanceFacultad = ROLES_ALCANCE_FACULTAD.has(rolNombre);

    const rows = await this.prisma.vinculacionCatedra.findMany({
      where: {
        ...(alcanceFacultad ? { facultadId } : { carreraId }),
        estado: 'APROBADA',
        docente: { activo: true },
      },
      select: {
        docenteId: true,
        materia: { select: { cargaHorariaSemanal: true } },
        docente: {
          select: {
            nombre: true,
            apellido: true,
            tiempoDedicacionGestionSemanal: true,
            fechaFinGestion: true,
            funcionGestion: true,
            desempenoActualJson: true,
          },
        },
      },
    });

    const porDocente = new Map<string, {
      nombre: string;
      apellido: string;
      horasDocenciaConocidas: number;
      tieneMateriaSinHoras: boolean;
      tiempoDedicacionGestionSemanal: string | null;
      fechaFinGestion: string | null;
      funcionGestion: string | null;
      desempenoActualJson: string | null;
    }>();

    for (const v of rows) {
      if (!porDocente.has(v.docenteId)) {
        porDocente.set(v.docenteId, {
          nombre: v.docente.nombre,
          apellido: v.docente.apellido,
          horasDocenciaConocidas: 0,
          tieneMateriaSinHoras: false,
          tiempoDedicacionGestionSemanal: v.docente.tiempoDedicacionGestionSemanal ?? null,
          fechaFinGestion: v.docente.fechaFinGestion ?? null,
          funcionGestion: v.docente.funcionGestion ?? null,
          desempenoActualJson: v.docente.desempenoActualJson ?? null,
        });
      }
      const entry = porDocente.get(v.docenteId)!;
      const horas = v.materia?.cargaHorariaSemanal;
      if (horas === null || horas === undefined) {
        entry.tieneMateriaSinHoras = true;
      } else {
        entry.horasDocenciaConocidas += horas;
      }
    }

    const docentes: DocenteVigenteR03[] = Array.from(porDocente.entries()).map(
      ([docenteId, d]) => ({ docenteId, ...d }),
    );

    const docentesMultiFacultad = alcanceFacultad
      ? await this.detectarDocentesMultiFacultad(
          docentes.map((d) => d.docenteId),
          facultadId,
        )
      : new Set<string>();

    return { docentes, facultadId, alcanceFacultad, docentesMultiFacultad };
  }

  // ── Docentes para R-10 (dedicación total CONEAU) ────────────────────────

  /**
   * Devuelve los docentes con al menos una VinculacionCatedra APROBADA en el scope,
   * con las horas de docencia acumuladas y los campos necesarios para R-10.
   *
   * R-10 calcula la "dedicación total" = docencia + gestión + investigación + vinculación (FSD §6).
   * Extiende DocenteVigenteR03 con los campos de investigación y extensión/vinculación.
   *
   * Alcance (idéntico a obtenerDocentesParaR03):
   *   Roles globales y DECANO: toda la facultad (alcanceFacultad=true).
   *   DIRECTOR_CARRERA: solo la carrera solicitada (alcanceFacultad=false → PARCIAL).
   */
  async obtenerDocentesParaR10(
    carreraId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<DocentesParaR10> {
    this.checkRol(rolNombre);

    const carrera = await this.prisma.carrera.findUnique({
      where: { id: carreraId },
      select: { id: true, facultadId: true },
    });
    if (!carrera) throw new NotFoundException(`Carrera ${carreraId} no encontrada`);

    const tieneScope = await this.scope.tieneScopeCarrera(usuarioId, rolNombre, carreraId);
    if (!tieneScope) throw new ForbiddenException();

    const { facultadId } = carrera;

    const ROLES_ALCANCE_FACULTAD = new Set([
      'ADMINISTRADOR_SISTEMA',
      'SECRETARIA_ACADEMICA',
      'RECTORADO',
      'DECANO',
    ]);
    const alcanceFacultad = ROLES_ALCANCE_FACULTAD.has(rolNombre);

    const rows = await this.prisma.vinculacionCatedra.findMany({
      where: {
        ...(alcanceFacultad ? { facultadId } : { carreraId }),
        estado: 'APROBADA',
        docente: { activo: true },
      },
      select: {
        docenteId: true,
        materia: { select: { cargaHorariaSemanal: true } },
        docente: {
          select: {
            nombre: true,
            apellido: true,
            tiempoDedicacionGestionSemanal: true,
            fechaFinGestion: true,
            funcionGestion: true,
            desempenoActualJson: true,
            tiempoInvestigacion: true,
            tituloProyectoInvestigacion: true,
            fechaFinProyectoInvestigacion: true,
            tiempoExtension: true,
            rolActividadExtension: true,
            finEstadoActividadExtension: true,
          },
        },
      },
    });

    const porDocente = new Map<string, {
      nombre: string;
      apellido: string;
      horasDocenciaConocidas: number;
      tieneMateriaSinHoras: boolean;
      tiempoDedicacionGestionSemanal: string | null;
      fechaFinGestion: string | null;
      funcionGestion: string | null;
      desempenoActualJson: string | null;
      tiempoInvestigacion: string | null;
      tituloProyectoInvestigacion: string | null;
      fechaFinProyectoInvestigacion: string | null;
      tiempoExtension: string | null;
      rolActividadExtension: string | null;
      finEstadoActividadExtension: string | null;
    }>();

    for (const v of rows) {
      if (!porDocente.has(v.docenteId)) {
        porDocente.set(v.docenteId, {
          nombre: v.docente.nombre,
          apellido: v.docente.apellido,
          horasDocenciaConocidas: 0,
          tieneMateriaSinHoras: false,
          tiempoDedicacionGestionSemanal: v.docente.tiempoDedicacionGestionSemanal ?? null,
          fechaFinGestion: v.docente.fechaFinGestion ?? null,
          funcionGestion: v.docente.funcionGestion ?? null,
          desempenoActualJson: v.docente.desempenoActualJson ?? null,
          tiempoInvestigacion: v.docente.tiempoInvestigacion ?? null,
          tituloProyectoInvestigacion: v.docente.tituloProyectoInvestigacion ?? null,
          fechaFinProyectoInvestigacion: v.docente.fechaFinProyectoInvestigacion ?? null,
          tiempoExtension: v.docente.tiempoExtension ?? null,
          rolActividadExtension: v.docente.rolActividadExtension ?? null,
          finEstadoActividadExtension: v.docente.finEstadoActividadExtension ?? null,
        });
      }
      const entry = porDocente.get(v.docenteId)!;
      const horas = v.materia?.cargaHorariaSemanal;
      if (horas === null || horas === undefined) {
        entry.tieneMateriaSinHoras = true;
      } else {
        entry.horasDocenciaConocidas += horas;
      }
    }

    const docentes: DocenteVigenteR10[] = Array.from(porDocente.entries()).map(
      ([docenteId, d]) => ({ docenteId, ...d }),
    );

    const docentesMultiFacultad = alcanceFacultad
      ? await this.detectarDocentesMultiFacultad(
          docentes.map((d) => d.docenteId),
          facultadId,
        )
      : new Set<string>();

    return { docentes, facultadId, alcanceFacultad, docentesMultiFacultad };
  }

  // ── Docentes para IP-09 (completitud del plantel) ────────────────────────

  /**
   * Docentes activos con al menos una VinculacionCatedra APROBADA en la carrera evaluada.
   * Incluye todos los campos necesarios para evaluar C1, C2 y C3 de IP-09 (FSD §6.1).
   * C4 = 1 por construcción del universo; no se consulta por separado.
   * Deduplicado por docenteId: un docente con múltiples vinculaciones en la carrera
   * se devuelve una sola vez.
   */
  async obtenerDocentesParaIP09(carreraId: string): Promise<DocentesParaIP09> {
    const rows = await this.prisma.vinculacionCatedra.findMany({
      where: { carreraId, estado: 'APROBADA', docente: { activo: true } },
      select: {
        docenteId: true,
        docente: {
          select: {
            nombre: true,
            apellido: true,
            sexo: true,
            fechaNacimiento: true,
            cuit: true,
            pisoDepto: true,
            residencia: true,
            tipoDocumento: true,
            tituloGrado: true,
            areaDisciplinarId: true,
          },
        },
      },
      distinct: ['docenteId'],
    });

    const docentes: DocenteVigenteIP09[] = rows.map((r) => ({
      docenteId: r.docenteId,
      nombre: r.docente.nombre,
      apellido: r.docente.apellido,
      sexo: r.docente.sexo ?? null,
      fechaNacimiento: r.docente.fechaNacimiento ?? null,
      cuit: r.docente.cuit ?? null,
      pisoDepto: r.docente.pisoDepto ?? null,
      residencia: r.docente.residencia ?? null,
      tipoDocumento: r.docente.tipoDocumento,
      tituloGrado: r.docente.tituloGrado ?? null,
      areaDisciplinarId: r.docente.areaDisciplinarId ?? null,
    }));

    return { docentes };
  }

  /**
   * Docentes activos con al menos una VinculacionCatedra APROBADA en la carrera evaluada.
   * Incluye los campos necesarios para calcular C1–C3 (completitud IP-09) y la lista de
   * materias en esa carrera con su carga horaria semanal.
   *
   * Las materias se deduplicen por materiaId: el mismo docente puede tener varias
   * vinculaciones APROBADAS en la misma materia (roles distintos en la cátedra),
   * pero la materia se cuenta una sola vez.
   *
   * Usado por TablroCarreraService.consultarListadoDocentes (IMPL-18B, FSD §9.3).
   */
  async obtenerDocentesParaListado(carreraId: string): Promise<DocenteParaListado[]> {
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

    const byDocente = new Map<string, {
      nombre: string; apellido: string;
      sexo: string | null; fechaNacimiento: Date | null; cuit: string | null;
      pisoDepto: string | null; residencia: string | null; tipoDocumento: string;
      tituloGrado: string | null; areaDisciplinarId: string | null;
      materias: Map<string, { materiaId: string; nombre: string; cargaHorariaSemanal: number | null }>;
    }>();

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
      } else {
        if (!existing.materias.has(row.materia.id)) {
          existing.materias.set(row.materia.id, {
            materiaId: row.materia.id,
            nombre: row.materia.nombre,
            cargaHorariaSemanal: row.materia.cargaHorariaSemanal ?? null,
          });
        }
      }
    }

    return [...byDocente.entries()].map(([docenteId, d]) => ({
      docenteId,
      nombre: d.nombre,
      apellido: d.apellido,
      sexo: d.sexo,
      fechaNacimiento: d.fechaNacimiento,
      cuit: d.cuit,
      pisoDepto: d.pisoDepto,
      residencia: d.residencia,
      tipoDocumento: d.tipoDocumento,
      tituloGrado: d.tituloGrado,
      areaDisciplinarId: d.areaDisciplinarId,
      materias: [...d.materias.values()],
    }));
  }

  /**
   * Detecta docentes del scope con vinculaciones APROBADAS en otras facultades.
   * Método privado: accesible desde obtenerVinculacionesParaR07 y obtenerDocentesParaR12.
   * No expone qué otras facultades están involucradas; solo indica pertenencia al conjunto.
   */
  private async detectarDocentesMultiFacultad(
    docenteIds: string[],
    facultadIdAutorizado: string,
  ): Promise<Set<string>> {
    if (docenteIds.length === 0) return new Set();

    const rows = await this.prisma.vinculacionCatedra.findMany({
      where: {
        docenteId: { in: docenteIds },
        estado: 'APROBADA',
        facultadId: { not: facultadIdAutorizado },
        docente: { activo: true },
      },
      select: { docenteId: true },
      distinct: ['docenteId'],
    });

    return new Set(rows.map((r) => r.docenteId));
  }

  // ── Programas de asignatura ───────────────────────────────────────────────

  /**
   * Devuelve el programa de una materia si existe, o null si aún no fue creado.
   * No crea el programa automáticamente; no calcula porcentajes ni estadoFuncional.
   */
  async obtenerProgramaDeMateria(
    materiaId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<ProgramaAut | null> {
    this.checkRol(rolNombre);

    const materia = await this.prisma.materia.findUnique({
      where: { id: materiaId },
      select: { planEstudio: { select: { carreraId: true } } },
    });
    if (!materia) throw new NotFoundException(`Materia ${materiaId} no encontrada`);

    const tieneScope = await this.scope.tieneScopeCarrera(
      usuarioId,
      rolNombre,
      materia.planEstudio.carreraId,
    );
    if (!tieneScope) throw new ForbiddenException();

    const prog = await this.prisma.programaAsignatura.findUnique({
      where: { materiaId },
      select: {
        id: true, materiaId: true, estadoPrograma: true,
        estadoS1: true, estadoS2: true, estadoS3: true,
        estadoS4: true, estadoS5: true, estadoS6: true,
        fechaAprobacion: true, anioVigencia: true,
      },
    });

    if (!prog) return null;

    return {
      id: prog.id,
      materiaId: prog.materiaId,
      estadoPrograma: prog.estadoPrograma,
      secciones: {
        s1: prog.estadoS1 as EstadoSeccion,
        s2: prog.estadoS2 as EstadoSeccion,
        s3: prog.estadoS3 as EstadoSeccion,
        s4: prog.estadoS4 as EstadoSeccion,
        s5: prog.estadoS5 as EstadoSeccion,
        s6: prog.estadoS6 as EstadoSeccion,
      },
      fechaAprobacion: prog.fechaAprobacion,
      anioVigencia: prog.anioVigencia,
      tienePrograma: true,
    };
  }

  // ── Materias con programas de asignatura (R-11, R-13, R-14) ─────────────

  /**
   * Devuelve todas las materias de un plan junto con el estado de su programa de
   * asignatura (si existe). Usado por R-11, R-13 y R-14 para evaluar consistencia
   * de programas, formación práctica y horas.
   *
   * La autorización es idéntica a obtenerMateriasDePlan.
   * formacionPracticaJson se devuelve como string raw para que R-14 lo parsee.
   */
  async obtenerMateriasProgramasDePlan(
    planEstudioId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<MateriaProgramaAut[]> {
    this.checkRol(rolNombre);

    const plan = await this.prisma.planEstudio.findUnique({
      where: { id: planEstudioId },
      select: { carreraId: true },
    });
    if (!plan) throw new NotFoundException(`Plan ${planEstudioId} no encontrado`);

    const tieneScope = await this.scope.tieneScopeCarrera(usuarioId, rolNombre, plan.carreraId);
    if (!tieneScope) throw new ForbiddenException();

    const materias = await this.prisma.materia.findMany({
      where: { planEstudioId },
      select: {
        id: true, codigo: true, nombre: true,
        tipoAsignatura: true, cargaHorariaTotal: true,
        programa: {
          select: {
            estadoPrograma: true, fechaAprobacion: true, anioVigencia: true,
            estadoS1: true, estadoS2: true, estadoS3: true,
            estadoS4: true, estadoS5: true, estadoS6: true,
            formacionPracticaJson: true,
          },
        },
      },
      orderBy: [{ anio: 'asc' }, { cuatrimestre: 'asc' }, { nombre: 'asc' }],
    });

    return materias.map((m) => {
      const p = m.programa;
      const secciones = p
        ? {
            s1: p.estadoS1 as EstadoSeccion,
            s2: p.estadoS2 as EstadoSeccion,
            s3: p.estadoS3 as EstadoSeccion,
            s4: p.estadoS4 as EstadoSeccion,
            s5: p.estadoS5 as EstadoSeccion,
            s6: p.estadoS6 as EstadoSeccion,
          }
        : null;
      const seccionesCompletas = p
        ? [p.estadoS1, p.estadoS2, p.estadoS3, p.estadoS4, p.estadoS5, p.estadoS6].filter(
            (s) => s === 'COMPLETO',
          ).length
        : 0;
      return {
        materiaId: m.id,
        materiaNombre: m.nombre,
        materiaCodigo: m.codigo,
        tipoAsignatura: m.tipoAsignatura,
        cargaHorariaTotal: m.cargaHorariaTotal,
        tienePrograma: p !== null,
        estadoPrograma: p?.estadoPrograma ?? null,
        secciones,
        seccionesCompletas,
        fechaAprobacion: p?.fechaAprobacion ?? null,
        anioVigencia: p?.anioVigencia ?? null,
        formacionPracticaJson: p?.formacionPracticaJson ?? null,
      };
    });
  }

  // ── Configuraciones ───────────────────────────────────────────────────────

  /**
   * Devuelve la configuración MOD-AUT de una facultad, o null si no fue creada.
   * Requiere rol en ROLES_MODAUT y scope institucional sobre la facultad solicitada.
   */
  async obtenerConfigAut(
    facultadId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<ConfigFacultadAut | null> {
    this.checkRol(rolNombre);
    await this.verificarScopeFacultad(facultadId, usuarioId, rolNombre);

    const config = await this.prisma.autoevaluacionConfigFacultad.findUnique({
      where: { facultadId },
      select: {
        facultadId: true, p01TopeH: true, p02BajaH: true,
        p03MaxMat: true, updatedAt: true,
      },
    });
    return config ?? null;
  }

  // ── R-04: cargos sin actividad curricular ─────────────────────────────────

  /**
   * Devuelve los docentes del plantel del plan con sus cargos vigentes al fechaCalculo.
   *
   * Vigencia K-D6: fechaInicio <= fechaCalculo AND (fechaFin IS NULL OR fechaFin > fechaCalculo).
   * Para cada cargo vigente indica si tiene actividad curricular en el plan (≥1 VC APROBADA
   * con cargoDocenteId = ese cargo y planEstudioId = plan evaluado).
   *
   * Solo se incluyen docentes con al menos una VinculacionCatedra APROBADA en el plan.
   */
  async obtenerCargosParaR04(
    planEstudioId: string,
    fechaCalculo: Date,
    usuarioId: string,
    rolNombre: string,
  ): Promise<CargosParaR04> {
    this.checkRol(rolNombre);

    const plan = await this.prisma.planEstudio.findUnique({
      where: { id: planEstudioId },
      select: { carreraId: true },
    });
    if (!plan) throw new NotFoundException(`Plan ${planEstudioId} no encontrado`);

    const { carreraId } = plan;

    const tieneScope = await this.scope.tieneScopeCarrera(usuarioId, rolNombre, carreraId);
    if (!tieneScope) throw new ForbiddenException();

    const vincsPlan = await this.prisma.vinculacionCatedra.findMany({
      where: { planEstudioId, estado: 'APROBADA' },
      select: { docenteId: true },
      distinct: ['docenteId'],
    });

    const docenteIds = vincsPlan.map((v) => v.docenteId);

    if (docenteIds.length === 0) {
      return { docentes: [], planEstudioId, carreraId };
    }

    const [cargosRaw, docentesRaw] = await Promise.all([
      this.prisma.cargoDocente.findMany({
        where: {
          docenteId: { in: docenteIds },
          fechaInicio: { lte: fechaCalculo },
          OR: [{ fechaFin: null }, { fechaFin: { gt: fechaCalculo } }],
        },
        select: {
          id: true,
          docenteId: true,
          designacion: true,
          fechaInicio: true,
          fechaFin: true,
          verificado: true,
          cargo: { select: { nombre: true } },
          vinculacionesCatedra: {
            where: { estado: 'APROBADA', planEstudioId },
            select: { id: true },
            take: 1,
          },
        },
      }),
      this.prisma.docente.findMany({
        where: { id: { in: docenteIds } },
        select: {
          id: true,
          nombre: true,
          apellido: true,
          relevamientoCargosCompleto: true,
        },
      }),
    ]);

    const docenteMap = new Map(docentesRaw.map((d) => [d.id, d]));
    const cargosMap = new Map<string, (typeof cargosRaw)[number][]>();
    for (const c of cargosRaw) {
      const arr = cargosMap.get(c.docenteId) ?? [];
      arr.push(c);
      cargosMap.set(c.docenteId, arr);
    }

    const docentes: DocenteConCargosR04[] = docenteIds
      .map((id) => {
        const d = docenteMap.get(id);
        if (!d) return null;
        return {
          docenteId: id,
          nombre: d.nombre,
          apellido: d.apellido,
          relevamientoCargosCompleto: d.relevamientoCargosCompleto,
          cargosVigentes: (cargosMap.get(id) ?? []).map((c) => ({
            cargoDocenteId: c.id,
            cargoNombre: c.cargo.nombre,
            designacion: c.designacion,
            fechaInicio: c.fechaInicio,
            fechaFin: c.fechaFin,
            verificado: c.verificado,
            tieneActividadEnPlan: c.vinculacionesCatedra.length > 0,
          })),
        };
      })
      .filter((d): d is DocenteConCargosR04 => d !== null);

    return { docentes, planEstudioId, carreraId };
  }
}
