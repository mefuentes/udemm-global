import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ConfigFacultadService } from './config/config-facultad.service';
import { ConfigPlanService } from './config/config-plan.service';
import { ResponsablesService } from './responsables/responsables.service';
import { IndicadoresService } from './indicadores/indicadores.service';
import { RegistroIndicadores } from './indicadores/indicadores.registry';
import { ActualizarConfigFacultadDto } from './dto/actualizar-config-facultad.dto';
import { ActualizarConfigPlanDto } from './dto/actualizar-config-plan.dto';
import { DesignarResponsableDto } from './dto/designar-responsable.dto';
import { EvaluarIndicadorDto } from './dto/evaluar-indicador.dto';
import { TablroPlanService } from './tablero/tablero-plan.service';
import { TablroCarreraService } from './tablero/tablero-carrera.service';
import { TablroFacultadService } from './tablero/tablero-facultad.service';
import { AnalisisService } from './analisis/analisis.service';
import { AlertasService } from './alertas/alertas.service';
import { ExportacionesService } from './exportaciones/exportaciones.service';
import { FichaDocenteService } from './ficha-docente/ficha-docente.service';
import { ReglasCatalogoService } from './reglas/reglas-catalogo.service';

const ROLES_MODAUT = [
  'ADMINISTRADOR_SISTEMA',
  'SECRETARIA_ACADEMICA',
  'RECTORADO',
  'DECANO',
  'DIRECTOR_CARRERA',
] as const;

/**
 * Controlador de MOD-AUT.
 * DOCENTE y ADMINISTRATIVO no tienen acceso a ningún endpoint de este módulo.
 * El scope institucional se verifica en los servicios para prevenir IDOR.
 *
 * Seguridad de indicadores:
 * - usuarioId y rolNombre se toman siempre del contexto autenticado (req.user).
 * - El body de evaluación solo acepta identificadores académicos opcionales.
 * - ValidationPipe con whitelist:true descarta cualquier campo adicional.
 * - IndicadoresService verifica autorización y scope antes de delegar al evaluador.
 * - ConsultasAcademicasService valida scope en cada consulta interna (defensa en profundidad).
 */
@Controller('autoevaluacion')
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AutoevaluacionController {
  constructor(
    private readonly configFacultad: ConfigFacultadService,
    private readonly configPlan: ConfigPlanService,
    private readonly responsables: ResponsablesService,
    private readonly indicadores: IndicadoresService,
    private readonly registro: RegistroIndicadores,
    private readonly tablero: TablroPlanService,
    private readonly tableroCarrera: TablroCarreraService,
    private readonly tableroFacultad: TablroFacultadService,
    private readonly analisis: AnalisisService,
    private readonly alertas: AlertasService,
    private readonly exportaciones: ExportacionesService,
    private readonly fichaDocente: FichaDocenteService,
    private readonly reglasCatalogo: ReglasCatalogoService,
  ) {}

  // ── Configuración por Facultad ──────────────────────────────────────────────

  /**
   * Consulta la configuración MOD-AUT de una Facultad.
   * Devuelve null si la Facultad no tiene configuración todavía (estado esperado).
   */
  @Get('config/facultad/:facultadId')
  @Roles(...ROLES_MODAUT)
  async obtenerConfigFacultad(@Param('facultadId') facultadId: string, @Req() req: any) {
    return this.configFacultad.obtenerConfig(facultadId, req.user.id, req.user.rol.nombre);
  }

  /**
   * Crea o actualiza la configuración MOD-AUT de una Facultad.
   * Solo ADMINISTRADOR_SISTEMA puede modificar la configuración.
   */
  @Patch('config/facultad/:facultadId')
  @Roles('ADMINISTRADOR_SISTEMA')
  async actualizarConfigFacultad(
    @Param('facultadId') facultadId: string,
    @Body() dto: ActualizarConfigFacultadDto,
    @Req() req: any,
  ) {
    return this.configFacultad.upsertConfig(facultadId, dto, req.user.id);
  }

  // ── Umbrales por Plan de Estudio ────────────────────────────────────────────

  /**
   * Consulta los umbrales horarios de un Plan de Estudio (P-10..P-14).
   * Los campos null indican que el umbral no está configurado → R-09 no evalúa ese bloque.
   */
  @Get('config/plan/:planEstudioId')
  @Roles(...ROLES_MODAUT)
  async obtenerConfigPlan(@Param('planEstudioId') planEstudioId: string, @Req() req: any) {
    return this.configPlan.obtenerUmbrales(planEstudioId, req.user.id, req.user.rol.nombre);
  }

  /**
   * Actualiza los umbrales horarios de un Plan de Estudio.
   * Solo ADMINISTRADOR_SISTEMA puede modificar umbrales de planes.
   */
  @Patch('config/plan/:planEstudioId')
  @Roles('ADMINISTRADOR_SISTEMA')
  async actualizarConfigPlan(
    @Param('planEstudioId') planEstudioId: string,
    @Body() dto: ActualizarConfigPlanDto,
  ) {
    return this.configPlan.actualizarUmbrales(planEstudioId, dto);
  }

  // ── Responsables de cátedra ─────────────────────────────────────────────────

  /**
   * Designa o quita el responsable de cátedra de una vinculación.
   * ADMINISTRADOR_SISTEMA: puede operar globalmente.
   * DIRECTOR_CARRERA: solo puede operar sobre sus carreras autorizadas.
   * La vinculación debe estar en estado APROBADA.
   * Si se intenta marcar como responsable y ya hay uno, devuelve 409.
   */
  @Patch('responsable/:vinculacionId')
  @Roles('ADMINISTRADOR_SISTEMA', 'DIRECTOR_CARRERA')
  async designarResponsable(
    @Param('vinculacionId') vinculacionId: string,
    @Body() dto: DesignarResponsableDto,
    @Req() req: any,
  ) {
    return this.responsables.designarResponsable(
      vinculacionId,
      dto.esResponsable,
      req.user.id,
      req.user.rol.nombre,
    );
  }

  /**
   * Consulta el responsable confirmado de una (materia, cátedra).
   * Devuelve null si ninguna vinculación tiene esResponsableCatedra=true.
   */
  @Get('responsable/:materiaId/:catedraId')
  @Roles(...ROLES_MODAUT)
  async obtenerResponsable(
    @Param('materiaId') materiaId: string,
    @Param('catedraId') catedraId: string,
    @Req() req: any,
  ) {
    return this.responsables.obtenerResponsable(
      materiaId,
      catedraId,
      req.user.id,
      req.user.rol.nombre,
    );
  }

  // ── Tablero por plan de estudios ────────────────────────────────────────────

  /**
   * Devuelve el tablero de indicadores IPL-01, IPL-02, IPL-03 e IPL-05
   * para el plan de estudios indicado.
   *
   * Seguridad:
   * - planEstudioId se valida como UUID v4 en el path.
   * - usuarioId y rolNombre provienen exclusivamente del token JWT.
   * - TablroPlanService delega la verificación de scope a IndicadoresService,
   *   que a su vez usa ScopeService (defensa en profundidad).
   */
  @Post('tablero/plan/:planEstudioId')
  @HttpCode(200)
  @Roles(...ROLES_MODAUT)
  async tablroPlan(
    @Param('planEstudioId', new ParseUUIDPipe({ version: '4' })) planEstudioId: string,
    @Req() req: any,
  ) {
    return this.tablero.consultarPlan(planEstudioId, req.user.id, req.user.rol.nombre);
  }

  // ── Tablero por carrera ─────────────────────────────────────────────────────

  /**
   * Devuelve el tablero de indicadores IP-03 e IP-08 para la carrera indicada.
   *
   * IP-03: Materias cubiertas (FSD §7) — asignaturas con ≥1 vinculación APROBADA.
   * IP-08: Relación profesores/auxiliares (FSD §7) — ratio P/A según categorías CONEAU.
   *
   * Seguridad:
   * - carreraId se valida como UUID v4 en el path.
   * - usuarioId y rolNombre provienen exclusivamente del token JWT.
   * - TablroCarreraService verifica rol y scope antes de ejecutar los cálculos.
   */
  @Post('tablero/carrera/:carreraId')
  @HttpCode(200)
  @Roles(...ROLES_MODAUT)
  async tablroCarrera(
    @Param('carreraId', new ParseUUIDPipe({ version: '4' })) carreraId: string,
    @Req() req: any,
  ) {
    return this.tableroCarrera.consultarCarrera(carreraId, req.user.id, req.user.rol.nombre);
  }

  // ── Listado de docentes por carrera ────────────────────────────────────────

  /**
   * Devuelve el listado detallado de docentes del plantel de una carrera (FSD §9.3).
   *
   * Cada fila incluye materias en la carrera, horas de docencia conocidas, completitud
   * de ficha (C1–C4), semáforo (VERDE/AMARILLO/ROJO) y alertas activas.
   * El campo totales contiene los contadores para los 4 filtros del listado.
   *
   * Seguridad: igual a tablroCarrera — UUID v4 en path, usuarioId/rol del token.
   */
  @Post('tablero/carrera/:carreraId/listado')
  @HttpCode(200)
  @Roles(...ROLES_MODAUT)
  async listadoDocentesCarrera(
    @Param('carreraId', new ParseUUIDPipe({ version: '4' })) carreraId: string,
    @Req() req: any,
  ) {
    return this.tableroCarrera.consultarListadoDocentes(carreraId, req.user.id, req.user.rol.nombre);
  }

  // ── Tablero por facultad ────────────────────────────────────────────────────

  /**
   * Devuelve el tablero de 5 bloques para la facultad indicada:
   * Composición, Formación, Investigación y vinculación, Dedicaciones, Carga académica.
   *
   * Acceso restringido a roles con visión institucional (no DIRECTOR_CARRERA).
   * facultadId se valida como UUID v4 en el path.
   * usuarioId y rolNombre provienen exclusivamente del token JWT.
   */
  @Post('tablero/facultad/:facultadId')
  @HttpCode(200)
  @Roles('ADMINISTRADOR_SISTEMA', 'SECRETARIA_ACADEMICA', 'RECTORADO', 'DECANO')
  async tablroFacultad(
    @Param('facultadId', new ParseUUIDPipe({ version: '4' })) facultadId: string,
    @Req() req: any,
  ) {
    return this.tableroFacultad.consultarFacultad(facultadId, req.user.id, req.user.rol.nombre);
  }

  // ── Análisis explícito ──────────────────────────────────────────────────────

  @Post('analisis/facultad/:facultadId')
  @HttpCode(200)
  @Roles('ADMINISTRADOR_SISTEMA', 'SECRETARIA_ACADEMICA', 'RECTORADO', 'DECANO')
  async ejecutarAnalisisFacultad(
    @Param('facultadId', new ParseUUIDPipe({ version: '4' })) facultadId: string,
    @Req() req: any,
  ) {
    return this.analisis.ejecutarFacultad(facultadId, req.user.id, req.user.rol.nombre);
  }

  @Post('analisis/carrera/:carreraId')
  @HttpCode(200)
  @Roles(...ROLES_MODAUT)
  async ejecutarAnalisisCarrera(
    @Param('carreraId', new ParseUUIDPipe({ version: '4' })) carreraId: string,
    @Req() req: any,
  ) {
    return this.analisis.ejecutarCarrera(carreraId, req.user.id, req.user.rol.nombre);
  }

  @Post('analisis/plan/:planEstudioId')
  @HttpCode(200)
  @Roles(...ROLES_MODAUT)
  async ejecutarAnalisisPlan(
    @Param('planEstudioId', new ParseUUIDPipe({ version: '4' })) planEstudioId: string,
    @Req() req: any,
  ) {
    return this.analisis.ejecutarPlan(planEstudioId, req.user.id, req.user.rol.nombre);
  }

  @Get('analisis/facultad/:facultadId/historial')
  @Roles('ADMINISTRADOR_SISTEMA', 'SECRETARIA_ACADEMICA', 'RECTORADO', 'DECANO')
  historialAnalisisFacultad(
    @Param('facultadId', new ParseUUIDPipe({ version: '4' })) facultadId: string,
    @Query('pagina',    new ParseIntPipe({ optional: true })) pagina    = 1,
    @Query('porPagina', new ParseIntPipe({ optional: true })) porPagina = 10,
    @Req() req: any,
  ) {
    return this.analisis.obtenerHistorialFacultad(facultadId, req.user.rol.nombre, pagina, porPagina);
  }

  @Get('analisis/carrera/:carreraId/historial')
  @Roles(...ROLES_MODAUT)
  historialAnalisisCarrera(
    @Param('carreraId', new ParseUUIDPipe({ version: '4' })) carreraId: string,
    @Query('pagina',    new ParseIntPipe({ optional: true })) pagina    = 1,
    @Query('porPagina', new ParseIntPipe({ optional: true })) porPagina = 10,
    @Req() req: any,
  ) {
    return this.analisis.obtenerHistorialCarrera(carreraId, req.user.rol.nombre, pagina, porPagina);
  }

  @Get('analisis/plan/:planEstudioId/historial')
  @Roles(...ROLES_MODAUT)
  historialAnalisisPlan(
    @Param('planEstudioId', new ParseUUIDPipe({ version: '4' })) planEstudioId: string,
    @Query('pagina',    new ParseIntPipe({ optional: true })) pagina    = 1,
    @Query('porPagina', new ParseIntPipe({ optional: true })) porPagina = 10,
    @Req() req: any,
  ) {
    return this.analisis.obtenerHistorialPlan(planEstudioId, req.user.rol.nombre, pagina, porPagina);
  }

  @Get('analisis/ejecucion/:ejecucionId')
  @Roles(...ROLES_MODAUT)
  obtenerDetalleEjecucion(
    @Param('ejecucionId', new ParseUUIDPipe({ version: '4' })) ejecucionId: string,
    @Req() req: any,
  ) {
    return this.analisis.obtenerDetalle(ejecucionId, req.user.rol.nombre, req.user.id);
  }

  // ── Bandeja global de alertas ────────────────────────────────────────────────

  @Get('alertas')
  @Roles(...ROLES_MODAUT)
  obtenerBandejaAlertas(
    @Req() req: any,
    @Query('ambito')      ambito?: string,
    @Query('grupoAmbito') grupoAmbito?: string,
    @Query('prioridad')   prioridad?: string,
    @Query('regla')       regla?: string,
    @Query('pagina',    new ParseIntPipe({ optional: true })) pagina    = 1,
    @Query('porPagina', new ParseIntPipe({ optional: true })) porPagina = 20,
  ) {
    return this.alertas.obtenerBandeja(
      req.user.id,
      req.user.rol.nombre,
      pagina,
      porPagina,
      { ambito: ambito as any, grupoAmbito: grupoAmbito as any, prioridad: prioridad as any, regla },
    );
  }

  // ── Exportaciones PDF / Excel ────────────────────────────────────────────────

  @Get('exportar/ejecucion/:ejecucionId/pdf')
  @Roles(...ROLES_MODAUT)
  async exportarEjecucionPdf(
    @Param('ejecucionId', new ParseUUIDPipe({ version: '4' })) ejecucionId: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, filename, mime } = await this.exportaciones.exportarPorEjecucion(
      ejecucionId, 'pdf', req.user.rol.nombre, req.user.id,
    );
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return new StreamableFile(buffer);
  }

  @Get('exportar/ejecucion/:ejecucionId/xlsx')
  @Roles(...ROLES_MODAUT)
  async exportarEjecucionXlsx(
    @Param('ejecucionId', new ParseUUIDPipe({ version: '4' })) ejecucionId: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, filename, mime } = await this.exportaciones.exportarPorEjecucion(
      ejecucionId, 'xlsx', req.user.rol.nombre, req.user.id,
    );
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return new StreamableFile(buffer);
  }

  @Get('exportar/facultad/:facultadId/pdf')
  @Roles(...ROLES_MODAUT)
  async exportarFacultadPdf(
    @Param('facultadId') facultadId: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, filename, mime } = await this.exportaciones.exportarPorEntidad(
      'FACULTAD', facultadId, 'pdf', req.user.rol.nombre, req.user.id,
    );
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return new StreamableFile(buffer);
  }

  @Get('exportar/facultad/:facultadId/xlsx')
  @Roles(...ROLES_MODAUT)
  async exportarFacultadXlsx(
    @Param('facultadId') facultadId: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, filename, mime } = await this.exportaciones.exportarPorEntidad(
      'FACULTAD', facultadId, 'xlsx', req.user.rol.nombre, req.user.id,
    );
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return new StreamableFile(buffer);
  }

  @Get('exportar/carrera/:carreraId/pdf')
  @Roles(...ROLES_MODAUT)
  async exportarCarreraPdf(
    @Param('carreraId') carreraId: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, filename, mime } = await this.exportaciones.exportarPorEntidad(
      'CARRERA', carreraId, 'pdf', req.user.rol.nombre, req.user.id,
    );
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return new StreamableFile(buffer);
  }

  @Get('exportar/carrera/:carreraId/xlsx')
  @Roles(...ROLES_MODAUT)
  async exportarCarreraXlsx(
    @Param('carreraId') carreraId: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, filename, mime } = await this.exportaciones.exportarPorEntidad(
      'CARRERA', carreraId, 'xlsx', req.user.rol.nombre, req.user.id,
    );
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return new StreamableFile(buffer);
  }

  @Get('exportar/plan/:planEstudioId/pdf')
  @Roles(...ROLES_MODAUT)
  async exportarPlanPdf(
    @Param('planEstudioId') planEstudioId: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, filename, mime } = await this.exportaciones.exportarPorEntidad(
      'PLAN', planEstudioId, 'pdf', req.user.rol.nombre, req.user.id,
    );
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return new StreamableFile(buffer);
  }

  @Get('exportar/plan/:planEstudioId/xlsx')
  @Roles(...ROLES_MODAUT)
  async exportarPlanXlsx(
    @Param('planEstudioId') planEstudioId: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, filename, mime } = await this.exportaciones.exportarPorEntidad(
      'PLAN', planEstudioId, 'xlsx', req.user.rol.nombre, req.user.id,
    );
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return new StreamableFile(buffer);
  }

  // ── Ficha del docente ────────────────────────────────────────────────────────

  @Get('docentes/:docenteId/ficha')
  @Roles(...ROLES_MODAUT)
  obtenerFichaDocente(
    @Param('docenteId', new ParseUUIDPipe({ version: '4' })) docenteId: string,
    @Req() req: any,
  ) {
    return this.fichaDocente.obtenerFicha(docenteId, req.user.id, req.user.rol.nombre);
  }

  /**
   * Ficha individual de un docente en el contexto de una carrera (IMPL-19B.5 live).
   *
   * Devuelve la ficha del docente con sus vinculaciones, cargos y alertas filtrados
   * al scope de la carrera indicada. El docente debe tener al menos una vinculación
   * APROBADA en esa carrera; de lo contrario responde 404.
   *
   * Seguridad:
   * - carreraId y docenteId se validan como UUID v4.
   * - El usuario debe tener scope sobre la carrera (tieneScopeCarrera).
   * - El endpoint no revela si el docente existe fuera del scope de la carrera.
   */
  @Get('tablero/carrera/:carreraId/docente/:docenteId')
  @Roles(...ROLES_MODAUT)
  obtenerFichaDocenteEnCarrera(
    @Param('carreraId', new ParseUUIDPipe({ version: '4' })) carreraId: string,
    @Param('docenteId', new ParseUUIDPipe({ version: '4' })) docenteId: string,
    @Req() req: any,
  ) {
    return this.fichaDocente.obtenerFichaEnCarrera(
      docenteId,
      carreraId,
      req.user.id,
      req.user.rol.nombre,
    );
  }

  // ── Catálogo de reglas ───────────────────────────────────────────────────────

  /**
   * Lista el catálogo completo de reglas de validación MOD-AUT con metadatos funcionales:
   * código, nombre, descripción, tipo, severidad, alcance, grupo de análisis,
   * estado de implementación y parámetros asociados (configurables y no configurables).
   * No ejecuta evaluadores ni devuelve datos académicos.
   */
  @Get('reglas')
  @Roles(...ROLES_MODAUT)
  listarReglas() {
    return this.reglasCatalogo.listarCatalogo();
  }

  /**
   * Devuelve las Facultades accesibles al usuario con su configuración de MOD-AUT
   * (P-01 tope semanal, P-02 baja dedicación, P-03 máximo materias).
   * null en config indica que la Facultad aún no fue configurada.
   * DIRECTOR_CARRERA ve las facultades de sus carreras; DECANO ve la suya.
   */
  @Get('reglas/config/facultades')
  @Roles(...ROLES_MODAUT)
  obtenerFacultadesConConfig(@Req() req: any) {
    return this.reglasCatalogo.obtenerFacultadesConConfig(req.user.id, req.user.rol.nombre);
  }

  // ── Indicadores ─────────────────────────────────────────────────────────────

  /**
   * Lista todos los indicadores registrados en MOD-AUT con sus metadatos públicos.
   * No ejecuta evaluadores ni devuelve datos académicos.
   * Incluye motivoPendiente para indicadores NO_IMPLEMENTADO.
   */
  @Get('indicadores')
  @Roles(...ROLES_MODAUT)
  listarIndicadores() {
    return this.registro.listar().map((def) => ({
      codigo: def.codigo,
      nombre: def.nombre,
      descripcion: def.descripcion,
      tipo: def.tipo,
      severidad: def.severidad,
      alcance: def.alcance,
      estadoImplementacion: def.estadoImplementacion,
      ...(def.motivoPendiente !== undefined && { motivoPendiente: def.motivoPendiente }),
    }));
  }

  /**
   * Evalúa un indicador individual para el contexto académico indicado.
   *
   * Seguridad:
   * - usuarioId y rolNombre provienen exclusivamente del token JWT (req.user).
   * - El body solo acepta carreraId y planEstudioId opcionales.
   * - Campos adicionales son descartados por ValidationPipe con whitelist:true.
   * - IndicadoresService verifica rol y scope antes de delegar al evaluador.
   * - Para roles territoriales sin contexto: 403 desde IndicadoresService.
   *
   * Preserva todos los estados: CALCULADO, PARCIAL, NO_DETERMINABLE, NO_APLICA y NO_IMPLEMENTADO.
   */
  @Post('indicadores/:codigo/evaluar')
  @HttpCode(200)
  @Roles(...ROLES_MODAUT)
  async evaluarIndicador(
    @Param('codigo') codigo: string,
    @Body() dto: EvaluarIndicadorDto,
    @Req() req: any,
  ) {
    return this.indicadores.evaluar({
      codigoIndicador: codigo,
      contexto: {
        usuarioId: req.user.id,
        rolNombre: req.user.rol.nombre,
        carreraId: dto.carreraId,
        planEstudioId: dto.planEstudioId,
        fechaEvaluacion: new Date(),
      },
    });
  }
}
