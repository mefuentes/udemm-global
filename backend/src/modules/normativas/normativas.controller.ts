import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { NormativasService } from './normativas.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CrearNormativaDto } from './dto/crear-normativa.dto';
import { ActualizarNormativaDto } from './dto/actualizar-normativa.dto';
import { CambiarEstadoNormativaDto } from './dto/cambiar-estado-normativa.dto';
import { EliminarNormativaDto } from './dto/eliminar-normativa.dto';
import { ListarNormativasDto } from './dto/listar-normativas.dto';
import { ListarAuditoriaDto } from '../auditoria/dto/listar-auditoria.dto';

const ROLES_CONSULTA = [
  'ADMINISTRADOR_SISTEMA',
  'SECRETARIA_ACADEMICA',
  'DIRECTOR_CARRERA',
  'ADMINISTRATIVO',
  'DECANO',
  'RECTORADO',
  'DOCENTE',
] as const;

const ROLES_GESTION = [
  'ADMINISTRADOR_SISTEMA',
  'SECRETARIA_ACADEMICA',
  'DECANO',
  'RECTORADO',
] as const;

function extraerIp(req: any): string | null {
  const forwarded = req.headers?.['x-forwarded-for'] as string | undefined;
  return forwarded?.split(',')[0]?.trim() ?? req.ip ?? null;
}

function extraerUsuarioId(req: any): string | null {
  return req.user?.sub ?? req.user?.id ?? null;
}

@Controller('normativas')
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class NormativasController {
  constructor(
    private readonly service:    NormativasService,
    private readonly auditoria:  AuditoriaService,
  ) {}

  @Post()
  @Roles(...ROLES_GESTION)
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  crear(
    @Body() dto: CrearNormativaDto,
    @UploadedFile() archivo: Express.Multer.File,
    @Req() req: any,
  ) {
    return this.service.crear(dto, archivo, extraerUsuarioId(req), extraerIp(req));
  }

  // Las rutas literales van ANTES que los parámetros dinámicos

  @Get('tipos')
  @Roles(...ROLES_CONSULTA)
  obtenerTipos() {
    return this.service.obtenerTipos();
  }

  @Get('candidata-sucesora')
  @Roles(...ROLES_GESTION)
  buscarCandidataSucesora(
    @Query('numeroNorma') numeroNorma: string,
    @Query('anio', ParseIntPipe) anio: number,
    @Query('excluirId') excluirId: string,
  ) {
    return this.service.buscarCandidataSucesora(numeroNorma, anio, excluirId);
  }

  @Get('conteo-por-tipo')
  @Roles(...ROLES_CONSULTA)
  conteoPorTipo(@Req() req: any) {
    return this.service.conteoPorTipo(req.user?.rol?.nombre ?? '');
  }

  // Log de auditoría — rutas antes de :id para evitar que Express las consuma como parámetro

  @Get('auditoria')
  @Roles(...ROLES_GESTION)
  listarAuditoria(@Query() dto: ListarAuditoriaDto) {
    return this.auditoria.listar(dto);
  }

  @Get('auditoria/:logId')
  @Roles(...ROLES_GESTION)
  obtenerAuditoriaPorId(@Param('logId') logId: string) {
    return this.auditoria.obtenerPorId(logId);
  }

  @Get()
  @Roles(...ROLES_CONSULTA)
  listar(@Query() dto: ListarNormativasDto, @Req() req: any) {
    return this.service.listar(dto, req.user?.rol?.nombre ?? '');
  }

  // :id/archivo ANTES de :id para que Express no consuma "archivo" como parámetro
  @Get(':id/archivo')
  @Roles(...ROLES_CONSULTA)
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  servirArchivo(
    @Param('id') id: string,
    @Query('download') download: string,
    @Req() req: any,
  ): Promise<StreamableFile> {
    return this.service.servirArchivo(
      id,
      req.user?.rol?.nombre ?? '',
      download === 'true',
      extraerUsuarioId(req),
      extraerIp(req),
    );
  }

  @Patch(':id/estado')
  @Roles(...ROLES_GESTION)
  cambiarEstado(
    @Param('id') id: string,
    @Body() dto: CambiarEstadoNormativaDto,
    @Req() req: any,
  ) {
    return this.service.cambiarEstado(id, dto, extraerUsuarioId(req), extraerIp(req));
  }

  @Patch(':id')
  @Roles(...ROLES_GESTION)
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarNormativaDto,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @Req() req: any,
  ) {
    return this.service.actualizar(
      id,
      dto,
      archivo,
      req.user?.rol?.nombre ?? '',
      extraerUsuarioId(req),
      extraerIp(req),
    );
  }

  @Delete(':id')
  @Roles(...ROLES_GESTION)
  eliminarLogico(
    @Param('id') id: string,
    @Body() dto: EliminarNormativaDto,
    @Req() req: any,
  ) {
    return this.service.eliminarLogico(id, dto, extraerUsuarioId(req), extraerIp(req));
  }

  @Get(':id')
  @Roles(...ROLES_CONSULTA)
  obtenerPorId(@Param('id') id: string, @Req() req: any) {
    return this.service.obtenerPorId(
      id,
      req.user?.rol?.nombre ?? '',
      extraerUsuarioId(req),
      extraerIp(req),
    );
  }
}
