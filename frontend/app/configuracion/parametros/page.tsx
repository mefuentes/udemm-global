'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';

interface Parametro { id: string; clave: string; valor: string; descripcion: string | null; }

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';
const INPUT = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#0f4c81] focus:ring-1 focus:ring-[#0f4c81]/20 transition';

const LABELS: Record<string, string> = {
  nombreInstitucion: 'Nombre de la Institución',
  siglaInstitucion: 'Sigla Institucional',
  correoSoporte: 'Correo de Soporte',
  telefonoInstitucional: 'Teléfono Institucional',
  colorPrimario: 'Color Primario',
  colorSecundario: 'Color Secundario',
};

export default function ParametrosPage() {
  const { obtenerTokenActual } = useAuth();
  const [parametros, setParametros] = useState<Parametro[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${obtenerTokenActual()}` });

  async function cargar() {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/configuracion/parametros`, { headers: headers() });
      if (!res.ok) throw new Error('Error al cargar parámetros');
      const data: Parametro[] = await res.json();
      setParametros(data);
      setValores(Object.fromEntries(data.map(p => [p.clave, p.valor])));
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  useEffect(() => { cargar(); }, []);

  async function guardar() {
    setSubmitting(true); setError(null); setExito(null);
    try {
      const payload = { parametros: Object.entries(valores).map(([clave, valor]) => ({ clave, valor })) };
      const res = await fetch(`${API}/configuracion/parametros`, { method: 'PATCH', headers: headers(), body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Error al guardar');
      setExito('Parámetros guardados correctamente.');
      cargar();
    } catch (e) { setError((e as Error).message); }
    finally { setSubmitting(false); setTimeout(() => setExito(null), 3000); }
  }

  const esColor = (clave: string) => clave.toLowerCase().includes('color');

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Configuración</p>
        <h1 className="text-xl font-bold text-slate-800">Parámetros Generales</h1>
        <p className="text-sm text-slate-500 mt-0.5">Configuración institucional centralizada del sistema.</p>
      </div>

      {exito && <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{exito}</div>}
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="text-slate-500 text-sm">Cargando parámetros...</div>
      ) : (
        <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
          <div className="grid gap-4 sm:grid-cols-2">
            {parametros.map(p => (
              <div key={p.clave}>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  {LABELS[p.clave] ?? p.clave}
                </label>
                {p.descripcion && <p className="text-xs text-slate-400 mb-1">{p.descripcion}</p>}
                {esColor(p.clave) ? (
                  <div className="flex items-center gap-2">
                    <input type="color" value={valores[p.clave] ?? '#000000'}
                      onChange={e => setValores(v => ({ ...v, [p.clave]: e.target.value }))}
                      className="h-9 w-14 cursor-pointer rounded border border-slate-300 p-0.5" />
                    <input type="text" value={valores[p.clave] ?? ''}
                      onChange={e => setValores(v => ({ ...v, [p.clave]: e.target.value }))}
                      className={INPUT + ' flex-1'} placeholder="#000000" />
                  </div>
                ) : (
                  <input type={p.clave === 'correoSoporte' ? 'email' : 'text'}
                    data-no-uppercase={p.clave === 'correoSoporte' ? 'true' : undefined}
                    value={valores[p.clave] ?? ''}
                    onChange={e => setValores(v => ({ ...v, [p.clave]: e.target.value }))}
                    className={INPUT} />
                )}
              </div>
            ))}
          </div>

          {valores.colorPrimario && valores.colorSecundario && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Preview de colores</p>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded border border-slate-200 shadow-sm" style={{ backgroundColor: valores.colorPrimario }} />
                  <span className="text-xs text-slate-600">Primario {valores.colorPrimario}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded border border-slate-200 shadow-sm" style={{ backgroundColor: valores.colorSecundario }} />
                  <span className="text-xs text-slate-600">Secundario {valores.colorSecundario}</span>
                </div>
              </div>
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <button onClick={guardar} disabled={submitting}
              className="rounded-md bg-[#0f4c81] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a3960] disabled:opacity-50 transition">
              {submitting ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
