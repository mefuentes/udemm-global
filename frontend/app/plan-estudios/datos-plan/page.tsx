'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getPermisosPlanEstudio } from '@/lib/permisos-plan-estudios';

const NAV_INTERNA = [
  { label: 'Carreras',                         href: '/plan-estudios/carreras' },
  { label: 'Programas de Asignatura',          href: '/plan-estudios/programas-asignatura' },
  { label: 'Información de Planes de Estudio', href: '/plan-estudios/informacion-planes' },
];

const CAMPOS_PLAN = [
  { label: 'Carrera', valor: '—' },
  { label: 'Facultad', valor: '—' },
  { label: 'Versión del Plan', valor: '—' },
  { label: 'Resolución de Aprobación', valor: '—' },
  { label: 'Fecha de Aprobación', valor: '—' },
  { label: 'Duración (cuatrimestres)', valor: '—' },
  { label: 'Total de Créditos', valor: '—' },
  { label: 'Estado', valor: '—' },
];

export default function DatosPlanPage() {
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
        <span className="text-slate-600 font-medium">Datos del Plan</span>
      </nav>

      {/* Encabezado */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
          Plan de Estudios
        </p>
        <h1 className="text-xl font-bold text-slate-800">Datos del Plan</h1>
        <p className="mt-1 text-sm text-slate-500">
          Información general del plan: carrera, resolución de aprobación, versión y vigencia.
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
                ? 'border-[#0f4c81] text-[#0f4c81]'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* Acciones */}
      {(permisos.editar || permisos.exportar) && (
        <div className="flex items-center gap-2 mb-5">
          {permisos.editar && (
            <button
              disabled
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0f4c81] text-white text-xs font-medium opacity-50 cursor-not-allowed"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Editar Plan
            </button>
          )}
          {permisos.exportar && (
            <button
              disabled
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-medium opacity-50 cursor-not-allowed"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Exportar
            </button>
          )}
        </div>
      )}

      {/* Ficha de datos del plan */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Información General del Plan</h2>
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-medium">
            Sin datos
          </span>
        </div>

        <div className="divide-y divide-slate-50">
          {CAMPOS_PLAN.map((campo) => (
            <div key={campo.label} className="flex items-center px-5 py-3.5">
              <span className="w-48 text-xs font-medium text-slate-500 flex-shrink-0">{campo.label}</span>
              <span className="text-sm text-slate-400 italic">{campo.valor}</span>
            </div>
          ))}
        </div>

        <div className="px-5 py-5 bg-slate-50/50 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
            Los datos del plan se completarán al seleccionar un plan de estudios activo.
            Esta sección está en desarrollo.
          </p>
          <div className="mt-3 inline-flex px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200">
            <span className="text-[11px] font-medium text-amber-700">En desarrollo · Próxima versión</span>
          </div>
        </div>
      </div>
    </div>
  );
}
