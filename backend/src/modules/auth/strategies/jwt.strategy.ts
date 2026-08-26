import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService, private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.['auth_token'] ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: {
    sub: string;
    correoElectronico: string;
    rol: { nombre: string };
    sesionId?: string;
  }) {
    if (payload.sesionId) {
      const sesion = await this.prisma.sesion.findUnique({ where: { id: payload.sesionId } });
      if (!sesion || !sesion.activo) {
        throw new UnauthorizedException('Sesión inválida o revocada');
      }
    }

    return {
      id: payload.sub,
      correoElectronico: payload.correoElectronico,
      rol: payload.rol,
      sesionId: payload.sesionId,
    };
  }
}
