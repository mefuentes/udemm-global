'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, mensajeErrorHttp } from '@/lib/api';
import type {
  DocenteAlertaR10,
  DocenteAlertaR12,
  EstadoCalculo,
  ResultadoIP04,
  ResultadoIP09,
  ResultadoIP10,
  ResultadoIP13,
  ResultadoR10,
  ResultadoR12,
  TablroCarreraResponse,
} from './types';
import type { HistorialAnalisis, ItemHistorial, MetadataEjecucion } from '../../../analisis/analisis.types';

// ── Helpers visuales ─────────────────────────────────────────────────────────

function estadoCls(ec: EstadoCalculo): string {
  if (ec === 'CALCULADO')       return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (ec === 'PARCIAL')         return 'bg-amber-50 text-amber-700 border-amber-200';
  if (ec === 'NO_DETERMINABLE') return 'bg-slate-100 text-slate-600 border-slate-200';
  return 'bg-sky-50 text-sky-700 border-sky-200'; // NO_APLICA
}

function estadoLabel(ec: EstadoCalculo): string {
  return ec.replace(/_/g, ' ');
}

function formatFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

// ── Iconos ───────────────────────────────────────────────────────────────────

const IcSpinner = ({ sm }: { sm?: boolean }) => (
  <span className={`inline-block rounded-full border-2 border-slate-300 border-t-[#0f4c81] animate-spin flex-shrink-0 ${sm ? 'w-3.5 h-3.5' : 'w-5 h-5'}`} />
);

const IcRefresh = () => (
  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

// ── Componentes compartidos ──────────────────────────────────────────────────

function EstadoBadge({ ec }: { ec: EstadoCalculo }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${estadoCls(ec)}`}>
      {estadoLabel(ec)}
    </span>
  );
}

function EtiquetaIndicador({ codigo, titulo }: { codigo: string; titulo: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[11px] font-bold font-mono bg-[#0f4c81]/8 text-[#0f4c81] px-2 py-0.5 rounded border border-[#0f4c81]/10">
        {codigo}
      </span>
      <span className="text-xs font-semibold text-slate-700">{titulo}</span>
    </div>
  );
}

function Metrica({ label, valor, destaca = false }: {
  label: string; valor: string | number; destaca?: boolean;
}) {
  return (
    <div className={`rounded-lg px-3 py-2 border text-center ${destaca ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5 leading-tight">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${destaca ? 'text-red-700' : 'text-slate-700'}`}>{valor}</p>
    </div>
  );
}

// ── IP-04: Materias por docente ───────────────────────────────────────────────

function fmtNum(n: number | null): string {
  if (n === null) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function TarjetaIP04({ ip04 }: { ip04: ResultadoIP04 }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <EtiquetaIndicador codigo="IP-04" titulo="Materias por docente" />

      {ip04.estadoCalculo === 'NO_APLICA' ? (
        <div className="p-3 rounded-lg bg-sky-50 border border-sky-200">
          <p className="text-xs text-sky-700">
            Sin docentes activos con asignaciones aprobadas. No aplica la evaluación.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Mediana — métrica principal */}
            <div className="rounded-lg px-3 py-3 border border-[#0f4c81]/15 bg-[#0f4c81]/5 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#0f4c81]/60 mb-0.5 leading-tight">
                Mediana
              </p>
              <p className="text-2xl font-bold tabular-nums text-[#0f4c81]">
                {fmtNum(ip04.mediana)}
              </p>
              <p className="text-[9px] text-slate-400 mt-0.5">mat / docente</p>
            </div>
            <Metrica label="Promedio" valor={fmtNum(ip04.promedio)} />
            <Metrica label="Máximo" valor={fmtNum(ip04.maximo)} />
            <Metrica label="Docentes" valor={ip04.totalDocentes} />
          </div>

          {ip04.distribucion.length > 0 && (
            <details className="mt-3 group">
              <summary className="cursor-pointer text-[11px] font-semibold text-slate-500 hover:text-slate-700 select-none list-none flex items-center gap-1.5">
                <span className="inline-block transition-transform group-open:rotate-90">▶</span>
                Distribución por docente ({ip04.distribucion.length})
              </summary>
              <div className="mt-2 overflow-x-auto rounded-lg border border-slate-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-left px-3 py-1.5 font-semibold text-slate-500">Docente</th>
                      <th className="text-right px-3 py-1.5 font-semibold text-slate-500">Materias</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ip04.distribucion.map((d, i) => (
                      <tr key={d.docenteId} className={i % 2 === 0 ? '' : 'bg-slate-50/60'}>
                        <td className="px-3 py-1.5 text-slate-700">{d.nombre}</td>
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums text-slate-700">{d.nMaterias}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          <div className="flex justify-end mt-2">
            <EstadoBadge ec={ip04.estadoCalculo} />
          </div>
        </>
      )}
    </div>
  );
}

// ── IP-10: Consistencia del plantel docente ───────────────────────────────────

function TarjetaIP10({ ip10 }: { ip10: ResultadoIP10 }) {
  const ec = ip10.estadoCalculo;
  const puntaje = ip10.puntaje;
  const colorPuntaje =
    puntaje >= 80 ? 'text-emerald-700' :
    puntaje >= 50 ? 'text-amber-700' :
    'text-red-700';
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <EtiquetaIndicador codigo="IP-10" titulo="Consistencia del plantel docente" />
      {ec === 'NO_APLICA' ? (
        <p className="text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded-lg p-3">Sin plantel activo. No aplica la evaluación.</p>
      ) : (
        <>
          <div className="flex items-center gap-4 mb-3">
            <div className="text-center flex-shrink-0">
              <p className={`text-4xl font-black tabular-nums ${colorPuntaje}`}>{puntaje}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">/ 100</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 flex-1">
              <Metrica label="Alertas ALTA (A)" valor={ip10.componenteA} destaca={ip10.componenteA > 0} />
              <Metrica label="Alertas MEDIA (M)" valor={ip10.componenteM} destaca={ip10.componenteM > 0} />
              <Metrica label="R-03 tope" valor={ip10.alertasR03} destaca={ip10.alertasR03 > 0} />
              <Metrica label="R-04 penalizables" valor={ip10.alertasR04Penalizables} destaca={ip10.alertasR04Penalizables > 0} />
              <Metrica label="R-07 sobreasign." valor={ip10.alertasR07} destaca={ip10.alertasR07 > 0} />
            </div>
          </div>
          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
            <p className="text-[11px] text-slate-500">
              Fórmula: <span className="font-mono">max(0, 100 − 25×A − 10×M)</span>.
              A = alertas ALTA penalizables (R-03 + R-04). M = alertas MEDIA (R-07).
            </p>
          </div>
          <div className="flex justify-end mt-2">
            <EstadoBadge ec={ec} />
          </div>
        </>
      )}
    </div>
  );
}

// ── R-10: Docentes con baja dedicación horaria ────────────────────────────────

function FilaAlertaR10({ d }: { d: DocenteAlertaR10 }) {
  return (
    <tr className="hover:bg-slate-50/60">
      <td className="px-3 py-1.5 text-xs text-slate-700">
        <Link href={`/autoevaluacion/ficha-docente/${d.docenteId}`} className="hover:underline text-[#0f4c81]">{d.nombre}</Link>
      </td>
      <td className="px-3 py-1.5 text-right tabular-nums text-xs text-slate-600">{d.horasConocidas} h</td>
      <td className="px-3 py-1.5 text-right tabular-nums text-xs text-amber-700 font-semibold">{d.umbral} h</td>
    </tr>
  );
}

function TarjetaR10({ r10 }: { r10: ResultadoR10 }) {
  const ec = r10.estadoCalculo;
  if (ec === 'NO_APLICA') {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <EtiquetaIndicador codigo="R-10" titulo="Docentes con baja dedicación horaria" />
        <p className="text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded-lg p-3">Sin plantel activo. No aplica la evaluación.</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <EtiquetaIndicador codigo="R-10" titulo="Docentes con baja dedicación horaria" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metrica label="Total docentes" valor={r10.totalDocentes} />
        <Metrica label="En alerta" valor={r10.totalEnAlerta} destaca={r10.totalEnAlerta > 0} />
        <Metrica label="Inciertos" valor={r10.totalInciertos} />
        <Metrica label={`Umbral (< ${r10.umbral} h)`} valor={`${r10.umbral} h`} />
      </div>
      {r10.totalEnAlerta === 0 && ec === 'CALCULADO' && (
        <p className="mt-2 text-xs text-emerald-700 flex items-center gap-1.5">
          <span className="text-emerald-500">✓</span> Sin docentes con baja dedicación horaria.
        </p>
      )}
      {!r10.alcanceFacultad && (
        <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
          <p className="text-[11px] text-amber-700">Evaluación parcial — el Director de Carrera solo ve su carrera (PARCIAL).</p>
        </div>
      )}
      {r10.enAlerta.length > 0 && (
        <details className="mt-3 group">
          <summary className="cursor-pointer text-[11px] font-semibold text-slate-500 hover:text-slate-700 select-none list-none flex items-center gap-1.5">
            <span className="inline-block transition-transform group-open:rotate-90">▶</span>
            Docentes con alerta ({r10.enAlerta.length})
          </summary>
          <div className="mt-2 overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-3 py-1.5 font-semibold text-slate-500">Docente</th>
                  <th className="text-right px-3 py-1.5 font-semibold text-slate-500">Hs. conocidas</th>
                  <th className="text-right px-3 py-1.5 font-semibold text-amber-600">Umbral</th>
                </tr>
              </thead>
              <tbody>
                {r10.enAlerta.map(d => <FilaAlertaR10 key={d.docenteId} d={d} />)}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <div className="flex justify-end mt-2">
        <EstadoBadge ec={ec} />
      </div>
    </div>
  );
}

// ── R-12: Campos obligatorios faltantes en ficha docente ──────────────────────

const ITEM_FICHA_LABEL: Record<string, string> = {
  personales: 'Datos personales',
  formacionGrado: 'Título de grado',
  areaDesempeno: 'Área disciplinar',
};

function FilaAlertaR12({ d }: { d: DocenteAlertaR12 }) {
  return (
    <tr className="hover:bg-slate-50/60">
      <td className="px-3 py-1.5 text-xs text-slate-700">
        <Link href={`/autoevaluacion/ficha-docente/${d.docenteId}`} className="hover:underline text-[#0f4c81]">{d.nombre}</Link>
      </td>
      <td className="px-3 py-1.5 text-xs text-slate-600">
        {d.faltantes.map(f => ITEM_FICHA_LABEL[f] ?? f).join(', ')}
      </td>
    </tr>
  );
}

function TarjetaR12({ r12 }: { r12: ResultadoR12 }) {
  const ec = r12.estadoCalculo;
  if (ec === 'NO_APLICA') {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <EtiquetaIndicador codigo="R-12" titulo="Campos obligatorios en ficha docente" />
        <p className="text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded-lg p-3">Sin plantel activo. No aplica la evaluación.</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <EtiquetaIndicador codigo="R-12" titulo="Campos obligatorios en ficha docente" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metrica label="Total docentes" valor={r12.totalDocentes} />
        <Metrica label="Incompletos" valor={r12.totalIncompletos} destaca={r12.totalIncompletos > 0} />
        <Metrica label="No determinables" valor={r12.totalNoDeterminables} />
      </div>
      {r12.totalIncompletos === 0 && ec === 'CALCULADO' && (
        <p className="mt-2 text-xs text-emerald-700 flex items-center gap-1.5">
          <span className="text-emerald-500">✓</span> Todos los docentes tienen la ficha completa.
        </p>
      )}
      {!r12.alcanceFacultad && (
        <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
          <p className="text-[11px] text-amber-700">Evaluación parcial — el Director de Carrera solo ve su carrera (PARCIAL).</p>
        </div>
      )}
      {r12.noDeterminables.length > 0 && (
        <div className="mt-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
          <p className="text-[11px] text-slate-600">
            {r12.noDeterminables.length} docente(s) con asignaciones cross-facultad no pudieron evaluarse.
          </p>
        </div>
      )}
      {r12.incompletos.length > 0 && (
        <details className="mt-3 group">
          <summary className="cursor-pointer text-[11px] font-semibold text-slate-500 hover:text-slate-700 select-none list-none flex items-center gap-1.5">
            <span className="inline-block transition-transform group-open:rotate-90">▶</span>
            Fichas incompletas ({r12.incompletos.length})
          </summary>
          <div className="mt-2 overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-3 py-1.5 font-semibold text-slate-500">Docente</th>
                  <th className="text-left px-3 py-1.5 font-semibold text-slate-500">Campos faltantes</th>
                </tr>
              </thead>
              <tbody>
                {r12.incompletos.map(d => <FilaAlertaR12 key={d.docenteId} d={d} />)}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <div className="flex justify-end mt-2">
        <EstadoBadge ec={ec} />
      </div>
    </div>
  );
}

// ── IP-09: Completitud promedio del plantel ───────────────────────────────────

function TarjetaIP09({ ip09 }: { ip09: ResultadoIP09 }) {
  const ec = ip09.estadoCalculo;
  const pct = ip09.completitudPromedio;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <EtiquetaIndicador codigo="IP-09" titulo="Completitud promedio del plantel" />

      {ec === 'NO_APLICA' ? (
        <div className="p-3 rounded-lg bg-sky-50 border border-sky-200">
          <p className="text-xs text-sky-700">
            Sin docentes activos con asignaciones aprobadas. No aplica la evaluación.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {/* Completitud promedio — métrica principal */}
            <div className="rounded-lg px-3 py-3 border border-[#0f4c81]/15 bg-[#0f4c81]/5 text-center col-span-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#0f4c81]/60 mb-0.5 leading-tight">
                Completitud promedio
              </p>
              <p className="text-2xl font-bold tabular-nums text-[#0f4c81]">
                {pct !== null ? `${pct}%` : '—'}
              </p>
              <p className="text-[9px] text-slate-400 mt-0.5">sobre 100%</p>
            </div>
            <Metrica label="Docentes evaluados" valor={ip09.totalDocentes} />
          </div>

          {pct !== null && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-400">0%</span>
                <span className="text-[10px] text-slate-400">100%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444',
                  }}
                />
              </div>
            </div>
          )}

          <div className="mt-2 pt-2 border-t border-slate-100">
            <p className="text-[10px] text-slate-400 leading-relaxed">
              C1 = datos personales (sexo, f. nacimiento, CUIT, Depto/Partido) ·
              C2 = título de grado · C3 = área disciplinar · C4 = cargo vigente (siempre 1).
              completitud_i = 25 × (C1 + C2 + C3 + C4).
            </p>
          </div>

          <div className="flex justify-end mt-2">
            <EstadoBadge ec={ec} />
          </div>
        </>
      )}
    </div>
  );
}

// ── IP-13: Docentes sobreasignados ────────────────────────────────────────────

function TarjetaIP13({ ip13 }: { ip13: ResultadoIP13 }) {
  const ec = ip13.estadoCalculo;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <EtiquetaIndicador codigo="IP-13" titulo="Docentes sobreasignados" />

      {ec === 'NO_APLICA' ? (
        <div className="p-3 rounded-lg bg-sky-50 border border-sky-200">
          <p className="text-xs text-sky-700">
            Sin docentes activos con asignaciones aprobadas. No aplica la evaluación.
          </p>
        </div>
      ) : ec === 'NO_DETERMINABLE' ? (
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
          <p className="text-xs text-slate-600">
            El parámetro P-03 (máximo de materias por docente) no está configurado para esta facultad.
            Configure P-03 en la sección de parámetros para calcular este indicador.
          </p>
          <div className="flex justify-end mt-2">
            <EstadoBadge ec={ec} />
          </div>
        </div>
      ) : (
        <>
          {/* Advertencia de alcance parcial */}
          {(ec === 'PARCIAL' || !ip13.alcanceFacultad) && (
            <div className="mb-3 p-2 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-[11px] text-amber-700 leading-relaxed">
                <span className="font-semibold">Evaluación parcial</span>
                {!ip13.alcanceFacultad
                  ? ' — alcance limitado a esta carrera. Pueden existir asignaciones fuera del alcance consultado.'
                  : ip13.totalNoDeterminables > 0
                  ? ` — ${ip13.totalNoDeterminables} docente(s) con asignaciones en otras facultades no pudieron evaluarse.`
                  : ' — pueden existir asignaciones fuera del alcance consultado.'}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Sobreasignados — métrica principal */}
            <div className={`rounded-lg px-3 py-3 border text-center ${ip13.totalSobreasignados > 0
              ? 'border-red-200 bg-red-50'
              : 'border-emerald-200 bg-emerald-50'}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-wide mb-0.5 leading-tight ${
                ip13.totalSobreasignados > 0 ? 'text-red-600/70' : 'text-emerald-600/70'}`}>
                Sobreasignados
              </p>
              <p className={`text-2xl font-bold tabular-nums ${
                ip13.totalSobreasignados > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                {ip13.totalSobreasignados}
              </p>
              {ip13.totalSobreasignados === 0 && (
                <p className="text-[9px] text-emerald-600 mt-0.5">dentro del límite</p>
              )}
            </div>
            <Metrica label="Total docentes" valor={ip13.totalDocentes} />
            <Metrica label="Límite P-03" valor={ip13.limite ?? '—'} />
            <Metrica label="No determinables" valor={ip13.totalNoDeterminables} />
          </div>

          {ip13.totalSobreasignados === 0 && ec !== 'PARCIAL' && (
            <p className="mt-2 text-xs text-emerald-700 flex items-center gap-1.5">
              <span className="text-emerald-500">✓</span>
              Todos los docentes están dentro del límite establecido por P-03.
            </p>
          )}

          {ip13.sobreasignados.length > 0 && (
            <details className="mt-3 group">
              <summary className="cursor-pointer text-[11px] font-semibold text-slate-500 hover:text-slate-700 select-none list-none flex items-center gap-1.5">
                <span className="inline-block transition-transform group-open:rotate-90">▶</span>
                Docentes con exceso de asignaciones ({ip13.sobreasignados.length})
              </summary>
              <div className="mt-2 overflow-x-auto rounded-lg border border-slate-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-left px-3 py-1.5 font-semibold text-slate-500">Docente</th>
                      <th className="text-right px-3 py-1.5 font-semibold text-slate-500">Materias</th>
                      <th className="text-right px-3 py-1.5 font-semibold text-red-500">Exceso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ip13.sobreasignados.map((d, i) => (
                      <tr key={d.docenteId} className={i % 2 === 0 ? '' : 'bg-slate-50/60'}>
                        <td className="px-3 py-1.5 text-slate-700">
                          <Link href={`/autoevaluacion/ficha-docente/${d.docenteId}`} className="hover:underline text-[#0f4c81]">{d.nombre}</Link>
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums text-slate-700">{d.nMaterias}</td>
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums text-red-600 font-semibold">+{d.exceso}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          <div className="flex justify-end mt-2">
            <EstadoBadge ec={ec} />
          </div>
        </>
      )}
    </div>
  );
}

// ── Componente interno (necesita Suspense por useSearchParams) ────────────────

function TablroCarreraInner() {
  const params       = useParams<{ carreraId: string }>();
  const searchParams = useSearchParams();
  const carreraId    = params.carreraId;
  const carreraLabel = searchParams.get('carrera') ?? '';

  const [cargando, setCargando] = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [dato,     setDato]     = useState<TablroCarreraResponse | null>(null);

  const [corriendo,       setCorriendo]       = useState(false);
  const [errorAnalisis,   setErrorAnalisis]   = useState<string | null>(null);
  const [ultimaEjecucion, setUltimaEjecucion] = useState<MetadataEjecucion | null>(null);
  const [historial,       setHistorial]       = useState<HistorialAnalisis | null>(null);
  const [cargandoHist,    setCargandoHist]    = useState(false);
  const [paginaHistorial, setPaginaHistorial] = useState(1);
  const [exportando,      setExportando]      = useState<string | null>(null);
  const [errorExport,     setErrorExport]     = useState<string | null>(null);

  async function exportar(formato: 'pdf' | 'xlsx', ejecucionId?: string) {
    const key = ejecucionId ? `${ejecucionId}-${formato}` : formato;
    setExportando(key);
    setErrorExport(null);
    try {
      const url = ejecucionId
        ? `/autoevaluacion/exportar/ejecucion/${ejecucionId}/${formato}`
        : `/autoevaluacion/exportar/carrera/${carreraId}/${formato}`;
      const res = await apiFetch(url);
      if (!res.ok) { setErrorExport('Error al generar la exportación'); return; }
      const blob = await res.blob();
      const cd   = res.headers.get('Content-Disposition') ?? '';
      const name = cd.match(/filename="([^"]+)"/)?.[1] ?? `exportacion.${formato}`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { setErrorExport('Error de red al exportar'); }
    finally { setExportando(null); }
  }

  async function correrAnalisis() {
    setCorriendo(true);
    setErrorAnalisis(null);
    try {
      const res  = await apiFetch(`/autoevaluacion/analisis/carrera/${carreraId}`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(mensajeErrorHttp(res, data, 'Error al ejecutar análisis'));
      setUltimaEjecucion((data as { metadata: MetadataEjecucion }).metadata);
      cargarHistorial().catch(() => {});
    } catch (e) {
      setErrorAnalisis((e as Error).message);
    } finally {
      setCorriendo(false);
    }
  }

  async function cargarHistorial() {
    setCargandoHist(true);
    try {
      const res  = await apiFetch(`/autoevaluacion/analisis/carrera/${carreraId}/historial?pagina=${paginaHistorial}&porPagina=10`);
      const data = await res.json().catch(() => null);
      if (res.ok) setHistorial(data as HistorialAnalisis);
    } finally {
      setCargandoHist(false);
    }
  }

  useEffect(() => { if (carreraId) cargarHistorial(); }, [carreraId, paginaHistorial]); // eslint-disable-line react-hooks/exhaustive-deps

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const res  = await apiFetch(`/autoevaluacion/tablero/carrera/${carreraId}`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(mensajeErrorHttp(res, data, 'Error al cargar el tablero de carrera'));
      setDato(data as TablroCarreraResponse);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, [carreraId]); // eslint-disable-line react-hooks/exhaustive-deps

  const ip01 = dato?.ip01;
  const ip02 = dato?.ip02;
  const ip03 = dato?.ip03;
  const ip04 = dato?.ip04;
  const ip08 = dato?.ip08;
  const ip09 = dato?.ip09;
  const ip10 = dato?.ip10;
  const ip13 = dato?.ip13;
  const r10  = dato?.r10;
  const r12  = dato?.r12;

  // IP-03: derivar sin cobertura y porcentaje solo cuando hay datos reales
  const sinCobertura = ip03 && ip03.total > 0 ? ip03.total - ip03.cubiertas : null;
  const pctCobertura = ip03 && ip03.total > 0
    ? Math.round((ip03.cubiertas / ip03.total) * 100)
    : null;

  return (
    <div className="max-w-4xl mx-auto">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-5">
        <a href="/" className="hover:text-slate-600 transition-colors">Inicio</a>
        <span>/</span>
        <Link href="/autoevaluacion" className="hover:text-slate-600 transition-colors">Autoevaluación</Link>
        <span>/</span>
        <span className="text-slate-600 font-medium">Tablero de carrera</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
            MOD-AUT · Tablero de carrera
          </p>
          <h1 className="text-xl font-bold text-slate-800">
            {carreraLabel || 'Carrera'}
          </h1>
          {dato && (
            <p className="mt-1 text-[11px] text-slate-400">
              Evaluado el {formatFecha(dato.fechaEvaluacion)}
            </p>
          )}
        </div>
        <button
          onClick={cargar}
          disabled={cargando}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#0f4c81] hover:bg-[#0f4c81]/8 active:bg-[#0f4c81]/15 px-3 py-2 rounded-lg border border-[#0f4c81]/15 transition-colors disabled:opacity-50 flex-shrink-0"
        >
          {cargando ? <IcSpinner sm /> : <IcRefresh />}
          Actualizar
        </button>
      </div>

      {/* Estado general */}
      {dato && (
        <div className="flex flex-wrap items-center gap-2 mb-5 p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Estado general de cálculo:</span>
          <EstadoBadge ec={dato.estadoGeneralCalculo} />
          <span className="text-[10px] text-slate-400 italic">
            Estado más restrictivo entre los 10 indicadores. PARCIAL puede reflejar alcance limitado (IP-13, R-10, R-12) — no indica incumplimiento académico.
          </span>
        </div>
      )}

      {/* Loading inicial */}
      {cargando && !dato && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 flex items-center justify-center gap-3">
          <IcSpinner />
          <span className="text-sm text-slate-500">Calculando indicadores de la carrera...</span>
        </div>
      )}

      {/* Error */}
      {error && !cargando && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Indicadores */}
      {dato && ip01 && ip02 && ip03 && ip04 && ip08 && ip09 && ip10 && ip13 && r10 && r12 && (
        <div className="space-y-4">

          {/* IP-01 + IP-02 — Plantel vigente (fila compacta) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* IP-01 — Docentes vigentes */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <EtiquetaIndicador codigo="IP-01" titulo="Docentes vigentes" />

              {ip01.estadoCalculo === 'NO_APLICA' ? (
                <div className="p-3 rounded-lg bg-sky-50 border border-sky-200">
                  <p className="text-xs text-sky-700">
                    Sin docentes activos con asignaciones aprobadas. No aplica la evaluación.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-center py-3">
                    <div className="text-center">
                      <p className="text-3xl font-bold tabular-nums text-[#0f4c81]">{ip01.total}</p>
                      <p className="text-[10px] text-slate-500 mt-1">docentes activos con asignación vigente</p>
                    </div>
                  </div>
                  <div className="flex justify-end mt-1">
                    <EstadoBadge ec={ip01.estadoCalculo} />
                  </div>
                </>
              )}
            </div>

            {/* IP-02 — Cargos docentes vigentes */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <EtiquetaIndicador codigo="IP-02" titulo="Cargos docentes vigentes" />

              {ip02.estadoCalculo === 'NO_APLICA' ? (
                <div className="p-3 rounded-lg bg-sky-50 border border-sky-200">
                  <p className="text-xs text-sky-700">
                    Sin cargos docentes clasificables activos. No aplica la evaluación.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-center py-3">
                    <div className="text-center">
                      <p className="text-3xl font-bold tabular-nums text-[#0f4c81]">{ip02.total}</p>
                      <p className="text-[10px] text-slate-500 mt-1">cargos P+A con docente activo</p>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      P = Titular, Asociado, Adjunto · A = JTP, Ayudante Graduado, No Graduado.
                      No incluye cargos de gestión.
                    </p>
                  </div>
                  <div className="flex justify-end mt-1">
                    <EstadoBadge ec={ip02.estadoCalculo} />
                  </div>
                </>
              )}
            </div>

          </div>

          {/* IP-03 — Materias cubiertas */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <EtiquetaIndicador codigo="IP-03" titulo="Materias cubiertas" />

            {ip03.estadoCalculo === 'NO_APLICA' ? (
              <div className="p-3 rounded-lg bg-sky-50 border border-sky-200">
                <p className="text-xs text-sky-700">
                  Sin planes o materias evaluables en esta carrera. No aplica la evaluación.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Metrica
                    label="Total de materias"
                    valor={ip03.total}
                  />
                  <Metrica
                    label="Con cobertura"
                    valor={ip03.cubiertas}
                  />
                  <Metrica
                    label="Sin cobertura"
                    valor={sinCobertura !== null ? sinCobertura : '—'}
                    destaca={(sinCobertura ?? 0) > 0}
                  />
                  <Metrica
                    label="Cobertura %"
                    valor={pctCobertura !== null ? `${pctCobertura}%` : '—'}
                  />
                </div>

                {ip03.cubiertas === ip03.total && ip03.estadoCalculo === 'CALCULADO' && (
                  <p className="mt-2 text-xs text-emerald-700 flex items-center gap-1.5">
                    <span className="text-emerald-500">✓</span>
                    Todas las materias tienen al menos una asignación docente activa.
                  </p>
                )}
                {(sinCobertura ?? 0) > 0 && (
                  <p className="mt-2 text-xs text-red-700 flex items-center gap-1.5">
                    <span className="text-red-500">✗</span>
                    {sinCobertura} materia{(sinCobertura ?? 0) !== 1 ? 's' : ''} sin asignación docente aprobada.
                  </p>
                )}

                <div className="flex justify-end mt-2">
                  <EstadoBadge ec={ip03.estadoCalculo} />
                </div>
              </>
            )}
          </div>

          {/* IP-04 — Materias por docente */}
          <TarjetaIP04 ip04={ip04} />

          {/* IP-09 — Completitud promedio del plantel */}
          <TarjetaIP09 ip09={ip09} />

          {/* IP-10 — Consistencia del plantel docente */}
          <TarjetaIP10 ip10={ip10} />

          {/* IP-13 — Docentes sobreasignados */}
          <TarjetaIP13 ip13={ip13} />

          {/* R-10 — Docentes con baja dedicación horaria */}
          <TarjetaR10 r10={r10} />

          {/* R-12 — Campos obligatorios en ficha docente */}
          <TarjetaR12 r12={r12} />

          {/* IP-08 — Relación profesores / auxiliares */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <EtiquetaIndicador codigo="IP-08" titulo="Relación profesores / auxiliares" />

            {ip08.estadoCalculo === 'NO_APLICA' ? (
              <div className="p-3 rounded-lg bg-sky-50 border border-sky-200">
                <p className="text-xs text-sky-700">
                  Sin vinculaciones activas en la carrera. No aplica la evaluación.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Metrica
                    label="Profesores (P)"
                    valor={ip08.profesores}
                  />
                  <Metrica
                    label="Auxiliares (A)"
                    valor={ip08.auxiliares}
                  />
                  <div className="rounded-lg px-3 py-2 border border-slate-200 bg-slate-50 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5 leading-tight">
                      Relación P : A
                    </p>
                    {ip08.ratio !== null ? (
                      <p className="text-sm font-bold tabular-nums text-[#0f4c81]">
                        {ip08.ratio} : 1
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No calculable</p>
                    )}
                  </div>
                </div>

                {ip08.ratio === null && ip08.auxiliares === 0 && ip08.profesores > 0 && (
                  <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="text-[11px] text-amber-700">
                      No hay cargos auxiliares registrados. La relación P/A no puede calcularse (división por cero).
                    </p>
                  </div>
                )}

                <div className="mt-2 pt-2 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    P = Titular, Asociado, Adjunto · A = JTP, Ayudante Graduado, Ayudante No Graduado.
                    Cargos de gestión y «Otros» no se contabilizan.
                  </p>
                </div>

                <div className="flex justify-end mt-2">
                  <EstadoBadge ec={ip08.estadoCalculo} />
                </div>
              </>
            )}
          </div>

          {/* Nota metodológica */}
          <p className="text-[10px] text-slate-400 text-center">
            Indicadores FSD §7 y MOD-AUT §3–5 — Plantel de la carrera.
            IP-01, IP-02, IP-04, IP-09, IP-10, IP-13, R-10, R-12 incluyen solo docentes activos con vinculación APROBADA.
            IP-09: completitud_i = 25 × (C1 + C2 + C3 + C4). IP-10: max(0, 100 − 25×A − 10×M).
            IP-13, R-10 y R-12: alcance facultad completa; DIRECTOR_CARRERA → PARCIAL.
          </p>

        </div>
      )}

      {/* ── Panel: Correr análisis ─────────────────────────────────────── */}
      <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <p className="text-xs font-bold text-slate-700">Análisis explícito de la carrera</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Ejecuta y guarda una evaluación completa. Los resultados quedan disponibles en el historial.
            </p>
          </div>
          <button
            onClick={correrAnalisis}
            disabled={corriendo || !dato}
            className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold bg-[#0f4c81] text-white hover:bg-[#0f4c81]/90 active:bg-[#0f4c81]/80 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {corriendo ? <IcSpinner sm /> : null}
            {corriendo ? 'Ejecutando...' : 'Correr análisis'}
          </button>
        </div>

        {errorAnalisis && (
          <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 mb-3">
            {errorAnalisis}
          </div>
        )}

        {ultimaEjecucion && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs space-y-1 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-emerald-600 font-bold text-[11px]">✓ Guardado</span>
              <EstadoBadge ec={ultimaEjecucion.estadoCalculo} />
              <span className="text-[10px] font-mono text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                {ultimaEjecucion.ejecucionId.slice(0, 8)}…
              </span>
            </div>
            <p className="text-slate-500">{formatFecha(ultimaEjecucion.fechaEjecucion)}</p>
          </div>
        )}

        {/* Exportar carrera */}
        <div className="border-t border-slate-100 pt-3 mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Exportar última ejecución</p>
          {errorExport && <p className="text-[11px] text-red-600 mb-2">{errorExport}</p>}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => exportar('pdf')} disabled={!!exportando} className="flex items-center gap-1 text-[11px] font-semibold text-white bg-[#0f4c81] hover:bg-[#0f4c81]/90 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              {exportando === 'pdf' ? <IcSpinner sm /> : null} PDF
            </button>
            <button onClick={() => exportar('xlsx')} disabled={!!exportando} className="flex items-center gap-1 text-[11px] font-semibold text-[#0f4c81] bg-white border border-[#0f4c81]/30 hover:bg-[#0f4c81]/5 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              {exportando === 'xlsx' ? <IcSpinner sm /> : null} Excel
            </button>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Historial de ejecuciones</p>
            {cargandoHist && <IcSpinner sm />}
          </div>
          {historial && historial.items.length === 0 && !cargandoHist && (
            <p className="text-[11px] text-slate-400 italic">Sin ejecuciones registradas para esta carrera.</p>
          )}
          {historial && historial.items.length > 0 && (
            <div className="space-y-1.5">
              {historial.items.map((item: ItemHistorial) => (
                <div key={item.ejecucionId} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs flex-wrap">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${item.estadoEjecucion === 'COMPLETADO' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {item.estadoEjecucion}
                  </span>
                  {item.estadoCalculo && <EstadoBadge ec={item.estadoCalculo} />}
                  <span className="text-slate-500 text-[11px]">{formatFecha(item.fechaInicio)}</span>
                  <span className="font-mono text-[10px] text-slate-300">{item.ejecucionId.slice(0, 8)}…</span>
                  {item.errores && <span className="text-red-500 text-[10px]">{item.errores}</span>}
                  {item.estadoEjecucion === 'COMPLETADO' && (
                    <div className="ml-auto flex gap-1">
                      <button onClick={() => exportar('pdf', item.ejecucionId)} disabled={!!exportando} className="text-[10px] font-semibold text-[#0f4c81] hover:underline disabled:opacity-40">PDF</button>
                      <button onClick={() => exportar('xlsx', item.ejecucionId)} disabled={!!exportando} className="text-[10px] font-semibold text-[#0f4c81] hover:underline disabled:opacity-40">XLS</button>
                    </div>
                  )}
                </div>
              ))}
              {historial.total > historial.porPagina && (
                <div className="flex items-center justify-between mt-1">
                  <button
                    onClick={() => setPaginaHistorial((p) => Math.max(1, p - 1))}
                    disabled={paginaHistorial <= 1 || cargandoHist}
                    className="text-[10px] font-semibold text-[#0f4c81] hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ← Anterior
                  </button>
                  <span className="text-[10px] text-slate-400">
                    {historial.porPagina * (paginaHistorial - 1) + 1}–{Math.min(historial.porPagina * paginaHistorial, historial.total)} de {historial.total}
                  </span>
                  <button
                    onClick={() => setPaginaHistorial((p) => p + 1)}
                    disabled={paginaHistorial * historial.porPagina >= historial.total || cargandoHist}
                    className="text-[10px] font-semibold text-[#0f4c81] hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Siguiente →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

// ── Exportación con Suspense (requerido por useSearchParams en Next.js 14) ───

export default function TablroCarreraPage() {
  return (
    <Suspense fallback={null}>
      <TablroCarreraInner />
    </Suspense>
  );
}
