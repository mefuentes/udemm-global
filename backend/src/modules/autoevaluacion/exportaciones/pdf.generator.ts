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

// ── Acción requerida ──────────────────────────────────────────────────────────

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

  const conAlertasAltas      = ar['conAlertasAltas']      as SubAR | undefined;
  const sobreasignados       = ar['sobreasignados']       as SubAR | undefined;
  const sinActividadCurricular = ar['sinActividadCurricular'] as SubAR | undefined;
  const bajaDedicacion       = ar['bajaDedicacion']       as BajaAR | undefined;

  if (conAlertasAltas) {
    renderARSubrow(doc, 'AR-01', 'Con alertas altas (R-03 tope horario / IP-13 sobreasignados)',
      conAlertasAltas);
  }
  if (sobreasignados) {
    renderARSubrow(doc, 'AR-02', 'Sobreasignados (nMaterias > P-03)', sobreasignados);
  }
  if (sinActividadCurricular) {
    renderARSubrow(doc, 'AR-03', 'Cargos sin actividad curricular (R-04)', sinActividadCurricular);
  }
  if (bajaDedicacion) {
    addPageIfNeeded(doc, 28);
    const y = doc.y;
    const total = bajaDedicacion.total ?? 0;
    doc.fillColor(total > 0 ? C_MEDIA : C_OK).font('Helvetica-Bold').fontSize(7.5)
      .text('[AR-04]', MARGIN, y, { lineBreak: false, width: 55 });
    const umbralStr = typeof bajaDedicacion.umbral === 'number'
      ? ` (umbral ${bajaDedicacion.umbral}h)` : '';
    doc.fillColor(C_DARK).font('Helvetica').fontSize(7.5)
      .text(`Dedicación inferior al umbral P-02${umbralStr}`, MARGIN + 57, y,
        { lineBreak: false, width: 290 });
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

// ── Listado de docentes ───────────────────────────────────────────────────────

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

  // Distribución de semáforos (B-04) — presente en snapshots ≥ v2.1
  const dist = ld['distribucionSemaforos'] as Record<string, number> | undefined;
  if (dist && typeof dist['total'] === 'number' && dist['total'] > 0) {
    addPageIfNeeded(doc, 22);
    const dY = doc.y;
    doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(7)
      .text('Distribución del plantel:', MARGIN, dY, { lineBreak: false, width: 100 });
    const items: [string, string][] = [
      [`VERDE: ${dist['verde'] ?? 0}`, C_OK],
      [`AMARILLO: ${dist['amarillo'] ?? 0}`, C_MEDIA],
      [`ROJO: ${dist['rojo'] ?? 0}`, C_ALTA],
      [`Total: ${dist['total']}`, C_PRIMARY],
    ];
    let xOff = MARGIN + 105;
    for (const [label, color] of items) {
      doc.fillColor(color).font('Helvetica-Bold').fontSize(7)
        .text(label, xOff, dY, { lineBreak: false, width: 65 });
      xOff += 68;
    }
    doc.moveDown(0.8);
  }

  // Header + rows
  addPageIfNeeded(doc, 40);
  renderListadoHeader(doc, doc.y);

  let lastHeaderPage = (doc as any)._pageBuffer?.length ?? 0;

  for (const d of docentes) {
    addPageIfNeeded(doc, 18);

    // Repeat header on new page
    const currentPage = (doc as any)._pageBuffer?.length ?? 0;
    if (currentPage !== lastHeaderPage) {
      renderListadoHeader(doc, doc.y);
      lastHeaderPage = currentPage;
    }

    const y = doc.y;
    const alertas = (d['alertas'] ?? {}) as Record<string, boolean>;
    const semaforo = (d['semaforo'] ?? '') as string;
    const fichaScore = typeof d['fichaScore'] === 'number' ? d['fichaScore'] : '?';
    const horas      = typeof d['horasCarreraConocidas'] === 'number' ? d['horasCarreraConocidas'] : '?';
    const incompletas = d['tieneHorasIncompletas'] === true ? '+?' : '';
    const nMaterias  = typeof d['nMaterias'] === 'number' ? d['nMaterias'] : '?';

    // Alert badges (only non-informative)
    const alertaBadges: string[] = [];
    if (alertas['altaTope'])          alertaBadges.push('R-03');
    if (alertas['altaSinActividad'])  alertaBadges.push('R-04');
    if (alertas['mediaSobreasignado'])alertaBadges.push('R-07');

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

// ── Exportaciones de metadatos (accesibles en tests) ──────────────────────────

export const metaCarreraLabels: ReadonlyArray<readonly [string, string]> = META_CARRERA;

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
        renderAccionRequerida(doc, data.snapshot);
        renderListadoDocentes(doc, data.snapshot);
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
