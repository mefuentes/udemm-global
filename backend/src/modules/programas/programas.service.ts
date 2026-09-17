import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ScopeService } from '../scopes/scope.service';
import { ActualizarProgramaDto } from './dto/actualizar-programa.dto';

const HISTORIAL_INCLUDE = {
  historial: {
    include: {
      usuario: {
        select: { id: true, nombre: true, apellido: true, correoElectronico: true }
      }
    },
    orderBy: { fecha: 'desc' as const },
    take: 50
  }
};

// ── Helpers de cálculo de estado (espejo exacto de la lógica frontend) ────────

function tryParseJsonArr<T>(str: unknown): T[] {
  if (!str || typeof str !== 'string') return [];
  try {
    const r = JSON.parse(str);
    return Array.isArray(r) ? (r as T[]) : [];
  } catch {
    return [];
  }
}

function str(prog: Record<string, unknown>, key: string): string {
  return String(prog[key] ?? '').trim();
}

function calcEstadoSecciones(prog: Record<string, unknown>): Record<string, string> {
  // S1: objetivosGenerales + aportesPerfilTitulo obligatorios (textarea >50 chars)
  const s1 =
    str(prog, 'objetivosGenerales').length > 50 &&
    str(prog, 'aportesPerfilTitulo').length > 50
      ? 'COMPLETO' : 'PENDIENTE';

  // S2: competencias con competencia+resultado, contenidos con conceptuales+procedimentales+actitudinales
  type CR = { competencia?: string; resultadoAprendizaje?: string };
  type CO = { conceptuales?: string; procedimentales?: string; actitudinales?: string };
  const comps = tryParseJsonArr<CR>(prog['competenciasResultadosJson']);
  const conts = tryParseJsonArr<CO>(prog['contenidosGridJson']);
  const hasComp = comps.some(r => (r.competencia?.trim().length ?? 0) > 0 && (r.resultadoAprendizaje?.trim().length ?? 0) > 0);
  const hasCont = conts.some(r => (r.conceptuales?.trim().length ?? 0) > 0 && (r.procedimentales?.trim().length ?? 0) > 0 && (r.actitudinales?.trim().length ?? 0) > 0);
  const s2 = hasComp && hasCont ? 'COMPLETO' : 'PENDIENTE';

  // S3: unidades didácticas con al menos una unidad no vacía
  type UD = { unidad?: string };
  const uds = tryParseJsonArr<UD>(prog['unidadesDidacticasJson']);
  const s3 = uds.some(r => (r.unidad?.trim().length ?? 0) > 0) ? 'COMPLETO' : 'PENDIENTE';

  // S4: actividadesFormacionPractica (texto >50 chars) + al menos una fila de intensidad válida
  type IF4 = { intensidad?: string; horasClase?: number };
  const ifs = tryParseJsonArr<IF4>(prog['formacionPracticaJson']);
  const s4 =
    str(prog, 'actividadesFormacionPractica').length > 50 &&
    ifs.some(f =>
      (f.intensidad?.trim().length ?? 0) > 0 &&
      typeof f.horasClase === 'number' && Number.isInteger(f.horasClase) &&
      f.horasClase >= 0 && f.horasClase <= 99
    ) ? 'COMPLETO' : 'PENDIENTE';

  // S5: 4 campos textarea obligatorios >50 chars
  const s5 =
    str(prog, 'recursosDidacticos').length > 50 &&
    str(prog, 'metodologiaEnsenanza').length > 50 &&
    str(prog, 'modalidadEvaluacion').length > 50 &&
    str(prog, 'requisitosAprobacion').length > 50
      ? 'COMPLETO' : 'PENDIENTE';

  // S6: bibliografiaBasica >50 chars + fechaVigenciaPrograma + fechaAprobacion
  const s6 =
    str(prog, 'bibliografiaBasica').length > 50 &&
    prog['fechaVigenciaPrograma'] != null &&
    prog['fechaAprobacion'] != null
      ? 'COMPLETO' : 'PENDIENTE';

  return { estadoS1: s1, estadoS2: s2, estadoS3: s3, estadoS4: s4, estadoS5: s5, estadoS6: s6 };
}

// ── Servicio ──────────────────────────────────────────────────────────────────

@Injectable()
export class ProgramasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: ScopeService,
  ) {}

  private async resolverCarreraDeMateria(materiaId: string): Promise<string> {
    const materia = await this.prisma.materia.findUnique({
      where: { id: materiaId },
      select: { planEstudio: { select: { carreraId: true } } },
    });
    const carreraId = materia?.planEstudio?.carreraId;
    if (!carreraId) throw new NotFoundException(`No se pudo resolver la carrera para la materia ${materiaId}`);
    return carreraId;
  }

  async obtenerPrograma(materiaId: string) {
    const materia = await this.prisma.materia.findUnique({ where: { id: materiaId } });
    if (!materia) throw new NotFoundException(`Materia ${materiaId} no encontrada`);

    const prog = await this.prisma.programaAsignatura.upsert({
      where: { materiaId },
      create: { materiaId },
      update: {},
      include: HISTORIAL_INCLUDE,
    });

    // Calcular estados reales desde los datos almacenados y devolverlos
    const estadoSecciones = calcEstadoSecciones(prog as unknown as Record<string, unknown>);
    const todasCompletas = Object.values(estadoSecciones).every(v => v === 'COMPLETO');

    // FASE 3: conservar APROBADO histórico intacto; recalcular solo si no era APROBADO
    let estadoPrograma: string = prog.estadoPrograma;
    if (estadoPrograma !== 'APROBADO') {
      estadoPrograma = todasCompletas ? 'EN_REVISION' : 'PENDIENTE';
    }

    return { ...prog, ...estadoSecciones, estadoPrograma };
  }

  async actualizarPrograma(materiaId: string, dto: ActualizarProgramaDto, usuarioId: string, rolNombre: string) {
    if (rolNombre === 'DIRECTOR_CARRERA' || rolNombre === 'DECANO') {
      const carreraId = await this.resolverCarreraDeMateria(materiaId);
      const tieneScope = await this.scopeService.tieneScopeCarrera(usuarioId, rolNombre, carreraId);
      if (!tieneScope) {
        throw new ForbiddenException('Sin acceso: la materia no pertenece a tu carrera o facultad asignada');
      }
    }
    const materia = await this.prisma.materia.findUnique({ where: { id: materiaId } });
    if (!materia) throw new NotFoundException(`Materia ${materiaId} no encontrada`);

    const { seccionModificada, fechaAprobacion, ...rest } = dto;

    const data: Record<string, unknown> = { ...rest };
    if (fechaAprobacion !== undefined) {
      data.fechaAprobacion = fechaAprobacion ? new Date(fechaAprobacion) : null;
    }

    // Validar horasClase en formacionPracticaJson: debe ser entero 0-99
    if (typeof data.formacionPracticaJson === 'string') {
      try {
        const rows = JSON.parse(data.formacionPracticaJson as string);
        if (Array.isArray(rows)) {
          for (const row of rows) {
            if (row.horasClase !== undefined && row.horasClase !== null) {
              const hc = Number(row.horasClase);
              if (!Number.isInteger(hc) || hc < 0 || hc > 99) {
                throw new BadRequestException('horasClase debe ser un entero entre 0 y 99');
              }
            }
          }
        }
      } catch (e) {
        if (e instanceof BadRequestException) throw e;
      }
    }

    // Validar horas en unidadesDidacticasJson: si se proporciona, debe ser string de dígitos
    if (typeof data.unidadesDidacticasJson === 'string') {
      try {
        const rows = JSON.parse(data.unidadesDidacticasJson as string);
        if (Array.isArray(rows)) {
          for (const row of rows) {
            if (row.horas !== undefined && row.horas !== null && row.horas !== '') {
              if (!/^[0-9]+$/.test(String(row.horas))) {
                throw new BadRequestException('horas en unidades didácticas debe contener solo dígitos enteros positivos');
              }
            }
          }
        }
      } catch (e) {
        if (e instanceof BadRequestException) throw e;
      }
    }

    const programaActual = await this.prisma.programaAsignatura.findFirst({ where: { materiaId } });

    // Calcular estados desde la unión de datos actuales y entrantes
    const mergedForCalc: Record<string, unknown> = {
      ...((programaActual as unknown as Record<string, unknown>) ?? {}),
      ...data,
    };
    const estadoSecciones = calcEstadoSecciones(mergedForCalc);
    const todasCompletas = Object.values(estadoSecciones).every(v => v === 'COMPLETO');

    // FASE 3: conservar APROBADO histórico; recalcular solo si el estado actual no era APROBADO
    const nuevoEstadoProg = programaActual?.estadoPrograma === 'APROBADO'
      ? 'APROBADO'
      : todasCompletas ? 'EN_REVISION' : 'PENDIENTE';

    // Guardar cambios junto con los estados calculados
    const finalData = { ...data, ...estadoSecciones, estadoPrograma: nuevoEstadoProg };
    const descripcion = seccionModificada
      ? `Sección "${seccionModificada}" actualizada`
      : 'Programa actualizado';

    // Upsert + historial en una misma transacción: si falla el historial, revierte el upsert
    const programa = await this.prisma.$transaction(async (tx) => {
      const upserted = await tx.programaAsignatura.upsert({
        where: { materiaId },
        create: { materiaId, ...finalData },
        update: finalData,
      });
      await tx.historialPrograma.create({
        data: {
          programaId: upserted.id,
          usuarioId,
          accion: 'ACTUALIZACION',
          seccion: seccionModificada ?? null,
          descripcion,
        },
      });
      return upserted;
    });

    const result = await this.prisma.programaAsignatura.findUnique({
      where: { id: programa.id },
      include: HISTORIAL_INCLUDE,
    });
    return { ...result, ...estadoSecciones, estadoPrograma: nuevoEstadoProg };
  }

}
