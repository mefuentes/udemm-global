import { Controller, Get, Param, Patch, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { NotificacionesService } from './notificaciones.service';

const ROLES_NOTIFICACIONES = ['ADMINISTRADOR_SISTEMA', 'DOCENTE'] as const;

@Controller('notificaciones')
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class NotificacionesController {
  constructor(private readonly service: NotificacionesService) {}

  @Get()
  @Roles(...ROLES_NOTIFICACIONES)
  listar(@Req() req: any) {
    return this.service.listar(req.user.id, req.user?.rol?.nombre ?? '');
  }

  // Rutas literales ANTES de las rutas con parámetros para evitar colisiones
  @Get('no-leidas/count')
  @Roles(...ROLES_NOTIFICACIONES)
  async contarNoLeidas(@Req() req: any) {
    const count = await this.service.contarNoLeidas(req.user.id, req.user?.rol?.nombre ?? '');
    return { count };
  }

  @Patch('todas/leer')
  @Roles(...ROLES_NOTIFICACIONES)
  marcarTodasLeidas(@Req() req: any) {
    return this.service.marcarTodasLeidas(req.user.id, req.user?.rol?.nombre ?? '');
  }

  @Patch(':id/leer')
  @Roles(...ROLES_NOTIFICACIONES)
  marcarLeida(@Param('id') id: string, @Req() req: any) {
    return this.service.marcarLeida(id, req.user.id, req.user?.rol?.nombre ?? '');
  }
}
