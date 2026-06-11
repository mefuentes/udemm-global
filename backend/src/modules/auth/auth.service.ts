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
      data: { token, usuarioId, expiracion }
    });

    return token;
  }

  async login(correoElectronico: string, contrasena: string) {
    const usuario = await this.validarUsuario(correoElectronico, contrasena);
    const accessToken = this.generarTokenAcceso(usuario as any);
    const refreshToken = await this.generarTokenRefresh(usuario.id);

    return { accessToken, refreshToken, usuario };
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

    return { accessToken, refreshToken };
  }

  async solicitarRecuperacion(correoElectronico: string): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { correoElectronico },
    });

    // Respuesta genérica para no revelar si el email existe o no
    if (!usuario || !usuario.activo) return;

    // Invalidar tokens anteriores no usados
    await this.prisma.tokenRecuperacion.updateMany({
      where: { usuarioId: usuario.id, usado: false },
      data: { usado: true },
    });

    // Crear nuevo token seguro (1 hora de vigencia)
    const token = crypto.randomBytes(32).toString('hex');
    const expiracion = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.tokenRecuperacion.create({
      data: { token, usuarioId: usuario.id, expiracion },
    });

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
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
    ]);
  }
}
