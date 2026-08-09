import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
  StreamableFile,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PlanesEstudioService } from './planes-estudio.service';
import { CrearPlanDto } from './dto/crear-plan.dto';
import { ActualizarPlanDto } from './dto/actualizar-plan.dto';

const ROLES_VER = [
  'ADMINISTRADOR_SISTEMA',
  'SECRETARIA_ACADEMICA',
  'DIRECTOR_CARRERA',
  'ADMINISTRATIVO',
  'DECANO',
  'RECTORADO',
  'DOCENTE'
] as const;

const ROLES_CREAR = [
  'ADMINISTRADOR_SISTEMA',
  'SECRETARIA_ACADEMICA',
  'DIRECTOR_CARRERA'
] as const;

const ROLES_EDITAR = [
  'ADMINISTRADOR_SISTEMA',
  'SECRETARIA_ACADEMICA',
  'DIRECTOR_CARRERA',
  'ADMINISTRATIVO'
] as const;

const ROLES_ADMIN = ['ADMINISTRADOR_SISTEMA', 'SECRETARIA_ACADEMICA'] as const;

const ROLES_EXPORTAR = [
  'ADMINISTRADOR_SISTEMA',
  'SECRETARIA_ACADEMICA',
  'DIRECTOR_CARRERA',
  'DECANO',
  'RECTORADO',
] as const;

@Controller('plan-estudios')
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class PlanesEstudioController {
  constructor(private readonly planesEstudioService: PlanesEstudioService) {}

  @Get('carreras')
  @Roles(...ROLES_VER)
  obtenerCarreras() {
    return this.planesEstudioService.obtenerCarreras();
  }

  @Get('kpis')
  @Roles(...ROLES_VER)
  obtenerKpis() {
    return this.planesEstudioService.obtenerKpis();
  }

  @Get()
  @Roles(...ROLES_VER)
  obtenerTodos(@Query('carreraId') carreraId?: string) {
    return this.planesEstudioService.obtenerTodos(carreraId);
  }

  @Get('exportar/excel')
  @Roles(...ROLES_EXPORTAR)
  async exportarExcel(
    @Query('carreraId') carreraId: string,
    @Query('planId') planId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const fecha = new Date().toISOString().split('T')[0];
    const buffer = await this.planesEstudioService.generarExcel(
      carreraId || undefined,
      planId || undefined,
    );
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="informacion_planes_estudio_${fecha}.xlsx"`,
    });
    return new StreamableFile(buffer);
  }

  @Get('exportar/pdf')
  @Roles(...ROLES_EXPORTAR)
  async exportarPdf(
    @Query('carreraId') carreraId: string,
    @Query('planId') planId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const fecha = new Date().toISOString().split('T')[0];
    const buffer = await this.planesEstudioService.generarPdf(
      carreraId || undefined,
      planId || undefined,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="informacion_planes_estudio_${fecha}.pdf"`,
    });
    return new StreamableFile(buffer);
  }

  @Get(':id/estadisticas')
  @Roles(...ROLES_VER)
  obtenerEstadisticas(@Param('id') id: string) {
    return this.planesEstudioService.obtenerEstadisticas(id);
  }

  @Get(':id')
  @Roles(...ROLES_VER)
  obtenerPorId(@Param('id') id: string) {
    return this.planesEstudioService.obtenerPorId(id);
  }

  @Post()
  @Roles(...ROLES_CREAR)
  crear(@Body() dto: CrearPlanDto) {
    return this.planesEstudioService.crear(dto);
  }

  @Patch(':id')
  @Roles(...ROLES_EDITAR)
  actualizar(@Param('id') id: string, @Body() dto: ActualizarPlanDto) {
    return this.planesEstudioService.actualizar(id, dto);
  }

  @Delete(':id')
  @Roles(...ROLES_ADMIN)
  eliminar(@Param('id') id: string) {
    return this.planesEstudioService.eliminar(id);
  }
}
