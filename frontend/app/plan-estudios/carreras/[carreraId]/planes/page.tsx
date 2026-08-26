'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch as apiFetchBase } from '@/lib/api';
import { getPermisosPlanEstudio } from '@/lib/permisos-plan-estudios';

// ── Constantes ────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

const ESTADOS_PLAN = ['ACTIVO', 'INACTIVO', 'EN_REVISION'];

const PLAN_VACIO = {
  nombre: '', anio: '', version: '', estado: 'ACTIVO',
  duracionCuatrimestres: '', totalCreditos: '', resolucionAprobacion: '',
};
type FormPlan = typeof PLAN_VACIO;

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Facultad { id: string; nombre: string; estado?: string }
interface Carrera {
  id: string;
  nombre: string;
  codigo?: string;
  facultad?: Facultad;
}

interface Plan {
  id: string;
  codigo?: string;
  nombre: string;
  anio?: number;
  version?: string;
  estado: string;
  descripcion?: string;
  duracionCuatrimestres?: number;
  totalCreditos?: number;
  resolucionAprobacion?: string;
  fechaAprobacion?: string;
  carreraId: string;
  aniosEstructura?: number | null;
  _count?: { materias: number };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function estadoLabel(estado: string): string {
  if (estado === 'ACTIVO')      return 'Vigente';
  if (estado === 'EN_REVISION') return 'En revisión';
  return 'No vigente';
}

function estadoClases(estado: string): string {
  if (estado === 'ACTIVO')      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (estado === 'EN_REVISION') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-500 border-slate-200';
}

function accentClases(estado: string): string {
  if (estado === 'ACTIVO')      return 'bg-gradient-to-r from-emerald-500 to-emerald-400';
  if (estado === 'EN_REVISION') return 'bg-gradient-to-r from-amber-400 to-amber-300';
  return 'bg-slate-200';
}

function borderClases(estado: string): string {
  if (estado === 'ACTIVO') return 'border-emerald-200 hover:border-emerald-300';
  return 'border-slate-200 hover:border-[#0f4c81]/20';
}

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Iconos ────────────────────────────────────────────────────────────────────

const IcPlus = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);
const IcEdit = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);
const IcClose = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const IcArrowRight = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);
const IcBack = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);
const IcSpinner = () => (
  <div className="w-5 h-5 rounded-full border-2 border-slate-300 border-t-[#0f4c81] animate-spin" />
);
const IcDocument = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
  </svg>
);

// ── Componente principal ──────────────────────────────────────────────────────

export default function PlanesCarreraPage() {
  const params = useParams();
  const carreraId = params.carreraId as string;
  const { usuario } = useAuth();
  const permisos = getPermisosPlanEstudio(usuario?.rol?.nombre ?? '');

  const [carrera,        setCarrera]        = useState<Carrera | null>(null);
  const [planes,         setPlanes]         = useState<Plan[]>([]);
  const [cargando,       setCargando]       = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [modalAbierto,   setModalAbierto]   = useState(false);
  const [editando,       setEditando]       = useState<Plan | null>(null);
  const [form,           setForm]           = useState<FormPlan>(PLAN_VACIO);
  const [guardando,      setGuardando]      = useState(false);

  // ── API ───────────────────────────────────────────────────────────────────

  async function apiFetch(url: string, opts?: RequestInit) {
    const res = await apiFetchBase(url, opts);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message ?? 'Error en la solicitud');
    return data;
  }

  useEffect(() => {
    if (!usuario || !carreraId) return;
    setCargando(true);
    Promise.all([
      apiFetch(`${API_URL}/carreras/${carreraId}`),
      apiFetch(`${API_URL}/plan-estudios?carreraId=${carreraId}`),
    ])
      .then(([car, pls]) => {
        setCarrera(car);
        setPlanes(pls ?? []);
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setCargando(false));
  }, [usuario, carreraId]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function abrirCrear() {
    setForm(PLAN_VACIO);
    setEditando(null);
    setModalAbierto(true);
  }

  function abrirEditar(plan: Plan) {
    setForm({
      nombre:               plan.nombre,
      anio:                 plan.anio?.toString() ?? '',
      version:              plan.version ?? '',
      estado:               plan.estado,
      duracionCuatrimestres: plan.duracionCuatrimestres?.toString() ?? '',
      totalCreditos:        plan.totalCreditos?.toString() ?? '',
      resolucionAprobacion: plan.resolucionAprobacion ?? '',
    });
    setEditando(plan);
    setModalAbierto(true);
  }

  function setF(campo: keyof FormPlan, val: string) {
    setForm(prev => ({ ...prev, [campo]: val }));
  }

  async function guardar() {
    if (!form.nombre.trim()) { alert('El nombre es obligatorio.'); return; }
    if (form.anio && !/^\d{4}$/.test(form.anio.trim())) {
      alert('El año del plan debe tener exactamente 4 dígitos numéricos (ej: 2006).');
      return;
    }
    setGuardando(true);
    try {
      const payload: Record<string, unknown> = {
        nombre:  form.nombre.trim(),
        estado:  form.estado,
        carreraId,
        version:              form.version.trim() || undefined,
        anio:                 form.anio                 ? parseInt(form.anio)                 : undefined,
        duracionCuatrimestres: form.duracionCuatrimestres ? parseInt(form.duracionCuatrimestres) : undefined,
        totalCreditos:        form.totalCreditos        ? parseInt(form.totalCreditos)        : undefined,
        resolucionAprobacion: form.resolucionAprobacion.trim() || undefined,
      };

      if (editando) {
        const saved: Plan = await apiFetch(`${API_URL}/plan-estudios/${editando.id}`, {
          method: 'PATCH', body: JSON.stringify(payload),
        });
        setPlanes(prev => prev.map(p => p.id === editando.id ? { ...p, ...saved } : p));
      } else {
        const saved: Plan = await apiFetch(`${API_URL}/plan-estudios`, {
          method: 'POST', body: JSON.stringify(payload),
        });
        setPlanes(prev => [...prev, { ...saved, _count: { materias: 0 } }]);
      }
      setModalAbierto(false);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  const facultadInactiva = carrera?.facultad?.estado === 'INACTIVO';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-5 flex-wrap">
        <a href="/" className="hover:text-slate-600 transition-colors">Inicio</a>
        <span>/</span>
        <a href="/plan-estudios" className="hover:text-slate-600 transition-colors">Plan de Estudios</a>
        <span>/</span>
        <Link href="/plan-estudios/carreras" className="hover:text-slate-600 transition-colors">Carreras</Link>
        <span>/</span>
        <span className="text-slate-600 font-medium">
          {cargando ? '...' : (carrera?.nombre ?? 'Carrera')}
        </span>
      </nav>

      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Plan de Estudios</p>
          <h1 className="text-xl font-bold text-slate-800">Planes de Estudio</h1>

          {cargando ? (
            <div className="mt-1.5 space-y-1.5">
              <div className="h-4 w-56 bg-slate-100 rounded animate-pulse" />
              <div className="h-3 w-40 bg-slate-100 rounded animate-pulse" />
            </div>
          ) : carrera ? (
            <div className="mt-1">
              <p className="text-sm font-semibold text-[#0f4c81]">{carrera.nombre}</p>
              {carrera.facultad && (
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                  </svg>
                  {carrera.facultad.nombre}
                </p>
              )}
            </div>
          ) : null}
        </div>

        <Link
          href="/plan-estudios/carreras"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors self-start whitespace-nowrap"
        >
          <IcBack />
          Volver a Carreras
        </Link>
      </div>

      {/* Aviso facultad inactiva */}
      {!cargando && facultadInactiva && (
        <div className="mb-5 flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span>
            <span className="font-semibold">La Facultad se encuentra inactiva.</span>{' '}
            Debe activarla para cargar Carreras o Planes de Estudio.
            Los planes existentes pueden consultarse en modo lectura.
          </span>
        </div>
      )}

      {/* Barra de acciones */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-xs text-slate-500">
          {!cargando && !error && `${planes.length} plan${planes.length !== 1 ? 'es' : ''} de estudio`}
        </p>
        {permisos.crear && (
          <button
            onClick={facultadInactiva ? undefined : abrirCrear}
            disabled={facultadInactiva}
            title={facultadInactiva ? 'La Facultad está inactiva. Activala para crear planes.' : undefined}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
              facultadInactiva
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-[#0f4c81] text-white hover:bg-[#0d3e6b]'
            }`}
          >
            <IcPlus />
            Nuevo Plan
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Contenido */}
      {cargando ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-pulse">
              <div className="h-1 bg-slate-200" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-slate-100 rounded w-3/4" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
                <div className="grid grid-cols-2 gap-2">
                  {[1,2,3,4].map(j => <div key={j} className="h-12 bg-slate-100 rounded-lg" />)}
                </div>
                <div className="h-8 bg-slate-100 rounded-lg mt-2" />
              </div>
            </div>
          ))}
        </div>
      ) : planes.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
          <div className="w-14 h-14 rounded-xl bg-[#0f4c81]/8 flex items-center justify-center mx-auto mb-3 text-[#0f4c81]">
            <IcDocument />
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">Sin planes de estudio</p>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Esta carrera no tiene planes de estudio registrados.
            {permisos.crear && !facultadInactiva && ' Podés crear uno con el botón "Nuevo Plan".'}
          </p>
          {permisos.crear && !facultadInactiva && (
            <button
              onClick={abrirCrear}
              className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0f4c81] text-white text-xs font-semibold hover:bg-[#0d3e6b] transition-colors mx-auto"
            >
              <IcPlus />
              Nuevo Plan
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {planes.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              carreraId={carreraId}
              onEditar={permisos.editar ? () => abrirEditar(plan) : undefined}
            />
          ))}
        </div>
      )}

      {/* Modal crear/editar plan */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">

            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">
                {editando ? 'Editar Plan de Estudio' : 'Nuevo Plan de Estudio'}
              </h3>
              <button
                onClick={() => setModalAbierto(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <IcClose />
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-4">

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.nombre}
                  onChange={e => setF('nombre', e.target.value)}
                  placeholder="Ej: Plan de Estudios 2024"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Año</label>
                  <input
                    type="number" min="1000" max="9999"
                    value={form.anio}
                    onChange={e => {
                      const v = e.target.value;
                      if (v === '' || /^\d{0,4}$/.test(v)) setF('anio', v);
                    }}
                    placeholder="2006"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Versión</label>
                  <input
                    value={form.version}
                    onChange={e => setF('version', e.target.value)}
                    placeholder="Ej: 1.0"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Estado</label>
                <select
                  value={form.estado}
                  onChange={e => setF('estado', e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
                >
                  {ESTADOS_PLAN.map(e => (
                    <option key={e} value={e}>{estadoLabel(e)}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Cuatrimestres</label>
                  <input
                    type="number" min="1" max="20"
                    value={form.duracionCuatrimestres}
                    onChange={e => setF('duracionCuatrimestres', e.target.value)}
                    placeholder="10"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Total Créditos</label>
                  <input
                    type="number" min="0"
                    value={form.totalCreditos}
                    onChange={e => setF('totalCreditos', e.target.value)}
                    placeholder="200"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Resolución de Aprobación</label>
                <input
                  value={form.resolucionAprobacion}
                  onChange={e => setF('resolucionAprobacion', e.target.value)}
                  placeholder="Ej: Res. 1234/2024"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button
                onClick={() => setModalAbierto(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={guardando}
                className="px-4 py-2 text-xs font-semibold bg-[#0f4c81] text-white rounded-lg hover:bg-[#0d3e6b] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tarjeta de plan ───────────────────────────────────────────────────────────

function PlanCard({ plan, carreraId, onEditar }: {
  plan: Plan;
  carreraId: string;
  onEditar?: () => void;
}) {
  const anios = plan.aniosEstructura ?? null;

  return (
    <div className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden ${borderClases(plan.estado)}`}>

      {/* Borde superior de color */}
      <div className={`h-1 ${accentClases(plan.estado)}`} />

      <div className="p-4 flex flex-col gap-3 flex-1">

        {/* Nombre + estado */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold text-slate-800 leading-snug flex-1">{plan.nombre}</p>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 whitespace-nowrap ${estadoClases(plan.estado)}`}>
            {estadoLabel(plan.estado)}
          </span>
        </div>

        {/* Badges: año, versión, código */}
        {(plan.anio || plan.version || plan.codigo) && (
          <div className="flex flex-wrap gap-1.5">
            {plan.anio && (
              <span className="text-[10px] font-bold font-mono bg-[#0f4c81]/8 text-[#0f4c81] px-2 py-0.5 rounded border border-[#0f4c81]/15">
                {plan.anio}
              </span>
            )}
            {plan.version && (
              <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                v{plan.version}
              </span>
            )}
            {plan.codigo && (
              <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                {plan.codigo}
              </span>
            )}
          </div>
        )}

        {/* Estadísticas */}
        <div className="grid grid-cols-2 gap-2">
          <StatCell
            valor={plan._count?.materias?.toString() ?? '—'}
            label="Asignaturas"
          />
          {anios != null ? (
            <StatCell valor={anios.toString()} label="Años del plan" />
          ) : (
            <StatCell valor="—" label="Años del plan" />
          )}
          {plan.duracionCuatrimestres != null && (
            <StatCell valor={plan.duracionCuatrimestres.toString()} label="Cuatrimestres" />
          )}
          {plan.totalCreditos != null && (
            <StatCell valor={plan.totalCreditos.toString()} label="Créditos" />
          )}
        </div>

        {/* Resolución / fecha aprobación */}
        {(plan.resolucionAprobacion || plan.fechaAprobacion) && (
          <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-50 space-y-0.5">
            {plan.resolucionAprobacion && (
              <p className="leading-snug">
                <span className="text-slate-400 font-medium">Res.:</span>{' '}
                {plan.resolucionAprobacion}
              </p>
            )}
            {plan.fechaAprobacion && (
              <p>
                <span className="text-slate-400 font-medium">Aprobado:</span>{' '}
                {formatFecha(plan.fechaAprobacion)}
              </p>
            )}
          </div>
        )}

        {/* Botones */}
        <div className="flex flex-col gap-1.5 mt-auto pt-1">
          <Link
            href={`/plan-estudios/carreras/${carreraId}/planes/${plan.id}/estructura`}
            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-[#0f4c81] text-white text-xs font-semibold hover:bg-[#0d3e6b] active:bg-[#0a3258] transition-colors"
          >
            Ver Estructura Curricular
            <IcArrowRight />
          </Link>
          {onEditar && (
            <button
              onClick={onEditar}
              className="flex items-center justify-center gap-1 w-full py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
            >
              <IcEdit />
              Editar plan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Stat cell ─────────────────────────────────────────────────────────────────

function StatCell({ valor, label }: { valor: string; label: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
      <p className="text-sm font-bold text-slate-700 leading-none">{valor}</p>
      <p className="text-[10px] text-slate-400 mt-1 leading-none">{label}</p>
    </div>
  );
}
