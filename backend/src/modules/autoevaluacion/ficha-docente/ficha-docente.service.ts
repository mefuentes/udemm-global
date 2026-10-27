import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ScopeService } from '../../scopes/scope.service';
import { extraerAlertas } from '../alertas/alertas.extractor';
import type { AmbitoAnalisis } from '../analisis/analisis.dto';
import type { AlertaBandeja } from '../alertas/alertas.dto';
import type { EstadoCalculo } from '../types/estado-calculo.types';
import type {
  CargoParsed,
  CompletitudFicha,
  FichaDocenteDto,
  VinculacionParsed,
} from './ficha-docente.dto';

const ROLES_MODAUT = new Set([
  'ADMINISTRADOR_SISTEMA',
  'SECRETARIA_ACADEMICA',
  'RECTORADO',
  'DECANO',
  'DIRECTOR_CARRERA',
]);

const ROLES_GLOBALES = new Set([
  'ADMINISTRADOR_SISTEMA',
  'SECRETARIA_ACADEMICA',
  'RECTORADO',
]);

@Injectable()
export class FichaDocenteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
  ) {}

  async obtenerFicha(
    docenteId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<FichaDocenteDto> {
    if (!ROLES_MODAUT.has(rolNombre)) {
      throw new ForbiddenException('Rol sin acceso al módulo de autoevaluación');
    }

    const docente = await this.prisma.docente.findUnique({
      where: { id: docenteId },
      include: {
        tipoDedicacionConeau: { select: { id: true, nombre: true, codigo: true } },
        tipoPosgrado: { select: { id: true, nombre: true } },
        cargosInstitucionales: {
          include: { cargo: { select: { nombre: true } } },
          orderBy: { fechaInicio: 'desc' },
        },
        vinculaciones: {
          include: {
            materia:     { select: { id: true, nombre: true } },
            carrera:     { select: { id: true, nombre: true } },
            planEstudio: { select: { id: true, nombre: true } },
            facultad:    { select: { id: true, nombre: true } },
          },
          orderBy: { fechaCreacion: 'desc' },
        },
      },
    });

    if (!docente) throw new NotFoundException('Docente no encontrado');

    await this._verificarScope(docente.vinculaciones, usuarioId, rolNombre);

    const fechaCalculo = new Date();
    const cargos     = this._parsearCargos(docente.cargosInstitucionales, fechaCalculo);
    const vinculaciones = this._parsearVinculaciones(docente.vinculaciones);
    const alertas    = await this._obtenerAlertasEnScope(docente.vinculaciones);
    const completitud = this._calcularCompletitud(docente);

    return {
      identificacion: {
        id:                         docente.id,
        nombre:                     docente.nombre,
        apellido:                   docente.apellido,
        nombreCompleto:             `${docente.apellido}, ${docente.nombre}`,
        tipoDocumento:              docente.tipoDocumento,
        numeroDocumento:            docente.numeroDocumento,
        correoElectronico:          docente.correoElectronico,
        activo:                     docente.activo,
        dedicacion:                 docente.dedicacion,
        tipoDedicacionConeau:       docente.tipoDedicacionConeau ?? null,
        tipoPosgrado:               docente.tipoPosgrado ?? null,
        categoriaDocente:           docente.categoriaDocente,
        tituloGrado:                docente.tituloGrado,
        tituloPosgrado:             docente.tituloPosgrado,
        relevamientoCargosCompleto: docente.relevamientoCargosCompleto,
      },
      formacionAcademica: {
        tituloGrado:           docente.tituloGrado,
        tituloPosgrado:        docente.tituloPosgrado,
        otrosTitulos:          docente.otrosTitulos,
        actividadesPosgradoJson: docente.actividadesPosgradoJson,
      },
      actividadesInvestigacion: {
        tituloProyectoInvestigacion: docente.tituloProyectoInvestigacion,
        proyectosInvestigacionJson:  docente.proyectosInvestigacionJson,
        produccionCientificaJson:    docente.produccionCientificaJson,
      },
      cargosInstitucionales: cargos,
      vinculaciones,
      alertasEnScope: alertas,
      completitud,
    };
  }

  /**
   * Ficha de un docente en el contexto de una carrera específica (IMPL-19B.5 live).
   *
   * Seguridad:
   * 1. El usuario debe tener scope sobre la carrera (tieneScopeCarrera).
   * 2. El docente debe tener al menos una VinculacionCatedra APROBADA en esa carrera.
   *    Sin esto → NotFoundException (no 403, para no revelar la existencia del docente).
   *
   * Devuelve la ficha completa del docente con vinculaciones filtradas a la carrera,
   * más los cargos vigentes y las alertas históricas del scope de esa carrera.
   */
  async obtenerFichaEnCarrera(
    docenteId: string,
    carreraId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<FichaDocenteDto> {
    if (!ROLES_MODAUT.has(rolNombre)) {
      throw new ForbiddenException('Rol sin acceso al módulo de autoevaluación');
    }

    const tieneScope = await this.scope.tieneScopeCarrera(usuarioId, rolNombre, carreraId);
    if (!tieneScope) throw new ForbiddenException('Acceso fuera del scope autorizado');

    // Verificar que el docente exista Y pertenezca a la carrera
    const docente = await this.prisma.docente.findUnique({
      where: { id: docenteId },
      include: {
        tipoDedicacionConeau: { select: { id: true, nombre: true, codigo: true } },
        tipoPosgrado: { select: { id: true, nombre: true } },
        cargosInstitucionales: {
          include: { cargo: { select: { nombre: true } } },
          orderBy: { fechaInicio: 'desc' },
        },
        vinculaciones: {
          where: { carreraId, estado: 'APROBADA' },
          include: {
            materia:     { select: { id: true, nombre: true } },
            carrera:     { select: { id: true, nombre: true } },
            planEstudio: { select: { id: true, nombre: true } },
            facultad:    { select: { id: true, nombre: true } },
          },
          orderBy: { fechaCreacion: 'desc' },
        },
      },
    });

    if (!docente || docente.vinculaciones.length === 0) {
      throw new NotFoundException(
        `Docente no encontrado en la carrera ${carreraId}`,
      );
    }

    const fechaCalculo = new Date();
    const cargos       = this._parsearCargos(docente.cargosInstitucionales, fechaCalculo);
    const vinculaciones = this._parsearVinculaciones(docente.vinculaciones);
    const alertas      = await this._obtenerAlertasEnScope(docente.vinculaciones);
    const completitud  = this._calcularCompletitud(docente);

    return {
      identificacion: {
        id:                         docente.id,
        nombre:                     docente.nombre,
        apellido:                   docente.apellido,
        nombreCompleto:             `${docente.apellido}, ${docente.nombre}`,
        tipoDocumento:              docente.tipoDocumento,
        numeroDocumento:            docente.numeroDocumento,
        correoElectronico:          docente.correoElectronico,
        activo:                     docente.activo,
        dedicacion:                 docente.dedicacion,
        tipoDedicacionConeau:       docente.tipoDedicacionConeau ?? null,
        tipoPosgrado:               docente.tipoPosgrado ?? null,
        categoriaDocente:           docente.categoriaDocente,
        tituloGrado:                docente.tituloGrado,
        tituloPosgrado:             docente.tituloPosgrado,
        relevamientoCargosCompleto: docente.relevamientoCargosCompleto,
      },
      formacionAcademica: {
        tituloGrado:             docente.tituloGrado,
        tituloPosgrado:          docente.tituloPosgrado,
        otrosTitulos:            docente.otrosTitulos,
        actividadesPosgradoJson: docente.actividadesPosgradoJson,
      },
      actividadesInvestigacion: {
        tituloProyectoInvestigacion: docente.tituloProyectoInvestigacion,
        proyectosInvestigacionJson:  docente.proyectosInvestigacionJson,
        produccionCientificaJson:    docente.produccionCientificaJson,
      },
      cargosInstitucionales: cargos,
      vinculaciones,
      alertasEnScope: alertas,
      completitud,
    };
  }

  // ── Scope ───────────────────────────────────────────────────────────────────

  private async _verificarScope(
    vinculaciones: Array<{ facultadId: string; carreraId: string }>,
    usuarioId: string,
    rolNombre: string,
  ): Promise<void> {
    if (ROLES_GLOBALES.has(rolNombre)) return;

    if (rolNombre === 'DECANO') {
      const assoc = await this.prisma.usuarioFacultad.findFirst({
        where: { usuarioId },
        select: { facultadId: true },
      });
      if (!assoc) throw new ForbiddenException('Acceso fuera del scope autorizado');
      const estaEnFacultad = vinculaciones.some(v => v.facultadId === assoc.facultadId);
      if (!estaEnFacultad) throw new ForbiddenException('Acceso fuera del scope autorizado');
      return;
    }

    if (rolNombre === 'DIRECTOR_CARRERA') {
      const carrerasScope = await this.scope.getCarrerasEnScope(usuarioId, rolNombre);
      if (!carrerasScope || carrerasScope.length === 0) {
        throw new ForbiddenException('Acceso fuera del scope autorizado');
      }
      const scopeSet = new Set(carrerasScope);
      const estaEnScope = vinculaciones.some(v => scopeSet.has(v.carreraId));
      if (!estaEnScope) throw new ForbiddenException('Acceso fuera del scope autorizado');
      return;
    }

    throw new ForbiddenException('Acceso no autorizado');
  }

  // ── Cargos ──────────────────────────────────────────────────────────────────

  private _parsearCargos(
    cargos: Array<{
      id: string;
      designacion: string | null;
      fechaInicio: Date;
      fechaFin: Date | null;
      verificado: boolean;
      fuente: string;
      cargo: { nombre: string };
    }>,
    fechaCalculo: Date,
  ): CargoParsed[] {
    return cargos.map(c => ({
      id:          c.id,
      cargoNombre: c.cargo.nombre,
      designacion: c.designacion,
      fechaInicio: c.fechaInicio.toISOString(),
      fechaFin:    c.fechaFin?.toISOString() ?? null,
      vigente:     c.fechaFin == null || c.fechaFin > fechaCalculo,
      verificado:  c.verificado,
      fuente:      c.fuente,
    }));
  }

  // ── Vinculaciones ───────────────────────────────────────────────────────────

  private _parsearVinculaciones(
    vinculaciones: Array<{
      id: string;
      estado: string;
      esResponsableCatedra: boolean | null;
      horasSemana: number | null;
      anioInicio: number | null;
      materia:     { id: string; nombre: string };
      carrera:     { id: string; nombre: string };
      planEstudio: { id: string; nombre: string };
      facultad:    { id: string; nombre: string };
    }>,
  ): VinculacionParsed[] {
    return vinculaciones.map(v => ({
      id:                  v.id,
      materiaId:           v.materia.id,
      materiaNombre:       v.materia.nombre,
      carreraId:           v.carrera.id,
      carreraNombre:       v.carrera.nombre,
      planEstudioId:       v.planEstudio.id,
      planEstudioNombre:   v.planEstudio.nombre,
      facultadId:          v.facultad.id,
      facultadNombre:      v.facultad.nombre,
      estado:              v.estado,
      esResponsableCatedra: v.esResponsableCatedra,
      horasSemana:         v.horasSemana,
      anioInicio:          v.anioInicio,
    }));
  }

  // ── Alertas ─────────────────────────────────────────────────────────────────

  private async _obtenerAlertasEnScope(
    vinculaciones: Array<{ carreraId: string; planEstudioId: string; facultadId: string }>,
  ): Promise<AlertaBandeja[]> {
    if (vinculaciones.length === 0) return [];

    const carreraIds    = [...new Set(vinculaciones.map(v => v.carreraId))];
    const planIds       = [...new Set(vinculaciones.map(v => v.planEstudioId))];

    const [ejecucionesCarrera, ejecucionesPlan] = await Promise.all([
      this.prisma.analisisEjecucion.findMany({
        where:   { ambito: 'CARRERA', entidadId: { in: carreraIds }, estado: 'COMPLETADO' },
        orderBy: { fechaInicio: 'desc' },
        select:  {
          id: true, ambito: true, entidadId: true, facultadId: true,
          fechaFin: true, snapshot: true,
        },
      }),
      this.prisma.analisisEjecucion.findMany({
        where:   { ambito: 'PLAN', entidadId: { in: planIds }, estado: 'COMPLETADO' },
        orderBy: { fechaInicio: 'desc' },
        select:  {
          id: true, ambito: true, entidadId: true, facultadId: true,
          fechaFin: true, snapshot: true,
        },
      }),
    ]);

    // Latest per entity (already ordered desc, so first occurrence wins)
    const latestCarrera = this._latestPerEntity(ejecucionesCarrera);
    const latestPlan    = this._latestPerEntity(ejecucionesPlan);

    const alertas: AlertaBandeja[] = [];
    for (const ej of [...latestCarrera, ...latestPlan]) {
      const snap            = (ej.snapshot ?? {}) as Record<string, unknown>;
      const estadoCalculo   = (snap['estadoGeneralCalculo'] as EstadoCalculo | null) ?? null;
      const fechaEjecucion  = ej.fechaFin?.toISOString() ?? new Date().toISOString();
      const nuevas = extraerAlertas(
        ej.snapshot,
        ej.ambito as AmbitoAnalisis,
        ej.entidadId,
        ej.facultadId,
        ej.id,
        fechaEjecucion,
        estadoCalculo,
      );
      alertas.push(...nuevas);
    }

    return alertas;
  }

  private _latestPerEntity<T extends { entidadId: string }>(rows: T[]): T[] {
    const seen = new Set<string>();
    return rows.filter(r => {
      if (seen.has(r.entidadId)) return false;
      seen.add(r.entidadId);
      return true;
    });
  }

  // ── Completitud ─────────────────────────────────────────────────────────────

  private _calcularCompletitud(docente: {
    tituloGrado: string | null;
    tituloPosgrado: string | null;
    proyectosInvestigacionJson: string | null;
    dedicacion: string | null;
  }): CompletitudFicha {
    const tieneFormacionBasica      = !!docente.tituloGrado;
    const tienePosgrado             = !!docente.tituloPosgrado;
    const tieneActividadInvestigacion = this._tieneProyecto(docente.proyectosInvestigacionJson);
    const tieneDedicacion           = !!docente.dedicacion;

    const campos = [tieneFormacionBasica, tienePosgrado, tieneActividadInvestigacion, tieneDedicacion];
    const porcentaje = Math.round((campos.filter(Boolean).length / campos.length) * 100);

    return { tieneFormacionBasica, tienePosgrado, tieneActividadInvestigacion, tieneDedicacion, porcentaje };
  }

  private _tieneProyecto(json: string | null): boolean {
    if (!json) return false;
    try {
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? parsed.length > 0 : !!parsed;
    } catch {
      return !!json.trim();
    }
  }
}
