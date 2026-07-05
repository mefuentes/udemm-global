import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query,
  UseGuards, UsePipes, ValidationPipe
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CarrerasService } from './carreras.service';
import { CrearCarreraDto } from './dto/crear-carrera.dto';
import { ActualizarCarreraDto } from './dto/actualizar-carrera.dto';

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

@Controller('carreras')
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class CarrerasController {
  constructor(private readonly carrerasService: CarrerasService) {}

  @Get()
  @Roles(...ROLES_VER)
  obtenerTodas(
    @Query('buscar') buscar?: string,
    @Query('estado') estado?: string,
    @Query('facultadId') facultadId?: string
  ) {
    return this.carrerasService.obtenerTodas(buscar, estado, facultadId);
  }

  @Get(':id')
  @Roles(...ROLES_VER)
  obtenerPorId(@Param('id') id: string) {
    return this.carrerasService.obtenerPorId(id);
  }

  @Post()
  @Roles(...ROLES_EDITAR)
  crear(@Body() dto: CrearCarreraDto) {
    return this.carrerasService.crear(dto);
  }

  @Patch(':id')
  @Roles(...ROLES_EDITAR)
  actualizar(@Param('id') id: string, @Body() dto: ActualizarCarreraDto) {
    return this.carrerasService.actualizar(id, dto);
  }

  @Delete(':id')
  @Roles(...ROLES_ELIMINAR)
  darDeBaja(@Param('id') id: string) {
    return this.carrerasService.darDeBaja(id);
  }
}
