import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from './mail.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
  ) {}

  async validarUsuario(correoElectronico: string, contrasena: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { correoElectronico },
      include: { rol: true }
    });
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const esValido = await bcrypt.compare(contrasena, usuario.contrasenaHash);
    if (!esValido) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const { contrasenaHash, ...rest } = usuario;
    return rest;
  }

  generarTokenAcceso(
    usuario: { id: string; correoElectronico: string; rol: { nombre: string } },
    sesionId?: string | null,
  ) {
    const payload: Record<string, unknown> = {
      correoElectronico: usuario.correoElectronico,
      sub: usuario.id,
      rol: { nombre: usuario.rol.nombre },
    };

    if (sesionId) payload.sesionId = sesionId;

    return this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') ?? '3600s'
    });
  }

  async generarTokenRefresh(usuarioId: string, sesionId?: string | null): Promise<string> {
    const token = await bcrypt.hash(`${usuarioId}-${Date.now()}-${crypto.randomBytes(16).toString('hex')}`, 10);
    const expiracion = new Date();
    expiracion.setDate(
      expiracion.getDate() + Number(this.configService.get<number>('REFRESH_TOKEN_EXPIRES_DAYS') ?? 30)
    );

    await this.prisma.tokenRefresh.create({
      data: { token, usuarioId, sesionId: sesionId ?? undefined, expiracion }
    });

    return token;
  }

  async login(correoElectronico: string, contrasena: string, ip?: string, userAgent?: string) {
    const usuario = await this.validarUsuario(correoElectronico, contrasena);

    const sesion = await this.prisma.sesion.create({
      data: { usuarioId: usuario.id, ip: ip ?? null, userAgent: userAgent ?? null }
    });

    const accessToken = this.generarTokenAcceso(usuario as any, sesion.id);
    const refreshToken = await this.generarTokenRefresh(usuario.id, sesion.id);

    return { accessToken, refreshToken, usuario };
  }

  async refreshToken(refreshTokenCookie: string): Promise<{ accessToken: string; refreshToken: string }> {
    const registro = await this.prisma.tokenRefresh.findUnique({
      where: { token: refreshTokenCookie },
      include: { usuario: { include: { rol: true } } }
    });

    if (!registro) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    if (!registro.activo) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    if (registro.expiracion < new Date()) {
      await this.prisma.tokenRefresh.update({
        where: { id: registro.id },
        data: { activo: false }
      });
      throw new UnauthorizedException('Refresh token expirado');
    }

    const usuario = registro.usuario;
    const sesionId = registro.sesionId;

    await this.prisma.tokenRefresh.update({
      where: { id: registro.id },
      data: { activo: false }
    });

    const accessToken = this.generarTokenAcceso(
      { id: usuario.id, correoElectronico: usuario.correoElectronico, rol: { nombre: usuario.rol.nombre } },
      sesionId,
    );
    const newRefreshToken = await this.generarTokenRefresh(usuario.id, sesionId);

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshTokenCookie: string): Promise<void> {
    if (!refreshTokenCookie) return;

    const registro = await this.prisma.tokenRefresh.findUnique({
      where: { token: refreshTokenCookie },
      select: { id: true, sesionId: true },
    }).catch(() => null);

    if (!registro) return;

    const ops: Promise<unknown>[] = [
      this.prisma.tokenRefresh.update({
        where: { id: registro.id },
        data: { activo: false },
      }),
    ];

    if (registro.sesionId) {
      ops.push(
        this.prisma.sesion.update({
          where: { id: registro.sesionId },
          data: { activo: false },
        }),
      );
    }

    await Promise.all(ops).catch(() => {});
  }

  async me(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        correoElectronico: true,
        nombre: true,
        apellido: true,
        rol: { select: { id: true, nombre: true } }
      }
    });

    if (!usuario) throw new UnauthorizedException('Usuario no encontrado');
    return usuario;
  }

  async solicitarRecuperacion(correoElectronico: string): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { correoElectronico },
    });

    if (!usuario || !usuario.activo) return;

    await this.prisma.tokenRecuperacion.updateMany({
      where: { usuarioId: usuario.id, usado: false },
      data: { usado: true },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiracion = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.tokenRecuperacion.create({
      data: { token, usuarioId: usuario.id, expiracion },
    });

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    const enlace = `${frontendUrl}/restablecer-contrasena?token=${token}`;

    await this.mailService.enviarRecuperacionContrasena(
      usuario.correoElectronico,
      `${usuario.nombre} ${usuario.apellido}`,
      enlace,
    );
  }

  async restablecerContrasena(token: string, nuevaContrasena: string): Promise<void> {
    const registro = await this.prisma.tokenRecuperacion.findUnique({
      where: { token },
      include: { usuario: true },
    });

    if (!registro || registro.usado || registro.expiracion < new Date()) {
      throw new BadRequestException('El enlace de recuperación es inválido o ha expirado.');
    }

    if (!registro.usuario.activo) {
      throw new BadRequestException('El usuario no está activo.');
    }

    const contrasenaHash = await bcrypt.hash(nuevaContrasena, 12);

    await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id: registro.usuarioId },
        data: { contrasenaHash },
      }),
      this.prisma.tokenRecuperacion.update({
        where: { id: registro.id },
        data: { usado: true },
      }),
      // B-04: invalidar todos los refresh tokens activos del usuario
      this.prisma.tokenRefresh.updateMany({
        where: { usuarioId: registro.usuarioId, activo: true },
        data: { activo: false },
      }),
      // Revocación inmediata de todas las sesiones del usuario
      this.prisma.sesion.updateMany({
        where: { usuarioId: registro.usuarioId, activo: true },
        data: { activo: false },
      }),
    ]);
  }
}
