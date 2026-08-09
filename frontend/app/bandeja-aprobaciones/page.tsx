'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ModalRechazar } from './_components/ModalRechazar';
import { ModalDetalle } from './_components/ModalDetalle';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Vinculacion {
  id: string;
  estado: string;
  observaciones?: string;
  fechaCreacion: string;
  fechaAprobacion?: string;
  motivoRechazo?: string;
  horasSemana?: number | null;
  anioInicio?: number | null;
  facultad:    { nombre: string };
  carrera:     { nombre: string };
  planEstudio: { nombre: string; codigo?: string };
  materia:     { nombre: string; codigo?: string };
  docente:     { nombre: string; apellido: string };
  catedra:     { nombre: string };
  cargo:       { nombre: string };
  modalidad:   { nombre: string };
  designacion: { nombre: string };
  usuarioSolicitante: { nombre: string; apellido: string };
  aprobador?: { nombre: string; apellido: string } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ESTADO_MAP: Record<string, { label: string; cls: string }> = {
  PENDIENTE_DE_APROBACION: { label: 'Pendiente',  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  APROBADA:                { label: 'Aprobada',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  RECHAZADA:               { label: 'Rechazada',  cls: 'bg-red-50 text-red-700 border-red-200' },
  INACTIVA:                { label: 'Inactiva',   cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

function BadgeEstado({ estado }: { estado: string }) {
  const { label, cls } = ESTADO_MAP[estado] ?? { label: estado, cls: 'bg-slate-100 text-slate-500 border-slate-200' };
  return <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${cls}`}>{label}</span>;
}

function formatFecha(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Iconos ────────────────────────────────────────────────────────────────────

const IcCheck = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);
const IcX = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const IcEye = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);
const IcSpinner = () => (
  <div className="w-4 h-4 rounded-full border-2 border-slate-200 border-t-slate-600 animate-spin" />
);

// ── Página ────────────────────────────────────────────────────────────────────

export default function BandejaAprobacionesPage() {
  const { usuario, obtenerTokenActual } = useAuth();
  const rolNombre = usuario?.rol?.nombre ?? '';
  const esAdmin   = rolNombre === 'ADMINISTRADOR_SISTEMA';

  const [vinculaciones, setVinculaciones] = useState<Vinculacion[]>([]);
  const [cargando, setCargando]           = useState(true);
  const [error, setError]                 = useState<string | null>(null);

  // Filtros (solo ADMIN los usa todos; DOCENTE solo usa estado)
  const [buscar, setBuscar]       = useState('');
  const [estado, setEstado]       = useState('');

  // Modales
  const [detalle, setDetalle]                                 = useState<Vinculacion | null>(null);
  const [rechazarTarget, setRechazarTarget]                   = useState<Vinculacion | null>(null);
  const [accionandoId, setAccionandoId]                       = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function mostrarToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const token  = await obtenerTokenActual();
      const params = new URLSearchParams();
      if (estado) params.set('estado', estado);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/vinculaciones-catedra?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      const lista: Vinculacion[] = Array.isArray(data) ? data : (data.data ?? []);
      setVinculaciones(lista);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, [obtenerTokenActual, estado]);

  useEffect(() => { cargar(); }, [cargar]);

  async function aprobar(v: Vinculacion) {
    if (!window.confirm(`¿Aprobar la vinculación de ${v.docente.apellido}, ${v.docente.nombre} para "${v.materia.nombre}"?`)) return;
    setAccionandoId(v.id);
    try {
      const token = await obtenerTokenActual();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/vinculaciones-catedra/${v.id}/aprobar`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? `Error ${res.status}`);
      }
      mostrarToast('Vinculación aprobada correctamente.');
      cargar();
    } catch (e) {
      mostrarToast((e as Error).message, false);
    } finally {
      setAccionandoId(null);
    }
  }

  async function rechazar(v: Vinculacion, motivo: string) {
    const token = await obtenerTokenActual();
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/vinculaciones-catedra/${v.id}/rechazar`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message ?? `Error ${res.status}`);
    }
    setRechazarTarget(null);
    mostrarToast('Vinculación rechazada.');
    cargar();
  }

  // Filtrado local por búsqueda de texto
  const filtradas = vinculaciones.filter(v => {
    if (!buscar.trim()) return true;
    const q = buscar.toLowerCase();
    return (
      v.docente.apellido.toLowerCase().includes(q) ||
      v.docente.nombre.toLowerCase().includes(q) ||
      v.materia.nombre.toLowerCase().includes(q) ||
      v.carrera.nombre.toLowerCase().includes(q) ||
      v.facultad.nombre.toLowerCase().includes(q) ||
      v.catedra.nombre.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">
          {esAdmin ? 'Bandeja de Aprobaciones' : 'Mis Vinculaciones'}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {esAdmin
            ? 'Gestioná las solicitudes de vinculación docente-cátedra pendientes de resolución.'
            : 'Revisá el estado de tus solicitudes de vinculación a cátedra.'}
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Búsqueda */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            placeholder="Buscar…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/15 transition bg-white"
          />
        </div>

        {/* Estado */}
        <select
          value={estado}
          onChange={e => setEstado(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 bg-white text-slate-700"
        >
          <option value="">Todos los estados</option>
          <option value="PENDIENTE_DE_APROBACION">Pendiente</option>
          <option value="APROBADA">Aprobada</option>
          <option value="RECHAZADA">Rechazada</option>
          <option value="INACTIVA">Inactiva</option>
        </select>

        {/* Contador */}
        <span className="ml-auto text-xs text-slate-400 font-medium">
          {filtradas.length} registro{filtradas.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {cargando ? (
          <div className="flex items-center justify-center gap-3 py-24 text-slate-400">
            <IcSpinner />
            <span className="text-sm">Cargando…</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <p className="text-sm text-red-500 font-medium">{error}</p>
            <button onClick={cargar} className="px-4 py-2 text-sm font-semibold text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition">
              Reintentar
            </button>
          </div>
        ) : filtradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-2">
            <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.25}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm">No hay vinculaciones para mostrar.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 px-4 py-3">Docente</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 px-4 py-3">Asignatura</th>
                  {esAdmin && (
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 px-4 py-3">Carrera</th>
                  )}
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 px-4 py-3">Cátedra</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 px-4 py-3">Cargo</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 px-4 py-3 hidden lg:table-cell">H/SEM · Año</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 px-4 py-3">Estado</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 px-4 py-3">Fecha solicitud</th>
                  <th className="text-right text-[10px] font-bold uppercase tracking-wider text-slate-400 px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtradas.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                      {v.docente.apellido}, {v.docente.nombre}
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-[200px]">
                      <span className="truncate block">{v.materia.nombre}</span>
                      {v.materia.codigo && <span className="text-[10px] text-slate-400">{v.materia.codigo}</span>}
                    </td>
                    {esAdmin && (
                      <td className="px-4 py-3 text-slate-500 max-w-[160px]">
                        <span className="truncate block text-xs">{v.carrera.nombre}</span>
                        <span className="text-[10px] text-slate-400">{v.facultad.nombre}</span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{v.catedra.nombre}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{v.cargo.nombre}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-slate-700 font-medium text-xs">
                        {v.horasSemana != null ? `${v.horasSemana} h/sem` : <span className="text-slate-400 italic">—</span>}
                      </span>
                      <span className="block text-[10px] text-slate-400">{v.anioInicio ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3"><BadgeEstado estado={v.estado} /></td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatFecha(v.fechaCreacion)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Ver detalle */}
                        <button
                          onClick={() => setDetalle(v)}
                          title="Ver detalle"
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                          <IcEye />
                          <span className="hidden sm:inline">Ver</span>
                        </button>

                        {/* Aprobar (solo PENDIENTE) */}
                        {v.estado === 'PENDIENTE_DE_APROBACION' && (
                          <>
                            <button
                              onClick={() => aprobar(v)}
                              disabled={accionandoId === v.id}
                              title="Aprobar"
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-200 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
                            >
                              {accionandoId === v.id ? <IcSpinner /> : <IcCheck />}
                              <span className="hidden sm:inline">Aprobar</span>
                            </button>

                            <button
                              onClick={() => setRechazarTarget(v)}
                              disabled={accionandoId === v.id}
                              title="Rechazar"
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                            >
                              <IcX />
                              <span className="hidden sm:inline">Rechazar</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal detalle */}
      {detalle && <ModalDetalle vinculacion={detalle} onCerrar={() => setDetalle(null)} />}

      {/* Modal rechazar */}
      {rechazarTarget && (
        <ModalRechazar
          asignatura={rechazarTarget.materia.nombre}
          docente={`${rechazarTarget.docente.apellido}, ${rechazarTarget.docente.nombre}`}
          onConfirmar={motivo => rechazar(rechazarTarget, motivo)}
          onCerrar={() => setRechazarTarget(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold transition-all ${
          toast.ok
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {toast.ok
            ? <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            : <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          }
          {toast.msg}
        </div>
      )}
    </div>
  );
}
