import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AreasDisiplinaresService } from './areas-disciplinares.service';
import { CrearSubareaDto } from './dto/crear-subarea.dto';
import { ActualizarSubareaDto } from './dto/actualizar-subarea.dto';

const ROLES_ADMIN = ['ADMINISTRADOR_SISTEMA', 'SECRETARIA_ACADEMICA', 'DIRECTOR_CARRERA'];
const ROLES_VER   = [...ROLES_ADMIN, 'DOCENTE'];

@Controller('configuracion/subareas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AreasDisiplinaresController {
  constructor(private readonly service: AreasDisiplinaresService) {}

  @Get('activos')
  @Roles(...ROLES_VER)
  listarActivos(
    @Query('areaDisciplinarId') areaDisciplinarId?: string,
  ) {
    return this.service.listarSubareasActivas(areaDisciplinarId);
  }

  @Get()
  @Roles(...ROLES_VER)
  listar(
    @Query('buscar') buscar?: string,
    @Query('activo') activo?: string,
    @Query('areaDisciplinarId') areaDisciplinarId?: string,
  ) {
    return this.service.listarSubareas(buscar, activo, areaDisciplinarId);
  }

  @Post()
  @Roles(...ROLES_ADMIN)
  crear(@Body() dto: CrearSubareaDto) {
    return this.service.crearSubarea(dto);
  }

  @Patch(':id/toggle')
  @Roles(...ROLES_ADMIN)
  toggle(@Param('id') id: string) {
    return this.service.toggleSubarea(id);
  }

  @Patch(':id')
  @Roles(...ROLES_ADMIN)
  actualizar(@Param('id') id: string, @Body() dto: ActualizarSubareaDto) {
    return this.service.actualizarSubarea(id, dto);
  }

  @Delete(':id')
  @Roles(...ROLES_ADMIN)
  eliminar(@Param('id') id: string) {
    return this.service.eliminarSubarea(id);
  }
}
