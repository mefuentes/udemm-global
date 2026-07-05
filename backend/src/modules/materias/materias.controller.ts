import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { MateriasService } from './materias.service';
import { CrearMateriaDto } from './dto/crear-materia.dto';
import { ActualizarMateriaDto } from './dto/actualizar-materia.dto';
import { GestionarCorrelativaDto } from './dto/gestionar-correlativa.dto';

const ROLES_VER = [
  'ADMINISTRADOR_SISTEMA',
  'SECRETARIA_ACADEMICA',
  'DIRECTOR_CARRERA',
  'ADMINISTRATIVO',
  'DECANO',
  'RECTORADO',
  'DOCENTE'
] as const;

const ROLES_EDITAR = [
  'ADMINISTRADOR_SISTEMA',
  'SECRETARIA_ACADEMICA',
  'DIRECTOR_CARRERA',
  'ADMINISTRATIVO'
] as const;

@Controller('materias')
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class MateriasController {
  constructor(private readonly materiasService: MateriasService) {}

  // ── Listado ──────────────────────────────────────────────────────────────

  @Get()
  @Roles(...ROLES_VER)
  obtenerTodas(@Query('planEstudioId') planEstudioId?: string) {
    return this.materiasService.obtenerTodas(planEstudioId);
  }

  // ── Ficha completa ───────────────────────────────────────────────────────

  @Get(':id/ficha')
  @Roles(...ROLES_VER)
  obtenerFicha(@Param('id') id: string) {
    return this.materiasService.obtenerFicha(id);
  }

  // ── Historial ────────────────────────────────────────────────────────────

  @Get(':id/historial')
  @Roles(...ROLES_VER)
  obtenerHistorial(@Param('id') id: string) {
    return this.materiasService.obtenerHistorial(id);
  }

  @Get(':id')
  @Roles(...ROLES_VER)
  obtenerPorId(@Param('id') id: string) {
    return this.materiasService.obtenerPorId(id);
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  @Post()
  @Roles(...ROLES_EDITAR)
  crear(@Body() dto: CrearMateriaDto, @Req() req: any) {
    return this.materiasService.crear(dto, req.user.id);
  }

  @Patch(':id')
  @Roles(...ROLES_EDITAR)
  actualizar(@Param('id') id: string, @Body() dto: ActualizarMateriaDto, @Req() req: any) {
    return this.materiasService.actualizar(id, dto, req.user.id);
  }

  @Delete(':id')
  @Roles(...ROLES_EDITAR)
  darDeBaja(@Param('id') id: string, @Req() req: any) {
    return this.materiasService.darDeBaja(id, req.user.id);
  }

  // ── Correlatividades ─────────────────────────────────────────────────────

  @Get(':id/correlativas')
  @Roles(...ROLES_VER)
  obtenerCorrelativas(@Param('id') id: string) {
    return this.materiasService.obtenerCorrelativas(id);
  }

  @Post(':id/correlativas')
  @Roles(...ROLES_EDITAR)
  agregarCorrelativa(
    @Param('id') id: string,
    @Body() dto: GestionarCorrelativaDto,
    @Req() req: any
  ) {
    return this.materiasService.agregarCorrelativa(id, dto, req.user.id);
  }

  @Delete(':id/correlativas/:correlativaId')
  @Roles(...ROLES_EDITAR)
  quitarCorrelativa(
    @Param('id') id: string,
    @Param('correlativaId') correlativaId: string,
    @Req() req: any
  ) {
    return this.materiasService.quitarCorrelativa(id, correlativaId, req.user.id);
  }
}
