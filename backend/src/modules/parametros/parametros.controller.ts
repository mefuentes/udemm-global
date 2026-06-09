import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ParametrosService } from './parametros.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('configuracion/parametros')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRADOR_SISTEMA')
export class ParametrosController {
  constructor(private readonly parametrosService: ParametrosService) {}

  @Get()
  obtener() {
    return this.parametrosService.obtenerParametros();
  }

  @Patch()
  actualizar(@Body() body: { parametros: Array<{ clave: string; valor: string }> }) {
    return this.parametrosService.actualizarParametros(body.parametros);
  }
}
