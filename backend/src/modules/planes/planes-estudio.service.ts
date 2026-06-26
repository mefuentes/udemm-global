import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PlanesEstudioService {
  constructor(private readonly prisma: PrismaService) {}

  async obtenerTodos() {
    return this.prisma.planEstudio.findMany({
      include: {
        carrera: true,
        _count: { select: { materias: true } }
      },
      orderBy: { nombre: 'asc' }
    });
  }

  async obtenerKpis() {
    const [totalPlanes, totalMaterias, totalCarreras, planesActivos] =
      await Promise.all([
        this.prisma.planEstudio.count(),
        this.prisma.materia.count(),
        this.prisma.carrera.count(),
        this.prisma.planEstudio.count({ where: { estado: 'ACTIVO' } })
      ]);

    return { totalPlanes, totalMaterias, totalCarreras, planesActivos };
  }

  async obtenerPorId(id: string) {
    const plan = await this.prisma.planEstudio.findUnique({
      where: { id },
      include: {
        carrera: true,
        materias: {
          orderBy: [{ anio: 'asc' }, { cuatrimestre: 'asc' }, { nombre: 'asc' }]
        }
      }
    });
    if (!plan) throw new NotFoundException(`Plan de estudios ${id} no encontrado`);
    return plan;
  }

  async crear(data: Record<string, unknown>) {
    return this.prisma.planEstudio.create({ data: data as any });
  }

  async actualizar(id: string, data: Record<string, unknown>) {
    return this.prisma.planEstudio.update({ where: { id }, data: data as any });
  }

  async eliminar(id: string) {
    return this.prisma.planEstudio.update({
      where: { id },
      data: { estado: 'INACTIVO' }
    });
  }
}
