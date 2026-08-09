import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificacionesService {
  constructor(private readonly prisma: PrismaService) {}

  private async getDocenteByUsuarioId(usuarioId: string) {
    return this.prisma.docente.findUnique({ where: { usuarioId } });
  }

  async listar(usuarioId: string, rolNombre: string) {
    if (rolNombre === 'DOCENTE') {
      const docente = await this.getDocenteByUsuarioId(usuarioId);
      if (!docente) return [];
      return (this.prisma as any).notificacion.findMany({
        where: { docenteId: docente.id },
        orderBy: { fechaCreacion: 'desc' },
      });
    }
    return (this.prisma as any).notificacion.findMany({
      orderBy: { fechaCreacion: 'desc' },
      take: 200,
    });
  }

  async marcarLeida(id: string, usuarioId: string, rolNombre: string) {
    const notif = await (this.prisma as any).notificacion.findUnique({ where: { id } });
    if (!notif) throw new NotFoundException('Notificación no encontrada');

    if (rolNombre === 'DOCENTE') {
      const docente = await this.getDocenteByUsuarioId(usuarioId);
      if (!docente || notif.docenteId !== docente.id) {
        throw new ForbiddenException('No tenés acceso a esta notificación');
      }
    }

    return (this.prisma as any).notificacion.update({
      where: { id },
      data: { leida: true, fechaLectura: new Date() },
    });
  }

  async contarNoLeidas(usuarioId: string, rolNombre: string): Promise<number> {
    if (rolNombre !== 'DOCENTE') return 0;
    const docente = await this.getDocenteByUsuarioId(usuarioId);
    if (!docente) return 0;
    return (this.prisma as any).notificacion.count({
      where: { docenteId: docente.id, leida: false },
    });
  }

  async marcarTodasLeidas(usuarioId: string, rolNombre: string) {
    if (rolNombre !== 'DOCENTE') return { count: 0 };
    const docente = await this.getDocenteByUsuarioId(usuarioId);
    if (!docente) return { count: 0 };
    const result = await (this.prisma as any).notificacion.updateMany({
      where: { docenteId: docente.id, leida: false },
      data: { leida: true, fechaLectura: new Date() },
    });
    return { count: result.count };
  }
}
