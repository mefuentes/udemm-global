import ExcelJS from 'exceljs';
import type { SnapshotExport } from './exportaciones.types';

// ── Estilos ────────────────────────────────────────────────────────────────────

const STYLE_HEADER: Partial<ExcelJS.Style> = {
  font:      { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 },
  fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0f4c81' } },
  alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
  border: {
    bottom: { style: 'thin', color: { argb: 'FFcbd5e1' } },
  },
};

const STYLE_META_LABEL: Partial<ExcelJS.Style> = {
  font:      { bold: true, size: 9, color: { argb: 'FF64748b' } },
  fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf8fafc' } },
  alignment: { vertical: 'middle' },
};

const STYLE_META_VALUE: Partial<ExcelJS.Style> = {
  font:      { size: 9 },
  alignment: { vertical: 'middle' },
};

function prioridadFill(p: string): ExcelJS.Fill {
  const color = p === 'ALTA' ? 'FFFEE2E2' : p === 'MEDIA' ? 'FFFEF9C3' : 'FFE0F2FE';
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
}

function estadoFill(estado: string | null | undefined): ExcelJS.Fill {
  if (estado === 'CALCULADO')       return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFdcfce7' } };
  if (estado === 'PARCIAL')         return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFfef9c3' } };
  if (estado === 'NO_DETERMINABLE') return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf1f5f9' } };
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf0f9ff' } };
}

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
  if (typeof o['totalSobreasignados'] === 'number')  return `${o['totalSobreasignados']}`;
  if (typeof o['alertasR03'] === 'number')           return `${o['alertasR03']}`;
  if (typeof o['sinResponsable'] === 'number')       return `${o['sinResponsable']}`;
  if (typeof o['totalIncompletos'] === 'number')     return `${o['totalIncompletos']}`;
  if (typeof o['totalEnAlerta'] === 'number')        return `${o['totalEnAlerta']}`;
  if (typeof o['paresConAlerta'] === 'number')       return `${o['paresConAlerta']}`;
  if (typeof o['cubiertas'] === 'number' && typeof o['total'] === 'number')
    return `${o['cubiertas']} / ${o['total']}`;
  if (typeof o['bloquesCumplen'] === 'number' && typeof o['bloquesConUmbral'] === 'number')
    return `${o['bloquesCumplen']} / ${o['bloquesConUmbral']}`;
  // R13 — formación práctica
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

function metaPorAmbito(ambito: string): Array<[string, string]> {
  if (ambito === 'CARRERA')  return META_CARRERA;
  if (ambito === 'PLAN')     return META_PLAN;
  return META_FACULTAD;
}

// ── Hoja Resumen ───────────────────────────────────────────────────────────────

function buildHojaResumen(ws: ExcelJS.Worksheet, data: SnapshotExport): void {
  ws.columns = [
    { key: 'label', width: 22 },
    { key: 'value', width: 50 },
  ];

  // Title
  ws.mergeCells('A1:B1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'UDEMM Global — Autoevaluación Institucional';
  titleCell.style = {
    font: { bold: true, size: 13, color: { argb: 'FF0f4c81' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFe8f0fb' } },
  };
  ws.getRow(1).height = 24;
  ws.addRow([]);

  const ambitoLabel = data.ambito === 'FACULTAD' ? 'Facultad'
    : data.ambito === 'CARRERA' ? 'Carrera'
    : 'Plan de estudios';

  const metaRows: [string, string][] = [
    ['Ámbito',        ambitoLabel],
    ['Entidad',       data.entidadNombre],
    ['Fecha',         fmtFecha(data.fechaEjecucion)],
    ['ID Ejecución',  data.ejecucionId],
    ['Estado general', (data.estadoCalculo ?? 'SIN DATOS').replace(/_/g, ' ')],
    ['Alertas totales', String(data.alertas.length)],
  ];

  for (const [label, value] of metaRows) {
    const row = ws.addRow([label, value]);
    row.getCell(1).style = STYLE_META_LABEL;
    row.getCell(2).style = STYLE_META_VALUE;
    row.height = 16;
  }
}

// ── Hoja Indicadores ───────────────────────────────────────────────────────────

function buildHojaIndicadores(ws: ExcelJS.Worksheet, data: SnapshotExport): void {
  ws.columns = [
    { key: 'codigo',    header: 'Código',      width: 18 },
    { key: 'nombre',    header: 'Descripción', width: 50 },
    { key: 'estado',    header: 'Estado',      width: 20 },
    { key: 'valor',     header: 'Valor',       width: 22 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.height = 18;
  for (let c = 1; c <= 4; c++) {
    headerRow.getCell(c).style = STYLE_HEADER;
  }

  const meta = metaPorAmbito(data.ambito);
  for (const [key, nombre] of meta) {
    const ind = data.snapshot[key];
    if (!ind || typeof ind !== 'object') continue;
    const indObj = ind as Record<string, unknown>;
    const estado = (indObj['estadoCalculo'] as string | null | undefined)?.replace(/_/g, ' ') ?? '—';
    const valor  = fmtIndicador(ind);
    const row = ws.addRow({ codigo: key.toUpperCase(), nombre, estado, valor });
    row.height = 15;
    row.getCell(3).style = { fill: estadoFill(indObj['estadoCalculo'] as string) };
  }
}

// ── Hoja Alertas ───────────────────────────────────────────────────────────────

function buildHojaAlertas(ws: ExcelJS.Worksheet, data: SnapshotExport): void {
  ws.columns = [
    { key: 'prioridad',    header: 'Prioridad',        width: 14 },
    { key: 'regla',        header: 'Regla',            width: 14 },
    { key: 'descripcion',  header: 'Descripción',      width: 50 },
    { key: 'ambito',       header: 'Ámbito',           width: 12 },
    { key: 'fecha',        header: 'Fecha análisis',   width: 20 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.height = 18;
  for (let c = 1; c <= 5; c++) {
    headerRow.getCell(c).style = STYLE_HEADER;
  }

  for (const alerta of data.alertas) {
    const row = ws.addRow({
      prioridad:   alerta.prioridad,
      regla:       alerta.regla,
      descripcion: alerta.descripcion,
      ambito:      alerta.ambito,
      fecha:       fmtFecha(alerta.fechaEjecucion),
    });
    row.height = 15;
    row.getCell(1).style = { fill: prioridadFill(alerta.prioridad) };
  }

  if (data.alertas.length === 0) {
    ws.addRow({ prioridad: '—', regla: '—', descripcion: 'Sin alertas vigentes', ambito: '', fecha: '' });
  }
}

// ── Exportación principal ──────────────────────────────────────────────────────

export async function generarExcelBuffer(data: SnapshotExport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator  = 'UDEMM Global';
  wb.subject  = 'Autoevaluación Institucional';
  wb.created  = new Date();
  wb.modified = new Date();

  buildHojaResumen(    wb.addWorksheet('Resumen'),     data);
  buildHojaIndicadores(wb.addWorksheet('Indicadores'), data);
  buildHojaAlertas(    wb.addWorksheet('Alertas'),     data);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
