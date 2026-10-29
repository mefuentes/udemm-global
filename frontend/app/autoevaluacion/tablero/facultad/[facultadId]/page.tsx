'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, mensajeErrorHttp } from '@/lib/api';
import type {
  BloqueCargaAcademica,
  BloqueDedicaciones,
  BloqueDistribucionMaterias,
  BloqueFormacion,
  BloqueInvestigacion,
  DistribucionCarreraFacultad,
  DocenteBajaDedicacion,
  DocenteSobreasignadoFacultad,
  EstadoCalculo,
  TablroFacultadResponse,
} from './types';
import type { HistorialAnalisis, ItemHistorial, MetadataEjecucion } from '../../../analisis/analisis.types';

// ── Helpers visuales ─────────────────────────────────────────────────────────

function estadoCls(ec: EstadoCalculo): string {
  if (ec === 'CALCULADO')       return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (ec === 'PARCIAL')         return 'bg-amber-50 text-amber-700 border-amber-200';
  if (ec === 'NO_DETERMINABLE') return 'bg-slate-100 text-slate-600 border-slate-200';
  return 'bg-sky-50 text-sky-700 border-sky-200';
}

function estadoLabel(ec: EstadoCalculo): string {
  return ec.replace(/_/g, ' ');
}

function formatFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

// ── Iconos ───────────────────────────────────────────────────────────────────

const IcSpinner = ({ sm }: { sm?: boolean }) => (
  <span className={`inline-block rounded-full border-2 border-slate-300 border-t-[#0f4c81] animate-spin flex-shrink-0 ${sm ? 'w-3.5 h-3.5' : 'w-5 h-5'}`} />
);

const IcRefresh = () => (
  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

// ── Componentes compartidos ──────────────────────────────────────────────────

function EstadoBadge({ ec }: { ec: EstadoCalculo }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${estadoCls(ec)}`}>
      {estadoLabel(ec)}
    </span>
  );
}

function EtiquetaBloque({ numero, titulo }: { numero: string; titulo: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[11px] font-bold font-mono bg-[#0f4c81]/8 text-[#0f4c81] px-2 py-0.5 rounded border border-[#0f4c81]/10">
        {numero}
      </span>
      <span className="text-xs font-semibold text-slate-700">{titulo}</span>
    </div>
  );
}

function Metrica({ label, valor, destaca = false }: {
  label: string; valor: string | number; destaca?: boolean;
}) {
  return (
    <div className={`rounded-lg px-3 py-2 border text-center ${destaca ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5 leading-tight">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${destaca ? 'text-red-700' : 'text-slate-700'}`}>{valor}</p>
    </div>
  );
}

// ── Bloque 1 — Composición ────────────────────────────────────────────────────

function FilaCarrera({ c }: { c: DistribucionCarreraFacultad }) {
  return (
    <tr className="hover:bg-slate-50/60">
      <td className="px-3 py-1.5 text-xs text-slate-700">{c.nombreCarrera}</td>
      <td className="px-3 py-1.5 text-right tabular-nums text-xs text-slate-600">{c.totalDocentes}</td>
      <td className="px-3 py-1.5 text-right tabular-nums text-xs text-slate-600">{c.totalCargos}</td>
    </tr>
  );
}

function BloqueComposicion({ dato }: { dato: TablroFacultadResponse }) {
  const comp = dato.composicion;
  const ec = comp.estadoCalculo;
  if (ec === 'NO_APLICA') {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <EtiquetaBloque numero="B-01" titulo="Composición del plantel" />
        <p className="text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded-lg p-3">Sin docentes activos con vinculaciones aprobadas.</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <EtiquetaBloque numero="B-01" titulo="Composición del plantel" />
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Metrica label="Docentes únicos" valor={comp.totalDocentes} />
        <Metrica label="Cargos P" valor={comp.totalCargosP} />
        <Metrica label="Cargos A" valor={comp.totalCargosA} />
        <Metrica label="Cargos Otros" valor={comp.totalCargosOtros} />
        <Metrica label="Total cargos" valor={comp.totalCargos} />
      </div>
      {comp.porCarrera.length > 0 && (
        <details className="mt-3 group">
          <summary className="cursor-pointer text-[11px] font-semibold text-slate-500 hover:text-slate-700 select-none list-none flex items-center gap-1.5">
            <span className="inline-block transition-transform group-open:rotate-90">▶</span>
            Distribución por carrera ({comp.porCarrera.length})
          </summary>
          <div className="mt-2 overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-3 py-1.5 font-semibold text-slate-500">Carrera</th>
                  <th className="text-right px-3 py-1.5 font-semibold text-slate-500">Docentes</th>
                  <th className="text-right px-3 py-1.5 font-semibold text-slate-500">Cargos</th>
                </tr>
              </thead>
              <tbody>
                {comp.porCarrera.map(c => <FilaCarrera key={c.carreraId} c={c} />)}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <div className="flex justify-end mt-2">
        <EstadoBadge ec={ec} />
      </div>
    </div>
  );
}

// ── Bloque 2 — Formación ──────────────────────────────────────────────────────

function BloqueFormacionComp({ form }: { form: BloqueFormacion }) {
  const ec = form.estadoCalculo;
  if (ec === 'NO_APLICA') {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <EtiquetaBloque numero="B-02" titulo="Formación docente" />
        <p className="text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded-lg p-3">Sin plantel activo.</p>
      </div>
    );
  }
  const pct = form.completitudPromedio;
  const colorPct = pct === null ? 'text-slate-400' : pct >= 80 ? 'text-emerald-700' : pct >= 50 ? 'text-amber-700' : 'text-red-700';
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <EtiquetaBloque numero="B-02" titulo="Formación docente" />
      <div className="flex items-center gap-4 mb-3">
        <div className="text-center flex-shrink-0">
          <p className={`text-4xl font-black tabular-nums ${colorPct}`}>{pct ?? '—'}%</p>
          <p className="text-[10px] text-slate-400 mt-0.5">con título de grado</p>
        </div>
        <div className="grid grid-cols-2 gap-2 flex-1">
          <Metrica label="Con grado" valor={form.conTituloGrado} />
          <Metrica label="Sin grado" valor={form.sinTituloGrado} destaca={form.sinTituloGrado > 0} />
          <Metrica label="Con posgrado" valor={form.conTituloPosgrado} />
          <Metrica label="Sin posgrado" valor={form.sinTituloPosgrado} />
        </div>
      </div>
      <div className="flex justify-end mt-1">
        <EstadoBadge ec={ec} />
      </div>
    </div>
  );
}

// ── Bloque 3 — Investigación y vinculación ────────────────────────────────────

function BloqueInvestigacionComp({ inv }: { inv: BloqueInvestigacion }) {
  const ec = inv.estadoCalculo;
  if (ec === 'NO_APLICA') {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <EtiquetaBloque numero="B-03" titulo="Investigación y vinculación" />
        <p className="text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded-lg p-3">Sin plantel activo.</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <EtiquetaBloque numero="B-03" titulo="Investigación y vinculación" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metrica label="Total docentes" valor={inv.totalDocentes} />
        <Metrica label="Proyectos I+D" valor={inv.conProyectoInvestigacion} />
        <Metrica label="Extensión" valor={inv.conActividadExtension} />
        <Metrica label="Ambas activ." valor={inv.conAmbasActividades} />
      </div>
      {inv.sinNinguna > 0 && (
        <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
          <p className="text-[11px] text-amber-700">
            {inv.sinNinguna} docente{inv.sinNinguna !== 1 ? 's' : ''} sin proyecto de investigación ni actividad de extensión declarados.
          </p>
        </div>
      )}
      {inv.sinNinguna === 0 && (
        <p className="mt-2 text-xs text-emerald-700 flex items-center gap-1.5">
          <span className="text-emerald-500">✓</span> Todos los docentes tienen al menos una actividad declarada.
        </p>
      )}
      <div className="flex justify-end mt-2">
        <EstadoBadge ec={ec} />
      </div>
    </div>
  );
}

// ── Bloque 4 — Dedicaciones ───────────────────────────────────────────────────

function FilaBajaDedicacion({ d }: { d: DocenteBajaDedicacion }) {
  return (
    <tr className="hover:bg-slate-50/60">
      <td className="px-3 py-1.5 text-xs text-slate-700">
        <Link href={`/autoevaluacion/ficha-docente/${d.docenteId}`} className="hover:underline text-[#0f4c81]">{d.nombre}</Link>
      </td>
      <td className="px-3 py-1.5 text-right tabular-nums text-xs text-amber-700 font-semibold">{d.cargaHorariaSemanal} h</td>
    </tr>
  );
}

function BloqueDedicacionesComp({ ded }: { ded: BloqueDedicaciones }) {
  const ec = ded.estadoCalculo;
  if (ec === 'NO_APLICA') {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <EtiquetaBloque numero="B-04" titulo="Dedicaciones" />
        <p className="text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded-lg p-3">Sin plantel activo.</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <EtiquetaBloque numero="B-04" titulo="Dedicaciones" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metrica label="Total docentes" valor={ded.totalDocentes} />
        <Metrica label="Baja dedicación" valor={ded.totalBajaDedicacion} destaca={ded.totalBajaDedicacion > 0} />
        <Metrica label="Sin datos" valor={ded.totalSinDatos} />
        <Metrica label={`Umbral (P-02)`} valor={`< ${ded.umbral} h`} />
      </div>
      {ded.totalBajaDedicacion === 0 && ec === 'CALCULADO' && (
        <p className="mt-2 text-xs text-emerald-700 flex items-center gap-1.5">
          <span className="text-emerald-500">✓</span> Sin docentes con baja dedicación horaria.
        </p>
      )}
      {ded.enAlerta.length > 0 && (
        <details className="mt-3 group">
          <summary className="cursor-pointer text-[11px] font-semibold text-slate-500 hover:text-slate-700 select-none list-none flex items-center gap-1.5">
            <span className="inline-block transition-transform group-open:rotate-90">▶</span>
            Docentes con baja dedicación ({ded.enAlerta.length})
          </summary>
          <div className="mt-2 overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-3 py-1.5 font-semibold text-slate-500">Docente</th>
                  <th className="text-right px-3 py-1.5 font-semibold text-amber-600">Hs. semanales</th>
                </tr>
              </thead>
              <tbody>
                {ded.enAlerta.map(d => <FilaBajaDedicacion key={d.docenteId} d={d} />)}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <div className="flex justify-end mt-2">
        <EstadoBadge ec={ec} />
      </div>
    </div>
  );
}

// ── Bloque 5 — Carga académica ────────────────────────────────────────────────

function FilaSobreasignado({ d }: { d: DocenteSobreasignadoFacultad }) {
  return (
    <tr className="hover:bg-slate-50/60">
      <td className="px-3 py-1.5 text-xs text-slate-700">
        <Link href={`/autoevaluacion/ficha-docente/${d.docenteId}`} className="hover:underline text-[#0f4c81]">{d.nombre}</Link>
      </td>
      <td className="px-3 py-1.5 text-right tabular-nums text-xs text-slate-600">{d.nMaterias}</td>
      <td className="px-3 py-1.5 text-right tabular-nums text-xs text-red-600 font-semibold">+{d.exceso}</td>
    </tr>
  );
}

function BloqueCargaAcademicaComp({ carga }: { carga: BloqueCargaAcademica }) {
  const ec = carga.estadoCalculo;
  if (ec === 'NO_DETERMINABLE') {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <EtiquetaBloque numero="B-05" titulo="Carga académica" />
        <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
          El parámetro P-03 (máximo de materias por docente) no está configurado para esta facultad.
        </p>
      </div>
    );
  }
  if (ec === 'NO_APLICA') {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <EtiquetaBloque numero="B-05" titulo="Carga académica" />
        <p className="text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded-lg p-3">Sin plantel activo.</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <EtiquetaBloque numero="B-05" titulo="Carga académica" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Metrica label="Total docentes" valor={carga.totalDocentes} />
        <Metrica label="Sobreasignados" valor={carga.totalSobreasignados} destaca={carga.totalSobreasignados > 0} />
        <Metrica label="Límite P-03" valor={carga.limiteMaxMat ?? '—'} />
      </div>
      {carga.totalSobreasignados === 0 && (
        <p className="mt-2 text-xs text-emerald-700 flex items-center gap-1.5">
          <span className="text-emerald-500">✓</span> Sin docentes sobreasignados en la facultad.
        </p>
      )}
      {carga.sobreasignados.length > 0 && (
        <details className="mt-3 group">
          <summary className="cursor-pointer text-[11px] font-semibold text-slate-500 hover:text-slate-700 select-none list-none flex items-center gap-1.5">
            <span className="inline-block transition-transform group-open:rotate-90">▶</span>
            Docentes sobreasignados ({carga.sobreasignados.length})
          </summary>
          <div className="mt-2 overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-3 py-1.5 font-semibold text-slate-500">Docente</th>
                  <th className="text-right px-3 py-1.5 font-semibold text-slate-500">Materias</th>
                  <th className="text-right px-3 py-1.5 font-semibold text-red-500">Exceso</th>
                </tr>
              </thead>
              <tbody>
                {carga.sobreasignados.map(d => <FilaSobreasignado key={d.docenteId} d={d} />)}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <div className="flex justify-end mt-2">
        <EstadoBadge ec={ec} />
      </div>
    </div>
  );
}

// ── Bloque 6 — Distribución de materias por docente (R-06) ───────────────────

function BloqueDistribucionMateriasComp({ dist }: { dist: BloqueDistribucionMaterias }) {
  const ec = dist.estadoCalculo;
  if (ec === 'NO_APLICA') {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <EtiquetaBloque numero="B-06" titulo="Distribución de materias por docente" />
        <p className="text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded-lg p-3">Sin vinculaciones activas para calcular distribución (R-06).</p>
      </div>
    );
  }
  const fmt = (v: number | null) => v === null ? '—' : v % 1 === 0 ? String(v) : v.toFixed(1);
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <EtiquetaBloque numero="B-06" titulo="Distribución de materias por docente" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metrica label="Total docentes" valor={dist.totalDocentes} />
        <Metrica label="Promedio" valor={fmt(dist.promedio)} />
        <Metrica label="Mediana" valor={fmt(dist.mediana)} />
        <Metrica label="Máximo" valor={dist.maximo ?? '—'} destaca={(dist.maximo ?? 0) >= 5} />
      </div>
      {dist.distribucion.length > 0 && (
        <details className="mt-3 group">
          <summary className="cursor-pointer text-[11px] font-semibold text-slate-500 hover:text-slate-700 select-none list-none flex items-center gap-1.5">
            <span className="inline-block transition-transform group-open:rotate-90">▶</span>
            Detalle por docente ({dist.distribucion.length})
          </summary>
          <div className="mt-2 overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-3 py-1.5 font-semibold text-slate-500">Docente</th>
                  <th className="text-right px-3 py-1.5 font-semibold text-slate-500">N.° materias</th>
                </tr>
              </thead>
              <tbody>
                {dist.distribucion.map(d => (
                  <tr key={d.docenteId} className="hover:bg-slate-50/60">
                    <td className="px-3 py-1.5 text-xs text-slate-700">{d.nombre}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-xs text-slate-600">{d.nMaterias}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <div className="flex justify-end mt-2">
        <EstadoBadge ec={ec} />
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

function TablerFacultadInner() {
  const params = useParams<{ facultadId: string }>();
  const searchParams = useSearchParams();
  const facultadId = params.facultadId;

  const [facultadNombre, setFacultadNombre] = useState<string | null>(
    searchParams.get('nombre') ?? null,
  );

  const [dato, setDato] = useState<TablroFacultadResponse | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [corriendo,       setCorriendo]       = useState(false);
  const [errorAnalisis,   setErrorAnalisis]   = useState<string | null>(null);
  const [ultimaEjecucion, setUltimaEjecucion] = useState<MetadataEjecucion | null>(null);
  const [historial,       setHistorial]       = useState<HistorialAnalisis | null>(null);
  const [cargandoHist,    setCargandoHist]    = useState(false);
  const [paginaHistorial, setPaginaHistorial] = useState(1);
  const [exportando,      setExportando]      = useState<string | null>(null);
  const [errorExport,     setErrorExport]     = useState<string | null>(null);

  async function exportar(formato: 'pdf' | 'xlsx', ejecucionId?: string) {
    const key = ejecucionId ? `${ejecucionId}-${formato}` : formato;
    setExportando(key);
    setErrorExport(null);
    try {
      const url = ejecucionId
        ? `/autoevaluacion/exportar/ejecucion/${ejecucionId}/${formato}`
        : `/autoevaluacion/exportar/facultad/${facultadId}/${formato}`;
      const res = await apiFetch(url);
      if (!res.ok) { setErrorExport('Error al generar la exportación'); return; }
      const blob = await res.blob();
      const cd   = res.headers.get('Content-Disposition') ?? '';
      const name = cd.match(/filename="([^"]+)"/)?.[1] ?? `exportacion.${formato}`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { setErrorExport('Error de red al exportar'); }
    finally { setExportando(null); }
  }

  async function correrAnalisis() {
    setCorriendo(true);
    setErrorAnalisis(null);
    try {
      const res  = await apiFetch(`/autoevaluacion/analisis/facultad/${facultadId}`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(mensajeErrorHttp(res, data, 'Error al ejecutar análisis'));
      setUltimaEjecucion((data as { metadata: MetadataEjecucion }).metadata);
      cargarHistorial().catch(() => {});
    } catch (e) {
      setErrorAnalisis((e as Error).message);
    } finally {
      setCorriendo(false);
    }
  }

  async function cargarHistorial() {
    setCargandoHist(true);
    try {
      const res  = await apiFetch(`/autoevaluacion/analisis/facultad/${facultadId}/historial?pagina=${paginaHistorial}&porPagina=10`);
      const data = await res.json().catch(() => null);
      if (res.ok) setHistorial(data as HistorialAnalisis);
    } finally {
      setCargandoHist(false);
    }
  }

  useEffect(() => {
    if (facultadNombre || !facultadId) return;
    apiFetch(`/facultades/${facultadId}`)
      .then(r => (r.ok ? r.json() : null))
      .then((d: { nombre?: string } | null) => { if (d?.nombre) setFacultadNombre(d.nombre); })
      .catch(() => {});
  }, [facultadId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (facultadId) cargarHistorial(); }, [facultadId, paginaHistorial]); // eslint-disable-line react-hooks/exhaustive-deps

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const res = await apiFetch(`/autoevaluacion/tablero/facultad/${facultadId}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(mensajeErrorHttp(res, data, 'Error al cargar el tablero de facultad'));
      setDato(data as TablroFacultadResponse);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, [facultadId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-4xl mx-auto">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-5">
        <a href="/" className="hover:text-slate-600 transition-colors">Inicio</a>
        <span>/</span>
        <Link href="/autoevaluacion" className="hover:text-[#0f4c81] transition-colors">Autoevaluación</Link>
        <span>/</span>
        <span className="text-slate-600 font-medium">Tablero por facultad</span>
      </nav>

      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-lg font-bold text-slate-800 leading-tight">Tablero por facultad</h1>
          <p className="text-xs text-slate-400 mt-1">
            {facultadNombre ? `Facultad: ${facultadNombre} — ` : ''}MOD-AUT v2.0
            {dato && <> · Evaluado el {formatFecha(dato.fechaEvaluacion)}</>}
          </p>
        </div>
        <button
          onClick={cargar}
          disabled={cargando}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#0f4c81] hover:bg-[#0f4c81]/8 active:bg-[#0f4c81]/15 px-3 py-2 rounded-lg border border-[#0f4c81]/15 transition-colors disabled:opacity-50 flex-shrink-0"
        >
          {cargando ? <IcSpinner sm /> : <IcRefresh />}
          Actualizar
        </button>
      </div>

      {/* Estado general */}
      {dato && (
        <div className="flex flex-wrap items-center gap-2 mb-5 p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Estado general de cálculo:</span>
          <EstadoBadge ec={dato.estadoGeneralCalculo} />
          <span className="text-[10px] text-slate-400 italic">
            Estado más restrictivo entre los 6 bloques del tablero de facultad.
          </span>
        </div>
      )}

      {/* Loading inicial */}
      {cargando && !dato && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 flex items-center justify-center gap-3">
          <IcSpinner />
          <span className="text-sm text-slate-500">Calculando indicadores de la facultad...</span>
        </div>
      )}

      {/* Error */}
      {error && !cargando && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Bloques */}
      {dato && (
        <div className="space-y-4">
          <BloqueComposicion dato={dato} />
          <BloqueFormacionComp form={dato.formacion} />
          <BloqueInvestigacionComp inv={dato.investigacion} />
          <BloqueDedicacionesComp ded={dato.dedicaciones} />
          <BloqueCargaAcademicaComp carga={dato.cargaAcademica} />
          <BloqueDistribucionMateriasComp dist={dato.distribucionMaterias} />

          {/* Nota metodológica */}
          <p className="text-[10px] text-slate-400 text-center">
            Tablero MOD-AUT §3–6 — Facultad. Universo: docentes activos con vinculación APROBADA.
            B-04 usa umbral P-02 (p02BajaH); B-05 usa límite P-03 (p03MaxMat). Sin config → NO_DETERMINABLE.
            B-06 R-06: materias distintas (distinct materiaId) por docente, cross-carrera.
          </p>
        </div>
      )}

      {/* ── Panel: Correr análisis ─────────────────────────────────────── */}
      <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <p className="text-xs font-bold text-slate-700">Análisis explícito de la facultad</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Ejecuta y guarda una evaluación completa. Los resultados quedan disponibles en el historial.
            </p>
          </div>
          <button
            onClick={correrAnalisis}
            disabled={corriendo || !dato}
            className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold bg-[#0f4c81] text-white hover:bg-[#0f4c81]/90 active:bg-[#0f4c81]/80 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {corriendo ? <IcSpinner sm /> : null}
            {corriendo ? 'Ejecutando...' : 'Correr análisis'}
          </button>
        </div>

        {errorAnalisis && (
          <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 mb-3">
            {errorAnalisis}
          </div>
        )}

        {ultimaEjecucion && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs space-y-1 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-emerald-600 font-bold text-[11px]">✓ Guardado</span>
              <EstadoBadge ec={ultimaEjecucion.estadoCalculo} />
              <span className="text-[10px] font-mono text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                {ultimaEjecucion.ejecucionId.slice(0, 8)}…
              </span>
            </div>
            <p className="text-slate-500">{formatFecha(ultimaEjecucion.fechaEjecucion)}</p>
          </div>
        )}

        {/* Exportar facultad */}
        <div className="border-t border-slate-100 pt-3 mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Exportar última ejecución</p>
          {errorExport && <p className="text-[11px] text-red-600 mb-2">{errorExport}</p>}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => exportar('pdf')}
              disabled={!!exportando}
              className="flex items-center gap-1 text-[11px] font-semibold text-white bg-[#0f4c81] hover:bg-[#0f4c81]/90 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {exportando === 'pdf' ? <IcSpinner sm /> : null}
              PDF
            </button>
            <button
              onClick={() => exportar('xlsx')}
              disabled={!!exportando}
              className="flex items-center gap-1 text-[11px] font-semibold text-[#0f4c81] bg-white border border-[#0f4c81]/30 hover:bg-[#0f4c81]/5 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {exportando === 'xlsx' ? <IcSpinner sm /> : null}
              Excel
            </button>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Historial de ejecuciones</p>
            {cargandoHist && <IcSpinner sm />}
          </div>
          {historial && historial.items.length === 0 && !cargandoHist && (
            <p className="text-[11px] text-slate-400 italic">Sin ejecuciones registradas para esta facultad.</p>
          )}
          {historial && historial.items.length > 0 && (
            <div className="space-y-1.5">
              {historial.items.map((item: ItemHistorial) => (
                <div key={item.ejecucionId} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs flex-wrap">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${item.estadoEjecucion === 'COMPLETADO' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {item.estadoEjecucion}
                  </span>
                  {item.estadoCalculo && <EstadoBadge ec={item.estadoCalculo} />}
                  <span className="text-slate-500 text-[11px]">{formatFecha(item.fechaInicio)}</span>
                  <span className="font-mono text-[10px] text-slate-300">{item.ejecucionId.slice(0, 8)}…</span>
                  {item.errores && <span className="text-red-500 text-[10px]">{item.errores}</span>}
                  {item.estadoEjecucion === 'COMPLETADO' && (
                    <div className="ml-auto flex gap-1">
                      <button onClick={() => exportar('pdf', item.ejecucionId)} disabled={!!exportando} className="text-[10px] font-semibold text-[#0f4c81] hover:underline disabled:opacity-40">PDF</button>
                      <button onClick={() => exportar('xlsx', item.ejecucionId)} disabled={!!exportando} className="text-[10px] font-semibold text-[#0f4c81] hover:underline disabled:opacity-40">XLS</button>
                    </div>
                  )}
                </div>
              ))}
              {historial.total > historial.porPagina && (
                <div className="flex items-center justify-between mt-1">
                  <button
                    onClick={() => setPaginaHistorial((p) => Math.max(1, p - 1))}
                    disabled={paginaHistorial <= 1 || cargandoHist}
                    className="text-[10px] font-semibold text-[#0f4c81] hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ← Anterior
                  </button>
                  <span className="text-[10px] text-slate-400">
                    {historial.porPagina * (paginaHistorial - 1) + 1}–{Math.min(historial.porPagina * paginaHistorial, historial.total)} de {historial.total}
                  </span>
                  <button
                    onClick={() => setPaginaHistorial((p) => p + 1)}
                    disabled={paginaHistorial * historial.porPagina >= historial.total || cargandoHist}
                    className="text-[10px] font-semibold text-[#0f4c81] hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Siguiente →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

// ── Exportación con Suspense (requerido por useSearchParams en Next.js 14) ───

export default function TablerFacultadPage() {
  return (
    <Suspense fallback={null}>
      <TablerFacultadInner />
    </Suspense>
  );
}
