'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface Opcion { id: string; nombre: string; [k: string]: any }

interface FormState {
  facultadId: string;
  carreraId: string;
  planEstudioId: string;
  materiaId: string;
  docenteId: string;
  catedraId: string;
  cargoId: string;
  modalidadId: string;
  designacionId: string;
  anioInicio: string;
  observaciones: string;
}

const VACIO: FormState = {
  facultadId: '', carreraId: '', planEstudioId: '', materiaId: '',
  docenteId: '', catedraId: '', cargoId: '', modalidadId: '',
  designacionId: '', anioInicio: '', observaciones: '',
};

interface Props {
  onGuardado: () => void;
  onCerrar: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

const SEL_CLS = (disabled: boolean) =>
  `w-full rounded-lg border px-3 py-2 text-sm outline-none transition bg-white
   ${disabled
     ? 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'
     : 'border-slate-200 focus:border-[#0f4c81] focus:ring-2 focus:ring-[#0f4c81]/15 text-slate-800'}`;

const IcSpinner = () => (
  <div className="w-4 h-4 rounded-full border-2 border-slate-200 border-t-[#0f4c81] animate-spin flex-shrink-0" />
);

const IcClose = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

function Campo({ label, requerido, children }: { label: string; requerido?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
        {label} {requerido && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function Separador({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  );
}

function validarAnio(val: string): string | null {
  if (!val.trim()) return 'El año de inicio es obligatorio';
  if (!/^\d{4}$/.test(val.trim())) return 'Debe contener exactamente 4 dígitos';
  const n = parseInt(val, 10);
  if (n < 1900 || n > 2100) return 'El año debe estar entre 1900 y 2100';
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FormularioVinculacion({ onGuardado, onCerrar }: Props) {
  const [form, setForm] = useState<FormState>(VACIO);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anioError, setAnioError] = useState<string | null>(null);

  // horasSemana: se lee automáticamente de la materia seleccionada
  const [horasSemana, setHorasSemana] = useState<number | null | undefined>(undefined);

  // Opciones de selects
  const [facultades,    setFacultades]    = useState<Opcion[]>([]);
  const [carreras,      setCarreras]      = useState<Opcion[]>([]);
  const [planes,        setPlanes]        = useState<Opcion[]>([]);
  const [materias,      setMaterias]      = useState<Opcion[]>([]);
  const [docentes,      setDocentes]      = useState<Opcion[]>([]);
  const [catedras,      setCatedras]      = useState<Opcion[]>([]);
  const [cargos,        setCargos]        = useState<Opcion[]>([]);
  const [modalidades,   setModalidades]   = useState<Opcion[]>([]);
  const [designaciones, setDesignaciones] = useState<Opcion[]>([]);

  // Loading por sección
  const [loadingCarreras, setLoadingCarreras] = useState(false);
  const [loadingPlanes,   setLoadingPlanes]   = useState(false);
  const [loadingMaterias, setLoadingMaterias] = useState(false);

  async function get<T>(url: string): Promise<T> {
    const r = await apiFetch(`${API}${url}`);
    if (!r.ok) throw new Error(`Error ${r.status}`);
    return r.json();
  }

  // Carga inicial: facultades, docentes, tablas maestras
  useEffect(() => {
    Promise.all([
      get<Opcion[]>('/facultades?estado=ACTIVO'),
      get<any>('/docentes?activo=true&limite=500'),
      get<Opcion[]>('/configuracion/tablas-maestras/catedras/activos'),
      get<Opcion[]>('/configuracion/tablas-maestras/cargos/activos'),
      get<Opcion[]>('/configuracion/tablas-maestras/modalidades/activos'),
      get<Opcion[]>('/configuracion/tablas-maestras/designaciones/activos'),
    ]).then(([facs, docs, cats, cars, mods, desig]) => {
      setFacultades(facs);
      setDocentes(Array.isArray(docs) ? docs : (docs?.data ?? []));
      setCatedras(cats);
      setCargos(cars);
      setModalidades(mods);
      setDesignaciones(desig);
    }).catch(() => {});
  }, []);

  // Cascade: facultad → carreras
  useEffect(() => {
    if (!form.facultadId) { setCarreras([]); return; }
    setLoadingCarreras(true);
    get<Opcion[]>(`/carreras?facultadId=${form.facultadId}&estado=ACTIVO`)
      .then(setCarreras).catch(() => setCarreras([]))
      .finally(() => setLoadingCarreras(false));
  }, [form.facultadId]);

  // Cascade: carrera → planes
  useEffect(() => {
    if (!form.carreraId) { setPlanes([]); return; }
    setLoadingPlanes(true);
    get<Opcion[]>(`/plan-estudios?carreraId=${form.carreraId}`)
      .then(data => setPlanes(data.filter((p: any) => p.estado === 'ACTIVO')))
      .catch(() => setPlanes([]))
      .finally(() => setLoadingPlanes(false));
  }, [form.carreraId]);

  // Cascade: plan → materias
  useEffect(() => {
    if (!form.planEstudioId) { setMaterias([]); return; }
    setLoadingMaterias(true);
    get<Opcion[]>(`/materias?planEstudioId=${form.planEstudioId}`)
      .then(data => setMaterias(data.filter((m: any) => m.estado === 'ACTIVO')))
      .catch(() => setMaterias([]))
      .finally(() => setLoadingMaterias(false));
  }, [form.planEstudioId]);

  // Auto-fill horasSemana cuando cambia la materia seleccionada
  useEffect(() => {
    if (!form.materiaId) { setHorasSemana(undefined); return; }
    const materia = materias.find(m => m.id === form.materiaId);
    if (!materia) { setHorasSemana(undefined); return; }
    const hs = materia.cargaHorariaSemanal;
    setHorasSemana(typeof hs === 'number' ? hs : null);
  }, [form.materiaId, materias]);

  function set(field: keyof FormState, value: string) {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'facultadId')    { next.carreraId = ''; next.planEstudioId = ''; next.materiaId = ''; }
      if (field === 'carreraId')     { next.planEstudioId = ''; next.materiaId = ''; }
      if (field === 'planEstudioId') { next.materiaId = ''; }
      return next;
    });
    if (field === 'anioInicio') setAnioError(null);
  }

  const horasSemanaOk = horasSemana !== null && horasSemana !== undefined && horasSemana > 0;

  const completo =
    ['facultadId','carreraId','planEstudioId','materiaId','docenteId',
     'catedraId','cargoId','modalidadId','designacionId'].every(k => (form as any)[k] !== '') &&
    horasSemanaOk &&
    validarAnio(form.anioInicio) === null;

  async function guardar() {
    const errAnio = validarAnio(form.anioInicio);
    if (errAnio) { setAnioError(errAnio); return; }
    if (!completo) {
      if (!horasSemanaOk) {
        setError('La asignatura seleccionada no tiene carga horaria semanal definida. Actualizá la asignatura en la Estructura Curricular antes de continuar.');
      } else {
        setError('Completá todos los campos obligatorios antes de guardar.');
      }
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        facultadId:    form.facultadId,
        carreraId:     form.carreraId,
        planEstudioId: form.planEstudioId,
        materiaId:     form.materiaId,
        docenteId:     form.docenteId,
        catedraId:     form.catedraId,
        cargoId:       form.cargoId,
        modalidadId:   form.modalidadId,
        designacionId: form.designacionId,
        anioInicio:    parseInt(form.anioInicio, 10),
        observaciones: form.observaciones || undefined,
      };
      const r = await apiFetch(`${API}/vinculaciones-catedra`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        const msg = data?.message;
        throw new Error(
          Array.isArray(msg)
            ? msg.join(' · ')
            : (typeof msg === 'string' && msg
              ? msg
              : `Error ${r.status}: no se pudo guardar la vinculación.`)
        );
      }
      onGuardado();
    } catch (e) {
      setError((e as Error).message ?? 'Error inesperado al guardar. Intentá nuevamente.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
      onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}
    >
      <div className="flex flex-col w-full max-w-2xl max-h-[92vh] bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-800">Nueva Vinculación a Cátedra</h2>
            <p className="text-xs text-slate-500 mt-0.5">Todos los campos marcados con * son obligatorios</p>
          </div>
          <button onClick={onCerrar} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <IcClose />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          <Separador label="Datos académicos" />

          {/* Facultad */}
          <Campo label="Facultad" requerido>
            <select value={form.facultadId} onChange={e => set('facultadId', e.target.value)} className={SEL_CLS(facultades.length === 0)}>
              <option value="">Seleccionar facultad…</option>
              {facultades.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
            </select>
          </Campo>

          {/* Carrera */}
          <Campo label="Carrera" requerido>
            <div className="relative">
              <select
                value={form.carreraId}
                onChange={e => set('carreraId', e.target.value)}
                disabled={!form.facultadId || loadingCarreras}
                className={SEL_CLS(!form.facultadId || loadingCarreras)}
              >
                <option value="">{!form.facultadId ? 'Primero seleccioná una facultad' : 'Seleccionar carrera…'}</option>
                {carreras.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              {loadingCarreras && <span className="absolute right-3 top-1/2 -translate-y-1/2"><IcSpinner /></span>}
            </div>
          </Campo>

          {/* Plan */}
          <Campo label="Plan de Estudio" requerido>
            <div className="relative">
              <select
                value={form.planEstudioId}
                onChange={e => set('planEstudioId', e.target.value)}
                disabled={!form.carreraId || loadingPlanes}
                className={SEL_CLS(!form.carreraId || loadingPlanes)}
              >
                <option value="">{!form.carreraId ? 'Primero seleccioná una carrera' : 'Seleccionar plan…'}</option>
                {planes.map(p => <option key={p.id} value={p.id}>{p.nombre}{p.codigo ? ` (${p.codigo})` : ''}</option>)}
              </select>
              {loadingPlanes && <span className="absolute right-3 top-1/2 -translate-y-1/2"><IcSpinner /></span>}
            </div>
          </Campo>

          {/* Asignatura */}
          <Campo label="Asignatura" requerido>
            <div className="relative">
              <select
                value={form.materiaId}
                onChange={e => set('materiaId', e.target.value)}
                disabled={!form.planEstudioId || loadingMaterias}
                className={SEL_CLS(!form.planEstudioId || loadingMaterias)}
              >
                <option value="">{!form.planEstudioId ? 'Primero seleccioná un plan' : 'Seleccionar asignatura…'}</option>
                {materias.map(m => <option key={m.id} value={m.id}>{m.nombre}{m.codigo ? ` — ${m.codigo}` : ''}</option>)}
              </select>
              {loadingMaterias && <span className="absolute right-3 top-1/2 -translate-y-1/2"><IcSpinner /></span>}
            </div>
          </Campo>

          {/* Horas Semanales (solo lectura) */}
          {form.materiaId && (
            <Campo label="Horas Semanales (H/SEM)">
              {horasSemana === undefined ? (
                <div className="w-full rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-400">
                  Cargando…
                </div>
              ) : horasSemana === null || horasSemana === 0 ? (
                <div className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="font-medium">Sin carga horaria semanal definida</span>
                  <span className="text-xs text-amber-600 ml-auto">No se puede guardar</span>
                </div>
              ) : (
                <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#0f4c81] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-semibold text-slate-800">{horasSemana}</span>
                  <span className="text-slate-500">h/sem</span>
                  <span className="ml-auto text-[10px] text-slate-400 italic">Completado automáticamente · Solo lectura</span>
                </div>
              )}
            </Campo>
          )}

          <Separador label="Docente" />

          <Campo label="Docente" requerido>
            <select value={form.docenteId} onChange={e => set('docenteId', e.target.value)} className={SEL_CLS(docentes.length === 0)}>
              <option value="">Seleccionar docente…</option>
              {docentes.map(d => (
                <option key={d.id} value={d.id}>{d.apellido}, {d.nombre}</option>
              ))}
            </select>
          </Campo>

          <Separador label="Datos de cátedra" />

          <div className="grid grid-cols-2 gap-4">
            <Campo label="Cátedra" requerido>
              <select value={form.catedraId} onChange={e => set('catedraId', e.target.value)} className={SEL_CLS(false)}>
                <option value="">Seleccionar…</option>
                {catedras.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Campo>
            <Campo label="Cargo" requerido>
              <select value={form.cargoId} onChange={e => set('cargoId', e.target.value)} className={SEL_CLS(false)}>
                <option value="">Seleccionar…</option>
                {cargos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Campo>
            <Campo label="Modalidad" requerido>
              <select value={form.modalidadId} onChange={e => set('modalidadId', e.target.value)} className={SEL_CLS(false)}>
                <option value="">Seleccionar…</option>
                {modalidades.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </Campo>
            <Campo label="Designación" requerido>
              <select value={form.designacionId} onChange={e => set('designacionId', e.target.value)} className={SEL_CLS(false)}>
                <option value="">Seleccionar…</option>
                {designaciones.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
            </Campo>
          </div>

          <Separador label="Período" />

          {/* Año Inicio */}
          <Campo label="Año Inicio" requerido>
            <input
              type="text"
              inputMode="numeric"
              value={form.anioInicio}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                set('anioInicio', v);
              }}
              onBlur={() => setAnioError(validarAnio(form.anioInicio))}
              maxLength={4}
              placeholder="Ej: 2026"
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition bg-white ${
                anioError
                  ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-400/15'
                  : 'border-slate-200 focus:border-[#0f4c81] focus:ring-2 focus:ring-[#0f4c81]/15'
              } text-slate-800`}
            />
            {anioError && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01" />
                  <circle cx="12" cy="12" r="9" strokeWidth={2} />
                </svg>
                {anioError}
              </p>
            )}
          </Campo>

          <Separador label="Observaciones" />

          <Campo label="Observaciones">
            <textarea
              value={form.observaciones}
              onChange={e => set('observaciones', e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Información adicional (opcional)…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0f4c81] focus:ring-2 focus:ring-[#0f4c81]/15 transition resize-none"
            />
          </Campo>

          {/* Estado informativo */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-xs text-amber-700">
              La vinculación se creará con estado <strong>Pendiente de Aprobación</strong> y quedará en espera de revisión.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0 bg-slate-50/60">
          <button
            onClick={onCerrar}
            className="px-4 py-2 text-sm font-semibold border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={!completo || submitting}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-[#0f4c81] text-white rounded-xl hover:bg-[#0d3e6b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting && <IcSpinner />}
            {submitting ? 'Guardando…' : 'Guardar vinculación'}
          </button>
        </div>
      </div>
    </div>
  );
}
