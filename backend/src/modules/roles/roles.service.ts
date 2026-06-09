import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async obtenerRoles() {
    const roles = await this.prisma.rol.findMany({
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        activo: true,
        fechaCreacion: true,
        _count: { select: { usuarios: true } }
      },
      orderBy: { nombre: 'asc' }
    });
    return roles.map(r => ({ ...r, cantidadUsuarios: r._count.usuarios, _count: undefined }));
  }

  async obtenerRolPorId(id: string) {
    const rol = await this.prisma.rol.findUnique({
      where: { id },
      select: {
        id: true, nombre: true, descripcion: true, activo: true, fechaCreacion: true,
        _count: { select: { usuarios: true } }
      }
    });
    if (!rol) throw new NotFoundException('Rol no encontrado');
    return { ...rol, cantidadUsuarios: rol._count.usuarios, _count: undefined };
  }

  async crearRol(data: { nombre: string; descripcion?: string }) {
    const existe = await this.prisma.rol.findUnique({ where: { nombre: data.nombre } });
    if (existe) throw new BadRequestException('Ya existe un rol con ese nombre');
    return this.prisma.rol.create({
      data: { nombre: data.nombre.toUpperCase().replace(/ /g, '_'), descripcion: data.descripcion },
      select: { id: true, nombre: true, descripcion: true, activo: true, fechaCreacion: true }
    });
  }

  async actualizarRol(id: string, data: { nombre?: string; descripcion?: string }) {
    await this.obtenerRolPorId(id);
    if (data.nombre) data.nombre = data.nombre.toUpperCase().replace(/ /g, '_');
    return this.prisma.rol.update({
      where: { id },
      data,
      select: { id: true, nombre: true, descripcion: true, activo: true, fechaCreacion: true }
    });
  }

  async toggleEstado(id: string) {
    const rol = await this.obtenerRolPorId(id);
    return this.prisma.rol.update({
      where: { id },
      data: { activo: !rol.activo },
      select: { id: true, nombre: true, descripcion: true, activo: true, fechaCreacion: true }
    });
  }
}
