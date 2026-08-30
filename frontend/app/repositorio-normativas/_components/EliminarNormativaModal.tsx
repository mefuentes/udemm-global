'use client';

import { useRef, useState } from 'react';
import { apiFetch, mensajeErrorHttp } from '@/lib/api';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface NormativaResumen {
  id: string;
  titulo: string;
  numeroNorma: string;
  anio: number;
  vigencia: string;
  tipoNormativa?: { nombre: string };
}

export interface EliminarNormativaModalProps {
  normativa: NormativaResumen;
  onConfirmado: () => void;
  onCancelar: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function vigenciaColor(v: string) {
  switch (v) {
    case 'VIGENTE':     return 'text-emerald-700';
    case 'DEROGADA':    return 'text-red-600';
    case 'SUSPENDIDA':  return 'text-amber-700';
    case 'REEMPLAZADA': return 'text-slate-500';
    default:            return 'text-slate-500';
  }
}

// ── Componente ────────────────────────────────────────────────────────────────

export function EliminarNormativaModal({
  normativa,
  onConfirmado,
  onCancelar,
}: EliminarNormativaModalProps) {
  const [motivo, setMotivo]           = useState('');
  const [errorMotivo, setErrorMotivo] = useState('');
  const [errorGeneral, setErrorGeneral] = useState('');
  const [confirmando, setConfirmando] = useState(false);

  const motivoRef = useRef<HTMLTextAreaElement>(null);

  async function confirmar() {
    if (!motivo.trim()) {
      setErrorMotivo(
        'ERROR: DEBE ESPECIFICAR UN MOTIVO VÁLIDO PARA PROCEDER CON LA ELIMINACIÓN LÓGICA.',
      );
      motivoRef.current?.focus();
      return;
    }

    setConfirmando(true);
    setErrorGeneral('');
    setErrorMotivo('');

    try {
      const res = await apiFetch(`${API}/normativas/${normativa.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ motivo: motivo.trim() }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = mensajeErrorHttp(res, data, 'Error al dar de baja la normativa.');
        if (res.status !== 403 && msg.includes('MOTIVO')) setErrorMotivo(msg);
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={e => { if (e.target === e.currentTarget && !confirmando) onCancelar(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Confirmar eliminación de normativa"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

        {/* Header de advertencia */}
        <div className="px-6 py-4 bg-red-600 text-white flex items-center gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest">¡ATENCIÓN!</h2>
            <p className="text-xs text-red-100 mt-0.5">ESTÁ A PUNTO DE DAR DE BAJA ESTA NORMATIVA DEL REPOSITORIO</p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* Info de la normativa */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 divide-y divide-slate-100">
            <div className="px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Título</p>
              <p className="text-sm font-semibold text-slate-800 leading-snug">{normativa.titulo}</p>
            </div>
            <div className="px-4 py-3 grid grid-cols-2 gap-x-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">N° / Año</p>
                <p className="text-sm font-bold text-slate-700 tabular-nums">
                  {normativa.numeroNorma} / {normativa.anio}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Estado actual</p>
                <p className={`text-sm font-bold ${vigenciaColor(normativa.vigencia)}`}>
                  {normativa.vigencia}
                </p>
              </div>
            </div>
            {normativa.tipoNormativa && (
              <div className="px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Tipo</p>
                <p className="text-sm text-slate-700">{normativa.tipoNormativa.nombre}</p>
              </div>
            )}
          </div>

          {/* Explicación de consecuencias */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-1.5">
            <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Consecuencias de esta acción:</p>
            <ul className="space-y-1">
              {[
                'Dejará de estar disponible operativamente para todos los usuarios.',
                'No se eliminará físicamente de la base de datos.',
                'Su documento PDF será trasladado a almacenamiento de cuarentena.',
                'La operación quedará registrada con su motivo y usuario.',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-amber-700">
                  <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Motivo */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
              Motivo de eliminación <span className="text-red-500">*</span>
            </label>
            <textarea
              ref={motivoRef}
              rows={3}
              placeholder="Especificá el motivo o resolución que justifica esta baja lógica..."
              value={motivo}
              onChange={e => { setMotivo(e.target.value); if (errorMotivo) setErrorMotivo(''); }}
              disabled={confirmando}
              className={`w-full px-3 py-2.5 rounded-lg border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 transition-colors ${
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-medium">{errorGeneral}</span>
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancelar}
            disabled={confirmando}
            className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            CANCELAR
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={confirmando}
            className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold tracking-wide transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {confirmando && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
            )}
            {confirmando ? 'PROCESANDO...' : 'CONFIRMAR BAJA LÓGICA'}
          </button>
        </div>
      </div>
    </div>
  );
}
