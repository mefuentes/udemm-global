'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch as apiFetchBase, mensajeErrorHttp } from '@/lib/api';

// ── API ────────────────────────────────────────────────────────────────────────

async function apiCall(path: string) {
  const res  = await apiFetchBase(path);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(mensajeErrorHttp(res, data, 'Error al cargar alertas'));
  return data;
}

// ── Tipos ──────────────────────────────────────────────────────────────────────

type Ambito        = 'FACULTAD' | 'CARRERA' | 'PLAN';
type GrupoAmbito   = 'DOCENTES' | 'PLANES' | 'CRUZADAS';
type Prioridad     = 'ALTA' | 'MEDIA' | 'INFORMATIVA';
type EstadoCalculo = 'CALCULADO' | 'PARCIAL' | 'NO_DETERMINABLE' | 'NO_APLICA' | null;

interface AlertaBandeja {
  ejecucionId:    string;
  ambito:         Ambito;
  entidadId:      string;
  facultadId:     string;
  /** Presente cuando ambito='CARRERA' (B-06). */
  carreraId?:     string;
  regla:          string;
  prioridad:      Prioridad;
  descripcion:    string;
  fechaEjecucion: string;
  estadoCalculo:  EstadoCalculo;
}

interface RespuestaBandeja {
  total:        number;
  pagina:       number;
  porPagina:    number;
  tieneAnalisis: boolean;
  items:        AlertaBandeja[];
}

// ── Estilos ────────────────────────────────────────────────────────────────────

function prioridadCls(p: Prioridad) {
  if (p === 'ALTA')        return 'bg-red-50 text-red-700 border-red-200';
  if (p === 'MEDIA')       return 'bg-amber-50 text-amber-700 border-amber-200';
  return                          'bg-sky-50 text-sky-600 border-sky-200';
}

function ambitoCls(a: Ambito) {
  if (a === 'FACULTAD') return 'bg-purple-50 text-purple-700 border-purple-200';
  if (a === 'CARRERA')  return 'bg-[#0f4c81]/8 text-[#0f4c81] border-[#0f4c81]/15';
  return                       'bg-violet-50 text-violet-700 border-violet-200';
}

function estadoCalculoCls(e: EstadoCalculo) {
  if (e === 'CALCULADO')       return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (e === 'PARCIAL')         return 'bg-amber-50 text-amber-700 border-amber-200';
  if (e === 'NO_DETERMINABLE') return 'bg-slate-100 text-slate-600 border-slate-200';
  if (e === 'NO_APLICA')       return 'bg-sky-50 text-sky-700 border-sky-200';
  return 'bg-slate-100 text-slate-400 border-slate-200';
}

function formatFecha(iso: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ── Iconos ─────────────────────────────────────────────────────────────────────

const IcSpinner = () => (
  <span className="inline-block w-5 h-5 rounded-full border-2 border-slate-300 border-t-[#0f4c81] animate-spin flex-shrink-0" />
);

const IcAlerta = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
  </svg>
);

// ── Componente principal ───────────────────────────────────────────────────────

export default function AlertasPage() {
  const [datos,      setDatos]      = useState<RespuestaBandeja | null>(null);
  const [cargando,   setCargando]   = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  const [filtroGrupo,     setFiltroGrupo]     = useState('');
  const [filtroPrioridad, setFiltroPrioridad] = useState('');
  const [filtroRegla,     setFiltroRegla]     = useState('');
  const [pagina,          setPagina]          = useState(1);

  const POR_PAGINA = 20;

  function buildUrl() {
    const params = new URLSearchParams();
    if (filtroGrupo)     params.set('grupoAmbito', filtroGrupo);
    if (filtroPrioridad) params.set('prioridad',   filtroPrioridad);
    if (filtroRegla)     params.set('regla',        filtroRegla.trim());
    params.set('pagina',    String(pagina));
    params.set('porPagina', String(POR_PAGINA));
    return `/autoevaluacion/alertas?${params}`;
  }

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const res = await apiCall(buildUrl());
      setDatos(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, [filtroGrupo, filtroPrioridad, filtroRegla, pagina]); // eslint-disable-line react-hooks/exhaustive-deps

  function resetFiltros() {
    setFiltroGrupo('');
    setFiltroPrioridad('');
    setFiltroRegla('');
    setPagina(1);
  }

  const hayFiltros = filtroGrupo || filtroPrioridad || filtroRegla;
  const totalPags  = datos ? Math.ceil(datos.total / POR_PAGINA) : 0;

  return (
    <div className="max-w-6xl mx-auto">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-5">
        <a href="/" className="hover:text-slate-600 transition-colors">Inicio</a>
        <span>/</span>
        <Link href="/autoevaluacion" className="hover:text-slate-600 transition-colors">Autoevaluación</Link>
        <span>/</span>
        <span className="text-slate-600 font-medium">Bandeja de alertas</span>
      </nav>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">MOD-AUT</p>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <IcAlerta />
            Bandeja global de alertas
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Alertas vigentes generadas a partir de los últimos análisis guardados por entidad.
          </p>
        </div>
        {datos && datos.total > 0 && (
          <div className="flex-shrink-0 text-right">
            <p className="text-2xl font-bold text-slate-800">{datos.total}</p>
            <p className="text-[11px] text-slate-400 uppercase tracking-wide">alerta{datos.total !== 1 ? 's' : ''}</p>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">Filtros</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Grupo</label>
            <select
              value={filtroGrupo}
              onChange={e => { setPagina(1); setFiltroGrupo(e.target.value as GrupoAmbito | ''); }}
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
            >
              <option value="">Todos los grupos</option>
              <option value="DOCENTES">Docentes</option>
              <option value="PLANES">Planes de estudio</option>
              <option value="CRUZADAS">Cruzadas</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Prioridad</label>
            <select
              value={filtroPrioridad}
              onChange={e => { setPagina(1); setFiltroPrioridad(e.target.value); }}
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
            >
              <option value="">Todas las prioridades</option>
              <option value="ALTA">Alta</option>
              <option value="MEDIA">Media</option>
              <option value="INFORMATIVA">Informativa</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Regla</label>
            <input
              type="text"
              value={filtroRegla}
              onChange={e => { setPagina(1); setFiltroRegla(e.target.value); }}
              placeholder="ej. R-03, IP-13, IPL-01…"
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
            />
          </div>
        </div>

        {hayFiltros && (
          <button
            onClick={resetFiltros}
            className="mt-3 text-[11px] text-slate-400 hover:text-slate-600 underline transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Contenido */}
      {cargando ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 flex items-center justify-center gap-3">
          <IcSpinner />
          <span className="text-sm text-slate-500">Cargando alertas...</span>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      ) : !datos || datos.total === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          {!datos?.tieneAnalisis && !hayFiltros ? (
            <>
              <div className="text-slate-300 mb-3">
                <svg className="w-10 h-10 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-600">Sin análisis ejecutados</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                La bandeja opera sobre análisis previos. Ejecute primero un análisis desde el
                tablero de la carrera, plan o facultad correspondiente.
              </p>
            </>
          ) : (
            <>
              <div className="text-slate-300 mb-3">
                <svg className="w-10 h-10 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-500">Sin alertas vigentes</p>
              <p className="text-xs text-slate-400 mt-1">
                {hayFiltros
                  ? 'No hay alertas que coincidan con los filtros aplicados.'
                  : 'Los últimos análisis no detectaron alertas activas.'}
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#0f4c81] text-white">
                  <th className="text-left px-4 py-3 font-semibold uppercase tracking-wide w-20">Prioridad</th>
                  <th className="text-left px-4 py-3 font-semibold uppercase tracking-wide w-20">Regla</th>
                  <th className="text-left px-4 py-3 font-semibold uppercase tracking-wide">Descripción</th>
                  <th className="text-center px-3 py-3 font-semibold uppercase tracking-wide w-24 hidden sm:table-cell">Ámbito</th>
                  <th className="text-center px-3 py-3 font-semibold uppercase tracking-wide w-28 hidden md:table-cell">Estado cálculo</th>
                  <th className="text-left px-3 py-3 font-semibold uppercase tracking-wide w-36 hidden lg:table-cell">Fecha análisis</th>
                  <th className="px-4 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {datos.items.map((alerta, idx) => (
                  <tr key={`${alerta.ejecucionId}-${alerta.regla}-${idx}`} className="hover:bg-slate-50/60 transition-colors">

                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${prioridadCls(alerta.prioridad)}`}>
                        {alerta.prioridad}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span className="text-[11px] font-bold font-mono bg-[#0f4c81]/8 text-[#0f4c81] px-2 py-0.5 rounded border border-[#0f4c81]/10 whitespace-nowrap">
                        {alerta.regla}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <p className="text-xs text-slate-700 leading-snug">{alerta.descripcion}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-xs">
                        {alerta.entidadId}
                      </p>
                    </td>

                    <td className="px-3 py-3 text-center hidden sm:table-cell">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${ambitoCls(alerta.ambito)}`}>
                        {alerta.ambito}
                      </span>
                    </td>

                    <td className="px-3 py-3 text-center hidden md:table-cell">
                      {alerta.estadoCalculo ? (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${estadoCalculoCls(alerta.estadoCalculo)}`}>
                          {alerta.estadoCalculo.replace(/_/g, ' ')}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-[10px]">—</span>
                      )}
                    </td>

                    <td className="px-3 py-3 hidden lg:table-cell">
                      <p className="text-[11px] text-slate-500">{formatFecha(alerta.fechaEjecucion)}</p>
                    </td>

                    <td className="px-4 py-3">
                      {alerta.carreraId ? (
                        <Link
                          href={`/autoevaluacion/tablero/carrera/${alerta.carreraId}`}
                          className="flex items-center gap-1 text-[11px] font-semibold text-[#0f4c81] hover:bg-[#0f4c81]/8 px-2 py-1.5 rounded transition-colors whitespace-nowrap"
                        >
                          Ver carrera →
                        </Link>
                      ) : (
                        <Link
                          href={`/autoevaluacion/analisis/${alerta.ejecucionId}`}
                          className="flex items-center gap-1 text-[11px] font-semibold text-[#0f4c81] hover:bg-[#0f4c81]/8 px-2 py-1.5 rounded transition-colors whitespace-nowrap"
                        >
                          Ver análisis →
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPags > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Mostrando {(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, datos.total)} de {datos.total} alertas
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPagina(p => Math.max(1, p - 1))}
                  disabled={pagina <= 1}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← Anterior
                </button>
                <span className="text-xs text-slate-500">
                  {pagina} / {totalPags}
                </span>
                <button
                  onClick={() => setPagina(p => Math.min(totalPags, p + 1))}
                  disabled={pagina >= totalPags}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
