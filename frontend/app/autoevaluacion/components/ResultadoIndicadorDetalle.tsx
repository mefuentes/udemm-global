// Presentación específica por indicador — sin hooks propios.
// Importado exclusivamente desde componentes cliente.

import type { ReactNode } from 'react';

// ── Interfaz mínima requerida del componente padre ─────────────────────────

export interface ResultadoBase {
  codigo: string;
  estadoCalculo: string | null;
  estadoImplementacion: string;
  valor: unknown;
  unidad?: string;
}

// ── Tipos de valor por indicador ───────────────────────────────────────────
// Reflejan con fidelidad las interfaces de los evaluadores del backend.
// Solo se agregan campos necesarios para la presentación.

interface AlertaR02 {
  materiaId: string;
  materiaNombre: string;
  materiaCodigo: string;
  catedraId: string;
  cantidadResponsables: number;
}

interface ParIncierto02 {
  materiaId: string;
  materiaNombre: string;
  materiaCodigo: string;
  catedraId: string;
  confirmedTrue: number;
  sinClasificar: number;
}

interface ValorR02 {
  paresConAlerta: AlertaR02[];
  paresInciertos: ParIncierto02[];
  totalMaterias: number;
}

interface DocenteR06 {
  docenteId: string;
  nombre: string;
  nMaterias: number;
}

interface ValorR06 {
  carreraId: string;
  totalDocentes: number;
  promedio: number | null;
  mediana: number | null;
  maximo: number | null;
  distribucion: DocenteR06[];
}

interface AsignacionR07 {
  planEstudioId: string;
  materiaId: string;
  catedraId: string;
  materiaNombre?: string;
}

interface DocenteAlertaR07 {
  docenteId: string;
  nombre: string;
  nMaterias: number;
  exceso: number;
  asignaciones: AsignacionR07[];
}

interface DocenteNoDeterminableR07 {
  docenteId: string;
  nombre: string;
  nMateriasConocidas: number;
  causa: string;
}

interface ValorR07 {
  carreraId: string;
  facultadId: string;
  limite: number | null;
  totalDocentes: number;
  totalSobreasignados: number;
  sobreasignados: DocenteAlertaR07[];
  totalNoDeterminables: number;
  noDeterminables: DocenteNoDeterminableR07[];
  alcanceFacultad: boolean;
}

interface AlertaMateriaR08 {
  materiaId: string;
  nombre: string;
  codigo: string;
  tieneVinculacionesAprobadas: boolean;
}

interface ValorR08 {
  materiasConAlerta: AlertaMateriaR08[];
  materiasInciertas: AlertaMateriaR08[];
  totalMaterias: number;
  totalConResponsable: number;
}

interface EvaluacionDimension {
  horasReales: number | null;
  horasMinimas: number | null;
  diferencia: number | null;
  cumple: boolean | null;
}

interface MateriaR09 {
  materiaId: string;
  nombre: string;
  codigo: string;
  bloqueConocimientoRaw?: string | null;
}

interface ValorR09 {
  planEstudioId: string;
  totalMaterias: number;
  materiasSinHoras: MateriaR09[];
  materiasConBloqueIndeterminado: MateriaR09[];
  horasTotal: number | null;
  horasPorBloque: { CB: number | null; TB: number | null; TA: number | null; CX: number | null };
  evaluaciones: {
    total: EvaluacionDimension;
    CB: EvaluacionDimension;
    TB: EvaluacionDimension;
    TA: EvaluacionDimension;
    CX: EvaluacionDimension;
  };
}

// ── Helpers de formato ────────────────────────────────────────────────────

function numVal(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : String(v);
}

function numDec(v: number | null | undefined, d: number): string {
  if (v === null || v === undefined) return '—';
  return v.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

// ── Componentes de presentación compartidos ────────────────────────────────

function Metrica({
  label,
  valor,
  destaca = false,
}: {
  label: string;
  valor: string | number;
  destaca?: boolean;
}) {
  return (
    <div
      className={`rounded-lg px-3 py-2 border text-center ${
        destaca ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5 leading-tight">
        {label}
      </p>
      <p className={`text-sm font-bold tabular-nums ${destaca ? 'text-red-700' : 'text-slate-700'}`}>
        {valor}
      </p>
    </div>
  );
}

function SeccionTitulo({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${className ?? 'text-slate-400'}`}>
      {children}
    </p>
  );
}

function TablaWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  );
}

// ── R-02: Doble responsable de cátedra ────────────────────────────────────

function DetalleR02({
  valor,
  estadoCalculo,
}: {
  valor: unknown;
  estadoCalculo: string | null;
}) {
  if (estadoCalculo === 'NO_APLICA') {
    return (
      <p className="text-xs text-sky-600">
        El plan no tiene materias registradas. No aplica la evaluación de doble responsable de cátedra.
      </p>
    );
  }

  if (!valor || typeof valor !== 'object') return <FallbackDetalle valor={valor} />;
  const v = valor as ValorR02;
  const paresConAlerta = v.paresConAlerta ?? [];
  const paresInciertos = v.paresInciertos ?? [];
  const totalMaterias = v.totalMaterias ?? 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Metrica label="Materias evaluadas" valor={totalMaterias} />
        <Metrica
          label="Pares con alerta"
          valor={paresConAlerta.length}
          destaca={paresConAlerta.length > 0}
        />
        <Metrica
          label="Pares inciertos"
          valor={paresInciertos.length}
          destaca={paresInciertos.length > 0}
        />
      </div>

      {paresConAlerta.length === 0 && paresInciertos.length === 0 && (
        <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
          <span className="text-emerald-500">✓</span>
          Sin pares (materia, cátedra) con doble responsable confirmado o incierto.
        </p>
      )}

      {paresConAlerta.length > 0 && (
        <div>
          <SeccionTitulo className="text-red-600">
            Doble responsable confirmado ({paresConAlerta.length})
          </SeccionTitulo>
          <TablaWrapper>
            <thead>
              <tr className="bg-red-50 border-b border-red-200">
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-red-700">Materia</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-24">Código</th>
                <th className="text-center px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-28">Responsables</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-100">
              {paresConAlerta.map((p, i) => (
                <tr key={i} className="hover:bg-red-50/40">
                  <td className="px-3 py-1.5 text-slate-700">{p.materiaNombre}</td>
                  <td className="px-3 py-1.5 font-mono text-slate-500">{p.materiaCodigo}</td>
                  <td className="px-3 py-1.5 text-center font-bold text-red-700">{p.cantidadResponsables}</td>
                </tr>
              ))}
            </tbody>
          </TablaWrapper>
        </div>
      )}

      {paresInciertos.length > 0 && (
        <div>
          <SeccionTitulo className="text-amber-600">
            Pares con datos insuficientes — posible doble responsable ({paresInciertos.length})
          </SeccionTitulo>
          <p className="text-[11px] text-slate-500 mb-1.5">
            Tienen vinculaciones APROBADAS con <span className="font-mono">esResponsableCatedra</span> sin clasificar.
            No puede confirmarse la ausencia de doble responsable.
          </p>
          <TablaWrapper>
            <thead>
              <tr className="bg-amber-50 border-b border-amber-200">
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-amber-700">Materia</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-amber-700 w-24">Código</th>
                <th className="text-center px-3 py-2 text-[10px] font-semibold uppercase text-amber-700 w-24">Confirmados</th>
                <th className="text-center px-3 py-2 text-[10px] font-semibold uppercase text-amber-700 w-28">Sin clasificar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100">
              {paresInciertos.map((p, i) => (
                <tr key={i} className="hover:bg-amber-50/40">
                  <td className="px-3 py-1.5 text-slate-700">{p.materiaNombre}</td>
                  <td className="px-3 py-1.5 font-mono text-slate-500">{p.materiaCodigo}</td>
                  <td className="px-3 py-1.5 text-center text-slate-600 tabular-nums">{p.confirmedTrue}</td>
                  <td className="px-3 py-1.5 text-center font-semibold text-amber-700 tabular-nums">{p.sinClasificar}</td>
                </tr>
              ))}
            </tbody>
          </TablaWrapper>
        </div>
      )}
    </div>
  );
}

// ── R-06: Distribución de materias por docente ────────────────────────────

function DetalleR06({
  valor,
  estadoCalculo,
}: {
  valor: unknown;
  estadoCalculo: string | null;
}) {
  if (estadoCalculo === 'NO_APLICA') {
    const v = valor as ValorR06 | null | undefined;
    return (
      <div className="space-y-2">
        <p className="text-xs text-sky-600">
          No se encontraron docentes con asignaciones computables para este indicador en la carrera
          seleccionada.
        </p>
        {v !== null && v !== undefined && (
          <div className="w-32">
            <Metrica label="Docentes computables" valor={v.totalDocentes ?? 0} />
          </div>
        )}
      </div>
    );
  }

  if (!valor || typeof valor !== 'object') return <FallbackDetalle valor={valor} />;
  const v = valor as ValorR06;
  const distribucion = v.distribucion ?? [];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metrica label="Total docentes" valor={v.totalDocentes} />
        <Metrica label="Promedio" valor={numDec(v.promedio, 2)} />
        <Metrica label="Mediana" valor={numVal(v.mediana)} />
        <Metrica label="Máximo" valor={numVal(v.maximo)} />
      </div>

      {distribucion.length > 0 && (
        <div>
          <SeccionTitulo>Distribución por docente</SeccionTitulo>
          <TablaWrapper>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-slate-500">Docente</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase text-slate-500 w-36">
                  Materias asignadas
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {distribucion.map((d) => (
                <tr key={d.docenteId} className="hover:bg-slate-50/60">
                  <td className="px-3 py-1.5 text-slate-700">{d.nombre}</td>
                  <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-slate-700">
                    {d.nMaterias}
                  </td>
                </tr>
              ))}
            </tbody>
          </TablaWrapper>
          <p className="text-[10px] text-slate-400 mt-1">
            Materias distintas por docente — la misma materia en múltiples cátedras cuenta como una.
          </p>
        </div>
      )}
    </div>
  );
}

// ── R-07: Docentes sobre-asignados ────────────────────────────────────────

function DetalleR07({
  valor,
  estadoCalculo,
}: {
  valor: unknown;
  estadoCalculo: string | null;
}) {
  if (estadoCalculo === 'NO_APLICA') {
    return (
      <p className="text-xs text-sky-600">
        Sin vinculaciones docentes APROBADAS activas en el alcance evaluado.
      </p>
    );
  }

  if (!valor || typeof valor !== 'object') return <FallbackDetalle valor={valor} />;
  const v = valor as ValorR07;
  const sobreasignados = v.sobreasignados ?? [];
  const noDeterminables = v.noDeterminables ?? [];
  const limiteStr = v.limite !== null && v.limite !== undefined ? String(v.limite) : '—';

  return (
    <div className="space-y-3">
      {estadoCalculo === 'NO_DETERMINABLE' && (
        <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-600">
          La evaluación no puede completarse: la facultad de esta carrera no tiene el parámetro{' '}
          <span className="font-mono font-semibold">p03MaxMat</span> configurado en MOD-AUT.
          Sin ese umbral no es posible determinar sobreasignaciones.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metrica label="Total docentes" valor={v.totalDocentes} />
        <Metrica label="Límite (p03MaxMat)" valor={limiteStr} />
        <Metrica
          label="Sobreasignados"
          valor={v.totalSobreasignados}
          destaca={v.totalSobreasignados > 0}
        />
        <Metrica
          label="No determinables"
          valor={v.totalNoDeterminables}
          destaca={v.totalNoDeterminables > 0}
        />
      </div>

      {!v.alcanceFacultad && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Alcance parcial: la evaluación cubre únicamente la carrera solicitada.
          Los valores de materias por docente pueden estar subestimados.
        </p>
      )}

      {sobreasignados.length > 0 && (
        <div>
          <SeccionTitulo className="text-red-600">
            Docentes sobreasignados ({sobreasignados.length})
          </SeccionTitulo>
          <TablaWrapper>
            <thead>
              <tr className="bg-red-50 border-b border-red-200">
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-red-700">Docente</th>
                <th className="text-center px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-24">Materias</th>
                <th className="text-center px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-20">Exceso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-100">
              {sobreasignados.map((d) => (
                <tr key={d.docenteId} className="hover:bg-red-50/40">
                  <td className="px-3 py-1.5 text-slate-700">{d.nombre}</td>
                  <td className="px-3 py-1.5 text-center font-semibold tabular-nums text-slate-700">{d.nMaterias}</td>
                  <td className="px-3 py-1.5 text-center font-bold tabular-nums text-red-700">+{d.exceso}</td>
                </tr>
              ))}
            </tbody>
          </TablaWrapper>
        </div>
      )}

      {noDeterminables.length > 0 && (
        <div>
          <SeccionTitulo className="text-amber-600">
            Docentes no determinables ({noDeterminables.length})
          </SeccionTitulo>
          <p className="text-[11px] text-slate-500 mb-1.5">
            Tienen asignaciones APROBADAS en más de una facultad. No es posible aplicar un único{' '}
            <span className="font-mono">p03MaxMat</span> institucional.
          </p>
          <TablaWrapper>
            <thead>
              <tr className="bg-amber-50 border-b border-amber-200">
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-amber-700">Docente</th>
                <th className="text-center px-3 py-2 text-[10px] font-semibold uppercase text-amber-700 w-28">Mat. conocidas</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-amber-700 w-28">Causa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100">
              {noDeterminables.map((d) => (
                <tr key={d.docenteId} className="hover:bg-amber-50/40">
                  <td className="px-3 py-1.5 text-slate-700">{d.nombre}</td>
                  <td className="px-3 py-1.5 text-center tabular-nums text-slate-600">{d.nMateriasConocidas}</td>
                  <td className="px-3 py-1.5 font-mono text-[11px] text-amber-700">{d.causa}</td>
                </tr>
              ))}
            </tbody>
          </TablaWrapper>
        </div>
      )}

      {sobreasignados.length === 0 && noDeterminables.length === 0 && estadoCalculo === 'CALCULADO' && (
        <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
          <span className="text-emerald-500">✓</span>
          Sin docentes sobreasignados en el alcance evaluado.
        </p>
      )}
    </div>
  );
}

// ── R-08: Materias sin responsable de cátedra ─────────────────────────────

function DetalleR08({
  valor,
  estadoCalculo,
}: {
  valor: unknown;
  estadoCalculo: string | null;
}) {
  if (estadoCalculo === 'NO_APLICA') {
    return (
      <p className="text-xs text-sky-600">
        El plan no tiene materias registradas. No aplica la evaluación de responsables de cátedra.
      </p>
    );
  }

  if (!valor || typeof valor !== 'object') return <FallbackDetalle valor={valor} />;
  const v = valor as ValorR08;
  const materiasConAlerta = v.materiasConAlerta ?? [];
  const materiasInciertas = v.materiasInciertas ?? [];
  const totalMaterias = v.totalMaterias ?? 0;
  const totalConResponsable = v.totalConResponsable ?? 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metrica label="Materias evaluadas" valor={totalMaterias} />
        <Metrica label="Con responsable" valor={totalConResponsable} />
        <Metrica
          label="Sin responsable"
          valor={materiasConAlerta.length}
          destaca={materiasConAlerta.length > 0}
        />
        <Metrica
          label="Inciertas"
          valor={materiasInciertas.length}
          destaca={materiasInciertas.length > 0}
        />
      </div>

      {materiasConAlerta.length === 0 && materiasInciertas.length === 0 && (
        <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
          <span className="text-emerald-500">✓</span>
          Todas las materias del plan tienen responsable de cátedra confirmado.
        </p>
      )}

      {materiasConAlerta.length > 0 && (
        <div>
          <SeccionTitulo className="text-red-600">
            Sin responsable confirmado ({materiasConAlerta.length})
          </SeccionTitulo>
          <TablaWrapper>
            <thead>
              <tr className="bg-red-50 border-b border-red-200">
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-red-700">Materia</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-28">Código</th>
                <th className="text-center px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-32">Vinc. aprobadas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-100">
              {materiasConAlerta.map((m) => (
                <tr key={m.materiaId} className="hover:bg-red-50/40">
                  <td className="px-3 py-1.5 text-slate-700">{m.nombre}</td>
                  <td className="px-3 py-1.5 font-mono text-slate-500">{m.codigo}</td>
                  <td className="px-3 py-1.5 text-center text-slate-600">{m.tieneVinculacionesAprobadas ? 'Sí' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </TablaWrapper>
          <p className="text-[10px] text-slate-400 mt-1">
            &quot;Vinc. aprobadas: No&quot; — sin ninguna vinculación APROBADA para la materia.
            &quot;Sí&quot; — tiene vinculaciones pero ninguna con responsable confirmado.
          </p>
        </div>
      )}

      {materiasInciertas.length > 0 && (
        <div>
          <SeccionTitulo className="text-amber-600">
            Responsabilidad incierta ({materiasInciertas.length})
          </SeccionTitulo>
          <p className="text-[11px] text-slate-500 mb-1.5">
            Tienen vinculaciones APROBADAS con{' '}
            <span className="font-mono">esResponsableCatedra = null</span>. La ausencia de responsable
            no puede confirmarse.
          </p>
          <TablaWrapper>
            <thead>
              <tr className="bg-amber-50 border-b border-amber-200">
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-amber-700">Materia</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-amber-700 w-28">Código</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100">
              {materiasInciertas.map((m) => (
                <tr key={m.materiaId} className="hover:bg-amber-50/40">
                  <td className="px-3 py-1.5 text-slate-700">{m.nombre}</td>
                  <td className="px-3 py-1.5 font-mono text-slate-500">{m.codigo}</td>
                </tr>
              ))}
            </tbody>
          </TablaWrapper>
        </div>
      )}
    </div>
  );
}

// ── R-09: Control de umbrales horarios ────────────────────────────────────

// Fuente: consultas-academicas.types.ts — BloqueNormalizado comment
const BLOQUE_NOMBRE: Record<string, string> = {
  Total: 'Total del plan',
  CB: 'Ciencias Básicas (CB)',
  TB: 'Tecnologías Básicas (TB)',
  TA: 'Tecnologías Aplicadas (TA)',
  CX: 'Cs. y Tec. Complementarias (CX)',
};

function FilaDimension({ bloque, dim }: { bloque: string; dim: EvaluacionDimension }) {
  const { horasReales, horasMinimas, diferencia, cumple } = dim;
  const sinUmbral = horasMinimas === null;

  let evaluacionEl: ReactNode;
  if (sinUmbral) {
    evaluacionEl = <span className="text-slate-400 text-[11px]">Sin umbral configurado</span>;
  } else if (cumple === null) {
    evaluacionEl = <span className="text-slate-400">—</span>;
  } else if (cumple) {
    evaluacionEl = (
      <span className="text-emerald-600 font-semibold text-[11px]">
        ✓ Cumple {diferencia !== null && diferencia > 0 && `(+${diferencia} hs)`}
      </span>
    );
  } else {
    evaluacionEl = (
      <span className="text-red-600 font-semibold text-[11px]">
        ✗ Faltan {diferencia !== null ? Math.abs(diferencia) : '?'} hs
      </span>
    );
  }

  return (
    <tr className="hover:bg-slate-50/60">
      <td className="px-3 py-1.5 text-slate-700">{BLOQUE_NOMBRE[bloque] ?? bloque}</td>
      <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-slate-700">
        {horasReales !== null ? `${horasReales} hs` : '—'}
      </td>
      <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">
        {horasMinimas !== null ? `${horasMinimas} hs` : '—'}
      </td>
      <td className="px-3 py-1.5 text-right">{evaluacionEl}</td>
    </tr>
  );
}

function DetalleR09({
  valor,
  estadoCalculo,
}: {
  valor: unknown;
  estadoCalculo: string | null;
}) {
  if (estadoCalculo === 'NO_APLICA') {
    return (
      <p className="text-xs text-sky-600">
        El plan no tiene materias registradas. No aplica la evaluación de carga horaria.
      </p>
    );
  }

  if (!valor || typeof valor !== 'object') return <FallbackDetalle valor={valor} />;
  const v = valor as ValorR09;
  const materiasSinHoras = v.materiasSinHoras ?? [];
  const materiasConBloqueIndeterminado = v.materiasConBloqueIndeterminado ?? [];
  const { totalMaterias = 0, horasTotal, evaluaciones } = v;

  return (
    <div className="space-y-3">
      {estadoCalculo === 'NO_DETERMINABLE' && (
        <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-600">
          Todas las materias del plan tienen{' '}
          <span className="font-mono">cargaHorariaTotal = null</span>. No es posible calcular los
          totales horarios.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Metrica label="Materias evaluadas" valor={totalMaterias} />
        <Metrica label="Horas totales" valor={horasTotal !== null ? `${horasTotal} hs` : '—'} />
        <Metrica
          label="Sin carga horaria"
          valor={materiasSinHoras.length}
          destaca={materiasSinHoras.length > 0}
        />
      </div>

      {evaluaciones && (
        <div>
          <SeccionTitulo>Distribución y umbrales por bloque curricular</SeccionTitulo>
          <TablaWrapper>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-slate-500">Bloque</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase text-slate-500 w-28">Horas reales</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase text-slate-500 w-24">Mínimo</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase text-slate-500 w-44">Evaluación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <FilaDimension bloque="Total" dim={evaluaciones.total} />
              <FilaDimension bloque="CB" dim={evaluaciones.CB} />
              <FilaDimension bloque="TB" dim={evaluaciones.TB} />
              <FilaDimension bloque="TA" dim={evaluaciones.TA} />
              <FilaDimension bloque="CX" dim={evaluaciones.CX} />
            </tbody>
          </TablaWrapper>
          <p className="text-[10px] text-slate-400 mt-1">
            Mínimo &quot;—&quot; indica que el umbral no está configurado en el plan; esa dimensión no se evalúa.
          </p>
        </div>
      )}

      {materiasSinHoras.length > 0 && (
        <div>
          <SeccionTitulo className="text-amber-600">
            Materias sin carga horaria registrada ({materiasSinHoras.length})
          </SeccionTitulo>
          <ul className="space-y-1">
            {materiasSinHoras.map((m) => (
              <li key={m.materiaId} className="text-xs text-slate-600 flex items-start gap-2">
                <span className="text-amber-400 font-bold mt-0.5 flex-shrink-0">•</span>
                <span>
                  {m.nombre}{' '}
                  <span className="text-slate-400 font-mono text-[11px]">({m.codigo})</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {materiasConBloqueIndeterminado.length > 0 && (
        <div>
          <SeccionTitulo className="text-slate-500">
            Materias con bloque curricular sin clasificar ({materiasConBloqueIndeterminado.length})
          </SeccionTitulo>
          <p className="text-[11px] text-slate-500 mb-1.5">
            Sus horas se incluyen en el total pero no pueden asignarse a ningún bloque.
          </p>
          <ul className="space-y-1">
            {materiasConBloqueIndeterminado.map((m) => (
              <li key={m.materiaId} className="text-xs text-slate-600 flex items-start gap-2">
                <span className="text-slate-400 font-bold mt-0.5 flex-shrink-0">•</span>
                <span>
                  {m.nombre}{' '}
                  <span className="text-slate-400 font-mono text-[11px]">({m.codigo})</span>
                  {m.bloqueConocimientoRaw && (
                    <span className="text-slate-400">
                      {' '}— bloque registrado: <span className="font-mono">{m.bloqueConocimientoRaw}</span>
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── R-03: Tope semanal de horas docentes ─────────────────────────────────

interface ComponentesR03 {
  horasDocencia: number;
  horasGestion: number;
  horasNoAcademico: number;
  usoTope: number;
}

interface DocenteAlertaR03 {
  docenteId: string;
  nombre: string;
  componentes: ComponentesR03;
  exceso: number;
}

interface DocenteNoDeterminableR03 {
  docenteId: string;
  nombre: string;
  causa: string;
  sumaParcialConocida: number;
  confirmadoEnAlerta: boolean;
  detalleDatos: string;
}

interface ValorR03 {
  limite: number | null;
  totalDocentes: number;
  totalEnAlerta: number;
  enAlerta: DocenteAlertaR03[];
  totalNoDeterminables: number;
  noDeterminables: DocenteNoDeterminableR03[];
  alcanceFacultad: boolean;
}

function DetalleR03({ valor, estadoCalculo }: { valor: unknown; estadoCalculo: string | null }) {
  if (estadoCalculo === 'NO_APLICA') {
    return <p className="text-xs text-sky-600">Sin docentes evaluables para esta carrera.</p>;
  }
  if (!valor || typeof valor !== 'object') return <FallbackDetalle valor={valor} />;
  const v = valor as ValorR03;
  const enAlerta = v.enAlerta ?? [];
  const noDeterminables = v.noDeterminables ?? [];
  const limiteStr = v.limite !== null && v.limite !== undefined ? `${v.limite} hs` : '—';

  return (
    <div className="space-y-3">
      {estadoCalculo === 'NO_DETERMINABLE' && (
        <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-600">
          La facultad no tiene configurado el parámetro{' '}
          <span className="font-mono font-semibold">p01TopeH</span> en MOD-AUT.
          Sin ese umbral no es posible determinar excesos de tope semanal.
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metrica label="Total docentes" valor={v.totalDocentes} />
        <Metrica label="Tope semanal (p01TopeH)" valor={limiteStr} />
        <Metrica label="En alerta" valor={v.totalEnAlerta} destaca={v.totalEnAlerta > 0} />
        <Metrica label="No determinables" valor={v.totalNoDeterminables} destaca={v.totalNoDeterminables > 0} />
      </div>
      {!v.alcanceFacultad && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Alcance parcial: la evaluación cubre únicamente la carrera solicitada.
          Las horas de docentes con actividad en otras facultades pueden estar subestimadas.
        </p>
      )}
      {enAlerta.length === 0 && noDeterminables.length === 0 && estadoCalculo === 'CALCULADO' && (
        <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
          <span className="text-emerald-500">✓</span>
          Ningún docente supera el tope semanal configurado.
        </p>
      )}
      {enAlerta.length > 0 && (
        <div>
          <SeccionTitulo className="text-red-600">Docentes que superan el tope ({enAlerta.length})</SeccionTitulo>
          <TablaWrapper>
            <thead>
              <tr className="bg-red-50 border-b border-red-200">
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-red-700">Docente</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-24">Uso tope</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-20">Exceso</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-24 hidden sm:table-cell">Docencia</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-24 hidden sm:table-cell">Gestión</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-28 hidden sm:table-cell">No acad.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-100">
              {enAlerta.map((d) => (
                <tr key={d.docenteId} className="hover:bg-red-50/40">
                  <td className="px-3 py-1.5 text-slate-700">{d.nombre}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">{d.componentes.usoTope} hs</td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-bold text-red-700">+{d.exceso} hs</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-500 hidden sm:table-cell">{d.componentes.horasDocencia} hs</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-500 hidden sm:table-cell">{d.componentes.horasGestion} hs</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-500 hidden sm:table-cell">{d.componentes.horasNoAcademico} hs</td>
                </tr>
              ))}
            </tbody>
          </TablaWrapper>
        </div>
      )}
      {noDeterminables.length > 0 && (
        <div>
          <SeccionTitulo className="text-amber-600">No determinables ({noDeterminables.length})</SeccionTitulo>
          <TablaWrapper>
            <thead>
              <tr className="bg-amber-50 border-b border-amber-200">
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-amber-700">Docente</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase text-amber-700 w-32">Suma parcial</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-amber-700 w-28">Causa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100">
              {noDeterminables.map((d) => (
                <tr key={d.docenteId} className="hover:bg-amber-50/40">
                  <td className="px-3 py-1.5 text-slate-700">
                    {d.nombre}
                    {d.confirmadoEnAlerta && (
                      <span className="ml-2 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-1">
                        alerta confirmada
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{d.sumaParcialConocida} hs</td>
                  <td className="px-3 py-1.5 font-mono text-[11px] text-amber-700">{d.causa}</td>
                </tr>
              ))}
            </tbody>
          </TablaWrapper>
        </div>
      )}
    </div>
  );
}

// ── R-04: Cargo sin actividad curricular ──────────────────────────────────

interface CargoSinActividadR04 {
  docenteId: string;
  nombre: string;
  cargoDocenteId: string;
  cargoNombre: string;
  designacion: string | null;
  fechaInicio: string;
  fechaFin: string | null;
  verificado: boolean;
}

interface ValorR04 {
  planEstudioId: string;
  carreraId: string;
  totalDocentesPlantel: number;
  cargosEnAlerta: CargoSinActividadR04[];
  totalCargosEnAlerta: number;
  docentesExceptuadosPorC4: string[];
}

function formatFechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return String(iso);
  }
}

function DetalleR04({ valor, estadoCalculo }: { valor: unknown; estadoCalculo: string | null }) {
  if (estadoCalculo === 'NO_APLICA') {
    return <p className="text-xs text-sky-600">El plan no tiene docentes activos en el plantel. No aplica la evaluación.</p>;
  }
  if (!valor || typeof valor !== 'object') return <FallbackDetalle valor={valor} />;
  const v = valor as ValorR04;
  const cargos = v.cargosEnAlerta ?? [];
  const exceptuados = v.docentesExceptuadosPorC4 ?? [];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Metrica label="Docentes en plantel" valor={v.totalDocentesPlantel} />
        <Metrica label="Cargos en alerta" valor={v.totalCargosEnAlerta} destaca={v.totalCargosEnAlerta > 0} />
        <Metrica label="Exceptuados (C4)" valor={exceptuados.length} />
      </div>
      {cargos.length === 0 && (
        <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
          <span className="text-emerald-500">✓</span>
          Todos los cargos vigentes tienen actividad curricular en el plan.
        </p>
      )}
      {cargos.length > 0 && (
        <div>
          <SeccionTitulo className="text-red-600">Cargos sin actividad curricular ({cargos.length})</SeccionTitulo>
          {cargos.some((c) => !c.verificado) && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
              Algunos cargos no han sido verificados por secretaría.
              Las alertas marcadas con ⚠ pueden corresponder a datos no confirmados.
            </p>
          )}
          <TablaWrapper>
            <thead>
              <tr className="bg-red-50 border-b border-red-200">
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-red-700">Docente</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-red-700">Cargo</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-28 hidden sm:table-cell">Designación</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-28 hidden md:table-cell">Inicio</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-28 hidden md:table-cell">Fin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-100">
              {cargos.map((c) => (
                <tr key={c.cargoDocenteId} className="hover:bg-red-50/40">
                  <td className="px-3 py-1.5 text-slate-700">
                    {c.nombre}
                    {!c.verificado && <span className="ml-1 text-amber-500 text-[11px]">⚠</span>}
                  </td>
                  <td className="px-3 py-1.5 text-slate-600">{c.cargoNombre}</td>
                  <td className="px-3 py-1.5 text-slate-500 hidden sm:table-cell">{c.designacion ?? '—'}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-500 hidden md:table-cell">{formatFechaCorta(c.fechaInicio)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-500 hidden md:table-cell">{formatFechaCorta(c.fechaFin)}</td>
                </tr>
              ))}
            </tbody>
          </TablaWrapper>
        </div>
      )}
      {exceptuados.length > 0 && (
        <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          Excepción C4: {exceptuados.length} docente{exceptuados.length > 1 ? 's' : ''} con todos sus cargos vigentes
          sin actividad curricular en el plan — no penalizan IP-10.
        </p>
      )}
    </div>
  );
}

// ── R-10: Docentes con baja dedicación ────────────────────────────────────

interface ComponentesR10 {
  horasDocencia: number;
  horasGestion: number;
  horasInvestigacion: number;
  horasVinculacion: number;
  gestionIndeterminada: boolean;
  investigacionIndeterminada: boolean;
  vinculacionIndeterminada: boolean;
}

interface DocenteAlertaR10 {
  docenteId: string;
  nombre: string;
  horasConocidas: number;
  umbral: number;
  incierto: boolean;
  componentes: ComponentesR10;
}

interface ValorR10 {
  carreraId: string;
  umbral: number;
  totalDocentes: number;
  totalEnAlerta: number;
  totalInciertos: number;
  enAlerta: DocenteAlertaR10[];
  alcanceFacultad: boolean;
}

function DetalleR10({ valor, estadoCalculo }: { valor: unknown; estadoCalculo: string | null }) {
  if (estadoCalculo === 'NO_APLICA') {
    return <p className="text-xs text-sky-600">Sin docentes evaluables para esta carrera.</p>;
  }
  if (!valor || typeof valor !== 'object') return <FallbackDetalle valor={valor} />;
  const v = valor as ValorR10;
  const enAlerta = v.enAlerta ?? [];
  const confirmados = enAlerta.filter((d) => !d.incierto);
  const inciertos = enAlerta.filter((d) => d.incierto);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metrica label="Total docentes" valor={v.totalDocentes} />
        <Metrica label="Umbral (p02BajaH)" valor={`${v.umbral} hs`} />
        <Metrica label="Baja dedicación" valor={v.totalEnAlerta} destaca={v.totalEnAlerta > 0} />
        <Metrica label="Inciertos" valor={v.totalInciertos} destaca={v.totalInciertos > 0} />
      </div>
      {!v.alcanceFacultad && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Alcance parcial: evaluación limitada a la carrera solicitada.
          Las horas pueden estar subestimadas para docentes con actividad en otras facultades.
        </p>
      )}
      {enAlerta.length === 0 && estadoCalculo === 'CALCULADO' && (
        <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
          <span className="text-emerald-500">✓</span>
          Ningún docente tiene dedicación horaria total por debajo del umbral.
        </p>
      )}
      {confirmados.length > 0 && (
        <div>
          <SeccionTitulo className="text-red-600">Baja dedicación confirmada ({confirmados.length})</SeccionTitulo>
          <TablaWrapper>
            <thead>
              <tr className="bg-red-50 border-b border-red-200">
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-red-700">Docente</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-28">Hs. totales</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-24 hidden sm:table-cell">Docencia</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-24 hidden sm:table-cell">Gestión</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-24 hidden md:table-cell">Inv.</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-24 hidden md:table-cell">Vinc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-100">
              {confirmados.map((d) => (
                <tr key={d.docenteId} className="hover:bg-red-50/40">
                  <td className="px-3 py-1.5 text-slate-700">{d.nombre}</td>
                  <td className="px-3 py-1.5 text-right font-bold tabular-nums text-red-700">{d.horasConocidas} hs</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-500 hidden sm:table-cell">{d.componentes.horasDocencia} hs</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-500 hidden sm:table-cell">
                    {d.componentes.horasGestion} hs
                    {d.componentes.gestionIndeterminada && <span className="text-amber-500 ml-0.5">?</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-500 hidden md:table-cell">
                    {d.componentes.horasInvestigacion} hs
                    {d.componentes.investigacionIndeterminada && <span className="text-amber-500 ml-0.5">?</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-500 hidden md:table-cell">
                    {d.componentes.horasVinculacion} hs
                    {d.componentes.vinculacionIndeterminada && <span className="text-amber-500 ml-0.5">?</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </TablaWrapper>
        </div>
      )}
      {inciertos.length > 0 && (
        <div>
          <SeccionTitulo className="text-amber-600">Posible baja dedicación — datos incompletos ({inciertos.length})</SeccionTitulo>
          <p className="text-[11px] text-slate-500 mb-1.5">
            El total real podría ser mayor. Componentes marcados con{' '}
            <span className="text-amber-500 font-bold">?</span> tienen datos indeterminados.
          </p>
          <TablaWrapper>
            <thead>
              <tr className="bg-amber-50 border-b border-amber-200">
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-amber-700">Docente</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase text-amber-700 w-32">Hs. conocidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100">
              {inciertos.map((d) => (
                <tr key={d.docenteId} className="hover:bg-amber-50/40">
                  <td className="px-3 py-1.5 text-slate-700">{d.nombre}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-amber-700 font-semibold">{d.horasConocidas} hs</td>
                </tr>
              ))}
            </tbody>
          </TablaWrapper>
        </div>
      )}
    </div>
  );
}

// ── R-11: Inconsistencias en programas ────────────────────────────────────

interface ProgramaInconsistenteR11 {
  materiaId: string;
  nombre: string;
  codigo: string;
  estadoPrograma: string;
  seccionesCompletas: number;
  seccionesPendientes: number;
  prioridad: 'ALTA' | 'MEDIA';
}

interface MateriaSinProgramaR11 {
  materiaId: string;
  nombre: string;
  codigo: string;
}

interface ValorR11 {
  planEstudioId: string;
  totalMaterias: number;
  totalConPrograma: number;
  totalSinPrograma: number;
  totalInconsistencias: number;
  totalAlta: number;
  totalMedia: number;
  inconsistencias: ProgramaInconsistenteR11[];
  sinPrograma: MateriaSinProgramaR11[];
}

function DetalleR11({ valor, estadoCalculo }: { valor: unknown; estadoCalculo: string | null }) {
  if (estadoCalculo === 'NO_APLICA') {
    return <p className="text-xs text-sky-600">El plan no tiene materias registradas. No aplica la evaluación de programas.</p>;
  }
  if (!valor || typeof valor !== 'object') return <FallbackDetalle valor={valor} />;
  const v = valor as ValorR11;
  const inconsistencias = v.inconsistencias ?? [];
  const sinPrograma = v.sinPrograma ?? [];
  const altas = inconsistencias.filter((i) => i.prioridad === 'ALTA');
  const medias = inconsistencias.filter((i) => i.prioridad === 'MEDIA');

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metrica label="Materias evaluadas" valor={v.totalMaterias} />
        <Metrica label="Con programa" valor={v.totalConPrograma} />
        <Metrica label="Sin programa" valor={v.totalSinPrograma} destaca={v.totalSinPrograma > 0} />
        <Metrica label="Inconsistencias" valor={v.totalInconsistencias} destaca={v.totalInconsistencias > 0} />
      </div>
      {v.totalInconsistencias === 0 && v.totalSinPrograma === 0 && (
        <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
          <span className="text-emerald-500">✓</span>
          Sin inconsistencias en programas detectadas.
        </p>
      )}
      {altas.length > 0 && (
        <div>
          <SeccionTitulo className="text-red-600">Inconsistencia alta — programa aprobado con secciones pendientes ({altas.length})</SeccionTitulo>
          <TablaWrapper>
            <thead>
              <tr className="bg-red-50 border-b border-red-200">
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-red-700">Materia</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-24">Código</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-32 hidden sm:table-cell">Estado programa</th>
                <th className="text-center px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-24 hidden sm:table-cell">Completas</th>
                <th className="text-center px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-24 hidden sm:table-cell">Pendientes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-100">
              {altas.map((i) => (
                <tr key={i.materiaId} className="hover:bg-red-50/40">
                  <td className="px-3 py-1.5 text-slate-700">{i.nombre}</td>
                  <td className="px-3 py-1.5 font-mono text-slate-500">{i.codigo}</td>
                  <td className="px-3 py-1.5 text-slate-500 hidden sm:table-cell">{i.estadoPrograma}</td>
                  <td className="px-3 py-1.5 text-center tabular-nums text-slate-600 hidden sm:table-cell">{i.seccionesCompletas}</td>
                  <td className="px-3 py-1.5 text-center tabular-nums font-bold text-red-700 hidden sm:table-cell">{i.seccionesPendientes}</td>
                </tr>
              ))}
            </tbody>
          </TablaWrapper>
        </div>
      )}
      {medias.length > 0 && (
        <div>
          <SeccionTitulo className="text-amber-600">Inconsistencia media — programa incompleto o sin aprobar ({medias.length})</SeccionTitulo>
          <TablaWrapper>
            <thead>
              <tr className="bg-amber-50 border-b border-amber-200">
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-amber-700">Materia</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-amber-700 w-24">Código</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-amber-700 w-32 hidden sm:table-cell">Estado programa</th>
                <th className="text-center px-3 py-2 text-[10px] font-semibold uppercase text-amber-700 w-24 hidden sm:table-cell">Pendientes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100">
              {medias.map((i) => (
                <tr key={i.materiaId} className="hover:bg-amber-50/40">
                  <td className="px-3 py-1.5 text-slate-700">{i.nombre}</td>
                  <td className="px-3 py-1.5 font-mono text-slate-500">{i.codigo}</td>
                  <td className="px-3 py-1.5 text-slate-500 hidden sm:table-cell">{i.estadoPrograma}</td>
                  <td className="px-3 py-1.5 text-center tabular-nums text-amber-700 hidden sm:table-cell">{i.seccionesPendientes}</td>
                </tr>
              ))}
            </tbody>
          </TablaWrapper>
        </div>
      )}
      {sinPrograma.length > 0 && (
        <div>
          <SeccionTitulo className="text-slate-500">Sin programa registrado ({sinPrograma.length})</SeccionTitulo>
          <ul className="space-y-1">
            {sinPrograma.map((m) => (
              <li key={m.materiaId} className="text-xs text-slate-600 flex items-start gap-2">
                <span className="text-slate-400 font-bold mt-0.5 flex-shrink-0">•</span>
                {m.nombre} <span className="text-slate-400 font-mono text-[11px]">({m.codigo})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── R-12: Ficha docente incompleta ────────────────────────────────────────

type ItemFichaR12 = 'personales' | 'formacionGrado' | 'areaDesempeno';

const ITEM_FICHA_LABEL: Record<ItemFichaR12, string> = {
  personales: 'Datos personales',
  formacionGrado: 'Formación de grado',
  areaDesempeno: 'Área de desempeño',
};

interface DocenteAlertaR12 {
  docenteId: string;
  nombre: string;
  faltantes: ItemFichaR12[];
}

interface DocenteNoDeterminableR12 {
  docenteId: string;
  nombre: string;
  causa: string;
}

interface ValorR12 {
  carreraId: string;
  facultadId: string;
  totalDocentes: number;
  totalIncompletos: number;
  incompletos: DocenteAlertaR12[];
  totalNoDeterminables: number;
  noDeterminables: DocenteNoDeterminableR12[];
  alcanceFacultad: boolean;
}

function DetalleR12({ valor, estadoCalculo }: { valor: unknown; estadoCalculo: string | null }) {
  if (estadoCalculo === 'NO_APLICA') {
    return <p className="text-xs text-sky-600">Sin docentes evaluables para esta carrera.</p>;
  }
  if (!valor || typeof valor !== 'object') return <FallbackDetalle valor={valor} />;
  const v = valor as ValorR12;
  const incompletos = v.incompletos ?? [];
  const noDeterminables = v.noDeterminables ?? [];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metrica label="Total docentes" valor={v.totalDocentes} />
        <Metrica label="Ficha incompleta" valor={v.totalIncompletos} destaca={v.totalIncompletos > 0} />
        <Metrica label="No determinables" valor={v.totalNoDeterminables} destaca={v.totalNoDeterminables > 0} />
        <Metrica label="Alcance facultad" valor={v.alcanceFacultad ? 'Sí' : 'Parcial'} />
      </div>
      {!v.alcanceFacultad && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Alcance parcial: evaluación limitada a la carrera. Docentes con actividad en
          otras facultades se muestran como no determinables.
        </p>
      )}
      {incompletos.length === 0 && noDeterminables.length === 0 && (
        <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
          <span className="text-emerald-500">✓</span>
          Todas las fichas docentes evaluadas están completas.
        </p>
      )}
      {incompletos.length > 0 && (
        <div>
          <SeccionTitulo className="text-red-600">Fichas incompletas ({incompletos.length})</SeccionTitulo>
          <TablaWrapper>
            <thead>
              <tr className="bg-red-50 border-b border-red-200">
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-red-700">Docente</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-red-700">Ítems faltantes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-100">
              {incompletos.map((d) => (
                <tr key={d.docenteId} className="hover:bg-red-50/40">
                  <td className="px-3 py-1.5 text-slate-700">{d.nombre}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex flex-wrap gap-1">
                      {d.faltantes.map((f) => (
                        <span key={f} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                          {ITEM_FICHA_LABEL[f] ?? f}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </TablaWrapper>
        </div>
      )}
      {noDeterminables.length > 0 && (
        <div>
          <SeccionTitulo className="text-amber-600">No determinables — cross-facultad ({noDeterminables.length})</SeccionTitulo>
          <ul className="space-y-1">
            {noDeterminables.map((d) => (
              <li key={d.docenteId} className="text-xs text-slate-600 flex items-center gap-2">
                <span className="text-amber-400 font-bold flex-shrink-0">•</span>
                {d.nombre}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── R-13: Formación práctica insuficiente ─────────────────────────────────

interface MateriaFormacionPracticaR13 {
  materiaId: string;
  nombre: string;
  codigo: string;
  tipoAsignatura: string;
  cargaHorariaTotal: number | null;
}

interface ValorR13 {
  planEstudioId: string;
  totalMaterias: number;
  porTipo: { OBLIGATORIA: number; ELECTIVA: number; PPS: number; PI: number; OTRO: number };
  tienePPS: boolean;
  tienePI: boolean;
  horasPPS: number | null;
  horasPI: number | null;
  materiasPPS: MateriaFormacionPracticaR13[];
  materiasPI: MateriaFormacionPracticaR13[];
  configuracionPlan: {
    requierePPS: boolean | null;
    requierePI: boolean | null;
    porcentajeMinFormacion: number | null;
  };
  violacionesFormacion: string[];
}

function DetalleR13({ valor, estadoCalculo }: { valor: unknown; estadoCalculo: string | null }) {
  if (estadoCalculo === 'NO_APLICA') {
    return <p className="text-xs text-sky-600">El plan no tiene materias registradas. No aplica la evaluación de formación práctica.</p>;
  }
  if (!valor || typeof valor !== 'object') return <FallbackDetalle valor={valor} />;
  const v = valor as ValorR13;
  const violaciones = v.violacionesFormacion ?? [];
  const materiasPPS = v.materiasPPS ?? [];
  const materiasPI = v.materiasPI ?? [];
  const { porTipo = { OBLIGATORIA: 0, ELECTIVA: 0, PPS: 0, PI: 0, OTRO: 0 }, configuracionPlan } = v;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Metrica label="Total materias" valor={v.totalMaterias} />
        <Metrica label="Tiene PPS" valor={v.tienePPS ? 'Sí' : 'No'} destaca={!v.tienePPS && configuracionPlan?.requierePPS === true} />
        <Metrica label="Tiene PI" valor={v.tienePI ? 'Sí' : 'No'} destaca={!v.tienePI && configuracionPlan?.requierePI === true} />
      </div>

      {/* Distribución por tipo */}
      <div>
        <SeccionTitulo>Distribución por tipo de asignatura</SeccionTitulo>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          <Metrica label="Obligatoria" valor={porTipo.OBLIGATORIA} />
          <Metrica label="Electiva" valor={porTipo.ELECTIVA} />
          <Metrica label="PPS" valor={porTipo.PPS} />
          <Metrica label="PI" valor={porTipo.PI} />
          <Metrica label="Otro" valor={porTipo.OTRO} />
        </div>
      </div>

      {/* Horas */}
      {(materiasPPS.length > 0 || materiasPI.length > 0) && (
        <div className="grid grid-cols-2 gap-2">
          {materiasPPS.length > 0 && (
            <Metrica label="Horas PPS" valor={v.horasPPS !== null ? `${v.horasPPS} hs` : '— (datos incompletos)'} destaca={v.horasPPS === null} />
          )}
          {materiasPI.length > 0 && (
            <Metrica label="Horas PI" valor={v.horasPI !== null ? `${v.horasPI} hs` : '— (datos incompletos)'} destaca={v.horasPI === null} />
          )}
        </div>
      )}

      {/* Configuración del plan */}
      {configuracionPlan && (
        <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 space-y-0.5">
          <p className="font-semibold text-slate-600 uppercase tracking-wide text-[10px] mb-1">Configuración del plan</p>
          <p>Requiere PPS: <span className="font-medium">{configuracionPlan.requierePPS === null ? '— no configurado' : configuracionPlan.requierePPS ? 'Sí' : 'No'}</span></p>
          <p>Requiere PI: <span className="font-medium">{configuracionPlan.requierePI === null ? '— no configurado' : configuracionPlan.requierePI ? 'Sí' : 'No'}</span></p>
          <p>% mínimo formación práctica: <span className="font-medium">{configuracionPlan.porcentajeMinFormacion !== null ? `${configuracionPlan.porcentajeMinFormacion}%` : '— no configurado'}</span></p>
        </div>
      )}

      {/* Violaciones */}
      {violaciones.length > 0 && (
        <div>
          <SeccionTitulo className="text-red-600">Incumplimientos detectados ({violaciones.length})</SeccionTitulo>
          <ul className="space-y-1">
            {violaciones.map((v2, i) => (
              <li key={i} className="text-xs text-red-700 flex items-start gap-2">
                <span className="text-red-400 font-bold mt-0.5 flex-shrink-0">✗</span>
                {v2}
              </li>
            ))}
          </ul>
        </div>
      )}

      {violaciones.length === 0 && (estadoCalculo === 'CALCULADO' || estadoCalculo === 'PARCIAL') && (
        <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
          <span className="text-emerald-500">✓</span>
          {estadoCalculo === 'PARCIAL'
            ? 'Sin incumplimientos detectados — resultado parcial por datos de carga horaria incompletos.'
            : 'El plan cumple los requisitos de formación práctica configurados.'}
        </p>
      )}

      {/* Listado de materias PPS/PI */}
      {materiasPPS.length > 0 && (
        <div>
          <SeccionTitulo>Materias PPS</SeccionTitulo>
          <TablaWrapper>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-slate-500">Nombre</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-slate-500 w-24">Código</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase text-slate-500 w-24">Carga hs.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {materiasPPS.map((m) => (
                <tr key={m.materiaId} className="hover:bg-slate-50/60">
                  <td className="px-3 py-1.5 text-slate-700">{m.nombre}</td>
                  <td className="px-3 py-1.5 font-mono text-slate-500">{m.codigo}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{m.cargaHorariaTotal !== null ? `${m.cargaHorariaTotal} hs` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </TablaWrapper>
        </div>
      )}
      {materiasPI.length > 0 && (
        <div>
          <SeccionTitulo>Materias PI</SeccionTitulo>
          <TablaWrapper>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-slate-500">Nombre</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-slate-500 w-24">Código</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase text-slate-500 w-24">Carga hs.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {materiasPI.map((m) => (
                <tr key={m.materiaId} className="hover:bg-slate-50/60">
                  <td className="px-3 py-1.5 text-slate-700">{m.nombre}</td>
                  <td className="px-3 py-1.5 font-mono text-slate-500">{m.codigo}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{m.cargaHorariaTotal !== null ? `${m.cargaHorariaTotal} hs` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </TablaWrapper>
        </div>
      )}
    </div>
  );
}

// ── R-14: Horas de formación práctica superiores a horas totales ──────────

interface MateriaAlertaR14 {
  materiaId: string;
  nombre: string;
  codigo: string;
  horasFormacionPractica: number;
  horasTotal: number;
  exceso: number;
}

interface ValorR14 {
  planEstudioId: string;
  totalMaterias: number;
  totalEvaluadas: number;
  totalSinDatos: number;
  totalConAlerta: number;
  enAlerta: MateriaAlertaR14[];
}

function DetalleR14({ valor, estadoCalculo }: { valor: unknown; estadoCalculo: string | null }) {
  if (estadoCalculo === 'NO_APLICA') {
    return <p className="text-xs text-sky-600">El plan no tiene materias registradas. No aplica la evaluación.</p>;
  }
  if (estadoCalculo === 'NO_DETERMINABLE') {
    return (
      <p className="text-xs text-slate-600 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2">
        Ninguna materia pudo evaluarse — no hay programas o datos de formación práctica.
      </p>
    );
  }
  if (!valor || typeof valor !== 'object') return <FallbackDetalle valor={valor} />;
  const v = valor as ValorR14;
  const enAlerta = v.enAlerta ?? [];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metrica label="Total materias" valor={v.totalMaterias} />
        <Metrica label="Evaluadas" valor={v.totalEvaluadas} />
        <Metrica label="Sin datos" valor={v.totalSinDatos} destaca={v.totalSinDatos > 0} />
        <Metrica label="Con alerta" valor={v.totalConAlerta} destaca={v.totalConAlerta > 0} />
      </div>
      {estadoCalculo === 'PARCIAL' && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Resultado parcial: algunas materias no pudieron evaluarse por falta de carga horaria total
          o datos de formación práctica.
        </p>
      )}
      {enAlerta.length === 0 && (
        <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
          <span className="text-emerald-500">✓</span>
          Ninguna materia tiene horas de formación práctica superiores a su carga horaria total.
        </p>
      )}
      {enAlerta.length > 0 && (
        <div>
          <SeccionTitulo className="text-red-600">Materias con inconsistencia horaria ({enAlerta.length})</SeccionTitulo>
          <TablaWrapper>
            <thead>
              <tr className="bg-red-50 border-b border-red-200">
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-red-700">Materia</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-24">Código</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-28">Hs. práctica</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-24">Hs. total</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-20">Exceso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-100">
              {enAlerta.map((m) => (
                <tr key={m.materiaId} className="hover:bg-red-50/40">
                  <td className="px-3 py-1.5 text-slate-700">{m.nombre}</td>
                  <td className="px-3 py-1.5 font-mono text-slate-500">{m.codigo}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{m.horasFormacionPractica} hs</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{m.horasTotal} hs</td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-bold text-red-700">+{m.exceso} hs</td>
                </tr>
              ))}
            </tbody>
          </TablaWrapper>
        </div>
      )}
    </div>
  );
}

// ── R-15: Materias por docente de la carrera ──────────────────────────────

interface DocenteDistribucionR15 {
  docenteId: string;
  nombre: string;
  nMaterias: number;
}

interface DocenteAlertaR15 {
  docenteId: string;
  nombre: string;
  nMaterias: number;
  exceso: number;
}

interface ValorR15 {
  carreraId: string;
  limite: number | null;
  totalDocentes: number;
  promedio: number | null;
  mediana: number | null;
  maximo: number | null;
  distribucion: DocenteDistribucionR15[];
  totalEnAlerta: number;
  enAlerta: DocenteAlertaR15[];
}

function DetalleR15({ valor, estadoCalculo }: { valor: unknown; estadoCalculo: string | null }) {
  if (estadoCalculo === 'NO_APLICA') {
    return (
      <p className="text-xs text-sky-600">
        Sin vinculaciones APROBADAS activas en la carrera. No aplica la evaluación.
      </p>
    );
  }
  if (!valor || typeof valor !== 'object') return <FallbackDetalle valor={valor} />;
  const v = valor as ValorR15;
  const enAlerta = v.enAlerta ?? [];
  const distribucion = v.distribucion ?? [];
  const limiteStr = v.limite !== null && v.limite !== undefined ? String(v.limite) : '—';

  return (
    <div className="space-y-3">
      {estadoCalculo === 'NO_DETERMINABLE' && (
        <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-600">
          La facultad no tiene configurado el parámetro{' '}
          <span className="font-mono font-semibold">p03MaxMat</span> en MOD-AUT.
          Sin ese límite no es posible determinar sobreasignaciones en la carrera.
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metrica label="Total docentes" valor={v.totalDocentes} />
        <Metrica label="Límite (p03MaxMat)" valor={limiteStr} />
        <Metrica label="Sobreasignados" valor={v.totalEnAlerta} destaca={v.totalEnAlerta > 0} />
        <Metrica label="Mediana materias" valor={numDec(v.mediana, 1)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Metrica label="Promedio materias" valor={numDec(v.promedio, 2)} />
        <Metrica label="Máximo materias" valor={numVal(v.maximo)} />
      </div>
      {enAlerta.length > 0 && (
        <div>
          <SeccionTitulo className="text-red-600">Docentes que superan el límite ({enAlerta.length})</SeccionTitulo>
          <TablaWrapper>
            <thead>
              <tr className="bg-red-50 border-b border-red-200">
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-red-700">Docente</th>
                <th className="text-center px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-24">Materias</th>
                <th className="text-center px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-20">Exceso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-100">
              {enAlerta.map((d) => (
                <tr key={d.docenteId} className="hover:bg-red-50/40">
                  <td className="px-3 py-1.5 text-slate-700">{d.nombre}</td>
                  <td className="px-3 py-1.5 text-center font-semibold tabular-nums text-slate-700">{d.nMaterias}</td>
                  <td className="px-3 py-1.5 text-center font-bold tabular-nums text-red-700">+{d.exceso}</td>
                </tr>
              ))}
            </tbody>
          </TablaWrapper>
        </div>
      )}
      {enAlerta.length === 0 && estadoCalculo === 'CALCULADO' && (
        <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
          <span className="text-emerald-500">✓</span>
          Ningún docente supera el límite de materias configurado para la carrera.
        </p>
      )}
      {distribucion.length > 0 && (
        <div>
          <SeccionTitulo>Distribución por docente</SeccionTitulo>
          <TablaWrapper>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-slate-500">Docente</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase text-slate-500 w-36">Materias asignadas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {distribucion.map((d) => (
                <tr key={d.docenteId} className="hover:bg-slate-50/60">
                  <td className="px-3 py-1.5 text-slate-700">{d.nombre}</td>
                  <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-slate-700">{d.nMaterias}</td>
                </tr>
              ))}
            </tbody>
          </TablaWrapper>
          <p className="text-[10px] text-slate-400 mt-1">
            Materias distintas por docente — limitado a la carrera seleccionada.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Fallback para indicadores no reconocidos ──────────────────────────────

function FallbackDetalle({ valor }: { valor: unknown }) {
  if (valor === null || valor === undefined) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Valor</p>
      <pre className="text-xs bg-slate-100 text-slate-700 rounded-lg p-3 overflow-x-auto font-mono whitespace-pre-wrap max-h-48 leading-relaxed">
        {typeof valor === 'object' ? JSON.stringify(valor, null, 2) : String(valor)}
      </pre>
    </div>
  );
}

// ── Dispatcher principal ───────────────────────────────────────────────────

export function ResultadoIndicadorDetalle({ resultado }: { resultado: ResultadoBase }) {
  const { codigo, estadoCalculo, valor } = resultado;

  if (codigo === 'R-02') return <DetalleR02 valor={valor} estadoCalculo={estadoCalculo} />;
  if (codigo === 'R-03') return <DetalleR03 valor={valor} estadoCalculo={estadoCalculo} />;
  if (codigo === 'R-04') return <DetalleR04 valor={valor} estadoCalculo={estadoCalculo} />;
  if (codigo === 'R-06') return <DetalleR06 valor={valor} estadoCalculo={estadoCalculo} />;
  if (codigo === 'R-07') return <DetalleR07 valor={valor} estadoCalculo={estadoCalculo} />;
  if (codigo === 'R-08') return <DetalleR08 valor={valor} estadoCalculo={estadoCalculo} />;
  if (codigo === 'R-09') return <DetalleR09 valor={valor} estadoCalculo={estadoCalculo} />;
  if (codigo === 'R-10') return <DetalleR10 valor={valor} estadoCalculo={estadoCalculo} />;
  if (codigo === 'R-11') return <DetalleR11 valor={valor} estadoCalculo={estadoCalculo} />;
  if (codigo === 'R-12') return <DetalleR12 valor={valor} estadoCalculo={estadoCalculo} />;
  if (codigo === 'R-13') return <DetalleR13 valor={valor} estadoCalculo={estadoCalculo} />;
  if (codigo === 'R-14') return <DetalleR14 valor={valor} estadoCalculo={estadoCalculo} />;
  if (codigo === 'R-15') return <DetalleR15 valor={valor} estadoCalculo={estadoCalculo} />;

  return <FallbackDetalle valor={valor} />;
}
