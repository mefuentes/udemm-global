import PDFDocument from 'pdfkit';
import type { SnapshotExport } from './exportaciones.types';
import type { AlertaBandeja } from '../alertas/alertas.dto';

// ── Paleta ─────────────────────────────────────────────────────────────────────
const C_PRIMARY   = '#0f4c81';
const C_DARK      = '#1e293b';
const C_MID       = '#64748b';
const C_LIGHT     = '#94a3b8';
const C_BG_ALT    = '#f8fafc';
const C_ALTA      = '#b91c1c';
const C_MEDIA     = '#b45309';
const C_INF       = '#0369a1';
const C_OK        = '#15803d';

const MARGIN = 50;
const PAGE_W = 595.28;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ── Metadata de indicadores ────────────────────────────────────────────────────

const META_CARRERA: Array<[string, string]> = [
  ['ip01', 'IP-01 — Docentes con dedicación exclusiva o semi-exclusiva'],
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
  ['r13',   'R-13 — Formación práctica insuficiente (PPS / PI)'],
  ['r14',   'R-14 — Horas de formación práctica superiores a horas totales'],
];

const META_FACULTAD: Array<[string, string]> = [
  ['composicion',    'Composición del cuerpo docente'],
  ['formacion',      'Formación y titulación docente'],
  ['investigacion',  'Investigación y vinculación institucional'],
  ['dedicaciones',   'Dedicaciones horarias'],
  ['cargaAcademica', 'Carga académica'],
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
  // R13 — formación práctica: tienePPS + tienePI
  if (typeof o['tienePPS'] === 'boolean') {
    const partes: string[] = [];
    if (o['tienePPS']) partes.push('PPS');
    if (typeof o['tienePI'] === 'boolean' && o['tienePI']) partes.push('PI');
    return partes.length ? partes.join('+') : 'Sin práctica';
  }
  // R14 — horas sobrantes
  if (typeof o['totalConAlerta'] === 'number') return `${o['totalConAlerta']} conflictos`;
  // R11 — inconsistencias en programas
  if (typeof o['totalInconsistencias'] === 'number') return `${o['totalInconsistencias']} inconsistencias`;
  // IPL-05 — bloques curriculares
  if (Array.isArray(o['bloques'])) return `${(o['bloques'] as unknown[]).length} bloques`;
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

function prioridadColor(p: string): string {
  if (p === 'ALTA')      return C_ALTA;
  if (p === 'MEDIA')     return C_MEDIA;
  return C_INF;
}

function addPageIfNeeded(doc: PDFKit.PDFDocument, neededHeight = 60): void {
  if (doc.y > doc.page.height - MARGIN - neededHeight) {
    doc.addPage();
  }
}

// ── Renderizado ────────────────────────────────────────────────────────────────

function renderHeader(doc: PDFKit.PDFDocument, data: SnapshotExport): void {
  // Header bar
  doc.rect(0, 0, PAGE_W, 52).fill(C_PRIMARY);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(15)
    .text('UDEMM GLOBAL', MARGIN, 14, { lineBreak: false });
  doc.font('Helvetica').fontSize(9)
    .text('Autoevaluación Institucional', MARGIN, 31, { lineBreak: false });
  const fechaStr = fmtFecha(data.fechaEjecucion);
  doc.text(fechaStr, MARGIN, 31, { align: 'right', lineBreak: false });

  // Sub-header (ambito + entity)
  doc.rect(0, 52, PAGE_W, 26).fill('#1e3a5f');
  const ambitoLabel = data.ambito === 'FACULTAD' ? 'Facultad'
    : data.ambito === 'CARRERA' ? 'Carrera'
    : 'Plan de estudios';
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9)
    .text(`${ambitoLabel.toUpperCase()}: `, MARGIN, 61, { lineBreak: false, continued: true });
  doc.font('Helvetica').fontSize(9)
    .text(data.entidadNombre, { lineBreak: false });

  doc.y = 90;
}

function renderMetadata(doc: PDFKit.PDFDocument, data: SnapshotExport): void {
  doc.rect(MARGIN, doc.y, CONTENT_W, 36).fillAndStroke(C_BG_ALT, '#e2e8f0');
  const rowY = doc.y + 6;
  const half = CONTENT_W / 2;

  doc.fillColor(C_MID).font('Helvetica').fontSize(7.5)
    .text('ESTADO GENERAL', MARGIN + 8, rowY, { lineBreak: false });
  const estadoText = data.estadoCalculo ?? 'SIN DATOS';
  doc.fillColor(estadoColor(data.estadoCalculo)).font('Helvetica-Bold').fontSize(8)
    .text(estadoText.replace(/_/g, ' '), MARGIN + 8, rowY + 11, { lineBreak: false });

  doc.fillColor(C_MID).font('Helvetica').fontSize(7.5)
    .text('ID DE EJECUCIÓN', MARGIN + half, rowY, { lineBreak: false });
  doc.fillColor(C_DARK).font('Helvetica').fontSize(7.5)
    .text(data.ejecucionId, MARGIN + half, rowY + 11, { lineBreak: false });

  doc.y += 44;
}

function renderSectionTitle(doc: PDFKit.PDFDocument, title: string): void {
  addPageIfNeeded(doc, 40);
  doc.moveDown(0.6);
  doc.fillColor(C_PRIMARY).font('Helvetica-Bold').fontSize(9)
    .text(title.toUpperCase(), MARGIN);
  doc.moveTo(MARGIN, doc.y + 2).lineTo(MARGIN + CONTENT_W, doc.y + 2)
    .strokeColor('#cbd5e1').lineWidth(0.5).stroke();
  doc.y += 6;
}

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
  renderSectionTitle(doc, 'Indicadores');
  // Column headers
  doc.fillColor(C_MID).font('Helvetica-Bold').fontSize(7)
    .text('CÓDIGO', MARGIN, doc.y, { lineBreak: false, width: 70 });
  doc.text('NOMBRE', MARGIN + 72, doc.y, { lineBreak: false, width: 250 });
  doc.text('ESTADO', MARGIN + 325, doc.y, { lineBreak: false, width: 100 });
  doc.text('VALOR', MARGIN + 428, doc.y, { lineBreak: false, width: 67 });
  doc.moveDown(0.4);

  for (const [key, nombre] of meta) {
    const ind = snapshot[key];
    if (!ind || typeof ind !== 'object') continue;
    const indObj = ind as Record<string, unknown>;
    const estado = indObj['estadoCalculo'] as string | undefined;
    renderIndicadorRow(doc, key, nombre, estado, fmtIndicador(ind));
  }
}

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

function addFooters(doc: PDFKit.PDFDocument, ejecucionId: string): void {
  const pages = doc.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    doc.switchToPage(i);
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

// ── Exportación principal ──────────────────────────────────────────────────────

export async function generarPdfBuffer(data: SnapshotExport): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      margin: MARGIN,
      size: 'A4',
      bufferPages: true,
      info: {
        Title: `Autoevaluación - ${data.ambito} - ${data.entidadNombre}`,
        Author: 'UDEMM Global',
        Subject: 'Reporte de Autoevaluación Institucional',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      renderHeader(doc, data);
      renderMetadata(doc, data);

      if (data.ambito === 'CARRERA') {
        renderIndicadores(doc, data.snapshot, META_CARRERA);
      } else if (data.ambito === 'PLAN') {
        renderIndicadores(doc, data.snapshot, META_PLAN);
      } else if (data.ambito === 'FACULTAD') {
        renderIndicadores(doc, data.snapshot, META_FACULTAD);
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
