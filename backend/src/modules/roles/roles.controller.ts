import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RolesService } from './roles.service';
import { CrearRolDto } from './dto/crear-rol.dto';
import { ActualizarRolDto } from './dto/actualizar-rol.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('configuracion/roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRADOR_SISTEMA')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  listar() {
    return this.rolesService.obtenerRoles();
  }

  @Get(':id')
  obtenerPorId(@Param('id') id: string) {
    return this.rolesService.obtenerRolPorId(id);
  }

  @Post()
  crear(@Body() dto: CrearRolDto) {
    return this.rolesService.crearRol(dto);
  }

  @Patch(':id')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarRolDto) {
    return this.rolesService.actualizarRol(id, dto);
  }

  @Patch(':id/estado')
  toggleEstado(@Param('id') id: string) {
    return this.rolesService.toggleEstado(id);
  }
}
