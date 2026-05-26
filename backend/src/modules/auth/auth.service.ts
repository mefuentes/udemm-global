import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService
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

  generarTokenAcceso(usuario: { id: string; correoElectronico: string; rol: { nombre: string } }) {
    const payload = {
      correoElectronico: usuario.correoElectronico,
      sub: usuario.id,
      rol: { nombre: usuario.rol.nombre }
    };

    return this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '3600s'
    });
  }

  async generarTokenRefresh(usuarioId: string) {
    const token = await bcrypt.hash(`${usuarioId}-${Date.now()}`, 10);
    const expiracion = new Date();
    expiracion.setDate(expiracion.getDate() + Number(this.configService.get<number>('REFRESH_TOKEN_EXPIRES_DAYS') || 30));

    await this.prisma.tokenRefresh.create({
      data: {
        token,
        usuarioId,
        expiracion
      }
    });

    return token;
  }

  async login(correoElectronico: string, contrasena: string) {
    const usuario = await this.validarUsuario(correoElectronico, contrasena);
    const accessToken = this.generarTokenAcceso(usuario as any);
    const refreshToken = await this.generarTokenRefresh(usuario.id);

    return {
      accessToken,
      refreshToken,
      usuario
    };
  }

  async refreshToken(refreshToken: string) {
    const registro = await this.prisma.tokenRefresh.findUnique({
      where: { token: refreshToken },
      include: { usuario: { include: { rol: true } } }
    });

    if (!registro || !registro.activo || registro.expiracion < new Date()) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const usuario = registro.usuario;
    const accessToken = this.generarTokenAcceso({
      id: usuario.id,
      correoElectronico: usuario.correoElectronico,
      rol: { nombre: usuario.rol.nombre }
    });

    return {
      accessToken,
      refreshToken
    };
  }
}
