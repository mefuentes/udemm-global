import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';

const SELECT_USUARIO = {
  id: true,
  nombre: true,
  apellido: true,
  correoElectronico: true,
  activo: true,
  fechaCreacion: true,
  fechaActualizacion: true,
  rol: { select: { id: true, nombre: true } }
};

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async crearUsuario(data: {
    nombre: string;
    apellido: string;
    correoElectronico: string;
    contrasena: string;
    rolId: string;
  }) {
    const existe = await this.prisma.usuario.findUnique({
      where: { correoElectronico: data.correoElectronico }
    });
    if (existe) throw new BadRequestException('El correo electrónico ya está registrado');

    const contrasenaHash = await bcrypt.hash(data.contrasena, 10);
    return this.prisma.usuario.create({
      data: {
        nombre: data.nombre,
        apellido: data.apellido,
        correoElectronico: data.correoElectronico,
        contrasenaHash,
        rolId: data.rolId
      },
      select: SELECT_USUARIO
    });
  }

  async obtenerUsuarios(buscar?: string, activo?: boolean) {
    const where: any = {};
    if (buscar) {
      where.OR = [
        { nombre: { contains: buscar, mode: 'insensitive' } },
        { apellido: { contains: buscar, mode: 'insensitive' } },
        { correoElectronico: { contains: buscar, mode: 'insensitive' } }
      ];
    }
    if (activo !== undefined) where.activo = activo;

    const [data, total] = await Promise.all([
      this.prisma.usuario.findMany({ where, select: SELECT_USUARIO, orderBy: { apellido: 'asc' } }),
      this.prisma.usuario.count({ where })
    ]);
    return { data, total };
  }

  async obtenerUsuarioPorId(id: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id }, select: SELECT_USUARIO });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    return usuario;
  }

  async actualizarUsuario(id: string, data: {
    nombre?: string;
    apellido?: string;
    correoElectronico?: string;
    contrasena?: string;
    rolId?: string;
  }) {
    await this.obtenerUsuarioPorId(id);

    if (data.correoElectronico) {
      const existe = await this.prisma.usuario.findFirst({
        where: { correoElectronico: data.correoElectronico, NOT: { id } }
      });
      if (existe) throw new BadRequestException('El correo electrónico ya está en uso');
    }

    const updateData: any = { ...data };
    if (data.contrasena) {
      updateData.contrasenaHash = await bcrypt.hash(data.contrasena, 10);
    }
    delete updateData.contrasena;

    return this.prisma.usuario.update({ where: { id }, data: updateData, select: SELECT_USUARIO });
  }

  async toggleEstado(id: string) {
    const usuario = await this.obtenerUsuarioPorId(id);
    return this.prisma.usuario.update({
      where: { id },
      data: { activo: !usuario.activo },
      select: SELECT_USUARIO
    });
  }
}
