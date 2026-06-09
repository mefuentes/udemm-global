'use client';

import Link from 'next/link';
import { jsPDF } from 'jspdf';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

interface Docente {
  id: string;
  nombre: string;
  apellido: string;
  cargo?: string;
  dedicacion?: string;
  tipoDocumento: string;
  numeroDocumento: string;
  correoElectronico: string;
  activo: boolean;
  fechaActualizacion: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

export default function DocentesPage() {
  const router = useRouter();
  const { token, obtenerTokenActual, logout, usuario } = useAuth();
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const [limite] = useState(10);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [filtroCargo, setFiltroCargo] = useState('');
  const [filtroDedicacion, setFiltroDedicacion] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'TODOS' | 'ACTIVO' | 'INACTIVO'>('TODOS');

  useEffect(() => {
    if (!token) return;
    if (usuario?.rol?.nombre === 'DOCENTE') {
      router.push('/docentes/mi-ficha');
      return;
    }
    fetchDocentes();
  }, [token, busqueda, pagina, limite, usuario, router]);

  async function fetchDocentes() {
    try {
      setError(null);
      const tok = obtenerTokenActual();
      if (!tok) throw new Error('No hay sesión activa');

      const url = new URL(`${API_URL}/docentes`);
      if (busqueda) url.searchParams.set('buscar', busqueda);
      url.searchParams.set('page', String(pagina));
      url.searchParams.set('limit', String(limite));

      const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${tok}` } });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const msg = data?.message ?? response.statusText ?? 'No se pudo cargar el listado';
        if (response.status === 401 || response.status === 403) { logout(); throw new Error(`Sesión inválida: ${msg}`); }
        throw new Error(msg);
      }

      setDocentes(data?.data ?? []);
      setTotal(data?.total ?? 0);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function exportPdf() {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 40;
    const tableWidth = pageWidth - marginX * 2;
    const columns = [
      { label: 'Apellido y Nombres', width: 170 },
      { label: 'Cargo', width: 110 },
      { label: 'Dedicación', width: 110 },
      { label: 'Estado', width: 70 },
    ];
    let y = 70;

    const drawHeader = () => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 76, 129);
      doc.setFontSize(22);
      doc.text('UDEMM', pageWidth / 2, 34, { align: 'center' });
      doc.setTextColor(51, 65, 85);
      doc.setFontSize(12);
      doc.text('Listado de Docentes', pageWidth / 2, 52, { align: 'center' });
    };

    const drawTableHeader = () => {
      doc.setFillColor(15, 76, 129);
      doc.rect(marginX, y, tableWidth, 24, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      let x = marginX;
      columns.forEach((col) => { doc.text(col.label, x + 6, y + 16); x += col.width; });
      y += 24;
    };

    const drawRow = (values: string[], idx: number) => {
      const rowH = 20;
      if (y + rowH > 800) { doc.addPage(); y = 50; drawHeader(); y += 20; drawTableHeader(); }
      doc.setFillColor(idx % 2 === 0 ? 248 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 252 : 255);
      doc.rect(marginX, y, tableWidth, rowH, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(marginX, y, tableWidth, rowH);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      let x = marginX;
      values.forEach((v, i) => {
        doc.text(v || '-', x + 6, y + 14, { maxWidth: columns[i].width - 10 });
        if (i < values.length - 1) doc.line(x + columns[i].width, y, x + columns[i].width, y + rowH);
        x += columns[i].width;
      });
      y += rowH;
    };

    drawHeader();
    y += 20;
    drawTableHeader();
    if (docentesFiltrados.length === 0) {
      drawRow(['-', '-', '-', '-'], 0);
    } else {
      docentesFiltrados.forEach((d, i) => drawRow([`${d.apellido} ${d.nombre}`, d.cargo ?? '-', d.dedicacion ?? '-', d.activo ? 'Activo' : 'Inactivo'], i));
    }
    doc.save(`docentes-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  async function exportFichaPorRegistro(docente: Docente) {
    const authToken = obtenerTokenActual();
    if (!authToken) return;
    let data: Record<string, unknown> = {};
    try {
      const res = await fetch(`${API_URL}/docentes/${docente.id}`, { headers: { Authorization: `Bearer ${authToken}` } });
      if (res.ok) data = await res.json();
    } catch { /* usa datos básicos */ }

    const parseLista = (raw: unknown): any[] => {
      if (typeof raw !== 'string' || !raw.trim()) return [];
      try { return JSON.parse(raw) ?? []; } catch { return []; }
    };

    const titulosGrado = parseLista(data.tituloGrado);
    const titulosPosgrado = parseLista(data.tituloPosgrado);
    const otrosTitulos = parseLista(data.otrosTitulos);
    const asignaturas = parseLista(data.asignaturasVinculadas);
    const cargosAcademicos = parseLista(data.cargosAcademicosJson);
    const proyectos = parseLista(data.proyectosInvestigacionJson);
    const actividades = parseLista(data.actividadesExtensionJson);
    const promociones = parseLista(data.registrosPromocionJson);
    const str = (v: unknown) => (typeof v === 'string' ? v : '') ?? '';

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 40;
    const tableWidth = pageWidth - marginX * 2;
    const labelColW = 190;
    const valueColW = tableWidth - labelColW;
    let y = 70;

    const checkPage = (h: number) => { if (y + h > 800) { doc.addPage(); y = 50; } };

    const drawHeader = (tabName: string, subtitle?: string) => {
      doc.setFillColor(15, 76, 129);
      doc.rect(marginX, y, tableWidth, 24, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(tabName, marginX + 8, y + 16);
      y += 24;
      if (subtitle) {
        doc.setFillColor(235, 241, 248);
        doc.rect(marginX, y, tableWidth, 18, 'F');
        doc.setDrawColor(190, 210, 230);
        doc.rect(marginX, y, tableWidth, 18);
        doc.setTextColor(15, 76, 129);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text(subtitle, marginX + 8, y + 12);
        y += 18;
      }
    };

    const drawSection = (tabName: string, subtitle: string | null, rows: Array<[string, string]>) => {
      checkPage(24 + (subtitle ? 18 : 0) + rows.length * 20 + 16);
      drawHeader(tabName, subtitle ?? undefined);
      doc.setTextColor(30, 41, 59);
      rows.forEach(([label, rawValue], idx) => {
        const value = rawValue && rawValue.trim() ? rawValue : '-';
        doc.setFillColor(idx % 2 === 0 ? 248 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 252 : 255);
        doc.rect(marginX, y, tableWidth, 20, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(marginX, y, tableWidth, 20);
        doc.line(marginX + labelColW, y, marginX + labelColW, y + 20);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(label, marginX + 6, y + 14);
        doc.setFont('helvetica', 'normal');
        doc.text((doc.splitTextToSize(value, valueColW - 10) as string[])[0] ?? '-', marginX + labelColW + 6, y + 14);
        y += 20;
      });
      y += 12;
    };

    const drawTableSection = (
      tabName: string, subtitle: string | null,
      headers: string[], rows: string[][], colFractions: number[], summaryLines?: string[]
    ) => {
      const hdrH = 18; const rowH = 18;
      const colWidths = colFractions.map(f => f * tableWidth);
      checkPage(24 + (subtitle ? 18 : 0) + hdrH + Math.max(rows.length, 1) * rowH + 16);
      drawHeader(tabName, subtitle ?? undefined);
      doc.setFillColor(226, 232, 240);
      doc.rect(marginX, y, tableWidth, hdrH, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(marginX, y, tableWidth, hdrH);
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      let cx = marginX;
      headers.forEach((h, i) => { if (i > 0) doc.line(cx, y, cx, y + hdrH); doc.text(h.toUpperCase(), cx + 4, y + 12); cx += colWidths[i]; });
      y += hdrH;
      if (rows.length === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, y, tableWidth, rowH, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(marginX, y, tableWidth, rowH);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(148, 163, 184);
        doc.text('Sin registros', marginX + 6, y + 12);
        y += rowH;
      } else {
        rows.forEach((row, idx) => {
          if (y + rowH > 800) { doc.addPage(); y = 50; }
          doc.setFillColor(idx % 2 === 0 ? 248 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 252 : 255);
          doc.rect(marginX, y, tableWidth, rowH, 'F');
          doc.setDrawColor(226, 232, 240);
          doc.rect(marginX, y, tableWidth, rowH);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(30, 41, 59);
          let colX = marginX;
          row.forEach((cell, i) => {
            if (i > 0) doc.line(colX, y, colX, y + rowH);
            doc.text((doc.splitTextToSize(cell || '-', colWidths[i] - 8) as string[])[0] ?? '-', colX + 4, y + 12);
            colX += colWidths[i];
          });
          y += rowH;
        });
      }
      if (summaryLines?.length) {
        const sumH = summaryLines.length * 16;
        doc.setFillColor(241, 245, 249);
        doc.rect(marginX, y, tableWidth, sumH, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(marginX, y, tableWidth, sumH);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 76, 129);
        summaryLines.forEach((line, i) => doc.text(line, marginX + 6, y + 11 + i * 16));
        y += sumH;
      }
      y += 12;
    };

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 76, 129);
    doc.setFontSize(22);
    doc.text('UDEMM', pageWidth / 2, 34, { align: 'center' });
    doc.setFontSize(12);
    doc.setTextColor(51, 65, 85);
    doc.text('Ficha Docente Completa', pageWidth / 2, 52, { align: 'center' });

    drawSection('Datos Personales', 'Identidad', [
      ['Apellido', str(data.apellido || docente.apellido)],
      ['Nombres', str(data.nombre || docente.nombre)],
      ['Sexo', str(data.sexo)],
      ['Fecha de nacimiento', str(data.fechaNacimiento)],
      ['Tipo de documento', str(data.tipoDocumento || docente.tipoDocumento)],
      ['Número de documento', str(data.numeroDocumento || docente.numeroDocumento)],
      ['CUIT', str(data.cuit)],
      ['Email', str(data.correoElectronico || docente.correoElectronico)],
      ['Teléfono', str(data.telefono)],
    ]);
    drawSection('Datos Personales', 'Domicilio', [
      ['Calle', str(data.calle)],
      ['Número', str(data.numero)],
      ['Piso / Depto', str(data.pisoDepto)],
      ['Residencia', str(data.residencia)],
      ['Provincia', str(data.provincia)],
      ['Localidad', str(data.localidad)],
      ['Código Postal', str(data.codigoPostal)],
    ]);

    drawTableSection('Formación Académica', 'Títulos de Grado',
      ['Denominación', 'Año', 'País', 'Institución'],
      titulosGrado.map((t: any) => [t.denominacion, t.anio, t.pais, t.institucion]),
      [0.40, 0.12, 0.18, 0.30]);
    drawTableSection('Formación Académica', 'Títulos de Posgrado',
      ['Denominación', 'Tipo', 'Año', 'Institución'],
      titulosPosgrado.map((t: any) => [t.denominacion, t.tipo, t.anio, t.institucion]),
      [0.36, 0.18, 0.12, 0.34]);
    drawTableSection('Formación Académica', 'Otros Títulos',
      ['Denominación', 'Tipo', 'Año', 'Institución'],
      otrosTitulos.map((t: any) => [t.denominacion, t.tipo, t.anio, t.institucion]),
      [0.36, 0.18, 0.12, 0.34]);

    drawSection('Cargo Docente', null, [
      ['Unidad académica', str(data.unidadAcademica)],
      ['Categoría', str(data.categoriaDocente)],
      ['Dedicación', str(data.dedicacion)],
      ['Ded. declarada semanal (h)', str(data.dedicacionDeclaradaSemanal)],
      ['Fecha inicio', str(data.fechaInicioCargo)],
      ['Fecha fin', str(data.fechaFinCargo) || 'Vacío = Vigente'],
      ['Designación', str(data.designacion)],
      ['Disciplina del cargo', str(data.disciplinaCargo)],
    ]);
    drawTableSection('Cargo Docente', 'Asignaturas Vinculadas',
      ['Asignatura', 'Año inicio', 'Responsable', 'Estado'],
      asignaturas.map((a: any) => [a.asignatura, a.anioInicio, a.responsable, a.estado]),
      [0.40, 0.18, 0.18, 0.24]);

    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const cargosVig = cargosAcademicos.filter((c: any) => !c.fechaFin || new Date(c.fechaFin + 'T00:00:00') >= hoy);
    const totalHsG = cargosVig.reduce((s: number, c: any) => s + (parseInt(c.horasSemanales, 10) || 0), 0);
    drawTableSection('Cargos Académicos', 'Cargos Académicos Vigentes',
      ['Función', 'Unidad académica', 'Hs sem.', 'Fecha inicio', 'Fecha fin'],
      cargosAcademicos.map((c: any) => [c.funcion, c.unidadAcademica, c.horasSemanales, c.fechaInicio, c.fechaFin || 'Vigente']),
      [0.28, 0.28, 0.10, 0.17, 0.17],
      [`Cargos vigentes: ${cargosVig.length}`, `Total horas gestión académica (semanales): ${totalHsG} h`]);

    const proyVig = proyectos.filter((p: any) => !p.fechaFin || new Date(p.fechaFin + 'T00:00:00') >= hoy);
    const totalHsI = proyVig.reduce((s: number, p: any) => s + (parseInt(p.horasSemanales, 10) || 0), 0);
    drawTableSection('Investigación', 'Proyectos de Investigación Vigentes',
      ['Título', 'Institución', 'Hs sem.', 'Vinculado', 'F. inicio', 'F. fin'],
      proyectos.map((p: any) => [p.titulo, p.institucion, p.horasSemanales, p.vinculadoCarrera, p.fechaInicio, p.fechaFin || 'Vigente']),
      [0.26, 0.22, 0.09, 0.13, 0.15, 0.15],
      [`Proyectos vigentes: ${proyVig.length}`, `Total horas investigación (semanales): ${totalHsI} h`]);

    const actVig = actividades.filter((a: any) => !a.fechaFin || new Date(a.fechaFin + 'T00:00:00') >= hoy);
    const totalHsE = actVig.reduce((s: number, a: any) => s + (parseInt(a.horasSemanales, 10) || 0), 0);
    drawTableSection('Extensión Universitaria', 'Actividades de Extensión Vigentes',
      ['Título', 'Rol', 'Hs sem.', 'Vinculación', 'Carrera', 'F. inicio', 'F. fin'],
      actividades.map((a: any) => [a.titulo, a.rol, a.horasSemanales, a.vinculacionCarrera, a.carreraVinculada, a.fechaInicio, a.fechaFin || 'Vigente']),
      [0.22, 0.14, 0.08, 0.14, 0.16, 0.13, 0.13],
      [`Actividades vigentes: ${actVig.length}`, `Total horas extensión (semanales): ${totalHsE} h`]);

    drawTableSection('Promoción', 'Sistemas de Promoción Registrados',
      ['Sistema', 'Categoría', 'Fecha alta'],
      promociones.map((r: any) => [r.sistema, r.categoria, r.fechaAlta || '-']),
      [0.45, 0.25, 0.30],
      [`Registros cargados: ${promociones.length}`]);

    doc.save(`ficha-docente-${(data.apellido as string || docente.apellido).toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  const totalPaginas = Math.max(1, Math.ceil(total / limite));
  const roleName = (usuario as any)?.rol?.nombre ?? null;
  const canCreate = ['ADMINISTRADOR_SISTEMA', 'DECANO', 'RECTORADO', 'SECRETARIA_ACADEMICA'].includes(roleName);
  const canExport = ['ADMINISTRADOR_SISTEMA', 'DECANO', 'RECTORADO', 'SECRETARIA_ACADEMICA', 'ADMINISTRATIVO', 'DIRECTOR_CARRERA'].includes(roleName);

  const cargosDisponibles = useMemo(
    () => Array.from(new Set(docentes.map((d) => (d.cargo ?? '').trim()).filter(Boolean))),
    [docentes]
  );
  const dedicacionesDisponibles = useMemo(
    () => Array.from(new Set(docentes.map((d) => (d.dedicacion ?? '').trim()).filter(Boolean))),
    [docentes]
  );
  const docentesFiltrados = useMemo(
    () => docentes.filter((d) => {
      const okCargo = !filtroCargo || (d.cargo ?? '') === filtroCargo;
      const okDed = !filtroDedicacion || (d.dedicacion ?? '') === filtroDedicacion;
      const okEstado = filtroEstado === 'TODOS' || (filtroEstado === 'ACTIVO' && d.activo) || (filtroEstado === 'INACTIVO' && !d.activo);
      return okCargo && okDed && okEstado;
    }),
    [docentes, filtroCargo, filtroDedicacion, filtroEstado]
  );

  const INPUT_CLS = 'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-[#0f4c81] focus:ring-1 focus:ring-[#0f4c81]/20';

  if (!token) {
    return (
      <main className="p-6 sm:p-8">
        <div className="max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-800">Docentes</h1>
          <p className="mt-2 text-sm text-slate-600">Debés iniciar sesión para acceder al módulo de docentes.</p>
          <Link href="/login" className="mt-4 inline-flex rounded-md bg-[#0f4c81] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a3960]">
            Ir al login
          </Link>
        </div>
      </main>
    );
  }

  if (usuario?.rol?.nombre === 'DOCENTE') {
    return (
      <main className="p-6 sm:p-8">
        <div className="max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-800">Docentes</h1>
          <p className="mt-2 text-sm text-slate-600">No tiene permisos para ver el listado general.</p>
          <Link href="/docentes/mi-ficha" className="mt-4 inline-flex rounded-md bg-[#0f4c81] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a3960]">
            Ir a mi ficha docente
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto space-y-5">

      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Módulo</p>
          <h1 className="text-xl font-bold text-slate-800">Docentes</h1>
          <p className="text-sm text-slate-500 mt-0.5">Listado, búsqueda y gestión de fichas docentes.</p>
        </div>
        {canCreate && (
          <Link
            href="/docentes/mi-ficha?modo=nuevo"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#0f4c81] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0a3960]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo docente
          </Link>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>
      )}

      {/* Panel de listado */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">

        {/* Filtros */}
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, apellido o email..."
            className={`${INPUT_CLS} min-w-[200px] flex-1`}
          />
          <select value={filtroCargo} onChange={(e) => setFiltroCargo(e.target.value)} className={INPUT_CLS}>
            <option value="">Cargo: Todos</option>
            {cargosDisponibles.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filtroDedicacion} onChange={(e) => setFiltroDedicacion(e.target.value)} className={INPUT_CLS}>
            <option value="">Dedicación: Todas</option>
            {dedicacionesDisponibles.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as 'TODOS' | 'ACTIVO' | 'INACTIVO')} className={INPUT_CLS}>
            <option value="TODOS">Estado: Todos</option>
            <option value="ACTIVO">Activo</option>
            <option value="INACTIVO">Inactivo</option>
          </select>
          {canExport && (
            <button
              type="button"
              onClick={exportPdf}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Exportar PDF
            </button>
          )}
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-[#0f4c81] text-white text-xs font-semibold uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Apellido y Nombres</th>
                <th className="px-4 py-3 text-left">Cargo</th>
                <th className="px-4 py-3 text-left">Dedicación</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Última actualización</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {docentesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                    No se encontraron docentes con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                docentesFiltrados.map((docente, idx) => (
                  <tr
                    key={docente.id}
                    className={`cursor-pointer border-t border-slate-100 hover:bg-sky-50/50 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/50' : ''}`}
                    onClick={() => router.push(`/docentes/mi-ficha?docenteId=${docente.id}`)}
                  >
                    <td className="px-4 py-2.5 font-medium text-slate-800">
                      {docente.apellido}, {docente.nombre}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{docente.cargo ?? '-'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{docente.dedicacion ?? '-'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                        docente.activo
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {docente.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">
                      {new Date(docente.fechaActualizacion).toLocaleDateString('es-AR')}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); exportFichaPorRegistro(docente); }}
                        className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                      >
                        Exportar ficha
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>Página {pagina} de {totalPaginas} · {total} docente{total !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPagina(Math.max(1, pagina - 1))}
              disabled={pagina <= 1}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              ← Anterior
            </button>
            <button
              type="button"
              onClick={() => setPagina(Math.min(totalPaginas, pagina + 1))}
              disabled={pagina >= totalPaginas}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Siguiente →
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
