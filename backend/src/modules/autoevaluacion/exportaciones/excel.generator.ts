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

const STYLE_SECTION_TITLE: Partial<ExcelJS.Style> = {
  font:      { bold: true, size: 10, color: { argb: 'FF0f4c81' } },
  fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFe8f0fb' } },
  alignment: { vertical: 'middle', horizontal: 'left' },
};

const STYLE_SUBSECTION: Partial<ExcelJS.Style> = {
  font:      { bold: true, size: 9, color: { argb: 'FF1e3a5f' } },
  fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf0f4f8' } },
  alignment: { vertical: 'middle', horizontal: 'left' },
};

const STYLE_NO_DATA: Partial<ExcelJS.Style> = {
  font:      { italic: true, size: 9, color: { argb: 'FF94a3b8' } },
  alignment: { vertical: 'middle', horizontal: 'center' },
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

function cumpleFill(cumple: boolean | null | undefined): ExcelJS.Fill {
  if (cumple === true)  return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFdcfce7' } };
  if (cumple === false) return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf1f5f9' } };
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
  if (typeof o['tienePPS'] === 'boolean') {
    const partes: string[] = [];
    if (o['tienePPS']) partes.push('PPS');
    if (typeof o['tienePI'] === 'boolean' && o['tienePI']) partes.push('PI');
    return partes.length ? partes.join('+') : 'Sin práctica';
  }
  if (typeof o['totalConAlerta'] === 'number') return `${o['totalConAlerta']} conflictos`;
  if (typeof o['totalInconsistencias'] === 'number') return `${o['totalInconsistencias']} inconsistencias`;
  if (Array.isArray(o['bloques'])) return `${(o['bloques'] as unknown[]).length} bloques`;
  return '—';
}

/** Protege contra inyección de fórmulas en valores de texto. */
function safeStr(v: unknown): string {
  const s = v === null || v === undefined ? '—' : String(v);
  if (s.startsWith('=') || s.startsWith('+') || s.startsWith('@')) return `'${s}`;
  return s;
}

function fmtCumple(v: boolean | null | undefined): string {
  if (v === true)  return 'Cumple';
  if (v === false) return 'No cumple';
  return '—';
}

function fmtNum(v: number | null | undefined, suffix = ''): string | number {
  if (v === null || v === undefined) return '—';
  return suffix ? `${v}${suffix}` : v;
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
  ['composicion',          'Composición del cuerpo docente'],
  ['formacion',            'Formación y titulación docente'],
  ['investigacion',        'Investigación y vinculación institucional'],
  ['dedicaciones',         'Dedicaciones horarias'],
  ['cargaAcademica',       'Carga académica'],
  ['distribucionMaterias', 'B-06 — Distribución de materias por docente (R-06)'],
];

function metaPorAmbito(ambito: string): Array<[string, string]> {
  if (ambito === 'CARRERA')  return META_CARRERA;
  if (ambito === 'PLAN')     return META_PLAN;
  return META_FACULTAD;
}

// ── Helpers de construcción de hojas ──────────────────────────────────────────

function addSectionTitle(ws: ExcelJS.Worksheet, title: string, ncols: number): void {
  const r = ws.addRow([title]);
  r.height = 22;
  ws.mergeCells(r.number, 1, r.number, ncols);
  r.getCell(1).style = STYLE_SECTION_TITLE;
  ws.addRow([]); // spacer
}

function addSubsectionTitle(ws: ExcelJS.Worksheet, title: string, ncols: number): void {
  ws.addRow([]); // spacer
  const r = ws.addRow([title]);
  r.height = 18;
  ws.mergeCells(r.number, 1, r.number, ncols);
  r.getCell(1).style = STYLE_SUBSECTION;
}

function addKvRow(ws: ExcelJS.Worksheet, label: string, value: unknown): void {
  const r = ws.addRow([label, value === null || value === undefined ? '—' : value]);
  r.getCell(1).style = STYLE_META_LABEL;
  r.getCell(2).style = STYLE_META_VALUE;
  r.height = 15;
}

function addTableHdr(ws: ExcelJS.Worksheet, headers: string[]): ExcelJS.Row {
  const r = ws.addRow(headers);
  r.height = 18;
  for (let c = 1; c <= headers.length; c++) {
    r.getCell(c).style = STYLE_HEADER;
  }
  return r;
}

function addNoDataRow(ws: ExcelJS.Worksheet, ncols: number, msg = 'Sin datos disponibles'): void {
  const r = ws.addRow([msg]);
  r.height = 15;
  ws.mergeCells(r.number, 1, r.number, ncols);
  r.getCell(1).style = STYLE_NO_DATA;
}

// ── Hoja Resumen ───────────────────────────────────────────────────────────────

function buildHojaResumen(ws: ExcelJS.Worksheet, data: SnapshotExport, nombreInstitucion: string): void {
  ws.columns = [
    { key: 'label', width: 26 },
    { key: 'value', width: 50 },
  ];

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

  // Jerarquía institucional completa para PLAN; parcial para CARRERA
  const metaRows: [string, string][] = [
    ['Universidad', nombreInstitucion],
  ];
  if (data.facultadNombre) metaRows.push(['Facultad',         data.facultadNombre]);
  if (data.carreraNombre)  metaRows.push(['Carrera',          data.carreraNombre]);
  metaRows.push(
    [ambitoLabel,     data.entidadNombre],
    ['Fecha',         fmtFecha(data.fechaEjecucion)],
    ['ID Ejecución',  data.ejecucionId],
    ['Estado general', (data.estadoCalculo ?? 'SIN DATOS').replace(/_/g, ' ')],
    ['Alertas totales', String(data.alertas.length)],
  );

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

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 4 } };

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

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 5 } };

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
    const r = ws.addRow({ prioridad: '—', regla: '—', descripcion: 'Sin alertas vigentes', ambito: '', fecha: '' });
    r.getCell(3).style = STYLE_NO_DATA;
  }
}

// ── IPL-01 — Horas totales del plan ───────────────────────────────────────────

function buildHojaIPL01(ws: ExcelJS.Worksheet, snap: Record<string, unknown>): void {
  ws.columns = [{ key: 'campo', width: 32 }, { key: 'valor', width: 22 }];
  const d = snap['ipl01'] as Record<string, unknown> | undefined;

  addSectionTitle(ws, 'IPL-01 — Carga horaria total del plan', 2);

  if (!d) { addNoDataRow(ws, 2); return; }

  const diff = d['diferencia'] as number | null;
  const diffStr = diff !== null && diff !== undefined
    ? `${diff >= 0 ? '+' : ''}${diff} h` : '—';

  addKvRow(ws, 'Horas totales del plan',           typeof d['horasTotal']   === 'number' ? d['horasTotal']   : '—');
  addKvRow(ws, 'Horas mínimas requeridas (P-10)',  typeof d['horasMinimas'] === 'number' ? d['horasMinimas'] : '—');
  addKvRow(ws, 'Diferencia',                       diffStr);
  addKvRow(ws, 'Cumplimiento',                     fmtCumple(d['cumple'] as boolean | null));
  addKvRow(ws, 'Estado de cálculo',                String(d['estadoCalculo'] ?? '—').replace(/_/g, ' '));
}

// ── IPL-02 — Bloques con umbral ────────────────────────────────────────────────

function buildHojaIPL02(ws: ExcelJS.Worksheet, snap: Record<string, unknown>): void {
  ws.columns = [{ key: 'campo', width: 36 }, { key: 'valor', width: 20 }];
  const d = snap['ipl02'] as Record<string, unknown> | undefined;

  addSectionTitle(ws, 'IPL-02 — Bloques que cumplen su umbral mínimo', 2);

  if (!d) { addNoDataRow(ws, 2); return; }

  const cumplen  = d['bloquesCumplen']   as number | undefined;
  const conUmbral = d['bloquesConUmbral'] as number | undefined;

  addKvRow(ws, 'Bloques que cumplen umbral',          fmtNum(cumplen));
  addKvRow(ws, 'Bloques con umbral definido (P-11–14)', fmtNum(conUmbral));
  addKvRow(ws, 'Resultado',
    cumplen !== undefined && conUmbral !== undefined
      ? `${cumplen} de ${conUmbral} bloques cumplen` : '—');
  addKvRow(ws, 'Estado de cálculo', String(d['estadoCalculo'] ?? '—').replace(/_/g, ' '));
}

// ── IPL-03 — Responsables de cátedra ─────────────────────────────────────────

function buildHojaIPL03(ws: ExcelJS.Worksheet, snap: Record<string, unknown>): void {
  ws.columns = [{ key: 'campo', width: 34 }, { key: 'valor', width: 22 }];
  const d = snap['ipl03'] as Record<string, unknown> | undefined;

  addSectionTitle(ws, 'IPL-03 — Materias sin responsable de cátedra', 2);

  if (!d) { addNoDataRow(ws, 2); return; }

  addKvRow(ws, 'Total materias del plan',           fmtNum(d['totalMaterias']   as number));
  addKvRow(ws, 'Con responsable asignado',          fmtNum(d['conResponsable']  as number));
  addKvRow(ws, 'Sin responsable',                   fmtNum(d['sinResponsable']  as number));
  addKvRow(ws, 'Asignaciones inciertas',            fmtNum(d['inciertas']       as number));
  addKvRow(ws, 'Estado de cálculo',                 String(d['estadoCalculo'] ?? '—').replace(/_/g, ' '));

  const inciertas = d['inciertas'] as number | undefined;
  if (typeof inciertas === 'number' && inciertas > 0) {
    ws.addRow([]);
    const noteRow = ws.addRow([
      `Nota: ${inciertas} materia${inciertas !== 1 ? 's' : ''} con vinculación APROBADA y campo esResponsableCatedra sin clasificar.`,
    ]);
    noteRow.getCell(1).style = {
      font: { italic: true, size: 8, color: { argb: 'FFb45309' } },
      alignment: { wrapText: true },
    };
    ws.mergeCells(noteRow.number, 1, noteRow.number, 2);
    noteRow.height = 28;
  }
}

// ── IPL-04 — Múltiples responsables ──────────────────────────────────────────

function buildHojaIPL04(ws: ExcelJS.Worksheet, snap: Record<string, unknown>): void {
  ws.columns = [{ key: 'campo', width: 40 }, { key: 'valor', width: 20 }];
  const d = snap['ipl04'] as Record<string, unknown> | undefined;

  addSectionTitle(ws, 'IPL-04 — Pares materia/cátedra con múltiples responsables', 2);

  if (!d) { addNoDataRow(ws, 2); return; }

  addKvRow(ws, 'Pares con múltiples responsables (alerta)', fmtNum(d['paresConAlerta']  as number));
  addKvRow(ws, 'Pares con asignación incierta',             fmtNum(d['paresInciertos']  as number));
  addKvRow(ws, 'Total materias del plan',                   fmtNum(d['totalMaterias']   as number));
  addKvRow(ws, 'Estado de cálculo',                        String(d['estadoCalculo'] ?? '—').replace(/_/g, ' '));
}

// ── IPL-05 — Horas por bloque curricular ─────────────────────────────────────

function buildHojaIPL05(ws: ExcelJS.Worksheet, snap: Record<string, unknown>): void {
  ws.columns = [
    { key: 'bloque',     header: 'Bloque',       width: 12 },
    { key: 'horasReales',header: 'Horas reales', width: 14 },
    { key: 'horasMin',   header: 'Mínimo (P-11–14)', width: 18 },
    { key: 'diferencia', header: 'Diferencia',   width: 14 },
    { key: 'cumple',     header: 'Cumplimiento', width: 16 },
    { key: 'estado',     header: 'Estado cálculo', width: 18 },
  ];

  const d = snap['ipl05'] as Record<string, unknown> | undefined;
  addSectionTitle(ws, 'IPL-05 — Horas por tipo de bloque curricular', 6);

  if (!d) { addNoDataRow(ws, 6); return; }

  const bloques = d['bloques'] as Record<string, unknown>[] | undefined;
  addKvRow(ws, 'Estado de cálculo', String(d['estadoCalculo'] ?? '—').replace(/_/g, ' '));
  ws.addRow([]);

  if (!bloques || bloques.length === 0) {
    addNoDataRow(ws, 6, 'Sin datos de bloques disponibles');
    return;
  }

  const hdrRow = addTableHdr(ws, ['Bloque', 'Horas reales', 'Mínimo (P-11–14)', 'Diferencia', 'Cumplimiento', 'Estado cálculo']);
  ws.autoFilter = { from: { row: hdrRow.number, column: 1 }, to: { row: hdrRow.number, column: 6 } };

  for (const b of bloques) {
    const diff    = b['diferencia'] as number | null;
    const cumple  = b['cumple']     as boolean | null;
    const diffStr = diff !== null && diff !== undefined
      ? `${diff >= 0 ? '+' : ''}${diff}` : '—';
    const r = ws.addRow({
      bloque:      safeStr(b['bloque']),
      horasReales: typeof b['horasReales']  === 'number' ? b['horasReales']  : '—',
      horasMin:    typeof b['horasMinimas'] === 'number' ? b['horasMinimas'] : '—',
      diferencia:  diffStr,
      cumple:      fmtCumple(cumple),
      estado:      String(b['estadoCalculo'] ?? '—').replace(/_/g, ' '),
    });
    r.height = 15;
    r.getCell(5).style = { fill: cumpleFill(cumple), alignment: { horizontal: 'center' } };
    r.getCell(6).style = { fill: estadoFill(b['estadoCalculo'] as string) };
  }
}

// ── R-11 — Inconsistencias en programas de asignatura ─────────────────────────

function buildHojaR11(ws: ExcelJS.Worksheet, snap: Record<string, unknown>): void {
  ws.columns = [
    { key: 'c1', width: 14 },
    { key: 'c2', width: 36 },
    { key: 'c3', width: 16 },
    { key: 'c4', width: 16 },
    { key: 'c5', width: 14 },
  ];

  const d = snap['r11'] as Record<string, unknown> | undefined;
  addSectionTitle(ws, 'R-11 — Inconsistencias en programas de asignatura', 5);

  if (!d) { addNoDataRow(ws, 5); return; }

  addKvRow(ws, 'Total materias del plan',    fmtNum(d['totalMaterias']       as number));
  addKvRow(ws, 'Con programa cargado',       fmtNum(d['totalConPrograma']    as number));
  addKvRow(ws, 'Sin programa',               fmtNum(d['totalSinPrograma']    as number));
  addKvRow(ws, 'Con inconsistencias',        fmtNum(d['totalInconsistencias'] as number));
  addKvRow(ws, 'Prioridad Alta',             fmtNum(d['totalAlta']           as number));
  addKvRow(ws, 'Prioridad Media',            fmtNum(d['totalMedia']          as number));
  addKvRow(ws, 'Estado de cálculo',          String(d['estadoCalculo'] ?? '—').replace(/_/g, ' '));

  // Tabla 1: materias con inconsistencias
  const inconsistencias = d['inconsistencias'] as Record<string, unknown>[] | undefined;
  addSubsectionTitle(ws, 'Materias con inconsistencias en el programa', 5);

  if (!inconsistencias || inconsistencias.length === 0) {
    addNoDataRow(ws, 5, 'Sin inconsistencias detectadas');
  } else {
    const hdr1 = addTableHdr(ws, ['Código', 'Materia', 'Secc. completas', 'Secc. pendientes', 'Prioridad']);
    ws.autoFilter = { from: { row: hdr1.number, column: 1 }, to: { row: hdr1.number, column: 5 } };
    for (const inc of inconsistencias) {
      const r = ws.addRow([
        safeStr(inc['materiaCodigo']),
        safeStr(inc['materiaNombre']),
        typeof inc['seccionesCompletas']  === 'number' ? inc['seccionesCompletas']  : '—',
        typeof inc['seccionesPendientes'] === 'number' ? inc['seccionesPendientes'] : '—',
        safeStr(inc['prioridad']),
      ]);
      r.height = 15;
      const p = String(inc['prioridad'] ?? '');
      r.getCell(5).style = { fill: prioridadFill(p), alignment: { horizontal: 'center' } };
    }
  }

  // Tabla 2: materias sin programa
  const sinPrograma = d['sinPrograma'] as Record<string, unknown>[] | undefined;
  addSubsectionTitle(ws, 'Materias sin programa cargado', 5);

  if (!sinPrograma || sinPrograma.length === 0) {
    addNoDataRow(ws, 5, 'Todas las materias tienen programa cargado');
  } else {
    addTableHdr(ws, ['Código', 'Materia', '', '', '']);
    for (const m of sinPrograma) {
      const r = ws.addRow([
        safeStr(m['materiaCodigo']),
        safeStr(m['materiaNombre']),
        '', '', '',
      ]);
      r.height = 15;
    }
  }
}

// ── R-13 — Formación práctica (PPS / PI) ──────────────────────────────────────

function buildHojaR13(ws: ExcelJS.Worksheet, snap: Record<string, unknown>): void {
  ws.columns = [
    { key: 'c1', width: 14 },
    { key: 'c2', width: 36 },
    { key: 'c3', width: 20 },
    { key: 'c4', width: 14 },
  ];

  const d = snap['r13'] as Record<string, unknown> | undefined;
  addSectionTitle(ws, 'R-13 — Formación práctica (PPS / PI)', 4);

  if (!d) { addNoDataRow(ws, 4); return; }

  const tienePPS = d['tienePPS'] as boolean | undefined;
  const tienePI  = d['tienePI']  as boolean | undefined;

  addKvRow(ws, 'Total materias del plan',     fmtNum(d['totalMaterias'] as number));
  addKvRow(ws, 'Tiene PPS',                   tienePPS === true ? 'Sí' : tienePPS === false ? 'No' : '—');
  addKvRow(ws, 'Tiene PI',                    tienePI  === true ? 'Sí' : tienePI  === false ? 'No' : '—');
  addKvRow(ws, 'Horas PPS',                   fmtNum(d['horasPPS'] as number | null, ' h'));
  addKvRow(ws, 'Horas PI',                    fmtNum(d['horasPI']  as number | null, ' h'));
  addKvRow(ws, 'Estado de cálculo',           String(d['estadoCalculo'] ?? '—').replace(/_/g, ' '));

  // Distribución por tipo
  const porTipo = d['porTipo'] as Record<string, number> | undefined;
  if (porTipo && Object.keys(porTipo).length > 0) {
    addSubsectionTitle(ws, 'Distribución por tipo de asignatura', 4);
    addTableHdr(ws, ['Tipo de asignatura', 'Cantidad', '', '']);
    for (const [tipo, cantidad] of Object.entries(porTipo)) {
      const r = ws.addRow([safeStr(tipo), cantidad, '', '']);
      r.height = 15;
    }
  }

  // Tabla materias PPS
  const materiasPPS = d['materiasPPS'] as Record<string, unknown>[] | undefined;
  addSubsectionTitle(ws, 'Materias de Práctica Profesional Supervisada (PPS)', 4);
  if (!materiasPPS || materiasPPS.length === 0) {
    addNoDataRow(ws, 4, 'Sin materias PPS en este plan');
  } else {
    const hdrPPS = addTableHdr(ws, ['Código', 'Nombre', 'Tipo asignatura', 'Carga horaria']);
    ws.autoFilter = { from: { row: hdrPPS.number, column: 1 }, to: { row: hdrPPS.number, column: 4 } };
    for (const m of materiasPPS) {
      const r = ws.addRow([
        safeStr(m['codigo']),
        safeStr(m['nombre']),
        safeStr(m['tipoAsignatura']),
        typeof m['cargaHorariaTotal'] === 'number' ? m['cargaHorariaTotal'] : '—',
      ]);
      r.height = 15;
    }
  }

  // Tabla materias PI
  const materiasPI = d['materiasPI'] as Record<string, unknown>[] | undefined;
  addSubsectionTitle(ws, 'Materias de Práctica Integradora (PI)', 4);
  if (!materiasPI || materiasPI.length === 0) {
    addNoDataRow(ws, 4, 'Sin materias PI en este plan');
  } else {
    const hdrPI = addTableHdr(ws, ['Código', 'Nombre', 'Tipo asignatura', 'Carga horaria']);
    ws.autoFilter = { from: { row: hdrPI.number, column: 1 }, to: { row: hdrPI.number, column: 4 } };
    for (const m of materiasPI) {
      const r = ws.addRow([
        safeStr(m['codigo']),
        safeStr(m['nombre']),
        safeStr(m['tipoAsignatura']),
        typeof m['cargaHorariaTotal'] === 'number' ? m['cargaHorariaTotal'] : '—',
      ]);
      r.height = 15;
    }
  }
}

// ── R-14 — Horas formación práctica vs. horas totales ─────────────────────────

function buildHojaR14(ws: ExcelJS.Worksheet, snap: Record<string, unknown>): void {
  ws.columns = [
    { key: 'c1', width: 14 },
    { key: 'c2', width: 36 },
    { key: 'c3', width: 16 },
    { key: 'c4', width: 14 },
    { key: 'c5', width: 12 },
  ];

  const d = snap['r14'] as Record<string, unknown> | undefined;
  addSectionTitle(ws, 'R-14 — Horas de formación práctica vs. horas totales', 5);

  if (!d) { addNoDataRow(ws, 5); return; }

  addKvRow(ws, 'Total materias del plan',  fmtNum(d['totalMaterias']  as number));
  addKvRow(ws, 'Materias evaluadas',       fmtNum(d['totalEvaluadas'] as number));
  addKvRow(ws, 'Materias en alerta',       fmtNum(d['totalConAlerta'] as number));
  addKvRow(ws, 'Sin datos suficientes',    fmtNum(d['totalSinDatos']  as number));
  addKvRow(ws, 'Estado de cálculo',        String(d['estadoCalculo'] ?? '—').replace(/_/g, ' '));

  const enAlerta = d['enAlerta'] as Record<string, unknown>[] | undefined;
  addSubsectionTitle(ws, 'Materias con horas de formación práctica superiores a horas totales', 5);

  if (!enAlerta || enAlerta.length === 0) {
    addNoDataRow(ws, 5, 'Sin materias en conflicto');
    return;
  }

  const hdr = addTableHdr(ws, ['Código', 'Materia', 'Hs. Formación práctica', 'Hs. Totales', 'Exceso']);
  ws.autoFilter = { from: { row: hdr.number, column: 1 }, to: { row: hdr.number, column: 5 } };

  for (const m of enAlerta) {
    const r = ws.addRow([
      safeStr(m['materiaCodigo']),
      safeStr(m['materiaNombre']),
      typeof m['horasFormacionPractica'] === 'number' ? m['horasFormacionPractica'] : '—',
      typeof m['horasTotal']             === 'number' ? m['horasTotal']             : '—',
      typeof m['exceso']                 === 'number' ? m['exceso']                 : '—',
    ]);
    r.height = 15;
    r.getCell(5).style = {
      fill:  { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } },
      font:  { bold: true, color: { argb: 'FFb91c1c' } },
      alignment: { horizontal: 'right' },
    };
  }
}

// ── Hoja Advertencias y datos faltantes ───────────────────────────────────────

function buildHojaAdvertencias(ws: ExcelJS.Worksheet, snap: Record<string, unknown>): void {
  ws.columns = [
    { key: 'tipo',        header: 'Tipo',         width: 20 },
    { key: 'indicador',   header: 'Indicador',    width: 18 },
    { key: 'descripcion', header: 'Descripción',  width: 60 },
  ];

  const advertencias  = snap['advertencias']  as string[]                               | undefined;
  const datosFaltantes = snap['datosFaltantes'] as Array<{ campo: string; descripcion?: string }> | undefined;

  addSectionTitle(ws, 'Advertencias y datos faltantes', 3);

  const hasAdv  = advertencias    && advertencias.length > 0;
  const hasDatos = datosFaltantes && datosFaltantes.length > 0;

  if (!hasAdv && !hasDatos) {
    addNoDataRow(ws, 3, 'Sin advertencias ni datos faltantes registrados');
    return;
  }

  const allRows: { tipo: string; indicador: string; descripcion: string }[] = [];

  if (hasAdv) {
    for (const a of advertencias!) {
      // Intenta extraer código de indicador del inicio del mensaje (ej. "IPL-01: ...")
      const match = /^([A-Z]{1,4}-\d{2}[A-Z]*)\s*[:\-–]/.exec(a);
      allRows.push({
        tipo:        'Advertencia',
        indicador:   match ? match[1] : '—',
        descripcion: safeStr(a),
      });
    }
  }

  if (hasDatos) {
    for (const df of datosFaltantes!) {
      allRows.push({
        tipo:        'Dato faltante',
        indicador:   safeStr(df.campo),
        descripcion: safeStr(df.descripcion ?? ''),
      });
    }
  }

  const hdr = addTableHdr(ws, ['Tipo', 'Indicador / Campo', 'Descripción']);
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: hdr.number }];
  ws.autoFilter = { from: { row: hdr.number, column: 1 }, to: { row: hdr.number, column: 3 } };

  for (const row of allRows) {
    const r = ws.addRow([row.tipo, row.indicador, row.descripcion]);
    r.height = 15;
    if (row.tipo === 'Advertencia') {
      r.getCell(1).style = {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } },
        font: { bold: true, size: 9 },
      };
    } else {
      r.getCell(1).style = {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf0f9ff' } },
        font: { size: 9 },
      };
    }
  }
}

// ── CARRERA: helpers locales ──────────────────────────────────────────────────

const FICHA_LABELS_XLS: Record<string, string> = {
  personales:     'Datos personales',
  formacionGrado: 'Título de grado',
  areaDesempeno:  'Área disciplinar',
};

function addAlcanceParcialRow(ws: ExcelJS.Worksheet, ncols: number, msg: string): void {
  const r = ws.addRow([`⚠ ${msg}`]);
  r.height = 28;
  ws.mergeCells(r.number, 1, r.number, ncols);
  r.getCell(1).style = {
    fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } },
    font:      { italic: true, size: 8.5, color: { argb: 'FF92400e' } },
    alignment: { wrapText: true, vertical: 'middle' },
  };
}

// ── IP-04 — Distribución docente ──────────────────────────────────────────────

function buildHojaCarIP04(ws: ExcelJS.Worksheet, snap: Record<string, unknown>): void {
  ws.columns = [
    { key: 'c1', width: 36 },
    { key: 'c2', width: 22 },
    { key: 'c3', width: 18 },
  ];

  const d = snap['ip04'] as Record<string, unknown> | undefined;
  addSectionTitle(ws, 'IP-04 — Materias por docente (distribución)', 3);

  if (!d) { addNoDataRow(ws, 3); return; }

  addKvRow(ws, 'Mediana (materias/docente)',  typeof d['mediana']  === 'number' ? d['mediana']  : '—');
  addKvRow(ws, 'Promedio (materias/docente)', typeof d['promedio'] === 'number' ? d['promedio'] : '—');
  addKvRow(ws, 'Máximo (materias/docente)',   typeof d['maximo']   === 'number' ? d['maximo']   : '—');
  addKvRow(ws, 'Total docentes evaluados',    fmtNum(d['totalDocentes'] as number));
  addKvRow(ws, 'Estado de cálculo',           String(d['estadoCalculo'] ?? '—').replace(/_/g, ' '));

  const distribucion = d['distribucion'] as Record<string, unknown>[] | undefined;
  addSubsectionTitle(ws, 'Distribución de materias por docente', 3);

  if (!distribucion || distribucion.length === 0) {
    addNoDataRow(ws, 3, 'Sin datos de distribución');
    return;
  }

  const hdr = addTableHdr(ws, ['Docente', 'N.° de materias', 'ID Docente']);
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: hdr.number }];
  ws.autoFilter = { from: { row: hdr.number, column: 1 }, to: { row: hdr.number, column: 3 } };

  for (const item of distribucion) {
    const r = ws.addRow([
      safeStr(item['nombre']),
      typeof item['nMaterias'] === 'number' ? item['nMaterias'] : '—',
      safeStr(item['docenteId']),
    ]);
    r.height = 15;
  }
}

// ── IP-08 — Relación profesores/auxiliares ────────────────────────────────────

function buildHojaCarIP08(ws: ExcelJS.Worksheet, snap: Record<string, unknown>): void {
  ws.columns = [
    { key: 'c1', width: 36 },
    { key: 'c2', width: 22 },
  ];

  const d = snap['ip08'] as Record<string, unknown> | undefined;
  addSectionTitle(ws, 'IP-08 — Relación profesores / auxiliares', 2);

  if (!d) { addNoDataRow(ws, 2); return; }

  const ratio = d['ratio'] as number | null;
  addKvRow(ws, 'Cantidad de profesores', fmtNum(d['profesores'] as number));
  addKvRow(ws, 'Cantidad de auxiliares', fmtNum(d['auxiliares'] as number));
  addKvRow(ws, 'Relación P/A',           typeof ratio === 'number' ? ratio : 'Sin auxiliares');
  addKvRow(ws, 'Estado de cálculo',      String(d['estadoCalculo'] ?? '—').replace(/_/g, ' '));
}

// ── IP-09 — Completitud de fichas docentes ────────────────────────────────────

function buildHojaCarIP09(ws: ExcelJS.Worksheet, snap: Record<string, unknown>): void {
  ws.columns = [
    { key: 'c1', width: 36 },
    { key: 'c2', width: 22 },
  ];

  const d = snap['ip09'] as Record<string, unknown> | undefined;
  addSectionTitle(ws, 'IP-09 — Completitud promedio del plantel', 2);

  if (!d) { addNoDataRow(ws, 2); return; }

  const pct = d['completitudPromedio'] as number | null;
  addKvRow(ws, 'Completitud promedio (%)', pct !== null && pct !== undefined ? pct : '—');
  addKvRow(ws, 'Total docentes evaluados', fmtNum(d['totalDocentes'] as number));
  addKvRow(ws, 'Estado de cálculo',        String(d['estadoCalculo'] ?? '—').replace(/_/g, ' '));

  ws.addRow([]);
  const note = ws.addRow(['Componentes: C1 = datos personales · C2 = título de grado · C3 = área disciplinar · C4 = cargo vigente']);
  note.getCell(1).style = {
    font:      { italic: true, size: 8, color: { argb: 'FF64748b' } },
    alignment: { wrapText: true },
  };
  ws.mergeCells(note.number, 1, note.number, 2);
  note.height = 22;
}

// ── IP-10 — Consistencia del plantel ──────────────────────────────────────────

function buildHojaCarIP10(ws: ExcelJS.Worksheet, snap: Record<string, unknown>): void {
  ws.columns = [
    { key: 'c1', width: 36 },
    { key: 'c2', width: 22 },
  ];

  const d = snap['ip10'] as Record<string, unknown> | undefined;
  addSectionTitle(ws, 'IP-10 — Consistencia del plantel docente', 2);

  if (!d) { addNoDataRow(ws, 2); return; }

  addKvRow(ws, 'Puntaje (sobre 100)',             fmtNum(d['puntaje']                as number));
  addKvRow(ws, 'Componente A — alertas ALTA',     fmtNum(d['componenteA']            as number));
  addKvRow(ws, 'Componente M — alertas MEDIA',    fmtNum(d['componenteM']            as number));
  addKvRow(ws, 'Alertas R-03 (tope horario)',      fmtNum(d['alertasR03']             as number));
  addKvRow(ws, 'Alertas R-04 penalizables',        fmtNum(d['alertasR04Penalizables'] as number));
  addKvRow(ws, 'Alertas R-07 sobreasignados',      fmtNum(d['alertasR07']             as number));
  addKvRow(ws, 'Estado de cálculo',               String(d['estadoCalculo'] ?? '—').replace(/_/g, ' '));

  ws.addRow([]);
  const note = ws.addRow(['Fórmula: max(0, 100 − 25×A − 10×M).  A = alertas ALTA penalizables (R-03 + R-04).  M = alertas MEDIA (R-07).']);
  note.getCell(1).style = {
    font:      { italic: true, size: 8, color: { argb: 'FF64748b' } },
    alignment: { wrapText: true },
  };
  ws.mergeCells(note.number, 1, note.number, 2);
  note.height = 22;
}

// ── IP-13 — Sobreasignación docente ───────────────────────────────────────────

function buildHojaCarIP13(ws: ExcelJS.Worksheet, snap: Record<string, unknown>): void {
  ws.columns = [
    { key: 'c1', width: 36 },
    { key: 'c2', width: 18 },
    { key: 'c3', width: 14 },
    { key: 'c4', width: 14 },
  ];

  const d = snap['ip13'] as Record<string, unknown> | undefined;
  addSectionTitle(ws, 'IP-13 — Docentes sobreasignados', 4);

  if (!d) { addNoDataRow(ws, 4); return; }

  if (d['alcanceFacultad'] === false) {
    addAlcanceParcialRow(ws, 4,
      'Alcance limitado a esta carrera. Pueden existir asignaciones fuera del alcance consultado.');
  }

  const noDet = d['totalNoDeterminables'] as number | undefined;
  if (typeof noDet === 'number' && noDet > 0 && d['alcanceFacultad'] !== false) {
    addAlcanceParcialRow(ws, 4,
      `${noDet} docente(s) con asignaciones en otras facultades no pudieron evaluarse.`);
  }

  addKvRow(ws, 'Docentes sobreasignados',            fmtNum(d['totalSobreasignados']  as number));
  addKvRow(ws, 'Total docentes',                     fmtNum(d['totalDocentes']         as number));
  addKvRow(ws, 'Límite máximo de materias (P-03)',   d['limite'] !== null && d['limite'] !== undefined
    ? d['limite'] : 'No configurado');
  addKvRow(ws, 'No determinables',                   fmtNum(d['totalNoDeterminables']  as number));
  addKvRow(ws, 'Estado de cálculo',                  String(d['estadoCalculo'] ?? '—').replace(/_/g, ' '));

  const sobreasignados = d['sobreasignados'] as Record<string, unknown>[] | undefined;
  addSubsectionTitle(ws, 'Docentes con exceso de asignaciones', 4);

  if (!sobreasignados || sobreasignados.length === 0) {
    addNoDataRow(ws, 4, 'Sin docentes sobreasignados');
    return;
  }

  const hdr = addTableHdr(ws, ['Docente', 'Materias asignadas', 'Exceso', 'ID Docente']);
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: hdr.number }];
  ws.autoFilter = { from: { row: hdr.number, column: 1 }, to: { row: hdr.number, column: 4 } };

  for (const s of sobreasignados) {
    const exceso = s['exceso'] as number | undefined;
    const r = ws.addRow([
      safeStr(s['nombre']),
      typeof s['nMaterias'] === 'number' ? s['nMaterias'] : '—',
      typeof exceso         === 'number' ? exceso         : '—',
      safeStr(s['docenteId']),
    ]);
    r.height = 15;
    if (typeof exceso === 'number' && exceso > 0) {
      r.getCell(3).style = {
        fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } },
        font:      { bold: true, color: { argb: 'FFb91c1c' } },
        alignment: { horizontal: 'right' },
      };
    }
  }
}

// ── R-10 — Docentes con baja dedicación horaria ───────────────────────────────

function buildHojaCarR10(ws: ExcelJS.Worksheet, snap: Record<string, unknown>): void {
  ws.columns = [
    { key: 'c1', width: 36 },
    { key: 'c2', width: 20 },
    { key: 'c3', width: 18 },
    { key: 'c4', width: 14 },
  ];

  const d = snap['r10'] as Record<string, unknown> | undefined;
  addSectionTitle(ws, 'R-10 — Docentes con baja dedicación horaria', 4);

  if (!d) { addNoDataRow(ws, 4); return; }

  if (d['alcanceFacultad'] === false) {
    addAlcanceParcialRow(ws, 4,
      'Evaluación parcial — el Director de Carrera solo ve su carrera. Totales pueden estar subestimados.');
  }

  addKvRow(ws, 'Total docentes',         fmtNum(d['totalDocentes']  as number));
  addKvRow(ws, 'En alerta',              fmtNum(d['totalEnAlerta']  as number));
  addKvRow(ws, 'Inciertos',              fmtNum(d['totalInciertos'] as number));
  addKvRow(ws, 'Umbral horario (P-02)',  d['umbral'] !== undefined ? `${d['umbral']} h` : '—');
  addKvRow(ws, 'Estado de cálculo',      String(d['estadoCalculo'] ?? '—').replace(/_/g, ' '));

  const enAlerta = d['enAlerta'] as Record<string, unknown>[] | undefined;
  addSubsectionTitle(ws, 'Docentes en alerta por baja dedicación', 4);

  if (!enAlerta || enAlerta.length === 0) {
    addNoDataRow(ws, 4, 'Sin docentes en alerta');
    return;
  }

  const hdr = addTableHdr(ws, ['Docente', 'Horas conocidas', 'Umbral (P-02)', 'ID Docente']);
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: hdr.number }];
  ws.autoFilter = { from: { row: hdr.number, column: 1 }, to: { row: hdr.number, column: 4 } };

  for (const e of enAlerta) {
    const hs = e['horasConocidas'] as number | undefined;
    const u  = e['umbral']         as number | undefined;
    const r = ws.addRow([
      safeStr(e['nombre']),
      typeof hs === 'number' ? hs : '—',
      typeof u  === 'number' ? u  : '—',
      safeStr(e['docenteId']),
    ]);
    r.height = 15;
    r.getCell(2).style = {
      fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } },
      font:      { color: { argb: 'FFb91c1c' } },
      alignment: { horizontal: 'right' },
    };
  }
}

// ── R-12 — Fichas docentes incompletas ────────────────────────────────────────

function buildHojaCarR12(ws: ExcelJS.Worksheet, snap: Record<string, unknown>): void {
  ws.columns = [
    { key: 'c1', width: 36 },
    { key: 'c2', width: 42 },
    { key: 'c3', width: 14 },
  ];

  const d = snap['r12'] as Record<string, unknown> | undefined;
  addSectionTitle(ws, 'R-12 — Campos obligatorios en ficha docente', 3);

  if (!d) { addNoDataRow(ws, 3); return; }

  if (d['alcanceFacultad'] === false) {
    addAlcanceParcialRow(ws, 3,
      'Evaluación parcial — el Director de Carrera solo ve su carrera (PARCIAL).');
  }

  addKvRow(ws, 'Total docentes',       fmtNum(d['totalDocentes']        as number));
  addKvRow(ws, 'Fichas incompletas',   fmtNum(d['totalIncompletos']     as number));
  addKvRow(ws, 'No determinables',     fmtNum(d['totalNoDeterminables'] as number));
  addKvRow(ws, 'Estado de cálculo',    String(d['estadoCalculo'] ?? '—').replace(/_/g, ' '));

  const noDet = d['noDeterminables'] as Record<string, unknown>[] | undefined;
  if (noDet && noDet.length > 0) {
    ws.addRow([]);
    const note = ws.addRow([`${noDet.length} docente(s) con asignaciones cross-facultad no pudieron evaluarse.`]);
    note.getCell(1).style = {
      font: { italic: true, size: 8.5, color: { argb: 'FF64748b' } },
      alignment: { wrapText: true },
    };
    ws.mergeCells(note.number, 1, note.number, 3);
    note.height = 22;
  }

  const incompletos = d['incompletos'] as Record<string, unknown>[] | undefined;
  addSubsectionTitle(ws, 'Docentes con ficha incompleta', 3);

  if (!incompletos || incompletos.length === 0) {
    addNoDataRow(ws, 3, 'Sin fichas incompletas');
    return;
  }

  const hdr = addTableHdr(ws, ['Docente', 'Campos faltantes', 'ID Docente']);
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: hdr.number }];
  ws.autoFilter = { from: { row: hdr.number, column: 1 }, to: { row: hdr.number, column: 3 } };

  for (const item of incompletos) {
    const raw = item['faltantes'];
    const arr = Array.isArray(raw) ? (raw as string[]) : [];
    const faltantesStr = arr.map(f => FICHA_LABELS_XLS[f] ?? f).join(', ') || '—';
    const r = ws.addRow([
      safeStr(item['nombre']),
      faltantesStr,
      safeStr(item['docenteId']),
    ]);
    r.height = 15;
    r.getCell(2).style = {
      fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } },
      alignment: { wrapText: true, vertical: 'middle' },
    };
  }
}

// ── Condiciones del Plantel CONEAU ────────────────────────────────────────────

function buildHojaCarCondPlantell(ws: ExcelJS.Worksheet, snap: Record<string, unknown>): void {
  ws.columns = [
    { key: 'c1', width: 38 },
    { key: 'c2', width: 20 },
    { key: 'c3', width: 16 },
  ];

  const cp = snap['condicionesPlantell'] as Record<string, unknown> | undefined;
  addSectionTitle(ws, 'Condiciones del Plantel Docente — CONEAU', 3);

  if (!cp) { addNoDataRow(ws, 3, 'Sin datos de condiciones del plantel'); return; }

  const total  = (cp['totalDocentes'] as number) ?? 0;
  const pctOf  = (n: unknown): number | string =>
    (typeof n === 'number' && total > 0) ? Math.round((n / total) * 100) : '—';

  addKvRow(ws, 'Total docentes del plantel',      total > 0 ? total : '—');
  addKvRow(ws, 'Con formación de posgrado',        fmtNum(cp['conPosgrado']            as number));
  addKvRow(ws, 'Con investigación',                fmtNum(cp['conInvestigacion']       as number));
  addKvRow(ws, 'Con designación regular',          fmtNum(cp['conDesignacionRegular']  as number));
  addKvRow(ws, 'Con designación interina',         fmtNum(cp['conDesignacionInterina'] as number));
  addKvRow(ws, '% con posgrado',                   pctOf(cp['conPosgrado']));
  addKvRow(ws, '% con investigación',              pctOf(cp['conInvestigacion']));
  addKvRow(ws, 'Estado de cálculo',                String(cp['estadoCalculo'] ?? '—').replace(/_/g, ' '));

  // Relación P/A
  const rPA = cp['relacionPA'] as Record<string, number> | undefined;
  if (rPA) {
    addSubsectionTitle(ws, 'Relación profesores / auxiliares', 3);
    const ratioPA = (rPA['auxiliares'] ?? 0) > 0
      ? (rPA['profesores'] / rPA['auxiliares']).toFixed(2) : 'Sin auxiliares';
    addKvRow(ws, 'Profesores',   fmtNum(rPA['profesores']));
    addKvRow(ws, 'Auxiliares',   fmtNum(rPA['auxiliares']));
    addKvRow(ws, 'Relación P/A', ratioPA);
  }

  // Distribución por categoría de designación
  const dedTipo = cp['dedicacionPorTipo'] as Record<string, unknown>[] | undefined;
  if (dedTipo && dedTipo.length > 0) {
    addSubsectionTitle(ws, 'Distribución por categoría de designación', 3);
    const hdr1 = addTableHdr(ws, ['Categoría', 'Docentes', '% plantel']);
    ws.autoFilter = { from: { row: hdr1.number, column: 1 }, to: { row: hdr1.number, column: 3 } };
    for (const item of dedTipo) {
      const n = typeof item['docentes'] === 'number' ? item['docentes'] as number : 0;
      ws.addRow([
        safeStr(item['tipo']),
        typeof item['docentes'] === 'number' ? item['docentes'] : '—',
        pctOf(n),
      ]).height = 15;
    }
  }

  // Dedicación CONEAU
  const dedConeau = cp['dedicacionConeau'] as Record<string, unknown>[] | undefined;
  if (dedConeau && dedConeau.length > 0) {
    addSubsectionTitle(ws, 'Dedicación CONEAU', 3);
    const hdr2 = addTableHdr(ws, ['Categoría CONEAU', 'Docentes', '% plantel']);
    ws.autoFilter = { from: { row: hdr2.number, column: 1 }, to: { row: hdr2.number, column: 3 } };
    for (const item of dedConeau) {
      const cat = String(item['categoria'] ?? '—');
      const n   = typeof item['docentes'] === 'number' ? item['docentes'] as number : 0;
      const label = cat === 'NO_DETERMINADA' ? 'No determinada'
        : cat.charAt(0) + cat.slice(1).toLowerCase();
      ws.addRow([
        label,
        typeof item['docentes'] === 'number' ? item['docentes'] : '—',
        pctOf(n),
      ]).height = 15;
    }
  }

  // Nivel de posgrado D-06
  const distPosgrado = cp['distribucionPosgrado'] as Record<string, unknown>[] | undefined;
  if (distPosgrado && distPosgrado.length > 0) {
    addSubsectionTitle(ws, 'Nivel de posgrado (D-06)', 3);
    const hdr3 = addTableHdr(ws, ['Nivel de posgrado', 'Docentes', '% plantel']);
    ws.autoFilter = { from: { row: hdr3.number, column: 1 }, to: { row: hdr3.number, column: 3 } };
    for (const item of distPosgrado) {
      const tipo = String(item['tipo'] ?? '—');
      const n    = typeof item['docentes'] === 'number' ? item['docentes'] as number : 0;
      ws.addRow([
        tipo.charAt(0) + tipo.slice(1).toLowerCase(),
        typeof item['docentes'] === 'number' ? item['docentes'] : '—',
        pctOf(n),
      ]).height = 15;
    }
  }
}

// ── Exportación principal ──────────────────────────────────────────────────────

// ── B-01 — Composición del cuerpo docente ────────────────────────────────────

function buildHojaFacB01(ws: ExcelJS.Worksheet, snap: Record<string, unknown>): void {
  ws.columns = [
    { key: 'c1', width: 36 },
    { key: 'c2', width: 18 },
    { key: 'c3', width: 18 },
    { key: 'c4', width: 14 },
  ];
  const d = snap['composicion'] as Record<string, unknown> | undefined;
  addSectionTitle(ws, 'B-01 — Composición del cuerpo docente', 4);
  if (!d) { addNoDataRow(ws, 4); return; }

  addKvRow(ws, 'Total docentes',   fmtNum(d['totalDocentes']   as number));
  addKvRow(ws, 'Cargos P',         fmtNum(d['totalCargosP']   as number));
  addKvRow(ws, 'Cargos A',         fmtNum(d['totalCargosA']   as number));
  addKvRow(ws, 'Cargos Otros',     fmtNum(d['totalCargosOtros'] as number));
  addKvRow(ws, 'Total cargos',     fmtNum(d['totalCargos']    as number));
  addKvRow(ws, 'Estado de cálculo', String(d['estadoCalculo'] ?? '—').replace(/_/g, ' '));

  const porCarrera = d['porCarrera'] as Record<string, unknown>[] | undefined;
  addSubsectionTitle(ws, 'Distribución por carrera', 4);

  if (!porCarrera || porCarrera.length === 0) {
    addNoDataRow(ws, 4, 'Sin datos por carrera');
    return;
  }

  const hdr = addTableHdr(ws, ['Carrera', 'Total docentes', 'Total cargos', 'ID Carrera']);
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: hdr.number }];
  ws.autoFilter = { from: { row: hdr.number, column: 1 }, to: { row: hdr.number, column: 4 } };

  for (const c of porCarrera) {
    const r = ws.addRow([
      safeStr(c['carreraNombre']),
      typeof c['totalDocentes'] === 'number' ? c['totalDocentes'] : '—',
      typeof c['totalCargos']   === 'number' ? c['totalCargos']   : '—',
      safeStr(c['carreraId']),
    ]);
    r.height = 15;
  }
}

// ── B-02 — Formación y titulación docente ─────────────────────────────────────

function buildHojaFacB02(ws: ExcelJS.Worksheet, snap: Record<string, unknown>): void {
  ws.columns = [{ key: 'c1', width: 36 }, { key: 'c2', width: 22 }];
  const d = snap['formacion'] as Record<string, unknown> | undefined;
  addSectionTitle(ws, 'B-02 — Formación y titulación docente', 2);
  if (!d) { addNoDataRow(ws, 2); return; }

  const pct = d['completitudPromedio'] as number | null;
  addKvRow(ws, 'Total docentes',         fmtNum(d['totalDocentes']     as number));
  addKvRow(ws, 'Con título de grado',    fmtNum(d['conTituloGrado']    as number));
  addKvRow(ws, 'Sin título de grado',    fmtNum(d['sinTituloGrado']    as number));
  addKvRow(ws, 'Con título de posgrado', fmtNum(d['conTituloPosgrado'] as number));
  addKvRow(ws, 'Sin título de posgrado', fmtNum(d['sinTituloPosgrado'] as number));
  addKvRow(ws, 'Completitud promedio',
    pct !== null && pct !== undefined ? `${pct.toFixed(1)}%` : '—');
  addKvRow(ws, 'Estado de cálculo', String(d['estadoCalculo'] ?? '—').replace(/_/g, ' '));
}

// ── B-03 — Investigación y vinculación ───────────────────────────────────────

function buildHojaFacB03(ws: ExcelJS.Worksheet, snap: Record<string, unknown>): void {
  ws.columns = [{ key: 'c1', width: 36 }, { key: 'c2', width: 22 }];
  const d = snap['investigacion'] as Record<string, unknown> | undefined;
  addSectionTitle(ws, 'B-03 — Investigación y vinculación institucional', 2);
  if (!d) { addNoDataRow(ws, 2); return; }

  addKvRow(ws, 'Total docentes',              fmtNum(d['totalDocentes']            as number));
  addKvRow(ws, 'Con proyecto de investigación', fmtNum(d['conProyectoInvestigacion'] as number));
  addKvRow(ws, 'Con actividad de extensión',  fmtNum(d['conActividadExtension']    as number));
  addKvRow(ws, 'Con ambas actividades',       fmtNum(d['conAmbasActividades']      as number));
  addKvRow(ws, 'Sin ninguna actividad',       fmtNum(d['sinNinguna']               as number));
  addKvRow(ws, 'Estado de cálculo', String(d['estadoCalculo'] ?? '—').replace(/_/g, ' '));
}

// ── B-04 — Dedicaciones horarias ─────────────────────────────────────────────

function buildHojaFacB04(ws: ExcelJS.Worksheet, snap: Record<string, unknown>): void {
  ws.columns = [
    { key: 'c1', width: 36 },
    { key: 'c2', width: 20 },
    { key: 'c3', width: 28 },
    { key: 'c4', width: 14 },
  ];
  const d = snap['dedicaciones'] as Record<string, unknown> | undefined;
  addSectionTitle(ws, 'B-04 — Dedicaciones horarias (P-02)', 4);
  if (!d) { addNoDataRow(ws, 4); return; }

  const umbral = d['umbral'] as number | undefined;
  addKvRow(ws, 'Total docentes',     fmtNum(d['totalDocentes']      as number));
  addKvRow(ws, 'Umbral P-02',        umbral !== undefined ? `${umbral} h` : 'No configurado');
  addKvRow(ws, 'Baja dedicación',    fmtNum(d['totalBajaDedicacion'] as number));
  addKvRow(ws, 'Sin datos',          fmtNum(d['totalSinDatos']      as number));
  addKvRow(ws, 'Estado de cálculo',  String(d['estadoCalculo'] ?? '—').replace(/_/g, ' '));

  const enAlerta = d['enAlerta'] as Record<string, unknown>[] | undefined;
  addSubsectionTitle(ws, 'Docentes con baja dedicación (P-02)', 4);

  if (!enAlerta || enAlerta.length === 0) {
    addNoDataRow(ws, 4, 'Sin docentes en alerta de dedicación');
    return;
  }

  const hdr = addTableHdr(ws, ['Docente', 'Horas semanales', 'Motivo', 'ID Docente']);
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: hdr.number }];
  ws.autoFilter = { from: { row: hdr.number, column: 1 }, to: { row: hdr.number, column: 4 } };

  for (const e of enAlerta) {
    const hs = e['horasSemanales'] as number | undefined;
    const r = ws.addRow([
      safeStr(e['nombre']),
      typeof hs === 'number' ? hs : '—',
      safeStr(e['motivo']),
      safeStr(e['docenteId']),
    ]);
    r.height = 15;
    if (typeof hs === 'number') {
      r.getCell(2).style = {
        fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } },
        font:      { color: { argb: 'FFb91c1c' } },
        alignment: { horizontal: 'right' },
      };
    }
  }
}

// ── B-05 — Carga académica ────────────────────────────────────────────────────

function buildHojaFacB05(ws: ExcelJS.Worksheet, snap: Record<string, unknown>): void {
  ws.columns = [
    { key: 'c1', width: 36 },
    { key: 'c2', width: 20 },
    { key: 'c3', width: 14 },
    { key: 'c4', width: 14 },
  ];
  const d = snap['cargaAcademica'] as Record<string, unknown> | undefined;
  addSectionTitle(ws, 'B-05 — Carga académica (P-03)', 4);
  if (!d) { addNoDataRow(ws, 4); return; }

  const estado = d['estadoCalculo'] as string | undefined;
  if (estado === 'NO_DETERMINABLE') {
    addAlcanceParcialRow(ws, 4,
      'No determinable: el parámetro P-03 (límite máximo de materias) no está configurado para esta facultad.');
    addKvRow(ws, 'Estado de cálculo', 'NO DETERMINABLE');
    return;
  }

  const limite = d['limiteMaxMat'] as number | null;
  addKvRow(ws, 'Total docentes',    fmtNum(d['totalDocentes']       as number));
  addKvRow(ws, 'Límite P-03',       limite !== null && limite !== undefined ? limite : 'No configurado');
  addKvRow(ws, 'Sobreasignados',    fmtNum(d['totalSobreasignados'] as number));
  addKvRow(ws, 'Estado de cálculo', String(estado ?? '—').replace(/_/g, ' '));

  const sobreasignados = d['sobreasignados'] as Record<string, unknown>[] | undefined;
  addSubsectionTitle(ws, 'Docentes sobreasignados', 4);

  if (!sobreasignados || sobreasignados.length === 0) {
    addNoDataRow(ws, 4, 'Sin docentes sobreasignados');
    return;
  }

  const hdr = addTableHdr(ws, ['Docente', 'Materias asignadas', 'Exceso', 'ID Docente']);
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: hdr.number }];
  ws.autoFilter = { from: { row: hdr.number, column: 1 }, to: { row: hdr.number, column: 4 } };

  for (const s of sobreasignados) {
    const exceso = s['exceso'] as number | undefined;
    const r = ws.addRow([
      safeStr(s['nombre']),
      typeof s['nMaterias'] === 'number' ? s['nMaterias'] : '—',
      typeof exceso         === 'number' ? exceso         : '—',
      safeStr(s['docenteId']),
    ]);
    r.height = 15;
    if (typeof exceso === 'number' && exceso > 0) {
      r.getCell(3).style = {
        fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } },
        font:      { bold: true, color: { argb: 'FFb91c1c' } },
        alignment: { horizontal: 'right' },
      };
    }
  }
}

// ── B-06 — Distribución de materias (R-06) ───────────────────────────────────

function buildHojaFacB06(ws: ExcelJS.Worksheet, snap: Record<string, unknown>): void {
  ws.columns = [
    { key: 'c1', width: 36 },
    { key: 'c2', width: 20 },
    { key: 'c3', width: 14 },
  ];
  const d = snap['distribucionMaterias'] as Record<string, unknown> | undefined;
  addSectionTitle(ws, 'B-06 — Distribución de materias por docente (R-06)', 3);

  if (!d) {
    addNoDataRow(ws, 3, 'B-06 — Información no disponible en este período (snapshot histórico)');
    return;
  }

  const promedio = d['promedio'] as number | null;
  const mediana  = d['mediana']  as number | null;
  const maximo   = d['maximo']   as number | null;
  addKvRow(ws, 'Total docentes', fmtNum(d['totalDocentes'] as number));
  addKvRow(ws, 'Promedio',       promedio !== null && promedio !== undefined ? promedio : '—');
  addKvRow(ws, 'Mediana',        mediana  !== null && mediana  !== undefined ? mediana  : '—');
  addKvRow(ws, 'Máximo',         maximo   !== null && maximo   !== undefined ? maximo   : '—');
  addKvRow(ws, 'Estado de cálculo', String(d['estadoCalculo'] ?? '—').replace(/_/g, ' '));

  const distribucion = d['distribucion'] as Record<string, unknown>[] | undefined;
  addSubsectionTitle(ws, 'Materias asignadas por docente', 3);

  if (!distribucion || distribucion.length === 0) {
    addNoDataRow(ws, 3, 'Sin datos de distribución');
    return;
  }

  const hdr = addTableHdr(ws, ['Docente', 'N.° de materias', 'ID Docente']);
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: hdr.number }];
  ws.autoFilter = { from: { row: hdr.number, column: 1 }, to: { row: hdr.number, column: 3 } };

  for (const item of distribucion) {
    const nMat = item['nMaterias'] as number | undefined;
    const r = ws.addRow([
      safeStr(item['nombre']),
      typeof nMat === 'number' ? nMat : '—',
      safeStr(item['docenteId']),
    ]);
    r.height = 15;
  }
}

export async function generarExcelBuffer(data: SnapshotExport, nombreInstitucion = 'Universidad de la Marina Mercante'): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator  = 'UDEMM Global';
  wb.subject  = 'Autoevaluación Institucional';
  wb.created  = new Date();
  wb.modified = new Date();

  buildHojaResumen(    wb.addWorksheet('Resumen'),     data, nombreInstitucion);
  buildHojaIndicadores(wb.addWorksheet('Indicadores'), data);
  buildHojaAlertas(    wb.addWorksheet('Alertas'),     data);

  if (data.ambito === 'PLAN') {
    buildHojaIPL01(        wb.addWorksheet('IPL-01 Horas Plan'),     data.snapshot);
    buildHojaIPL02(        wb.addWorksheet('IPL-02 Cobertura'),      data.snapshot);
    buildHojaIPL03(        wb.addWorksheet('IPL-03 Responsables'),   data.snapshot);
    buildHojaIPL04(        wb.addWorksheet('IPL-04 Multirespons.'),  data.snapshot);
    buildHojaIPL05(        wb.addWorksheet('IPL-05 Horas Bloque'),   data.snapshot);
    buildHojaR11(          wb.addWorksheet('R-11 Programas'),        data.snapshot);
    buildHojaR13(          wb.addWorksheet('R-13 Practica'),         data.snapshot);
    buildHojaR14(          wb.addWorksheet('R-14 Conflictos'),       data.snapshot);
    buildHojaAdvertencias( wb.addWorksheet('Advertencias'),          data.snapshot);
  }

  if (data.ambito === 'CARRERA') {
    buildHojaCarIP04(        wb.addWorksheet('IP-04 Distribución'),   data.snapshot);
    buildHojaCarIP08(        wb.addWorksheet('IP-08 Relacion P-A'),   data.snapshot);
    buildHojaCarIP09(        wb.addWorksheet('IP-09 Completitud'),    data.snapshot);
    buildHojaCarIP10(        wb.addWorksheet('IP-10 Consistencia'),   data.snapshot);
    buildHojaCarIP13(        wb.addWorksheet('IP-13 Sobreasig.'),     data.snapshot);
    buildHojaCarR10(         wb.addWorksheet('R-10 Horas Doc.'),      data.snapshot);
    buildHojaCarR12(         wb.addWorksheet('R-12 Fichas Doc.'),     data.snapshot);
    buildHojaCarCondPlantell(wb.addWorksheet('Cond.Plantel CONEAU'),  data.snapshot);
    buildHojaAdvertencias(   wb.addWorksheet('Advertencias'),         data.snapshot);
  }

  if (data.ambito === 'FACULTAD') {
    buildHojaFacB01(     wb.addWorksheet('B-01 Composición'),   data.snapshot);
    buildHojaFacB02(     wb.addWorksheet('B-02 Formación'),     data.snapshot);
    buildHojaFacB03(     wb.addWorksheet('B-03 Investigación'), data.snapshot);
    buildHojaFacB04(     wb.addWorksheet('B-04 Dedicaciones'),  data.snapshot);
    buildHojaFacB05(     wb.addWorksheet('B-05 Carga Acad.'),   data.snapshot);
    buildHojaFacB06(     wb.addWorksheet('B-06 Dist. Mat.'),    data.snapshot);
    buildHojaAdvertencias(wb.addWorksheet('Advertencias'),      data.snapshot);
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
