import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CrearPlanDto } from './dto/crear-plan.dto';
import { ActualizarPlanDto } from './dto/actualizar-plan.dto';

@Injectable()
export class PlanesEstudioService {
  constructor(private readonly prisma: PrismaService) {}

  async obtenerCarreras() {
    return this.prisma.carrera.findMany({
      include: {
        facultad: true,
        _count: { select: { planes: true } }
      },
      orderBy: { nombre: 'asc' }
    });
  }

  async obtenerTodos(carreraId?: string) {
    return this.prisma.planEstudio.findMany({
      where: carreraId ? { carreraId } : undefined,
      include: {
        carrera: true,
        _count: { select: { materias: true } }
      },
      orderBy: [{ anio: 'desc' }, { nombre: 'asc' }]
    });
  }

  async obtenerKpis() {
    const [totalPlanes, totalMaterias, totalCarreras, planesActivos] =
      await Promise.all([
        this.prisma.planEstudio.count(),
        this.prisma.materia.count({ where: { estado: 'ACTIVO' } }),
        this.prisma.carrera.count(),
        this.prisma.planEstudio.count({ where: { estado: 'ACTIVO' } })
      ]);

    return { totalPlanes, totalMaterias, totalCarreras, planesActivos };
  }

  async obtenerPorId(id: string) {
    const plan = await this.prisma.planEstudio.findUnique({
      where: { id },
      include: {
        carrera: { include: { facultad: true } },
        materias: {
          orderBy: [{ anio: 'asc' }, { cuatrimestre: 'asc' }, { nombre: 'asc' }]
        }
      }
    });
    if (!plan) throw new NotFoundException(`Plan de estudios ${id} no encontrado`);
    return plan;
  }

  async crear(dto: CrearPlanDto) {
    return this.prisma.planEstudio.create({
      data: { ...dto, estado: dto.estado ?? 'ACTIVO' },
      include: { carrera: true }
    });
  }

  async actualizar(id: string, dto: ActualizarPlanDto) {
    await this.obtenerPorId(id);
    return this.prisma.planEstudio.update({
      where: { id },
      data: dto,
      include: { carrera: true }
    });
  }

  async eliminar(id: string) {
    await this.obtenerPorId(id);
    return this.prisma.planEstudio.update({
      where: { id },
      data: { estado: 'INACTIVO' }
    });
  }
}
