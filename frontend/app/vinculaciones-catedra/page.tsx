'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { FormularioVinculacion } from './_components/FormularioVinculacion';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Vinculacion {
  id: string;
  estado: string;
  fechaCreacion: string;
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
  observaciones?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

function badgeEstado(estado: string) {
  switch (estado) {
    case 'PENDIENTE_DE_APROBACION':
      return <span className="inline-flex text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Pendiente</span>;
    case 'APROBADA':
      return <span className="inline-flex text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Aprobada</span>;
    case 'RECHAZADA':
      return <span className="inline-flex text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">Rechazada</span>;
    default:
      return <span className="inline-flex text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">{estado}</span>;
  }
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const IcPlus = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);
const IcSearch = () => (
  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
const IcSpinner = () => (
  <div className="w-5 h-5 rounded-full border-2 border-slate-200 border-t-[#0f4c81] animate-spin" />
);
const IcEmpty = () => (
  <svg className="w-12 h-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899l4-4a4 4 0 115.656 5.656l-1.1 1.1" />
  </svg>
);

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VinculacionesCatedraPage() {
  const { obtenerTokenActual } = useAuth();

  const [items, setItems]           = useState<Vinculacion[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [buscar, setBuscar]         = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [formulario, setFormulario] = useState(false);
  const [exito, setExito]           = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (buscar.trim())   params.set('buscar', buscar.trim());
      if (filtroEstado)    params.set('estado', filtroEstado);
      const r = await fetch(`${API}/vinculaciones-catedra?${params}`, {
        headers: { Authorization: `Bearer ${obtenerTokenActual()}` },
      });
      if (!r.ok) throw new Error('Error al cargar las vinculaciones');
      setItems(await r.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [buscar, filtroEstado]);

  useEffect(() => { cargar(); }, [cargar]);

  function onGuardado() {
    setFormulario(false);
    setExito('Vinculación creada correctamente. Quedó en estado Pendiente de Aprobación.');
    setTimeout(() => setExito(null), 5000);
    cargar();
  }

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto">

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Gestión Académica</p>
          <h1 className="text-xl font-bold text-slate-800">Vinculación a Cátedra</h1>
          <p className="mt-1 text-sm text-slate-500">
            Registrá la asignación de docentes a cátedras de asignaturas. Las vinculaciones quedan pendientes de aprobación.
          </p>
        </div>
        <button
          onClick={() => setFormulario(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#0f4c81] text-white text-sm font-semibold rounded-xl hover:bg-[#0d3e6b] transition-colors shadow-sm flex-shrink-0"
        >
          <IcPlus />
          Nueva Vinculación
        </button>
      </div>

      {/* Toast éxito */}
      {exito && (
        <div className="mb-4 flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-xl">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {exito}
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2"><IcSearch /></span>
          <input
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            placeholder="Buscar por docente, asignatura o carrera…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white outline-none focus:border-[#0f4c81] focus:ring-2 focus:ring-[#0f4c81]/15 transition"
          />
        </div>
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white outline-none focus:border-[#0f4c81] focus:ring-2 focus:ring-[#0f4c81]/15 transition min-w-[180px]"
        >
          <option value="">Todos los estados</option>
          <option value="PENDIENTE_DE_APROBACION">Pendiente de aprobación</option>
          <option value="APROBADA">Aprobada</option>
          <option value="RECHAZADA">Rechazada</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap">Docente</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap">Asignatura</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 hidden md:table-cell whitespace-nowrap">Carrera / Plan</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 hidden lg:table-cell whitespace-nowrap">Cátedra · Cargo</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 hidden xl:table-cell whitespace-nowrap">Modalidad · Designación</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 hidden lg:table-cell whitespace-nowrap">H/SEM · Año</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap">Estado</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 hidden sm:table-cell whitespace-nowrap">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center">
                    <div className="flex items-center justify-center gap-2 text-slate-400 text-sm">
                      <IcSpinner />
                      Cargando…
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-14 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <IcEmpty />
                      <div>
                        <p className="text-sm font-semibold text-slate-600 mb-1">Sin vinculaciones</p>
                        <p className="text-xs text-slate-400">
                          {buscar || filtroEstado
                            ? 'No hay resultados para los filtros aplicados.'
                            : 'Aún no se registraron vinculaciones. Hacé clic en "Nueva Vinculación" para comenzar.'}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : items.map(v => (
                <tr key={v.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="font-medium text-slate-800">{v.docente.apellido}, {v.docente.nombre}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-medium text-slate-700">{v.materia.nombre}</span>
                    {v.materia.codigo && <span className="block text-xs text-slate-400">{v.materia.codigo}</span>}
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <span className="text-slate-700">{v.carrera.nombre}</span>
                    <span className="block text-xs text-slate-400">{v.planEstudio.nombre}</span>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <span className="text-slate-700">{v.catedra.nombre}</span>
                    <span className="block text-xs text-slate-400">{v.cargo.nombre}</span>
                  </td>
                  <td className="px-4 py-3.5 hidden xl:table-cell">
                    <span className="text-slate-700">{v.modalidad.nombre}</span>
                    <span className="block text-xs text-slate-400">{v.designacion.nombre}</span>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <span className="text-slate-700 font-medium">
                      {v.horasSemana != null ? `${v.horasSemana} h/sem` : <span className="text-slate-400 text-xs italic">—</span>}
                    </span>
                    <span className="block text-xs text-slate-400">{v.anioInicio ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3.5">{badgeEstado(v.estado)}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-500 hidden sm:table-cell whitespace-nowrap">
                    {formatFecha(v.fechaCreacion)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && items.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
            <p className="text-xs text-slate-400">
              {items.length} vinculación{items.length !== 1 ? 'es' : ''} ·{' '}
              {items.filter(v => v.estado === 'PENDIENTE_DE_APROBACION').length} pendiente{items.filter(v => v.estado === 'PENDIENTE_DE_APROBACION').length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      {/* Drawer formulario */}
      {formulario && (
        <FormularioVinculacion
          onGuardado={onGuardado}
          onCerrar={() => setFormulario(false)}
        />
      )}
    </div>
  );
}
