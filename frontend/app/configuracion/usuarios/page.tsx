'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { normalizarMayusculas } from '@/lib/normalizarMayusculas';

interface Rol { id: string; nombre: string; }
interface Usuario {
  id: string; nombre: string; apellido: string;
  correoElectronico: string; activo: boolean;
  fechaCreacion: string; rol: Rol;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';
const INPUT = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#0f4c81] focus:ring-1 focus:ring-[#0f4c81]/20 transition';
const EMPTY_FORM = { nombre: '', apellido: '', correoElectronico: '', contrasena: '', rolId: '' };
const ITEMS_POR_PAGINA = 10;

export default function UsuariosPage() {
  const [usuarios, setUsuarios]         = useState<Usuario[]>([]);
  const [roles, setRoles]               = useState<Rol[]>([]);
  const [total, setTotal]               = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);

  // ── Filtros (estado: controla el render; ref: controla cargar sin closures) ─
  const [buscar, setBuscar]             = useState('');
  const [filtroActivo, setFiltroActivo] = useState('');
  const [filtroRol, setFiltroRol]       = useState('');
  const [pagina, setPagina]             = useState(1);

  const buscarRef       = useRef('');
  const filtroActivoRef = useRef('');
  const filtroRolRef    = useRef('');

  // ── UI ─────────────────────────────────────────────────────────────────────
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [exito, setExito]               = useState<string | null>(null);
  const [mostrarForm, setMostrarForm]   = useState(false);
  const [editandoId, setEditandoId]     = useState<string | null>(null);
  const [form, setForm]                 = useState({ ...EMPTY_FORM });
  const [formError, setFormError]       = useState<string | null>(null);
  const [submitting, setSubmitting]     = useState(false);

  const abortRef    = useRef<AbortController | null>(null);
  const rolesLoaded = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Carga de datos ─────────────────────────────────────────────────────────
  // cargar recibe todos los valores explícitamente — no captura nada por closure.
  // Esto elimina el bug de "último carácter no aplicado" causado por valores
  // stale atrapados en useCallback y por UppercaseInputGuard que modifica
  // element.value directamente en la fase capture antes del onChange de React.
  const cargar = useCallback(async (pg: number, termino: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (termino)                      params.set('buscar', termino);
      if (filtroActivoRef.current)      params.set('activo', filtroActivoRef.current);
      if (filtroRolRef.current)         params.set('rolId',  filtroRolRef.current);
      params.set('page',  String(pg));
      params.set('limit', String(ITEMS_POR_PAGINA));

      const url = `${API}/configuracion/usuarios?${params}`;

      const [resU, resR] = await Promise.all([
        apiFetch(url, { signal }),
        rolesLoaded.current
          ? Promise.resolve(null)
          : apiFetch(`${API}/configuracion/roles`, { signal }),
      ]);

      if (signal.aborted) return;
      if (!resU.ok) throw new Error('Error al cargar usuarios');

      const dataU = await resU.json();
      setUsuarios(dataU.data ?? []);
      setTotal(dataU.total ?? 0);
      setTotalPaginas(dataU.totalPaginas ?? 1);

      if (resR && resR.ok) {
        setRoles(await resR.json());
        rolesLoaded.current = true;
      }
    } catch (e: unknown) {
      if (signal.aborted) return;
      setError(e instanceof Error ? e.message : 'Error al cargar usuarios');
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []); // deps vacíos — lee de refs y params explícitos; nunca stale

  // Carga inicial; cargar es estable (deps vacíos), este effect solo corre al montar
  useEffect(() => {
    cargar(1, '');
    return () => { abortRef.current?.abort(); };
  }, [cargar]);

  // ── Handlers de filtros ────────────────────────────────────────────────────
  function handleBuscarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    // Actualizar ref PRIMERO (sincrónico) — cargar siempre leerá el valor actual
    buscarRef.current = value;
    setBuscar(value);

    // Debounce en el handler mismo, no en un useEffect, para evitar cascadas async
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPagina(1);
      cargar(1, buscarRef.current);
    }, 350);
  }

  function handleFiltroRolChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    filtroRolRef.current = value;
    setFiltroRol(value);
    setPagina(1);
    cargar(1, buscarRef.current);
  }

  function handleFiltroActivoChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    filtroActivoRef.current = value;
    setFiltroActivo(value);
    setPagina(1);
    cargar(1, buscarRef.current);
  }

  // ── Acciones form ──────────────────────────────────────────────────────────
  function abrirCrear() { setForm({ ...EMPTY_FORM }); setEditandoId(null); setFormError(null); setMostrarForm(true); }
  function abrirEditar(u: Usuario) {
    setForm({ nombre: u.nombre, apellido: u.apellido, correoElectronico: u.correoElectronico, contrasena: '', rolId: u.rol.id });
    setEditandoId(u.id); setFormError(null); setMostrarForm(true);
  }

  async function guardar() {
    if (!form.nombre || !form.apellido || !form.correoElectronico || !form.rolId) {
      setFormError('Completá los campos obligatorios.'); return;
    }
    if (!editandoId && !form.contrasena) { setFormError('La contraseña es obligatoria para nuevos usuarios.'); return; }
    setSubmitting(true); setFormError(null);
    try {
      const body: Record<string, string> = { nombre: form.nombre, apellido: form.apellido, correoElectronico: form.correoElectronico, rolId: form.rolId };
      if (form.contrasena) body.contrasena = form.contrasena;
      const url = editandoId ? `${API}/configuracion/usuarios/${editandoId}` : `${API}/configuracion/usuarios`;
      const res = await apiFetch(url, { method: editandoId ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message ?? 'Error al guardar'); }
      setExito(editandoId ? 'Usuario actualizado.' : 'Usuario creado.');
      setMostrarForm(false);
      cargar(pagina, buscarRef.current);
    } catch (e) { setFormError((e as Error).message); }
    finally { setSubmitting(false); setTimeout(() => setExito(null), 3000); }
  }

  async function toggleEstado(id: string) {
    await apiFetch(`${API}/configuracion/usuarios/${id}/estado`, { method: 'PATCH' });
    cargar(pagina, buscarRef.current);
  }

  // ── Estilos ────────────────────────────────────────────────────────────────
  const FILTER_INPUT = 'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-[#0f4c81] focus:ring-1 focus:ring-[#0f4c81]/20 transition';

  const desde = total === 0 ? 0 : (pagina - 1) * ITEMS_POR_PAGINA + 1;
  const hasta  = Math.min(pagina * ITEMS_POR_PAGINA, total);

  return (
    <div className="max-w-6xl mx-auto space-y-5 pt-4 px-2">

      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Configuración</p>
          <h1 className="text-xl font-bold text-slate-800">Usuarios</h1>
        </div>
        <button
          onClick={abrirCrear}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#0f4c81] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a3960] transition"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo usuario
        </button>
      </div>

      {exito && <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{exito}</div>}
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {/* Tabla */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">

        {/* Filtros */}
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap gap-2 items-center">
          {/*
            data-no-uppercase="true" evita que UppercaseInputGuard (listener global en
            fase capture) transforme el valor directamente en el DOM antes de que React
            procese el evento — lo que causaba desincronización del input controlado y
            el bug de "último carácter no aplicado".
          */}
          <input
            data-no-uppercase="true"
            value={buscar}
            onChange={handleBuscarChange}
            placeholder="Buscar por nombre, apellido o email..."
            className={`${FILTER_INPUT} min-w-[200px] flex-1`}
          />
          <select value={filtroRol} onChange={handleFiltroRolChange} className={FILTER_INPUT}>
            <option value="">Todos los roles</option>
            {roles.map(r => (
              <option key={r.id} value={r.id}>{r.nombre.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select value={filtroActivo} onChange={handleFiltroActivoChange} className={FILTER_INPUT}>
            <option value="">Todos los estados</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-[#0f4c81] text-white text-xs font-semibold uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Apellido y Nombre</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Rol</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Creación</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">Cargando...</td></tr>
              ) : usuarios.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">Sin usuarios encontrados.</td></tr>
              ) : usuarios.map((u, idx) => (
                <tr key={u.id} className={`border-t border-slate-100 ${idx % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{u.apellido}, {u.nombre}</td>
                  <td className="px-4 py-2.5 text-slate-600">{u.correoElectronico}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {u.rol.nombre.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border ${
                      u.activo ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">
                    {new Date(u.fechaCreacion).toLocaleDateString('es-AR')}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        onClick={() => abrirEditar(u)}
                        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => toggleEstado(u.id)}
                        className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                          u.activo ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'
                        }`}
                      >
                        {u.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/40">
            <span className="text-xs text-slate-500">
              Mostrando {desde}–{hasta} de {total} usuario{total !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => { const p = Math.max(1, pagina - 1); setPagina(p); cargar(p, buscarRef.current); }}
                disabled={pagina === 1}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-md hover:bg-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Anterior
              </button>
              <span className="px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-md bg-white min-w-[80px] text-center">
                Página {pagina} de {totalPaginas}
              </span>
              <button
                onClick={() => { const p = Math.min(totalPaginas, pagina + 1); setPagina(p); cargar(p, buscarRef.current); }}
                disabled={pagina === totalPaginas}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-md hover:bg-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {mostrarForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">
                {editandoId ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h2>
              <button
                onClick={() => setMostrarForm(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {formError && (
                <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{formError}</div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
                  <input
                    data-no-uppercase="true"
                    value={form.nombre}
                    onChange={e => setForm(p => ({ ...p, nombre: normalizarMayusculas(e.target.value) }))}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Apellido *</label>
                  <input
                    data-no-uppercase="true"
                    value={form.apellido}
                    onChange={e => setForm(p => ({ ...p, apellido: normalizarMayusculas(e.target.value) }))}
                    className={INPUT}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email *</label>
                <input type="email" data-no-uppercase="true" value={form.correoElectronico} onChange={e => setForm(p => ({ ...p, correoElectronico: e.target.value }))} className={INPUT} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Contraseña {editandoId ? '(dejar vacío para no cambiar)' : '*'}
                </label>
                <input type="password" data-no-uppercase="true" value={form.contrasena} onChange={e => setForm(p => ({ ...p, contrasena: e.target.value }))} className={INPUT} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Rol *</label>
                <select value={form.rolId} onChange={e => setForm(p => ({ ...p, rolId: e.target.value }))} className={INPUT}>
                  <option value="">Seleccionar rol</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.nombre.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setMostrarForm(false)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={submitting}
                className="rounded-md bg-[#0f4c81] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a3960] disabled:opacity-50 transition"
              >
                {submitting ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
