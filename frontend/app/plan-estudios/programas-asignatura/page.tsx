'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getPermisosPlanEstudio } from '@/lib/permisos-plan-estudios';

const NAV_INTERNA = [
  { label: 'Malla Curricular', href: '/plan-estudios/malla-curricular' },
  { label: 'Ficha de Asignatura', href: '/plan-estudios/ficha-asignatura' },
  { label: 'Programas de Asignatura', href: '/plan-estudios/programas-asignatura' },
  { label: 'Datos del Plan', href: '/plan-estudios/datos-plan' },
];

export default function ProgramasAsignaturaPage() {
  const pathname = usePathname();
  const { usuario } = useAuth();
  const permisos = getPermisosPlanEstudio(usuario?.rol?.nombre ?? '');

  return (
    <div className="max-w-6xl">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-5">
        <a href="/" className="hover:text-slate-600 transition-colors">Inicio</a>
        <span>/</span>
        <a href="/plan-estudios" className="hover:text-slate-600 transition-colors">Plan de Estudios</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">Programas de Asignatura</span>
      </nav>

      {/* Encabezado */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
          Plan de Estudios
        </p>
        <h1 className="text-xl font-bold text-slate-800">Programas de Asignatura</h1>
        <p className="mt-1 text-sm text-slate-500">
          Contenidos, objetivos, bibliografía y metodología de evaluación por asignatura.
        </p>
      </div>

      {/* Navegación interna */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 overflow-x-auto">
        {NAV_INTERNA.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
              pathname === item.href
                ? 'border-[#f26b22] text-[#f26b22]'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* Acciones */}
      {permisos.gestionarContenido && (
        <div className="flex items-center gap-2 mb-5">
          <button
            disabled
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f26b22] text-white text-xs font-medium opacity-50 cursor-not-allowed"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Programa
          </button>
          {permisos.exportar && (
            <button
              disabled
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-medium opacity-50 cursor-not-allowed"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Exportar PDF
            </button>
          )}
        </div>
      )}

      {/* Contenido vacío */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-8 sm:p-12 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#f26b22]/8 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-[#f26b22]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Programas de Asignatura</h3>
          <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
            Aquí se cargarán y consultarán los programas analíticos de cada asignatura:
            unidades temáticas, objetivos, bibliografía y metodología de evaluación.
            Esta sección está en desarrollo.
          </p>
          <div className="mt-4 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200">
            <span className="text-[11px] font-medium text-amber-700">En desarrollo · Próxima versión</span>
          </div>
        </div>
      </div>
    </div>
  );
}
