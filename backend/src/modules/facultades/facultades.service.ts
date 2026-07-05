import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CrearFacultadDto } from './dto/crear-facultad.dto';
import { ActualizarFacultadDto } from './dto/actualizar-facultad.dto';

@Injectable()
export class FacultadesService {
  constructor(private readonly prisma: PrismaService) {}

  async obtenerTodas(buscar?: string, estado?: string) {
    return this.prisma.facultad.findMany({
      where: {
        ...(estado ? { estado } : {}),
        ...(buscar ? {
          OR: [
            { nombre: { contains: buscar, mode: 'insensitive' } },
            { codigo: { contains: buscar, mode: 'insensitive' } },
          ]
        } : {})
      },
      include: {
        _count: { select: { carreras: true } },
        universidad: { select: { id: true, nombre: true } }
      },
      orderBy: { nombre: 'asc' }
    });
  }

  async obtenerPorId(id: string) {
    const facultad = await this.prisma.facultad.findUnique({
      where: { id },
      include: {
        universidad: { select: { id: true, nombre: true } },
        carreras: {
          select: { id: true, nombre: true, codigo: true, estado: true },
          orderBy: { nombre: 'asc' }
        },
        _count: { select: { carreras: true } }
      }
    });
    if (!facultad) throw new NotFoundException(`Facultad ${id} no encontrada`);
    return facultad;
  }

  async crear(dto: CrearFacultadDto) {
    if (dto.codigo) {
      const existe = await this.prisma.facultad.findUnique({ where: { codigo: dto.codigo } });
      if (existe) throw new ConflictException(`Ya existe una facultad con el código "${dto.codigo}"`);
    }
    return this.prisma.facultad.create({
      data: {
        nombre: dto.nombre,
        codigo: dto.codigo ?? null,
        descripcion: dto.descripcion ?? null,
        estado: dto.estado ?? 'ACTIVO',
        universidadId: dto.universidadId
      },
      include: { _count: { select: { carreras: true } } }
    });
  }

  async actualizar(id: string, dto: ActualizarFacultadDto) {
    await this.obtenerPorId(id);
    if (dto.codigo) {
      const existe = await this.prisma.facultad.findFirst({
        where: { codigo: dto.codigo, id: { not: id } }
      });
      if (existe) throw new ConflictException(`Ya existe una facultad con el código "${dto.codigo}"`);
    }
    return this.prisma.facultad.update({
      where: { id },
      data: dto,
      include: { _count: { select: { carreras: true } } }
    });
  }

  async darDeBaja(id: string) {
    await this.obtenerPorId(id);
    return this.prisma.facultad.update({
      where: { id },
      data: { estado: 'INACTIVO' }
    });
  }

  async obtenerUniversidades() {
    return this.prisma.universidad.findMany({ orderBy: { nombre: 'asc' } });
  }
}
