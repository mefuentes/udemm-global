import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async crearUsuario(data: { nombre: string; apellido: string; correoElectronico: string; contrasena: string; rolId: string }) {
    const existe = await this.prisma.usuario.findUnique({
      where: { correoElectronico: data.correoElectronico }
    });
    if (existe) {
      throw new BadRequestException('El correo electrónico ya está registrado');
    }

    const contrasenaHash = await bcrypt.hash(data.contrasena, 10);

    return this.prisma.usuario.create({
      data: {
        nombre: data.nombre,
        apellido: data.apellido,
        correoElectronico: data.correoElectronico,
        contrasenaHash,
        rolId: data.rolId
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        correoElectronico: true,
        activo: true,
        fechaCreacion: true,
        fechaActualizacion: true,
        rol: {
          select: {
            id: true,
            nombre: true
          }
        }
      }
    });
  }

  async obtenerUsuarios() {
    return this.prisma.usuario.findMany({
      select: {
        id: true,
        nombre: true,
        apellido: true,
        correoElectronico: true,
        activo: true,
        fechaCreacion: true,
        fechaActualizacion: true,
        rol: {
          select: {
            id: true,
            nombre: true
          }
        }
      }
    });
  }
}
