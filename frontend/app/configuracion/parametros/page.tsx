'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { normalizarMayusculas } from '@/lib/normalizarMayusculas';
import { invalidarCacheParametros } from '@/lib/parametros';

interface Parametro { id: string; clave: string; valor: string; descripcion: string | null; }

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';
const INPUT = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#0f4c81] focus:ring-1 focus:ring-[#0f4c81]/20 transition';

const LABELS: Record<string, string> = {
  nombreInstitucion:  'Nombre de la Institución',
  siglaInstitucion:   'Sigla Institucional',
  cicloLectivoActual: 'Ciclo Lectivo Actual',
  correoSoporte:      'Correo de Soporte',
};

const CLAVES_CICLO = new Set(['cicloLectivoActual']);

export default function ParametrosPage() {
  const [parametros, setParametros] = useState<Parametro[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  // Logo
  const [logoActual, setLogoActual] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoSubiendo, setLogoSubiendo] = useState(false);
  const [logoExito, setLogoExito] = useState<string | null>(null);
  const inputLogoRef = useRef<HTMLInputElement>(null);

  async function cargar() {
    setLoading(true); setError(null);
    try {
      const [resParam, resLogo] = await Promise.all([
        apiFetch(`${API}/configuracion/parametros`),
        apiFetch(`${API}/configuracion/parametros/logo`),
      ]);
      if (!resParam.ok) throw new Error('Error al cargar parámetros');
      const data: Parametro[] = await resParam.json();
      setParametros(data);
      setValores(Object.fromEntries(data.map(p => [p.clave, p.valor])));
      if (resLogo.ok) {
        const { valor } = await resLogo.json() as { valor: string | null };
        setLogoActual(valor ?? null);
      }
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  useEffect(() => { cargar(); }, []);

  async function guardar() {
    setSubmitting(true); setError(null); setExito(null);
    // Validar ciclo lectivo antes de guardar
    const ciclo = valores['cicloLectivoActual'];
    if (ciclo !== undefined && ciclo !== '' && !/^\d{4}$/.test(ciclo)) {
      setError('El ciclo lectivo debe ser exactamente 4 dígitos numéricos.');
      setSubmitting(false);
      return;
    }

    try {
      const payload = { parametros: Object.entries(valores).map(([clave, valor]) => ({ clave, valor })) };
      const res = await apiFetch(`${API}/configuracion/parametros`, { method: 'PATCH', body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Error al guardar');
      invalidarCacheParametros();
      setExito('Parámetros guardados correctamente.');
      cargar();
    } catch (e) { setError((e as Error).message); }
    finally { setSubmitting(false); setTimeout(() => setExito(null), 3000); }
  }

  function seleccionarLogo(e: React.ChangeEvent<HTMLInputElement>) {
    setLogoError(null); setLogoExito(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setLogoError('Solo se aceptan archivos PNG o JPEG.');
      return;
    }
    if (file.size > 200 * 1024) {
      setLogoError('El archivo no puede superar los 200 KB.');
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = ev => setLogoPreview(ev.target?.result as string ?? null);
    reader.readAsDataURL(file);
  }

  async function subirLogo() {
    if (!logoFile) return;
    setLogoSubiendo(true); setLogoError(null); setLogoExito(null);
    try {
      const form = new FormData();
      form.append('logo', logoFile);
      const res = await apiFetch(`${API}/configuracion/parametros/logo`, { method: 'POST', body: form });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error((j as { message?: string }).message ?? 'Error al subir el logo'); }
      const { valor } = await res.json() as { valor: string };
      setLogoActual(valor);
      setLogoPreview(null);
      setLogoFile(null);
      if (inputLogoRef.current) inputLogoRef.current.value = '';
      invalidarCacheParametros();
      setLogoExito('Logo actualizado correctamente.');
      setTimeout(() => setLogoExito(null), 3000);
    } catch (e) { setLogoError((e as Error).message); }
    finally { setLogoSubiendo(false); }
  }

  const CLAVES_NORMALIZAR = new Set(['nombreInstitucion', 'siglaInstitucion']);

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
        <>
        <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
          <div className="grid gap-4 sm:grid-cols-2">
            {parametros.map(p => (
              <div key={p.clave}>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  {LABELS[p.clave] ?? p.clave}
                </label>
                {p.descripcion && <p className="text-xs text-slate-400 mb-1">{p.descripcion}</p>}
                {CLAVES_CICLO.has(p.clave) ? (
                  <div>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={valores[p.clave] ?? ''}
                      onChange={e => {
                        const solo = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setValores(v => ({ ...v, [p.clave]: solo }));
                      }}
                      placeholder={String(new Date().getFullYear())}
                      className={INPUT + (valores[p.clave] && !/^\d{4}$/.test(valores[p.clave]) ? ' border-red-400' : '')}
                    />
                    {valores[p.clave] && !/^\d{4}$/.test(valores[p.clave]) && (
                      <p className="mt-1 text-xs text-red-600">Debe ser exactamente 4 dígitos numéricos.</p>
                    )}
                  </div>
                ) : (
                  <input type={p.clave === 'correoSoporte' ? 'email' : 'text'}
                    data-no-uppercase="true"
                    value={valores[p.clave] ?? ''}
                    onChange={e => setValores(v => ({
                      ...v,
                      [p.clave]: CLAVES_NORMALIZAR.has(p.clave) ? normalizarMayusculas(e.target.value) : e.target.value
                    }))}
                    className={INPUT} />
                )}
              </div>
            ))}
          </div>

          <div className="mt-5 flex justify-end">
            <button onClick={guardar} disabled={submitting}
              className="rounded-md bg-[#0f4c81] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a3960] disabled:opacity-50 transition">
              {submitting ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>

        {/* ── Sección: Logo Institucional ── */}
        <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200 mt-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Logo Institucional</h2>
          <p className="text-xs text-slate-400 mb-4">PNG o JPG · máx. 200 KB · aparece en encabezados de PDF y Excel.</p>

          {logoExito && <div className="mb-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{logoExito}</div>}
          {logoError && <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{logoError}</div>}

          <div className="flex flex-wrap items-start gap-6">
            {/* Preview actual o del archivo seleccionado */}
            <div className="flex-shrink-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                {logoPreview ? 'Vista previa' : 'Logo actual'}
              </p>
              <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
                {(logoPreview ?? logoActual) ? (
                  <img src={logoPreview ?? logoActual!} alt="Logo institucional" className="max-h-20 max-w-20 object-contain rounded" />
                ) : (
                  <span className="text-xs text-slate-400 text-center px-2">Sin logo configurado</span>
                )}
              </div>
            </div>

            {/* Controles */}
            <div className="flex flex-col gap-2 justify-center pt-5">
              <input
                ref={inputLogoRef}
                type="file"
                accept="image/png,image/jpeg"
                onChange={seleccionarLogo}
                className="text-xs text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
              {logoFile && (
                <button
                  onClick={subirLogo}
                  disabled={logoSubiendo}
                  className="rounded-md bg-[#0f4c81] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#0a3960] disabled:opacity-50 transition w-fit">
                  {logoSubiendo ? 'Subiendo...' : 'Confirmar logo'}
                </button>
              )}
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
