'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getPermisosPlanEstudio } from '@/lib/permisos-plan-estudios';

// ── Iconos ───────────────────────────────────────────────────────────────────

const IcGrid = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);

const IcBook = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const IcClipboard = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

const IcDocument = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const IcInfo = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IcArrow = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

// ── Datos de secciones ────────────────────────────────────────────────────────

const SECCIONES = [
  {
    href: '/plan-estudios/malla-curricular',
    titulo: 'Malla Curricular',
    descripcion: 'Estructura de asignaturas distribuidas por año y cuatrimestre del plan de estudios.',
    inicial: 'MC',
    color: 'bg-[#0f4c81]',
    icon: <IcGrid />,
  },
  {
    href: '/plan-estudios/ficha-asignatura',
    titulo: 'Ficha de Asignatura',
    descripcion: 'Datos identificatorios de cada asignatura: código, créditos, correlativas y régimen.',
    inicial: 'FA',
    color: 'bg-[#1a5ea8]',
    icon: <IcClipboard />,
  },
  {
    href: '/plan-estudios/programas-asignatura',
    titulo: 'Programas de Asignatura',
    descripcion: 'Contenidos, objetivos, bibliografía y metodología de cada asignatura.',
    inicial: 'PA',
    color: 'bg-[#f26b22]',
    icon: <IcBook />,
  },
  {
    href: '/plan-estudios/datos-plan',
    titulo: 'Datos del Plan',
    descripcion: 'Información general del plan: carrera, resolución de aprobación, versión y vigencia.',
    inicial: 'DP',
    color: 'bg-slate-600',
    icon: <IcInfo />,
  },
];

// ── KPIs placeholder ─────────────────────────────────────────────────────────

const KPIS = [
  { label: 'Planes Activos', valor: '—', sublabel: 'Vigentes', color: 'text-[#0f4c81]', bg: 'bg-[#0f4c81]/8' },
  { label: 'Asignaturas', valor: '—', sublabel: 'En planes activos', color: 'text-[#1a5ea8]', bg: 'bg-[#1a5ea8]/8' },
  { label: 'Carreras', valor: '—', sublabel: 'Con plan de estudios', color: 'text-[#f26b22]', bg: 'bg-[#f26b22]/8' },
  { label: 'Total Planes', valor: '—', sublabel: 'Histórico', color: 'text-slate-600', bg: 'bg-slate-100' },
];

// ── Componente ────────────────────────────────────────────────────────────────

export default function PlanEstudiosPage() {
  const { usuario } = useAuth();
  const permisos = getPermisosPlanEstudio(usuario?.rol?.nombre ?? '');

  return (
    <div className="max-w-6xl">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-5">
        <a href="/" className="hover:text-slate-600 transition-colors">Inicio</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">Plan de Estudios</span>
      </nav>

      {/* Encabezado */}
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
            Gestión Académica
          </p>
          <h1 className="text-xl font-bold text-slate-800">Plan de Estudios</h1>
          <p className="mt-1 text-sm text-slate-500">
            Malla curricular, fichas y programas de asignatura por carrera.
          </p>
        </div>

        {/* Acciones según rol */}
        {permisos.crear && (
          <button
            disabled
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0f4c81] text-white text-sm font-medium opacity-50 cursor-not-allowed"
            title="Disponible en próxima versión"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Plan
          </button>
        )}

        {permisos.exportar && !permisos.crear && (
          <button
            disabled
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-medium opacity-50 cursor-not-allowed"
            title="Disponible en próxima versión"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Exportar
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {KPIS.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-4"
          >
            <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${kpi.bg} mb-3`}>
              <span className={`text-xs font-bold ${kpi.color}`}>
                {kpi.label.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.valor}</p>
            <p className="text-xs font-semibold text-slate-700 mt-0.5">{kpi.label}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{kpi.sublabel}</p>
          </div>
        ))}
      </div>

      {/* Secciones */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-700">Secciones del módulo</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {SECCIONES.map((sec) => (
          <Link
            key={sec.href}
            href={sec.href}
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-[#0f4c81]/30 transition-all"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl ${sec.color} flex items-center justify-center flex-shrink-0 text-white`}>
                {sec.icon}
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-800 group-hover:text-[#0f4c81] transition-colors leading-tight">
                  {sec.titulo}
                </h2>
                <p className="mt-1 text-xs text-slate-500 leading-snug">{sec.descripcion}</p>
              </div>
            </div>
            <p className="text-xs font-medium text-[#0f4c81] flex items-center gap-1">
              {permisos.editar ? 'Gestionar' : 'Ver'}
              <IcArrow />
            </p>
          </Link>
        ))}
      </div>

      {/* Rol actual */}
      <div className="mt-8 flex items-center gap-2 text-xs text-slate-400">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <span>
          Acceso como <strong className="text-slate-500">{usuario?.rol?.nombre?.replace(/_/g, ' ')}</strong>
          {' · '}
          {permisos.gestionarContenido
            ? 'Acceso total funcional'
            : permisos.exportar
            ? 'Visualización y exportación'
            : 'Sólo visualización'}
        </span>
      </div>
    </div>
  );
}
