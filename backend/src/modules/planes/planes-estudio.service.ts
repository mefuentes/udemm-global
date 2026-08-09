import { Injectable, NotFoundException, UnprocessableEntityException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CrearPlanDto } from './dto/crear-plan.dto';
import { ActualizarPlanDto } from './dto/actualizar-plan.dto';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

type PlanExport = {
  nombre: string;
  anio: number | null;
  version: string | null;
  estado: string;
  duracionCuatrimestres: number | null;
  fechaAprobacion: Date | null;
  carrera: { nombre: string; facultad: { nombre: string } | null };
  estadisticas: {
    cargaHorariaTotal: number;
    distribBloque: Array<{ bloque: string; cantidad: number; cargaHoraria: number; porcentaje: number }>;
  };
};

@Injectable()
export class PlanesEstudioService {
  constructor(private readonly prisma: PrismaService) {}

  async obtenerCarreras() {
    return this.prisma.carrera.findMany({
      include: {
        facultad: true,
        _count: { select: { planes: true } }
      },
      orderBy: { nombre: 'asc' }
    });
  }

  async obtenerTodos(carreraId?: string) {
    const planes = await this.prisma.planEstudio.findMany({
      where: carreraId ? { carreraId } : undefined,
      include: {
        carrera: true,
        _count: { select: { materias: true } }
      },
      orderBy: [{ anio: 'desc' }, { nombre: 'asc' }]
    });

    // Calcular el año máximo de la estructura curricular de cada plan
    const planIds = planes.map(p => p.id);
    const maxAnios = await this.prisma.materia.groupBy({
      by: ['planEstudioId'],
      _max: { anio: true },
      where: { planEstudioId: { in: planIds } }
    });
    const maxAnioMap = new Map(maxAnios.map(r => [r.planEstudioId, r._max.anio]));

    return planes.map(p => ({
      ...p,
      aniosEstructura: maxAnioMap.get(p.id) ?? null,
    }));
  }

  async obtenerKpis() {
    const [totalPlanes, totalMaterias, totalCarreras, planesActivos] =
      await Promise.all([
        this.prisma.planEstudio.count(),
        this.prisma.materia.count({ where: { estado: 'ACTIVO' } }),
        this.prisma.carrera.count(),
        this.prisma.planEstudio.count({ where: { estado: 'ACTIVO' } })
      ]);

    return { totalPlanes, totalMaterias, totalCarreras, planesActivos };
  }

  async obtenerPorId(id: string) {
    const plan = await this.prisma.planEstudio.findUnique({
      where: { id },
      include: {
        carrera: { include: { facultad: true } },
        materias: {
          orderBy: [{ anio: 'asc' }, { cuatrimestre: 'asc' }, { nombre: 'asc' }]
        }
      }
    });
    if (!plan) throw new NotFoundException(`Plan de estudios ${id} no encontrado`);
    return plan;
  }

  async obtenerEstadisticas(planId: string) {
    const plan = await this.prisma.planEstudio.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException(`Plan de estudios ${planId} no encontrado`);

    const materias = await this.prisma.materia.findMany({
      where: { planEstudioId: planId, estado: 'ACTIVO' },
      select: { bloqueConocimiento: true, cargaHorariaTotal: true },
    });

    const cargaHorariaTotal = materias.reduce(
      (sum, m) => sum + (m.cargaHorariaTotal ?? 0), 0
    );

    // Agrupar por bloque
    const bloqueMap = new Map<string, { cantidad: number; cargaHoraria: number }>();
    for (const m of materias) {
      const bloque = m.bloqueConocimiento ?? 'Sin bloque asignado';
      const entry = bloqueMap.get(bloque) ?? { cantidad: 0, cargaHoraria: 0 };
      entry.cantidad++;
      entry.cargaHoraria += m.cargaHorariaTotal ?? 0;
      bloqueMap.set(bloque, entry);
    }

    const distribBloque = Array.from(bloqueMap.entries())
      .map(([bloque, data]) => ({
        bloque,
        cantidad: data.cantidad,
        cargaHoraria: data.cargaHoraria,
        porcentaje: cargaHorariaTotal > 0
          ? Math.round((data.cargaHoraria / cargaHorariaTotal) * 1000) / 10
          : 0,
      }))
      .sort((a, b) => {
        if (a.bloque === 'Sin bloque asignado') return 1;
        if (b.bloque === 'Sin bloque asignado') return -1;
        return a.bloque.localeCompare(b.bloque, 'es');
      });

    return { cargaHorariaTotal, distribBloque };
  }

  // ── Export helpers ──────────────────────────────────────────────────────────

  private async obtenerDatosExportar(carreraId?: string, planId?: string): Promise<PlanExport[]> {
    if (!carreraId && !planId) {
      throw new BadRequestException('Debe especificar carreraId o planId para exportar');
    }
    const where = planId ? { id: planId } : { carreraId: carreraId! };
    const planes = await this.prisma.planEstudio.findMany({
      where,
      include: { carrera: { include: { facultad: { select: { nombre: true } } } } },
      orderBy: [{ anio: 'desc' }, { nombre: 'asc' }],
    });
    if (planes.length === 0) {
      throw new NotFoundException('No hay planes para exportar con los filtros indicados');
    }
    return Promise.all(
      planes.map(async p => ({
        nombre: p.nombre,
        anio: p.anio,
        version: p.version,
        estado: p.estado,
        duracionCuatrimestres: p.duracionCuatrimestres,
        fechaAprobacion: p.fechaAprobacion,
        carrera: { nombre: p.carrera.nombre, facultad: p.carrera.facultad },
        estadisticas: await this.obtenerEstadisticas(p.id),
      })),
    );
  }

  async generarExcel(carreraId?: string, planId?: string): Promise<Buffer> {
    const datos = await this.obtenerDatosExportar(carreraId, planId);

    const carreraNombre = datos[0]?.carrera.nombre ?? '';
    const planNombre    = datos.length === 1 ? datos[0].nombre : '';
    const fechaGen = new Date().toLocaleDateString('es-AR', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    const filtroTexto = [
      carreraNombre && `Carrera: ${carreraNombre}`,
      planNombre    && `Plan: ${planNombre}`,
    ].filter(Boolean).join('   ·   ');

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'UDEMM Global';
    workbook.created = new Date();

    // Helper: agrega encabezado institucional (filas 1-4) a la hoja recibida
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function addHeader(ws: any, cols: number, subTitle: string) {
      const last = String.fromCharCode(64 + cols);
      const span = (n: number) => `A${n}:${last}${n}`;

      ws.mergeCells(span(1));
      const c1 = ws.getCell('A1');
      c1.value = 'UNIVERSIDAD DE LA MARINA MERCANTE';
      c1.font  = { bold: true, size: 13, color: { argb: 'FF0F4C81' } };
      c1.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 26;

      ws.mergeCells(span(2));
      const c2 = ws.getCell('A2');
      c2.value = subTitle;
      c2.font  = { bold: true, size: 11, color: { argb: 'FF1E293B' } };
      c2.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(2).height = 22;

      ws.mergeCells(span(3));
      const c3 = ws.getCell('A3');
      c3.value = `Generado: ${fechaGen}${filtroTexto ? '   ·   ' + filtroTexto : ''}`;
      c3.font  = { size: 9, italic: true, color: { argb: 'FF64748B' } };
      c3.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(3).height = 18;

      ws.getRow(4).height = 6; // separador visual
    }

    // ── Hoja 1: Planes de Estudio (7 columnas) ───────────────────────────
    const ws1 = workbook.addWorksheet('Planes de Estudio');
    ws1.columns = [
      { width: 26 }, { width: 30 }, { width: 36 },
      { width: 8  }, { width: 12 }, { width: 15 }, { width: 24 },
    ];
    addHeader(ws1, 7, 'Información de Planes de Estudio');

    const hdr1 = ws1.addRow([
      'Facultad', 'Carrera', 'Plan de Estudios',
      'Año', 'Versión', 'Estado', 'Carga Horaria Total (hs)',
    ]);
    hdr1.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    hdr1.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4C81' } };
    hdr1.alignment = { vertical: 'middle', horizontal: 'left' };
    hdr1.height    = 22;

    datos.forEach(p => {
      const row = ws1.addRow([
        p.carrera.facultad?.nombre ?? '',
        p.carrera.nombre,
        p.nombre,
        p.anio ?? null,
        p.version ?? '',
        p.estado.replace('_', ' '),
        p.estadisticas.cargaHorariaTotal,
      ]);
      row.alignment     = { vertical: 'middle' };
      row.getCell(4).numFmt = '0';      // Año
      row.getCell(7).numFmt = '#,##0';  // CH Total
      row.height = 18;
    });
    ws1.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: 7 } };

    // ── Hoja 2: Distribución por Bloque (5 columnas) ─────────────────────
    const ws2 = workbook.addWorksheet('Distribución por Bloque');
    ws2.columns = [{ width: 36 }, { width: 26 }, { width: 22 }, { width: 20 }, { width: 15 }];
    addHeader(ws2, 5, 'Distribución de Carga Horaria por Bloque');

    const hdr2 = ws2.addRow([
      'Plan de Estudios', 'Bloque', 'Cantidad de Asignaturas', 'Carga Horaria (hs)', 'Porcentaje',
    ]);
    hdr2.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    hdr2.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4C81' } };
    hdr2.alignment = { vertical: 'middle', horizontal: 'left' };
    hdr2.height    = 22;

    datos.forEach(p => {
      p.estadisticas.distribBloque.forEach(b => {
        const row = ws2.addRow([p.nombre, b.bloque, b.cantidad, b.cargaHoraria, b.porcentaje / 100]);
        row.alignment     = { vertical: 'middle' };
        row.getCell(3).numFmt = '0';
        row.getCell(4).numFmt = '#,##0';
        row.getCell(5).numFmt = '0.0%';
        row.height = 18;
      });
    });
    ws2.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: 5 } };

    const raw = await workbook.xlsx.writeBuffer();
    return Buffer.isBuffer(raw) ? (raw as Buffer) : Buffer.from(raw as ArrayBuffer);
  }

  async generarPdf(carreraId?: string, planId?: string): Promise<Buffer> {
    const datos = await this.obtenerDatosExportar(carreraId, planId);

    const carreraNombre = datos[0]?.carrera.nombre ?? '';
    const planNombre = datos.length === 1 ? datos[0].nombre : '';
    const fechaGen = new Date().toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' });
    let filtrosLabel = carreraNombre && planNombre
      ? `Carrera: ${carreraNombre}  ·  Plan: ${planNombre}`
      : carreraNombre ? `Carrera: ${carreraNombre}` : 'Todos los registros';

    return new Promise<Buffer>((resolve, reject) => {
      const ML = 35, MR = 35, MT = 50, MB = 40;
      const PAGE_W = 841.89, PAGE_H = 595.28;
      const USABLE_W = PAGE_W - ML - MR;
      const BLUE = '#0f4c81', DARK = '#0f172a', GRAY = '#64748b', BORD = '#cbd5e1';

      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', autoFirstPage: false, margin: 0 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let pageNum = 0;
      let curY = MT;

      const sep = (y: number, color = BORD, lw = 0.5) =>
        doc.moveTo(ML, y).lineTo(PAGE_W - MR, y).strokeColor(color).lineWidth(lw).stroke();

      function drawFooter() {
        sep(PAGE_H - MB + 4, BORD, 0.3);
        doc.fontSize(7).font('Helvetica').fillColor(GRAY)
           .text('Universidad de la Marina Mercante  ·  Información de Planes de Estudio', ML, PAGE_H - MB + 9, { width: USABLE_W - 60 });
        doc.fontSize(7).font('Helvetica').fillColor(GRAY)
           .text(`Página ${pageNum}`, ML, PAGE_H - MB + 9, { width: USABLE_W, align: 'right' });
      }

      function newPage(isFirst = false) {
        if (pageNum > 0) drawFooter();
        pageNum++;
        doc.addPage();
        if (isFirst) {
          doc.fontSize(11).font('Helvetica-Bold').fillColor(BLUE)
             .text('UNIVERSIDAD DE LA MARINA MERCANTE', ML, MT, { width: USABLE_W, align: 'center' });
          doc.fontSize(10).font('Helvetica-Bold').fillColor(DARK)
             .text('Información de Planes de Estudio', ML, MT + 16, { width: USABLE_W, align: 'center' });
          doc.fontSize(8).font('Helvetica').fillColor(GRAY)
             .text(`Generado: ${fechaGen}   ·   Filtros: ${filtrosLabel}`, ML, MT + 30, { width: USABLE_W, align: 'center' });
          sep(MT + 44, BLUE, 1.2);
          curY = MT + 56;
        } else {
          doc.fontSize(8).font('Helvetica').fillColor(GRAY)
             .text('UNIVERSIDAD DE LA MARINA MERCANTE  ·  Información de Planes de Estudio', ML, MT - 14, { width: USABLE_W });
          sep(MT - 2, BORD, 0.4);
          curY = MT + 10;
        }
      }

      function drawRow(cells: string[], cols: number[], rh: number, isHdr: boolean) {
        const totalW = cols.reduce((a, b) => a + b, 0);
        if (isHdr) doc.rect(ML, curY, totalW, rh).fill(BLUE);
        doc.strokeColor(BORD).lineWidth(0.25);
        let cx = ML;
        cols.forEach(w => { doc.rect(cx, curY, w, rh).stroke(); cx += w; });
        cx = ML;
        cells.forEach((cell, i) => {
          doc.fontSize(7.5)
             .font(isHdr ? 'Helvetica-Bold' : 'Helvetica')
             .fillColor(isHdr ? 'white' : DARK)
             .text(cell ?? '—', cx + 3, curY + (rh - 8) / 2, { width: cols[i] - 6, lineBreak: false });
          cx += cols[i];
        });
        curY += rh;
      }

      function drawTable(title: string, hdrs: string[], rows: string[][], cols: number[], rh = 18, hdrH = 20) {
        if (curY + 22 + hdrH > PAGE_H - MB - 15) newPage();
        doc.fontSize(9).font('Helvetica-Bold').fillColor(BLUE).text(title, ML, curY);
        curY += 14;
        drawRow(hdrs, cols, hdrH, true);
        for (const row of rows) {
          if (curY + rh > PAGE_H - MB - 15) {
            newPage();
            drawRow(hdrs, cols, hdrH, true);
          }
          drawRow(row, cols, rh, false);
        }
        curY += 12;
      }

      newPage(true);

      const planCols = [115, 125, 150, 38, 55, 65, 70];
      drawTable(
        'Planes de Estudio',
        ['Facultad', 'Carrera', 'Plan de Estudios', 'Año', 'Versión', 'Estado', 'C.H. Total (hs)'],
        datos.map(p => [
          p.carrera.facultad?.nombre ?? '—',
          p.carrera.nombre,
          p.nombre,
          p.anio?.toString() ?? '—',
          p.version ?? '—',
          p.estado.replace('_', ' '),
          p.estadisticas.cargaHorariaTotal > 0
            ? `${p.estadisticas.cargaHorariaTotal.toLocaleString('es-AR')} hs` : '—',
        ]),
        planCols,
      );

      const bloqueRows: string[][] = [];
      datos.forEach(p =>
        p.estadisticas.distribBloque.forEach(b =>
          bloqueRows.push([
            p.nombre,
            b.bloque,
            String(b.cantidad),
            b.cargaHoraria > 0 ? `${b.cargaHoraria.toLocaleString('es-AR')} hs` : '0 hs',
            `${b.porcentaje.toFixed(1)}%`,
          ]),
        ),
      );

      if (bloqueRows.length > 0) {
        drawTable(
          'Distribución de Carga Horaria por Bloque',
          ['Plan de Estudios', 'Bloque', 'Asignaturas', 'Carga Horaria', 'Porcentaje'],
          bloqueRows,
          [200, 110, 75, 90, 85],
        );
      }

      drawFooter(); // footer for last page
      doc.end();
    });
  }

  async crear(dto: CrearPlanDto) {
    const carrera = await this.prisma.carrera.findUnique({
      where: { id: dto.carreraId },
      include: { facultad: { select: { estado: true, nombre: true } } }
    });
    if (!carrera) throw new NotFoundException(`Carrera ${dto.carreraId} no encontrada`);
    if (carrera.facultad?.estado === 'INACTIVO') {
      throw new UnprocessableEntityException('No se puede realizar la operación porque la Facultad se encuentra inactiva.');
    }

    return this.prisma.planEstudio.create({
      data: { ...dto, estado: dto.estado ?? 'ACTIVO' },
      include: { carrera: true }
    });
  }

  async actualizar(id: string, dto: ActualizarPlanDto) {
    await this.obtenerPorId(id);
    return this.prisma.planEstudio.update({
      where: { id },
      data: dto,
      include: { carrera: true }
    });
  }

  async eliminar(id: string) {
    await this.obtenerPorId(id);
    return this.prisma.planEstudio.update({
      where: { id },
      data: { estado: 'INACTIVO' }
    });
  }
}
