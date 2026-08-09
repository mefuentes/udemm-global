import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CrearSubareaDto } from './dto/crear-subarea.dto';
import { ActualizarSubareaDto } from './dto/actualizar-subarea.dto';

@Injectable()
export class AreasDisiplinaresService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Subareas ─────────────────────────────────────────────────────────────

  async listarSubareas(buscar?: string, activo?: string, areaDisciplinarId?: string) {
    const where: Record<string, any> = {};
    if (buscar?.trim()) {
      where.nombre = { contains: buscar.trim().toUpperCase() };
    }
    if (activo === 'true')  where.activo = true;
    if (activo === 'false') where.activo = false;
    if (areaDisciplinarId)  where.areaDisciplinarId = areaDisciplinarId;

    return this.prisma.subarea.findMany({
      where,
      orderBy: { nombre: 'asc' },
      include: { areaDisciplinar: { select: { id: true, nombre: true } } },
    });
  }

  async listarSubareasActivas(areaDisciplinarId?: string) {
    const where: Record<string, any> = { activo: true };
    if (areaDisciplinarId) where.areaDisciplinarId = areaDisciplinarId;

    return this.prisma.subarea.findMany({
      where,
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, areaDisciplinarId: true },
    });
  }

  async crearSubarea(dto: CrearSubareaDto) {
    const nombre = dto.nombre.trim().toUpperCase();

    const area = await this.prisma.areaDisciplinar.findUnique({
      where: { id: dto.areaDisciplinarId },
    });
    if (!area) throw new NotFoundException('Área disciplinar no encontrada');
    if (!area.activo) {
      throw new BadRequestException('No se puede asociar una subárea a un área disciplinar inactiva');
    }

    const existe = await this.prisma.subarea.findFirst({
      where: { nombre, areaDisciplinarId: dto.areaDisciplinarId },
    });
    if (existe) {
      throw new ConflictException(`Ya existe "${nombre}" en esta área disciplinar`);
    }

    return this.prisma.subarea.create({
      data: { nombre, areaDisciplinarId: dto.areaDisciplinarId },
      include: { areaDisciplinar: { select: { id: true, nombre: true } } },
    });
  }

  async actualizarSubarea(id: string, dto: ActualizarSubareaDto) {
    const subarea = await this.prisma.subarea.findUnique({ where: { id } });
    if (!subarea) throw new NotFoundException('Subárea no encontrada');

    const data: Record<string, any> = {};

    if (dto.areaDisciplinarId && dto.areaDisciplinarId !== subarea.areaDisciplinarId) {
      const area = await this.prisma.areaDisciplinar.findUnique({
        where: { id: dto.areaDisciplinarId },
      });
      if (!area) throw new NotFoundException('Área disciplinar no encontrada');
      if (!area.activo) {
        throw new BadRequestException('No se puede asociar una subárea a un área disciplinar inactiva');
      }
      data.areaDisciplinarId = dto.areaDisciplinarId;
    }

    if (dto.nombre?.trim()) {
      const nombre = dto.nombre.trim().toUpperCase();
      const areaId = data.areaDisciplinarId ?? subarea.areaDisciplinarId;
      const duplicado = await this.prisma.subarea.findFirst({
        where: { nombre, areaDisciplinarId: areaId, NOT: { id } },
      });
      if (duplicado) throw new ConflictException(`Ya existe "${nombre}" en esta área disciplinar`);
      data.nombre = nombre;
    }

    if (Object.keys(data).length === 0) return subarea;

    return this.prisma.subarea.update({
      where: { id },
      data,
      include: { areaDisciplinar: { select: { id: true, nombre: true } } },
    });
  }

  async toggleSubarea(id: string) {
    const subarea = await this.prisma.subarea.findUnique({ where: { id } });
    if (!subarea) throw new NotFoundException('Subárea no encontrada');
    return this.prisma.subarea.update({
      where: { id },
      data: { activo: !subarea.activo },
      include: { areaDisciplinar: { select: { id: true, nombre: true } } },
    });
  }

  async eliminarSubarea(id: string) {
    const subarea = await this.prisma.subarea.findUnique({ where: { id } });
    if (!subarea) throw new NotFoundException('Subárea no encontrada');
    try {
      await this.prisma.subarea.delete({ where: { id } });
      return { mensaje: 'Eliminado correctamente' };
    } catch (e: any) {
      if (e?.code === 'P2003') {
        throw new ConflictException('No se puede eliminar: la subárea está siendo utilizada en el sistema');
      }
      throw e;
    }
  }
}
