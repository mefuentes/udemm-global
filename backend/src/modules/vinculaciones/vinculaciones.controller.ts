import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { VinculacionesService } from './vinculaciones.service';
import { CrearVinculacionDto } from './dto/crear-vinculacion.dto';
import { FiltrarVinculacionesDto } from './dto/filtrar-vinculaciones.dto';
import { RechazarVinculacionDto } from './dto/rechazar-vinculacion.dto';

// Roles que pueden leer (incluye DOCENTE — el servicio filtra automáticamente)
const ROLES_LEER = [
  'ADMINISTRADOR_SISTEMA', 'SECRETARIA_ACADEMICA', 'DECANO', 'RECTORADO', 'DOCENTE',
] as const;

// Roles que pueden crear solicitudes de vinculación
const ROLES_CREAR = [
  'ADMINISTRADOR_SISTEMA', 'SECRETARIA_ACADEMICA', 'DECANO', 'RECTORADO',
] as const;

// Roles que pueden aprobar o rechazar (DOCENTE solo las propias)
const ROLES_APROBAR = ['ADMINISTRADOR_SISTEMA', 'DOCENTE'] as const;

@Controller('vinculaciones-catedra')
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class VinculacionesController {
  constructor(private readonly service: VinculacionesService) {}

  @Get()
  @Roles(...ROLES_LEER)
  listar(@Query() filtros: FiltrarVinculacionesDto, @Req() req: any) {
    return this.service.listar(filtros, req.user.id, req.user?.rol?.nombre ?? '');
  }

  @Get(':id')
  @Roles(...ROLES_LEER)
  obtenerPorId(@Param('id') id: string, @Req() req: any) {
    return this.service.obtenerPorId(id, req.user.id, req.user?.rol?.nombre ?? '');
  }

  @Post()
  @Roles(...ROLES_CREAR)
  crear(@Body() dto: CrearVinculacionDto, @Req() req: any) {
    return this.service.crear(dto, req.user.id);
  }

  @Patch(':id/aprobar')
  @Roles(...ROLES_APROBAR)
  aprobar(@Param('id') id: string, @Req() req: any) {
    return this.service.aprobar(id, req.user.id, req.user?.rol?.nombre ?? '');
  }

  @Patch(':id/rechazar')
  @Roles(...ROLES_APROBAR)
  rechazar(
    @Param('id') id: string,
    @Body() dto: RechazarVinculacionDto,
    @Req() req: any,
  ) {
    return this.service.rechazar(id, dto, req.user.id, req.user?.rol?.nombre ?? '');
  }
}
