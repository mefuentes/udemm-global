import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async obtenerRoles() {
    return this.prisma.rol.findMany({
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        fechaCreacion: true
      }
    });
  }
}
