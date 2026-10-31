import PDFDocument from 'pdfkit';
import type { SnapshotExport } from './exportaciones.types';
import type { AlertaBandeja } from '../alertas/alertas.dto';

// ── Paleta ─────────────────────────────────────────────────────────────────────
const C_PRIMARY = '#0f4c81';
const C_DARK    = '#1e293b';
const C_MID     = '#64748b';
const C_LIGHT   = '#94a3b8';
const C_BG_ALT  = '#f8fafc';
const C_ALTA    = '#b91c1c';
const C_MEDIA   = '#b45309';
const C_INF     = '#0369a1';
const C_OK      = '#15803d';

const MARGIN    = 50;
const PAGE_W    = 595.28;
const CONTENT_W = PAGE_W - MARGIN * 2;

const MAX_LIST_ITEMS = 15;

// ── Metadata de indicadores ────────────────────────────────────────────────────

const META_CARRERA: Array<[string, string]> = [
  ['ip01', 'IP-01 — Total docentes'],
  ['ip02', 'IP-02 — Docentes con formación de posgrado'],
  ['ip03', 'IP-03 — Materias con cobertura docente aprobada'],
  ['ip04', 'IP-04 — Docentes con actividad de investigación'],
  ['ip08', 'IP-08 — Relación profesores/auxiliares'],
  ['ip09', 'IP-09 — Completitud promedio de fichas docentes'],
  ['ip10', 'IP-10 / R-03 — Tope semanal de horas'],
  ['ip13', 'IP-13 — Docentes sobreasignados'],
  ['r10',  'R-10 — Baja dedicación horaria'],
  ['r12',  'R-12 — Fichas docentes incompletas'],
];

const META_PLAN: Array<[string, string]> = [
  ['ipl01', 'IPL-01 — Carga horaria total del plan'],
  ['ipl02', 'IPL-02 — Bloques que cumplen su umbral mínimo'],
  ['ipl03', 'IPL-03 — Materias sin responsable de cátedra'],
  ['ipl04', 'IPL-04 — Pares materia/cátedra con múltiples responsables'],
  ['ipl05', 'IPL-05 — Horas por tipo de bloque curricular'],
  ['r11',   'R-11 — Inconsistencias en programas de asignatura'],
  ['r13',   'R-13 — Formación práctica (PPS / PI)'],
  ['r14',   'R-14 — Horas de formación práctica vs horas totales'],
];

const META_FACULTAD: Array<[string, string]> = [
  ['composicion',          'Composición del cuerpo docente'],
  ['formacion',            'Formación y titulación docente'],
  ['investigacion',        'Investigación y vinculación institucional'],
  ['dedicaciones',         'Dedicaciones horarias'],
  ['cargaAcademica',       'Carga académica'],
  ['distribucionMaterias', 'B-06 — Distribución de materias por docente (R-06)'],
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function fmtIndicador(obj: unknown): string {
  if (!obj || typeof obj !== 'object') return '—';
  const o = obj as Record<string, unknown>;
  if (typeof o['porcentaje'] === 'number')           return `${o['porcentaje'].toFixed(1)}%`;
  if (typeof o['completitudPromedio'] === 'number')  return `${o['completitudPromedio'].toFixed(1)}%`;
  if (typeof o['ratio'] === 'number')                return o['ratio'].toFixed(2);
  if (typeof o['cumple'] === 'boolean')              return o['cumple'] ? 'Cumple' : 'No cumple';
  if (typeof o['horasTotal'] === 'number')           return `${o['horasTotal']} h`;
  if (typeof o['totalSobreasignados'] === 'number')  return `${o['totalSobreasignados']} sobreasig.`;
  if (typeof o['alertasR03'] === 'number')           return `${o['alertasR03']} alertas`;
  if (typeof o['sinResponsable'] === 'number')       return `${o['sinResponsable']} sin resp.`;
  if (typeof o['totalIncompletos'] === 'number')     return `${o['totalIncompletos']} incompl.`;
  if (typeof o['totalEnAlerta'] === 'number')        return `${o['totalEnAlerta']} en alerta`;
  if (typeof o['paresConAlerta'] === 'number')       return `${o['paresConAlerta']} pares`;
  if (typeof o['cubiertas'] === 'number' && typeof o['total'] === 'number')
    return `${o['cubiertas']}/${o['total']}`;
  if (typeof o['bloquesCumplen'] === 'number' && typeof o['bloquesConUmbral'] === 'number')
    return `${o['bloquesCumplen']}/${o['bloquesConUmbral']}`;
  if (typeof o['tienePPS'] === 'boolean') {
    const partes: string[] = [];
    if (o['tienePPS']) partes.push('PPS');
    if (typeof o['tienePI'] === 'boolean' && o['tienePI']) partes.push('PI');
    return partes.length ? partes.join('+') : 'Sin práctica';
  }
  if (typeof o['totalConAlerta'] === 'number')        return `${o['totalConAlerta']} conflictos`;
  if (typeof o['totalInconsistencias'] === 'number')  return `${o['totalInconsistencias']} inconsistencias`;
  if (Array.isArray(o['bloques']))                    return `${(o['bloques'] as unknown[]).length} bloques`;
  return '—';
}

function estadoColor(estado: string | null | undefined): string {
  if (!estado) return C_LIGHT;
  if (estado === 'CALCULADO')       return C_OK;
  if (estado === 'PARCIAL')         return C_MEDIA;
  if (estado === 'NO_DETERMINABLE') return C_MID;
  if (estado === 'NO_APLICA')       return C_INF;
  return C_LIGHT;
}

function estadoBadgeBg(estado: string | null | undefined): string {
  if (!estado) return '#f1f5f9';
  if (estado === 'CALCULADO')       return '#dcfce7';
  if (estado === 'PARCIAL')         return '#fef9c3';
  if (estado === 'NO_DETERMINABLE') return '#f1f5f9';
  if (estado === 'NO_APLICA')       return '#e0f2fe';
  return '#f1f5f9';
}

function prioridadColor(p: string): string {
  if (p === 'ALTA')  return C_ALTA;
  if (p === 'MEDIA') return C_MEDIA;
  return C_INF;
}

function fmtNum(v: number | null | undefined, suffix = ''): string {
  if (v === null || v === undefined) return '—';
  return `${v}${suffix}`;
}

function fmtBool(v: boolean | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return v ? 'Cumple' : 'No cumple';
}

function addPageIfNeeded(doc: PDFKit.PDFDocument, neededHeight = 60): void {
  if (doc.y > doc.page.height - MARGIN - neededHeight) {
    doc.addPage();
  }
}

// ── Cabecera institucional ─────────────────────────────────────────────────────

function renderHeader(doc: PDFKit.PDFDocument, data: SnapshotExport, nombreInstitucion: string, logoDataUrl: string | null): void {
  // Primary blue bar (fixed 52 px)
  doc.rect(0, 0, PAGE_W, 52).fill(C_PRIMARY);

  // Logo institucional (derecha del encabezado)
  if (logoDataUrl) {
    try {
      const logoBuf = Buffer.from(logoDataUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      doc.image(logoBuf, PAGE_W - MARGIN - 50, 6, { fit: [46, 40] });
    } catch { /* logo inválido: ignorar */ }
  }

  // Left side: system name, institution name, subtitle
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(13)
    .text('UDEMM GLOBAL', MARGIN, 7, { lineBreak: false, width: CONTENT_W / 2 });
  doc.fillColor('#bfdbfe').font('Helvetica').fontSize(7)
    .text(nombreInstitucion, MARGIN, 21, { lineBreak: false, width: CONTENT_W / 2 });
  doc.fillColor('#ffffff').font('Helvetica').fontSize(8)
    .text('Autoevaluación Institucional', MARGIN, 34, { lineBreak: false, width: CONTENT_W / 2 });

  // Right half: date (width reduced to avoid logo overlap)
  const fechaStr = fmtFecha(data.fechaEjecucion);
  doc.fillColor('#ffffff').font('Helvetica').fontSize(8)
    .text(fechaStr, MARGIN + CONTENT_W / 2, 34, {
      lineBreak: false,
      width: CONTENT_W / 2 - 54,
      align: 'right',
    });

  // Dark info bar — one line per hierarchy level
  const subLines: Array<[string, string]> = [];
  if (data.facultadNombre) subLines.push(['FACULTAD', data.facultadNombre]);
  if (data.carreraNombre)  subLines.push(['CARRERA',  data.carreraNombre]);
  const ambitoLabel =
    data.ambito === 'FACULTAD' ? 'FACULTAD'
    : data.ambito === 'CARRERA' ? 'CARRERA'
    : 'PLAN DE ESTUDIOS';
  // Always add the main entity name at the bottom of the sub-header
  subLines.push([ambitoLabel, data.entidadNombre]);

  const lineH  = 17;
  const barH   = subLines.length * lineH + 8;
  doc.rect(0, 52, PAGE_W, barH).fill('#1e3a5f');

  const labelW = 110;
  let lineY    = 57;
  for (const [label, value] of subLines) {
    doc.fillColor('#93c5fd').font('Helvetica-Bold').fontSize(7.5)
      .text(`${label}:`, MARGIN, lineY, { lineBreak: false, width: labelW });
    doc.fillColor('#ffffff').font('Helvetica').fontSize(7.5)
      .text(value, MARGIN + labelW, lineY, { lineBreak: false, width: CONTENT_W - labelW });
    lineY += lineH;
  }

  doc.y = 52 + barH + 8;
}

// ── Bloque de metadatos (estado general + ID ejecución) ───────────────────────

function renderMetadata(doc: PDFKit.PDFDocument, data: SnapshotExport): void {
  const rectY = doc.y;  // save initial Y — all offsets are relative to this
  doc.rect(MARGIN, rectY, CONTENT_W, 36).fillAndStroke(C_BG_ALT, '#e2e8f0');
  const rowY = rectY + 6;
  const half = CONTENT_W / 2;

  doc.fillColor(C_MID).font('Helvetica').fontSize(7.5)
    .text('ESTADO GENERAL', MARGIN + 8, rowY, { lineBreak: false, width: half - 16 });
  const estadoText = data.estadoCalculo ?? 'SIN DATOS';
  doc.fillColor(estadoColor(data.estadoCalculo)).font('Helvetica-Bold').fontSize(8)
    .text(estadoText.replace(/_/g, ' '), MARGIN + 8, rowY + 11, { lineBreak: false, width: half - 16 });

  doc.fillColor(C_MID).font('Helvetica').fontSize(7.5)
    .text('ID DE EJECUCIÓN', MARGIN + half, rowY, { lineBreak: false, width: half - 8 });
  doc.fillColor(C_DARK).font('Helvetica').fontSize(7.5)
    .text(data.ejecucionId, MARGIN + half, rowY + 11, { lineBreak: false, width: half - 8 });

  doc.y = rectY + 44;  // fixed offset — independent of text render side effects
}

// ── Títulos de sección / subsección ───────────────────────────────────────────

function renderSectionTitle(doc: PDFKit.PDFDocument, title: string): void {
  addPageIfNeeded(doc, 40);
  doc.moveDown(0.6);
  doc.fillColor(C_PRIMARY).font('Helvetica-Bold').fontSize(9)
    .text(title.toUpperCase(), MARGIN);
  doc.moveTo(MARGIN, doc.y + 2).lineTo(MARGIN + CONTENT_W, doc.y + 2)
    .strokeColor('#cbd5e1').lineWidth(0.5).stroke();
  doc.y += 6;
}

function renderSubsectionTitle(doc: PDFKit.PDFDocument, title: string): void {
  addPageIfNeeded(doc, 35);
  doc.moveDown(0.5);
  doc.fillColor(C_PRIMARY).font('Helvetica-Bold').fontSize(8.5)
    .text(title, MARGIN);
  doc.moveTo(MARGIN, doc.y + 1).lineTo(MARGIN + CONTENT_W, doc.y + 1)
    .strokeColor('#dde6f0').lineWidth(0.4).stroke();
  doc.y += 5;
}

// ── Tabla de resumen de indicadores (compacta) ────────────────────────────────

function renderIndicadorRow(
  doc: PDFKit.PDFDocument,
  code: string,
  nombre: string,
  estado: string | null | undefined,
  valor: string,
): void {
  addPageIfNeeded(doc, 30);
  const y = doc.y;
  doc.fillColor(C_PRIMARY).font('Helvetica-Bold').fontSize(7.5)
    .text(`[${code.toUpperCase()}]`, MARGIN, y, { lineBreak: false, width: 70 });
  doc.fillColor(C_DARK).font('Helvetica').fontSize(7.5)
    .text(nombre, MARGIN + 72, y, { lineBreak: false, width: 250 });
  const estadoStr = (estado ?? '—').replace(/_/g, ' ');
  doc.fillColor(estadoColor(estado)).font('Helvetica-Bold').fontSize(7.5)
    .text(estadoStr, MARGIN + 325, y, { lineBreak: false, width: 100 });
  doc.fillColor(C_MID).font('Helvetica').fontSize(7.5)
    .text(valor, MARGIN + 428, y, { lineBreak: false, width: 67 });
  doc.y = Math.max(doc.y, y + 12);
  doc.moveDown(0.1);
}

function renderIndicadores(
  doc: PDFKit.PDFDocument,
  snapshot: Record<string, unknown>,
  meta: Array<[string, string]>,
): void {
  renderSectionTitle(doc, 'Resumen de indicadores');

  // Column headers — all drawn at the same fixed headerY
  const headerY = doc.y;
  doc.fillColor(C_MID).font('Helvetica-Bold').fontSize(7)
    .text('CÓDIGO',      MARGIN,       headerY, { lineBreak: false, width: 70 });
  doc.text('DESCRIPCIÓN', MARGIN + 72,  headerY, { lineBreak: false, width: 250 });
  doc.text('ESTADO',      MARGIN + 325, headerY, { lineBreak: false, width: 100 });
  doc.text('VALOR',       MARGIN + 428, headerY, { lineBreak: false, width: 67 });
  doc.y = headerY + 11;
  doc.moveDown(0.4);

  for (const [key, nombre] of meta) {
    const ind = snapshot[key];
    if (!ind || typeof ind !== 'object') continue;
    const indObj = ind as Record<string, unknown>;
    const estado = indObj['estadoCalculo'] as string | undefined;
    renderIndicadorRow(doc, key, nombre, estado, fmtIndicador(ind));
  }
}

// ── Grid de métricas ──────────────────────────────────────────────────────────

interface MetricCell { label: string; value: string; highlight?: boolean }

function renderMetricGrid(doc: PDFKit.PDFDocument, cells: MetricCell[]): void {
  if (cells.length === 0) return;
  addPageIfNeeded(doc, 48);

  const nPerRow = cells.length <= 4 ? cells.length : 3;
  const rowH    = 36;

  for (let start = 0; start < cells.length; start += nPerRow) {
    const rowCells = cells.slice(start, start + nPerRow);
    const cellW    = CONTENT_W / rowCells.length;
    addPageIfNeeded(doc, rowH + 4);
    const rowY = doc.y;

    for (let i = 0; i < rowCells.length; i++) {
      const cell = rowCells[i];
      const x    = MARGIN + i * cellW;
      doc.rect(x, rowY, cellW - 2, rowH).fillAndStroke(C_BG_ALT, '#e2e8f0');
      doc.fillColor(C_MID).font('Helvetica').fontSize(7)
        .text(cell.label, x + 6, rowY + 5, { lineBreak: false, width: cellW - 14 });
      const valColor = cell.highlight ? C_ALTA : C_DARK;
      doc.fillColor(valColor).font('Helvetica-Bold').fontSize(9)
        .text(cell.value, x + 6, rowY + 18, { lineBreak: false, width: cellW - 14 });
    }
    doc.y = rowY + rowH + 3;
  }
}

// ── Mini-tabla con salto de página ────────────────────────────────────────────

interface MiniTableCol { header: string; key: string; width: number; align?: 'left'|'right'|'center' }

function renderMiniTable(
  doc: PDFKit.PDFDocument,
  cols: MiniTableCol[],
  rows: Record<string, string>[],
  maxRows = 20,
): void {
  if (rows.length === 0) return;

  const rowH    = 13;
  const totalW  = cols.reduce((s, c) => s + c.width, 0);
  const scaleF  = CONTENT_W / totalW;
  const sc      = cols.map(c => ({ ...c, width: c.width * scaleF }));

  const drawHeaderRow = (): void => {
    const hY = doc.y;
    doc.rect(MARGIN, hY, CONTENT_W, rowH).fill('#e2e8f0');
    let x = MARGIN;
    for (const col of sc) {
      doc.fillColor(C_MID).font('Helvetica-Bold').fontSize(6.5)
        .text(col.header, x + 3, hY + 3, {
          lineBreak: false, width: col.width - 6, align: col.align ?? 'left',
        });
      x += col.width;
    }
    doc.y = hY + rowH;
  };

  // Initial header — ensure at least 3 rows fit on the page before starting
  if (doc.y + rowH * 3 > doc.page.height - MARGIN) doc.addPage();
  drawHeaderRow();

  const display = rows.slice(0, maxRows);
  for (let ri = 0; ri < display.length; ri++) {
    // Page break: re-draw column headers on new page
    if (doc.y + rowH > doc.page.height - MARGIN) {
      doc.addPage();
      drawHeaderRow();
    }
    const rowY = doc.y;
    doc.rect(MARGIN, rowY, CONTENT_W, rowH).fill(ri % 2 === 0 ? '#ffffff' : C_BG_ALT);
    let x = MARGIN;
    for (const col of sc) {
      doc.fillColor(C_DARK).font('Helvetica').fontSize(6.5)
        .text(String(display[ri][col.key] ?? '—'), x + 3, rowY + 3, {
          lineBreak: false, width: col.width - 6, align: col.align ?? 'left',
        });
      x += col.width;
    }
    doc.y = rowY + rowH;
  }

  doc.y += 3;
  if (rows.length > maxRows) {
    addPageIfNeeded(doc, 14);
    doc.fillColor(C_MID).font('Helvetica').fontSize(6.5)
      .text(`…y ${rows.length - maxRows} registros más.`, MARGIN);
    doc.moveDown(0.3);
  }
}

// ── Lista compacta ────────────────────────────────────────────────────────────

function renderCompactList(doc: PDFKit.PDFDocument, items: string[], max = MAX_LIST_ITEMS): void {
  if (items.length === 0) return;
  const display = items.slice(0, max);
  for (const item of display) {
    addPageIfNeeded(doc, 14);
    const y = doc.y;
    doc.fillColor(C_MID).font('Helvetica').fontSize(7)
      .text('•', MARGIN + 8, y, { lineBreak: false, width: 10 });
    doc.fillColor(C_DARK).font('Helvetica').fontSize(7)
      .text(item, MARGIN + 20, y, { lineBreak: false, width: CONTENT_W - 20 });
    doc.y = Math.max(doc.y, y + 10);
  }
  if (items.length > max) {
    addPageIfNeeded(doc, 12);
    doc.fillColor(C_MID).font('Helvetica').fontSize(6.5)
      .text(`…y ${items.length - max} más.`, MARGIN + 20, doc.y);
    doc.moveDown(0.1);
  }
  doc.moveDown(0.2);
}

// ── Badge de estado ───────────────────────────────────────────────────────────

function renderEstadoBadge(doc: PDFKit.PDFDocument, estado: string | null | undefined): void {
  if (!estado) return;
  addPageIfNeeded(doc, 18);
  const label = estado.replace(/_/g, ' ');
  const color = estadoColor(estado);
  const bg    = estadoBadgeBg(estado);
  const y     = doc.y;
  doc.rect(MARGIN, y, 90, 13).fill(bg);
  doc.rect(MARGIN, y, 2, 13).fill(color);
  doc.fillColor(color).font('Helvetica-Bold').fontSize(7)
    .text(label, MARGIN + 6, y + 3, { lineBreak: false, width: 82 });
  doc.y = y + 16;
}

// ── Detalle IPL-01 ────────────────────────────────────────────────────────────

function renderDetailIPL01(doc: PDFKit.PDFDocument, snap: Record<string, unknown>): void {
  const d = snap['ipl01'] as Record<string, unknown> | undefined;
  if (!d) return;
  renderSubsectionTitle(doc, 'IPL-01 — Carga horaria total del plan');
  const horasTotal = d['horasTotal']   as number | null;
  const horasMin   = d['horasMinimas'] as number | null;
  const diferencia = d['diferencia']   as number | null;
  const cumple     = d['cumple']       as boolean | null;
  const estado     = d['estadoCalculo'] as string | undefined;
  renderMetricGrid(doc, [
    { label: 'Horas totales del plan',   value: fmtNum(horasTotal, ' h') },
    { label: 'Mínimo requerido (P-10)',  value: fmtNum(horasMin,  ' h') },
    {
      label: 'Diferencia',
      value: diferencia !== null
        ? `${diferencia >= 0 ? '+' : ''}${diferencia} h` : '—',
      highlight: diferencia !== null && diferencia < 0,
    },
    { label: 'Cumplimiento', value: fmtBool(cumple) },
  ]);
  renderEstadoBadge(doc, estado);
  doc.moveDown(0.2);
}

// ── Detalle IPL-02 ────────────────────────────────────────────────────────────

function renderDetailIPL02(doc: PDFKit.PDFDocument, snap: Record<string, unknown>): void {
  const d = snap['ipl02'] as Record<string, unknown> | undefined;
  if (!d) return;
  renderSubsectionTitle(doc, 'IPL-02 — Bloques que cumplen su umbral mínimo');
  renderMetricGrid(doc, [
    { label: 'Bloques que cumplen',          value: String(d['bloquesCumplen']   ?? '—') },
    { label: 'Bloques con umbral (P-11–14)', value: String(d['bloquesConUmbral'] ?? '—') },
  ]);
  renderEstadoBadge(doc, d['estadoCalculo'] as string | undefined);
  doc.moveDown(0.2);
}

// ── Detalle IPL-03 ────────────────────────────────────────────────────────────

function renderDetailIPL03(doc: PDFKit.PDFDocument, snap: Record<string, unknown>): void {
  const d = snap['ipl03'] as Record<string, unknown> | undefined;
  if (!d) return;
  renderSubsectionTitle(doc, 'IPL-03 — Materias sin responsable de cátedra');
  const sinResp   = d['sinResponsable'] as number;
  const inciertas = d['inciertas']      as number;
  renderMetricGrid(doc, [
    { label: 'Sin responsable',        value: String(sinResp   ?? '—'), highlight: (sinResp   ?? 0) > 0 },
    { label: 'Asignaciones inciertas', value: String(inciertas ?? '—') },
    { label: 'Con responsable',        value: String(d['conResponsable'] ?? '—') },
    { label: 'Total materias',         value: String(d['totalMaterias']  ?? '—') },
  ]);
  if ((inciertas ?? 0) > 0) {
    addPageIfNeeded(doc, 18);
    doc.fillColor(C_MEDIA).font('Helvetica').fontSize(7)
      .text(
        `${inciertas} materia${inciertas !== 1 ? 's' : ''} con vinculación APROBADA y esResponsableCatedra sin clasificar.`,
        MARGIN, doc.y, { width: CONTENT_W },
      );
    doc.moveDown(0.3);
  }
  renderEstadoBadge(doc, d['estadoCalculo'] as string | undefined);
  doc.moveDown(0.2);
}

// ── Detalle IPL-04 ────────────────────────────────────────────────────────────

function renderDetailIPL04(doc: PDFKit.PDFDocument, snap: Record<string, unknown>): void {
  const d = snap['ipl04'] as Record<string, unknown> | undefined;
  if (!d) return;
  renderSubsectionTitle(doc, 'IPL-04 — Pares materia/cátedra con múltiples responsables');
  renderMetricGrid(doc, [
    { label: 'Pares con alerta',  value: String(d['paresConAlerta']  ?? '—'), highlight: ((d['paresConAlerta'] as number) ?? 0) > 0 },
    { label: 'Pares inciertos',   value: String(d['paresInciertos']  ?? '—') },
    { label: 'Total materias',    value: String(d['totalMaterias']   ?? '—') },
  ]);
  renderEstadoBadge(doc, d['estadoCalculo'] as string | undefined);
  doc.moveDown(0.2);
}

// ── Detalle IPL-05 ────────────────────────────────────────────────────────────

function renderDetailIPL05(doc: PDFKit.PDFDocument, snap: Record<string, unknown>): void {
  const d = snap['ipl05'] as Record<string, unknown> | undefined;
  if (!d) return;
  renderSubsectionTitle(doc, 'IPL-05 — Horas por tipo de bloque curricular');
  const estado  = d['estadoCalculo'] as string | undefined;
  const bloques = d['bloques'] as Record<string, unknown>[] | undefined;
  if (!bloques || bloques.length === 0) {
    renderEstadoBadge(doc, estado);
    doc.moveDown(0.2);
    return;
  }
  const rows = bloques.map(b => ({
    bloque:     String(b['bloque']        ?? '—'),
    horasReales: b['horasReales']  !== null && b['horasReales']  !== undefined ? `${b['horasReales']} h`  : '—',
    horasMin:    b['horasMinimas'] !== null && b['horasMinimas'] !== undefined ? `${b['horasMinimas']} h` : '—',
    diferencia: b['diferencia'] !== null && b['diferencia'] !== undefined
      ? `${(b['diferencia'] as number) >= 0 ? '+' : ''}${b['diferencia']} h` : '—',
    cumple:  b['cumple'] === true ? 'Cumple' : b['cumple'] === false ? 'No cumple' : '—',
    estado:  String(b['estadoCalculo'] ?? '—').replace(/_/g, ' '),
  }));
  renderMiniTable(doc, [
    { header: 'Bloque',      key: 'bloque',     width: 55 },
    { header: 'Horas',       key: 'horasReales',width: 55, align: 'right' },
    { header: 'Mínimo',      key: 'horasMin',   width: 55, align: 'right' },
    { header: 'Diferencia',  key: 'diferencia', width: 65, align: 'right' },
    { header: 'Cumple',      key: 'cumple',     width: 55, align: 'center' },
    { header: 'Estado',      key: 'estado',     width: 100, align: 'center' },
  ], rows);
  renderEstadoBadge(doc, estado);
  doc.moveDown(0.2);
}

// ── Detalle R-11 ──────────────────────────────────────────────────────────────

function renderDetailR11(doc: PDFKit.PDFDocument, snap: Record<string, unknown>): void {
  const d = snap['r11'] as Record<string, unknown> | undefined;
  if (!d) return;
  renderSubsectionTitle(doc, 'R-11 — Inconsistencias en programas de asignatura');
  const totalSin  = d['totalSinPrograma']    as number;
  const totalInc  = d['totalInconsistencias'] as number;
  const totalAlta = d['totalAlta']            as number;
  renderMetricGrid(doc, [
    { label: 'Total materias',   value: String(d['totalMaterias']    ?? '—') },
    { label: 'Con programa',     value: String(d['totalConPrograma'] ?? '—') },
    { label: 'Sin programa',     value: String(totalSin  ?? '—'), highlight: (totalSin  ?? 0) > 0 },
    { label: 'Inconsistencias',  value: String(totalInc  ?? '—'), highlight: (totalInc  ?? 0) > 0 },
    { label: 'Prioridad Alta',   value: String(totalAlta ?? '—'), highlight: (totalAlta ?? 0) > 0 },
    { label: 'Prioridad Media',  value: String(d['totalMedia'] ?? '—') },
  ]);
  const inconsistencias = d['inconsistencias'] as Record<string, unknown>[] | undefined;
  if (inconsistencias && inconsistencias.length > 0) {
    addPageIfNeeded(doc, 20);
    doc.fillColor(C_MID).font('Helvetica-Bold').fontSize(7)
      .text('Materias con inconsistencias:', MARGIN, doc.y);
    doc.moveDown(0.2);
    renderMiniTable(doc, [
      { header: 'Código',     key: 'codigo',     width: 55 },
      { header: 'Materia',    key: 'nombre',     width: 180 },
      { header: 'Completas',  key: 'completas',  width: 55, align: 'right' },
      { header: 'Pendientes', key: 'pendientes', width: 55, align: 'right' },
      { header: 'Prioridad',  key: 'prioridad',  width: 60, align: 'center' },
    ], inconsistencias.map(i => ({
      codigo:     String(i['materiaCodigo']         ?? '—'),
      nombre:     String(i['materiaNombre']         ?? '—'),
      completas:  String(i['seccionesCompletas']    ?? '—'),
      pendientes: String(i['seccionesPendientes']   ?? '—'),
      prioridad:  String(i['prioridad']             ?? '—'),
    })));
  }
  const sinPrograma = d['sinPrograma'] as Record<string, unknown>[] | undefined;
  if (sinPrograma && sinPrograma.length > 0) {
    addPageIfNeeded(doc, 20);
    doc.fillColor(C_MID).font('Helvetica-Bold').fontSize(7)
      .text('Materias sin programa cargado:', MARGIN, doc.y);
    doc.moveDown(0.2);
    renderCompactList(doc, sinPrograma.map(m =>
      `[${m['materiaCodigo'] ?? '?'}] ${m['materiaNombre'] ?? '—'}`,
    ));
  }
  renderEstadoBadge(doc, d['estadoCalculo'] as string | undefined);
  doc.moveDown(0.2);
}

// ── Detalle R-13 ──────────────────────────────────────────────────────────────

function renderDetailR13(doc: PDFKit.PDFDocument, snap: Record<string, unknown>): void {
  const d = snap['r13'] as Record<string, unknown> | undefined;
  if (!d) return;
  renderSubsectionTitle(doc, 'R-13 — Formación práctica (PPS / PI)');
  const tienePPS = d['tienePPS'] as boolean;
  const tienePI  = d['tienePI']  as boolean;
  renderMetricGrid(doc, [
    { label: 'Total materias', value: String(d['totalMaterias'] ?? '—') },
    { label: 'Tiene PPS',      value: tienePPS === true ? 'Sí' : tienePPS === false ? 'No' : '—' },
    { label: 'Tiene PI',       value: tienePI  === true ? 'Sí' : tienePI  === false ? 'No' : '—' },
    { label: 'Horas PPS',      value: fmtNum(d['horasPPS'] as number | null, ' h') },
    { label: 'Horas PI',       value: fmtNum(d['horasPI']  as number | null, ' h') },
  ]);
  const porTipo = d['porTipo'] as Record<string, number> | undefined;
  if (porTipo && Object.keys(porTipo).length > 0) {
    addPageIfNeeded(doc, 20);
    doc.fillColor(C_MID).font('Helvetica-Bold').fontSize(7)
      .text('Distribución por tipo de asignatura:', MARGIN, doc.y);
    doc.moveDown(0.2);
    renderCompactList(doc, Object.entries(porTipo).map(([tipo, n]) => `${tipo}: ${n}`));
  }
  const materiasPPS = d['materiasPPS'] as Record<string, unknown>[] | undefined;
  if (materiasPPS && materiasPPS.length > 0) {
    addPageIfNeeded(doc, 20);
    doc.fillColor(C_MID).font('Helvetica-Bold').fontSize(7)
      .text('Materias PPS:', MARGIN, doc.y);
    doc.moveDown(0.2);
    renderCompactList(doc, materiasPPS.map(m => {
      const h = m['cargaHorariaTotal'] !== null && m['cargaHorariaTotal'] !== undefined ? ` — ${m['cargaHorariaTotal']} h` : '';
      return `[${m['codigo'] ?? '?'}] ${m['nombre'] ?? '—'}${h}`;
    }));
  }
  const materiasPI = d['materiasPI'] as Record<string, unknown>[] | undefined;
  if (materiasPI && materiasPI.length > 0) {
    addPageIfNeeded(doc, 20);
    doc.fillColor(C_MID).font('Helvetica-Bold').fontSize(7)
      .text('Materias PI:', MARGIN, doc.y);
    doc.moveDown(0.2);
    renderCompactList(doc, materiasPI.map(m => {
      const h = m['cargaHorariaTotal'] !== null && m['cargaHorariaTotal'] !== undefined ? ` — ${m['cargaHorariaTotal']} h` : '';
      return `[${m['codigo'] ?? '?'}] ${m['nombre'] ?? '—'}${h}`;
    }));
  }
  renderEstadoBadge(doc, d['estadoCalculo'] as string | undefined);
  doc.moveDown(0.2);
}

// ── Detalle R-14 ──────────────────────────────────────────────────────────────

function renderDetailR14(doc: PDFKit.PDFDocument, snap: Record<string, unknown>): void {
  const d = snap['r14'] as Record<string, unknown> | undefined;
  if (!d) return;
  renderSubsectionTitle(doc, 'R-14 — Horas de formación práctica vs. horas totales');
  const totalCon = d['totalConAlerta'] as number;
  renderMetricGrid(doc, [
    { label: 'Total materias', value: String(d['totalMaterias']  ?? '—') },
    { label: 'Evaluadas',      value: String(d['totalEvaluadas'] ?? '—') },
    { label: 'Con alerta',     value: String(totalCon ?? '—'), highlight: (totalCon ?? 0) > 0 },
    { label: 'Sin datos',      value: String(d['totalSinDatos']  ?? '—') },
  ]);
  const enAlerta = d['enAlerta'] as Record<string, unknown>[] | undefined;
  if (enAlerta && enAlerta.length > 0) {
    addPageIfNeeded(doc, 20);
    doc.fillColor(C_MID).font('Helvetica-Bold').fontSize(7)
      .text('Materias con conflicto:', MARGIN, doc.y);
    doc.moveDown(0.2);
    renderMiniTable(doc, [
      { header: 'Código',        key: 'codigo',  width: 55 },
      { header: 'Materia',       key: 'nombre',  width: 160 },
      { header: 'Hs. Formación', key: 'hsForm',  width: 65, align: 'right' },
      { header: 'Hs. Totales',   key: 'hsTotal', width: 65, align: 'right' },
      { header: 'Exceso',        key: 'exceso',  width: 55, align: 'right' },
    ], enAlerta.map(m => ({
      codigo:  String(m['materiaCodigo']          ?? '—'),
      nombre:  String(m['materiaNombre']          ?? '—'),
      hsForm:  m['horasFormacionPractica'] !== undefined ? `${m['horasFormacionPractica']} h` : '—',
      hsTotal: m['horasTotal']            !== undefined ? `${m['horasTotal']} h` : '—',
      exceso:  m['exceso']                !== undefined ? `${m['exceso']} h` : '—',
    })));
  }
  renderEstadoBadge(doc, d['estadoCalculo'] as string | undefined);
  doc.moveDown(0.2);
}

// ── Detalle CARRERA: helpers locales ─────────────────────────────────────────

const FICHA_LABELS: Record<string, string> = {
  personales:     'Datos personales',
  formacionGrado: 'Título de grado',
  areaDesempeno:  'Área disciplinar',
};

function renderAlcanceParcial(doc: PDFKit.PDFDocument, msg: string): void {
  addPageIfNeeded(doc, 20);
  doc.rect(MARGIN, doc.y, CONTENT_W, 14).fill('#fffbeb');
  const y = doc.y + 3;
  doc.fillColor(C_MEDIA).font('Helvetica').fontSize(7)
    .text(`⚠ ${msg}`, MARGIN + 6, y, { lineBreak: false, width: CONTENT_W - 12 });
  doc.y = Math.max(doc.y, y + 14);
  doc.moveDown(0.2);
}

// ── Detalle IP-04 ─────────────────────────────────────────────────────────────

function renderDetailIP04(doc: PDFKit.PDFDocument, snap: Record<string, unknown>): void {
  const d = snap['ip04'] as Record<string, unknown> | undefined;
  if (!d) return;
  renderSubsectionTitle(doc, 'IP-04 — Materias por docente');
  const mediana = d['mediana'] as number | null;
  const promedio = d['promedio'] as number | null;
  const maximo  = d['maximo']  as number | null;
  renderMetricGrid(doc, [
    { label: 'Mediana (mat./doc.)',  value: mediana  !== null ? mediana.toFixed(1)  : '—' },
    { label: 'Promedio (mat./doc.)', value: promedio !== null ? promedio.toFixed(1) : '—' },
    { label: 'Máximo',              value: maximo   !== null ? String(maximo)       : '—' },
    { label: 'Total docentes',      value: String(d['totalDocentes'] ?? '—') },
  ]);
  const distribucion = d['distribucion'] as Record<string, unknown>[] | undefined;
  if (distribucion && distribucion.length > 0) {
    addPageIfNeeded(doc, 20);
    doc.fillColor(C_MID).font('Helvetica-Bold').fontSize(7)
      .text('Distribución por docente:', MARGIN, doc.y);
    doc.moveDown(0.2);
    renderMiniTable(doc, [
      { header: 'Docente',  key: 'nombre',    width: 320 },
      { header: 'Materias', key: 'nMaterias', width: 80, align: 'right' },
    ], distribucion.map(d2 => ({
      nombre:    String(d2['nombre']    ?? '—'),
      nMaterias: String(d2['nMaterias'] ?? '—'),
    })), 25);
  }
  renderEstadoBadge(doc, d['estadoCalculo'] as string | undefined);
  doc.moveDown(0.2);
}

// ── Detalle IP-08 ─────────────────────────────────────────────────────────────

function renderDetailIP08(doc: PDFKit.PDFDocument, snap: Record<string, unknown>): void {
  const d = snap['ip08'] as Record<string, unknown> | undefined;
  if (!d) return;
  renderSubsectionTitle(doc, 'IP-08 — Relación profesores / auxiliares');
  const ratio = d['ratio'] as number | null;
  renderMetricGrid(doc, [
    { label: 'Profesores',           value: String(d['profesores'] ?? '—') },
    { label: 'Auxiliares',           value: String(d['auxiliares'] ?? '—') },
    { label: 'Ratio P/A',            value: ratio !== null ? ratio.toFixed(1) : 'Sin auxiliares' },
  ]);
  renderEstadoBadge(doc, d['estadoCalculo'] as string | undefined);
  doc.moveDown(0.2);
}

// ── Detalle IP-09 ─────────────────────────────────────────────────────────────

function renderDetailIP09(doc: PDFKit.PDFDocument, snap: Record<string, unknown>): void {
  const d = snap['ip09'] as Record<string, unknown> | undefined;
  if (!d) return;
  renderSubsectionTitle(doc, 'IP-09 — Completitud promedio del plantel');
  const pct = d['completitudPromedio'] as number | null;
  renderMetricGrid(doc, [
    { label: 'Completitud promedio', value: pct !== null ? `${pct}%` : '—' },
    { label: 'Docentes evaluados',   value: String(d['totalDocentes'] ?? '—') },
  ]);
  addPageIfNeeded(doc, 16);
  doc.fillColor(C_LIGHT).font('Helvetica').fontSize(6.5)
    .text(
      'C1 = datos personales  ·  C2 = título de grado  ·  C3 = área disciplinar  ·  C4 = cargo vigente.',
      MARGIN, doc.y, { width: CONTENT_W },
    );
  doc.moveDown(0.1);
  renderEstadoBadge(doc, d['estadoCalculo'] as string | undefined);
  doc.moveDown(0.2);
}

// ── Detalle IP-10 ─────────────────────────────────────────────────────────────

function renderDetailIP10(doc: PDFKit.PDFDocument, snap: Record<string, unknown>): void {
  const d = snap['ip10'] as Record<string, unknown> | undefined;
  if (!d) return;
  renderSubsectionTitle(doc, 'IP-10 — Consistencia del plantel docente');
  const puntaje = d['puntaje'] as number | undefined;
  renderMetricGrid(doc, [
    { label: 'Puntaje (sobre 100)',   value: puntaje !== undefined ? String(puntaje) : '—',
      highlight: puntaje !== undefined && puntaje < 50 },
    { label: 'Comp. A (alertas ALTA)', value: String(d['componenteA']           ?? '—'),
      highlight: ((d['componenteA'] as number) ?? 0) > 0 },
    { label: 'Comp. M (alertas MEDIA)', value: String(d['componenteM']          ?? '—'),
      highlight: ((d['componenteM'] as number) ?? 0) > 0 },
    { label: 'R-03 tope horario',      value: String(d['alertasR03']            ?? '—'),
      highlight: ((d['alertasR03'] as number) ?? 0) > 0 },
    { label: 'R-04 penalizables',      value: String(d['alertasR04Penalizables'] ?? '—') },
    { label: 'R-07 sobreasignados',    value: String(d['alertasR07']            ?? '—') },
  ]);
  addPageIfNeeded(doc, 16);
  doc.fillColor(C_LIGHT).font('Helvetica').fontSize(6.5)
    .text(
      'Fórmula: max(0, 100 − 25×A − 10×M).  A = alertas ALTA penalizables (R-03 + R-04).  M = alertas MEDIA (R-07).',
      MARGIN, doc.y, { width: CONTENT_W },
    );
  doc.moveDown(0.1);
  renderEstadoBadge(doc, d['estadoCalculo'] as string | undefined);
  doc.moveDown(0.2);
}

// ── Detalle IP-13 ─────────────────────────────────────────────────────────────

function renderDetailIP13(doc: PDFKit.PDFDocument, snap: Record<string, unknown>): void {
  const d = snap['ip13'] as Record<string, unknown> | undefined;
  if (!d) return;
  renderSubsectionTitle(doc, 'IP-13 — Docentes sobreasignados');
  const alcance = d['alcanceFacultad'] as boolean | undefined;
  if (alcance === false) {
    renderAlcanceParcial(doc,
      'Alcance limitado a esta carrera. Pueden existir asignaciones fuera del alcance consultado.');
  }
  const noDet = d['totalNoDeterminables'] as number | undefined;
  if (typeof noDet === 'number' && noDet > 0 && alcance !== false) {
    renderAlcanceParcial(doc,
      `${noDet} docente(s) con asignaciones en otras facultades no pudieron evaluarse.`);
  }
  renderMetricGrid(doc, [
    { label: 'Sobreasignados',    value: String(d['totalSobreasignados'] ?? '—'),
      highlight: ((d['totalSobreasignados'] as number) ?? 0) > 0 },
    { label: 'Total docentes',    value: String(d['totalDocentes']        ?? '—') },
    { label: 'Límite P-03',       value: d['limite'] !== null && d['limite'] !== undefined ? String(d['limite']) : 'No configurado' },
    { label: 'No determinables',  value: String(d['totalNoDeterminables'] ?? '—') },
  ]);
  const sobreasignados = d['sobreasignados'] as Record<string, unknown>[] | undefined;
  if (sobreasignados && sobreasignados.length > 0) {
    addPageIfNeeded(doc, 20);
    doc.fillColor(C_MID).font('Helvetica-Bold').fontSize(7)
      .text('Docentes con exceso de asignaciones:', MARGIN, doc.y);
    doc.moveDown(0.2);
    renderMiniTable(doc, [
      { header: 'Docente',  key: 'nombre',    width: 300 },
      { header: 'Materias', key: 'nMaterias', width: 70, align: 'right' },
      { header: 'Exceso',   key: 'exceso',    width: 80, align: 'right' },
    ], sobreasignados.map(s => ({
      nombre:    String(s['nombre']    ?? '—'),
      nMaterias: String(s['nMaterias'] ?? '—'),
      exceso:    s['exceso'] !== undefined ? `+${s['exceso']}` : '—',
    })));
  }
  renderEstadoBadge(doc, d['estadoCalculo'] as string | undefined);
  doc.moveDown(0.2);
}

// ── Detalle R-10 ──────────────────────────────────────────────────────────────

function renderDetailR10(doc: PDFKit.PDFDocument, snap: Record<string, unknown>): void {
  const d = snap['r10'] as Record<string, unknown> | undefined;
  if (!d) return;
  renderSubsectionTitle(doc, 'R-10 — Docentes con baja dedicación horaria');
  if (d['alcanceFacultad'] === false) {
    renderAlcanceParcial(doc,
      'Evaluación parcial — el Director de Carrera solo ve su carrera. Totales pueden estar subestimados.');
  }
  renderMetricGrid(doc, [
    { label: 'Total docentes', value: String(d['totalDocentes']   ?? '—') },
    { label: 'En alerta',      value: String(d['totalEnAlerta']   ?? '—'),
      highlight: ((d['totalEnAlerta'] as number) ?? 0) > 0 },
    { label: 'Inciertos',      value: String(d['totalInciertos']  ?? '—') },
    { label: 'Umbral P-02',    value: d['umbral'] !== undefined ? `${d['umbral']} h` : '—' },
  ]);
  const enAlerta = d['enAlerta'] as Record<string, unknown>[] | undefined;
  if (enAlerta && enAlerta.length > 0) {
    addPageIfNeeded(doc, 20);
    doc.fillColor(C_MID).font('Helvetica-Bold').fontSize(7)
      .text('Docentes en alerta:', MARGIN, doc.y);
    doc.moveDown(0.2);
    renderMiniTable(doc, [
      { header: 'Docente',       key: 'nombre',        width: 290 },
      { header: 'Hs. conocidas', key: 'horasConocidas',width: 85, align: 'right' },
      { header: 'Umbral',        key: 'umbral',         width: 75, align: 'right' },
    ], enAlerta.map(e => ({
      nombre:         String(e['nombre']        ?? '—'),
      horasConocidas: e['horasConocidas'] !== undefined ? `${e['horasConocidas']} h` : '—',
      umbral:         e['umbral']         !== undefined ? `${e['umbral']} h`         : '—',
    })));
  }
  renderEstadoBadge(doc, d['estadoCalculo'] as string | undefined);
  doc.moveDown(0.2);
}

// ── Detalle R-12 ──────────────────────────────────────────────────────────────

function renderDetailR12(doc: PDFKit.PDFDocument, snap: Record<string, unknown>): void {
  const d = snap['r12'] as Record<string, unknown> | undefined;
  if (!d) return;
  renderSubsectionTitle(doc, 'R-12 — Campos obligatorios en ficha docente');
  if (d['alcanceFacultad'] === false) {
    renderAlcanceParcial(doc,
      'Evaluación parcial — el Director de Carrera solo ve su carrera (PARCIAL).');
  }
  renderMetricGrid(doc, [
    { label: 'Total docentes',   value: String(d['totalDocentes']       ?? '—') },
    { label: 'Fichas incompletas', value: String(d['totalIncompletos']  ?? '—'),
      highlight: ((d['totalIncompletos'] as number) ?? 0) > 0 },
    { label: 'No determinables', value: String(d['totalNoDeterminables'] ?? '—') },
  ]);
  const noDet = d['noDeterminables'] as Record<string, unknown>[] | undefined;
  if (noDet && noDet.length > 0) {
    addPageIfNeeded(doc, 16);
    doc.fillColor(C_MID).font('Helvetica').fontSize(7)
      .text(
        `${noDet.length} docente(s) con asignaciones cross-facultad no pudieron evaluarse.`,
        MARGIN, doc.y, { width: CONTENT_W },
      );
    doc.moveDown(0.2);
  }
  const incompletos = d['incompletos'] as Record<string, unknown>[] | undefined;
  if (incompletos && incompletos.length > 0) {
    addPageIfNeeded(doc, 20);
    doc.fillColor(C_MID).font('Helvetica-Bold').fontSize(7)
      .text('Docentes con ficha incompleta:', MARGIN, doc.y);
    doc.moveDown(0.2);
    renderMiniTable(doc, [
      { header: 'Docente',           key: 'nombre',    width: 250 },
      { header: 'Campos faltantes',  key: 'faltantes', width: 200 },
    ], incompletos.map(i => {
      const raw = i['faltantes'];
      const arr = Array.isArray(raw) ? (raw as string[]) : [];
      return {
        nombre:    String(i['nombre'] ?? '—'),
        faltantes: arr.map(f => FICHA_LABELS[f] ?? f).join(', ') || '—',
      };
    }));
  }
  renderEstadoBadge(doc, d['estadoCalculo'] as string | undefined);
  doc.moveDown(0.2);
}

// ── Sección: detalle completo de carrera ──────────────────────────────────────

function renderDetalleCarrera(doc: PDFKit.PDFDocument, snapshot: Record<string, unknown>): void {
  renderSectionTitle(doc, 'Detalle de indicadores');
  renderDetailIP04(doc, snapshot);
  renderDetailIP08(doc, snapshot);
  renderDetailIP09(doc, snapshot);
  renderDetailIP10(doc, snapshot);
  renderDetailIP13(doc, snapshot);
  renderDetailR10(doc, snapshot);
  renderDetailR12(doc, snapshot);
}

// ── Sección: condiciones del plantel CONEAU ───────────────────────────────────

function renderCondicionesPlantell(doc: PDFKit.PDFDocument, snapshot: Record<string, unknown>): void {
  const cp = snapshot['condicionesPlantell'] as Record<string, unknown> | undefined;
  if (!cp) return;

  const total = (cp['totalDocentes'] as number) ?? 0;
  const pct   = (n: number | undefined): string =>
    total > 0 && typeof n === 'number' ? `${n} (${Math.round((n / total) * 100)}%)` : String(n ?? '—');

  renderSectionTitle(doc, 'Condiciones del plantel — CONEAU');

  renderMetricGrid(doc, [
    { label: 'Con posgrado',             value: pct(cp['conPosgrado']           as number) },
    { label: 'Con investigación',        value: pct(cp['conInvestigacion']      as number) },
    { label: 'Con designación regular',  value: pct(cp['conDesignacionRegular'] as number) },
    { label: 'Con designación interina', value: pct(cp['conDesignacionInterina'] as number) },
    { label: 'Total docentes',           value: String(total) },
  ]);

  // Relación P/A
  const rPA = cp['relacionPA'] as Record<string, number> | undefined;
  if (rPA) {
    addPageIfNeeded(doc, 18);
    const ratio = rPA['auxiliares'] > 0
      ? `${(rPA['profesores'] / rPA['auxiliares']).toFixed(1)} : 1`
      : 'Sin auxiliares';
    const y = doc.y;
    doc.fillColor(C_MID).font('Helvetica-Bold').fontSize(7.5)
      .text('Relación P/A:', MARGIN, y, { lineBreak: false, width: 100 });
    doc.fillColor(C_DARK).font('Helvetica').fontSize(7.5)
      .text(`${ratio}  (${rPA['profesores']} profesores · ${rPA['auxiliares']} auxiliares)`,
        MARGIN + 102, y, { lineBreak: false, width: CONTENT_W - 102 });
    doc.y = Math.max(doc.y, y + 12);
    doc.moveDown(0.3);
  }

  // Distribución por categoría de designación
  const dedTipo = cp['dedicacionPorTipo'] as Record<string, unknown>[] | undefined;
  if (dedTipo && dedTipo.length > 0) {
    renderSubsectionTitle(doc, 'Distribución por categoría de designación');
    renderMiniTable(doc, [
      { header: 'Categoría', key: 'tipo',      width: 280 },
      { header: 'Docentes',  key: 'docentes',  width: 90, align: 'right' },
    ], dedTipo.map(item => ({
      tipo:     String(item['tipo']     ?? '—'),
      docentes: String(item['docentes'] ?? '—'),
    })));
  }

  // Dedicación CONEAU
  const dedConeau = cp['dedicacionConeau'] as Record<string, unknown>[] | undefined;
  if (dedConeau && dedConeau.length > 0) {
    renderSubsectionTitle(doc, 'Dedicación CONEAU');
    renderMiniTable(doc, [
      { header: 'Categoría CONEAU', key: 'categoria', width: 200 },
      { header: 'Docentes',         key: 'docentes',  width: 90, align: 'right' },
      { header: '% del plantel',    key: 'pctStr',    width: 110, align: 'right' },
    ], dedConeau.map(item => {
      const cat = String(item['categoria'] ?? '—');
      const n   = item['docentes'] as number ?? 0;
      return {
        categoria: cat === 'NO_DETERMINADA' ? 'No determinada'
          : cat.charAt(0) + cat.slice(1).toLowerCase(),
        docentes:  String(n),
        pctStr:    total > 0 ? `${Math.round((n / total) * 100)}%` : '—',
      };
    }));
  }

  // Nivel de posgrado CONEAU (D-06)
  const distPosgrado = cp['distribucionPosgrado'] as Record<string, unknown>[] | undefined;
  if (distPosgrado && distPosgrado.length > 0) {
    renderSubsectionTitle(doc, 'Nivel de posgrado CONEAU (D-06)');
    renderMiniTable(doc, [
      { header: 'Nivel',        key: 'tipo',     width: 200 },
      { header: 'Docentes',     key: 'docentes', width: 90, align: 'right' },
      { header: '% del plantel',key: 'pctStr',   width: 110, align: 'right' },
    ], distPosgrado.map(item => {
      const tipo = String(item['tipo'] ?? '—');
      const n    = item['docentes'] as number ?? 0;
      return {
        tipo:     tipo.charAt(0) + tipo.slice(1).toLowerCase(),
        docentes: String(n),
        pctStr:   total > 0 ? `${Math.round((n / total) * 100)}%` : '—',
      };
    }));
  }

  renderEstadoBadge(doc, cp['estadoCalculo'] as string | undefined);
  doc.moveDown(0.3);
}

// ── Detalle FACULTAD: B-01 Composición ───────────────────────────────────────

function renderFacB01(doc: PDFKit.PDFDocument, snap: Record<string, unknown>): void {
  const d = snap['composicion'] as Record<string, unknown> | undefined;
  if (!d) return;
  renderSubsectionTitle(doc, 'B-01 — Composición del cuerpo docente');
  renderMetricGrid(doc, [
    { label: 'Total docentes', value: String(d['totalDocentes']  ?? '—') },
    { label: 'Cargos P',       value: String(d['totalCargosP']   ?? '—') },
    { label: 'Cargos A',       value: String(d['totalCargosA']   ?? '—') },
    { label: 'Cargos Otros',   value: String(d['totalCargosOtros'] ?? '—') },
    { label: 'Total cargos',   value: String(d['totalCargos']    ?? '—') },
  ]);
  const porCarrera = d['porCarrera'] as Record<string, unknown>[] | undefined;
  if (porCarrera && porCarrera.length > 0) {
    addPageIfNeeded(doc, 20);
    doc.fillColor(C_MID).font('Helvetica-Bold').fontSize(7)
      .text('Distribución por carrera:', MARGIN, doc.y);
    doc.moveDown(0.2);
    renderMiniTable(doc, [
      { header: 'Carrera',  key: 'carreraNombre', width: 270 },
      { header: 'Docentes', key: 'totalDocentes', width: 80, align: 'right' },
      { header: 'Cargos',   key: 'totalCargos',   width: 80, align: 'right' },
    ], porCarrera.map(c => ({
      carreraNombre: String(c['carreraNombre'] ?? '—'),
      totalDocentes: String(c['totalDocentes'] ?? '—'),
      totalCargos:   String(c['totalCargos']   ?? '—'),
    })));
  }
  renderEstadoBadge(doc, d['estadoCalculo'] as string | undefined);
  doc.moveDown(0.2);
}

// ── Detalle FACULTAD: B-02 Formación ─────────────────────────────────────────

function renderFacB02(doc: PDFKit.PDFDocument, snap: Record<string, unknown>): void {
  const d = snap['formacion'] as Record<string, unknown> | undefined;
  if (!d) return;
  renderSubsectionTitle(doc, 'B-02 — Formación y titulación docente');
  const pct = d['completitudPromedio'] as number | null;
  renderMetricGrid(doc, [
    { label: 'Total docentes',         value: String(d['totalDocentes']     ?? '—') },
    { label: 'Con título de grado',    value: String(d['conTituloGrado']    ?? '—') },
    { label: 'Sin título de grado',    value: String(d['sinTituloGrado']    ?? '—'),
      highlight: ((d['sinTituloGrado'] as number) ?? 0) > 0 },
    { label: 'Con título de posgrado', value: String(d['conTituloPosgrado'] ?? '—') },
    { label: 'Sin título de posgrado', value: String(d['sinTituloPosgrado'] ?? '—') },
    { label: 'Completitud promedio',   value: pct !== null && pct !== undefined ? `${pct.toFixed(1)}%` : '—' },
  ]);
  renderEstadoBadge(doc, d['estadoCalculo'] as string | undefined);
  doc.moveDown(0.2);
}

// ── Detalle FACULTAD: B-03 Investigación ─────────────────────────────────────

function renderFacB03(doc: PDFKit.PDFDocument, snap: Record<string, unknown>): void {
  const d = snap['investigacion'] as Record<string, unknown> | undefined;
  if (!d) return;
  renderSubsectionTitle(doc, 'B-03 — Investigación y vinculación institucional');
  const sinNinguna = d['sinNinguna'] as number | undefined;
  renderMetricGrid(doc, [
    { label: 'Total docentes',          value: String(d['totalDocentes']            ?? '—') },
    { label: 'Con proyecto investig.',  value: String(d['conProyectoInvestigacion'] ?? '—') },
    { label: 'Con actividad extensión', value: String(d['conActividadExtension']    ?? '—') },
    { label: 'Con ambas actividades',   value: String(d['conAmbasActividades']      ?? '—') },
    { label: 'Sin ninguna actividad',   value: String(sinNinguna ?? '—'),
      highlight: (sinNinguna ?? 0) > 0 },
  ]);
  renderEstadoBadge(doc, d['estadoCalculo'] as string | undefined);
  doc.moveDown(0.2);
}

// ── Detalle FACULTAD: B-04 Dedicaciones ──────────────────────────────────────

function renderFacB04(doc: PDFKit.PDFDocument, snap: Record<string, unknown>): void {
  const d = snap['dedicaciones'] as Record<string, unknown> | undefined;
  if (!d) return;
  renderSubsectionTitle(doc, 'B-04 — Dedicaciones horarias (P-02)');
  const umbral = d['umbral'] as number | undefined;
  renderMetricGrid(doc, [
    { label: 'Total docentes',  value: String(d['totalDocentes']      ?? '—') },
    { label: 'Umbral P-02',     value: umbral !== undefined ? `${umbral} h` : 'No configurado' },
    { label: 'Baja dedicación', value: String(d['totalBajaDedicacion'] ?? '—'),
      highlight: ((d['totalBajaDedicacion'] as number) ?? 0) > 0 },
    { label: 'Sin datos',       value: String(d['totalSinDatos']      ?? '—') },
  ]);
  const enAlerta = d['enAlerta'] as Record<string, unknown>[] | undefined;
  if (enAlerta && enAlerta.length > 0) {
    addPageIfNeeded(doc, 20);
    doc.fillColor(C_MID).font('Helvetica-Bold').fontSize(7)
      .text('Docentes con baja dedicación:', MARGIN, doc.y);
    doc.moveDown(0.2);
    renderMiniTable(doc, [
      { header: 'Docente',       key: 'nombre',         width: 270 },
      { header: 'Hs. semanales', key: 'horasSemanales', width: 85, align: 'right' },
      { header: 'Motivo',        key: 'motivo',         width: 95 },
    ], enAlerta.map(e => ({
      nombre:         String(e['nombre']         ?? '—'),
      horasSemanales: e['horasSemanales'] !== undefined ? `${e['horasSemanales']} h` : '—',
      motivo:         String(e['motivo']         ?? '—'),
    })));
  }
  addPageIfNeeded(doc, 16);
  doc.fillColor(C_LIGHT).font('Helvetica').fontSize(6.5)
    .text(
      'Nota metodológica: las horas corresponden a la suma de cargos activos del período evaluado (P-02).',
      MARGIN, doc.y, { width: CONTENT_W },
    );
  doc.moveDown(0.1);
  renderEstadoBadge(doc, d['estadoCalculo'] as string | undefined);
  doc.moveDown(0.2);
}

// ── Detalle FACULTAD: B-05 Carga académica ───────────────────────────────────

function renderFacB05(doc: PDFKit.PDFDocument, snap: Record<string, unknown>): void {
  const d = snap['cargaAcademica'] as Record<string, unknown> | undefined;
  if (!d) return;
  renderSubsectionTitle(doc, 'B-05 — Carga académica (P-03)');
  const estado = d['estadoCalculo'] as string | undefined;
  if (estado === 'NO_DETERMINABLE') {
    addPageIfNeeded(doc, 22);
    const y = doc.y;
    doc.rect(MARGIN, y, CONTENT_W, 14).fill('#f1f5f9');
    doc.fillColor(C_MID).font('Helvetica').fontSize(7)
      .text(
        'No determinable: el parámetro P-03 (límite máximo de materias) no está configurado para esta facultad.',
        MARGIN + 6, y + 3, { lineBreak: false, width: CONTENT_W - 12 },
      );
    doc.y = Math.max(doc.y, y + 16);
    doc.moveDown(0.3);
    renderEstadoBadge(doc, estado);
    doc.moveDown(0.2);
    return;
  }
  const limite = d['limiteMaxMat'] as number | null;
  renderMetricGrid(doc, [
    { label: 'Total docentes', value: String(d['totalDocentes']      ?? '—') },
    { label: 'Límite P-03',    value: limite !== null && limite !== undefined ? String(limite) : 'No configurado' },
    { label: 'Sobreasignados', value: String(d['totalSobreasignados'] ?? '—'),
      highlight: ((d['totalSobreasignados'] as number) ?? 0) > 0 },
  ]);
  const sobreasignados = d['sobreasignados'] as Record<string, unknown>[] | undefined;
  if (sobreasignados && sobreasignados.length > 0) {
    addPageIfNeeded(doc, 20);
    doc.fillColor(C_MID).font('Helvetica-Bold').fontSize(7)
      .text('Docentes sobreasignados:', MARGIN, doc.y);
    doc.moveDown(0.2);
    renderMiniTable(doc, [
      { header: 'Docente',  key: 'nombre',    width: 300 },
      { header: 'Materias', key: 'nMaterias', width: 70, align: 'right' },
      { header: 'Exceso',   key: 'exceso',    width: 80, align: 'right' },
    ], sobreasignados.map(s => ({
      nombre:    String(s['nombre']    ?? '—'),
      nMaterias: String(s['nMaterias'] ?? '—'),
      exceso:    s['exceso'] !== undefined ? `+${s['exceso']}` : '—',
    })));
  }
  renderEstadoBadge(doc, estado);
  doc.moveDown(0.2);
}

// ── Detalle FACULTAD: B-06 Distribución de materias ──────────────────────────

function renderFacB06(doc: PDFKit.PDFDocument, snap: Record<string, unknown>): void {
  const d = snap['distribucionMaterias'] as Record<string, unknown> | undefined;
  if (!d) {
    addPageIfNeeded(doc, 18);
    doc.fillColor(C_LIGHT).font('Helvetica').fontSize(7)
      .text(
        'B-06 — Distribución de materias: información no disponible en este período.',
        MARGIN, doc.y, { width: CONTENT_W },
      );
    doc.moveDown(0.3);
    return;
  }
  renderSubsectionTitle(doc, 'B-06 — Distribución de materias por docente (R-06)');
  const promedio = d['promedio'] as number | null;
  const mediana  = d['mediana']  as number | null;
  const maximo   = d['maximo']   as number | null;
  renderMetricGrid(doc, [
    { label: 'Total docentes', value: String(d['totalDocentes'] ?? '—') },
    { label: 'Promedio',       value: promedio !== null && promedio !== undefined ? promedio.toFixed(1) : '—' },
    { label: 'Mediana',        value: mediana  !== null && mediana  !== undefined ? mediana.toFixed(1)  : '—' },
    { label: 'Máximo',         value: maximo   !== null && maximo   !== undefined ? String(maximo)      : '—' },
  ]);
  const distribucion = d['distribucion'] as Record<string, unknown>[] | undefined;
  if (distribucion && distribucion.length > 0) {
    addPageIfNeeded(doc, 20);
    doc.fillColor(C_MID).font('Helvetica-Bold').fontSize(7)
      .text('Detalle por docente:', MARGIN, doc.y);
    doc.moveDown(0.2);
    renderMiniTable(doc, [
      { header: 'Docente',  key: 'nombre',    width: 320 },
      { header: 'Materias', key: 'nMaterias', width: 80, align: 'right' },
    ], distribucion.map(d2 => ({
      nombre:    String(d2['nombre']    ?? '—'),
      nMaterias: String(d2['nMaterias'] ?? '0'),
    })), 25);
  }
  renderEstadoBadge(doc, d['estadoCalculo'] as string | undefined);
  doc.moveDown(0.2);
}

// ── Sección: detalle completo de facultad ────────────────────────────────────

function renderDetalleFacultad(doc: PDFKit.PDFDocument, snapshot: Record<string, unknown>): void {
  renderSectionTitle(doc, 'Detalle por bloque');
  renderFacB01(doc, snapshot);
  renderFacB02(doc, snapshot);
  renderFacB03(doc, snapshot);
  renderFacB04(doc, snapshot);
  renderFacB05(doc, snapshot);
  renderFacB06(doc, snapshot);
}

// ── Sección: detalle completo del plan ────────────────────────────────────────

function renderDetallePlan(doc: PDFKit.PDFDocument, snapshot: Record<string, unknown>): void {
  renderSectionTitle(doc, 'Detalle de indicadores');
  renderDetailIPL01(doc, snapshot);
  renderDetailIPL02(doc, snapshot);
  renderDetailIPL03(doc, snapshot);
  renderDetailIPL04(doc, snapshot);
  renderDetailIPL05(doc, snapshot);
  renderDetailR11(doc, snapshot);
  renderDetailR13(doc, snapshot);
  renderDetailR14(doc, snapshot);
}

// ── Sección: advertencias ─────────────────────────────────────────────────────

function renderAdvertencias(doc: PDFKit.PDFDocument, snapshot: Record<string, unknown>): void {
  const advertencias = snapshot['advertencias'] as string[] | undefined;
  if (!advertencias || advertencias.length === 0) return;
  renderSectionTitle(doc, `Advertencias (${advertencias.length})`);
  for (const a of advertencias) {
    addPageIfNeeded(doc, 16);
    const y = doc.y;
    doc.fillColor(C_MEDIA).font('Helvetica').fontSize(7.5)
      .text('▲', MARGIN, y, { lineBreak: false, width: 14 });
    doc.fillColor(C_MEDIA).font('Helvetica').fontSize(7.5)
      .text(a, MARGIN + 16, y, { lineBreak: false, width: CONTENT_W - 16 });
    doc.y = Math.max(doc.y, y + 12);
    doc.moveDown(0.1);
  }
}

// ── Sección: datos faltantes ──────────────────────────────────────────────────

function renderDatosFaltantes(doc: PDFKit.PDFDocument, snapshot: Record<string, unknown>): void {
  const datosFaltantes = snapshot['datosFaltantes'] as
    Array<{ campo: string; descripcion?: string }> | undefined;
  if (!datosFaltantes || datosFaltantes.length === 0) return;
  renderSectionTitle(doc, `Datos faltantes (${datosFaltantes.length})`);
  for (const df of datosFaltantes) {
    addPageIfNeeded(doc, 16);
    const y = doc.y;
    doc.fillColor(C_MID).font('Helvetica-Bold').fontSize(7)
      .text(df.campo, MARGIN + 8, y, { lineBreak: false, width: 120 });
    if (df.descripcion) {
      doc.fillColor(C_MID).font('Helvetica').fontSize(7)
        .text(`— ${df.descripcion}`, MARGIN + 132, y, { lineBreak: false, width: CONTENT_W - 132 });
    }
    doc.y = Math.max(doc.y, y + 11);
    doc.moveDown(0.1);
  }
}

// ── Acción Requerida (ámbito CARRERA) ─────────────────────────────────────────

interface SubAR { total: number; docentes: { docenteId: string; nombre: string; incierto?: boolean }[] }
interface BajaAR extends SubAR { umbral: number; confirmados: number; inciertos: number }

function renderARSubrow(doc: PDFKit.PDFDocument, codigo: string, titulo: string, sub: SubAR): void {
  addPageIfNeeded(doc, 28);
  const y = doc.y;
  doc.fillColor(sub.total > 0 ? C_ALTA : C_OK).font('Helvetica-Bold').fontSize(7.5)
    .text(`[${codigo}]`, MARGIN, y, { lineBreak: false, width: 55 });
  doc.fillColor(C_DARK).font('Helvetica').fontSize(7.5)
    .text(titulo, MARGIN + 57, y, { lineBreak: false, width: 290 });
  doc.fillColor(sub.total > 0 ? C_ALTA : C_OK).font('Helvetica-Bold').fontSize(7.5)
    .text(`${sub.total} docente${sub.total !== 1 ? 's' : ''}`, MARGIN + 350, y, { lineBreak: false, width: 100 });
  doc.y = Math.max(doc.y, y + 12);

  if (sub.total > 0) {
    addPageIfNeeded(doc, 14);
    const names = sub.docentes.map(d => d.nombre).join(', ');
    doc.fillColor(C_MID).font('Helvetica').fontSize(6.5)
      .text(names, MARGIN + 57, doc.y, { width: CONTENT_W - 57, lineBreak: true });
    doc.moveDown(0.1);
  }
}

function renderAccionRequerida(doc: PDFKit.PDFDocument, snapshot: Record<string, unknown>): void {
  const ar = snapshot['accionRequerida'] as Record<string, unknown> | undefined;
  if (!ar) return;
  renderSectionTitle(doc, 'Acción Requerida');

  const conAlertasAltas       = ar['conAlertasAltas']       as SubAR | undefined;
  const sobreasignados        = ar['sobreasignados']        as SubAR | undefined;
  const sinActividadCurricular = ar['sinActividadCurricular'] as SubAR | undefined;
  const bajaDedicacion        = ar['bajaDedicacion']        as BajaAR | undefined;

  if (conAlertasAltas)       renderARSubrow(doc, 'AR-01', 'Con alertas altas (R-03 tope horario / IP-13 sobreasignados)', conAlertasAltas);
  if (sobreasignados)        renderARSubrow(doc, 'AR-02', 'Sobreasignados (nMaterias > P-03)', sobreasignados);
  if (sinActividadCurricular) renderARSubrow(doc, 'AR-03', 'Cargos sin actividad curricular (R-04)', sinActividadCurricular);

  if (bajaDedicacion) {
    addPageIfNeeded(doc, 28);
    const y = doc.y;
    const total = bajaDedicacion.total ?? 0;
    doc.fillColor(total > 0 ? C_MEDIA : C_OK).font('Helvetica-Bold').fontSize(7.5)
      .text('[AR-04]', MARGIN, y, { lineBreak: false, width: 55 });
    const umbralStr = typeof bajaDedicacion.umbral === 'number'
      ? ` (umbral ${bajaDedicacion.umbral}h)` : '';
    doc.fillColor(C_DARK).font('Helvetica').fontSize(7.5)
      .text(`Dedicación inferior al umbral P-02${umbralStr}`, MARGIN + 57, y, { lineBreak: false, width: 290 });
    const confirmados = bajaDedicacion.confirmados ?? 0;
    const inciertos   = bajaDedicacion.inciertos   ?? 0;
    const desglose    = `${total} (${confirmados} conf. + ${inciertos} inc.)`;
    doc.fillColor(total > 0 ? C_MEDIA : C_OK).font('Helvetica-Bold').fontSize(7.5)
      .text(desglose, MARGIN + 350, y, { lineBreak: false, width: 145 });
    doc.y = Math.max(doc.y, y + 12);
    if (total > 0) {
      addPageIfNeeded(doc, 14);
      const names = (bajaDedicacion.docentes ?? [])
        .map((d: { nombre: string; incierto?: boolean }) =>
          `${d.nombre}${d.incierto ? ' (inc.)' : ''}`)
        .join(', ');
      doc.fillColor(C_MID).font('Helvetica').fontSize(6.5)
        .text(names, MARGIN + 57, doc.y, { width: CONTENT_W - 57, lineBreak: true });
      doc.moveDown(0.1);
    }
  }
}

// ── Listado de docentes (ámbito CARRERA) ──────────────────────────────────────

function semaforoColor(semaforo: string | undefined): string {
  if (semaforo === 'VERDE')    return C_OK;
  if (semaforo === 'AMARILLO') return C_MEDIA;
  if (semaforo === 'ROJO')     return C_ALTA;
  return C_LIGHT;
}

function renderListadoHeader(doc: PDFKit.PDFDocument, y: number): void {
  doc.rect(MARGIN, y, CONTENT_W, 13).fill('#e2e8f0');
  doc.fillColor(C_MID).font('Helvetica-Bold').fontSize(6.5)
    .text('DOCENTE',    MARGIN + 2,   y + 3, { lineBreak: false, width: 145 })
    .text('MATERIAS',   MARGIN + 148, y + 3, { lineBreak: false, width: 35 })
    .text('HORAS/SEM',  MARGIN + 184, y + 3, { lineBreak: false, width: 45 })
    .text('FICHA',      MARGIN + 230, y + 3, { lineBreak: false, width: 30 })
    .text('ESTADO',     MARGIN + 261, y + 3, { lineBreak: false, width: 55 })
    .text('ALERTAS',    MARGIN + 317, y + 3, { lineBreak: false, width: CONTENT_W - 317 });
  doc.y = y + 15;
}

function renderListadoDocentes(doc: PDFKit.PDFDocument, snapshot: Record<string, unknown>): void {
  const ld = snapshot['listadoDocentes'] as Record<string, unknown> | undefined;
  renderSectionTitle(doc, 'Docentes del Plantel');
  if (!ld) {
    addPageIfNeeded(doc, 20);
    doc.fillColor(C_MID).font('Helvetica').fontSize(7.5)
      .text('Datos no disponibles en esta ejecución. Regenere el análisis para incluir el listado.', MARGIN);
    doc.moveDown(0.3);
    return;
  }
  const docentes = (ld['docentes'] ?? []) as Record<string, unknown>[];
  const estado   = (ld['estadoCalculo'] ?? '') as string;
  if (docentes.length === 0) {
    addPageIfNeeded(doc, 20);
    doc.fillColor(estadoColor(estado)).font('Helvetica-Bold').fontSize(7.5)
      .text(`Estado: ${estado.replace(/_/g, ' ')}`, MARGIN, doc.y, { lineBreak: false, width: 150 });
    doc.fillColor(C_MID).font('Helvetica').fontSize(7.5)
      .text('Sin docentes activos en la carrera.', MARGIN + 155, doc.y);
    doc.moveDown(0.3);
    return;
  }
  const dist = ld['distribucionSemaforos'] as Record<string, number> | undefined;
  if (dist && typeof dist['total'] === 'number' && dist['total'] > 0) {
    addPageIfNeeded(doc, 22);
    const dY = doc.y;
    doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(7)
      .text('Distribución del plantel:', MARGIN, dY, { lineBreak: false, width: 100 });
    const items: [string, string][] = [
      [`VERDE: ${dist['verde'] ?? 0}`,    C_OK],
      [`AMARILLO: ${dist['amarillo'] ?? 0}`, C_MEDIA],
      [`ROJO: ${dist['rojo'] ?? 0}`,      C_ALTA],
      [`Total: ${dist['total']}`,         C_PRIMARY],
    ];
    let xOff = MARGIN + 105;
    for (const [label, color] of items) {
      doc.fillColor(color).font('Helvetica-Bold').fontSize(7)
        .text(label, xOff, dY, { lineBreak: false, width: 65 });
      xOff += 68;
    }
    doc.moveDown(0.8);
  }
  addPageIfNeeded(doc, 40);
  renderListadoHeader(doc, doc.y);
  let lastHeaderPage = (doc as any)._pageBuffer?.length ?? 0;
  for (const d of docentes) {
    addPageIfNeeded(doc, 18);
    const currentPage = (doc as any)._pageBuffer?.length ?? 0;
    if (currentPage !== lastHeaderPage) {
      renderListadoHeader(doc, doc.y);
      lastHeaderPage = currentPage;
    }
    const y = doc.y;
    const alertas    = (d['alertas'] ?? {}) as Record<string, boolean>;
    const semaforo   = (d['semaforo'] ?? '') as string;
    const fichaScore = typeof d['fichaScore'] === 'number' ? d['fichaScore'] : '?';
    const horas      = typeof d['horasCarreraConocidas'] === 'number' ? d['horasCarreraConocidas'] : '?';
    const incompletas = d['tieneHorasIncompletas'] === true ? '+?' : '';
    const nMaterias  = typeof d['nMaterias'] === 'number' ? d['nMaterias'] : '?';
    const alertaBadges: string[] = [];
    if (alertas['altaTope'])           alertaBadges.push('R-03');
    if (alertas['altaSinActividad'])   alertaBadges.push('R-04');
    if (alertas['mediaSobreasignado']) alertaBadges.push('R-07');
    doc.fillColor(C_DARK).font('Helvetica').fontSize(6.5)
      .text(String(d['nombre'] ?? ''), MARGIN + 2, y, { lineBreak: false, width: 143 });
    doc.fillColor(C_MID).font('Helvetica').fontSize(6.5)
      .text(String(nMaterias), MARGIN + 148, y, { lineBreak: false, width: 33 });
    doc.fillColor(d['tieneHorasIncompletas'] ? C_MEDIA : C_MID).font('Helvetica').fontSize(6.5)
      .text(`${horas}h${incompletas}`, MARGIN + 184, y, { lineBreak: false, width: 43 });
    doc.fillColor(C_PRIMARY).font('Helvetica-Bold').fontSize(6.5)
      .text(`${fichaScore}/4`, MARGIN + 230, y, { lineBreak: false, width: 28 });
    doc.fillColor(semaforoColor(semaforo)).font('Helvetica-Bold').fontSize(6.5)
      .text(semaforo || '—', MARGIN + 261, y, { lineBreak: false, width: 53 });
    doc.fillColor(alertaBadges.length > 0 ? C_ALTA : C_OK).font('Helvetica').fontSize(6.5)
      .text(alertaBadges.length > 0 ? alertaBadges.join(' ') : '—',
        MARGIN + 317, y, { lineBreak: false, width: CONTENT_W - 317 });
    doc.y = Math.max(doc.y, y + 11);
  }
  doc.moveDown(0.3);
}

// ── Alertas ───────────────────────────────────────────────────────────────────

function renderAlertas(doc: PDFKit.PDFDocument, alertas: AlertaBandeja[]): void {
  if (alertas.length === 0) return;
  renderSectionTitle(doc, `Alertas vigentes (${alertas.length})`);
  for (const alerta of alertas) {
    addPageIfNeeded(doc, 30);
    const y = doc.y;
    const color = prioridadColor(alerta.prioridad);
    doc.fillColor(color).font('Helvetica-Bold').fontSize(7.5)
      .text(`[${alerta.prioridad}]`, MARGIN, y, { lineBreak: false, width: 75 });
    doc.fillColor(C_PRIMARY).font('Helvetica-Bold').fontSize(7.5)
      .text(alerta.regla, MARGIN + 77, y, { lineBreak: false, width: 65 });
    doc.fillColor(C_DARK).font('Helvetica').fontSize(7.5)
      .text(alerta.descripcion, MARGIN + 145, y, { lineBreak: false, width: CONTENT_W - 145 });
    doc.y = Math.max(doc.y, y + 12);
    doc.moveDown(0.1);
  }
}

// ── Pie de página ─────────────────────────────────────────────────────────────

function addFooters(doc: PDFKit.PDFDocument, ejecucionId: string): void {
  const pages = doc.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    doc.switchToPage(i);
    // footerY is below maxY (page.height - margin). Remove bottom margin so doc.text()
    // does not trigger addPage() when rendering in the bottom margin area.
    doc.page.margins.bottom = 0;
    const footerY = doc.page.height - 28;
    doc.moveTo(MARGIN, footerY).lineTo(PAGE_W - MARGIN, footerY)
      .strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    doc.fillColor(C_LIGHT).font('Helvetica').fontSize(7)
      .text(`UDEMM Global — Autoevaluación Institucional   |   ID: ${ejecucionId}`,
        MARGIN, footerY + 6, { lineBreak: false, width: CONTENT_W - 60 });
    doc.text(`Pág. ${i - pages.start + 1}/${pages.count}`, MARGIN, footerY + 6, {
      align: 'right', lineBreak: false,
    });
  }
}

// ── Exportaciones de metadatos (accesibles en tests) ──────────────────────────

export const metaCarreraLabels: ReadonlyArray<readonly [string, string]> = META_CARRERA;

// ── Exportación principal ──────────────────────────────────────────────────────

export async function generarPdfBuffer(
  data: SnapshotExport,
  nombreInstitucion = 'Universidad de la Marina Mercante',
  logoDataUrl: string | null = null,
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      margin: MARGIN,
      size: 'A4',
      bufferPages: true,
      info: {
        Title:   `Autoevaluación - ${data.ambito} - ${data.entidadNombre}`,
        Author:  'UDEMM Global',
        Subject: 'Reporte de Autoevaluación Institucional',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data',  (c: Buffer) => chunks.push(c));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      renderHeader(doc, data, nombreInstitucion, logoDataUrl);
      renderMetadata(doc, data);

      if (data.ambito === 'CARRERA') {
        renderIndicadores(doc, data.snapshot, META_CARRERA);
        renderDetalleCarrera(doc, data.snapshot);
        renderCondicionesPlantell(doc, data.snapshot);
        renderAccionRequerida(doc, data.snapshot);
        renderListadoDocentes(doc, data.snapshot);
      } else if (data.ambito === 'PLAN') {
        renderIndicadores(doc, data.snapshot, META_PLAN);
        renderDetallePlan(doc, data.snapshot);
        renderAdvertencias(doc, data.snapshot);
        renderDatosFaltantes(doc, data.snapshot);
      } else if (data.ambito === 'FACULTAD') {
        renderIndicadores(doc, data.snapshot, META_FACULTAD);
        renderDetalleFacultad(doc, data.snapshot);
      }

      renderAlertas(doc, data.alertas);
      addFooters(doc, data.ejecucionId);
    } catch (err) {
      reject(err);
      return;
    }

    doc.end();
  });
}
