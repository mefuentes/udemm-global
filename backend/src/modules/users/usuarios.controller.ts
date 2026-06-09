import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('configuracion/usuarios')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRADOR_SISTEMA')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  crear(@Body() dto: CrearUsuarioDto) {
    return this.usuariosService.crearUsuario(dto);
  }

  @Get()
  listar(@Query('buscar') buscar?: string, @Query('activo') activo?: string) {
    const activoBool = activo === undefined ? undefined : activo === 'true';
    return this.usuariosService.obtenerUsuarios(buscar, activoBool);
  }

  @Get(':id')
  obtenerPorId(@Param('id') id: string) {
    return this.usuariosService.obtenerUsuarioPorId(id);
  }

  @Patch(':id')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarUsuarioDto) {
    return this.usuariosService.actualizarUsuario(id, dto);
  }

  @Patch(':id/estado')
  toggleEstado(@Param('id') id: string) {
    return this.usuariosService.toggleEstado(id);
  }
}
