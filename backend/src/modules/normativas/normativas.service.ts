import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CrearNormativaDto } from './dto/crear-normativa.dto';
import { ActualizarNormativaDto } from './dto/actualizar-normativa.dto';
import { CambiarEstadoNormativaDto } from './dto/cambiar-estado-normativa.dto';
import { EliminarNormativaDto } from './dto/eliminar-normativa.dto';
import { ListarNormativasDto } from './dto/listar-normativas.dto';

const VIGENCIAS_VALIDAS = ['VIGENTE', 'DEROGADA', 'SUSPENDIDA', 'REEMPLAZADA'] as const;

const STOPWORDS = new Set([
  'de','del','la','el','los','las','para','con','un','una','y','en','a','al',
]);

const ROLES_VER_ELIMINADAS = [
  'ADMINISTRADOR_SISTEMA', 'SECRETARIA_ACADEMICA', 'DECANO', 'RECTORADO',
];

// Separa el texto en tokens significativos (sin stopwords, sin términos de 1 carácter)
function tokenizar(texto: string): string[] {
  return texto
    .trim()
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t.toLowerCase()));
}

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

// Firma mágica de PDF: %PDF (bytes 0x25 0x50 0x44 0x46)
function esPdf(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  );
}

@Injectable()
export class NormativasService {
  private readonly logger = new Logger(NormativasService.name);

  constructor(
    private readonly prisma:     PrismaService,
    private readonly storage:    StorageService,
    private readonly auditoria:  AuditoriaService,
  ) {}

  // ── Alta con archivo ──────────────────────────────────────────────────────

  async crear(
    dto: CrearNormativaDto,
    archivo: Express.Multer.File,
    usuarioId: string | null,
    ipOrigen: string | null,
  ) {
    // 1. Archivo obligatorio
    if (!archivo) {
      throw new BadRequestException('ERROR: EL ARCHIVO PDF ES OBLIGATORIO.');
    }

    // 2. Tamaño
    if (archivo.size > MAX_BYTES) {
      throw new BadRequestException(
        'ERROR: EL ARCHIVO EXCEDE EL TAMAÑO MÁXIMO PERMITIDO (15 MB).',
      );
    }

    // 3. MIME real por magic bytes (no se confía en la extensión ni en el header)
    if (!esPdf(archivo.buffer)) {
      throw new BadRequestException(
        'ERROR: EL FORMATO DE ARCHIVO NO ES VÁLIDO. SOLO SE PERMITEN DOCUMENTOS PDF.',
      );
    }

    // 4. Tipo de normativa existe y está activo
    const tipo = await this.prisma.tipoNormativa.findFirst({
      where: { id: dto.tipoNormativaId, activo: true },
    });
    if (!tipo) throw new BadRequestException('El tipo de normativa no existe o no está activo');

    // 5. Fecha no futura
    const hoy = new Date();
    hoy.setHours(23, 59, 59, 999);
    if (new Date(dto.fechaEmision) > hoy) {
      throw new BadRequestException('La fecha de emisión no puede ser futura');
    }

    // 6. Duplicado número + año
    const existe = await this.prisma.normativa.findFirst({
      where: { numeroNorma: dto.numeroNorma, anio: dto.anio, eliminado: false },
    });
    if (existe) {
      throw new ConflictException('YA EXISTE UNA NORMA REGISTRADA CON ESE NÚMERO Y AÑO.');
    }

    // 7. Nombre físico único — UUID para evitar colisiones y path traversal
    const nombreFisico = `${randomUUID()}.pdf`;

    // 8. Guardar archivo (antes del INSERT para poder compensar si falla BD)
    let rutaRelativa: string;
    try {
      rutaRelativa = await this.storage.guardar(archivo.buffer, nombreFisico, 'originales');
    } catch {
      throw new InternalServerErrorException(
        'No se pudo almacenar el archivo. Intente nuevamente.',
      );
    }

    // 9. Crear registro en BD; si falla → eliminar archivo físico (compensación)
    let result: any;
    try {
      result = await this.prisma.normativa.create({
        data: {
          titulo:                dto.titulo.trim().toUpperCase(),
          tipoNormativaId:       dto.tipoNormativaId,
          fechaEmision:          new Date(dto.fechaEmision),
          areaEmisora:           dto.areaEmisora.trim().toUpperCase(),
          numeroNorma:           dto.numeroNorma.trim(),
          anio:                  dto.anio,
          vigencia:              dto.vigencia ?? 'VIGENTE',
          palabrasClave:         dto.palabrasClave?.trim() || null,
          rutaArchivoOriginal:   rutaRelativa,
          nombreArchivoOriginal: archivo.originalname,
          nombreArchivoFisico:   nombreFisico,
          tamanioArchivo:        archivo.size,
          mimeType:              'application/pdf',
        },
        include: {
          tipoNormativa: { select: { id: true, nombre: true } },
        },
      });
    } catch (error: any) {
      await this.storage.eliminar(rutaRelativa);
      if (error?.code === 'P2002') {
        throw new ConflictException('YA EXISTE UNA NORMA REGISTRADA CON ESE NÚMERO Y AÑO.');
      }
      throw new InternalServerErrorException('Error al registrar la normativa. Archivo eliminado.');
    }

    void this.auditoria.registrar({
      accion:          'CARGA',
      usuarioId,
      normativaId:     result.id,
      normativaTitulo: result.titulo,
      normativaNumero: result.numeroNorma,
      normativaAnio:   result.anio,
      detalle: {
        tipo:         tipo.nombre,
        vigencia:     result.vigencia,
        areaEmisora:  result.areaEmisora,
        fechaEmision: result.fechaEmision?.toISOString().split('T')[0] ?? null,
        archivo:      archivo.originalname,
      },
      ipOrigen,
    });

    return result;
  }

  // ── Edición con reemplazo opcional de archivo ────────────────────────────

  async actualizar(
    id: string,
    dto: ActualizarNormativaDto,
    archivo: Express.Multer.File | undefined,
    rolUsuario: string,
    usuarioId: string | null,
    ipOrigen: string | null,
  ) {
    // 1. Normativa debe existir y no estar eliminada
    const normativa = await this.prisma.normativa.findFirst({
      where: { id, eliminado: false },
    });
    if (!normativa) throw new NotFoundException('Normativa no encontrada');

    // 2. Validar nuevo archivo (si se provee) — sin guardarlo todavía
    if (archivo) {
      if (archivo.size > MAX_BYTES) {
        throw new BadRequestException(
          'ERROR: EL ARCHIVO EXCEDE EL TAMAÑO MÁXIMO PERMITIDO (15 MB).',
        );
      }
      if (!esPdf(archivo.buffer)) {
        throw new BadRequestException(
          'ERROR: EL FORMATO DE ARCHIVO NO ES VÁLIDO. SOLO SE PERMITEN DOCUMENTOS PDF.',
        );
      }
    }

    // 3. Tipo de normativa existe y está activo
    const tipo = await this.prisma.tipoNormativa.findFirst({
      where: { id: dto.tipoNormativaId, activo: true },
    });
    if (!tipo) throw new BadRequestException('El tipo de normativa no existe o no está activo');

    // 4. Fecha no futura
    const hoy = new Date();
    hoy.setHours(23, 59, 59, 999);
    if (new Date(dto.fechaEmision) > hoy) {
      throw new BadRequestException('La fecha de emisión no puede ser futura');
    }

    // 5. Unicidad N°/Año excluyendo el propio registro
    const duplicado = await this.prisma.normativa.findFirst({
      where: {
        numeroNorma: dto.numeroNorma,
        anio:        dto.anio,
        eliminado:   false,
        id:          { not: id },
      },
    });
    if (duplicado) {
      throw new ConflictException('ERROR: YA EXISTE UNA NORMA REGISTRADA CON ESE NÚMERO Y AÑO.');
    }

    // 6. Computar delta antes de modificar el estado
    const cambios: Array<{ campo: string; anterior: any; nuevo: any }> = [];
    const tituloNuevo   = dto.titulo.trim().toUpperCase();
    const areaNueva     = dto.areaEmisora.trim().toUpperCase();
    const numeroNuevo   = dto.numeroNorma.trim();
    const vigenciaNueva = dto.vigencia ?? normativa.vigencia;
    const kwNueva       = dto.palabrasClave?.trim() || null;
    const fechaNueva    = new Date(dto.fechaEmision).toISOString().split('T')[0];
    const fechaAnterior = normativa.fechaEmision.toISOString().split('T')[0];

    if (normativa.titulo !== tituloNuevo)
      cambios.push({ campo: 'TÍTULO', anterior: normativa.titulo, nuevo: tituloNuevo });

    if (normativa.tipoNormativaId !== dto.tipoNormativaId) {
      const tipoAnt = await this.prisma.tipoNormativa.findUnique({
        where:  { id: normativa.tipoNormativaId },
        select: { nombre: true },
      });
      cambios.push({ campo: 'TIPO DE NORMATIVA', anterior: tipoAnt?.nombre ?? normativa.tipoNormativaId, nuevo: tipo.nombre });
    }

    if (fechaAnterior !== fechaNueva)
      cambios.push({ campo: 'FECHA DE EMISIÓN', anterior: fechaAnterior, nuevo: fechaNueva });

    if (normativa.areaEmisora !== areaNueva)
      cambios.push({ campo: 'ÁREA EMISORA', anterior: normativa.areaEmisora, nuevo: areaNueva });

    if (normativa.numeroNorma !== numeroNuevo)
      cambios.push({ campo: 'NÚMERO DE NORMA', anterior: normativa.numeroNorma, nuevo: numeroNuevo });

    if (normativa.anio !== dto.anio)
      cambios.push({ campo: 'AÑO', anterior: normativa.anio, nuevo: dto.anio });

    if (normativa.vigencia !== vigenciaNueva)
      cambios.push({ campo: 'VIGENCIA', anterior: normativa.vigencia, nuevo: vigenciaNueva });

    if ((normativa.palabrasClave ?? null) !== kwNueva)
      cambios.push({ campo: 'PALABRAS CLAVE', anterior: normativa.palabrasClave ?? null, nuevo: kwNueva });

    if (archivo)
      cambios.push({ campo: 'DOCUMENTO PDF', anterior: normativa.nombreArchivoOriginal ?? null, nuevo: archivo.originalname });

    // 7. Guardar nuevo archivo (tras pasar todas las validaciones)
    let nuevaRutaRelativa: string | null = null;
    let nuevoNombreFisico: string | null = null;

    if (archivo) {
      nuevoNombreFisico = `${randomUUID()}.pdf`;
      try {
        nuevaRutaRelativa = await this.storage.guardar(
          archivo.buffer, nuevoNombreFisico, 'originales',
        );
      } catch {
        throw new InternalServerErrorException(
          'No se pudo almacenar el archivo. Intente nuevamente.',
        );
      }
    }

    // 8. Actualizar BD; si falla, compensar eliminando el nuevo archivo
    const rutaAnterior = normativa.rutaArchivoOriginal;
    let actualizado: any;
    try {
      actualizado = await this.prisma.normativa.update({
        where: { id },
        data: {
          titulo:          dto.titulo.trim().toUpperCase(),
          tipoNormativaId: dto.tipoNormativaId,
          fechaEmision:    new Date(dto.fechaEmision),
          areaEmisora:     dto.areaEmisora.trim().toUpperCase(),
          numeroNorma:     dto.numeroNorma.trim(),
          anio:            dto.anio,
          vigencia:        dto.vigencia ?? normativa.vigencia,
          palabrasClave:   dto.palabrasClave?.trim() || null,
          ...(nuevaRutaRelativa ? {
            rutaArchivoOriginal:   nuevaRutaRelativa,
            nombreArchivoOriginal: archivo!.originalname,
            nombreArchivoFisico:   nuevoNombreFisico,
            tamanioArchivo:        archivo!.size,
            mimeType:              'application/pdf',
          } : {}),
        },
        include: { tipoNormativa: { select: { id: true, nombre: true } } },
      });

      if (nuevaRutaRelativa && rutaAnterior && rutaAnterior !== nuevaRutaRelativa) {
        this.storage.eliminar(rutaAnterior).catch(err =>
          this.logger.error(
            `Archivo anterior no eliminado (huérfano): ${rutaAnterior} — ${err?.message}`,
          ),
        );
      }
    } catch (error: any) {
      if (nuevaRutaRelativa) {
        await this.storage.eliminar(nuevaRutaRelativa).catch(() => {});
      }
      if (error?.code === 'P2002') {
        throw new ConflictException('ERROR: YA EXISTE UNA NORMA REGISTRADA CON ESE NÚMERO Y AÑO.');
      }
      if (error instanceof BadRequestException || error instanceof ConflictException ||
          error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al actualizar la normativa.');
    }

    if (cambios.length > 0) {
      void this.auditoria.registrar({
        accion:          'EDICION',
        usuarioId,
        normativaId:     actualizado.id,
        normativaTitulo: actualizado.titulo,
        normativaNumero: actualizado.numeroNorma,
        normativaAnio:   actualizado.anio,
        detalle:         { cambios },
        ipOrigen,
      });
    }

    return actualizado;
  }

  // ── Cambio de estado con historial ───────────────────────────────────────

  async cambiarEstado(
    id: string,
    dto: CambiarEstadoNormativaDto,
    usuarioId: string | null,
    ipOrigen: string | null,
  ) {
    // 1. Cargar normativa
    const normativa = await this.prisma.normativa.findFirst({
      where: { id, eliminado: false },
    });
    if (!normativa) throw new NotFoundException('Normativa no encontrada');

    // 2. No permitir el mismo estado actual
    if (normativa.vigencia === dto.vigencia) {
      throw new BadRequestException(
        'El nuevo estado debe ser diferente al estado actual.',
      );
    }

    // 3. Motivo obligatorio (no vacío, no solo espacios)
    if (!dto.motivo?.trim()) {
      throw new BadRequestException(
        'ERROR: DEBE INGRESAR EL MOTIVO O RESOLUCIÓN QUE AVALA EL CAMBIO DE ESTADO.',
      );
    }

    // 4. Si el nuevo estado es REEMPLAZADA: validar sucesora
    let sucesoraValidada: string | null = null;
    if (dto.vigencia === 'REEMPLAZADA') {
      if (!dto.normativaSucesoraId) {
        throw new BadRequestException(
          'Debe indicar la normativa sucesora al pasar a estado REEMPLAZADA.',
        );
      }
      if (dto.normativaSucesoraId === id) {
        throw new BadRequestException(
          'Una normativa no puede ser sucesora de sí misma.',
        );
      }
      const sucesora = await this.prisma.normativa.findFirst({
        where: { id: dto.normativaSucesoraId, eliminado: false },
      });
      if (!sucesora) {
        throw new BadRequestException(
          'ERROR: LA NORMATIVA SUCESORA NO EXISTE. DEBE REGISTRARLA PREVIAMENTE.',
        );
      }
      if (sucesora.vigencia !== 'VIGENTE') {
        throw new BadRequestException(
          'ERROR: LA NORMATIVA SUCESORA DEBE ENCONTRARSE VIGENTE.',
        );
      }
      sucesoraValidada = dto.normativaSucesoraId;
    }

    let updateSucesoraId: string | null | undefined;
    if (dto.vigencia === 'REEMPLAZADA') {
      updateSucesoraId = sucesoraValidada;
    } else if (normativa.normativaSucesoraId !== null) {
      updateSucesoraId = null;
    } else {
      updateSucesoraId = undefined;
    }

    const resultado = await this.prisma.$transaction(async (tx) => {
      const actualizado = await tx.normativa.update({
        where: { id },
        data: {
          vigencia: dto.vigencia,
          ...(updateSucesoraId !== undefined
            ? { normativaSucesoraId: updateSucesoraId }
            : {}),
        },
        include: {
          tipoNormativa: { select: { id: true, nombre: true } },
          normativaSucesora: {
            select: { id: true, titulo: true, numeroNorma: true, anio: true, vigencia: true, tipoNormativaId: true },
          },
        },
      });

      await tx.historialEstadoNormativa.create({
        data: {
          normativaId:         id,
          estadoAnterior:      normativa.vigencia,
          estadoNuevo:         dto.vigencia,
          motivo:              dto.motivo.trim(),
          normativaSucesoraId: sucesoraValidada,
          usuarioId:           usuarioId,
        },
      });

      return actualizado;
    });

    void this.auditoria.registrar({
      accion:          'CAMBIO_ESTADO',
      usuarioId,
      normativaId:     id,
      normativaTitulo: normativa.titulo,
      normativaNumero: normativa.numeroNorma,
      normativaAnio:   normativa.anio,
      detalle: {
        estadoAnterior: normativa.vigencia,
        estadoNuevo:    dto.vigencia,
        motivo:         dto.motivo.trim(),
        ...(sucesoraValidada ? { normativaSucesoraId: sucesoraValidada } : {}),
      },
      ipOrigen,
    });

    return resultado;
  }

  // ── Buscar candidata a normativa sucesora ─────────────────────────────────

  async buscarCandidataSucesora(
    numeroNorma: string,
    anio: number,
    excluirId: string,
  ) {
    if (!numeroNorma?.trim() || !anio) {
      throw new BadRequestException('Debe indicar N° de norma y año.');
    }

    const candidata = await this.prisma.normativa.findFirst({
      where: { numeroNorma: numeroNorma.trim(), anio, eliminado: false },
      include: { tipoNormativa: { select: { id: true, nombre: true } } },
    });

    if (!candidata) {
      throw new NotFoundException(
        'ERROR: LA NORMATIVA SUCESORA NO EXISTE. DEBE REGISTRARLA PREVIAMENTE.',
      );
    }

    if (candidata.id === excluirId) {
      throw new BadRequestException('Una normativa no puede ser sucesora de sí misma.');
    }

    if (candidata.vigencia !== 'VIGENTE') {
      throw new BadRequestException(
        'ERROR: LA NORMATIVA SUCESORA DEBE ENCONTRARSE VIGENTE.',
      );
    }

    return {
      id:            candidata.id,
      titulo:        candidata.titulo,
      numeroNorma:   candidata.numeroNorma,
      anio:          candidata.anio,
      vigencia:      candidata.vigencia,
      tipoNormativa: candidata.tipoNormativa,
    };
  }

  // ── Consultas ─────────────────────────────────────────────────────────────

  async obtenerTipos() {
    return this.prisma.tipoNormativa.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async conteoPorTipo(rolUsuario: string) {
    const esDocente = rolUsuario === 'DOCENTE';
    const whereNormativas = esDocente
      ? { eliminado: false, vigencia: 'VIGENTE' }
      : { eliminado: false };

    const tipos = await this.prisma.tipoNormativa.findMany({
      where: { activo: true },
      select: {
        id: true,
        nombre: true,
        _count: { select: { normativas: { where: whereNormativas } } },
      },
      orderBy: { nombre: 'asc' },
    });

    return tipos.map(t => ({
      id: t.id,
      nombre: t.nombre,
      cantidad: t._count.normativas,
    }));
  }

  async listar(dto: ListarNormativasDto, rolUsuario: string) {
    const {
      busqueda, areaEmisora, tipoId, vigencia, fechaDesde, fechaHasta,
      estadoRegistro, page = 1, limit = 10,
    } = dto;

    const esDocente          = rolUsuario === 'DOCENTE';
    const puedeVerEliminadas = ROLES_VER_ELIMINADAS.includes(rolUsuario);

    const estadoEfectivo: 'ACTIVAS' | 'ELIMINADAS' | 'TODAS' =
      (!puedeVerEliminadas || esDocente || !estadoRegistro)
        ? 'ACTIVAS'
        : (estadoRegistro as 'ACTIVAS' | 'ELIMINADAS' | 'TODAS');

    const incluyeEliminadoFields = estadoEfectivo === 'ELIMINADAS' || estadoEfectivo === 'TODAS';

    const tokens = busqueda?.trim() ? tokenizar(busqueda) : [];

    let data: any[];
    let total: number;

    // ── Path A: sin búsqueda de texto — Prisma ORM ───────────────────────────
    if (tokens.length === 0) {
      const where: Record<string, any> = {};

      if (esDocente || !puedeVerEliminadas || estadoEfectivo === 'ACTIVAS') {
        where.eliminado = false;
      } else if (estadoEfectivo === 'ELIMINADAS') {
        where.eliminado = true;
      }

      if (esDocente) {
        where.vigencia = 'VIGENTE';
      } else if (estadoEfectivo === 'ACTIVAS' && vigencia && VIGENCIAS_VALIDAS.includes(vigencia as any)) {
        where.vigencia = vigencia;
      }

      if (areaEmisora?.trim()) where.areaEmisora = { contains: areaEmisora.trim(), mode: 'insensitive' };
      if (tipoId)               where.tipoNormativaId = tipoId;
      if (fechaDesde || fechaHasta) {
        where.fechaEmision = {};
        if (fechaDesde) where.fechaEmision.gte = new Date(fechaDesde);
        if (fechaHasta) where.fechaEmision.lte = new Date(fechaHasta + 'T23:59:59.999Z');
      }

      const [cnt, rows] = await this.prisma.$transaction([
        this.prisma.normativa.count({ where }),
        this.prisma.normativa.findMany({
          where,
          orderBy: { fechaEmision: 'desc' },
          take: limit,
          skip: (page - 1) * limit,
          include: { tipoNormativa: { select: { id: true, nombre: true } } },
        }),
      ]);

      total = cnt;
      data  = rows as any[];

    } else {
      // ── Path B: búsqueda de texto — raw SQL con unaccent ─────────────────
      const conditions: Prisma.Sql[] = [];

      if (esDocente || !puedeVerEliminadas || estadoEfectivo === 'ACTIVAS') {
        conditions.push(Prisma.sql`n."eliminado" = false`);
      } else if (estadoEfectivo === 'ELIMINADAS') {
        conditions.push(Prisma.sql`n."eliminado" = true`);
      }

      if (esDocente) {
        conditions.push(Prisma.sql`n."vigencia" = 'VIGENTE'`);
      } else if (estadoEfectivo === 'ACTIVAS' && vigencia && VIGENCIAS_VALIDAS.includes(vigencia as any)) {
        conditions.push(Prisma.sql`n."vigencia" = ${vigencia}`);
      }

      if (tipoId) {
        conditions.push(Prisma.sql`n."tipoNormativaId" = ${tipoId}::uuid`);
      }

      if (areaEmisora?.trim()) {
        const ae = `%${areaEmisora.trim()}%`;
        conditions.push(
          Prisma.sql`unaccent(LOWER(n."areaEmisora")) LIKE unaccent(LOWER(${ae}))`,
        );
      }

      if (fechaDesde) {
        conditions.push(Prisma.sql`n."fechaEmision" >= ${new Date(fechaDesde)}`);
      }
      if (fechaHasta) {
        conditions.push(Prisma.sql`n."fechaEmision" <= ${new Date(fechaHasta + 'T23:59:59.999Z')}`);
      }

      for (const token of tokens) {
        const param = `%${token}%`;
        if (incluyeEliminadoFields) {
          conditions.push(Prisma.sql`(
            unaccent(LOWER(n."titulo"))                                    LIKE unaccent(LOWER(${param}))
            OR unaccent(LOWER(COALESCE(n."palabrasClave", '')))           LIKE unaccent(LOWER(${param}))
            OR unaccent(LOWER(n."areaEmisora"))                           LIKE unaccent(LOWER(${param}))
            OR unaccent(LOWER(COALESCE(n."motivoEliminacion", '')))       LIKE unaccent(LOWER(${param}))
          )`);
        } else {
          conditions.push(Prisma.sql`(
            unaccent(LOWER(n."titulo"))                          LIKE unaccent(LOWER(${param}))
            OR unaccent(LOWER(COALESCE(n."palabrasClave", ''))) LIKE unaccent(LOWER(${param}))
            OR unaccent(LOWER(n."areaEmisora"))                 LIKE unaccent(LOWER(${param}))
          )`);
        }
      }

      const extraSelect = incluyeEliminadoFields
        ? Prisma.sql`, n."eliminado", n."motivoEliminacion", n."fechaEliminacion", n."eliminadoPorUsuarioId"`
        : Prisma.sql``;

      const where = Prisma.join(conditions, ' AND ');

      const [countRows, dataRows] = await Promise.all([
        this.prisma.$queryRaw<{ count: bigint }[]>(
          Prisma.sql`SELECT COUNT(*) AS count FROM "Normativa" n WHERE ${where}`,
        ),
        this.prisma.$queryRaw<any[]>(
          Prisma.sql`
            SELECT
              n.id, n.titulo, n."areaEmisora", n."numeroNorma", n.anio,
              n."fechaEmision", n.vigencia, n."palabrasClave", n."tipoNormativaId",
              n."fechaCreacion", n."fechaActualizacion"${extraSelect},
              tn.id AS "tn_id", tn.nombre AS "tn_nombre"
            FROM "Normativa" n
            JOIN "TipoNormativa" tn ON n."tipoNormativaId" = tn.id
            WHERE ${where}
            ORDER BY n."fechaEmision" DESC
            LIMIT ${limit} OFFSET ${(page - 1) * limit}
          `,
        ),
      ]);

      total = Number(countRows[0]?.count ?? 0);
      data  = dataRows.map(r => ({
        id:              r.id,
        titulo:          r.titulo,
        areaEmisora:     r.areaEmisora,
        numeroNorma:     r.numeroNorma,
        anio:            r.anio,
        fechaEmision:    r.fechaEmision,
        vigencia:        r.vigencia,
        palabrasClave:   r.palabrasClave,
        tipoNormativaId: r.tipoNormativaId,
        fechaCreacion:   r.fechaCreacion,
        fechaActualizacion: r.fechaActualizacion,
        tipoNormativa:   { id: r.tn_id, nombre: r.tn_nombre },
        ...(incluyeEliminadoFields ? {
          eliminado:             r.eliminado,
          motivoEliminacion:     r.motivoEliminacion,
          fechaEliminacion:      r.fechaEliminacion,
          eliminadoPorUsuarioId: r.eliminadoPorUsuarioId,
        } : {}),
      }));
    }

    // ── Enriquecer con nombre del usuario que realizó la baja ─────────────────
    if (incluyeEliminadoFields && data.length > 0) {
      const userIds = [...new Set(
        data
          .filter(n => n.eliminadoPorUsuarioId)
          .map(n => n.eliminadoPorUsuarioId as string),
      )];

      if (userIds.length > 0) {
        const usuarios = await this.prisma.usuario.findMany({
          where: { id: { in: userIds } },
          select: { id: true, nombre: true, apellido: true },
        });
        const userMap = new Map(usuarios.map(u => [u.id, `${u.apellido}, ${u.nombre}`]));

        data = data.map(n => ({
          ...n,
          eliminadoPorNombre: n.eliminadoPorUsuarioId
            ? (userMap.get(n.eliminadoPorUsuarioId) ?? null)
            : null,
        }));
      }
    }

    return { data, total, paginaActual: page, limite: limit, totalPaginas: Math.ceil(total / limit) };
  }

  async obtenerPorId(
    id: string,
    rolUsuario: string,
    usuarioId: string | null,
    ipOrigen: string | null,
  ) {
    const esDocente          = rolUsuario === 'DOCENTE';
    const puedeVerEliminadas = ROLES_VER_ELIMINADAS.includes(rolUsuario);

    const whereQuery = puedeVerEliminadas ? { id } : { id, eliminado: false };

    const normativa = await this.prisma.normativa.findFirst({
      where: whereQuery,
      include: {
        tipoNormativa:   { select: { id: true, nombre: true } },
        normativaSucesora: {
          select: { id: true, titulo: true, numeroNorma: true, anio: true, vigencia: true, tipoNormativaId: true },
        },
        normativasReemplazadas: {
          where: { eliminado: false },
          select: { id: true, titulo: true, numeroNorma: true, anio: true, vigencia: true, tipoNormativaId: true },
        },
      },
    });

    if (!normativa) throw new NotFoundException('Normativa no encontrada');

    if (!puedeVerEliminadas && normativa.eliminado) {
      void this.auditoria.registrar({
        accion:          'ACCESO_DENEGADO',
        usuarioId,
        normativaId:     normativa.id,
        normativaTitulo: normativa.titulo,
        normativaNumero: normativa.numeroNorma,
        normativaAnio:   normativa.anio,
        detalle: { razon: 'USUARIO SIN PERMISOS PARA VER NORMATIVAS ELIMINADAS', rol: rolUsuario },
        ipOrigen,
      });
      throw new NotFoundException('Normativa no encontrada');
    }

    if (esDocente && normativa.vigencia !== 'VIGENTE') {
      void this.auditoria.registrar({
        accion:          'ACCESO_DENEGADO',
        usuarioId,
        normativaId:     normativa.id,
        normativaTitulo: normativa.titulo,
        normativaNumero: normativa.numeroNorma,
        normativaAnio:   normativa.anio,
        detalle: { razon: 'DOCENTE SIN ACCESO A NORMATIVA NO VIGENTE', vigenciaRecurso: normativa.vigencia },
        ipOrigen,
      });
      throw new NotFoundException('Normativa no encontrada');
    }

    const {
      rutaArchivoOriginal,
      rutaArchivoCuarentena,
      nombreArchivoFisico,
      normativaSucesoraId,
      ...resto
    } = normativa;

    let eliminadoPorNombre: string | null = null;
    if (normativa.eliminado && normativa.eliminadoPorUsuarioId) {
      const usr = await this.prisma.usuario.findUnique({
        where:  { id: normativa.eliminadoPorUsuarioId },
        select: { nombre: true, apellido: true },
      });
      eliminadoPorNombre = usr ? `${usr.apellido}, ${usr.nombre}` : null;
    }

    return {
      ...resto,
      tieneArchivo:             !normativa.eliminado && !!rutaArchivoOriginal,
      tieneArchivoEnCuarentena: normativa.eliminado  && !!rutaArchivoCuarentena,
      ...(normativa.eliminado ? { eliminadoPorNombre } : {}),
    };
  }

  // ── Baja lógica con cuarentena de PDF ────────────────────────────────────

  async eliminarLogico(
    id: string,
    dto: EliminarNormativaDto,
    usuarioId: string | null,
    ipOrigen: string | null,
  ) {
    const normativa = await this.prisma.normativa.findFirst({ where: { id } });
    if (!normativa) throw new NotFoundException('Normativa no encontrada');

    if (normativa.eliminado) {
      throw new ConflictException('LA NORMATIVA YA SE ENCUENTRA DADA DE BAJA.');
    }

    if (!dto.motivo?.trim()) {
      throw new BadRequestException(
        'ERROR: DEBE ESPECIFICAR UN MOTIVO VÁLIDO PARA PROCEDER CON LA ELIMINACIÓN LÓGICA.',
      );
    }

    const referenciaActiva = await this.prisma.normativa.findFirst({
      where: { normativaSucesoraId: id, eliminado: false },
      select: { titulo: true, numeroNorma: true, anio: true },
    });
    if (referenciaActiva) {
      throw new ConflictException(
        `LA NORMATIVA NO PUEDE DARSE DE BAJA PORQUE ES REFERENCIADA COMO NORMATIVA SUCESORA POR ` +
        `"${referenciaActiva.titulo}" (N° ${referenciaActiva.numeroNorma}/${referenciaActiva.anio}). ` +
        `ACTUALICE LAS RELACIONES ANTES DE PROCEDER.`,
      );
    }

    let rutaCuarentena: string | null = normativa.rutaArchivoCuarentena ?? null;
    const rutaOriginalActual = normativa.rutaArchivoOriginal;

    if (rutaOriginalActual) {
      const nombreFisico = path.basename(rutaOriginalActual);
      const rutaDestino  = `cuarentena/${nombreFisico}`;
      try {
        await this.storage.mover(rutaOriginalActual, rutaDestino);
        rutaCuarentena = rutaDestino;
      } catch (e: any) {
        this.logger.error(`Error moviendo PDF a cuarentena (normativa ${id}): ${e?.message}`);
        throw new InternalServerErrorException(
          'No se pudo mover el archivo a cuarentena. La operación fue cancelada.',
        );
      }
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.normativa.update({
          where: { id },
          data: {
            eliminado:             true,
            fechaEliminacion:      new Date(),
            eliminadoPorUsuarioId: usuarioId,
            motivoEliminacion:     dto.motivo.trim(),
            rutaArchivoOriginal:   null,
            rutaArchivoCuarentena: rutaCuarentena,
          },
        });

        await tx.historialEstadoNormativa.create({
          data: {
            normativaId:    id,
            estadoAnterior: normativa.vigencia,
            estadoNuevo:    'ELIMINADA',
            motivo:         dto.motivo.trim(),
            usuarioId,
          },
        });
      });
    } catch (error: any) {
      if (rutaOriginalActual && rutaCuarentena) {
        this.storage.mover(rutaCuarentena, rutaOriginalActual).catch(e2 =>
          this.logger.error(
            `No se pudo revertir el movimiento del archivo tras fallo en BD. ` +
            `Archivo queda en: ${rutaCuarentena} — ${e2?.message}`,
          ),
        );
      }
      if (error instanceof NotFoundException || error instanceof ConflictException ||
          error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error al registrar la baja lógica. Intente nuevamente.',
      );
    }

    void this.auditoria.registrar({
      accion:          'ELIMINACION_LOGICA',
      usuarioId,
      normativaId:     id,
      normativaTitulo: normativa.titulo,
      normativaNumero: normativa.numeroNorma,
      normativaAnio:   normativa.anio,
      detalle: {
        estadoAnterior:       normativa.vigencia,
        motivo:               dto.motivo.trim(),
        pdfMovidoACuarentena: !!rutaCuarentena,
      },
      ipOrigen,
    });

    return { mensaje: 'LA NORMATIVA FUE DADA DE BAJA CORRECTAMENTE.' };
  }

  // ── Servir archivo PDF ────────────────────────────────────────────────────

  async servirArchivo(
    id: string,
    rolUsuario: string,
    download: boolean,
    usuarioId: string | null,
    ipOrigen: string | null,
  ): Promise<StreamableFile> {
    const esDocente = rolUsuario === 'DOCENTE';

    const normativa = await this.prisma.normativa.findFirst({ where: { id, eliminado: false } });
    if (!normativa) throw new NotFoundException('Normativa no encontrada');

    if (esDocente && normativa.vigencia !== 'VIGENTE') {
      void this.auditoria.registrar({
        accion:          'ACCESO_DENEGADO',
        usuarioId,
        normativaId:     normativa.id,
        normativaTitulo: normativa.titulo,
        normativaNumero: normativa.numeroNorma,
        normativaAnio:   normativa.anio,
        detalle: {
          razon:           'DOCENTE SIN ACCESO AL DOCUMENTO DE NORMATIVA NO VIGENTE',
          vigenciaRecurso: normativa.vigencia,
          accionIntentada: download ? 'DESCARGA_PDF' : 'VER_DOCUMENTO',
        },
        ipOrigen,
      });
      throw new ForbiddenException('No tiene acceso a este documento.');
    }

    if (!normativa.rutaArchivoOriginal) {
      throw new NotFoundException('Esta normativa no tiene un documento PDF asociado');
    }

    const existe = await this.storage.existeArchivo(normativa.rutaArchivoOriginal);
    if (!existe) {
      this.logger.error(
        `Archivo físico no encontrado para normativa ${id}: ${normativa.rutaArchivoOriginal}`,
      );
      throw new NotFoundException('El archivo PDF no está disponible en este momento');
    }

    const stream = this.storage.crearReadStream(normativa.rutaArchivoOriginal);
    const nombreDescarga =
      normativa.nombreArchivoOriginal ??
      `normativa-${normativa.numeroNorma}-${normativa.anio}.pdf`;

    void this.auditoria.registrar({
      accion:          download ? 'DESCARGA_PDF' : 'VER_DOCUMENTO',
      usuarioId,
      normativaId:     normativa.id,
      normativaTitulo: normativa.titulo,
      normativaNumero: normativa.numeroNorma,
      normativaAnio:   normativa.anio,
      detalle:         { archivo: nombreDescarga },
      ipOrigen,
    });

    return new StreamableFile(stream, {
      type: 'application/pdf',
      disposition: download
        ? `attachment; filename="${nombreDescarga}"`
        : `inline; filename="${nombreDescarga}"`,
      length: normativa.tamanioArchivo ?? undefined,
    });
  }
}
