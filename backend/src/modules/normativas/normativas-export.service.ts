import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';

export interface ExportOpts {
  tipoNombre:             string | null;
  usuarioNombre:          string | null;
  incluyeEliminadoFields: boolean;
  filtros: Record<string, string>;
  total: number;
}

function fmtFecha(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch {
    return String(iso);
  }
}

@Injectable()
export class NormativasExportService {

  // ── PDF ──────────────────────────────────────────────────────────────────────

  async generarPdf(data: any[], opts: ExportOpts): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size:          'A4',
        layout:        'landscape',
        margins:       { top: 35, bottom: 40, left: 40, right: 40 },
        bufferPages:   true,
        autoFirstPage: true,
        info: {
          Title:   'Repositorio de Normativas',
          Author:  'UDEMM Global',
          Creator: 'UDEMM Global',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data',  (c: Buffer) => chunks.push(c));
      doc.on('error', reject);
      doc.on('end', () => {
        // Añadir números de página al final
        const range = doc.bufferedPageRange();
        for (let i = 0; i < range.count; i++) {
          doc.switchToPage(range.start + i);
          doc.font('Helvetica').fontSize(7).fillColor('#9ca3af')
            .text(
              `Página ${i + 1} de ${range.count}`,
              40, doc.page.height - 22,
              { width: doc.page.width - 80, align: 'center' },
            );
        }
        doc.flushPages();
        resolve(Buffer.concat(chunks));
      });

      const PAGE_W   = doc.page.width;   // 841.89
      const L_MARGIN = 40;
      const TABLE_W  = PAGE_W - L_MARGIN * 2; // 761.89
      const PAGE_H   = doc.page.height;  // 595.28
      const B_LIMIT  = PAGE_H - 48;      // margen inferior + espacio para pie

      const CELL_PAD  = 5;
      const HDR_SIZE  = 8;
      const DATA_SIZE = 8;
      const ROW_MIN_H = 18;

      // ── Columnas ───────────────────────────────────────────────────────────
      const cols = opts.incluyeEliminadoFields
        ? [
            { label: 'TÍTULO',             width: 160 },
            { label: 'TIPO',               width: 78  },
            { label: 'ÁREA EMISORA',       width: 88  },
            { label: 'N° / AÑO',           width: 58  },
            { label: 'FECHA EMISIÓN',      width: 73  },
            { label: 'VIGENCIA',           width: 65  },
            { label: 'FECHA DE BAJA',      width: 78  },
            { label: 'MOTIVO DE BAJA',     width: 760 - 160 - 78 - 88 - 58 - 73 - 65 - 78 },
          ]
        : [
            { label: 'TÍTULO',        width: 255 },
            { label: 'TIPO',          width: 110 },
            { label: 'ÁREA EMISORA',  width: 125 },
            { label: 'N° / AÑO',     width: 78  },
            { label: 'FECHA EMISIÓN', width: 90  },
            { label: 'VIGENCIA',      width: 760 - 255 - 110 - 125 - 78 - 90 },
          ];

      // ── Dibujar encabezado de tabla ────────────────────────────────────────
      const drawTableHeader = (y: number): number => {
        const rh = ROW_MIN_H + 4;
        doc.rect(L_MARGIN, y, TABLE_W, rh).fill('#1b3a6b');
        let x = L_MARGIN;
        doc.font('Helvetica-Bold').fontSize(HDR_SIZE).fillColor('#ffffff');
        for (const col of cols) {
          doc.text(col.label, x + CELL_PAD, y + CELL_PAD, {
            width:    col.width - CELL_PAD * 2,
            lineBreak: false,
            ellipsis:  true,
          });
          x += col.width;
        }
        return rh;
      };

      // ── Calcular altura de celda ───────────────────────────────────────────
      const cellH = (text: string, colWidth: number): number => {
        if (!text || text === '—') return ROW_MIN_H;
        doc.font('Helvetica').fontSize(DATA_SIZE);
        const h = doc.heightOfString(text, {
          width:    colWidth - CELL_PAD * 2,
          lineBreak: true,
        });
        return Math.max(h + CELL_PAD * 2, ROW_MIN_H);
      };

      // ── Dibujar fila de datos ──────────────────────────────────────────────
      const drawDataRow = (row: string[], y: number, rowIdx: number): number => {
        const heights = row.map((txt, i) => cellH(txt, cols[i].width));
        const rh = Math.max(...heights);

        doc.rect(L_MARGIN, y, TABLE_W, rh)
          .fill(rowIdx % 2 === 0 ? '#f8fafc' : '#ffffff');

        doc.moveTo(L_MARGIN, y + rh)
          .lineTo(L_MARGIN + TABLE_W, y + rh)
          .strokeColor('#e2e8f0').lineWidth(0.4).stroke();

        let x = L_MARGIN;
        doc.font('Helvetica').fontSize(DATA_SIZE).fillColor('#374151');
        for (let i = 0; i < cols.length; i++) {
          doc.text(row[i] ?? '', x + CELL_PAD, y + CELL_PAD, {
            width:    cols[i].width - CELL_PAD * 2,
            height:   rh - CELL_PAD * 2,
            lineBreak: true,
          });
          x += cols[i].width;
        }

        return rh;
      };

      // ── Encabezado del documento ───────────────────────────────────────────
      let y = 35;

      doc.font('Helvetica-Bold').fontSize(13).fillColor('#1b3a6b')
        .text('UNIVERSIDAD DE LA MARINA MERCANTE', L_MARGIN, y, {
          width: TABLE_W, align: 'center',
        });
      y += 16;

      doc.font('Helvetica').fontSize(9.5).fillColor('#374151')
        .text('UDEMM GLOBAL', L_MARGIN, y, { width: TABLE_W, align: 'center' });
      y += 13;

      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#374151')
        .text(
          opts.tipoNombre
            ? `REPOSITORIO DE NORMATIVAS — ${opts.tipoNombre.toUpperCase()}`
            : 'REPOSITORIO DE NORMATIVAS',
          L_MARGIN, y, { width: TABLE_W, align: 'center' },
        );
      y += 12;

      // Línea separadora principal
      doc.moveTo(L_MARGIN, y).lineTo(L_MARGIN + TABLE_W, y)
        .strokeColor('#1b3a6b').lineWidth(1.5).stroke();
      y += 8;

      // Metadata
      const now  = new Date();
      const dStr = now.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const hStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

      doc.font('Helvetica').fontSize(7.5).fillColor('#6b7280');
      doc.text(`Generado el ${dStr} a las ${hStr}`, L_MARGIN, y);
      y += 11;

      if (opts.usuarioNombre) {
        doc.text(`Usuario: ${opts.usuarioNombre}`, L_MARGIN, y);
        y += 11;
      }

      doc.text(`Total de registros: ${opts.total}`, L_MARGIN, y);
      y += 11;

      // Filtros aplicados
      const filtrosTexto: string[] = [];
      if (opts.filtros.busqueda)                        filtrosTexto.push(`Búsqueda: "${opts.filtros.busqueda}"`);
      if (opts.filtros.areaEmisora)                     filtrosTexto.push(`Área: ${opts.filtros.areaEmisora}`);
      if (opts.filtros.vigencia)                        filtrosTexto.push(`Vigencia: ${opts.filtros.vigencia}`);
      if (opts.filtros.fechaDesde)                      filtrosTexto.push(`Desde: ${opts.filtros.fechaDesde}`);
      if (opts.filtros.fechaHasta)                      filtrosTexto.push(`Hasta: ${opts.filtros.fechaHasta}`);
      if (opts.filtros.estadoRegistro !== 'ACTIVAS')    filtrosTexto.push(`Estado: ${opts.filtros.estadoRegistro}`);

      if (filtrosTexto.length > 0) {
        const linea = `Filtros: ${filtrosTexto.join(' | ')}`;
        doc.text(linea, L_MARGIN, y, { width: TABLE_W });
        y += doc.heightOfString(linea, { width: TABLE_W }) + 4;
      }

      y += 8;

      // Línea antes de tabla
      doc.moveTo(L_MARGIN, y).lineTo(L_MARGIN + TABLE_W, y)
        .strokeColor('#e2e8f0').lineWidth(0.5).stroke();
      y += 8;

      // ── Tabla ──────────────────────────────────────────────────────────────
      if (data.length === 0) {
        doc.font('Helvetica').fontSize(9).fillColor('#6b7280')
          .text(
            'No se encontraron registros con los filtros aplicados.',
            L_MARGIN, y,
            { width: TABLE_W, align: 'center' },
          );
      } else {
        y += drawTableHeader(y);
        y += 1;

        for (let i = 0; i < data.length; i++) {
          const n = data[i];
          const row = opts.incluyeEliminadoFields
            ? [
                n.titulo ?? '',
                n.tipoNormativa?.nombre ?? '',
                n.areaEmisora ?? '',
                `${n.numeroNorma ?? ''} / ${n.anio ?? ''}`,
                fmtFecha(n.fechaEmision),
                n.vigencia ?? '',
                fmtFecha(n.fechaEliminacion),
                n.motivoEliminacion ?? '—',
              ]
            : [
                n.titulo ?? '',
                n.tipoNormativa?.nombre ?? '',
                n.areaEmisora ?? '',
                `${n.numeroNorma ?? ''} / ${n.anio ?? ''}`,
                fmtFecha(n.fechaEmision),
                n.vigencia ?? '',
              ];

          // Calcular altura antes de dibujar para detectar salto de página
          doc.font('Helvetica').fontSize(DATA_SIZE);
          const heights = row.map((txt, ci) => cellH(txt, cols[ci].width));
          const rh = Math.max(...heights);

          if (y + rh > B_LIMIT) {
            doc.addPage();
            y = 35;
            y += drawTableHeader(y);
            y += 1;
          }

          y += drawDataRow(row, y, i);
        }
      }

      doc.end();
    });
  }

  // ── Excel ─────────────────────────────────────────────────────────────────────

  async generarExcel(data: any[], opts: ExportOpts): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'UDEMM Global';
    wb.created = new Date();

    // Nombre de hoja: categoría si existe (max 31 chars por límite de Excel)
    const sheetName = opts.tipoNombre
      ? opts.tipoNombre.toUpperCase().slice(0, 31)
      : 'NORMATIVAS';

    const ws = wb.addWorksheet(sheetName, {
      pageSetup: {
        paperSize: 9,
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
      },
    });

    // ── Definición de columnas (solo anchos — no toca filas) ───────────────────
    const baseCols = [
      { header: 'TÍTULO',            width: 50 },
      { header: 'TIPO DE NORMATIVA', width: 25 },
      { header: 'ÁREA EMISORA',      width: 25 },
      { header: 'NÚMERO',            width: 12 },
      { header: 'AÑO',               width: 8  },
      { header: 'FECHA DE EMISIÓN',  width: 18 },
      { header: 'VIGENCIA',          width: 15 },
      { header: 'PALABRAS CLAVE',    width: 30 },
    ];

    const elimCols: { header: string; width: number }[] = opts.incluyeEliminadoFields
      ? [
          { header: 'FECHA DE ELIMINACIÓN',  width: 22 },
          { header: 'ELIMINADO POR',         width: 28 },
          { header: 'MOTIVO DE ELIMINACIÓN', width: 45 },
        ]
      : [];

    const allCols  = [...baseCols, ...elimCols];
    const nCols    = allCols.length;

    allCols.forEach((col, i) => { ws.getColumn(i + 1).width = col.width; });

    // ── Datos para la cabecera institucional ───────────────────────────────────
    const now  = new Date();
    const dStr = now.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    const filtrosTexto: string[] = [];
    if (opts.filtros.busqueda)    filtrosTexto.push(`BÚSQUEDA: "${opts.filtros.busqueda}"`);
    if (opts.filtros.areaEmisora) filtrosTexto.push(`ÁREA EMISORA: ${opts.filtros.areaEmisora}`);
    if (opts.filtros.vigencia)    filtrosTexto.push(`VIGENCIA: ${opts.filtros.vigencia}`);
    if (opts.filtros.fechaDesde)  filtrosTexto.push(`FECHA DESDE: ${opts.filtros.fechaDesde}`);
    if (opts.filtros.fechaHasta)  filtrosTexto.push(`FECHA HASTA: ${opts.filtros.fechaHasta}`);
    if (opts.filtros.estadoRegistro && opts.filtros.estadoRegistro !== 'ACTIVAS') {
      filtrosTexto.push(`ESTADO DEL REGISTRO: ${opts.filtros.estadoRegistro}`);
    }

    // ── Helpers de construcción de filas ───────────────────────────────────────
    let r = 0;
    const c1   = (row: number) => ws.getRow(row).getCell(1);
    const mrg  = (row: number) => ws.mergeCells(row, 1, row, nCols);
    const h    = (row: number, px: number) => { ws.getRow(row).height = px; };

    // ── Cabecera institucional ─────────────────────────────────────────────────

    // Fila 1 — Nombre de la universidad
    mrg(++r);
    c1(r).value     = 'UNIVERSIDAD DE LA MARINA MERCANTE';
    c1(r).font      = { bold: true, size: 14, color: { argb: 'FF1b3a6b' } };
    c1(r).alignment = { horizontal: 'center', vertical: 'middle' };
    h(r, 22);

    // Fila 2 — Plataforma
    mrg(++r);
    c1(r).value     = 'UDEMM GLOBAL';
    c1(r).font      = { size: 11, color: { argb: 'FF374151' } };
    c1(r).alignment = { horizontal: 'center', vertical: 'middle' };
    h(r, 16);

    // Fila 3 — Título del repositorio (borde inferior como separador visual)
    mrg(++r);
    c1(r).value     = opts.tipoNombre
      ? `REPOSITORIO DE NORMATIVAS — ${opts.tipoNombre.toUpperCase()}`
      : 'REPOSITORIO DE NORMATIVAS';
    c1(r).font      = { bold: true, size: 11, color: { argb: 'FF374151' } };
    c1(r).alignment = { horizontal: 'center', vertical: 'middle' };
    c1(r).border    = { bottom: { style: 'medium', color: { argb: 'FF1b3a6b' } } };
    h(r, 20);

    // Fila 4 — Fecha de generación
    mrg(++r);
    c1(r).value     = `FECHA DE GENERACIÓN: ${dStr}  ${hStr}`;
    c1(r).font      = { size: 9, color: { argb: 'FF6B7280' } };
    c1(r).alignment = { horizontal: 'left', vertical: 'middle' };
    h(r, 14);

    // Fila 5 — Usuario (si existe)
    if (opts.usuarioNombre) {
      mrg(++r);
      c1(r).value     = `USUARIO: ${opts.usuarioNombre}`;
      c1(r).font      = { size: 9, color: { argb: 'FF6B7280' } };
      c1(r).alignment = { horizontal: 'left', vertical: 'middle' };
      h(r, 14);
    }

    // Total de registros
    mrg(++r);
    c1(r).value     = `TOTAL DE REGISTROS: ${opts.total}`;
    c1(r).font      = { size: 9, color: { argb: 'FF6B7280' } };
    c1(r).alignment = { horizontal: 'left', vertical: 'middle' };
    h(r, 14);

    // Filtros aplicados
    const filtrosStr = filtrosTexto.length > 0 ? filtrosTexto.join('  |  ') : 'NINGUNO';
    mrg(++r);
    c1(r).value     = `FILTROS APLICADOS: ${filtrosStr}`;
    c1(r).font      = { size: 9, color: { argb: 'FF6B7280' } };
    c1(r).alignment = { horizontal: 'left', vertical: 'middle', wrapText: filtrosTexto.length > 2 };
    h(r, filtrosTexto.length > 2 ? 28 : 14);

    // Fila en blanco separadora
    h(++r, 6);

    // ── Encabezado de la tabla ─────────────────────────────────────────────────
    const TABLE_HDR = ++r;
    const hdrRow    = ws.getRow(TABLE_HDR);
    allCols.forEach((col, i) => { hdrRow.getCell(i + 1).value = col.header; });
    hdrRow.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    hdrRow.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4C81' } };
    hdrRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    hdrRow.height    = 24;
    for (let c = 1; c <= nCols; c++) {
      hdrRow.getCell(c).border = { bottom: { style: 'medium', color: { argb: 'FF1b3a6b' } } };
    }

    // ── Filas de datos ─────────────────────────────────────────────────────────
    const FIRST_DATA = r + 1;
    for (let i = 0; i < data.length; i++) {
      const n  = data[i];
      const dr = ws.getRow(++r);
      const vals: (string | number)[] = [
        n.titulo ?? '',
        n.tipoNormativa?.nombre ?? '',
        n.areaEmisora ?? '',
        n.numeroNorma ?? '',
        n.anio ?? '',
        fmtFecha(n.fechaEmision),
        n.vigencia ?? '',
        n.palabrasClave ?? '',
      ];
      if (opts.incluyeEliminadoFields) {
        vals.push(fmtFecha(n.fechaEliminacion));
        vals.push(n.eliminadoPorNombre ?? '');
        vals.push(n.motivoEliminacion ?? '');
      }
      vals.forEach((v, ci) => { dr.getCell(ci + 1).value = v; });
      dr.alignment = { vertical: 'top', wrapText: true };
      dr.font      = { size: 9 };
      if (i % 2 === 0) {
        dr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    }

    // ── Configuración final ────────────────────────────────────────────────────

    // Inmovilizar desde el encabezado de tabla
    ws.views = [{
      state:      'frozen',
      ySplit:     TABLE_HDR,
      xSplit:     0,
      activeCell: `A${FIRST_DATA}`,
    }];

    // Repetir fila de encabezado de tabla al imprimir
    ws.pageSetup.printTitlesRow = `${TABLE_HDR}:${TABLE_HDR}`;

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }
}
