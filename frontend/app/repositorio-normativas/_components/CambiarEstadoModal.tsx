'use client';

import { useEffect, useRef, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

const ESTADOS = ['VIGENTE', 'DEROGADA', 'SUSPENDIDA', 'REEMPLAZADA'] as const;

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface NormativaResumen {
  id: string;
  titulo: string;
  numeroNorma: string;
  anio: number;
  vigencia: string;
}

interface CandidataSucesora {
  id: string;
  titulo: string;
  numeroNorma: string;
  anio: number;
  vigencia: string;
}

export interface CambiarEstadoModalProps {
  normativa: NormativaResumen;
  obtenerToken: () => string | null;
  onConfirmado: () => void;
  onCancelar: () => void;
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

// ── Componente ────────────────────────────────────────────────────────────────

export function CambiarEstadoModal({
  normativa,
  obtenerToken,
  onConfirmado,
  onCancelar,
}: CambiarEstadoModalProps) {
  const [nuevoEstado, setNuevoEstado] = useState('');
  const [motivo, setMotivo]           = useState('');
  const [errorMotivo, setErrorMotivo] = useState('');
  const [errorGeneral, setErrorGeneral] = useState('');
  const [confirmando, setConfirmando] = useState(false);

  // Búsqueda de sucesora (solo cuando nuevoEstado === 'REEMPLAZADA')
  const [numBusqueda, setNumBusqueda]     = useState('');
  const [anioBusqueda, setAnioBusqueda]   = useState('');
  const [buscando, setBuscando]           = useState(false);
  const [candidata, setCandidata]         = useState<CandidataSucesora | null>(null);
  const [errorBusqueda, setErrorBusqueda] = useState('');

  const motivoRef = useRef<HTMLTextAreaElement>(null);

  // Limpiar candidata cuando cambia el estado seleccionado
  useEffect(() => {
    if (nuevoEstado !== 'REEMPLAZADA') {
      setCandidata(null);
      setNumBusqueda('');
      setAnioBusqueda('');
      setErrorBusqueda('');
    }
  }, [nuevoEstado]);

  // ── Buscar candidata sucesora ──────────────────────────────────────────────

  async function buscarSucesora() {
    if (!numBusqueda.trim() || !anioBusqueda.trim()) {
      setErrorBusqueda('Ingresá N° de norma y año para buscar.');
      return;
    }
    const anio = parseInt(anioBusqueda, 10);
    if (isNaN(anio) || anio < 0 || anio > 99) {
      setErrorBusqueda('El año debe tener exactamente 2 dígitos (ej: 26).');
      return;
    }

    setBuscando(true);
    setCandidata(null);
    setErrorBusqueda('');

    try {
      const params = new URLSearchParams({
        numeroNorma: numBusqueda.trim(),
        anio:        String(anio),
        excluirId:   normativa.id,
      });
      const res = await fetch(`${API}/normativas/candidata-sucesora?${params}`, {
        headers: { Authorization: `Bearer ${obtenerToken()}` },
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorBusqueda(data?.message ?? 'No se encontró la normativa.');
        return;
      }
      setCandidata(data);
    } catch {
      setErrorBusqueda('Error de conexión al buscar la normativa sucesora.');
    } finally {
      setBuscando(false);
    }
  }

  // ── Confirmar cambio ───────────────────────────────────────────────────────

  async function confirmar() {
    // Validaciones cliente
    if (!nuevoEstado) {
      setErrorGeneral('Seleccioná el nuevo estado.');
      return;
    }
    if (!motivo.trim()) {
      setErrorMotivo(
        'ERROR: DEBE INGRESAR EL MOTIVO O RESOLUCIÓN QUE AVALA EL CAMBIO DE ESTADO.',
      );
      motivoRef.current?.focus();
      return;
    }
    if (nuevoEstado === 'REEMPLAZADA' && !candidata) {
      setErrorBusqueda('Debe buscar y seleccionar una normativa sucesora válida.');
      return;
    }

    setConfirmando(true);
    setErrorGeneral('');
    setErrorMotivo('');

    try {
      const body: Record<string, unknown> = {
        vigencia: nuevoEstado,
        motivo:   motivo.trim(),
      };
      if (nuevoEstado === 'REEMPLAZADA' && candidata) {
        body.normativaSucesoraId = candidata.id;
      }

      const res = await fetch(`${API}/normativas/${normativa.id}/estado`, {
        method:  'PATCH',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${obtenerToken()}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = Array.isArray(data?.message)
          ? data.message.join(' | ')
          : (data?.message ?? 'Error al cambiar el estado.');
        if (msg.includes('MOTIVO')) setErrorMotivo(msg);
        else setErrorGeneral(msg);
        return;
      }

      onConfirmado();
    } catch {
      setErrorGeneral('Error de conexión. Verificá que el servidor esté disponible.');
    } finally {
      setConfirmando(false);
    }
  }

  const esReemplazada = nuevoEstado === 'REEMPLAZADA';
  const disabled = confirmando;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={e => { if (e.target === e.currentTarget && !disabled) onCancelar(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Cambiar estado de normativa"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-700">
            CAMBIAR ESTADO
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 truncate">{normativa.titulo}</p>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* Info normativa */}
          <div className="flex items-center justify-between gap-4 bg-slate-50 rounded-xl px-4 py-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Estado actual
              </p>
              <span className={`mt-1 inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${vigenciaBadge(normativa.vigencia)}`}>
                {normativa.vigencia}
              </span>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                N° / Año
              </p>
              <p className="mt-0.5 text-sm font-bold text-slate-700 tabular-nums">
                {normativa.numeroNorma} / {normativa.anio}
              </p>
            </div>
          </div>

          {/* Selector nuevo estado */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
              Nuevo estado <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/30 focus:border-[#0f4c81] transition-colors"
              value={nuevoEstado}
              onChange={e => { setNuevoEstado(e.target.value); setErrorGeneral(''); }}
              disabled={disabled}
            >
              <option value="">— Seleccionar nuevo estado —</option>
              {ESTADOS
                .filter(e => e !== normativa.vigencia)
                .map(e => <option key={e} value={e}>{e}</option>)
              }
            </select>
          </div>

          {/* Sección sucesora (solo cuando REEMPLAZADA) */}
          {esReemplazada && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                  Normativa sucesora <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-slate-400 mb-2">
                  Ingresá el N° y año de la norma que reemplaza a esta.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text" inputMode="numeric"
                    placeholder="N° norma"
                    value={numBusqueda}
                    onChange={e => { setNumBusqueda(e.target.value.replace(/\D/g, '')); setErrorBusqueda(''); setCandidata(null); }}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/30 focus:border-[#0f4c81]"
                    disabled={disabled}
                  />
                  <input
                    type="text" inputMode="numeric" maxLength={2}
                    placeholder="Año (26)"
                    value={anioBusqueda}
                    onChange={e => { setAnioBusqueda(e.target.value.replace(/\D/g, '').slice(0, 2)); setErrorBusqueda(''); setCandidata(null); }}
                    className="w-24 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/30 focus:border-[#0f4c81]"
                    disabled={disabled}
                    onKeyDown={e => e.key === 'Enter' && buscarSucesora()}
                  />
                  <button
                    type="button"
                    onClick={buscarSucesora}
                    disabled={disabled || buscando}
                    className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {buscando ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                    ) : 'BUSCAR'}
                  </button>
                </div>

                {/* Error búsqueda */}
                {errorBusqueda && (
                  <p className="mt-1.5 text-xs font-medium text-red-600">{errorBusqueda}</p>
                )}

                {/* Resultado de búsqueda */}
                {candidata && (
                  <div className="mt-2 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                    <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-emerald-800 truncate">{candidata.titulo}</p>
                      <p className="text-[11px] text-emerald-600">
                        N° {candidata.numeroNorma} / {candidata.anio} — VIGENTE
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setCandidata(null); setNumBusqueda(''); setAnioBusqueda(''); }}
                      className="text-emerald-500 hover:text-red-500 transition-colors"
                      title="Quitar selección"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Motivo / Justificación */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
              Motivo / Justificación del cambio <span className="text-red-500">*</span>
            </label>
            <textarea
              ref={motivoRef}
              rows={3}
              placeholder="Ingresá el motivo o resolución que avala este cambio de estado..."
              value={motivo}
              onChange={e => { setMotivo(e.target.value); if (errorMotivo) setErrorMotivo(''); }}
              disabled={disabled}
              className={`w-full px-3 py-2.5 rounded-lg border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/30 focus:border-[#0f4c81] transition-colors ${
                errorMotivo ? 'border-red-300 bg-red-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            />
            {errorMotivo && (
              <p className="mt-1 text-xs font-medium text-red-600">{errorMotivo}</p>
            )}
          </div>

          {/* Error general */}
          {errorGeneral && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2.5 rounded-lg flex items-start gap-2">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              <span className="font-medium">{errorGeneral}</span>
            </div>
          )}
        </div>

        {/* Footer acciones */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancelar}
            disabled={disabled}
            className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            CANCELAR
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={disabled || !nuevoEstado}
            className="px-5 py-2 rounded-lg bg-[#0f4c81] hover:bg-[#0d3f6d] text-white text-sm font-bold tracking-wide transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {confirmando && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
            )}
            {confirmando ? 'GUARDANDO...' : 'CONFIRMAR CAMBIO'}
          </button>
        </div>
      </div>
    </div>
  );
}
