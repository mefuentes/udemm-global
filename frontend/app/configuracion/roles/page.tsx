'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface Rol { id: string; nombre: string; descripcion: string | null; activo: boolean; fechaCreacion: string; cantidadUsuarios: number; }

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';
const INPUT = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#0f4c81] focus:ring-1 focus:ring-[#0f4c81]/20 transition';
const EMPTY = { nombre: '', descripcion: '' };

export default function RolesPage() {
  const [roles, setRoles] = useState<Rol[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function cargar() {
    setLoading(true); setError(null);
    try {
      const res = await apiFetch(`${API}/configuracion/roles`);
      if (!res.ok) throw new Error('Error al cargar roles');
      setRoles(await res.json());
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  useEffect(() => { cargar(); }, []);

  function abrirCrear() { setForm({ ...EMPTY }); setEditandoId(null); setFormError(null); setMostrarForm(true); }
  function abrirEditar(r: Rol) {
    setForm({ nombre: r.nombre, descripcion: r.descripcion ?? '' });
    setEditandoId(r.id); setFormError(null); setMostrarForm(true);
  }

  async function guardar() {
    if (!form.nombre) { setFormError('El nombre es obligatorio.'); return; }
    setSubmitting(true); setFormError(null);
    try {
      const url = editandoId ? `${API}/configuracion/roles/${editandoId}` : `${API}/configuracion/roles`;
      const res = await apiFetch(url, { method: editandoId ? 'PATCH' : 'POST', body: JSON.stringify(form) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message ?? 'Error al guardar'); }
      setExito(editandoId ? 'Rol actualizado.' : 'Rol creado.');
      setMostrarForm(false); cargar();
    } catch (e) { setFormError((e as Error).message); }
    finally { setSubmitting(false); setTimeout(() => setExito(null), 3000); }
  }

  async function toggleEstado(id: string) {
    await apiFetch(`${API}/configuracion/roles/${id}/estado`, { method: 'PATCH' });
    cargar();
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5 pt-4">

      {/* Encabezado */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Configuración</p>
        <h1 className="text-xl font-bold text-slate-800">Roles</h1>
      </div>

      {exito && <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{exito}</div>}
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {/* Tabla */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-[#0f4c81] text-white text-xs font-semibold uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Descripción</th>
                <th className="px-4 py-3 text-left">Usuarios</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">Cargando...</td></tr>
              ) : roles.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">Sin roles registrados.</td></tr>
              ) : roles.map((r, idx) => (
                <tr key={r.id} className={`border-t border-slate-100 ${idx % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{r.nombre.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.descripcion || '-'}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {r.cantidadUsuarios} usuario{r.cantidadUsuarios !== 1 ? 's' : ''}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border ${
                      r.activo ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {r.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex gap-2">
                      <button onClick={() => abrirEditar(r)} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition">
                        Editar
                      </button>
                      <button onClick={() => toggleEstado(r.id)}
                        className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                          r.activo ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'
                        }`}>
                        {r.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {mostrarForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">
                {editandoId ? 'Editar Rol' : 'Nuevo Rol'}
              </h2>
              <button onClick={() => setMostrarForm(false)} className="text-slate-400 hover:text-slate-600 transition">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {formError && (
                <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{formError}</div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nombre del Rol *</label>
                <input
                  value={form.nombre}
                  onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej: COORDINADOR_ACADEMICO"
                  className={INPUT}
                />
                <p className="mt-1 text-xs text-slate-400">Se guardará en mayúsculas con guiones bajos.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
                <textarea
                  value={form.descripcion}
                  onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                  rows={3}
                  className={INPUT}
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setMostrarForm(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
                Cancelar
              </button>
              <button onClick={guardar} disabled={submitting} className="rounded-md bg-[#0f4c81] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a3960] disabled:opacity-50 transition">
                {submitting ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
