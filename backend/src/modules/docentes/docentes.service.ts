import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CrearDocenteDto } from './dto/crear-docente.dto';
import { ActualizarDocenteDto } from './dto/actualizar-docente.dto';

@Injectable()
export class DocentesService {
  constructor(private readonly prisma: PrismaService) {}

  async crearDocente(data: CrearDocenteDto) {
    const existe = await this.prisma.docente.findFirst({
      where: {
        OR: [
          { correoElectronico: data.correoElectronico },
          { numeroDocumento: data.numeroDocumento }
        ]
      }
    });

    if (existe) {
      if (existe.correoElectronico === data.correoElectronico) {
        throw new BadRequestException('El correo electrónico ya está registrado para otro docente');
      }
      if (existe.numeroDocumento === data.numeroDocumento) {
        throw new BadRequestException('El número de documento ya está registrado para otro docente');
      }
      throw new BadRequestException('El docente ya existe con el correo o número de documento proporcionado');
    }

    try {
      return await this.prisma.docente.create({
        data,
        include: {
          usuario: {
            select: {
              id: true,
              correoElectronico: true,
              rol: {
                select: {
                  id: true,
                  nombre: true
                }
              }
            }
          }
        }
      });
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'P2002') {
        const target = (error as any).meta?.target;
        if (Array.isArray(target) && target.includes('numeroDocumento')) {
          throw new BadRequestException('El número de documento ya está registrado para otro docente');
        }
        if (Array.isArray(target) && target.includes('correoElectronico')) {
          throw new BadRequestException('El correo electrónico ya está registrado para otro docente');
        }
      }
      throw error;
    }
  }

  async obtenerDocentes(busqueda?: string, activo?: boolean, pagina = 1, limite = 10) {
    const filtros: any = {};

    if (activo !== undefined) {
      filtros.activo = activo;
    }

    if (busqueda) {
      filtros.OR = [
        { nombre: { contains: busqueda, mode: 'insensitive' as const } },
        { apellido: { contains: busqueda, mode: 'insensitive' as const } },
        { correoElectronico: { contains: busqueda, mode: 'insensitive' as const } },
        { numeroDocumento: { contains: busqueda, mode: 'insensitive' as const } }
      ];
    }

    const [total, data] = await this.prisma.$transaction([
      this.prisma.docente.count({ where: filtros }),
      this.prisma.docente.findMany({
        where: filtros,
        orderBy: { fechaCreacion: 'desc' },
        take: limite,
        skip: (pagina - 1) * limite,
        include: {
          usuario: {
            select: {
              id: true,
              correoElectronico: true,
              rol: {
                select: {
                  id: true,
                  nombre: true
                }
              }
            }
          }
        }
      })
    ]);

    return {
      data,
      total,
      pagina,
      limite
    };
  }

  async obtenerDocentePorId(id: string) {
    const docente = await this.prisma.docente.findUnique({
      where: { id },
      include: {
        usuario: {
          select: {
            id: true,
            correoElectronico: true,
            rol: {
              select: {
                id: true,
                nombre: true
              }
            }
          }
        }
      }
    });
    if (!docente) {
      throw new NotFoundException('Docente no encontrado');
    }
    return docente;
  }

  async obtenerDocentePorUsuarioId(usuarioId: string) {
    if (!usuarioId) {
      throw new NotFoundException('Usuario no autenticado');
    }
    const docente = await this.prisma.docente.findFirst({
      where: { usuarioId },
      include: {
        usuario: {
          select: {
            id: true,
            correoElectronico: true,
            rol: {
              select: { id: true, nombre: true }
            }
          }
        }
      }
    });
    if (!docente) {
      throw new NotFoundException('Ficha docente no encontrada para el usuario');
    }
    return docente;
  }

  async actualizarDocente(id: string, data: ActualizarDocenteDto) {
    const docenteExistente = await this.obtenerDocentePorId(id);

    if (data.correoElectronico || data.numeroDocumento) {
      const condiciones: any[] = [];
      if (data.correoElectronico) {
        condiciones.push({ correoElectronico: data.correoElectronico });
      }
      if (data.numeroDocumento) {
        condiciones.push({ numeroDocumento: data.numeroDocumento });
      }

      if (condiciones.length > 0) {
        const conflicto = await this.prisma.docente.findFirst({
          where: {
            AND: [
              { id: { not: id } },
              { OR: condiciones }
            ]
          }
        });

        if (conflicto) {
          if (data.correoElectronico && conflicto.correoElectronico === data.correoElectronico) {
            throw new BadRequestException('El correo electrónico ya está registrado para otro docente');
          }
          if (data.numeroDocumento && conflicto.numeroDocumento === data.numeroDocumento) {
            throw new BadRequestException('El número de documento ya está registrado para otro docente');
          }
        }
      }
    }

    try {
      return await this.prisma.docente.update({
        where: { id },
        data,
        include: {
          usuario: {
            select: {
              id: true,
              correoElectronico: true,
              rol: {
                select: {
                  id: true,
                  nombre: true
                }
              }
            }
          }
        }
      });
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'P2002') {
        const target = (error as any).meta?.target;
        if (Array.isArray(target) && target.includes('numeroDocumento')) {
          throw new BadRequestException('El número de documento ya está registrado para otro docente');
        }
        if (Array.isArray(target) && target.includes('correoElectronico')) {
          throw new BadRequestException('El correo electrónico ya está registrado para otro docente');
        }
      }
      throw error;
    }
  }

  async actualizarDocentePorUsuarioId(usuarioId: string, data: ActualizarDocenteDto) {
    if (!usuarioId) {
      throw new NotFoundException('Usuario no autenticado');
    }
    const docente = await this.prisma.docente.findFirst({ where: { usuarioId } });
    if (!docente) {
      throw new NotFoundException('Ficha docente no encontrada para el usuario');
    }
    return this.actualizarDocente(docente.id, data);
  }

  async eliminarDocente(id: string) {
    await this.obtenerDocentePorId(id);
    return this.prisma.docente.update({
      where: { id },
      data: { activo: false }
    });
  }
}
