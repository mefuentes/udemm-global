import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { NormativasService } from './normativas.service';
import { CrearNormativaDto } from './dto/crear-normativa.dto';
import { ListarNormativasDto } from './dto/listar-normativas.dto';

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

@Controller('normativas')
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class NormativasController {
  constructor(private readonly service: NormativasService) {}

  @Post()
  @Roles(...ROLES_GESTION)
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      // Límite holgado en multer — la validación real (15 MB) la hace el service
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  crear(
    @Body() dto: CrearNormativaDto,
    @UploadedFile() archivo: Express.Multer.File,
  ) {
    return this.service.crear(dto, archivo);
  }

  // Las rutas literales van ANTES que los parámetros dinámicos
  @Get('tipos')
  @Roles(...ROLES_CONSULTA)
  obtenerTipos() {
    return this.service.obtenerTipos();
  }

  @Get('conteo-por-tipo')
  @Roles(...ROLES_CONSULTA)
  conteoPorTipo(@Req() req: any) {
    return this.service.conteoPorTipo(req.user?.rol?.nombre ?? '');
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
    return this.service.servirArchivo(id, req.user?.rol?.nombre ?? '', download === 'true');
  }

  @Get(':id')
  @Roles(...ROLES_CONSULTA)
  obtenerPorId(@Param('id') id: string, @Req() req: any) {
    return this.service.obtenerPorId(id, req.user?.rol?.nombre ?? '');
  }
}
