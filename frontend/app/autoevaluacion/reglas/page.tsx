'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiFetch as apiFetchBase, mensajeErrorHttp } from '@/lib/api';

// ── API helper ─────────────────────────────────────────────────────────────────

async function apiCall(path: string, opts?: RequestInit) {
  const res = await apiFetchBase(path, opts);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(mensajeErrorHttp(res, data, 'Error en la solicitud'));
  return data;
}

// ── Tipos ──────────────────────────────────────────────────────────────────────

type GrupoAnalisis = 'CRUZADAS' | 'DOCENTES' | 'PLANES';
type Severidad = 'ALTA' | 'MEDIA' | 'INFORMATIVA' | 'NINGUNA';
type EstadoImpl = 'IMPLEMENTADO' | 'PARCIAL' | 'NO_IMPLEMENTADO';

interface ParametroRegla {
  codigo: string;
  nombre: string;
  descripcion: string;
  unidad: string;
  origen: 'FACULTAD' | 'PLAN' | 'MATERIA';
  campoDb: string;
  configurable: boolean;
  dependenciaPendiente?: string;
}

interface ReglaDto {
  codigo: string;
  nombre: string;
  descripcion: string;
  tipo: string;
  severidad: Severidad;
  alcance: string;
  grupo: GrupoAnalisis;
  estadoImplementacion: EstadoImpl;
  motivoPendiente?: string;
  parametros: ParametroRegla[];
}

interface ConfigFacultad {
  p01TopeH: number;
  p02BajaH: number;
  p03MaxMat: number;
  updatedAt: string;
}

interface FacultadConConfig {
  facultadId: string;
  nombre: string;
  config: ConfigFacultad | null;
}

// ── Constantes de display ──────────────────────────────────────────────────────

const GRUPO_LABEL: Record<GrupoAnalisis, string> = {
  CRUZADAS: 'Cruzadas DOC ↔ PDE',
  DOCENTES: 'Cuerpo Docente',
  PLANES: 'Planes de Estudio',
};

const GRUPO_DESC: Record<GrupoAnalisis, string> = {
  CRUZADAS: 'Inconsistencias entre el cuerpo docente y los planes de estudio',
  DOCENTES: 'Reglas sobre dedicación, carga y datos del cuerpo docente',
  PLANES: 'Reglas sobre estructura horaria y contenidos de los planes',
};

const SEV_COLOR: Record<Severidad, string> = {
  ALTA:        'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  MEDIA:       'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  INFORMATIVA: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  NINGUNA:     'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

const IMPL_COLOR: Record<EstadoImpl, string> = {
  IMPLEMENTADO:    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  PARCIAL:         'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  NO_IMPLEMENTADO: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
};

const ORIGEN_LABEL: Record<string, string> = {
  FACULTAD: 'Facultad',
  PLAN: 'Plan de Estudio',
  MATERIA: 'Materia',
};

const GRUPOS_ORDER: GrupoAnalisis[] = ['CRUZADAS', 'DOCENTES', 'PLANES'];

// ── Componentes ────────────────────────────────────────────────────────────────

function Badge({ cls, children }: { cls: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

function ParametroItem({ p }: { p: ParametroRegla }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span className="font-mono text-xs font-semibold text-indigo-700 dark:text-indigo-300 w-14 shrink-0 pt-0.5">
        {p.codigo}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{p.nombre}</span>
          <Badge cls="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
            {ORIGEN_LABEL[p.origen] ?? p.origen}
          </Badge>
          <Badge cls="bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
            {p.unidad}
          </Badge>
          {p.configurable ? (
            <Badge cls="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              Configurable
            </Badge>
          ) : (
            <Badge cls="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              No configurable
            </Badge>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{p.descripcion}</p>
        {!p.configurable && p.dependenciaPendiente && (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded px-2 py-1">
            Dependencia pendiente: {p.dependenciaPendiente}
          </p>
        )}
        {p.configurable && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Campo DB: <code className="font-mono">{p.campoDb}</code>
          </p>
        )}
      </div>
    </div>
  );
}

function ReglaCard({ regla }: { regla: ReglaDto }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors rounded-lg"
      >
        <span className="font-mono text-sm font-bold text-indigo-700 dark:text-indigo-300 w-12 shrink-0 pt-0.5">
          {regla.codigo}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{regla.nombre}</span>
            <Badge cls={SEV_COLOR[regla.severidad]}>{regla.severidad}</Badge>
            <Badge cls={IMPL_COLOR[regla.estadoImplementacion]}>
              {regla.estadoImplementacion === 'IMPLEMENTADO' ? 'Implementada' : regla.estadoImplementacion === 'PARCIAL' ? 'Parcial' : 'Pendiente'}
            </Badge>
            <Badge cls="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {regla.alcance}
            </Badge>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{regla.descripcion}</p>
        </div>
        <span className="text-gray-400 shrink-0 mt-0.5 text-sm">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-3 mb-3">{regla.descripcion}</p>

          {regla.motivoPendiente && (
            <div className="mb-3 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-750 rounded px-3 py-2 border border-gray-200 dark:border-gray-600">
              <span className="font-medium">Motivo pendiente:</span> {regla.motivoPendiente}
            </div>
          )}

          {regla.parametros.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">
                Parámetros asociados
              </h4>
              <div>
                {regla.parametros.map((p) => (
                  <ParametroItem key={p.codigo} p={p} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Formulario de configuración de facultad ────────────────────────────────────────

interface ConfigFormProps {
  facultad: FacultadConConfig;
  onSaved: (id: string, newCfg: ConfigFacultad) => void;
}

function ConfigFacultadForm({ facultad, onSaved }: ConfigFormProps) {
  const cfg = facultad.config;
  const [p01, setP01] = useState(String(cfg?.p01TopeH ?? ''));
  const [p02, setP02] = useState(String(cfg?.p02BajaH ?? ''));
  const [p03, setP03] = useState(String(cfg?.p03MaxMat ?? ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const body: Record<string, number> = {};
      if (p01) body['p01TopeH'] = Number(p01);
      if (p02) body['p02BajaH'] = Number(p02);
      if (p03) body['p03MaxMat'] = Number(p03);

      const saved = await apiCall(`/autoevaluacion/config/facultad/${facultad.facultadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setSuccess(true);
      onSaved(facultad.facultadId, saved);
    } catch (e) {
      setError((e as Error).message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          P-01 Tope semanal (h/semana)
        </label>
        <input
          type="number"
          min={1}
          max={168}
          value={p01}
          onChange={(e) => setP01(e.target.value)}
          placeholder={cfg ? String(cfg.p01TopeH) : 'Requerido'}
          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          P-02 Umbral baja dedicación (h/semana)
        </label>
        <input
          type="number"
          min={1}
          value={p02}
          onChange={(e) => setP02(e.target.value)}
          placeholder={cfg ? String(cfg.p02BajaH) : 'Requerido'}
          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          P-03 Máx. materias por docente
        </label>
        <input
          type="number"
          min={1}
          max={20}
          value={p03}
          onChange={(e) => setP03(e.target.value)}
          placeholder={cfg ? String(cfg.p03MaxMat) : 'Requerido'}
          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
      </div>
      <div className="sm:col-span-3 flex items-center gap-3 mt-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
        {success && <span className="text-emerald-600 dark:text-emerald-400 text-sm">Guardado ✓</span>}
        {error && <span className="text-red-600 dark:text-red-400 text-sm">{error}</span>}
      </div>
    </div>
  );
}

// ── Tarjeta de configuración por facultad ─────────────────────────────────────────

interface FacultadCardProps {
  fac: FacultadConConfig;
  esAdmin: boolean;
  onSaved: (id: string, newCfg: ConfigFacultad) => void;
}

function FacultadCard({ fac, esAdmin, onSaved }: FacultadCardProps) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-4 shadow-sm">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{fac.nombre}</h3>
        <div className="flex items-center gap-2">
          {fac.config ? (
            <Badge cls="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              Configurada
            </Badge>
          ) : (
            <Badge cls="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              Sin configurar
            </Badge>
          )}
          {esAdmin && (
            <button
              onClick={() => setEditing((v) => !v)}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {editing ? 'Cancelar' : 'Editar'}
            </button>
          )}
        </div>
      </div>

      {fac.config && !editing && (
        <div className="mt-2 grid grid-cols-3 gap-3 text-center">
          <div className="bg-gray-50 dark:bg-gray-750 rounded p-2">
            <div className="text-lg font-bold text-indigo-700 dark:text-indigo-300">{fac.config.p01TopeH}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">h/sem tope (P-01)</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-750 rounded p-2">
            <div className="text-lg font-bold text-indigo-700 dark:text-indigo-300">{fac.config.p02BajaH}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">h/sem baja ded. (P-02)</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-750 rounded p-2">
            <div className="text-lg font-bold text-indigo-700 dark:text-indigo-300">{fac.config.p03MaxMat}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">máx. materias (P-03)</div>
          </div>
        </div>
      )}

      {editing && (
        <ConfigFacultadForm
          facultad={fac}
          onSaved={(id, cfg) => {
            onSaved(id, cfg);
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}

// ── Página principal ────────────────────────────────────────────────────────────

export default function ReglasCatalogoPage() {
  const { usuario, cargando: cargandoAuth } = useAuth();

  const [tab, setTab] = useState<'catalogo' | 'configuracion'>('catalogo');
  const [grupoFiltro, setGrupoFiltro] = useState<GrupoAnalisis | 'TODOS'>('TODOS');

  const [reglas, setReglas] = useState<ReglaDto[]>([]);
  const [cargandoReglas, setCargandoReglas] = useState(true);
  const [errorReglas, setErrorReglas] = useState<string | null>(null);

  const [facultades, setFacultades] = useState<FacultadConConfig[]>([]);
  const [cargandoFac, setCargandoFac] = useState(false);
  const [errorFac, setErrorFac] = useState<string | null>(null);

  const esAdmin = usuario?.rol.nombre === 'ADMINISTRADOR_SISTEMA';

  // Cargar catálogo
  useEffect(() => {
    if (cargandoAuth) return;
    setCargandoReglas(true);
    apiCall('/autoevaluacion/reglas')
      .then(setReglas)
      .catch((e: Error) => setErrorReglas(e.message))
      .finally(() => setCargandoReglas(false));
  }, [cargandoAuth]);

  // Cargar facultades cuando se cambia a la pestaña configuración
  const cargarFacultades = useCallback(() => {
    if (facultades.length > 0) return;
    setCargandoFac(true);
    setErrorFac(null);
    apiCall('/autoevaluacion/reglas/config/facultades')
      .then(setFacultades)
      .catch((e: Error) => setErrorFac(e.message))
      .finally(() => setCargandoFac(false));
  }, [facultades.length]);

  const handleTabConfig = () => {
    setTab('configuracion');
    cargarFacultades();
  };

  const handleConfigSaved = (id: string, newCfg: ConfigFacultad) => {
    setFacultades((prev) =>
      prev.map((f) => (f.facultadId === id ? { ...f, config: newCfg } : f)),
    );
  };

  // Agrupar reglas
  const reglasPorGrupo = GRUPOS_ORDER.reduce<Record<GrupoAnalisis, ReglaDto[]>>(
    (acc, g) => {
      acc[g] = reglas.filter((r) => r.grupo === g);
      return acc;
    },
    { CRUZADAS: [], DOCENTES: [], PLANES: [] },
  );

  const reglasFiltradas =
    grupoFiltro === 'TODOS' ? reglas : reglasPorGrupo[grupoFiltro];

  if (cargandoAuth) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <p className="text-gray-500">Verificando sesión…</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Cabecera */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1 text-sm text-gray-500 dark:text-gray-400">
          <a href="/" className="hover:underline">Inicio</a>
          <span>/</span>
          <Link href="/autoevaluacion" className="hover:underline">Autoevaluación</Link>
          <span>/</span>
          <span>Reglas de validación</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Reglas de validación MOD-AUT
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Catálogo de reglas del FSD v2.0 y configuración de umbrales institucionales.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setTab('catalogo')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === 'catalogo'
              ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Catálogo de reglas
        </button>
        <button
          onClick={handleTabConfig}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === 'configuracion'
              ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Configuración de umbrales
        </button>
      </div>

      {/* ── Tab Catálogo ─────────────────────────────────────────────────────────── */}
      {tab === 'catalogo' && (
        <div>
          {/* Filtro por grupo */}
          <div className="flex flex-wrap gap-2 mb-5">
            {(['TODOS', ...GRUPOS_ORDER] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGrupoFiltro(g)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  grupoFiltro === g
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {g === 'TODOS' ? 'Todas' : GRUPO_LABEL[g]}
              </button>
            ))}
          </div>

          {cargandoReglas && (
            <p className="text-gray-500 dark:text-gray-400 text-sm">Cargando catálogo…</p>
          )}
          {errorReglas && (
            <p className="text-red-600 dark:text-red-400 text-sm">{errorReglas}</p>
          )}

          {!cargandoReglas && !errorReglas && (
            <>
              {grupoFiltro === 'TODOS' ? (
                GRUPOS_ORDER.map((grupo) => (
                  <div key={grupo} className="mb-8">
                    <div className="mb-3">
                      <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">
                        {GRUPO_LABEL[grupo]}
                      </h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{GRUPO_DESC[grupo]}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {reglasPorGrupo[grupo].map((r) => (
                        <ReglaCard key={r.codigo} regla={r} />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div>
                  <div className="mb-3">
                    <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">
                      {GRUPO_LABEL[grupoFiltro]}
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{GRUPO_DESC[grupoFiltro]}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {reglasFiltradas.map((r) => (
                      <ReglaCard key={r.codigo} regla={r} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Tab Configuración ───────────────────────────────────────────────────── */}
      {tab === 'configuracion' && (
        <div>
          {/* Parámetros por facultad */}
          <section className="mb-8">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">
              Parámetros por Facultad
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              P-01 (tope semanal — R-03), P-02 (umbral baja dedicación — R-10), P-03 (máx. materias — R-07).
              {!esAdmin && (
                <span className="block mt-1 text-amber-700 dark:text-amber-400">
                  Solo el Administrador del Sistema puede modificar estos parámetros.
                </span>
              )}
            </p>

            {cargandoFac && (
              <p className="text-gray-500 dark:text-gray-400 text-sm">Cargando…</p>
            )}
            {errorFac && (
              <p className="text-red-600 dark:text-red-400 text-sm">{errorFac}</p>
            )}
            {!cargandoFac && !errorFac && facultades.length === 0 && (
              <p className="text-gray-500 dark:text-gray-400 text-sm">No se encontraron facultades accesibles.</p>
            )}
            {!cargandoFac && !errorFac && facultades.length > 0 && (
              <div className="flex flex-col gap-3">
                {facultades.map((f) => (
                  <FacultadCard
                    key={f.facultadId}
                    fac={f}
                    esAdmin={esAdmin}
                    onSaved={handleConfigSaved}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Parámetros por plan */}
          <section className="mb-8">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">
              Parámetros por Plan de Estudio
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              P-10..P-14 (horas mínimas por bloque curricular — R-09). Estos parámetros se configuran
              en el tablero de cada Plan de Estudio.
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Para configurar los umbrales horarios de un plan, acceda al tablero del Plan de Estudio
                correspondiente y utilice la opción de configuración de umbrales.
              </p>
              <Link
                href="/autoevaluacion"
                className="inline-block mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                ← Ir a Autoevaluación
              </Link>
            </div>
          </section>

          {/* Parámetros no configurables */}
          <section>
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">
              Parámetros no configurables
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Estos parámetros requerirán cambios de esquema de base de datos antes de poder ser configurados.
            </p>
            <div className="flex flex-col gap-2">
              {reglas
                .flatMap((r) => r.parametros.filter((p) => !p.configurable).map((p) => ({ ...p, reglaCodigo: r.codigo })))
                .map((p) => (
                  <div key={p.codigo} className="border border-amber-200 dark:border-amber-800 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-amber-800 dark:text-amber-300">{p.codigo}</span>
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{p.nombre}</span>
                      <Badge cls="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        {p.reglaCodigo}
                      </Badge>
                      <Badge cls="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        No configurable
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{p.descripcion}</p>
                    {p.dependenciaPendiente && (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                        {p.dependenciaPendiente}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
