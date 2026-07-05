import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CrearCarreraDto } from './dto/crear-carrera.dto';
import { ActualizarCarreraDto } from './dto/actualizar-carrera.dto';

@Injectable()
export class CarrerasService {
  constructor(private readonly prisma: PrismaService) {}

  async obtenerTodas(buscar?: string, estado?: string, facultadId?: string) {
    return this.prisma.carrera.findMany({
      where: {
        ...(estado ? { estado } : {}),
        ...(facultadId ? { facultadId } : {}),
        ...(buscar ? {
          OR: [
            { nombre: { contains: buscar, mode: 'insensitive' } },
            { codigo: { contains: buscar, mode: 'insensitive' } },
            { tituloOtorgado: { contains: buscar, mode: 'insensitive' } },
          ]
        } : {})
      },
      include: {
        facultad: { select: { id: true, nombre: true, codigo: true } },
        _count: { select: { planes: true } }
      },
      orderBy: [{ facultad: { nombre: 'asc' } }, { nombre: 'asc' }]
    });
  }

  async obtenerPorId(id: string) {
    const carrera = await this.prisma.carrera.findUnique({
      where: { id },
      include: {
        facultad: {
          select: {
            id: true, nombre: true, codigo: true,
            universidad: { select: { id: true, nombre: true } }
          }
        },
        planes: {
          select: { id: true, nombre: true, anio: true, estado: true },
          orderBy: { nombre: 'asc' }
        },
        _count: { select: { planes: true } }
      }
    });
    if (!carrera) throw new NotFoundException(`Carrera ${id} no encontrada`);
    return carrera;
  }

  async crear(dto: CrearCarreraDto) {
    if (dto.codigo) {
      const existe = await this.prisma.carrera.findUnique({ where: { codigo: dto.codigo } });
      if (existe) throw new ConflictException(`Ya existe una carrera con el código "${dto.codigo}"`);
    }
    const facultad = await this.prisma.facultad.findUnique({ where: { id: dto.facultadId } });
    if (!facultad) throw new NotFoundException(`Facultad ${dto.facultadId} no encontrada`);

    return this.prisma.carrera.create({
      data: {
        nombre: dto.nombre,
        codigo: dto.codigo ?? null,
        facultadId: dto.facultadId,
        tituloOtorgado: dto.tituloOtorgado ?? null,
        duracionAnios: dto.duracionAnios ?? null,
        modalidad: dto.modalidad ?? null,
        estado: dto.estado ?? 'ACTIVO'
      },
      include: {
        facultad: { select: { id: true, nombre: true, codigo: true } },
        _count: { select: { planes: true } }
      }
    });
  }

  async actualizar(id: string, dto: ActualizarCarreraDto) {
    await this.obtenerPorId(id);
    if (dto.codigo) {
      const existe = await this.prisma.carrera.findFirst({
        where: { codigo: dto.codigo, id: { not: id } }
      });
      if (existe) throw new ConflictException(`Ya existe una carrera con el código "${dto.codigo}"`);
    }
    if (dto.facultadId) {
      const facultad = await this.prisma.facultad.findUnique({ where: { id: dto.facultadId } });
      if (!facultad) throw new NotFoundException(`Facultad ${dto.facultadId} no encontrada`);
    }
    return this.prisma.carrera.update({
      where: { id },
      data: dto,
      include: {
        facultad: { select: { id: true, nombre: true, codigo: true } },
        _count: { select: { planes: true } }
      }
    });
  }

  async darDeBaja(id: string) {
    await this.obtenerPorId(id);
    return this.prisma.carrera.update({
      where: { id },
      data: { estado: 'INACTIVO' }
    });
  }
}
