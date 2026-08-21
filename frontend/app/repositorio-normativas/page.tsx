'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

const ROLES_GESTION = ['SECRETARIA_ACADEMICA', 'DECANO', 'RECTORADO', 'ADMINISTRADOR_SISTEMA'];

interface CategoriaConConteo {
  id: string;
  nombre: string;
  cantidad: number;
}

// ── Iconos ───────────────────────────────────────────────────────────────────

const IcEstatuto = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1M4.22 4.22l.707.707m12.02 12.02.707.707M1 12h2m18 0h2M4.22 19.78l.707-.707M18.95 5.05l.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z" />
  </svg>
);

const IcNormativaInst = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
  </svg>
);

const IcConvenio = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899l4-4a4 4 0 115.656 5.656l-1.1 1.1" />
  </svg>
);

const IcAdmision = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

const IcBeca = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
  </svg>
);

const IcCarrera = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const IcDocDefault = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const IcUpload = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const IcAudit = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

const IcSearch = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

// ── Helpers ───────────────────────────────────────────────────────────────────

type Seccion = 'consultar' | 'auditoria';

const PALETA = [
  { gradient: 'from-[#0f4c81] to-[#1a5ea8]', light: 'bg-blue-50',   text: 'text-[#0f4c81]',   border: 'border-blue-100'   },
  { gradient: 'from-violet-600 to-purple-700', light: 'bg-violet-50', text: 'text-violet-700',   border: 'border-violet-100' },
  { gradient: 'from-teal-500 to-emerald-600',  light: 'bg-teal-50',   text: 'text-teal-700',     border: 'border-teal-100'   },
  { gradient: 'from-amber-500 to-orange-600',  light: 'bg-amber-50',  text: 'text-amber-700',    border: 'border-amber-100'  },
  { gradient: 'from-indigo-500 to-indigo-700', light: 'bg-indigo-50', text: 'text-indigo-700',   border: 'border-indigo-100' },
  { gradient: 'from-slate-500 to-slate-700',   light: 'bg-slate-100', text: 'text-slate-700',    border: 'border-slate-200'  },
];

const DESCRIPCIONES: Record<string, string> = {
  'ESTATUTO Y ORGANIGRAMA':    'Estatuto universitario, organigrama institucional y normativa fundacional.',
  'NORMATIVA INSTITUCIONAL':   'Resoluciones, ordenanzas y disposiciones de carácter general.',
  'CONVENIOS':                 'Acuerdos y convenios con instituciones nacionales e internacionales.',
  'REQUISITOS DE ADMISIÓN':    'Condiciones y requisitos para el ingreso a las distintas carreras.',
  'BECAS':                     'Programas de becas, ayudas económicas y beneficios estudiantiles.',
  'NORMATIVAS DE CARRERA':     'Reglamentos y normativas específicas de cada carrera académica.',
};

function getIcono(nombre: string): React.ReactNode {
  const n = nombre.toUpperCase();
  if (n.includes('ESTATUTO') || n.includes('ORGANIGRAMA')) return <IcEstatuto />;
  if (n.includes('CONVENIO'))                               return <IcConvenio />;
  if (n.includes('ADMIS'))                                  return <IcAdmision />;
  if (n.includes('BECA'))                                   return <IcBeca />;
  if (n.includes('CARRERA'))                                return <IcCarrera />;
  if (n.includes('INSTITUCIONAL') || n.includes('NORMATIVA')) return <IcNormativaInst />;
  return <IcDocDefault />;
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function RepositorioNormativasPage() {
  const { usuario, obtenerTokenActual } = useAuth();
  const router = useRouter();
  const [categorias, setCategorias] = useState<CategoriaConConteo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [seccion, setSeccion] = useState<Seccion>('consultar');

  const rol = usuario?.rol?.nombre ?? '';
  const puedeGestionar = ROLES_GESTION.includes(rol);

  useEffect(() => {
    const tok = obtenerTokenActual();
    fetch(`${API}/normativas/conteo-por-tipo`, {
      headers: { Authorization: `Bearer ${tok}` },
    })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => setCategorias(Array.isArray(d) ? d : []))
      .catch(() => setError('No se pudieron cargar las categorías.'))
      .finally(() => setCargando(false));
  }, [obtenerTokenActual]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* ── Encabezado ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            REPOSITORIO DE NORMATIVAS
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-medium tracking-wide">
            BIBLIOTECA DIGITAL DE NORMATIVAS INSTITUCIONALES
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0f4c81] to-[#1a5ea8] flex items-center justify-center shadow-sm">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
            </svg>
          </div>
        </div>
      </div>

      {/* ── Navegación de secciones ──────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-1 p-1.5">
          <button
            onClick={() => setSeccion('consultar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              seccion === 'consultar'
                ? 'bg-[#0f4c81] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <IcSearch />
            CONSULTAR NORMATIVAS
          </button>

          {puedeGestionar && (
            <button
              onClick={() => router.push('/repositorio-normativas/nueva')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all text-slate-600 hover:bg-slate-50 hover:text-slate-800"
            >
              <IcUpload />
              CARGAR NORMATIVA
            </button>
          )}

          {puedeGestionar && (
            <button
              onClick={() => setSeccion('auditoria')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                seccion === 'auditoria'
                  ? 'bg-[#0f4c81] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <IcAudit />
              LOG DE AUDITORÍA
            </button>
          )}
        </div>
      </div>

      {/* ── Contenido por sección ────────────────────────────────────────────── */}

      {seccion === 'consultar' && (
        <>
          {/* Sub-encabezado */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Seleccioná una categoría para consultar las normativas disponibles.
            </p>
            {!cargando && !error && (
              <span className="text-xs text-slate-400 font-medium">
                {categorias.length} {categorias.length === 1 ? 'categoría' : 'categorías'}
              </span>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          {/* Skeleton */}
          {cargando && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl bg-white border border-slate-200 shadow-sm p-5 animate-pulse">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-200 flex-shrink-0" />
                    <div className="flex-1 space-y-2 pt-1">
                      <div className="h-3 bg-slate-200 rounded w-3/4" />
                      <div className="h-2.5 bg-slate-100 rounded w-full" />
                    </div>
                  </div>
                  <div className="h-px bg-slate-100 mb-3" />
                  <div className="h-2.5 bg-slate-100 rounded w-1/3" />
                </div>
              ))}
            </div>
          )}

          {/* Grilla de categorías */}
          {!cargando && !error && categorias.length === 0 && (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-600">No hay categorías configuradas.</p>
              <p className="text-xs text-slate-400 mt-1">Configure los tipos de normativa en Tablas Maestras.</p>
            </div>
          )}

          {!cargando && !error && categorias.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categorias.map((cat, idx) => {
                const color = PALETA[idx % PALETA.length];
                const desc = DESCRIPCIONES[cat.nombre] ?? 'Normativas de esta categoría.';
                return (
                  <Link
                    key={cat.id}
                    href={`/repositorio-normativas/${cat.id}?nombre=${encodeURIComponent(cat.nombre)}`}
                    className="group relative rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-[#0f4c81]/20 transition-all duration-200 overflow-hidden flex flex-col"
                  >
                    {/* Barra de acento superior */}
                    <div className={`h-[3px] bg-gradient-to-r ${color.gradient}`} />

                    <div className="p-5 flex flex-col gap-3 flex-1">
                      {/* Icono + nombre */}
                      <div className="flex items-start gap-3">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color.gradient} flex items-center justify-center text-white flex-shrink-0 shadow-sm`}>
                          {getIcono(cat.nombre)}
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <h3 className={`text-sm font-bold ${color.text} group-hover:text-[#0f4c81] transition-colors leading-snug`}>
                            {cat.nombre}
                          </h3>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                            {desc}
                          </p>
                        </div>
                      </div>

                      {/* Separador */}
                      <div className="border-t border-slate-100" />

                      {/* Contador + CTA */}
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${color.light} ${color.text} ${color.border} border`}>
                          <span className="text-sm font-bold">{cat.cantidad}</span>
                          {cat.cantidad === 1 ? 'NORMATIVA' : 'NORMATIVAS'}
                        </span>
                        <span className={`text-xs font-semibold ${color.text} flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
                          Ver
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}

      {seccion === 'auditoria' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-slate-800">LOG DE AUDITORÍA</h3>
          <p className="mt-2 text-sm text-slate-500 max-w-sm mx-auto">
            El registro de auditoría de normativas será habilitado en una fase posterior del módulo.
          </p>
          <span className="mt-4 inline-block text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            En desarrollo
          </span>
        </div>
      )}
    </div>
  );
}
