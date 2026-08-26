'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch as apiFetchBase } from '@/lib/api';
import { getPermisosPlanEstudio } from '@/lib/permisos-plan-estudios';

// ── Constantes ────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

const NAV_INTERNA = [
  { label: 'Carreras',                         href: '/plan-estudios/carreras' },
  { label: 'Programas de Asignatura',          href: '/plan-estudios/programas-asignatura' },
  { label: 'Información de Planes de Estudio', href: '/plan-estudios/informacion-planes' },
];

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Facultad { id: string; nombre: string; codigo?: string; estado?: string }
interface Carrera {
  id: string;
  codigo?: string;
  nombre: string;
  facultadId: string;
  facultad?: Facultad;
  tituloOtorgado?: string;
  duracionAnios?: number;
  modalidad?: string;
  estado: string;
  _count?: { planes: number };
}

// ── Iconos ────────────────────────────────────────────────────────────────────

const IcSpinner = () => (
  <div className="w-5 h-5 rounded-full border-2 border-slate-300 border-t-[#0f4c81] animate-spin" />
);

const IcSearch = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const IcArrowRight = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

const IcBuilding = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
  </svg>
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function iniciales(nombre: string): string {
  const words = nombre.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  const last = words.length > 2 ? words[2] : words[1];
  return (words[0][0] + last[0]).toUpperCase();
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function CarrerasPage() {
  const pathname = usePathname();
  const { usuario } = useAuth();

  const [facultades,  setFacultades]  = useState<Facultad[]>([]);
  const [carreras,    setCarreras]    = useState<Carrera[]>([]);
  const [cargando,    setCargando]    = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [buscar,      setBuscar]      = useState('');
  const [filtroFacId, setFiltroFacId] = useState('');

  // ── API ───────────────────────────────────────────────────────────────────

  async function apiFetch(url: string) {
    const res = await apiFetchBase(url);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message ?? 'Error en la solicitud');
    return data;
  }

  useEffect(() => {
    if (!usuario) return;
    setCargando(true);
    Promise.all([
      apiFetch(`${API_URL}/facultades`),
      apiFetch(`${API_URL}/carreras`),
    ])
      .then(([facs, cars]) => {
        const facList: Facultad[] = facs ?? [];
        const carList: Carrera[]  = cars ?? [];
        setFacultades(facList);
        setCarreras(carList);
        const ingenieria = facList.find(f =>
          f.nombre.toLowerCase().includes('ingeniería') ||
          f.nombre.toLowerCase().includes('ingenieria')
        );
        const defaultFac = ingenieria ?? facList[0];
        if (defaultFac) setFiltroFacId(defaultFac.id);
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setCargando(false));
  }, [usuario]);

  // ── Filtrado ──────────────────────────────────────────────────────────────

  const carrerasFiltradas = useMemo(() => {
    const t = buscar.trim().toLowerCase();
    return carreras.filter(c => {
      if (filtroFacId && c.facultadId !== filtroFacId) return false;
      if (t && !c.nombre.toLowerCase().includes(t) && !c.codigo?.toLowerCase().includes(t)) return false;
      return true;
    });
  }, [carreras, filtroFacId, buscar]);

  const conteoFac = useMemo(() => {
    const m: Record<string, number> = {};
    carreras.forEach(c => { m[c.facultadId] = (m[c.facultadId] ?? 0) + 1; });
    return m;
  }, [carreras]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-5">
        <a href="/" className="hover:text-slate-600 transition-colors">Inicio</a>
        <span>/</span>
        <a href="/plan-estudios" className="hover:text-slate-600 transition-colors">Plan de Estudios</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">Carreras</span>
      </nav>

      {/* Encabezado */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Plan de Estudios</p>
        <h1 className="text-xl font-bold text-slate-800">Carreras</h1>
        <p className="mt-1 text-sm text-slate-500">
          Carreras con planes de estudio activos. Seleccioná una para acceder a su información de planes, malla y programas.
        </p>
      </div>

      {/* Navegación interna */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 overflow-x-auto">
        {NAV_INTERNA.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
              pathname === item.href
                ? 'border-[#0f4c81] text-[#0f4c81]'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* Filtros */}
      <div className="mb-5 space-y-3">
        {/* Búsqueda */}
        <div className="relative max-w-sm">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <IcSearch />
          </div>
          <input
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            placeholder="Buscar por nombre o código..."
            className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
          />
        </div>

        {/* Facultad pills */}
        {!cargando && facultades.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFiltroFacId('')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                !filtroFacId
                  ? 'bg-[#0f4c81] text-white border-[#0f4c81]'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-[#0f4c81]/40 hover:text-[#0f4c81]'
              }`}
            >
              Todas ({carreras.length})
            </button>
            {facultades.map(f => (
              <button
                key={f.id}
                onClick={() => setFiltroFacId(f.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  filtroFacId === f.id
                    ? 'bg-[#0f4c81] text-white border-[#0f4c81]'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-[#0f4c81]/40 hover:text-[#0f4c81]'
                }`}
              >
                {f.nombre} ({conteoFac[f.id] ?? 0})
                {f.estado === 'INACTIVO' && (
                  <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                    filtroFacId === f.id ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
                  }`}>
                    Inactiva
                  </span>
                )}
              </button>
            ))}
          </div>
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
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 flex items-center justify-center gap-3">
          <IcSpinner />
          <span className="text-sm text-slate-500">Cargando carreras...</span>
        </div>
      ) : carrerasFiltradas.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#0f4c81]/8 flex items-center justify-center mx-auto mb-3 text-[#0f4c81]">
            <IcBuilding />
          </div>
          <p className="text-sm font-medium text-slate-600 mb-1">
            {carreras.length === 0
              ? 'No hay carreras registradas'
              : 'Sin resultados para los filtros aplicados'}
          </p>
          <p className="text-xs text-slate-400">
            {carreras.length === 0
              ? 'Las carreras se gestionan desde Gestión Académica.'
              : 'Intentá con otro término o cambiá la facultad seleccionada.'}
          </p>
          {(buscar || filtroFacId) && (
            <button
              onClick={() => { setBuscar(''); setFiltroFacId(''); }}
              className="mt-3 text-xs text-[#0f4c81] hover:underline font-medium"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <>
          {(buscar || filtroFacId) && (
            <p className="text-[11px] text-slate-400 mb-3">
              {carrerasFiltradas.length} carrera{carrerasFiltradas.length !== 1 ? 's' : ''} de {carreras.length}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {carrerasFiltradas.map(carrera => (
              <CarreraCard key={carrera.id} carrera={carrera} />
            ))}
          </div>
        </>
      )}

      {/* Pie */}
      {!cargando && !error && carreras.length > 0 && (
        <div className="mt-6 flex items-center gap-2 text-xs text-slate-400">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Las carreras se administran desde{' '}
            <Link href="/gestion-academica/carreras" className="text-[#0f4c81] hover:underline font-medium">
              Gestión Académica → Carreras
            </Link>
          </span>
        </div>
      )}
    </div>
  );
}

// ── Tarjeta de carrera ────────────────────────────────────────────────────────

function CarreraCard({ carrera }: { carrera: Carrera }) {
  const tienesPlan = (carrera._count?.planes ?? 0) > 0;
  const ini = iniciales(carrera.nombre);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-[#0f4c81]/25 transition-all duration-200 flex flex-col overflow-hidden">

      {/* Borde superior de color */}
      <div className="h-1 bg-gradient-to-r from-[#0f4c81] to-[#1a6cbe]" />

      <div className="p-4 flex flex-col gap-3 flex-1">

        {/* Fila superior: ícono + código + badge */}
        <div className="flex items-start gap-2">
          <div className="w-9 h-9 rounded-lg bg-[#0f4c81] flex items-center justify-center flex-shrink-0">
            <span className="text-[11px] font-bold text-white tracking-wide">{ini}</span>
          </div>

          <div className="flex-1 flex flex-wrap items-center gap-1.5 pt-0.5">
            {carrera.codigo && (
              <span className="text-[10px] font-bold font-mono bg-[#0f4c81]/8 text-[#0f4c81] px-1.5 py-0.5 rounded border border-[#0f4c81]/15">
                {carrera.codigo}
              </span>
            )}
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border whitespace-nowrap ${
              tienesPlan
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {tienesPlan ? '● Plan vigente' : '○ Sin plan'}
            </span>
          </div>
        </div>

        {/* Nombre */}
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-800 leading-snug">
            {carrera.nombre}
          </p>

          {carrera.facultad && (
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
              </svg>
              {carrera.facultad.nombre}
            </p>
          )}

          {carrera.tituloOtorgado && (
            <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">
              <span className="font-medium text-slate-400">Título: </span>
              {carrera.tituloOtorgado}
            </p>
          )}
        </div>

        {/* Botón */}
        <Link
          href={`/plan-estudios/carreras/${carrera.id}/planes`}
          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-[#0f4c81] text-white text-xs font-semibold hover:bg-[#0d3e6b] active:bg-[#0a3258] transition-colors mt-1"
        >
          Ver Planes de Estudio
          <IcArrowRight />
        </Link>
      </div>
    </div>
  );
}
