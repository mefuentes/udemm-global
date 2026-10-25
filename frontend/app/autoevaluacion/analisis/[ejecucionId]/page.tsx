'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { AmbitoAnalisis, EstadoCalculo, EstadoEjecucion } from '../analisis.types';

// ── Tipos ────────────────────────────────────────────────────────────────────

interface DetalleEjecucion {
  ejecucionId: string;
  ambito: AmbitoAnalisis;
  entidadId: string;
  usuarioId: string;
  estadoEjecucion: EstadoEjecucion;
  estadoCalculo: EstadoCalculo | null;
  fechaInicio: string;
  fechaFin: string | null;
  errores: string | null;
  snapshot: Record<string, unknown> | null;
}

// ── Helpers visuales ─────────────────────────────────────────────────────────

function estadoCls(ec: EstadoCalculo): string {
  if (ec === 'CALCULADO')       return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (ec === 'PARCIAL')         return 'bg-amber-50 text-amber-700 border-amber-200';
  if (ec === 'NO_DETERMINABLE') return 'bg-slate-100 text-slate-600 border-slate-200';
  return 'bg-sky-50 text-sky-700 border-sky-200'; // NO_APLICA
}

function formatFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

const IcSpinner = () => (
  <span className="inline-block w-5 h-5 rounded-full border-2 border-slate-300 border-t-[#0f4c81] animate-spin" />
);

function EstadoBadge({ ec }: { ec: EstadoCalculo }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${estadoCls(ec)}`}>
      {ec.replace(/_/g, ' ')}
    </span>
  );
}

function MetaField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-[11px] text-slate-700">{children}</span>
    </div>
  );
}

// ── Lógica de navegación al tablero correspondiente ──────────────────────────

function urlTablero(ambito: AmbitoAnalisis, entidadId: string): string {
  if (ambito === 'FACULTAD') return `/autoevaluacion/tablero/facultad/${entidadId}`;
  if (ambito === 'CARRERA')  return `/autoevaluacion/tablero/carrera/${entidadId}`;
  return `/autoevaluacion/tablero/${entidadId}`;
}

function labelAmbito(ambito: AmbitoAnalisis): string {
  if (ambito === 'FACULTAD') return 'Facultad';
  if (ambito === 'CARRERA')  return 'Carrera';
  return 'Plan de estudio';
}

// ── Snapshot: extracto de indicadores ────────────────────────────────────────

function SnapshotSummary({ snapshot }: { snapshot: Record<string, unknown> }) {
  const entries = Object.entries(snapshot).filter(([, v]) => v !== null && typeof v === 'object');

  if (entries.length === 0) {
    return <p className="text-[11px] text-slate-400 italic">Snapshot vacío.</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
      {entries.map(([key, val]) => {
        const ec = (val as Record<string, unknown>)?.estadoCalculo as EstadoCalculo | undefined;
        return (
          <div key={key} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
            <span className="font-mono text-[10px] font-bold text-[#0f4c81] uppercase">{key}</span>
            {ec ? <EstadoBadge ec={ec} /> : <span className="text-[10px] text-slate-400">—</span>}
          </div>
        );
      })}
    </div>
  );
}

// ── Componente interno ────────────────────────────────────────────────────────

function DetalleEjecucionInner() {
  const params      = useParams<{ ejecucionId: string }>();
  const ejecucionId = params.ejecucionId;

  const [cargando,  setCargando]  = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [estado403, setEstado403] = useState(false);
  const [dato,      setDato]      = useState<DetalleEjecucion | null>(null);
  const [exportando, setExportando] = useState<'pdf' | 'xlsx' | null>(null);
  const [errorExport, setErrorExport] = useState<string | null>(null);

  useEffect(() => {
    if (!ejecucionId) return;
    setCargando(true);
    setError(null);
    setEstado403(false);
    apiFetch(`/autoevaluacion/analisis/ejecucion/${ejecucionId}`)
      .then(async (res) => {
        if (res.status === 403) { setEstado403(true); return; }
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setError(data?.message ?? 'No se encontró la ejecución.');
          return;
        }
        setDato(data as DetalleEjecucion);
      })
      .catch(() => setError('Error de red al obtener el detalle.'))
      .finally(() => setCargando(false));
  }, [ejecucionId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function exportar(formato: 'pdf' | 'xlsx') {
    setExportando(formato);
    setErrorExport(null);
    try {
      const res = await apiFetch(`/autoevaluacion/exportar/ejecucion/${ejecucionId}/${formato}`);
      if (!res.ok) { setErrorExport('Error al generar la exportación.'); return; }
      const blob = await res.blob();
      const cd   = res.headers.get('Content-Disposition') ?? '';
      const name = cd.match(/filename="([^"]+)"/)?.[1] ?? `ejecucion-${ejecucionId}.${formato}`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { setErrorExport('Error de red al exportar.'); }
    finally { setExportando(null); }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Navegación */}
        <Link
          href="/autoevaluacion"
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#0f4c81] hover:underline mb-6"
        >
          ← Autoevaluación
        </Link>

        <h1 className="text-base font-bold text-slate-800 mb-1">Detalle de ejecución</h1>
        {ejecucionId && (
          <p className="font-mono text-[11px] text-slate-400 mb-6">{ejecucionId}</p>
        )}

        {/* Estados de carga / error */}
        {cargando && (
          <div className="flex justify-center py-12">
            <IcSpinner />
          </div>
        )}

        {estado403 && !cargando && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            No tiene permiso para ver esta ejecución.
          </div>
        )}

        {error && !cargando && !estado403 && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Contenido */}
        {dato && !cargando && (
          <div className="space-y-4">

            {/* Metadatos */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${dato.estadoEjecucion === 'COMPLETADO' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {dato.estadoEjecucion}
                  </span>
                  {dato.estadoCalculo && <EstadoBadge ec={dato.estadoCalculo} />}
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {labelAmbito(dato.ambito)}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-100">
                <MetaField label="Entidad ID">
                  <span className="font-mono">{dato.entidadId.slice(0, 8)}…</span>
                </MetaField>
                <MetaField label="Usuario ID">
                  <span className="font-mono">{dato.usuarioId.slice(0, 8)}…</span>
                </MetaField>
                <MetaField label="Inicio">{formatFecha(dato.fechaInicio)}</MetaField>
                {dato.fechaFin && (
                  <MetaField label="Fin">{formatFecha(dato.fechaFin)}</MetaField>
                )}
              </div>
            </div>

            {/* Errores */}
            {dato.errores && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-[11px] text-red-700">
                <p className="font-semibold mb-1">Errores registrados</p>
                <pre className="whitespace-pre-wrap font-mono text-[10px]">{dato.errores}</pre>
              </div>
            )}

            {/* Snapshot */}
            {dato.snapshot && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-3">
                  Indicadores en snapshot
                </p>
                <SnapshotSummary snapshot={dato.snapshot} />
              </div>
            )}

            {/* Exportaciones */}
            {dato.estadoEjecucion === 'COMPLETADO' && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-3">
                  Exportar
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => exportar('pdf')}
                    disabled={!!exportando}
                    className="text-xs font-semibold text-white bg-[#0f4c81] hover:bg-[#0d3f6b] px-3 py-1.5 rounded-lg disabled:opacity-40 transition-colors"
                  >
                    {exportando === 'pdf' ? 'Generando…' : 'PDF'}
                  </button>
                  <button
                    onClick={() => exportar('xlsx')}
                    disabled={!!exportando}
                    className="text-xs font-semibold text-[#0f4c81] border border-[#0f4c81] hover:bg-[#0f4c81]/5 px-3 py-1.5 rounded-lg disabled:opacity-40 transition-colors"
                  >
                    {exportando === 'xlsx' ? 'Generando…' : 'Excel'}
                  </button>
                  {errorExport && (
                    <span className="text-[11px] text-red-600">{errorExport}</span>
                  )}
                </div>
              </div>
            )}

            {/* Navegación al tablero */}
            <div className="pt-1">
              <Link
                href={urlTablero(dato.ambito, dato.entidadId)}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#0f4c81] hover:underline"
              >
                Ver tablero de {labelAmbito(dato.ambito).toLowerCase()} →
              </Link>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

// ── Exportación con Suspense ──────────────────────────────────────────────────

export default function DetalleEjecucionPage() {
  return (
    <Suspense fallback={null}>
      <DetalleEjecucionInner />
    </Suspense>
  );
}
