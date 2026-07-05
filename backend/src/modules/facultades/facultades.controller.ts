import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query,
  UseGuards, UsePipes, ValidationPipe
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { FacultadesService } from './facultades.service';
import { CrearFacultadDto } from './dto/crear-facultad.dto';
import { ActualizarFacultadDto } from './dto/actualizar-facultad.dto';

const ROLES_VER = [
  'ADMINISTRADOR_SISTEMA', 'SECRETARIA_ACADEMICA', 'ADMINISTRATIVO',
  'DECANO', 'RECTORADO', 'DIRECTOR_CARRERA', 'DOCENTE'
] as const;

const ROLES_EDITAR = [
  'ADMINISTRADOR_SISTEMA', 'SECRETARIA_ACADEMICA', 'ADMINISTRATIVO'
] as const;

const ROLES_ELIMINAR = [
  'ADMINISTRADOR_SISTEMA', 'SECRETARIA_ACADEMICA'
] as const;

@Controller('facultades')
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class FacultadesController {
  constructor(private readonly facultadesService: FacultadesService) {}

  @Get('universidades')
  @Roles(...ROLES_VER)
  obtenerUniversidades() {
    return this.facultadesService.obtenerUniversidades();
  }

  @Get()
  @Roles(...ROLES_VER)
  obtenerTodas(
    @Query('buscar') buscar?: string,
    @Query('estado') estado?: string
  ) {
    return this.facultadesService.obtenerTodas(buscar, estado);
  }

  @Get(':id')
  @Roles(...ROLES_VER)
  obtenerPorId(@Param('id') id: string) {
    return this.facultadesService.obtenerPorId(id);
  }

  @Post()
  @Roles(...ROLES_EDITAR)
  crear(@Body() dto: CrearFacultadDto) {
    return this.facultadesService.crear(dto);
  }

  @Patch(':id')
  @Roles(...ROLES_EDITAR)
  actualizar(@Param('id') id: string, @Body() dto: ActualizarFacultadDto) {
    return this.facultadesService.actualizar(id, dto);
  }

  @Delete(':id')
  @Roles(...ROLES_ELIMINAR)
  darDeBaja(@Param('id') id: string) {
    return this.facultadesService.darDeBaja(id);
  }
}
