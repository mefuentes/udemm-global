'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

const MODULOS = [
  {
    href: '/docentes',
    titulo: 'Gestión de Docentes',
    descripcion: 'Listado, búsqueda, fichas individuales y exportación de docentes.',
    activo: true,
    inicial: 'D',
  },
  {
    href: '#',
    titulo: 'Planes y Materias',
    descripcion: 'Gestión de planes de estudio y materias por carrera.',
    activo: false,
    inicial: 'M',
  },
  {
    href: '#',
    titulo: 'Reportes CONEAU',
    descripcion: 'Generación de reportes y estadísticas para acreditación.',
    activo: false,
    inicial: 'R',
  },
];

export default function Home() {
  const { usuario } = useAuth();

  return (
    <ProtectedRoute>
      <main className="p-6 sm:p-8 max-w-5xl mx-auto">

        {/* Encabezado */}
        <div className="mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Panel Principal</p>
          <h1 className="text-xl font-bold text-slate-800">UDEMM Global</h1>
          <p className="mt-1 text-sm text-slate-500">
            Plataforma institucional académica para los procesos de acreditación CONEAU.
          </p>
          {usuario && (
            <p className="mt-2 text-sm text-slate-600">
              Hola, <span className="font-semibold text-slate-800">{usuario.nombre} {usuario.apellido}</span>.
              {' '}Rol activo:{' '}
              <span className="inline-flex items-center rounded-md bg-[#0f4c81]/10 px-2 py-0.5 text-xs font-medium text-[#0f4c81]">
                {usuario.rol.nombre.replace(/_/g, ' ')}
              </span>
            </p>
          )}
        </div>

        {/* Módulos */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULOS.map((mod) =>
            mod.activo ? (
              <Link
                key={mod.href}
                href={mod.href}
                className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-[#0f4c81]/30 transition-all"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-[#0f4c81] flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-white">{mod.inicial}</span>
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-slate-800 group-hover:text-[#0f4c81] transition-colors leading-tight">
                      {mod.titulo}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500 leading-snug">{mod.descripcion}</p>
                  </div>
                </div>
                <p className="text-xs font-medium text-[#0f4c81] flex items-center gap-1">
                  Acceder
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </p>
              </Link>
            ) : (
              <div
                key={mod.titulo}
                className="rounded-xl border border-slate-200 bg-white/60 p-5 opacity-50 cursor-not-allowed"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-slate-400">{mod.inicial}</span>
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-slate-400 leading-tight">{mod.titulo}</h2>
                    <p className="mt-1 text-xs text-slate-400 leading-snug">{mod.descripcion}</p>
                  </div>
                </div>
                <p className="text-xs font-medium text-slate-400">Próxima fase</p>
              </div>
            )
          )}
        </div>

      </main>
    </ProtectedRoute>
  );
}
