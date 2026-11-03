'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiFetch as apiFetchBase, mensajeErrorHttp } from '@/lib/api';

async function apiCall(path: string, opts?: RequestInit) {
  const res = await apiFetchBase(path, opts);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(mensajeErrorHttp(res, data, 'Error en la solicitud'));
  return data;
}

interface Facultad {
  id: string;
  nombre: string;
  codigo?: string;
}

interface Carrera {
  id: string;
  nombre: string;
  codigo?: string;
  facultadId: string;
}

interface Plan {
  id: string;
  nombre: string;
  anio?: number;
  version?: string;
  estado: string;
}

const IcSpinnerSm = () => (
  <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-slate-300 border-t-[#0f4c81] animate-spin flex-shrink-0" />
);

const IcArrow = () => (
  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

export default function AutoevaluacionPage() {
  const { usuario } = useAuth();
  const rol = usuario?.rol?.nombre ?? '';

  const [facultades,         setFacultades]         = useState<Facultad[]>([]);
  const [cargandoFacultades, setCargandoFacultades] = useState(true);
  const [facultadId,         setFacultadId]         = useState('');

  const [carreras,         setCarreras]         = useState<Carrera[]>([]);
  const [cargandoCarreras, setCargandoCarreras] = useState(true);
  const [carreraId,        setCarreraId]        = useState('');

  const [planes,         setPlanes]         = useState<Plan[]>([]);
  const [cargandoPlanes, setCargandoPlanes] = useState(false);
  const [planId,         setPlanId]         = useState('');

  useEffect(() => {
    if (!usuario) return;
    apiCall('/facultades')
      .then((data: Facultad[]) => setFacultades((data ?? []).filter(f => (f as any).estado !== 'INACTIVO')))
      .catch(() => {})
      .finally(() => setCargandoFacultades(false));
    apiCall('/carreras')
      .then(setCarreras)
      .catch(() => {})
      .finally(() => setCargandoCarreras(false));
  }, [usuario]);

  useEffect(() => {
    if (rol === 'DIRECTOR_CARRERA' && usuario?.carreraAsociada) {
      setCarreraId(usuario.carreraAsociada.id);
    }
  }, [rol, usuario]);

  useEffect(() => {
    if (!carreraId) { setPlanes([]); setPlanId(''); return; }
    setCargandoPlanes(true);
    apiCall(`/plan-estudios?carreraId=${carreraId}`)
      .then((data: Plan[]) => setPlanes(data ?? []))
      .catch(() => setPlanes([]))
      .finally(() => setCargandoPlanes(false));
    setPlanId('');
  }, [carreraId]);

  const carreraLabel = carreras.find(c => c.id === carreraId)?.nombre;
  const planLabel    = planes.find(p => p.id === planId)?.nombre;

  return (
    <div className="max-w-6xl mx-auto">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-5">
        <a href="/" className="hover:text-slate-600 transition-colors">Inicio</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">Autoevaluación</span>
      </nav>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">MOD-AUT</p>
          <h1 className="text-xl font-bold text-slate-800">Autoevaluación Institucional</h1>
          <p className="mt-1 text-sm text-slate-500">
            Seleccioná el ámbito a evaluar para acceder al tablero correspondiente.
          </p>
        </div>
        <Link
          href="/autoevaluacion/alertas"
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors border border-red-100 self-start mt-1"
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          Bandeja de alertas →
        </Link>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* ── Card 1: Plan de Estudios ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="h-1.5 bg-violet-500" />
          <div className="p-5 flex flex-col flex-1">

            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-500 mb-0.5">Tablero</p>
                <h2 className="text-sm font-bold text-slate-800 leading-snug">Plan de Estudios</h2>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Evaluá indicadores del plan: horas por tipo, bloques de conocimiento, formación práctica y estructura curricular.
            </p>

            <div className="space-y-2.5 flex-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Carrera
                </label>
                {cargandoCarreras ? (
                  <div className="flex items-center gap-2 py-2">
                    <IcSpinnerSm />
                    <span className="text-xs text-slate-400">Cargando...</span>
                  </div>
                ) : (
                  <select
                    value={carreraId}
                    onChange={e => setCarreraId(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
                  >
                    <option value="">— Seleccioná una carrera —</option>
                    {carreras.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Plan de estudios
                </label>
                {cargandoPlanes ? (
                  <div className="flex items-center gap-2 py-2">
                    <IcSpinnerSm />
                    <span className="text-xs text-slate-400">Cargando...</span>
                  </div>
                ) : (
                  <select
                    value={planId}
                    onChange={e => setPlanId(e.target.value)}
                    disabled={!carreraId || planes.length === 0}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {!carreraId
                        ? '— Seleccioná una carrera primero —'
                        : planes.length === 0
                        ? '— Sin planes disponibles —'
                        : '— Seleccioná un plan —'}
                    </option>
                    {planes.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}{p.anio ? ` (${p.anio})` : ''}{p.version ? ` v${p.version}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              {planId ? (
                <Link
                  href={`/autoevaluacion/tablero/${planId}?plan=${encodeURIComponent(planLabel ?? '')}&carrera=${encodeURIComponent(carreraLabel ?? '')}`}
                  className="flex items-center justify-center gap-2 w-full text-xs font-semibold px-4 py-2.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-400 transition-colors"
                >
                  Ir al tablero
                  <IcArrow />
                </Link>
              ) : (
                <div className="flex items-center justify-center w-full text-xs font-semibold px-4 py-2.5 rounded-lg bg-slate-100 text-slate-400 cursor-not-allowed select-none">
                  Seleccioná un plan para continuar
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Card 2: Cuerpo Académico (Facultad) ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="h-1.5 bg-teal-500" />
          <div className="p-5 flex flex-col flex-1">

            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 22V4a2 2 0 012-2h8a2 2 0 012 2v18zM6 12H4a2 2 0 00-2 2v6a2 2 0 002 2h2M18 9h2a2 2 0 012 2v9a2 2 0 01-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-teal-500 mb-0.5">Tablero</p>
                <h2 className="text-sm font-bold text-slate-800 leading-snug">
                  Cuerpo Académico<br />(Facultad)
                </h2>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Evaluá el plantel docente de toda la facultad: cargos, títulos, dedicación y responsabilidades por carrera.
            </p>

            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Facultad
              </label>
              {cargandoFacultades ? (
                <div className="flex items-center gap-2 py-2">
                  <IcSpinnerSm />
                  <span className="text-xs text-slate-400">Cargando...</span>
                </div>
              ) : (
                <select
                  value={facultadId}
                  onChange={e => setFacultadId(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-400"
                >
                  <option value="">— Seleccioná una facultad —</option>
                  {facultades.map(f => (
                    <option key={f.id} value={f.id}>{f.nombre}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              {facultadId ? (
                <Link
                  href={`/autoevaluacion/tablero/facultad/${facultadId}`}
                  className="flex items-center justify-center gap-2 w-full text-xs font-semibold px-4 py-2.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-400 transition-colors"
                >
                  Ir al tablero
                  <IcArrow />
                </Link>
              ) : (
                <div className="flex items-center justify-center w-full text-xs font-semibold px-4 py-2.5 rounded-lg bg-slate-100 text-slate-400 cursor-not-allowed select-none">
                  Seleccioná una facultad para continuar
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Card 3: Cuerpo Académico (Carrera) ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="h-1.5 bg-[#0f4c81]" />
          <div className="p-5 flex flex-col flex-1">

            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-[#0f4c81]/8 border border-[#0f4c81]/15 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[#0f4c81]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#0f4c81]/70 mb-0.5">Tablero</p>
                <h2 className="text-sm font-bold text-slate-800 leading-snug">
                  Cuerpo Académico<br />(Carrera)
                </h2>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Evaluá el cuerpo académico de una carrera: asignaciones docentes, sobreasignación y calificaciones.
            </p>

            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Carrera
              </label>
              {cargandoCarreras ? (
                <div className="flex items-center gap-2 py-2">
                  <IcSpinnerSm />
                  <span className="text-xs text-slate-400">Cargando...</span>
                </div>
              ) : (
                <select
                  value={carreraId}
                  onChange={e => setCarreraId(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
                >
                  <option value="">— Seleccioná una carrera —</option>
                  {carreras.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              )}
              {rol === 'DIRECTOR_CARRERA' && usuario?.carreraAsociada && (
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Carrera asignada:{' '}
                  <span className="font-medium text-[#0f4c81]">{usuario.carreraAsociada.nombre}</span>
                </p>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              {carreraId ? (
                <Link
                  href={`/autoevaluacion/tablero/carrera/${carreraId}?carrera=${encodeURIComponent(carreraLabel ?? '')}`}
                  className="flex items-center justify-center gap-2 w-full text-xs font-semibold px-4 py-2.5 rounded-lg bg-[#0f4c81] text-white hover:bg-[#0a3d6e] focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/40 transition-colors"
                >
                  Ir al tablero
                  <IcArrow />
                </Link>
              ) : (
                <div className="flex items-center justify-center w-full text-xs font-semibold px-4 py-2.5 rounded-lg bg-slate-100 text-slate-400 cursor-not-allowed select-none">
                  Seleccioná una carrera para continuar
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
