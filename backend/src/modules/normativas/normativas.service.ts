import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CrearNormativaDto } from './dto/crear-normativa.dto';
import { ListarNormativasDto } from './dto/listar-normativas.dto';

const VIGENCIAS_VALIDAS = ['VIGENTE', 'DEROGADA', 'SUSPENDIDA', 'REEMPLAZADA'] as const;

const STOPWORDS = new Set([
  'de','del','la','el','los','las','para','con','un','una','y','en','a','al',
]);

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
    private readonly prisma:   PrismaService,
    private readonly storage:  StorageService,
  ) {}

  // ── Alta con archivo ──────────────────────────────────────────────────────

  async crear(dto: CrearNormativaDto, archivo: Express.Multer.File) {
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
    try {
      return await this.prisma.normativa.create({
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
      // Compensación: borrar el archivo para evitar huérfanos
      await this.storage.eliminar(rutaRelativa);
      if (error?.code === 'P2002') {
        throw new ConflictException('YA EXISTE UNA NORMA REGISTRADA CON ESE NÚMERO Y AÑO.');
      }
      throw new InternalServerErrorException('Error al registrar la normativa. Archivo eliminado.');
    }
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
    const { busqueda, areaEmisora, tipoId, vigencia, fechaDesde, fechaHasta, page = 1, limit = 10 } = dto;
    const esDocente = rolUsuario === 'DOCENTE';
    const tokens = busqueda?.trim() ? tokenizar(busqueda) : [];

    // ── Path A: sin búsqueda de texto — Prisma ORM (eficiente y type-safe) ───
    if (tokens.length === 0) {
      const where: Record<string, any> = { eliminado: false };

      if (esDocente) {
        where.vigencia = 'VIGENTE';
      } else if (vigencia && VIGENCIAS_VALIDAS.includes(vigencia as any)) {
        where.vigencia = vigencia;
      }

      if (areaEmisora?.trim()) where.areaEmisora = { contains: areaEmisora.trim(), mode: 'insensitive' };
      if (tipoId)               where.tipoNormativaId = tipoId;
      if (fechaDesde || fechaHasta) {
        where.fechaEmision = {};
        if (fechaDesde) where.fechaEmision.gte = new Date(fechaDesde);
        if (fechaHasta) where.fechaEmision.lte = new Date(fechaHasta + 'T23:59:59.999Z');
      }

      const [total, data] = await this.prisma.$transaction([
        this.prisma.normativa.count({ where }),
        this.prisma.normativa.findMany({
          where,
          orderBy: { fechaEmision: 'desc' },
          take: limit,
          skip: (page - 1) * limit,
          include: { tipoNormativa: { select: { id: true, nombre: true } } },
        }),
      ]);

      return { data, total, paginaActual: page, limite: limit, totalPaginas: Math.ceil(total / limit) };
    }

    // ── Path B: búsqueda de texto — raw SQL con unaccent (insensible a acentos) ─
    // unaccent() normaliza ambos lados: 'RESOLUCIÓN' y 'resolucion' se comparan igual.
    // Todos los tokens deben encontrarse en alguno de los campos indexables (AND de ORs).
    const conditions: Prisma.Sql[] = [Prisma.sql`n."eliminado" = false`];

    if (esDocente) {
      conditions.push(Prisma.sql`n."vigencia" = 'VIGENTE'`);
    } else if (vigencia && VIGENCIAS_VALIDAS.includes(vigencia as any)) {
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

    // Un token debe aparecer en ALGUNO de los campos (OR), y TODOS los tokens deben cumplirse (AND)
    for (const token of tokens) {
      const param = `%${token}%`;
      conditions.push(Prisma.sql`(
        unaccent(LOWER(n."titulo"))                          LIKE unaccent(LOWER(${param}))
        OR unaccent(LOWER(COALESCE(n."palabrasClave", ''))) LIKE unaccent(LOWER(${param}))
        OR unaccent(LOWER(n."areaEmisora"))                 LIKE unaccent(LOWER(${param}))
      )`);
    }

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
            n."fechaCreacion", n."fechaActualizacion",
            tn.id AS "tn_id", tn.nombre AS "tn_nombre"
          FROM "Normativa" n
          JOIN "TipoNormativa" tn ON n."tipoNormativaId" = tn.id
          WHERE ${where}
          ORDER BY n."fechaEmision" DESC
          LIMIT ${limit} OFFSET ${(page - 1) * limit}
        `,
      ),
    ]);

    const total = Number(countRows[0]?.count ?? 0);
    const data = dataRows.map(r => ({
      id:             r.id,
      titulo:         r.titulo,
      areaEmisora:    r.areaEmisora,
      numeroNorma:    r.numeroNorma,
      anio:           r.anio,
      fechaEmision:   r.fechaEmision,
      vigencia:       r.vigencia,
      palabrasClave:  r.palabrasClave,
      tipoNormativaId: r.tipoNormativaId,
      fechaCreacion:  r.fechaCreacion,
      fechaActualizacion: r.fechaActualizacion,
      tipoNormativa:  { id: r.tn_id, nombre: r.tn_nombre },
    }));

    return { data, total, paginaActual: page, limite: limit, totalPaginas: Math.ceil(total / limit) };
  }

  async obtenerPorId(id: string, rolUsuario: string) {
    const esDocente = rolUsuario === 'DOCENTE';
    const where: Record<string, any> = { id, eliminado: false };
    if (esDocente) where.vigencia = 'VIGENTE';

    const normativa = await this.prisma.normativa.findFirst({
      where,
      include: { tipoNormativa: { select: { id: true, nombre: true } } },
    });

    if (!normativa) throw new NotFoundException('Normativa no encontrada');

    // Nunca exponer rutas físicas ni campos internos al cliente
    const {
      rutaArchivoOriginal,
      rutaArchivoCuarentena,
      nombreArchivoFisico,
      eliminado,
      ...resto
    } = normativa;

    return {
      ...resto,
      tieneArchivo: !!rutaArchivoOriginal,
    };
  }

  // ── Servir archivo PDF ────────────────────────────────────────────────────

  async servirArchivo(id: string, rolUsuario: string, download: boolean): Promise<StreamableFile> {
    const esDocente = rolUsuario === 'DOCENTE';
    const where: Record<string, any> = { id, eliminado: false };
    if (esDocente) where.vigencia = 'VIGENTE';

    const normativa = await this.prisma.normativa.findFirst({ where });
    if (!normativa) throw new NotFoundException('Normativa no encontrada');

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

    return new StreamableFile(stream, {
      type: 'application/pdf',
      disposition: download
        ? `attachment; filename="${nombreDescarga}"`
        : `inline; filename="${nombreDescarga}"`,
      length: normativa.tamanioArchivo ?? undefined,
    });
  }
}
