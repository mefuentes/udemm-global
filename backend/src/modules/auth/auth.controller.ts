import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { SolicitarRecuperacionDto } from './dto/solicitar-recuperacion.dto';
import { RestablecerContrasenaDto } from './dto/restablecer-contrasena.dto';

const COOKIE_AUTH = 'auth_token';
const COOKIE_REFRESH = 'refresh_token';

function baseCookieOpts(isProd: boolean) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
  };
}

@Controller('auth')
export class AuthController {
  private readonly isProd: boolean;

  constructor(private readonly authService: AuthService) {
    this.isProd = process.env.NODE_ENV === 'production';
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, usuario } = await this.authService.login(
      loginDto.correoElectronico,
      loginDto.contrasena,
      req.ip,
      req.headers['user-agent'],
    );

    const base = baseCookieOpts(this.isProd);

    res.cookie(COOKIE_AUTH, accessToken, { ...base, path: '/' });
    res.cookie(COOKIE_REFRESH, refreshToken, {
      ...base,
      path: '/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return { usuario };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshCookie: string | undefined = req.cookies?.[COOKIE_REFRESH];
    if (!refreshCookie) {
      throw new UnauthorizedException('Sesión expirada');
    }

    const { accessToken, refreshToken } = await this.authService.refreshToken(refreshCookie);

    const base = baseCookieOpts(this.isProd);

    res.cookie(COOKIE_AUTH, accessToken, { ...base, path: '/' });
    res.cookie(COOKIE_REFRESH, refreshToken, {
      ...base,
      path: '/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return { ok: true };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshCookie: string | undefined = req.cookies?.[COOKIE_REFRESH];
    await this.authService.logout(refreshCookie ?? '');

    res.clearCookie(COOKIE_AUTH, { path: '/' });
    res.clearCookie(COOKIE_REFRESH, { path: '/auth' });

    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request) {
    const usuario = await this.authService.me((req.user as { id: string }).id);
    return { usuario };
  }

  @Post('solicitar-recuperacion')
  @HttpCode(HttpStatus.OK)
  async solicitarRecuperacion(@Body() dto: SolicitarRecuperacionDto) {
    await this.authService.solicitarRecuperacion(dto.correoElectronico);
    return { message: 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.' };
  }

  @Post('restablecer-contrasena')
  @HttpCode(HttpStatus.OK)
  async restablecerContrasena(@Body() dto: RestablecerContrasenaDto) {
    await this.authService.restablecerContrasena(dto.token, dto.nuevaContrasena);
    return { message: 'Contraseña actualizada correctamente. Ya podés iniciar sesión.' };
  }
}
