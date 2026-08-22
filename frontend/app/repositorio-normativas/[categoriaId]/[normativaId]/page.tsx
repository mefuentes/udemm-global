'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface NormativaResumenRelacion {
  id: string;
  titulo: string;
  numeroNorma: string;
  anio: number;
  vigencia: string;
  tipoNormativaId: string;
}

interface NormativaDetalle {
  id: string;
  titulo: string;
  tipoNormativa: { id: string; nombre: string };
  areaEmisora: string;
  numeroNorma: string;
  anio: number;
  fechaEmision: string;
  vigencia: string;
  palabrasClave: string | null;
  tieneArchivo: boolean;
  tieneArchivoEnCuarentena?: boolean;
  nombreArchivoOriginal: string | null;
  tamanioArchivo: number | null;
  normativaSucesora: NormativaResumenRelacion | null;
  normativasReemplazadas: NormativaResumenRelacion[];
  // Campos de baja lógica (presentes cuando la normativa fue dada de baja)
  eliminado?: boolean;
  motivoEliminacion?: string | null;
  fechaEliminacion?: string | null;
  eliminadoPorNombre?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function vigenciaBadge(v: string) {
  switch (v) {
    case 'VIGENTE':     return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'DEROGADA':    return 'bg-red-50 text-red-700 border border-red-200';
    case 'SUSPENDIDA':  return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'REEMPLAZADA': return 'bg-slate-100 text-slate-600 border border-slate-200';
    default:            return 'bg-slate-100 text-slate-600 border border-slate-200';
  }
}

function formatFecha(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return iso; }
}

function formatBytes(bytes: number) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function NormativaDetallePage() {
  const { obtenerTokenActual } = useAuth();
  const params = useParams();
  const searchParams = useSearchParams();

  const categoriaId     = params?.categoriaId  as string;
  const normativaId     = params?.normativaId  as string;
  const categoriaNombre = searchParams?.get('nombre') ?? 'Categoría';

  const [normativa, setNormativa]   = useState<NormativaDetalle | null>(null);
  const [cargando, setCargando]     = useState(true);
  const [error, setError]           = useState('');

  // Estado visor PDF
  const [visorAbierto, setVisorAbierto] = useState(false);
  const [blobUrl, setBlobUrl]           = useState<string | null>(null);
  const [cargandoPdf, setCargandoPdf]   = useState(false);
  const [errorPdf, setErrorPdf]         = useState('');

  // Ref para cleanup: guardamos la URL actual del blob
  const blobUrlRef = useRef<string | null>(null);

  const volverHref = `/repositorio-normativas/${categoriaId}?nombre=${encodeURIComponent(categoriaNombre)}`;

  // Cleanup blob URL al desmontar
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!normativaId) return;
    setCargando(true);
    setError('');

    fetch(`${API}/normativas/${normativaId}`, {
      headers: { Authorization: `Bearer ${obtenerTokenActual()}` },
    })
      .then(r => {
        if (r.status === 404) return Promise.reject('no-encontrada');
        if (!r.ok) return Promise.reject('error');
        return r.json();
      })
      .then(d => setNormativa(d))
      .catch(e => setError(e === 'no-encontrada'
        ? 'La normativa no existe o no está disponible.'
        : 'No se pudo cargar la normativa. Intentá nuevamente.'
      ))
      .finally(() => setCargando(false));
  }, [normativaId, obtenerTokenActual]);

  // Carga el PDF como blob (una sola vez) y ejecuta la acción solicitada
  const cargarPdf = useCallback(async (modo: 'ver' | 'descargar') => {
    let url = blobUrlRef.current;

    if (!url) {
      setCargandoPdf(true);
      setErrorPdf('');
      try {
        const res = await fetch(`${API}/normativas/${normativaId}/archivo`, {
          headers: { Authorization: `Bearer ${obtenerTokenActual()}` },
        });
        if (res.status === 403) throw new Error('Sin permiso para acceder a este documento.');
        if (res.status === 404) throw new Error('El archivo PDF no está disponible en este momento.');
        if (!res.ok) throw new Error('No se pudo cargar el documento. Intentá nuevamente.');
        const blob = await res.blob();
        url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobUrl(url);
      } catch (e: any) {
        setErrorPdf(e.message ?? 'Error al cargar el documento. Verificá tu conexión.');
        setCargandoPdf(false);
        return;
      }
      setCargandoPdf(false);
    }

    if (modo === 'ver') {
      setVisorAbierto(true);
    } else {
      const nombreDescarga = normativa?.nombreArchivoOriginal ?? 'normativa.pdf';
      const a = document.createElement('a');
      a.href = url;
      a.download = nombreDescarga;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, [normativaId, normativa, obtenerTokenActual]);

  const cerrarVisor = () => setVisorAbierto(false);

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ── Encabezado ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Link href="/repositorio-normativas" className="text-xs text-[#0f4c81] hover:underline font-medium">
              Repositorio de Normativas
            </Link>
            <span className="text-slate-300 text-xs">/</span>
            <Link href={volverHref} className="text-xs text-[#0f4c81] hover:underline font-medium truncate max-w-[180px]">
              {categoriaNombre}
            </Link>
            <span className="text-slate-300 text-xs">/</span>
            <span className="text-xs text-slate-500">Detalle</span>
          </div>

          <h1 className="text-xl font-bold text-slate-800 tracking-tight">
            {cargando ? (
              <span className="inline-block h-6 w-64 bg-slate-200 rounded animate-pulse" />
            ) : (normativa?.titulo ?? 'Normativa')}
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-medium tracking-wide">
            REPOSITORIO DE NORMATIVAS — Vista de detalle
          </p>
        </div>

        <Link
          href={volverHref}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </Link>
      </div>

      {/* ── Error principal ───────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {error}
        </div>
      )}

      {/* ── Skeleton ─────────────────────────────────────────────────────────── */}
      {cargando && !error && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-pulse">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
            <div className="h-3 w-48 bg-slate-200 rounded" />
          </div>
          <div className="divide-y divide-slate-50">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="px-6 py-4 grid grid-cols-3 gap-4">
                <div className="h-3 bg-slate-200 rounded col-span-1" />
                <div className="h-3 bg-slate-100 rounded col-span-2" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Detalle ──────────────────────────────────────────────────────────── */}
      {!cargando && !error && normativa && (
        <>
          {/* Banner de baja lógica */}
          {normativa.eliminado && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
              <svg className="w-5 h-5 flex-shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-bold text-red-700 uppercase tracking-wide">NORMATIVA DADA DE BAJA</p>
                <p className="text-xs text-red-600 mt-0.5">
                  Este registro fue dado de baja lógicamente. No está disponible operativamente para usuarios del repositorio.
                </p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

            {/* Header de la tarjeta */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">
                INFORMACIÓN DE LA NORMATIVA
              </h2>
              <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${vigenciaBadge(normativa.vigencia)}`}>
                {normativa.vigencia}
              </span>
            </div>

            {/* Campos */}
            <dl className="divide-y divide-slate-50">
              {[
                { label: 'Título',            value: normativa.titulo },
                { label: 'Tipo de normativa', value: normativa.tipoNormativa?.nombre ?? '—' },
                { label: 'Área emisora',      value: normativa.areaEmisora },
                { label: 'Número de norma',   value: normativa.numeroNorma },
                { label: 'Año',               value: String(normativa.anio) },
                { label: 'Fecha de emisión',  value: formatFecha(normativa.fechaEmision) },
                { label: 'Vigencia',          value: normativa.vigencia, isVigencia: true },
                { label: 'Palabras clave',    value: normativa.palabrasClave || '—' },
              ].map(({ label, value, isVigencia }) => (
                <div key={label} className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-6 items-start">
                  <dt className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex items-center py-0.5">
                    {label}
                  </dt>
                  <dd className="mt-1 sm:mt-0 sm:col-span-2 text-sm text-slate-800">
                    {isVigencia
                      ? <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${vigenciaBadge(value)}`}>{value}</span>
                      : <span className="leading-relaxed">{value}</span>
                    }
                  </dd>
                </div>
              ))}
            </dl>

            {/* Footer solo lectura */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                Vista de solo lectura
              </span>
              <Link
                href={volverHref}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Volver
              </Link>
            </div>
          </div>

          {/* ── Sección: Datos de la baja lógica ────────────────────────────── */}
          {normativa.eliminado && (
            <div className="bg-red-50 rounded-xl border border-red-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-red-100 bg-red-100/40 flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <h2 className="text-xs font-bold uppercase tracking-widest text-red-600">
                  DATOS DE LA BAJA LÓGICA
                </h2>
              </div>
              <dl className="divide-y divide-red-50/60">
                <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-6 items-start">
                  <dt className="text-[11px] font-bold uppercase tracking-widest text-red-400 py-0.5">Estado del registro</dt>
                  <dd className="mt-1 sm:mt-0 sm:col-span-2">
                    <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">ELIMINADA</span>
                  </dd>
                </div>
                <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-6 items-start">
                  <dt className="text-[11px] font-bold uppercase tracking-widest text-red-400 py-0.5">Fecha de eliminación</dt>
                  <dd className="mt-1 sm:mt-0 sm:col-span-2 text-sm text-slate-700">
                    {normativa.fechaEliminacion ? formatFecha(normativa.fechaEliminacion) : '—'}
                  </dd>
                </div>
                <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-6 items-start">
                  <dt className="text-[11px] font-bold uppercase tracking-widest text-red-400 py-0.5">Dado de baja por</dt>
                  <dd className="mt-1 sm:mt-0 sm:col-span-2 text-sm text-slate-700">
                    {normativa.eliminadoPorNombre ?? '—'}
                  </dd>
                </div>
                <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-6 items-start">
                  <dt className="text-[11px] font-bold uppercase tracking-widest text-red-400 py-0.5">Motivo</dt>
                  <dd className="mt-1 sm:mt-0 sm:col-span-2 text-sm text-slate-700 leading-relaxed">
                    {normativa.motivoEliminacion ?? '—'}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* ── Sección: Fue reemplazada por ─────────────────────────────────── */}
          {normativa.normativaSucesora && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
              <div className="px-6 py-3 border-b border-amber-200 flex items-center gap-2 bg-amber-100/60">
                <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <h3 className="text-xs font-bold uppercase tracking-widest text-amber-700">
                  ESTA NORMATIVA FUE REEMPLAZADA POR
                </h3>
              </div>
              <div className="px-6 py-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 leading-snug">
                    {normativa.normativaSucesora.titulo}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                    N° {normativa.normativaSucesora.numeroNorma} / {normativa.normativaSucesora.anio}
                    {'  ·  '}
                    <span className={`font-bold ${normativa.normativaSucesora.vigencia === 'VIGENTE' ? 'text-emerald-700' : 'text-slate-600'}`}>
                      {normativa.normativaSucesora.vigencia}
                    </span>
                  </p>
                </div>
                <Link
                  href={`/repositorio-normativas/${normativa.normativaSucesora.tipoNormativaId}/${normativa.normativaSucesora.id}?nombre=${encodeURIComponent(categoriaNombre)}`}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-amber-700 text-xs font-semibold hover:bg-amber-50 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  VER NORMATIVA SUCESORA
                </Link>
              </div>
            </div>
          )}

          {/* ── Sección: Reemplaza a ─────────────────────────────────────────── */}
          {normativa.normativasReemplazadas.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-6 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  REEMPLAZA A
                </h3>
                <span className="ml-auto text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                  {normativa.normativasReemplazadas.length}
                </span>
              </div>
              <ul className="divide-y divide-slate-50">
                {normativa.normativasReemplazadas.map(r => (
                  <li key={r.id} className="px-6 py-3.5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 leading-snug truncate">{r.titulo}</p>
                      <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                        N° {r.numeroNorma} / {r.anio}
                        {'  ·  '}
                        <span className={`font-semibold ${r.vigencia === 'VIGENTE' ? 'text-emerald-600' : r.vigencia === 'REEMPLAZADA' ? 'text-slate-500' : 'text-red-500'}`}>
                          {r.vigencia}
                        </span>
                      </p>
                    </div>
                    <Link
                      href={`/repositorio-normativas/${r.tipoNormativaId}/${r.id}?nombre=${encodeURIComponent(categoriaNombre)}`}
                      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-all"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      VER
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Sección Documento PDF ─────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">
                DOCUMENTO PDF
              </h2>
            </div>

            <div className="px-6 py-5">
              {normativa.tieneArchivoEnCuarentena ? (
                /* Documento en cuarentena por baja lógica */
                <div className="flex items-start gap-3 py-2">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide">DOCUMENTO EN CUARENTENA</p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      El archivo PDF fue trasladado a almacenamiento seguro de cuarentena al momento de la baja lógica.
                      No está disponible para descarga ni visualización.
                    </p>
                  </div>
                </div>
              ) : normativa.tieneArchivo ? (
                <>
                  {/* Info del archivo */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {normativa.nombreArchivoOriginal ?? 'documento.pdf'}
                      </p>
                      {normativa.tamanioArchivo != null && (
                        <p className="text-xs text-slate-400 mt-0.5">{formatBytes(normativa.tamanioArchivo)}</p>
                      )}
                    </div>
                  </div>

                  {/* Error PDF */}
                  {errorPdf && (
                    <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      {errorPdf}
                    </div>
                  )}

                  {/* Botones */}
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => cargarPdf('ver')}
                      disabled={cargandoPdf}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0f4c81] text-white text-sm font-semibold hover:bg-[#0d3d6b] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                      {cargandoPdf ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Cargando...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          VER DOCUMENTO
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => cargarPdf('descargar')}
                      disabled={cargandoPdf}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 hover:border-slate-300 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      DESCARGAR PDF
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3 text-slate-400 py-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  <span className="text-sm">NO HAY DOCUMENTO PDF ASOCIADO A ESTA NORMATIVA.</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Modal visor PDF ───────────────────────────────────────────────────── */}
      {visorAbierto && blobUrl && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/70"
          role="dialog"
          aria-modal="true"
          aria-label="Visor de documento PDF"
        >
          {/* Barra superior del visor */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#0f4c81] text-white flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <svg className="w-5 h-5 flex-shrink-0 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm font-semibold truncate">
                {normativa?.nombreArchivoOriginal ?? 'Documento PDF'}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => cargarPdf('descargar')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Descargar
              </button>
              <button
                onClick={cerrarVisor}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cerrar
              </button>
            </div>
          </div>

          {/* iframe con el PDF */}
          <iframe
            src={blobUrl}
            className="flex-1 w-full border-none bg-slate-100"
            title="Visor de documento PDF"
          />
        </div>
      )}
    </div>
  );
}
