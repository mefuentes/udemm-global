import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe
} from '@nestjs/common';
import { DocentesService } from './docentes.service';
import { CrearDocenteDto } from './dto/crear-docente.dto';
import { ActualizarDocenteDto } from './dto/actualizar-docente.dto';
import { BuscarDocentesDto } from './dto/buscar-docentes.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('docentes')
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class DocentesController {
  constructor(private readonly docentesService: DocentesService) {}

  @Post()
  @Roles('ADMINISTRADOR_SISTEMA', 'DECANO', 'RECTORADO', 'DIRECTOR_CARRERA', 'SECRETARIA_ACADEMICA', 'ADMINISTRATIVO')
  async crear(@Body() crearDocenteDto: CrearDocenteDto) {
    return this.docentesService.crearDocente(crearDocenteDto);
  }

  @Get()
  @Roles('ADMINISTRADOR_SISTEMA', 'DECANO', 'RECTORADO', 'DIRECTOR_CARRERA', 'SECRETARIA_ACADEMICA', 'ADMINISTRATIVO')
  async obtenerTodos(@Query() query: BuscarDocentesDto) {
    const buscar = query.buscar ?? query.busqueda;
    const pagina = query.page ?? query.pagina ?? 1;
    const limite = query.limit ?? query.limite ?? 10;
    const activo = query.activo === undefined ? undefined : query.activo === 'true';
    return this.docentesService.obtenerDocentes(buscar, activo, pagina, limite);
  }

  @Get(':id')
  @Roles('ADMINISTRADOR_SISTEMA', 'DECANO', 'RECTORADO', 'DIRECTOR_CARRERA', 'SECRETARIA_ACADEMICA', 'ADMINISTRATIVO')
  async obtenerPorId(@Param('id') id: string) {
    return this.docentesService.obtenerDocentePorId(id);
  }

  @Get('mi-ficha')
  @Roles('DOCENTE')
  async obtenerMiFicha(@Req() req: any) {
    const usuarioId = req.user?.id;
    return this.docentesService.obtenerDocentePorUsuarioId(usuarioId);
  }

  @Patch(':id')
  @Roles('ADMINISTRADOR_SISTEMA', 'DECANO', 'RECTORADO', 'DIRECTOR_CARRERA', 'SECRETARIA_ACADEMICA', 'ADMINISTRATIVO')
  async actualizar(@Param('id') id: string, @Body() actualizarDocenteDto: ActualizarDocenteDto) {
    return this.docentesService.actualizarDocente(id, actualizarDocenteDto);
  }

  @Patch('mi-ficha')
  @Roles('DOCENTE')
  async actualizarMiFicha(@Req() req: any, @Body() actualizarDocenteDto: ActualizarDocenteDto) {
    const usuarioId = req.user?.id;
    return this.docentesService.actualizarDocentePorUsuarioId(usuarioId, actualizarDocenteDto);
  }

  @Delete(':id')
  @Roles('ADMINISTRADOR_SISTEMA', 'DECANO', 'RECTORADO', 'SECRETARIA_ACADEMICA')
  async eliminar(@Param('id') id: string) {
    return this.docentesService.eliminarDocente(id);
  }
}
