import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActualizarProgramaDto } from './dto/actualizar-programa.dto';

const HISTORIAL_INCLUDE = {
  historial: {
    include: {
      usuario: {
        select: { id: true, nombre: true, apellido: true, correoElectronico: true }
      }
    },
    orderBy: { fecha: 'desc' as const },
    take: 50
  }
};

@Injectable()
export class ProgramasService {
  constructor(private readonly prisma: PrismaService) {}

  async obtenerPrograma(materiaId: string) {
    const materia = await this.prisma.materia.findUnique({ where: { id: materiaId } });
    if (!materia) throw new NotFoundException(`Materia ${materiaId} no encontrada`);

    return this.prisma.programaAsignatura.upsert({
      where: { materiaId },
      create: { materiaId },
      update: {},
      include: HISTORIAL_INCLUDE
    });
  }

  async actualizarPrograma(materiaId: string, dto: ActualizarProgramaDto, usuarioId: string) {
    const materia = await this.prisma.materia.findUnique({ where: { id: materiaId } });
    if (!materia) throw new NotFoundException(`Materia ${materiaId} no encontrada`);

    const { seccionModificada, fechaAprobacion, ...rest } = dto;

    const data: Record<string, unknown> = { ...rest };
    if (fechaAprobacion !== undefined) {
      data.fechaAprobacion = fechaAprobacion ? new Date(fechaAprobacion) : null;
    }

    const programa = await this.prisma.programaAsignatura.upsert({
      where: { materiaId },
      create: { materiaId, ...data },
      update: data,
    });

    const descripcion = seccionModificada
      ? `Sección "${seccionModificada}" actualizada`
      : 'Programa actualizado';

    await this.prisma.historialPrograma.create({
      data: {
        programaId: programa.id,
        usuarioId,
        accion: data.estadoPrograma === 'APROBADO' ? 'APROBACION' : 'ACTUALIZACION',
        seccion: seccionModificada ?? null,
        descripcion
      }
    });

    return this.prisma.programaAsignatura.findUnique({
      where: { id: programa.id },
      include: HISTORIAL_INCLUDE
    });
  }
}
