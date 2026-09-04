'use client';

import { useState } from 'react';
import { normalizarMayusculas } from '@/lib/normalizarMayusculas';

interface Props {
  asignatura: string;
  docente: string;
  onConfirmar: (motivo: string) => Promise<void>;
  onCerrar: () => void;
}

const IcClose = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const IcSpinner = () => (
  <div className="w-4 h-4 rounded-full border-2 border-red-200 border-t-red-600 animate-spin" />
);

export function ModalRechazar({ asignatura, docente, onConfirmar, onCerrar }: Props) {
  const [motivo, setMotivo]       = useState('');
  const [enviando, setEnviando]   = useState(false);
  const [error, setError]         = useState<string | null>(null);

  async function confirmar() {
    if (motivo.trim().length < 10) {
      setError('El motivo debe tener al menos 10 caracteres.');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await onConfirmar(motivo.trim());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
      onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-800">Rechazar Vinculación</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {docente} — {asignatura}
            </p>
          </div>
          <button onClick={onCerrar} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0">
            <IcClose />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-xs text-red-700">
              Al rechazar, se registrará el motivo y la vinculación no generará asignación activa. Esta acción no se puede deshacer.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Motivo del rechazo <span className="text-red-500">*</span>
            </label>
            <textarea
              value={motivo}
              onChange={e => setMotivo(normalizarMayusculas(e.target.value))}
              rows={4}
              maxLength={1000}
              placeholder="Describí el motivo por el cual se rechaza esta vinculación (mínimo 10 caracteres)…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/15 transition resize-none"
            />
            <p className="text-[10px] text-slate-400 mt-1 text-right">{motivo.length}/1000</p>
          </div>

          {error && (
            <p className="text-xs font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/60">
          <button onClick={onCerrar} className="px-4 py-2 text-sm font-semibold border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors">
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={enviando || motivo.trim().length < 10}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {enviando && <IcSpinner />}
            {enviando ? 'Rechazando…' : 'Confirmar rechazo'}
          </button>
        </div>
      </div>
    </div>
  );
}
