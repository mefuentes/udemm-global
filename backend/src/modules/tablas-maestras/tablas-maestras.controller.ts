import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TablasMaestrasService } from './tablas-maestras.service';
import { CrearTablaMaestraDto } from './dto/crear-tabla-maestra.dto';
import { ActualizarTablaMaestraDto } from './dto/actualizar-tabla-maestra.dto';

const ROLES_ADMIN = [
  'ADMINISTRADOR_SISTEMA',
  'SECRETARIA_ACADEMICA',
  'DIRECTOR_CARRERA',
] as const;

// ROLES_VER: todos los roles que pueden consultar activos (para selectores en otros módulos)
const ROLES_VER = [
  'ADMINISTRADOR_SISTEMA',
  'SECRETARIA_ACADEMICA',
  'DIRECTOR_CARRERA',
  'ADMINISTRATIVO',
  'DECANO',
  'RECTORADO',
  'DOCENTE',
] as const;

@Controller('configuracion/tablas-maestras')
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class TablasMaestrasController {
  constructor(private readonly service: TablasMaestrasService) {}

  // ── Selector (activos) — accesible para todos los roles con acceso al sistema
  @Get(':tipo/activos')
  @Roles(...ROLES_VER)
  listarActivos(@Param('tipo') tipo: string) {
    return this.service.listarActivos(tipo);
  }

  // ── Listado completo con filtros (solo roles administradores)
  @Get(':tipo')
  @Roles(...ROLES_ADMIN)
  listar(
    @Param('tipo') tipo: string,
    @Query('buscar') buscar?: string,
    @Query('activo') activo?: string,
  ) {
    return this.service.listar(tipo, buscar, activo);
  }

  // ── Crear
  @Post(':tipo')
  @Roles(...ROLES_ADMIN)
  crear(@Param('tipo') tipo: string, @Body() dto: CrearTablaMaestraDto) {
    return this.service.crear(tipo, dto);
  }

  // ── Toggle activo/inactivo
  @Patch(':tipo/:id/toggle')
  @Roles(...ROLES_ADMIN)
  toggle(@Param('tipo') tipo: string, @Param('id') id: string) {
    return this.service.toggleActivo(tipo, id);
  }

  // ── Actualizar nombre
  @Patch(':tipo/:id')
  @Roles(...ROLES_ADMIN)
  actualizar(
    @Param('tipo') tipo: string,
    @Param('id') id: string,
    @Body() dto: ActualizarTablaMaestraDto,
  ) {
    return this.service.actualizar(tipo, id, dto);
  }

  // ── Eliminar
  @Delete(':tipo/:id')
  @Roles(...ROLES_ADMIN)
  eliminar(@Param('tipo') tipo: string, @Param('id') id: string) {
    return this.service.eliminar(tipo, id);
  }
}
