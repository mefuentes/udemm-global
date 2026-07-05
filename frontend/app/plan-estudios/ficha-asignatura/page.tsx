'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getPermisosPlanEstudio, getPermisosPrograma, PermisosPrograma } from '@/lib/permisos-plan-estudios';

// ── Constantes ────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

const NAV_INTERNA = [
  { label: 'Malla Curricular', href: '/plan-estudios/malla-curricular' },
  { label: 'Ficha de Asignatura', href: '/plan-estudios/ficha-asignatura' },
  { label: 'Programas de Asignatura', href: '/plan-estudios/programas-asignatura' },
  { label: 'Datos del Plan', href: '/plan-estudios/datos-plan' },
];

const TABS_FICHA = [
  { id: 'general', label: 'Datos Generales' },
  { id: 'correlativas', label: 'Correlatividades' },
  { id: 'carga', label: 'Carga Horaria' },
  { id: 'programa', label: 'Programa' },
  { id: 'documentacion', label: 'Documentación' },
  { id: 'historial', label: 'Historial' },
] as const;

type TabId = typeof TABS_FICHA[number]['id'];

const TIPOS_ASIGNATURA = ['OBLIGATORIA', 'ELECTIVA', 'OPTATIVA'];
const REGIMENES = ['Cuatrimestral', 'Anual', 'Intensivo', 'Bimestral'];

const MODALIDADES_DICTADO = [
  { value: 'PRESENCIAL', label: 'Presencial' },
  { value: 'VIRTUAL',    label: 'Virtual' },
  { value: 'MIXTA',      label: 'Mixta / Semipresencial' },
];

function labelModalidad(val?: string | null) {
  return MODALIDADES_DICTADO.find(m => m.value === val)?.label ?? '—';
}

function colorModalidadBadge(val?: string | null) {
  if (val === 'VIRTUAL') return 'bg-sky-50 text-sky-700 border-sky-200';
  if (val === 'MIXTA')   return 'bg-teal-50 text-teal-700 border-teal-200';
  if (val === 'PRESENCIAL') return 'bg-green-50 text-green-700 border-green-200';
  return '';
}

const BLOQUES_CONOCIMIENTO = [
  { codigo: 'CB', label: 'CB - Ciencias Básicas' },
  { codigo: 'TB', label: 'TB - Tecnologías Básicas' },
  { codigo: 'TA', label: 'TA - Tecnologías Aplicadas' },
  { codigo: 'CX', label: 'CX - Cs. y Tecn. Complementarias' },
  { codigo: 'EL', label: 'EL - Electivas' },
];

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface MateriaResumen {
  id: string;
  codigo: string;
  nombre: string;
  anio?: number;
  cuatrimestre?: number;
  bloqueConocimiento?: string;
  estado: string;
}

interface CorrelativaItem {
  id: string;
  tipo: string;
  correlativa: MateriaResumen;
}

interface EsCorrelativaDeItem {
  id: string;
  tipo: string;
  materia: MateriaResumen;
}

interface HistorialProgramaItem {
  id: string;
  accion: string;
  seccion?: string;
  descripcion?: string;
  fecha: string;
  usuario: { id: string; nombre: string; apellido: string; correoElectronico: string };
}

interface ProgramaAsignatura {
  id: string;
  materiaId: string;
  equipoDocente?: string;
  elaboradoPor?: string;
  anioVigencia?: number;
  fundamentacion?: string;
  propositos?: string;
  objetivosGenerales?: string;
  objetivosEspecificos?: string;
  contenidosSinteticos?: string;
  contenidosTematicos?: string;
  bibliografiaBasica?: string;
  bibliografiaComplementaria?: string;
  recursosDidacticos?: string;
  metodologiaEnsenanza?: string;
  tiposFormacionPractica?: string;
  porcentajeTiempoFormacion?: string;
  actividadesPracticas?: string;
  cronograma?: string;
  modalidadEvaluacion?: string;
  requisitosAprobacion?: string;
  criteriosEvaluacion?: string;
  instrumentosEvaluacion?: string;
  condicionesAprobacion?: string;
  fechaVigenciaPrograma?: number;
  anioAprobacionRevision?: string;
  profesorACargo?: string;
  competenciasVinculadas?: string;
  fechaUltimaActualizacion?: string;
  observacionesGestion?: string;
  estadoPrograma: string;
  fechaAprobacion?: string;
  resolucionAprobacion?: string;
  observacionesGenerales?: string;
  vigenciaDesde?: number;
  vigenciaHasta?: number;
  estadoS1: string; estadoS2: string; estadoS3: string;
  estadoS4: string; estadoS5: string; estadoS6: string;
  historial: HistorialProgramaItem[];
  fechaCreacion: string;
  fechaActualizacion: string;
}

interface HistorialItem {
  id: string;
  accion: string;
  descripcion?: string;
  fecha: string;
  usuario: { id: string; nombre: string; apellido: string; correoElectronico: string };
}

interface HistorialUnificado {
  id: string;
  accion: string;
  seccion?: string;
  descripcion?: string;
  fecha: string;
  fuente: 'materia' | 'programa';
  usuario: { id: string; nombre: string; apellido: string; correoElectronico: string };
}

interface FichaCompleta {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  creditos: number;
  cargaHorariaSemanal?: number;
  cargaHorariaTotal?: number;
  anio?: number;
  cuatrimestre?: number;
  bloqueConocimiento?: string;
  modalidadDictado?: string;
  tipoAsignatura: string;
  regimenCursado?: string;
  estado: string;
  observaciones?: string;
  planEstudioId: string;
  planEstudio: {
    id: string;
    nombre: string;
    version?: string;
    anio?: number;
    carrera: {
      id: string;
      nombre: string;
      facultad: { nombre: string };
    };
  };
  correlativas: CorrelativaItem[];
  esCorrelativaDe: EsCorrelativaDeItem[];
  fechaCreacion: string;
  fechaActualizacion: string;
}

interface Carrera { id: string; nombre: string; _count?: { planes: number } }
interface Plan { id: string; nombre: string; anio?: number; version?: string; estado: string }

type FormEditar = {
  nombre: string; descripcion: string; bloqueConocimiento: string;
  modalidadDictado: string; tipoAsignatura: string; regimenCursado: string;
  anio: string; cuatrimestre: string; observaciones: string; estado: string;
  cargaHorariaSemanal: string; cargaHorariaTotal: string; creditos: string;
};

// ── Iconos ────────────────────────────────────────────────────────────────────

const IcClose = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const IcEdit = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);
const IcPlus = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);
const IcBack = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);
const IcSpinner = () => (
  <div className="w-5 h-5 rounded-full border-2 border-slate-200 border-t-[#0f4c81] animate-spin" />
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFecha(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function colorTipo(tipo: string) {
  if (tipo === 'ELECTIVA') return 'bg-amber-50 text-amber-700 border border-amber-200';
  if (tipo === 'OPTATIVA') return 'bg-purple-50 text-purple-700 border border-purple-200';
  return 'bg-slate-100 text-slate-600 border border-slate-200';
}

function colorEstado(estado: string) {
  if (estado === 'ACTIVO') return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  return 'bg-red-50 text-red-700 border border-red-200';
}

// ── Componente raíz (con Suspense) ────────────────────────────────────────────

export default function FichaAsignaturaPage() {
  return (
    <Suspense fallback={
      <div className="max-w-6xl flex items-center justify-center py-20">
        <IcSpinner />
      </div>
    }>
      <FichaContent />
    </Suspense>
  );
}

// ── Contenido principal ───────────────────────────────────────────────────────

function FichaContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const materiaId = searchParams.get('id');

  const { usuario, token, obtenerTokenActual, logout } = useAuth();
  const permisos = getPermisosPlanEstudio(usuario?.rol?.nombre ?? '');
  const permisosPrograma = getPermisosPrograma(usuario?.rol?.nombre ?? '');

  // ── API helper ─────────────────────────────────────────────────────────
  async function apiFetch(url: string, opts?: RequestInit) {
    const tok = obtenerTokenActual();
    const res = await fetch(url, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tok}`,
        ...(opts?.headers ?? {})
      }
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) logout();
      throw new Error(data?.message ?? 'Error en la solicitud');
    }
    return data;
  }

  return (
    <div className="max-w-6xl">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-5">
        <a href="/" className="hover:text-slate-600 transition-colors">Inicio</a>
        <span>/</span>
        <a href="/plan-estudios" className="hover:text-slate-600 transition-colors">Plan de Estudios</a>
        <span>/</span>
        {materiaId
          ? <><a href="/plan-estudios/ficha-asignatura" className="hover:text-slate-600 transition-colors">Ficha de Asignatura</a><span>/</span><span className="text-slate-600 font-medium">Detalle</span></>
          : <span className="text-slate-600 font-medium">Ficha de Asignatura</span>
        }
      </nav>

      {/* Encabezado */}
      {!materiaId && (
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Plan de Estudios</p>
          <h1 className="text-xl font-bold text-slate-800">Ficha de Asignatura</h1>
          <p className="mt-1 text-sm text-slate-500">
            Seleccioná una asignatura para ver su ficha completa.
          </p>
        </div>
      )}

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

      {/* Vista de ficha o selector */}
      {materiaId
        ? <FichaView materiaId={materiaId} permisos={permisos} permisosPrograma={permisosPrograma} apiFetch={apiFetch} token={token} router={router} />
        : <SelectorView apiFetch={apiFetch} token={token} router={router} />
      }
    </div>
  );
}

// ── Vista: Selector (sin materiaId) ──────────────────────────────────────────

function SelectorView({ apiFetch, token, router }: {
  apiFetch: (url: string, opts?: RequestInit) => Promise<any>;
  token: string | null;
  router: ReturnType<typeof useRouter>;
}) {
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [materias, setMaterias] = useState<MateriaResumen[]>([]);
  const [carreraId, setCarreraId] = useState('');
  const [planId, setPlanId] = useState('');
  const [buscar, setBuscar] = useState('');
  const [cargando, setCargando] = useState(false);
  const [aniosColapsados, setAniosColapsados] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!token) return;
    apiFetch(`${API_URL}/plan-estudios/carreras`).then(setCarreras).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!carreraId) { setPlanes([]); setPlanId(''); return; }
    apiFetch(`${API_URL}/plan-estudios?carreraId=${carreraId}`).then(setPlanes).catch(() => {});
  }, [carreraId]);

  useEffect(() => {
    if (!planId) { setMaterias([]); return; }
    setCargando(true);
    apiFetch(`${API_URL}/materias?planEstudioId=${planId}`)
      .then(setMaterias).catch(() => {}).finally(() => setCargando(false));
    setAniosColapsados(new Set());
  }, [planId]);

  function toggleAnioSel(anio: string) {
    setAniosColapsados(prev => {
      const next = new Set(prev);
      if (next.has(anio)) next.delete(anio); else next.add(anio);
      return next;
    });
  }

  const filtradas = useMemo(() => {
    const t = buscar.toLowerCase().trim();
    if (!t) return materias;
    return materias.filter(m =>
      m.nombre.toLowerCase().includes(t) || m.codigo.toLowerCase().includes(t)
    );
  }, [materias, buscar]);

  const materiasAgrupadasPorAnio = useMemo(() => {
    const grouped: Record<string, MateriaResumen[]> = {};
    for (const m of filtradas) {
      const key = m.anio?.toString() ?? '0';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(m);
    }
    return grouped;
  }, [filtradas]);

  const aniosDelSelector = Object.keys(materiasAgrupadasPorAnio).sort((a, b) => {
    if (a === '0') return 1;
    if (b === '0') return -1;
    return parseInt(a) - parseInt(b);
  });

  return (
    <div className="space-y-4">
      {/* Selector */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Carrera</label>
            <select
              value={carreraId}
              onChange={e => setCarreraId(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
            >
              <option value="">-- Seleccionar carrera --</option>
              {carreras.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Plan de Estudio</label>
            <select
              value={planId}
              onChange={e => setPlanId(e.target.value)}
              disabled={!carreraId}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81] disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              <option value="">-- Seleccionar plan --</option>
              {planes.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nombre}{p.anio ? ` (${p.anio})` : ''}{p.version ? ` v${p.version}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Listado de asignaturas */}
      {planId && (
        <>
          {cargando ? (
            <div className="flex items-center gap-3 p-6"><IcSpinner /><span className="text-sm text-slate-500">Cargando asignaturas...</span></div>
          ) : materias.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
              Este plan no tiene asignaturas registradas.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <input
                  value={buscar}
                  onChange={e => setBuscar(e.target.value)}
                  placeholder="Buscar asignatura..."
                  className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
                />
                <span className="text-xs text-slate-400">{filtradas.length} asignatura{filtradas.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="space-y-2">
                {aniosDelSelector.map(anio => {
                  const isExpanded = !aniosColapsados.has(anio);
                  const mats = materiasAgrupadasPorAnio[anio];
                  return (
                    <div key={anio} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <button
                        onClick={() => toggleAnioSel(anio)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50/70 transition-colors text-left"
                      >
                        <div className="w-7 h-7 rounded-lg bg-[#0f4c81] flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-white">{anio === '0' ? '?' : anio}</span>
                        </div>
                        <span className="text-sm font-bold text-slate-700">
                          {anio === '0' ? 'Sin año asignado' : `${anio}° Año`}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {mats.length} asignatura{mats.length !== 1 ? 's' : ''}
                        </span>
                        <div className="flex-1" />
                        <svg
                          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isExpanded ? '' : 'rotate-180'}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                        </svg>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-slate-100 overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-slate-50/80 border-b border-slate-100">
                                <th className="text-left px-4 py-2 font-semibold text-slate-500 uppercase tracking-wide w-28">Código</th>
                                <th className="text-left px-4 py-2 font-semibold text-slate-500 uppercase tracking-wide">Asignatura</th>
                                <th className="text-left px-4 py-2 font-semibold text-slate-500 uppercase tracking-wide w-24">Duración</th>
                                <th className="text-left px-4 py-2 font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Bloque</th>
                                <th className="px-4 py-2 w-20"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {mats.map(m => (
                                <tr
                                  key={m.id}
                                  onClick={() => router.push(`/plan-estudios/ficha-asignatura?id=${m.id}`)}
                                  className="hover:bg-[#0f4c81]/3 cursor-pointer transition-colors group"
                                >
                                  <td className="px-4 py-2.5">
                                    <span className="text-[11px] font-bold font-mono bg-[#0f4c81]/8 text-[#0f4c81] px-2 py-0.5 rounded border border-[#0f4c81]/10 whitespace-nowrap">
                                      {m.codigo}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <p className="text-xs font-semibold text-slate-800 group-hover:text-[#0f4c81] transition-colors leading-tight">
                                      {m.nombre}
                                    </p>
                                  </td>
                                  <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                                    {m.cuatrimestre === 0
                                      ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200">Anual</span>
                                      : m.cuatrimestre ? `${m.cuatrimestre}°` : '—'}
                                  </td>
                                  <td className="px-4 py-2.5 text-slate-500 hidden md:table-cell">
                                    {m.bloqueConocimiento ?? '—'}
                                  </td>
                                  <td className="px-4 py-2.5 text-right">
                                    <span className="text-[11px] text-[#0f4c81] font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                      Ver ficha →
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {!planId && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
          <div className="w-10 h-10 rounded-xl bg-[#1a5ea8]/8 flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-[#1a5ea8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>

          {carreras.length === 0 ? (
            <>
              <p className="text-sm font-medium text-slate-700 mb-1">No hay datos cargados en Plan de Estudios</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                La base de datos no tiene carreras ni planes aún. Para comenzar, ejecutá el seed de datos desde la carpeta <span className="font-mono">backend/</span>:
              </p>
              <code className="inline-block bg-slate-100 text-slate-700 text-xs px-4 py-2 rounded-lg font-mono">
                npx prisma db seed
              </code>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-600 mb-1">Seleccioná una asignatura</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Elegí una carrera y un plan para ver el listado de asignaturas, o accedé directamente desde la{' '}
                <Link href="/plan-estudios/malla-curricular" className="text-[#0f4c81] underline underline-offset-2">Malla Curricular</Link>.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Vista: Ficha completa ─────────────────────────────────────────────────────

function FichaView({ materiaId, permisos, permisosPrograma, apiFetch, token, router }: {
  materiaId: string;
  permisos: ReturnType<typeof getPermisosPlanEstudio>;
  permisosPrograma: PermisosPrograma;
  apiFetch: (url: string, opts?: RequestInit) => Promise<any>;
  token: string | null;
  router: ReturnType<typeof useRouter>;
}) {
  const [ficha, setFicha] = useState<FichaCompleta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('general');
  const [modoEditar, setModoEditar] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Edit form
  const [form, setForm] = useState<FormEditar>({
    nombre: '', descripcion: '', bloqueConocimiento: '', modalidadDictado: '',
    tipoAsignatura: 'OBLIGATORIA', regimenCursado: '', anio: '', cuatrimestre: '',
    observaciones: '', estado: 'ACTIVO', cargaHorariaSemanal: '', cargaHorariaTotal: '', creditos: ''
  });

  // Correlativas management
  const [materiasDelPlan, setMateriasDelPlan] = useState<MateriaResumen[]>([]);
  const [corrAgregar, setCorrAgregar] = useState({ correlativaId: '', tipo: 'CURSADO' });
  const [agregandoCorr, setAgregandoCorr] = useState(false);
  const [mostrarFormCorr, setMostrarFormCorr] = useState(false);

  // Historial
  const [historial, setHistorial] = useState<HistorialUnificado[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [paginaHistorial, setPaginaHistorial] = useState(1);
  const HISTORIAL_POR_PAGINA = 5;

  useEffect(() => {
    if (!token || !materiaId) return;
    fetchFicha();
  }, [token, materiaId]);

  useEffect(() => {
    if (tab !== 'historial' || !token || !materiaId) return;
    setCargandoHistorial(true);
    Promise.all([
      apiFetch(`${API_URL}/materias/${materiaId}/historial`),
      apiFetch(`${API_URL}/programas/materia/${materiaId}`),
    ])
      .then(([materiaH, progData]) => {
        const fromMateria: HistorialUnificado[] = (materiaH as HistorialItem[]).map(h => ({ ...h, fuente: 'materia' as const }));
        const fromPrograma: HistorialUnificado[] = ((progData?.historial ?? []) as HistorialProgramaItem[]).map(h => ({ ...h, fuente: 'programa' as const }));
        setHistorial(
          [...fromMateria, ...fromPrograma].sort(
            (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
          )
        );
        setPaginaHistorial(1);
      })
      .catch(() => setHistorial([]))
      .finally(() => setCargandoHistorial(false));
  }, [tab, token, materiaId]);

  async function fetchFicha() {
    setCargando(true);
    setError(null);
    try {
      const data = await apiFetch(`${API_URL}/materias/${materiaId}/ficha`);
      setFicha(data);
      setForm({
        nombre: data.nombre ?? '',
        descripcion: data.descripcion ?? '',
        bloqueConocimiento: data.bloqueConocimiento ?? '',
        modalidadDictado: data.modalidadDictado ?? '',
        tipoAsignatura: data.tipoAsignatura ?? 'OBLIGATORIA',
        regimenCursado: data.regimenCursado ?? '',
        anio: data.anio?.toString() ?? '',
        cuatrimestre: data.cuatrimestre?.toString() ?? '',
        observaciones: data.observaciones ?? '',
        estado: data.estado ?? 'ACTIVO',
        cargaHorariaSemanal: data.cargaHorariaSemanal?.toString() ?? '',
        cargaHorariaTotal: data.cargaHorariaTotal?.toString() ?? '',
        creditos: data.creditos?.toString() ?? ''
      });
      // Load plan materias for correlativas picker
      const mats = await apiFetch(`${API_URL}/materias?planEstudioId=${data.planEstudioId}`);
      setMateriasDelPlan(mats ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  async function guardarCambios() {
    setGuardando(true);
    try {
      const payload: Record<string, unknown> = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion || undefined,
        bloqueConocimiento: form.bloqueConocimiento || undefined,
        modalidadDictado: form.modalidadDictado || undefined,
        tipoAsignatura: form.tipoAsignatura,
        regimenCursado: form.regimenCursado || undefined,
        observaciones: form.observaciones || undefined,
        estado: form.estado
      };
      if (form.anio) payload.anio = parseInt(form.anio);
      if (form.cuatrimestre !== '') payload.cuatrimestre = parseInt(form.cuatrimestre);
      if (form.cargaHorariaSemanal) payload.cargaHorariaSemanal = parseInt(form.cargaHorariaSemanal);
      if (form.cargaHorariaTotal) payload.cargaHorariaTotal = parseInt(form.cargaHorariaTotal);
      if (form.creditos) payload.creditos = parseInt(form.creditos);

      await apiFetch(`${API_URL}/materias/${materiaId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      setModoEditar(false);
      await fetchFicha();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  async function agregarCorrelativa() {
    if (!corrAgregar.correlativaId) return;
    setAgregandoCorr(true);
    try {
      await apiFetch(`${API_URL}/materias/${materiaId}/correlativas`, {
        method: 'POST',
        body: JSON.stringify({ correlativaId: corrAgregar.correlativaId, tipo: corrAgregar.tipo })
      });
      setCorrAgregar({ correlativaId: '', tipo: 'CURSADO' });
      setMostrarFormCorr(false);
      await fetchFicha();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setAgregandoCorr(false);
    }
  }

  async function quitarCorrelativa(correlativaId: string) {
    if (!window.confirm('¿Quitar esta correlativa?')) return;
    try {
      await apiFetch(`${API_URL}/materias/${materiaId}/correlativas/${correlativaId}`, { method: 'DELETE' });
      await fetchFicha();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  function cancelarEdicion() {
    if (!ficha) return;
    setForm({
      nombre: ficha.nombre ?? '',
      descripcion: ficha.descripcion ?? '',
      bloqueConocimiento: ficha.bloqueConocimiento ?? '',
      modalidadDictado: ficha.modalidadDictado ?? '',
      tipoAsignatura: ficha.tipoAsignatura ?? 'OBLIGATORIA',
      regimenCursado: ficha.regimenCursado ?? '',
      anio: ficha.anio?.toString() ?? '',
      cuatrimestre: ficha.cuatrimestre?.toString() ?? '',
      observaciones: ficha.observaciones ?? '',
      estado: ficha.estado ?? 'ACTIVO',
      cargaHorariaSemanal: ficha.cargaHorariaSemanal?.toString() ?? '',
      cargaHorariaTotal: ficha.cargaHorariaTotal?.toString() ?? '',
      creditos: ficha.creditos?.toString() ?? ''
    });
    setModoEditar(false);
  }

  // ── Datos derivados ─────────────────────────────────────────────────────

  const correlativasCursado = ficha?.correlativas.filter(c => c.tipo === 'CURSADO') ?? [];

  const materiasPicker = useMemo(
    () => materiasDelPlan.filter(m =>
      m.id !== materiaId &&
      !ficha?.correlativas.some(c => c.correlativa.id === m.id)
    ),
    [materiasDelPlan, materiaId, ficha]
  );

  // ── Estados de carga ────────────────────────────────────────────────────

  if (cargando) {
    return (
      <div className="flex items-center justify-center gap-3 py-16">
        <IcSpinner />
        <span className="text-sm text-slate-500">Cargando ficha...</span>
      </div>
    );
  }

  if (error || !ficha) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <p className="text-sm font-medium text-red-600 mb-2">{error ?? 'Asignatura no encontrada'}</p>
        <button
          onClick={() => router.push('/plan-estudios/ficha-asignatura')}
          className="text-xs text-[#0f4c81] underline"
        >
          Volver al selector
        </button>
      </div>
    );
  }

  return (
    <div>

      {/* Volver */}
      <button
        onClick={() => router.push('/plan-estudios/ficha-asignatura')}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 mb-4 transition-colors"
      >
        <IcBack />
        Volver al selector
      </button>

      {/* Header de la ficha */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs font-bold font-mono bg-[#0f4c81]/10 text-[#0f4c81] px-2.5 py-1 rounded border border-[#0f4c81]/10">
                {ficha.codigo}
              </span>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${colorTipo(ficha.tipoAsignatura)}`}>
                {ficha.tipoAsignatura}
              </span>
              {ficha.modalidadDictado && (
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${colorModalidadBadge(ficha.modalidadDictado)}`}>
                  {labelModalidad(ficha.modalidadDictado)}
                </span>
              )}
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${colorEstado(ficha.estado)}`}>
                {ficha.estado}
              </span>
            </div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight mb-1">{ficha.nombre}</h1>
            <p className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
              <span><strong className="text-slate-600">Plan:</strong> {ficha.planEstudio.nombre}{ficha.planEstudio.version ? ` v${ficha.planEstudio.version}` : ''}</span>
              <span><strong className="text-slate-600">Carrera:</strong> {ficha.planEstudio.carrera.nombre}</span>
              {ficha.anio && <span><strong className="text-slate-600">Año:</strong> {ficha.anio}°</span>}
              {ficha.cuatrimestre != null && (
                <span>
                  <strong className="text-slate-600">Duración:</strong>{' '}
                  {ficha.cuatrimestre === 0 ? 'Anual' : `${ficha.cuatrimestre}° Cuatrimestre`}
                </span>
              )}
            </p>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {permisos.editar && !modoEditar && (
              <button
                onClick={() => setModoEditar(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-[#0f4c81] text-[#0f4c81] rounded-lg hover:bg-[#0f4c81]/5 transition-colors"
              >
                <IcEdit />
                Editar
              </button>
            )}
            {modoEditar && (
              <>
                <button
                  onClick={cancelarEdicion}
                  className="px-3 py-1.5 text-xs font-semibold border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={guardarCambios}
                  disabled={guardando}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0f4c81] text-white rounded-lg hover:bg-[#0d3e6b] transition-colors disabled:opacity-60"
                >
                  {guardando ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs de secciones */}
      <div className="flex gap-0.5 mb-4 border-b border-slate-200 overflow-x-auto">
        {TABS_FICHA.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-[#0f4c81] text-[#0f4c81]'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {t.label}
            {t.id === 'correlativas' && ficha.correlativas.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-[#0f4c81] text-white rounded-full">
                {ficha.correlativas.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Contenido de sección */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">

        {/* ── TAB: Datos Generales ─────────────────────────────────────── */}
        {tab === 'general' && (
          <div className="divide-y divide-slate-50">
            <CampoFicha label="Código" valor={ficha.codigo} monospace />
            <CampoEditable label="Nombre" valor={ficha.nombre} editar={modoEditar}
              input={<input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                className={inputCls} />} />
            <CampoFicha label="Carrera" valor={ficha.planEstudio.carrera.nombre} />
            <CampoFicha label="Facultad" valor={ficha.planEstudio.carrera.facultad.nombre} />
            <CampoFicha label="Plan de Estudio"
              valor={`${ficha.planEstudio.nombre}${ficha.planEstudio.version ? ` (v${ficha.planEstudio.version})` : ''}`} />
            <CampoEditable label="Bloque de Conocimiento" valor={ficha.bloqueConocimiento ?? '—'} editar={modoEditar}
              input={
                <select value={form.bloqueConocimiento} onChange={e => setForm(f => ({ ...f, bloqueConocimiento: e.target.value }))} className={inputCls}>
                  <option value="">-- Sin asignar --</option>
                  {BLOQUES_CONOCIMIENTO.map(b => (
                    <option key={b.codigo} value={b.label}>{b.label}</option>
                  ))}
                </select>
              } />
            <div className="flex">
              <div className="flex-1">
                <CampoEditable label="Año" valor={ficha.anio ? `${ficha.anio}°` : '—'} editar={modoEditar}
                  input={<select value={form.anio} onChange={e => setForm(f => ({ ...f, anio: e.target.value }))} className={inputCls}>
                    <option value="">—</option>
                    {[1,2,3,4,5].map(a => <option key={a} value={a}>{a}°</option>)}
                  </select>} />
              </div>
              <div className="flex-1">
                <CampoEditable
                  label="Duración"
                  valor={ficha.cuatrimestre === 0 ? 'Anual' : ficha.cuatrimestre ? `${ficha.cuatrimestre}° Cuatrimestre` : '—'}
                  editar={modoEditar}
                  input={<select value={form.cuatrimestre} onChange={e => setForm(f => ({ ...f, cuatrimestre: e.target.value }))} className={inputCls}>
                    <option value="">—</option>
                    <option value="1">1° Cuatrimestre</option>
                    <option value="2">2° Cuatrimestre</option>
                    <option value="0">Anual</option>
                  </select>} />
              </div>
            </div>
            <CampoEditable label="Tipo de Asignatura" valor={ficha.tipoAsignatura} editar={modoEditar}
              input={<select value={form.tipoAsignatura} onChange={e => setForm(f => ({ ...f, tipoAsignatura: e.target.value }))} className={inputCls}>
                {TIPOS_ASIGNATURA.map(t => <option key={t} value={t}>{t}</option>)}
              </select>} />
            <CampoEditable label="Modalidad de Dictado"
              valor={ficha.modalidadDictado ? labelModalidad(ficha.modalidadDictado) : '—'}
              editar={modoEditar}
              input={<select value={form.modalidadDictado} onChange={e => setForm(f => ({ ...f, modalidadDictado: e.target.value }))} className={inputCls}>
                <option value="">— Sin asignar —</option>
                {MODALIDADES_DICTADO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>} />
            <CampoEditable label="Régimen de Cursado" valor={ficha.regimenCursado ?? '—'} editar={modoEditar}
              input={<select value={form.regimenCursado} onChange={e => setForm(f => ({ ...f, regimenCursado: e.target.value }))} className={inputCls}>
                <option value="">—</option>
                {REGIMENES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>} />
            <CampoEditable label="Estado" valor={ficha.estado} editar={modoEditar}
              input={<select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} className={inputCls}>
                <option value="ACTIVO">ACTIVO</option>
                <option value="INACTIVO">INACTIVO</option>
              </select>} />
            <CampoEditable label="Observaciones" valor={ficha.observaciones ?? '—'} editar={modoEditar}
              input={<textarea value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                rows={2} className={`${inputCls} resize-none`} placeholder="Notas adicionales..." />} />
          </div>
        )}

        {/* ── TAB: Correlatividades ────────────────────────────────────── */}
        {tab === 'correlativas' && (
          <div className="p-5 space-y-5">

            {/* Para cursar */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Para cursar</h3>
                <span className="text-[11px] text-slate-400">Requeridas para inscribirse</span>
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-[11px] text-slate-400">{correlativasCursado.length}</span>
              </div>
              {correlativasCursado.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Sin correlativas de cursado</p>
              ) : (
                <div className="space-y-2">
                  {correlativasCursado.map(c => (
                    <CorrelativaRow
                      key={c.id}
                      item={c.correlativa}
                      tipo="CURSADO"
                      permisos={permisos}
                      onQuitar={() => quitarCorrelativa(c.correlativa.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Es correlativa de */}
            {ficha.esCorrelativaDe.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Es requerida por</h3>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>
                <div className="space-y-2">
                  {ficha.esCorrelativaDe.map(c => (
                    <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-[10px] font-bold font-mono text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded">{c.materia.codigo}</span>
                      <span className="text-xs text-slate-700 flex-1">{c.materia.nombre}</span>
                      {c.materia.anio && <span className="text-[11px] text-slate-400">{c.materia.anio}°A</span>}
                      <span className="text-[10px] text-slate-400 font-medium">{c.tipo}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Agregar correlativa */}
            {permisos.editar && (
              <div className="pt-4 border-t border-slate-100">
                {!mostrarFormCorr ? (
                  <button
                    onClick={() => setMostrarFormCorr(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#0f4c81] hover:bg-[#0f4c81]/5 px-3 py-2 rounded-lg transition-colors"
                  >
                    <IcPlus />
                    Agregar correlativa
                  </button>
                ) : (
                  <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                    <p className="text-xs font-semibold text-slate-700">Agregar correlativa</p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <select
                        value={corrAgregar.correlativaId}
                        onChange={e => setCorrAgregar(c => ({ ...c, correlativaId: e.target.value }))}
                        className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
                      >
                        <option value="">-- Seleccionar asignatura --</option>
                        {materiasPicker.map(m => (
                          <option key={m.id} value={m.id}>
                            [{m.codigo}] {m.nombre}{m.anio ? ` · ${m.anio}°A` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={agregarCorrelativa}
                        disabled={!corrAgregar.correlativaId || agregandoCorr}
                        className="px-3 py-1.5 text-xs font-semibold bg-[#0f4c81] text-white rounded-lg hover:bg-[#0d3e6b] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {agregandoCorr ? 'Agregando...' : 'Agregar'}
                      </button>
                      <button
                        onClick={() => { setMostrarFormCorr(false); setCorrAgregar({ correlativaId: '', tipo: 'CURSADO' }); }}
                        className="px-3 py-1.5 text-xs font-semibold border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Carga Horaria ───────────────────────────────────────── */}
        {tab === 'carga' && (
          <div className="divide-y divide-slate-50">
            <CampoEditable label="Régimen de Cursado" valor={ficha.regimenCursado ?? '—'} editar={modoEditar}
              input={<select value={form.regimenCursado} onChange={e => setForm(f => ({ ...f, regimenCursado: e.target.value }))} className={inputCls}>
                <option value="">—</option>
                {REGIMENES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>} />
            <CampoEditable label="Carga Horaria Semanal" valor={ficha.cargaHorariaSemanal ? `${ficha.cargaHorariaSemanal} horas` : '—'} editar={modoEditar}
              input={<input type="number" min="0" value={form.cargaHorariaSemanal} onChange={e => setForm(f => ({ ...f, cargaHorariaSemanal: e.target.value }))}
                className={inputCls} placeholder="0" />} />
            <CampoEditable label="Carga Horaria Total" valor={ficha.cargaHorariaTotal ? `${ficha.cargaHorariaTotal} horas` : '—'} editar={modoEditar}
              input={<input type="number" min="0" value={form.cargaHorariaTotal} onChange={e => setForm(f => ({ ...f, cargaHorariaTotal: e.target.value }))}
                className={inputCls} placeholder="0" />} />
            <CampoEditable label="Créditos" valor={ficha.creditos > 0 ? `${ficha.creditos} créditos` : '—'} editar={modoEditar}
              input={<input type="number" min="0" value={form.creditos} onChange={e => setForm(f => ({ ...f, creditos: e.target.value }))}
                className={inputCls} placeholder="0" />} />

            {/* Resumen visual */}
            {!modoEditar && (
              <div className="px-5 py-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Hs/Semana', valor: ficha.cargaHorariaSemanal ?? 0, unidad: 'h' },
                    { label: 'Hs Totales', valor: ficha.cargaHorariaTotal ?? 0, unidad: 'h' },
                    { label: 'Créditos', valor: ficha.creditos ?? 0, unidad: 'cr' },
                  ].map(item => (
                    <div key={item.label} className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
                      <p className="text-2xl font-bold text-[#0f4c81]">
                        {item.valor}<span className="text-sm font-normal text-slate-500 ml-1">{item.unidad}</span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Programa ────────────────────────────────────────────── */}
        {tab === 'programa' && (
          <ProgramaView
            materiaId={ficha.id}
            ficha={ficha}
            permisosPrograma={permisosPrograma}
            apiFetch={apiFetch}
            onRefreshFicha={fetchFicha}
          />
        )}

        {/* ── TAB: Documentación ──────────────────────────────────────── */}
        {tab === 'documentacion' && (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-600 mb-1">Sin documentos adjuntos</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              La carga documental (resoluciones, programas en PDF, etc.) estará disponible en una próxima versión.
            </p>
            <div className="mt-4 inline-flex px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200">
              <span className="text-[11px] font-medium text-amber-700">En desarrollo · Próxima versión</span>
            </div>
          </div>
        )}

        {/* ── TAB: Historial ───────────────────────────────────────────── */}
        {tab === 'historial' && (() => {
          const totalPaginas = Math.max(1, Math.ceil(historial.length / HISTORIAL_POR_PAGINA));
          const paginaActual = Math.min(paginaHistorial, totalPaginas);
          const registrosPagina = historial.slice(
            (paginaActual - 1) * HISTORIAL_POR_PAGINA,
            paginaActual * HISTORIAL_POR_PAGINA
          );
          const inicio = historial.length === 0 ? 0 : (paginaActual - 1) * HISTORIAL_POR_PAGINA + 1;
          const fin = Math.min(paginaActual * HISTORIAL_POR_PAGINA, historial.length);
          return (
            <div>
              {cargandoHistorial ? (
                <div className="flex justify-center py-12">
                  <IcSpinner />
                </div>
              ) : historial.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-xs text-slate-400 italic">Sin movimientos registrados para esta asignatura.</p>
                </div>
              ) : (
                <>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-100">
                        <th className="text-left px-5 py-3 font-semibold text-slate-500 uppercase tracking-wide w-44">Fecha y hora</th>
                        <th className="text-left px-5 py-3 font-semibold text-slate-500 uppercase tracking-wide w-44">Acción</th>
                        <th className="text-left px-5 py-3 font-semibold text-slate-500 uppercase tracking-wide">Descripción</th>
                        <th className="text-left px-5 py-3 font-semibold text-slate-500 uppercase tracking-wide w-44">Usuario</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {registrosPagina.map(h => (
                        <tr key={`${h.fuente}-${h.id}`} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                            {formatFecha(h.fecha)}
                          </td>
                          <td className="px-5 py-3">
                            <AccionBadge accion={h.accion} />
                            {h.fuente === 'programa' && (
                              <span className="ml-1.5 inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-indigo-50 text-indigo-600 border-indigo-200 whitespace-nowrap">
                                PROGRAMA
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-slate-600 leading-relaxed">
                            {h.descripcion ?? '—'}
                            {h.seccion && (
                              <p className="text-[10px] text-slate-400 mt-0.5">{h.seccion}</p>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <p className="text-slate-700 font-medium">{h.usuario.nombre} {h.usuario.apellido}</p>
                            <p className="text-[10px] text-slate-400">{h.usuario.correoElectronico}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Paginación */}
                  <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/60">
                    <span className="text-[11px] text-slate-400">
                      Mostrando {inicio}–{fin} de {historial.length} registro{historial.length !== 1 ? 's' : ''}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPaginaHistorial(p => Math.max(1, p - 1))}
                        disabled={paginaActual === 1}
                        className="px-2.5 py-1 rounded text-[11px] font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        ← Anterior
                      </button>
                      {Array.from({ length: totalPaginas }, (_, i) => i + 1).map(p => (
                        <button
                          key={p}
                          onClick={() => setPaginaHistorial(p)}
                          className={`w-7 h-7 rounded text-[11px] font-medium border transition-colors ${
                            p === paginaActual
                              ? 'bg-[#0f4c81] text-white border-[#0f4c81]'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                      <button
                        onClick={() => setPaginaHistorial(p => Math.min(totalPaginas, p + 1))}
                        disabled={paginaActual === totalPaginas}
                        className="px-2.5 py-1 rounded text-[11px] font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Siguiente →
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ── Estilos compartidos ───────────────────────────────────────────────────────

const inputCls = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]';

// ── Sub-componentes ───────────────────────────────────────────────────────────

function CampoFicha({ label, valor, monospace }: { label: string; valor: string; monospace?: boolean }) {
  return (
    <div className="flex items-start px-5 py-3.5 gap-4">
      <span className="w-44 text-xs font-medium text-slate-500 flex-shrink-0 pt-0.5">{label}</span>
      <span className={`text-sm text-slate-800 ${monospace ? 'font-mono' : ''}`}>{valor || '—'}</span>
    </div>
  );
}

function CampoEditable({ label, valor, editar, input }: {
  label: React.ReactNode;
  valor: string;
  editar: boolean;
  input: React.ReactNode;
}) {
  return (
    <div className="flex items-start px-5 py-3 gap-4">
      <span className="w-44 text-xs font-medium text-slate-500 flex-shrink-0 pt-2">{label}</span>
      {editar ? <div className="flex-1 min-w-0">{input}</div> : <span className="text-sm text-slate-800 pt-0.5">{valor || '—'}</span>}
    </div>
  );
}

function CorrelativaRow({ item, tipo, permisos, onQuitar }: {
  item: MateriaResumen;
  tipo: string;
  permisos: ReturnType<typeof getPermisosPlanEstudio>;
  onQuitar: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-100">
      <span className="text-[10px] font-bold font-mono text-[#0f4c81] bg-[#0f4c81]/10 px-1.5 py-0.5 rounded border border-[#0f4c81]/10">
        {item.codigo}
      </span>
      <span className="text-xs text-slate-700 flex-1">{item.nombre}</span>
      {item.anio && (
        <span className="text-[11px] text-slate-400">
          {item.anio}°A{item.cuatrimestre ? ` · ${item.cuatrimestre}°C` : ''}
        </span>
      )}
      {permisos.editar && (
        <button
          onClick={onQuitar}
          className="text-slate-300 hover:text-red-500 transition-colors p-0.5 rounded"
          title="Quitar correlativa"
        >
          <IcClose />
        </button>
      )}
    </div>
  );
}

const ACCION_CONFIG: Record<string, { label: string; cls: string }> = {
  CREACION:              { label: 'Creación',           cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  ACTUALIZACION:         { label: 'Actualización',      cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  APROBACION:            { label: 'Aprobación',         cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  BAJA:                  { label: 'Baja',               cls: 'bg-red-50 text-red-600 border-red-200' },
  CORRELATIVA_AGREGADA:  { label: 'Correlativa +',      cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  CORRELATIVA_QUITADA:   { label: 'Correlativa −',      cls: 'bg-orange-50 text-orange-700 border-orange-200' },
};

function AccionBadge({ accion }: { accion: string }) {
  const cfg = ACCION_CONFIG[accion] ?? { label: accion, cls: 'bg-slate-50 text-slate-600 border-slate-200' };
  return (
    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ── Programa de Asignatura ────────────────────────────────────────────────────

function duracionLabel(c: number | undefined | null): string {
  if (c === 0) return 'Anual';
  if (c === 1) return '1° Cuatrimestre';
  if (c === 2) return '2° Cuatrimestre';
  return '—';
}

interface CampoConfig {
  key: string;
  label: string;
  tipo: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkboxgroup';
  placeholder?: string;
  opciones?: string[];
  rows?: number;
  obligatorio?: boolean;
  tieneOtra?: boolean;
  validacion?: 'masDeUnaPalabra';
  digitosExactos?: number;
}

interface SeccionConfig {
  id: string;
  numero: number;
  titulo: string;
  estadoKey: keyof ProgramaAsignatura;
  campos: CampoConfig[];
}

const SECCIONES_PROGRAMA: SeccionConfig[] = [
  {
    id: 's1', numero: 1, titulo: 'Identificación', estadoKey: 'estadoS1',
    campos: [] // Render custom — estado calculado desde ficha (presencia de selects)
  },
  {
    id: 's2', numero: 2, titulo: 'Fundamentos y Objetivos', estadoKey: 'estadoS2',
    campos: [
      { key: 'fundamentacion',     label: 'Fundamentación',                         tipo: 'textarea', rows: 8, obligatorio: true,  placeholder: 'Justificación pedagógica de la asignatura en el plan de estudios, relevancia en la formación del estudiante...' },
      { key: 'propositos',         label: 'Propósitos',                             tipo: 'textarea', rows: 8, obligatorio: true,  placeholder: 'Intenciones educativas del docente, orientaciones generales del proceso de enseñanza-aprendizaje...' },
      { key: 'objetivosGenerales', label: 'Objetivos / Resultados de aprendizaje',  tipo: 'textarea', rows: 8, obligatorio: true,  placeholder: 'Al finalizar el cursado, el estudiante será capaz de...' },
    ]
  },
  {
    id: 's3', numero: 3, titulo: 'Contenidos Curriculares', estadoKey: 'estadoS3',
    campos: [
      { key: 'contenidosSinteticos',       label: 'Contenidos mínimos / sintéticos',         tipo: 'textarea', rows: 7, obligatorio: true, placeholder: 'Síntesis de los contenidos mínimos establecidos por el plan de estudios para esta asignatura...' },
      { key: 'contenidosTematicos',        label: 'Programa analítico (unidades temáticas)', tipo: 'textarea', rows: 9, obligatorio: true, placeholder: 'Unidad 1: Título\n  1.1 Subtema...\nUnidad 2: Título\n  2.1 Subtema...' },
      { key: 'bibliografiaBasica',         label: 'Bibliografía obligatoria',                tipo: 'textarea', rows: 6, obligatorio: true, placeholder: 'Autor, A. (año). Título. Editorial.\nAutor, B. (año). Título. Editorial.' },
      { key: 'bibliografiaComplementaria', label: 'Bibliografía complementaria',             tipo: 'textarea', rows: 6, obligatorio: true, placeholder: 'Autor, A. (año). Título. Editorial.\nRecursos en línea: URL' },
    ]
  },
  {
    id: 's4', numero: 4, titulo: 'Metodología y Formación Práctica', estadoKey: 'estadoS4',
    campos: [
      { key: 'metodologiaEnsenanza', label: 'Metodología de enseñanza', tipo: 'textarea', rows: 5, obligatorio: true,
        placeholder: 'Describa las estrategias y métodos de enseñanza utilizados: clases magistrales, aprendizaje colaborativo, resolución de problemas...' },
      { key: 'tiposFormacionPractica', label: 'Tipos de formación práctica incluidos', tipo: 'checkboxgroup', obligatorio: true,
        opciones: [
          'FORMACIÓN EXPERIMENTAL / LABORATORIO / CAMPO',
          'RESOLUCIÓN DE PROBLEMAS ABIERTOS DE INGENIERÍA',
          'ACTIVIDADES DE PROYECTO Y DISEÑO',
          'PRÁCTICA PROFESIONAL SUPERVISADA / PROYECTO INTEGRADOR',
          'FORMACIÓN TEÓRICA (CLASES TEÓRICAS)',
        ],
        tieneOtra: true },
      { key: 'porcentajeTiempoFormacion', label: '% de tiempo dedicado por el alumno (por tipo)', tipo: 'textarea', rows: 5, obligatorio: true,
        placeholder: 'Formación teórica: 60%\nFormación experimental / laboratorio: 25%\nProyecto y diseño: 15%...' },
      { key: 'recursosDidacticos', label: 'Recursos', tipo: 'textarea', rows: 5, obligatorio: true,
        placeholder: 'Bibliografía de referencia, plataformas digitales, software especializado, laboratorios, materiales de práctica...' },
    ]
  },
  {
    id: 's5', numero: 5, titulo: 'Evaluación', estadoKey: 'estadoS5',
    campos: [
      { key: 'modalidadEvaluacion', label: 'Modalidad e instancias de evaluación', tipo: 'textarea', rows: 5, obligatorio: true,
        placeholder: 'Describa las modalidades de evaluación utilizadas (parciales escritos, coloquios, trabajos prácticos) y las instancias previstas a lo largo del cuatrimestre...' },
      { key: 'requisitosAprobacion', label: 'Requisitos para aprobar la materia', tipo: 'textarea', rows: 5, obligatorio: true,
        placeholder: 'Indique los requisitos de regularidad, asistencia mínima, calificaciones mínimas y condiciones para la aprobación de la materia...' },
    ]
  },
  {
    id: 's6', numero: 6, titulo: 'Gestión y Vigencia', estadoKey: 'estadoS6',
    campos: [
      { key: 'fechaVigenciaPrograma',   label: 'Año de vigencia del programa',       tipo: 'number', obligatorio: false, placeholder: String(new Date().getFullYear()), digitosExactos: 4 },
      { key: 'anioAprobacionRevision',  label: 'Periodo de aprobación / revisión',   tipo: 'text', obligatorio: false, placeholder: 'Ej: MARZO 2026' },
      { key: 'profesorACargo',          label: 'Profesor a cargo',               tipo: 'textarea', rows: 3, obligatorio: true, validacion: 'masDeUnaPalabra',
        placeholder: 'Nombre completo, título y cargo del profesor responsable del programa...' },
      { key: 'competenciasVinculadas',  label: 'Competencias genéricas/específicas vinculadas', tipo: 'checkboxgroup', obligatorio: true,
        opciones: [
          'IDENTIFICAR, FORMULAR Y RESOLVER PROBLEMAS DE INGENIERÍA',
          'CONCEBIR, DISEÑAR Y DESARROLLAR PROYECTOS DE INGENIERÍA',
          'COMUNICARSE CON EFECTIVIDAD',
          'TRABAJAR EN FORMA EFECTIVA EN EQUIPOS',
          'ACTUAR CON ÉTICA Y RESPONSABILIDAD PROFESIONAL Y SOCIAL',
          'APRENDER EN FORMA CONTINUA Y AUTÓNOMA',
        ],
        tieneOtra: true },
    ]
  },
];

const ESTADO_PROG_CFG: Record<string, { label: string; cls: string }> = {
  BORRADOR:    { label: 'Borrador',    cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  EN_REVISION: { label: 'En revisión', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  APROBADO:    { label: 'Aprobado',    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const ACCION_PROG_CFG: Record<string, { label: string; cls: string }> = {
  ACTUALIZACION: { label: 'Actualización', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  APROBACION:    { label: 'Aprobación',    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

function exportarProgramaPDF(ficha: FichaCompleta, programa: ProgramaAsignatura) {
  const estadoCfg = ESTADO_PROG_CFG[programa.estadoPrograma] ?? ESTADO_PROG_CFG.BORRADOR;
  const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

  const campo = (label: string, valor: string) =>
    valor ? `<div class="campo"><div class="label">${label}</div><div class="valor">${valor.replace(/\n/g, '<br>')}</div></div>` : '';

  // S1 desde la materia
  const s1HTML = `<div class="seccion"><h2>1. Identificación</h2>
    ${campo('Carrera/s en que se dicta', ficha.planEstudio.carrera.nombre)}
    ${campo('Bloque de Conocimiento', ficha.bloqueConocimiento ?? '')}
    ${campo('Modalidad de Dictado', ficha.modalidadDictado ? labelModalidad(ficha.modalidadDictado) : '')}
    ${campo('Duración', ficha.cuatrimestre != null ? duracionLabel(ficha.cuatrimestre) : '')}
    ${ficha.correlativas.length > 0 ? campo('Correlativas', ficha.correlativas.map(c => `[${c.correlativa.codigo}] ${c.correlativa.nombre}`).join('\n')) : ''}
  </div>`;

  // S2-S6 desde el programa
  const seccionesHTML = SECCIONES_PROGRAMA.filter(s => s.id !== 's1').map(s => {
    const camposHTML = s.campos.map(c => {
      const valor = String((programa as unknown as Record<string, unknown>)[c.key] ?? '');
      if (!valor) return '';
      const label = c.key === 'estadoPrograma' ? (ESTADO_PROG_CFG[valor]?.label ?? valor)
                  : c.key === 'fechaAprobacion' ? new Date(valor).toLocaleDateString('es-AR') : valor;
      return campo(c.label, label);
    }).filter(Boolean).join('');
    if (!camposHTML) return '';
    return `<div class="seccion"><h2>${s.numero}. ${s.titulo}</h2>${camposHTML}</div>`;
  }).filter(Boolean).join('');

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Programa — ${ficha.nombre}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:11pt;color:#1e293b;margin:0;padding:15mm 20mm}
  h1{font-size:17pt;color:#0f4c81;margin:0 0 4px}
  h2{font-size:12pt;color:#0f4c81;border-bottom:1.5px solid #e2e8f0;padding-bottom:5px;margin:22px 0 10px}
  .meta{font-size:9pt;color:#64748b;margin-bottom:4px}
  .badge{display:inline-block;font-size:9pt;font-weight:bold;padding:2px 8px;border-radius:4px;background:#f1f5f9;color:#475569;margin-left:8px}
  .campo{margin-bottom:14px}
  .label{font-size:9pt;font-weight:bold;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px}
  .valor{font-size:11pt;white-space:pre-wrap;line-height:1.5}
  .seccion{margin-bottom:8px}
  .footer{margin-top:30px;border-top:1px solid #e2e8f0;padding-top:8px;font-size:9pt;color:#94a3b8}
  @media print{body{padding:10mm 15mm}}
</style></head><body>
<h1>${ficha.nombre} <span class="badge">${estadoCfg.label}</span></h1>
<div class="meta">${ficha.planEstudio.carrera.nombre} · ${ficha.planEstudio.nombre}</div>
<div class="meta">Código: <strong>${ficha.codigo}</strong>&nbsp;&nbsp;|&nbsp;&nbsp;Año ${ficha.anio ?? '—'}&nbsp;&nbsp;|&nbsp;&nbsp;${duracionLabel(ficha.cuatrimestre)}</div>
${s1HTML}${seccionesHTML}
<div class="footer">Exportado el ${fecha}</div>
</body></html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); }
}

function ProgramaView({
  materiaId, ficha, permisosPrograma, apiFetch, onRefreshFicha
}: {
  materiaId: string;
  ficha: FichaCompleta;
  permisosPrograma: PermisosPrograma;
  apiFetch: (url: string, opts?: RequestInit) => Promise<any>;
  onRefreshFicha?: () => void;
}) {
  const [programa, setPrograma] = useState<ProgramaAsignatura | null>(null);
  const [cargando, setCargando] = useState(true);
  const [seccionActiva, setSeccionActiva] = useState('s1');
  const [editando, setEditando] = useState(false);
  const fieldRefs = useRef<Record<string, HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement | null>>({});
  const [editCheckboxes, setEditCheckboxes] = useState<Record<string, string[]>>({});
  const [editOtras, setEditOtras] = useState<Record<string, string>>({});
  const [formS1, setFormS1] = useState({ bloqueConocimiento: '', modalidadDictado: '', cuatrimestre: '' });
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setCargando(true);
    apiFetch(`${API_URL}/programas/materia/${materiaId}`)
      .then(data => setPrograma(data))
      .catch(() => setErrorMsg('No se pudo cargar el programa'))
      .finally(() => setCargando(false));
  }, [materiaId]);

  // S1: presencia de los 3 selects (no aplica regla de 50 chars por ser selects)
  function calcEstadoS1(): string {
    const completo = !!(ficha.bloqueConocimiento && ficha.modalidadDictado && ficha.cuatrimestre != null);
    return completo ? 'COMPLETO' : 'PENDIENTE';
  }

  // S2-S6: todos los campos obligatorios deben tener >50 chars (textarea) o no estar vacíos (otros)
  // Excepción: validacion='masDeUnaPalabra' → completo cuando tiene más de una palabra
  function calcEstadoFromCampos(s: SeccionConfig, prog: ProgramaAsignatura): string {
    const reqs = s.campos.filter(c => c.obligatorio);
    if (reqs.length === 0) return 'PENDIENTE';
    const ok = reqs.every(c => {
      const val = String((prog as unknown as Record<string, unknown>)[c.key] ?? '').trim();
      if (c.validacion === 'masDeUnaPalabra') return val.split(/\s+/).filter(Boolean).length > 1;
      return c.tipo === 'textarea' ? val.length > 50 : val.length > 0;
    });
    return ok ? 'COMPLETO' : 'PENDIENTE';
  }

  function getEstadoSeccion(seccionId: string, prog: ProgramaAsignatura | null = programa): string {
    if (seccionId === 's1') return calcEstadoS1();
    const s = SECCIONES_PROGRAMA.find(x => x.id === seccionId);
    return s && prog ? calcEstadoFromCampos(s, prog) : 'PENDIENTE';
  }

  const seccion = SECCIONES_PROGRAMA.find(s => s.id === seccionActiva)!;
  const estadoSeccion = getEstadoSeccion(seccionActiva);

  // ── Handlers S1 ─────────────────────────────────────────────────────────────

  function iniciarEdicionS1() {
    setFormS1({
      bloqueConocimiento: ficha.bloqueConocimiento ?? '',
      modalidadDictado: ficha.modalidadDictado ?? '',
      cuatrimestre: ficha.cuatrimestre?.toString() ?? '',
    });
    setEditando(true);
    setErrorMsg(null);
  }

  async function guardarS1() {
    setGuardando(true);
    setErrorMsg(null);
    try {
      // PATCH materia con los campos editables de S1
      const payload: Record<string, unknown> = {
        bloqueConocimiento: formS1.bloqueConocimiento || undefined,
        modalidadDictado: formS1.modalidadDictado || undefined,
      };
      if (formS1.cuatrimestre !== '') payload.cuatrimestre = parseInt(formS1.cuatrimestre);

      await apiFetch(`${API_URL}/materias/${materiaId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });

      // Auto-sync estadoS1 al programa
      const newCuatri = formS1.cuatrimestre !== '' ? parseInt(formS1.cuatrimestre) : null;
      const completo = !!(formS1.bloqueConocimiento && formS1.modalidadDictado && newCuatri != null);
      const nuevoEstadoS1 = completo ? 'COMPLETO' : 'PENDIENTE';

      const progData = await apiFetch(`${API_URL}/programas/materia/${materiaId}`, {
        method: 'PATCH',
        body: JSON.stringify({ estadoS1: nuevoEstadoS1, seccionModificada: 'Identificación' })
      });
      setPrograma(progData);
      setEditando(false);
      onRefreshFicha?.();
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }

  // ── Handlers S2-S6 ───────────────────────────────────────────────────────────

  function iniciarEdicion() {
    fieldRefs.current = {};
    const newCheckboxes: Record<string, string[]> = {};
    const newOtras: Record<string, string> = {};
    for (const campo of seccion.campos) {
      if (campo.tipo === 'checkboxgroup') {
        const stored = String((programa as unknown as Record<string, unknown>)[campo.key] ?? '');
        let arr: string[] = [];
        if (stored) { try { arr = JSON.parse(stored); } catch { arr = []; } }
        const regularOpts = arr.filter(o => !String(o).startsWith('Otra:'));
        const otraEntry = arr.find(o => String(o).startsWith('Otra:'));
        newCheckboxes[campo.key] = otraEntry ? [...regularOpts, 'Otra'] : regularOpts;
        newOtras[campo.key] = otraEntry ? String(otraEntry).replace(/^Otra:\s*/, '') : '';
      }
    }
    setEditCheckboxes(newCheckboxes);
    setEditOtras(newOtras);
    setEditando(true);
    setErrorMsg(null);
  }

  function cancelarEdicion() {
    fieldRefs.current = {};
    setEditCheckboxes({});
    setEditOtras({});
    setEditando(false);
    setErrorMsg(null);
  }

  async function guardarSeccion() {
    for (const campo of seccion.campos) {
      if (campo.digitosExactos) {
        const el = fieldRefs.current[campo.key];
        const value = (el ? el.value : '').trim();
        if (value !== '' && (!/^\d+$/.test(value) || value.length !== campo.digitosExactos)) {
          setErrorMsg(`"${campo.label}": ingrese exactamente ${campo.digitosExactos} dígitos numéricos (ej: ${new Date().getFullYear()}).`);
          return;
        }
      }
    }
    setGuardando(true);
    setErrorMsg(null);
    try {
      const payload: Record<string, unknown> = { seccionModificada: seccion.titulo };
      for (const campo of seccion.campos) {
        if (campo.tipo === 'checkboxgroup') {
          const selected = [...(editCheckboxes[campo.key] ?? [])];
          const otraIdx = selected.indexOf('Otra');
          if (otraIdx !== -1) {
            const otraEl = fieldRefs.current[`${campo.key}__otra`];
            const otraText = (otraEl ? otraEl.value : (editOtras[campo.key] ?? '')).trim();
            selected.splice(otraIdx, 1, `Otra: ${otraText}`);
          }
          payload[campo.key] = selected.length > 0 ? JSON.stringify(selected) : null;
        } else {
          const el = fieldRefs.current[campo.key];
          const value = el ? el.value : '';
          if (campo.tipo === 'number') {
            payload[campo.key] = value !== '' ? parseInt(value, 10) : null;
          } else {
            payload[campo.key] = value === '' ? null : value;
          }
        }
      }

      // Auto-calcular estadoSN desde los campos guardados
      const merged = { ...programa, ...payload } as ProgramaAsignatura;
      payload[seccion.estadoKey as string] = calcEstadoFromCampos(seccion, merged);

      const data = await apiFetch(`${API_URL}/programas/materia/${materiaId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      setPrograma(data);
      setEditando(false);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }

  // ── Progreso global ───────────────────────────────────────────────────────────

  const completadas = SECCIONES_PROGRAMA.filter(s => getEstadoSeccion(s.id) === 'COMPLETO').length;

  if (cargando) return <div className="flex justify-center py-12"><IcSpinner /></div>;
  if (!programa) return <div className="p-8 text-center text-xs text-slate-400">{errorMsg ?? 'No se pudo cargar el programa.'}</div>;

  const estadoProgCfg = ESTADO_PROG_CFG[programa.estadoPrograma] ?? ESTADO_PROG_CFG.BORRADOR;
  const sectCls = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]';

  return (
    <div>
      {/* Header del programa */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${estadoProgCfg.cls}`}>
            {estadoProgCfg.label}
          </span>
          <span className="text-[11px] text-slate-400">
            {completadas}/{SECCIONES_PROGRAMA.length} secciones completas
          </span>
          {programa.fechaActualizacion && (
            <span className="text-[11px] text-slate-400">
              · Actualizado {formatFecha(programa.fechaActualizacion)}
            </span>
          )}
        </div>
        {permisosPrograma.exportar && (
          <button
            onClick={() => exportarProgramaPDF(ficha, programa)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exportar PDF
          </button>
        )}
      </div>

      {/* Navegación de secciones */}
      <div className="flex gap-1 px-5 pt-4 pb-2 overflow-x-auto">
        {SECCIONES_PROGRAMA.map(s => {
          const esActiva = s.id === seccionActiva;
          const estadoS = getEstadoSeccion(s.id);
          return (
            <button
              key={s.id}
              onClick={() => { setSeccionActiva(s.id); setEditando(false); fieldRefs.current = {}; setEditCheckboxes({}); setEditOtras({}); setErrorMsg(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
                esActiva
                  ? 'bg-[#0f4c81] text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                estadoS === 'COMPLETO'
                  ? esActiva ? 'bg-white/30 text-white' : 'bg-emerald-100 text-emerald-700'
                  : esActiva ? 'bg-white/20 text-white/80' : 'bg-slate-100 text-slate-500'
              }`}>
                {estadoS === 'COMPLETO' ? '✓' : s.numero}
              </span>
              {s.titulo}
            </button>
          );
        })}
      </div>

      {/* Contenido de sección activa */}
      <div className="px-5 py-4">

        {/* Encabezado de sección */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800">{seccion.numero}. {seccion.titulo}</h3>
            {/* Badge siempre read-only — estado auto-calculado desde los campos obligatorios */}
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
              estadoSeccion === 'COMPLETO'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {estadoSeccion === 'COMPLETO' ? '✓ Completo' : '○ Pendiente'}
            </span>
          </div>
          {permisosPrograma.editar && !editando && (
            <button
              onClick={seccionActiva === 's1' ? iniciarEdicionS1 : iniciarEdicion}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0f4c81] hover:bg-[#0f4c81]/5 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <IcEdit />
              Editar sección
            </button>
          )}
          {editando && (
            <div className="flex items-center gap-2">
              <button
                onClick={cancelarEdicion}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-700 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={seccionActiva === 's1' ? guardarS1 : guardarSeccion}
                disabled={guardando}
                className="flex items-center gap-1.5 text-[11px] font-semibold bg-[#0f4c81] text-white px-3 py-1.5 rounded-lg hover:bg-[#0d3e6b] disabled:opacity-50 transition-colors"
              >
                {guardando ? 'Guardando...' : 'Guardar sección'}
              </button>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="mb-3 px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">
            {errorMsg}
          </div>
        )}

        {/* ── Sección 1: Identificación (render custom desde materia) ── */}
        {seccionActiva === 's1' && (
          <div className="divide-y divide-slate-50 -mx-5 px-0">

            {/* Carrera — siempre read-only */}
            <CampoFicha label="Carrera/s en que se dicta" valor={ficha.planEstudio.carrera.nombre} />

            {/* Bloque de Conocimiento * */}
            <CampoEditable
              label={<>Bloque de Conocimiento <span className="text-red-500">*</span></>}
              valor={ficha.bloqueConocimiento ?? '—'}
              editar={editando}
              input={
                <select
                  value={formS1.bloqueConocimiento}
                  onChange={e => setFormS1(f => ({ ...f, bloqueConocimiento: e.target.value }))}
                  className={sectCls}
                >
                  <option value="">— Sin asignar —</option>
                  {BLOQUES_CONOCIMIENTO.map(b => (
                    <option key={b.codigo} value={b.label}>{b.label}</option>
                  ))}
                </select>
              }
            />

            {/* Modalidad de Dictado * */}
            <CampoEditable
              label={<>Modalidad de Dictado <span className="text-red-500">*</span></>}
              valor={ficha.modalidadDictado ? labelModalidad(ficha.modalidadDictado) : '—'}
              editar={editando}
              input={
                <select
                  value={formS1.modalidadDictado}
                  onChange={e => setFormS1(f => ({ ...f, modalidadDictado: e.target.value }))}
                  className={sectCls}
                >
                  <option value="">— Sin asignar —</option>
                  {MODALIDADES_DICTADO.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              }
            />

            {/* Duración * */}
            <CampoEditable
              label={<>Duración <span className="text-red-500">*</span></>}
              valor={duracionLabel(ficha.cuatrimestre)}
              editar={editando}
              input={
                <select
                  value={formS1.cuatrimestre}
                  onChange={e => setFormS1(f => ({ ...f, cuatrimestre: e.target.value }))}
                  className={sectCls}
                >
                  <option value="">— Sin asignar —</option>
                  <option value="1">1° Cuatrimestre</option>
                  <option value="2">2° Cuatrimestre</option>
                  <option value="0">Anual</option>
                </select>
              }
            />

            {/* Correlativas — siempre read-only */}
            <div className="px-5 py-3.5">
              <p className="text-xs font-medium text-slate-500 mb-2.5">Correlativas</p>
              {ficha.correlativas.length === 0 ? (
                <p className="text-sm text-slate-400 italic">Sin correlativas definidas</p>
              ) : (
                <div className="space-y-1.5">
                  {ficha.correlativas.map(c => (
                    <div key={c.id} className="flex items-center gap-2.5 py-1.5 px-3 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="font-mono text-[11px] font-bold text-[#0f4c81] bg-[#0f4c81]/10 px-1.5 py-0.5 rounded border border-[#0f4c81]/10 whitespace-nowrap">
                        {c.correlativa.codigo}
                      </span>
                      <span className="text-xs text-slate-700 flex-1">{c.correlativa.nombre}</span>
                      {c.correlativa.anio && (
                        <span className="text-[11px] text-slate-400 whitespace-nowrap">
                          {c.correlativa.anio}°A{c.correlativa.cuatrimestre ? ` · ${c.correlativa.cuatrimestre}°C` : ''}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Nota de campos obligatorios */}
            <div className="px-5 py-3">
              <p className="text-[11px] text-slate-400">
                <span className="text-red-500 font-semibold">*</span> Los campos marcados con asterisco son obligatorios.
              </p>
            </div>

          </div>
        )}

        {/* ── Secciones 2-6: render genérico desde programa ── */}
        {seccionActiva !== 's1' && (
          <div className="space-y-5">
            {seccion.campos.map(campo => {
              const valorActual = (programa as unknown as Record<string, unknown>)[campo.key];
              const valorStr = valorActual != null ? String(valorActual) : '';

              const labelNode = (
                <>
                  {campo.label}
                  {campo.obligatorio && <span className="text-red-500 ml-0.5">*</span>}
                </>
              );

              if (editando) {
                const edCls = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81] resize-y';
                return (
                  <div key={campo.key}>
                    <label className="flex items-center gap-0.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                      {labelNode}
                    </label>
                    {campo.tipo === 'checkboxgroup' ? (
                      <div className="space-y-2">
                        {campo.opciones?.map(opcion => (
                          <label key={opcion} className="flex items-start gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={(editCheckboxes[campo.key] ?? []).includes(opcion)}
                              onChange={e => {
                                const isChecked = e.target.checked;
                                setEditCheckboxes(prev => ({
                                  ...prev,
                                  [campo.key]: isChecked
                                    ? [...(prev[campo.key] ?? []), opcion]
                                    : (prev[campo.key] ?? []).filter(o => o !== opcion)
                                }));
                              }}
                              className="mt-0.5 w-4 h-4 shrink-0 rounded border-slate-300 text-[#0f4c81] focus:ring-[#0f4c81]/30 cursor-pointer"
                            />
                            <span className="text-sm text-slate-700 leading-snug">{opcion}</span>
                          </label>
                        ))}
                        {campo.tieneOtra && (
                          <>
                            <label className="flex items-start gap-2.5 cursor-pointer group">
                              <input
                                type="checkbox"
                                checked={(editCheckboxes[campo.key] ?? []).includes('Otra')}
                                onChange={e => {
                                  const isChecked = e.target.checked;
                                  if (!isChecked) {
                                    const otraEl = fieldRefs.current[`${campo.key}__otra`];
                                    if (otraEl) setEditOtras(prev => ({ ...prev, [campo.key]: otraEl.value }));
                                  }
                                  setEditCheckboxes(prev => ({
                                    ...prev,
                                    [campo.key]: isChecked
                                      ? [...(prev[campo.key] ?? []), 'Otra']
                                      : (prev[campo.key] ?? []).filter(o => o !== 'Otra')
                                  }));
                                }}
                                className="mt-0.5 w-4 h-4 shrink-0 rounded border-slate-300 text-[#0f4c81] focus:ring-[#0f4c81]/30 cursor-pointer"
                              />
                              <span className="text-sm text-slate-700 leading-snug">OTRA (ESPECIFICAR)</span>
                            </label>
                            {(editCheckboxes[campo.key] ?? []).includes('Otra') && (
                              <input
                                ref={el => { fieldRefs.current[`${campo.key}__otra`] = el; }}
                                type="text"
                                defaultValue={editOtras[campo.key] ?? ''}
                                placeholder="Especificar tipo de formación práctica..."
                                className={`ml-6 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]`}
                              />
                            )}
                          </>
                        )}
                      </div>
                    ) : campo.tipo === 'textarea' ? (
                      <textarea
                        key={`${seccionActiva}-${campo.key}`}
                        ref={el => { fieldRefs.current[campo.key] = el; }}
                        defaultValue={String((programa as unknown as Record<string, unknown>)[campo.key] ?? '')}
                        placeholder={campo.placeholder}
                        rows={campo.rows ?? 4}
                        className={edCls}
                      />
                    ) : campo.tipo === 'select' ? (
                      <select
                        key={`${seccionActiva}-${campo.key}`}
                        ref={el => { fieldRefs.current[campo.key] = el; }}
                        defaultValue={String((programa as unknown as Record<string, unknown>)[campo.key] ?? '')}
                        className={edCls}
                      >
                        {campo.opciones?.map(op => (
                          <option key={op} value={op}
                            disabled={op === 'APROBADO' && !permisosPrograma.aprobar}>
                            {op === 'BORRADOR' ? 'Borrador' : op === 'EN_REVISION' ? 'En revisión' : 'Aprobado'}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        key={`${seccionActiva}-${campo.key}`}
                        ref={el => { fieldRefs.current[campo.key] = el; }}
                        type={campo.tipo}
                        defaultValue={String((programa as unknown as Record<string, unknown>)[campo.key] ?? '')}
                        placeholder={campo.placeholder}
                        className={edCls}
                      />
                    )}
                  </div>
                );
              }

              return (
                <div key={campo.key} className="border-b border-slate-50 pb-4 last:border-0 last:pb-0">
                  <p className="flex items-center gap-0.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                    {labelNode}
                  </p>
                  {valorStr ? (
                    campo.tipo === 'checkboxgroup' ? (
                      <ul className="space-y-0.5">
                        {(() => {
                          try {
                            return (JSON.parse(valorStr) as string[]).map(item => (
                              <li key={item} className="flex items-start gap-1.5 text-sm text-slate-700">
                                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#0f4c81] shrink-0" />
                                {item}
                              </li>
                            ));
                          } catch {
                            return <li className="text-sm text-slate-700">{valorStr}</li>;
                          }
                        })()}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {campo.key === 'estadoPrograma'
                          ? (ESTADO_PROG_CFG[valorStr]?.label ?? valorStr)
                          : campo.key === 'fechaAprobacion'
                          ? formatFecha(valorStr)
                          : valorStr}
                      </p>
                    )
                  ) : (
                    <p className="text-sm text-slate-300 italic">Sin datos</p>
                  )}
                </div>
              );
            })}

            {/* Nota de campos obligatorios */}
            {seccion.campos.some(c => c.obligatorio) && (
              <p className="text-[11px] text-slate-400 pt-3 border-t border-slate-100">
                <span className="text-red-500 font-semibold">*</span> Los campos marcados con asterisco son obligatorios.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
