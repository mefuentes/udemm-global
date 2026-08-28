import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
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

  // S4: formación práctica con actividad + competenciaIdx válido + horas >= 0
  type FP = { actividad?: string; competenciaIdx?: number; hsPres?: number; hsSinc?: number };
  const fps = tryParseJsonArr<FP>(prog['formacionPracticaJson']);
  const s4 = fps.some(f =>
    (f.actividad?.trim().length ?? 0) > 0 &&
    typeof f.competenciaIdx === 'number' && f.competenciaIdx >= 0 &&
    typeof f.hsPres === 'number' && f.hsPres >= 0 &&
    typeof f.hsSinc === 'number' && f.hsSinc >= 0
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
  constructor(private readonly prisma: PrismaService) {}

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

    // Recalcular estadoPrograma (preservar APROBADO; corregir estados stale PENDIENTE/EN_REVISION)
    let estadoPrograma = prog.estadoPrograma;
    if (estadoPrograma !== 'APROBADO') {
      estadoPrograma = todasCompletas ? 'EN_REVISION' : 'PENDIENTE';
    }

    return { ...prog, ...estadoSecciones, estadoPrograma };
  }

  async actualizarPrograma(materiaId: string, dto: ActualizarProgramaDto, usuarioId: string, rolNombre: string) {
    if (rolNombre === 'DOCENTE') {
      await this.verificarOwnershipDocente(materiaId, usuarioId);
    }
    const materia = await this.prisma.materia.findUnique({ where: { id: materiaId } });
    if (!materia) throw new NotFoundException(`Materia ${materiaId} no encontrada`);

    const { seccionModificada, fechaAprobacion, ...rest } = dto;

    const data: Record<string, unknown> = { ...rest };
    if (fechaAprobacion !== undefined) {
      data.fechaAprobacion = fechaAprobacion ? new Date(fechaAprobacion) : null;
    }

    const programaActual = await this.prisma.programaAsignatura.findFirst({ where: { materiaId } });

    // Calcular estados desde la unión de datos actuales y entrantes
    const mergedForCalc: Record<string, unknown> = {
      ...((programaActual as unknown as Record<string, unknown>) ?? {}),
      ...data,
    };
    const estadoSecciones = calcEstadoSecciones(mergedForCalc);
    const todasCompletas = Object.values(estadoSecciones).every(v => v === 'COMPLETO');

    // Determinar nuevo estadoPrograma
    let nuevoEstadoProg: string;
    if (programaActual?.estadoPrograma === 'APROBADO' && seccionModificada) {
      nuevoEstadoProg = 'EN_REVISION';
    } else if (todasCompletas) {
      nuevoEstadoProg = 'EN_REVISION';
    } else {
      nuevoEstadoProg = 'PENDIENTE';
    }

    // Guardar cambios junto con los estados calculados
    const finalData = { ...data, ...estadoSecciones, estadoPrograma: nuevoEstadoProg };
    const programa = await this.prisma.programaAsignatura.upsert({
      where: { materiaId },
      create: { materiaId, ...finalData },
      update: finalData,
    });

    const revirtioAprobacion =
      programaActual?.estadoPrograma === 'APROBADO' && nuevoEstadoProg === 'EN_REVISION';

    const descripcion = seccionModificada
      ? `Sección "${seccionModificada}" actualizada`
      : 'Programa actualizado';

    await this.prisma.historialPrograma.create({
      data: {
        programaId: programa.id,
        usuarioId,
        accion: revirtioAprobacion ? 'REVERSION' : 'ACTUALIZACION',
        seccion: seccionModificada ?? null,
        descripcion: revirtioAprobacion
          ? `Aprobación revertida por modificación en sección "${seccionModificada}"`
          : descripcion,
      },
    });

    const result = await this.prisma.programaAsignatura.findUnique({
      where: { id: programa.id },
      include: HISTORIAL_INCLUDE,
    });
    return { ...result, ...estadoSecciones, estadoPrograma: nuevoEstadoProg };
  }

  async aprobarPrograma(materiaId: string, usuarioId: string) {
    const materia = await this.prisma.materia.findUnique({ where: { id: materiaId } });
    if (!materia) throw new NotFoundException(`Materia ${materiaId} no encontrada`);

    const programaActual = await this.prisma.programaAsignatura.findUnique({ where: { materiaId } });
    if (!programaActual) throw new NotFoundException('Programa no encontrado para esta materia');
    if (programaActual.estadoPrograma !== 'EN_REVISION') {
      throw new BadRequestException(
        'Solo se puede aprobar un programa que esté en estado EN_REVISION (100% completo)'
      );
    }

    const programa = await this.prisma.programaAsignatura.update({
      where: { materiaId },
      data: { estadoPrograma: 'APROBADO' },
    });

    await this.prisma.historialPrograma.create({
      data: {
        programaId: programa.id,
        usuarioId,
        accion: 'APROBACION',
        descripcion: 'Programa de asignatura aprobado formalmente',
      },
    });

    return this.prisma.programaAsignatura.findUnique({
      where: { id: programa.id },
      include: HISTORIAL_INCLUDE,
    });
  }
}
