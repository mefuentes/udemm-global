'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

// ── Tipos ────────────────────────────────────────────────────────────────────

interface CargoParsed {
  id: string;
  cargoNombre: string;
  designacion: string | null;
  fechaInicio: string;
  fechaFin: string | null;
  vigente: boolean;
  verificado: boolean;
  fuente: string;
}

interface VinculacionParsed {
  id: string;
  materiaId: string;
  materiaNombre: string;
  carreraId: string;
  carreraNombre: string;
  planEstudioId: string;
  planEstudioNombre: string;
  facultadId: string;
  facultadNombre: string;
  estado: string;
  esResponsableCatedra: boolean | null;
  horasSemana: number | null;
  anioInicio: number | null;
}

interface AlertaItem {
  ejecucionId: string;
  ambito: string;
  entidadId: string;
  regla: string;
  prioridad: 'ALTA' | 'MEDIA' | 'INFORMATIVA';
  descripcion: string;
  fechaEjecucion: string;
}

interface CompletitudFicha {
  tieneFormacionBasica: boolean;
  tienePosgrado: boolean;
  tieneActividadInvestigacion: boolean;
  tieneDedicacion: boolean;
  porcentaje: number;
}

interface FichaDocenteDto {
  identificacion: {
    id: string;
    nombre: string;
    apellido: string;
    nombreCompleto: string;
    tipoDocumento: string;
    numeroDocumento: string;
    correoElectronico: string;
    activo: boolean;
    dedicacion: string | null;
    categoriaDocente: string | null;
    tituloGrado: string | null;
    tituloPosgrado: string | null;
    relevamientoCargosCompleto: boolean;
  };
  formacionAcademica: {
    tituloGrado: string | null;
    tituloPosgrado: string | null;
    otrosTitulos: string | null;
    actividadesPosgradoJson: string | null;
  };
  actividadesInvestigacion: {
    tituloProyectoInvestigacion: string | null;
    proyectosInvestigacionJson: string | null;
    produccionCientificaJson: string | null;
  };
  cargosInstitucionales: CargoParsed[];
  vinculaciones: VinculacionParsed[];
  alertasEnScope: AlertaItem[];
  completitud: CompletitudFicha;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch { return iso; }
}

function prioridadCls(p: string): string {
  if (p === 'ALTA')       return 'bg-red-50 text-red-700 border-red-200';
  if (p === 'MEDIA')      return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-sky-50 text-sky-700 border-sky-200';
}

function estadoVinCls(e: string): string {
  if (e === 'APROBADA')               return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (e === 'PENDIENTE_DE_APROBACION') return 'text-amber-700 bg-amber-50 border-amber-200';
  if (e === 'RECHAZADA')              return 'text-red-700 bg-red-50 border-red-200';
  return 'text-slate-600 bg-slate-100 border-slate-200';
}

const IcSpinner = () => (
  <span className="inline-block w-5 h-5 rounded-full border-2 border-slate-300 border-t-[#0f4c81] animate-spin flex-shrink-0" />
);

// ── Sub-componentes ──────────────────────────────────────────────────────────

function SeccionTitulo({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-bold text-[#0f4c81] uppercase tracking-wide mb-3 flex items-center gap-2 after:flex-1 after:h-px after:bg-[#0f4c81]/10">
      {children}
    </h2>
  );
}

function CampoLabel({ label, valor }: { label: string; valor: string | null | boolean | undefined }) {
  if (valor === undefined || valor === null || valor === '') return null;
  const display = typeof valor === 'boolean' ? (valor ? 'Sí' : 'No') : String(valor);
  return (
    <div className="flex gap-1 flex-col">
      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-slate-800">{display}</span>
    </div>
  );
}

function BadgeCompletitud({ pct }: { pct: number }) {
  const color = pct >= 75 ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : pct >= 50             ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-red-700 bg-red-50 border-red-200';
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${color}`}>
      Completitud {pct}%
    </span>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function FichaDocentePage() {
  const { docenteId } = useParams<{ docenteId: string }>();
  const router = useRouter();
  const [ficha, setFicha] = useState<FichaDocenteDto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!docenteId) return;
    let activo = true;
    setCargando(true);
    setError(null);
    apiFetch(`/autoevaluacion/docentes/${docenteId}/ficha`)
      .then(async r => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(data?.message ?? `Error ${r.status}`);
        return data;
      })
      .then(d => { if (activo) setFicha(d); })
      .catch(e => { if (activo) setError((e as Error).message ?? 'Error al cargar la ficha'); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [docenteId]);

  if (cargando) {
    return (
      <div className="flex items-center justify-center min-h-[200px] gap-2 text-slate-500 text-sm">
        <IcSpinner /> Cargando ficha docente…
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-8 p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
        <strong>Error:</strong> {error}
        <div className="mt-2">
          <button
            onClick={() => router.back()}
            className="text-xs underline text-red-600 hover:text-red-800"
          >
            ← Volver
          </button>
        </div>
      </div>
    );
  }

  if (!ficha) return null;

  const { identificacion: id, formacionAcademica, actividadesInvestigacion,
    cargosInstitucionales, vinculaciones, alertasEnScope, completitud } = ficha;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

      {/* Cabecera */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button
            onClick={() => router.back()}
            className="text-xs text-slate-500 hover:text-[#0f4c81] mb-1 flex items-center gap-1"
          >
            ← Volver
          </button>
          <h1 className="text-xl font-bold text-slate-900">{id.nombreCompleto}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{id.tipoDocumento} {id.numeroDocumento}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <BadgeCompletitud pct={completitud.porcentaje} />
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
            id.activo
              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
              : 'text-slate-600 bg-slate-100 border-slate-200'
          }`}>
            {id.activo ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      </div>

      {/* Identificación */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <SeccionTitulo>Identificación</SeccionTitulo>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
          <CampoLabel label="Correo electrónico" valor={id.correoElectronico} />
          <CampoLabel label="Dedicación" valor={id.dedicacion} />
          <CampoLabel label="Categoría docente" valor={id.categoriaDocente} />
          <CampoLabel label="Título de grado" valor={id.tituloGrado} />
          <CampoLabel label="Título de posgrado" valor={id.tituloPosgrado} />
          <CampoLabel label="Relevamiento de cargos completo" valor={id.relevamientoCargosCompleto} />
        </div>
      </section>

      {/* Completitud */}
      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <SeccionTitulo>Estado de completitud de la ficha</SeccionTitulo>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Formación básica',    ok: completitud.tieneFormacionBasica },
            { label: 'Posgrado',            ok: completitud.tienePosgrado },
            { label: 'Investigación',       ok: completitud.tieneActividadInvestigacion },
            { label: 'Dedicación declarada', ok: completitud.tieneDedicacion },
          ].map(item => (
            <div key={item.label} className={`rounded-lg border px-3 py-2 text-center text-xs font-medium ${
              item.ok
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-slate-50 border-slate-200 text-slate-400'
            }`}>
              {item.ok ? '✓' : '—'} {item.label}
            </div>
          ))}
        </div>
      </section>

      {/* Formación académica */}
      {(formacionAcademica.tituloGrado || formacionAcademica.tituloPosgrado || formacionAcademica.otrosTitulos) && (
        <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <SeccionTitulo>Formación académica</SeccionTitulo>
          <div className="grid grid-cols-1 gap-y-3 sm:grid-cols-2">
            <CampoLabel label="Título de grado" valor={formacionAcademica.tituloGrado} />
            <CampoLabel label="Título de posgrado" valor={formacionAcademica.tituloPosgrado} />
            <CampoLabel label="Otros títulos" valor={formacionAcademica.otrosTitulos} />
          </div>
        </section>
      )}

      {/* Actividades de investigación */}
      {(actividadesInvestigacion.tituloProyectoInvestigacion || actividadesInvestigacion.proyectosInvestigacionJson) && (
        <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <SeccionTitulo>Actividades de investigación</SeccionTitulo>
          <CampoLabel
            label="Proyecto de investigación"
            valor={actividadesInvestigacion.tituloProyectoInvestigacion}
          />
          {actividadesInvestigacion.proyectosInvestigacionJson && (
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">
                Proyectos (JSON)
              </span>
              <pre className="text-xs bg-slate-50 border border-slate-200 rounded p-3 overflow-x-auto whitespace-pre-wrap text-slate-700">
                {actividadesInvestigacion.proyectosInvestigacionJson}
              </pre>
            </div>
          )}
        </section>
      )}

      {/* Cargos institucionales */}
      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <SeccionTitulo>
          Cargos institucionales ({cargosInstitucionales.length})
        </SeccionTitulo>
        {cargosInstitucionales.length === 0 ? (
          <p className="text-sm text-slate-400 italic">Sin cargos institucionales registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs text-slate-500 font-semibold border-b border-slate-200">
                  <th className="pb-2 pr-4">Cargo</th>
                  <th className="pb-2 pr-4">Designación</th>
                  <th className="pb-2 pr-4">Desde</th>
                  <th className="pb-2 pr-4">Hasta</th>
                  <th className="pb-2 pr-4">Vigente</th>
                  <th className="pb-2">Verificado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cargosInstitucionales.map(c => (
                  <tr key={c.id} className="text-slate-700">
                    <td className="py-2 pr-4 font-medium">{c.cargoNombre}</td>
                    <td className="py-2 pr-4 text-slate-500">{c.designacion ?? '—'}</td>
                    <td className="py-2 pr-4">{fmtFecha(c.fechaInicio)}</td>
                    <td className="py-2 pr-4">{c.fechaFin ? fmtFecha(c.fechaFin) : '—'}</td>
                    <td className="py-2 pr-4">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                        c.vigente
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {c.vigente ? 'Vigente' : 'Histórico'}
                      </span>
                    </td>
                    <td className="py-2">{c.verificado ? 'Sí' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Vinculaciones */}
      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <SeccionTitulo>
          Vinculaciones cátedra ({vinculaciones.length})
        </SeccionTitulo>
        {vinculaciones.length === 0 ? (
          <p className="text-sm text-slate-400 italic">Sin vinculaciones registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs text-slate-500 font-semibold border-b border-slate-200">
                  <th className="pb-2 pr-4">Materia</th>
                  <th className="pb-2 pr-4">Carrera</th>
                  <th className="pb-2 pr-4">Plan</th>
                  <th className="pb-2 pr-4">Estado</th>
                  <th className="pb-2 pr-4">Resp.</th>
                  <th className="pb-2">Hs/sem.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vinculaciones.map(v => (
                  <tr key={v.id} className="text-slate-700">
                    <td className="py-2 pr-4 font-medium text-xs">{v.materiaNombre}</td>
                    <td className="py-2 pr-4 text-xs text-slate-600">{v.carreraNombre}</td>
                    <td className="py-2 pr-4 text-xs text-slate-500">{v.planEstudioNombre}</td>
                    <td className="py-2 pr-4">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${estadoVinCls(v.estado)}`}>
                        {v.estado.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-xs">
                      {v.esResponsableCatedra === true ? 'Sí' : v.esResponsableCatedra === false ? 'No' : '—'}
                    </td>
                    <td className="py-2 text-xs">{v.horasSemana ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Alertas en scope */}
      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <SeccionTitulo>
          Alertas en el ámbito del docente ({alertasEnScope.length})
        </SeccionTitulo>
        {alertasEnScope.length === 0 ? (
          <p className="text-sm text-slate-400 italic">Sin alertas vigentes en el ámbito de este docente.</p>
        ) : (
          <ul className="space-y-2">
            {alertasEnScope.map((a, i) => (
              <li
                key={`${a.ejecucionId}-${a.regla}-${i}`}
                className={`flex items-start gap-3 px-4 py-3 rounded-lg border text-sm ${prioridadCls(a.prioridad)}`}
              >
                <span className="font-bold font-mono text-xs mt-0.5 shrink-0 w-14">{a.regla}</span>
                <span className="flex-1">{a.descripcion}</span>
                <span className="text-[10px] shrink-0 opacity-60">{a.ambito} · {fmtFecha(a.fechaEjecucion)}</span>
              </li>
            ))}
          </ul>
        )}
        {alertasEnScope.length > 0 && (
          <p className="text-[10px] text-slate-400 mt-3 italic">
            Las alertas corresponden al ámbito académico donde este docente tiene vinculaciones activas.
            No son alertas individuales del docente.
          </p>
        )}
      </section>

    </div>
  );
}
