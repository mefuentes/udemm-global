import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  UsePipes,
  ValidationPipe
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PlanesEstudioService } from './planes-estudio.service';

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

const ROLES_CREAR = [
  'ADMINISTRADOR_SISTEMA',
  'SECRETARIA_ACADEMICA',
  'DIRECTOR_CARRERA'
] as const;

const ROLES_ADMIN = ['ADMINISTRADOR_SISTEMA', 'SECRETARIA_ACADEMICA'] as const;

@Controller('plan-estudios')
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class PlanesEstudioController {
  constructor(private readonly planesEstudioService: PlanesEstudioService) {}

  @Get()
  @Roles(...ROLES_VER)
  obtenerTodos() {
    return this.planesEstudioService.obtenerTodos();
  }

  @Get('kpis')
  @Roles(...ROLES_VER)
  obtenerKpis() {
    return this.planesEstudioService.obtenerKpis();
  }

  @Get(':id')
  @Roles(...ROLES_VER)
  obtenerPorId(@Param('id') id: string) {
    return this.planesEstudioService.obtenerPorId(id);
  }

  @Post()
  @Roles(...ROLES_CREAR)
  crear(@Body() body: Record<string, unknown>) {
    return this.planesEstudioService.crear(body);
  }

  @Patch(':id')
  @Roles(...ROLES_EDITAR)
  actualizar(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.planesEstudioService.actualizar(id, body);
  }

  @Delete(':id')
  @Roles(...ROLES_ADMIN)
  eliminar(@Param('id') id: string) {
    return this.planesEstudioService.eliminar(id);
  }
}
