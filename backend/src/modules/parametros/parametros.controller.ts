import { Body, Controller, Get, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ParametrosService } from './parametros.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('configuracion/parametros')
export class ParametrosController {
  constructor(private readonly parametrosService: ParametrosService) {}

  /** Parámetros institucionales públicos accesibles a cualquier usuario autenticado. */
  @Get('publico')
  @UseGuards(JwtAuthGuard)
  obtenerPublicos() {
    return this.parametrosService.obtenerParametrosPublicos();
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMINISTRADOR_SISTEMA')
  obtener() {
    return this.parametrosService.obtenerParametros();
  }

  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMINISTRADOR_SISTEMA')
  actualizar(@Body() body: { parametros: Array<{ clave: string; valor: string }> }) {
    return this.parametrosService.actualizarParametros(body.parametros);
  }

  @Get('logo')
  @UseGuards(JwtAuthGuard)
  obtenerLogo() {
    return this.parametrosService.obtenerLogo().then(valor => ({ valor }));
  }

  @Post('logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMINISTRADOR_SISTEMA')
  @UseInterceptors(FileInterceptor('logo', { storage: memoryStorage(), limits: { fileSize: 210 * 1024 } }))
  subirLogo(@UploadedFile() file: Express.Multer.File) {
    return this.parametrosService.subirLogo(file.buffer, file.mimetype);
  }
}
