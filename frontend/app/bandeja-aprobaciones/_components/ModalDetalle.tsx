'use client';

interface Vinculacion {
  id: string;
  estado: string;
  observaciones?: string;
  fechaCreacion: string;
  fechaAprobacion?: string;
  motivoRechazo?: string;
  horasSemana?: number | null;
  anioInicio?: number | null;
  facultad:    { nombre: string };
  carrera:     { nombre: string };
  planEstudio: { nombre: string; codigo?: string };
  materia:     { nombre: string; codigo?: string };
  docente:     { nombre: string; apellido: string };
  catedra:     { nombre: string };
  cargo:       { nombre: string };
  modalidad:   { nombre: string };
  designacion: { nombre: string };
  usuarioSolicitante: { nombre: string; apellido: string };
  aprobador?: { nombre: string; apellido: string } | null;
}

interface Props {
  vinculacion: Vinculacion;
  onCerrar: () => void;
}

function Fila({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm text-slate-700 font-medium">{value || '—'}</p>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">{titulo}</span>
        <div className="flex-1 h-px bg-slate-100" />
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">{children}</div>
    </div>
  );
}

function badgeEstado(estado: string) {
  const map: Record<string, string> = {
    PENDIENTE_DE_APROBACION: 'bg-amber-50 text-amber-700 border-amber-200',
    APROBADA:                'bg-emerald-50 text-emerald-700 border-emerald-200',
    RECHAZADA:               'bg-red-50 text-red-700 border-red-200',
    INACTIVA:                'bg-slate-100 text-slate-500 border-slate-200',
  };
  const labels: Record<string, string> = {
    PENDIENTE_DE_APROBACION: 'Pendiente de Aprobación',
    APROBADA:                'Aprobada',
    RECHAZADA:               'Rechazada',
    INACTIVA:                'Inactiva',
  };
  const cls = map[estado] ?? 'bg-slate-100 text-slate-500 border-slate-200';
  return (
    <span className={`inline-flex text-xs font-bold px-3 py-1 rounded-full border ${cls}`}>
      {labels[estado] ?? estado}
    </span>
  );
}

function formatFecha(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function ModalDetalle({ vinculacion: v, onCerrar }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
      onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-800">Detalle de Vinculación</h2>
            <div className="mt-1">{badgeEstado(v.estado)}</div>
          </div>
          <button
            onClick={onCerrar}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          <Seccion titulo="Datos académicos">
            <Fila label="Facultad"  value={v.facultad.nombre} />
            <Fila label="Carrera"   value={v.carrera.nombre} />
            <Fila label="Plan"      value={`${v.planEstudio.nombre}${v.planEstudio.codigo ? ` (${v.planEstudio.codigo})` : ''}`} />
            <Fila label="Asignatura" value={`${v.materia.nombre}${v.materia.codigo ? ` — ${v.materia.codigo}` : ''}`} />
          </Seccion>

          <Seccion titulo="Docente">
            <Fila label="Apellido y nombre" value={`${v.docente.apellido}, ${v.docente.nombre}`} />
          </Seccion>

          <Seccion titulo="Datos de cátedra">
            <Fila label="Cátedra"     value={v.catedra.nombre} />
            <Fila label="Cargo"       value={v.cargo.nombre} />
            <Fila label="Modalidad"   value={v.modalidad.nombre} />
            <Fila label="Designación" value={v.designacion.nombre} />
            <Fila
              label="H/SEM (Carga horaria semanal)"
              value={v.horasSemana != null ? `${v.horasSemana} h/sem` : 'Sin carga horaria semanal definida'}
            />
            <Fila label="Año Inicio"  value={v.anioInicio?.toString() ?? '—'} />
          </Seccion>

          {v.observaciones && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Observaciones</p>
              <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">{v.observaciones}</p>
            </div>
          )}

          {/* Trazabilidad */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Trazabilidad</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            <div className="space-y-3">
              {/* Solicitud */}
              <div className="flex items-start gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-700">Solicitud creada</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {v.usuarioSolicitante.apellido}, {v.usuarioSolicitante.nombre} · {formatFecha(v.fechaCreacion)}
                  </p>
                </div>
              </div>

              {/* Resolución (si existe) */}
              {v.aprobador && v.fechaAprobacion && (
                <div className={`flex items-start gap-3 rounded-xl px-4 py-3 border ${
                  v.estado === 'APROBADA'
                    ? 'bg-emerald-50 border-emerald-100'
                    : 'bg-red-50 border-red-100'
                }`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    v.estado === 'APROBADA' ? 'bg-emerald-100' : 'bg-red-100'
                  }`}>
                    {v.estado === 'APROBADA' ? (
                      <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${v.estado === 'APROBADA' ? 'text-emerald-700' : 'text-red-700'}`}>
                      {v.estado === 'APROBADA' ? 'Aprobada' : 'Rechazada'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {v.aprobador.apellido}, {v.aprobador.nombre} · {formatFecha(v.fechaAprobacion)}
                    </p>
                    {v.motivoRechazo && (
                      <p className="text-xs text-red-600 mt-1.5 bg-red-50 border border-red-100 rounded-lg px-2 py-1.5">
                        <strong>Motivo:</strong> {v.motivoRechazo}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0 bg-slate-50/60">
          <button
            onClick={onCerrar}
            className="px-5 py-2 text-sm font-semibold border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
