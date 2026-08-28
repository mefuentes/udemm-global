import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CrearMateriaDto } from './dto/crear-materia.dto';
import { ActualizarMateriaDto } from './dto/actualizar-materia.dto';
import { GestionarCorrelativaDto } from './dto/gestionar-correlativa.dto';

const LABELS_CAMPO: Record<string, string> = {
  nombre:             'Nombre',
  codigo:             'Código',
  descripcion:        'Descripción',
  creditos:           'Créditos',
  cargaHorariaSemanal:'H/Semana',
  cargaHorariaTotal:  'H/Total',
  anio:               'Año',
  cuatrimestre:       'Cuatrimestre',
  bloqueConocimiento: 'Bloque',
  tipoAsignatura:     'Tipo',
  modalidadDictado:   'Modalidad',
  regimenCursado:     'Régimen',
  observaciones:      'Observaciones',
  estado:             'Estado',
};

function buildDiff(antes: Record<string, unknown>, despues: Record<string, unknown>): string {
  const cambios: string[] = [];
  for (const [key, label] of Object.entries(LABELS_CAMPO)) {
    if (key in despues && String(antes[key] ?? '') !== String(despues[key] ?? '')) {
      cambios.push(`${label}: "${antes[key] ?? ''}" → "${despues[key] ?? ''}"`);
    }
  }
  return cambios.length > 0 ? cambios.join('; ') : 'Sin cambios detectados';
}

@Injectable()
export class MateriasService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Ownership ─────────────────────────────────────────────────────────────

  private async verificarOwnershipDocente(materiaId: string, usuarioId: string): Promise<void> {
    const docente = await this.prisma.docente.findUnique({ where: { usuarioId } });
    if (!docente) {
      throw new ForbiddenException('Sin acceso: sin perfil docente asociado');
    }
    const vinculacion = await this.prisma.vinculacionCatedra.findFirst({
      where: {
        docenteId: docente.id,
        materiaId,
        estado: 'APROBADA',
      },
    });
    if (!vinculacion) {
      throw new ForbiddenException('Sin acceso: no tenés una vinculación aprobada con esta asignatura');
    }
  }

  // ── Historial ─────────────────────────────────────────────────────────────

  private registrarHistorial(
    materiaId: string,
    usuarioId: string,
    accion: string,
    descripcion?: string
  ) {
    return this.prisma.historialMateria.create({
      data: { materiaId, usuarioId, accion, descripcion }
    });
  }

  async obtenerHistorial(materiaId: string) {
    await this.obtenerPorId(materiaId);
    return this.prisma.historialMateria.findMany({
      where: { materiaId },
      include: {
        usuario: { select: { id: true, nombre: true, apellido: true, correoElectronico: true } }
      },
      orderBy: { fecha: 'desc' }
    });
  }

  // ── Listado ──────────────────────────────────────────────────────────────

  async obtenerTodas(planEstudioId?: string) {
    return this.prisma.materia.findMany({
      where: {
        ...(planEstudioId ? { planEstudioId } : {}),
        estado: 'ACTIVO'
      },
      orderBy: [{ anio: 'asc' }, { cuatrimestre: 'asc' }, { nombre: 'asc' }]
    });
  }

  // ── Ficha completa ───────────────────────────────────────────────────────

  async obtenerFicha(id: string) {
    const ficha = await this.prisma.materia.findUnique({
      where: { id },
      include: {
        planEstudio: {
          include: {
            carrera: {
              include: { facultad: true }
            }
          }
        },
        correlativas: {
          include: {
            correlativa: {
              select: {
                id: true, codigo: true, nombre: true,
                anio: true, cuatrimestre: true,
                bloqueConocimiento: true, estado: true
              }
            }
          },
          orderBy: [{ tipo: 'asc' }, { fechaCreacion: 'asc' }]
        },
        esCorrelativaDe: {
          include: {
            materia: {
              select: {
                id: true, codigo: true, nombre: true,
                anio: true, cuatrimestre: true, estado: true
              }
            }
          }
        }
      }
    });
    if (!ficha) throw new NotFoundException(`Materia ${id} no encontrada`);
    return ficha;
  }

  // ── CRUD básico ──────────────────────────────────────────────────────────

  async obtenerPorId(id: string) {
    const materia = await this.prisma.materia.findUnique({ where: { id } });
    if (!materia) throw new NotFoundException(`Materia ${id} no encontrada`);
    return materia;
  }

  async crear(dto: CrearMateriaDto, usuarioId: string) {
    const materia = await this.prisma.materia.create({
      data: {
        ...dto,
        creditos: dto.creditos ?? 0,
        tipoAsignatura: dto.tipoAsignatura ?? 'OBLIGATORIA',
        estado: dto.estado ?? 'ACTIVO'
      }
    });
    await this.registrarHistorial(
      materia.id, usuarioId, 'CREACION',
      `Asignatura creada: [${materia.codigo}] ${materia.nombre}`
    );
    return materia;
  }

  async actualizar(id: string, dto: ActualizarMateriaDto, usuarioId: string, rolNombre: string) {
    if (rolNombre === 'DOCENTE') {
      await this.verificarOwnershipDocente(id, usuarioId);
    }
    const antes = await this.obtenerPorId(id);

    // Construir objeto plano para evitar problemas con instancias de clase y Prisma
    const data: Record<string, unknown> = {};
    if (dto.codigo            !== undefined) data.codigo            = dto.codigo;
    if (dto.nombre            !== undefined) data.nombre            = dto.nombre;
    if (dto.descripcion       !== undefined) data.descripcion       = dto.descripcion;
    if (dto.tipoAsignatura    !== undefined) data.tipoAsignatura    = dto.tipoAsignatura;
    if (dto.modalidadDictado  !== undefined) data.modalidadDictado  = dto.modalidadDictado;
    if (dto.bloqueConocimiento!== undefined) data.bloqueConocimiento= dto.bloqueConocimiento;
    if (dto.regimenCursado    !== undefined) data.regimenCursado    = dto.regimenCursado;
    if (dto.estado            !== undefined) data.estado            = dto.estado;
    if (dto.observaciones     !== undefined) data.observaciones     = dto.observaciones;
    if (dto.anio              !== undefined) data.anio              = dto.anio;
    if (dto.cuatrimestre      !== undefined) data.cuatrimestre      = dto.cuatrimestre;
    if (dto.cargaHorariaSemanal !== undefined) data.cargaHorariaSemanal = dto.cargaHorariaSemanal;
    if (dto.cargaHorariaTotal !== undefined) data.cargaHorariaTotal = dto.cargaHorariaTotal;
    // creditos no es nullable en el schema — nunca pasar null
    if (dto.creditos !== undefined) data.creditos = dto.creditos ?? 0;

    const materia = await this.prisma.materia.update({
      where: { id },
      data
    });
    const descripcion = buildDiff(
      antes as unknown as Record<string, unknown>,
      dto as Record<string, unknown>
    );
    await this.registrarHistorial(id, usuarioId, 'ACTUALIZACION', descripcion);
    return materia;
  }

  async darDeBaja(id: string, usuarioId: string) {
    await this.obtenerPorId(id);
    const materia = await this.prisma.materia.update({
      where: { id },
      data: { estado: 'INACTIVO' }
    });
    await this.registrarHistorial(id, usuarioId, 'BAJA', 'Asignatura dada de baja (estado → INACTIVO)');
    return materia;
  }

  // ── Correlatividades ─────────────────────────────────────────────────────

  async obtenerCorrelativas(materiaId: string) {
    await this.obtenerPorId(materiaId);
    return this.prisma.correlatividad.findMany({
      where: { materiaId },
      include: {
        correlativa: {
          select: {
            id: true, codigo: true, nombre: true,
            anio: true, cuatrimestre: true,
            bloqueConocimiento: true, estado: true
          }
        }
      },
      orderBy: [{ tipo: 'asc' }, { fechaCreacion: 'asc' }]
    });
  }

  async agregarCorrelativa(materiaId: string, dto: GestionarCorrelativaDto, usuarioId: string) {
    const materia = await this.prisma.materia.findUnique({ where: { id: materiaId } });
    if (!materia) throw new NotFoundException(`Materia ${materiaId} no encontrada`);

    if (materiaId === dto.correlativaId) {
      throw new BadRequestException('Una asignatura no puede ser correlativa de sí misma');
    }

    const correlativa = await this.prisma.materia.findUnique({
      where: { id: dto.correlativaId }
    });
    if (!correlativa) {
      throw new NotFoundException(`Correlativa ${dto.correlativaId} no encontrada`);
    }

    if (correlativa.planEstudioId !== materia.planEstudioId) {
      throw new BadRequestException(
        'La correlativa debe pertenecer al mismo plan de estudios'
      );
    }

    const existente = await this.prisma.correlatividad.findUnique({
      where: { materiaId_correlativaId: { materiaId, correlativaId: dto.correlativaId } }
    });
    if (existente) {
      throw new BadRequestException('Esta correlativa ya está registrada');
    }

    const registro = await this.prisma.correlatividad.create({
      data: {
        materiaId,
        correlativaId: dto.correlativaId,
        tipo: dto.tipo ?? 'CURSADO'
      },
      include: {
        correlativa: {
          select: { id: true, codigo: true, nombre: true, anio: true, cuatrimestre: true }
        }
      }
    });

    const tipoLabel = dto.tipo === 'EXAMEN' ? 'Para rendir' : 'Para cursar';
    await this.registrarHistorial(
      materiaId, usuarioId, 'CORRELATIVA_AGREGADA',
      `Correlativa agregada: [${correlativa.codigo}] ${correlativa.nombre} (${tipoLabel})`
    );
    return registro;
  }

  async quitarCorrelativa(materiaId: string, correlativaId: string, usuarioId: string) {
    const registro = await this.prisma.correlatividad.findUnique({
      where: { materiaId_correlativaId: { materiaId, correlativaId } }
    });
    if (!registro) throw new NotFoundException('Correlativa no encontrada');

    const correlativa = await this.prisma.materia.findUnique({
      where: { id: correlativaId },
      select: { codigo: true, nombre: true }
    });

    await this.prisma.correlatividad.delete({ where: { id: registro.id } });

    if (correlativa) {
      await this.registrarHistorial(
        materiaId, usuarioId, 'CORRELATIVA_QUITADA',
        `Correlativa quitada: [${correlativa.codigo}] ${correlativa.nombre}`
      );
    }
    return { ok: true };
  }
}
