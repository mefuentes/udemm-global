'use client';

import Link from 'next/link';

const MODULOS = [
  {
    href: '/configuracion/usuarios',
    titulo: 'Usuarios',
    descripcion: 'Crear, editar y gestionar el estado de los usuarios del sistema.',
    inicial: 'U',
    color: 'bg-[#0f4c81]',
  },
  {
    href: '/configuracion/roles',
    titulo: 'Roles',
    descripcion: 'Administrar roles del sistema: nombre, descripción y estado.',
    inicial: 'R',
    color: 'bg-[#1a5ea8]',
  },
  {
    href: '/configuracion/parametros',
    titulo: 'Parámetros Generales',
    descripcion: 'Configuración institucional: nombre, sigla, contacto y parámetros del sistema.',
    inicial: 'P',
    color: 'bg-slate-600',
  },
];

export default function ConfiguracionPage() {
  return (
    <div className="p-6 sm:p-8 max-w-4xl">
      <div className="mb-7">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Administración</p>
        <h1 className="text-xl font-bold text-slate-800">Configuración del Sistema</h1>
        <p className="mt-1 text-sm text-slate-500">
          Gestión de usuarios, roles y parámetros institucionales. Acceso exclusivo para Administrador del Sistema.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULOS.map((mod) => (
          <Link
            key={mod.href}
            href={mod.href}
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-[#0f4c81]/30 transition-all"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className={`w-9 h-9 rounded-lg ${mod.color} flex items-center justify-center flex-shrink-0`}>
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
              Administrar
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
