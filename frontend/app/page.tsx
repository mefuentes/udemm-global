'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { ReactNode } from 'react';

// ── Icons ─────────────────────────────────────────────────────────────────────

const IcDocentes = () => (
  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const IcPlanEstudios = () => (
  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const IcGestionAcademica = () => (
  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const IcConfig = () => (
  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const IcFicha = () => (
  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c0 1.306.835 2.417 2 2.83M13 16h2" />
  </svg>
);

const IcAprobaciones = () => (
  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

// ── Color palette ─────────────────────────────────────────────────────────────

type ColorKey = 'blue' | 'violet' | 'teal' | 'slate' | 'indigo' | 'amber';

const COLORES: Record<ColorKey, { gradient: string; shadow: string; text: string; border: string; pill: string }> = {
  blue:   { gradient: 'from-[#0f4c81] to-[#1a5ea8]',  shadow: 'shadow-blue-900/20',    text: 'text-[#0f4c81]',  border: 'hover:border-[#0f4c81]/40', pill: 'bg-blue-50 text-blue-800'     },
  violet: { gradient: 'from-violet-600 to-purple-700', shadow: 'shadow-violet-500/20',  text: 'text-violet-700', border: 'hover:border-violet-300',   pill: 'bg-violet-50 text-violet-700' },
  teal:   { gradient: 'from-teal-500 to-emerald-600',  shadow: 'shadow-teal-500/20',    text: 'text-teal-700',   border: 'hover:border-teal-300',     pill: 'bg-teal-50 text-teal-700'    },
  slate:  { gradient: 'from-slate-500 to-slate-700',   shadow: 'shadow-slate-400/20',   text: 'text-slate-600',  border: 'hover:border-slate-400',    pill: 'bg-slate-100 text-slate-600'  },
  indigo: { gradient: 'from-indigo-500 to-indigo-700', shadow: 'shadow-indigo-500/20',  text: 'text-indigo-700', border: 'hover:border-indigo-300',   pill: 'bg-indigo-50 text-indigo-700' },
  amber:  { gradient: 'from-amber-400 to-orange-500',  shadow: 'shadow-amber-400/20',   text: 'text-amber-700',  border: 'hover:border-amber-300',    pill: 'bg-amber-50 text-amber-700'   },
};

// ── Types ────────────────────────────────────────────────────────────────────

interface SubItem { label: string; href: string; }
interface Modulo  { href: string; titulo: string; descripcion: string; subItems?: SubItem[]; colorKey: ColorKey; icon: ReactNode; }

// ── Modules by role ───────────────────────────────────────────────────────────

function getModulosByRol(rolNombre: string): Modulo[] {
  const PLAN_ESTUDIOS: Modulo = {
    href: '/plan-estudios/carreras',
    titulo: 'Plan de Estudios',
    descripcion: 'Administración de planes académicos, asignaturas y programas curriculares.',
    subItems: [
      { label: 'Carreras',                href: '/plan-estudios/carreras'            },
      { label: 'Programas de Asignatura', href: '/plan-estudios/programas-asignatura' },
      { label: 'Información de Planes',   href: '/plan-estudios/informacion-planes'  },
    ],
    colorKey: 'violet',
    icon: <IcPlanEstudios />,
  };

  const GESTION_ACADEMICA: Modulo = {
    href: '/gestion-academica/facultades',
    titulo: 'Gestión Académica',
    descripcion: 'Administración de facultades y carreras de la institución.',
    subItems: [
      { label: 'Facultades', href: '/gestion-academica/facultades' },
      { label: 'Carreras',   href: '/gestion-academica/carreras'   },
    ],
    colorKey: 'teal',
    icon: <IcGestionAcademica />,
  };

  const DOCENTES_BASE: Modulo = {
    href: '/docentes',
    titulo: 'Docentes',
    descripcion: 'Gestión completa de la planta docente institucional.',
    subItems: [{ label: 'Listado de Docentes', href: '/docentes' }],
    colorKey: 'blue',
    icon: <IcDocentes />,
  };

  switch (rolNombre) {
    case 'DOCENTE':
      return [
        {
          href: '/docentes/mi-ficha',
          titulo: 'Mi Ficha Docente',
          descripcion: 'Accedé a tu información personal, formación académica y antecedentes profesionales.',
          colorKey: 'indigo',
          icon: <IcFicha />,
        },
        {
          href: '/docentes/aprobaciones',
          titulo: 'Bandeja de Aprobaciones',
          descripcion: 'Revisá y gestioná las solicitudes pendientes de aprobación.',
          colorKey: 'amber',
          icon: <IcAprobaciones />,
        },
        PLAN_ESTUDIOS,
      ];

    case 'ADMINISTRADOR_SISTEMA':
      return [
        DOCENTES_BASE,
        PLAN_ESTUDIOS,
        GESTION_ACADEMICA,
        {
          href: '/configuracion/usuarios',
          titulo: 'Configuración',
          descripcion: 'Gestión de usuarios, roles y parámetros generales del sistema.',
          subItems: [
            { label: 'Usuarios',             href: '/configuracion/usuarios'   },
            { label: 'Roles',                href: '/configuracion/roles'      },
            { label: 'Parámetros Generales', href: '/configuracion/parametros' },
          ],
          colorKey: 'slate',
          icon: <IcConfig />,
        },
      ];

    case 'ADMINISTRATIVO':
      return [
        {
          href: '/docentes',
          titulo: 'Gestión Docentes',
          descripcion: 'Administración de la planta docente: altas, listado y bandeja de aprobaciones.',
          subItems: [
            { label: 'Listado de Docentes',    href: '/docentes'              },
            { label: 'Nuevos Docentes',        href: '/docentes/nuevo'        },
            { label: 'Bandeja de Aprobaciones', href: '/docentes/aprobaciones' },
          ],
          colorKey: 'blue',
          icon: <IcDocentes />,
        },
        PLAN_ESTUDIOS,
        GESTION_ACADEMICA,
      ];

    default:
      // SECRETARIA_ACADEMICA, DIRECTOR_CARRERA, DECANO, RECTORADO
      return [DOCENTES_BASE, PLAN_ESTUDIOS, GESTION_ACADEMICA];
  }
}

// ── Module card ───────────────────────────────────────────────────────────────

function ModuloCard({ mod }: { mod: Modulo }) {
  const color = COLORES[mod.colorKey];
  return (
    <Link
      href={mod.href}
      className={`group relative rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 overflow-hidden flex flex-col ${color.border}`}
    >
      {/* Top gradient accent */}
      <div className={`h-[3px] bg-gradient-to-r ${color.gradient}`} />

      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Icon badge */}
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color.gradient} flex items-center justify-center shadow-md ${color.shadow} flex-shrink-0`}>
          {mod.icon}
        </div>

        {/* Title & description */}
        <div className="flex-1">
          <h3 className="text-sm font-bold text-slate-800 mb-1.5 leading-tight">{mod.titulo}</h3>
          <p className="text-xs text-slate-500 leading-relaxed">{mod.descripcion}</p>
        </div>

        {/* Sub-items pills */}
        {mod.subItems && mod.subItems.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {mod.subItems.map((sub) => (
              <span key={sub.href} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${color.pill}`}>
                {sub.label}
              </span>
            ))}
          </div>
        )}

        {/* CTA footer */}
        <div className={`pt-3 border-t border-slate-100 flex items-center justify-between ${color.text}`}>
          <span className="text-xs font-semibold">Acceder al módulo</span>
          <svg
            className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const { usuario } = useAuth();

  const rolNombre = usuario?.rol?.nombre ?? '';
  const modulos   = getModulosByRol(rolNombre);

  const hour   = new Date().getHours();
  const saludo = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <ProtectedRoute>
      <main className="p-6 sm:p-8 max-w-5xl mx-auto">

        {/* ── Hero header ─────────────────────────────────────────────────── */}
        <div className="relative mb-10 rounded-2xl overflow-hidden bg-gradient-to-br from-[#0d2244] via-[#0f4c81] to-[#1a5ea8] px-7 py-7">
          {/* Decorative circles */}
          <div className="absolute -right-8 -top-8 w-52 h-52 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute right-20 -bottom-12 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-white/5 pointer-events-none" />

          <div className="relative z-10">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-300/50 mb-1.5">
              UDEMM Global · Panel Principal
            </p>
            <h1 className="text-xl font-bold text-white tracking-tight">
              {saludo},{' '}
              <span className="text-blue-200">{usuario?.nombre ?? '—'}</span>
            </h1>
            <p className="mt-1 text-sm text-blue-200/50">
              Plataforma institucional de gestión académica.
            </p>
            {usuario && (
              <div className="mt-4">
                <span className="inline-flex items-center gap-2 bg-white/10 border border-white/15 text-white/90 text-xs font-medium px-3 py-1.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {rolNombre.replace(/_/g, ' ')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Section header ──────────────────────────────────────────────── */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Módulos disponibles</p>
            <p className="text-xs text-slate-500 mt-0.5">Seleccioná un módulo para comenzar.</p>
          </div>
          <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
            {modulos.length} módulo{modulos.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* ── Cards grid ──────────────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modulos.map((mod) => (
            <ModuloCard key={mod.href} mod={mod} />
          ))}
        </div>

      </main>
    </ProtectedRoute>
  );
}
