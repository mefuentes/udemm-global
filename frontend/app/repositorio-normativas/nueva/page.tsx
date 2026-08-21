'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

const ROLES_GESTION = ['SECRETARIA_ACADEMICA', 'DECANO', 'RECTORADO', 'ADMINISTRADOR_SISTEMA'];
const VIGENCIAS = ['VIGENTE', 'DEROGADA', 'SUSPENDIDA', 'REEMPLAZADA'] as const;
const MAX_MB    = 15;
const MAX_BYTES = MAX_MB * 1024 * 1024;

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface TipoOpcion { id: string; nombre: string }

interface FormData {
  titulo: string;
  tipoNormativaId: string;
  fechaEmision: string;
  areaEmisora: string;
  numeroNorma: string;
  anio: string;
  vigencia: string;
}

interface FormErrors {
  titulo?: string;
  tipoNormativaId?: string;
  fechaEmision?: string;
  areaEmisora?: string;
  numeroNorma?: string;
  anio?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const HOY_ISO    = new Date().toISOString().slice(0, 10);
const ANO_ACTUAL = String(new Date().getFullYear()).slice(-2);

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function campo(label: string, required: boolean, error?: string, children?: React.ReactNode) {
  return (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600 font-medium">{error}</p>}
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function NuevaNormativaPage() {
  const { usuario, obtenerTokenActual } = useAuth();
  const router       = useRouter();
  const searchParams = useSearchParams();

  const tipoIdParam  = searchParams?.get('tipoId') ?? '';
  const nombreParam  = searchParams?.get('nombre') ?? '';

  const rol            = usuario?.rol?.nombre ?? '';
  const puedeGestionar = ROLES_GESTION.includes(rol);

  useEffect(() => {
    if (usuario !== undefined && !puedeGestionar) router.replace('/repositorio-normativas');
  }, [usuario, puedeGestionar, router]);

  // ── Estado ──────────────────────────────────────────────────────────────────
  const [tipos, setTipos]                   = useState<TipoOpcion[]>([]);
  const [areasEmisoras, setAreasEmisoras]   = useState<TipoOpcion[]>([]);
  const [cargandoOpciones, setCargandoOpciones] = useState(true);

  const [form, setForm] = useState<FormData>({
    titulo: '', tipoNormativaId: tipoIdParam, fechaEmision: '',
    areaEmisora: '', numeroNorma: '', anio: ANO_ACTUAL, vigencia: 'VIGENTE',
  });
  const [errors, setErrors]         = useState<FormErrors>({});
  const [tags, setTags]             = useState<string[]>([]);
  const [tagInput, setTagInput]     = useState('');
  const [archivo, setArchivo]       = useState<File | null>(null);
  const [errorArchivo, setErrorArchivo] = useState('');
  const [guardando, setGuardando]   = useState(false);
  const [exito, setExito]           = useState('');
  const [errorGeneral, setErrorGeneral] = useState('');

  const tagRef     = useRef<HTMLInputElement>(null);
  const archivoRef = useRef<HTMLInputElement>(null);

  // ── Cargar opciones ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!puedeGestionar) return;
    const h = { Authorization: `Bearer ${obtenerTokenActual()}` };
    Promise.all([
      fetch(`${API}/normativas/tipos`, { headers: h }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/configuracion/tablas-maestras/tipos-area-emisora/activos`, { headers: h }).then(r => r.ok ? r.json() : []),
    ])
      .then(([t, a]) => {
        setTipos(Array.isArray(t) ? t : []);
        setAreasEmisoras(Array.isArray(a) ? a : []);
      })
      .catch(() => {})
      .finally(() => setCargandoOpciones(false));
  }, [puedeGestionar, obtenerTokenActual]);

  // ── Handlers form ───────────────────────────────────────────────────────────
  function handleChange(field: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) setErrors(prev => ({ ...prev, [field]: undefined }));
    setErrorGeneral('');
  }

  // ── Tags ────────────────────────────────────────────────────────────────────
  function addTag() {
    const val = tagInput.trim().toUpperCase();
    if (!val) return;
    if (!tags.includes(val)) setTags(prev => [...prev, val]);
    setTagInput('');
    tagRef.current?.focus();
  }

  function removeTag(tag: string) { setTags(prev => prev.filter(t => t !== tag)); }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
    if (e.key === 'Backspace' && !tagInput && tags.length > 0) setTags(prev => prev.slice(0, -1));
  }

  // ── Archivo ─────────────────────────────────────────────────────────────────
  function handleArchivoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setErrorArchivo('');
    setErrorGeneral('');

    if (!file) { setArchivo(null); return; }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrorArchivo('ERROR: EL FORMATO DE ARCHIVO NO ES VÁLIDO. SOLO SE PERMITEN DOCUMENTOS PDF.');
      setArchivo(null);
      if (archivoRef.current) archivoRef.current.value = '';
      return;
    }

    if (file.size > MAX_BYTES) {
      setErrorArchivo(`ERROR: EL ARCHIVO EXCEDE EL TAMAÑO MÁXIMO PERMITIDO (${MAX_MB} MB).`);
      setArchivo(null);
      if (archivoRef.current) archivoRef.current.value = '';
      return;
    }

    setArchivo(file);
  }

  function quitarArchivo() {
    setArchivo(null);
    setErrorArchivo('');
    if (archivoRef.current) archivoRef.current.value = '';
  }

  // ── Validación ──────────────────────────────────────────────────────────────
  function validar(): FormErrors {
    const e: FormErrors = {};
    if (!form.titulo.trim())                          e.titulo          = 'El título es obligatorio';
    else if (form.titulo.trim().length > 200)         e.titulo          = 'Máximo 200 caracteres';
    if (!form.tipoNormativaId)                        e.tipoNormativaId = 'El tipo de normativa es obligatorio';
    if (!form.fechaEmision)                           e.fechaEmision    = 'La fecha de emisión es obligatoria';
    else if (form.fechaEmision > HOY_ISO)             e.fechaEmision    = 'La fecha no puede ser futura';
    if (!form.areaEmisora)                            e.areaEmisora     = 'El área emisora es obligatoria';
    if (!form.numeroNorma.trim())                     e.numeroNorma     = 'El N° de norma es obligatorio';
    else if (!/^\d+$/.test(form.numeroNorma.trim()))  e.numeroNorma     = 'Debe ser numérico (ej: 002, 31, 4702)';
    if (!form.anio)                                   e.anio            = 'El año es obligatorio';
    else if (!/^\d{2}$/.test(form.anio))              e.anio            = 'Debe tener exactamente 2 dígitos (ej: 26)';
    return e;
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    const errs = validar();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    if (!archivo) {
      setErrorArchivo('ERROR: EL ARCHIVO PDF ES OBLIGATORIO.');
      return;
    }

    setGuardando(true);
    setErrorGeneral('');

    const fd = new FormData();
    fd.append('titulo',          form.titulo.trim().toUpperCase());
    fd.append('tipoNormativaId', form.tipoNormativaId);
    fd.append('fechaEmision',    form.fechaEmision);
    fd.append('areaEmisora',     form.areaEmisora);
    fd.append('numeroNorma',     form.numeroNorma.trim());
    fd.append('anio',            String(parseInt(form.anio, 10)));
    fd.append('vigencia',        form.vigencia);
    if (tags.length > 0) fd.append('palabrasClave', tags.join(','));
    fd.append('archivo', archivo);

    try {
      const res = await fetch(`${API}/normativas`, {
        method: 'POST',
        // Sin Content-Type — el navegador establece multipart/form-data con boundary automáticamente
        headers: { Authorization: `Bearer ${obtenerTokenActual()}` },
        body: fd,
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 409) {
        setErrorGeneral('ERROR: YA EXISTE UNA NORMA REGISTRADA CON ESE NÚMERO Y AÑO.');
        return;
      }
      if (!res.ok) {
        const msg = Array.isArray(data?.message)
          ? data.message.join(' | ')
          : (data?.message ?? 'Error al registrar la normativa');
        // Los errores de archivo del backend van a errorArchivo; los demás a errorGeneral
        const esErrorArchivo = typeof msg === 'string' && (
          msg.includes('FORMATO') || msg.includes('EXCEDE') || msg.includes('PDF ES OBLIGATORIO')
        );
        if (esErrorArchivo) setErrorArchivo(msg);
        else setErrorGeneral(msg);
        return;
      }

      setExito('NORMATIVA REGISTRADA CORRECTAMENTE.');
      const tipoId  = data.tipoNormativa?.id     ?? form.tipoNormativaId;
      const tipoNom = data.tipoNormativa?.nombre  ?? nombreParam;
      setTimeout(() => {
        router.push(`/repositorio-normativas/${tipoId}?nombre=${encodeURIComponent(tipoNom)}`);
      }, 900);
    } catch {
      setErrorGeneral('Error de conexión. Verificá que el servidor esté disponible.');
    } finally {
      setGuardando(false);
    }
  }

  // ── Guard ───────────────────────────────────────────────────────────────────
  if (usuario === undefined || !puedeGestionar) return null;

  const volverHref = tipoIdParam
    ? `/repositorio-normativas/${tipoIdParam}?nombre=${encodeURIComponent(nombreParam)}`
    : '/repositorio-normativas';

  const inputCls = (err?: string) =>
    `w-full px-3 py-2.5 rounded-lg border text-sm bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/30 focus:border-[#0f4c81] ${
      err ? 'border-red-300 bg-red-50' : 'border-slate-200 hover:border-slate-300'
    }`;

  const disabled = guardando || !!exito;

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* ── Encabezado ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Link href="/repositorio-normativas" className="text-xs text-[#0f4c81] hover:underline font-medium">
              Repositorio de Normativas
            </Link>
            <span className="text-slate-300 text-xs">/</span>
            {tipoIdParam && nombreParam && (
              <>
                <Link href={volverHref} className="text-xs text-[#0f4c81] hover:underline font-medium truncate max-w-[160px]">
                  {nombreParam}
                </Link>
                <span className="text-slate-300 text-xs">/</span>
              </>
            )}
            <span className="text-xs text-slate-500">Cargar Normativa</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">CARGAR NORMATIVA</h1>
          <p className="mt-1 text-sm text-slate-500 font-medium tracking-wide">
            REPOSITORIO DE NORMATIVAS — Alta de normativa
          </p>
        </div>
        <Link
          href={volverHref}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </Link>
      </div>

      {/* ── Éxito ───────────────────────────────────────────────────────────── */}
      {exito && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-xl flex items-center gap-2 font-medium">
          <svg className="w-4 h-4 flex-shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {exito}
        </div>
      )}

      {/* ── Error general ───────────────────────────────────────────────────── */}
      {errorGeneral && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {errorGeneral}
        </div>
      )}

      {/* ── Formulario ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

        {/* ─ INFORMACIÓN PRINCIPAL ─────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">INFORMACIÓN PRINCIPAL</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          {campo('Título', true, errors.titulo,
            <input
              type="text"
              className={inputCls(errors.titulo)}
              placeholder="Ej: REGLAMENTO DE GESTIÓN ACADÉMICA"
              value={form.titulo}
              onChange={e => handleChange('titulo', e.target.value)}
              disabled={disabled}
              maxLength={200}
            />
          )}
          {campo('Tipo de normativa', true, errors.tipoNormativaId,
            <select
              className={inputCls(errors.tipoNormativaId)}
              value={form.tipoNormativaId}
              onChange={e => handleChange('tipoNormativaId', e.target.value)}
              disabled={disabled || cargandoOpciones}
              data-no-uppercase="true"
            >
              <option value="">{cargandoOpciones ? 'Cargando...' : '— Seleccionar tipo —'}</option>
              {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          )}
        </div>

        {/* ─ IDENTIFICACIÓN ────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-b border-slate-100 bg-slate-50">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">IDENTIFICACIÓN</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {campo('N° de norma', true, errors.numeroNorma,
              <input
                type="text" inputMode="numeric" pattern="[0-9]*"
                className={inputCls(errors.numeroNorma)}
                placeholder="Ej: 002"
                value={form.numeroNorma}
                onChange={e => handleChange('numeroNorma', e.target.value.replace(/\D/g, ''))}
                disabled={disabled} data-no-uppercase="true"
              />
            )}
            {campo('Año (2 dígitos)', true, errors.anio,
              <input
                type="text" inputMode="numeric" pattern="[0-9]*"
                className={inputCls(errors.anio)}
                placeholder="Ej: 26"
                value={form.anio}
                onChange={e => handleChange('anio', e.target.value.replace(/\D/g, '').slice(0, 2))}
                disabled={disabled} maxLength={2} data-no-uppercase="true"
              />
            )}
          </div>
          {campo('Fecha de emisión', true, errors.fechaEmision,
            <input
              type="date" className={inputCls(errors.fechaEmision)}
              value={form.fechaEmision} max={HOY_ISO}
              onChange={e => handleChange('fechaEmision', e.target.value)}
              disabled={disabled} data-no-uppercase="true"
            />
          )}
          {campo('Área emisora', true, errors.areaEmisora,
            <select
              className={inputCls(errors.areaEmisora)}
              value={form.areaEmisora}
              onChange={e => handleChange('areaEmisora', e.target.value)}
              disabled={disabled || cargandoOpciones} data-no-uppercase="true"
            >
              <option value="">{cargandoOpciones ? 'Cargando...' : '— Seleccionar área emisora —'}</option>
              {areasEmisoras.map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
            </select>
          )}
          {campo('Vigencia', true, undefined,
            <select
              className={inputCls()} value={form.vigencia}
              onChange={e => handleChange('vigencia', e.target.value)}
              disabled={disabled} data-no-uppercase="true"
            >
              {VIGENCIAS.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
        </div>

        {/* ─ PALABRAS CLAVE ────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-b border-slate-100 bg-slate-50">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">PALABRAS CLAVE</h2>
        </div>
        <div className="px-6 py-5">
          <div className="min-h-[56px] px-3 py-2 rounded-lg border border-slate-200 hover:border-slate-300 bg-white transition-colors flex flex-wrap gap-2 items-center focus-within:ring-2 focus-within:ring-[#0f4c81]/30 focus-within:border-[#0f4c81]">
            {tags.map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0f4c81]/10 text-[#0f4c81] text-xs font-semibold">
                {tag}
                <button type="button" onClick={() => removeTag(tag)} disabled={disabled}
                  className="ml-0.5 hover:text-red-600 transition-colors leading-none" aria-label={`Eliminar ${tag}`}>
                  ×
                </button>
              </span>
            ))}
            <input
              ref={tagRef} type="text"
              className="flex-1 min-w-[120px] text-sm bg-transparent outline-none placeholder-slate-400"
              placeholder={tags.length === 0 ? 'Escribir y presionar Enter para agregar...' : 'Agregar más...'}
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={addTag}
              disabled={disabled} data-no-uppercase="true"
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            Presioná Enter o coma para agregar cada etiqueta. Backspace elimina la última.
          </p>
        </div>

        {/* ─ ARCHIVO PDF ───────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-b border-slate-100 bg-slate-50">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            ARCHIVO PDF <span className="text-red-500">*</span>
          </h2>
        </div>
        <div className="px-6 py-5 space-y-3">

          {/* Zona de carga / archivo seleccionado */}
          {!archivo ? (
            <label className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed transition-colors cursor-pointer px-6 py-8 ${
              errorArchivo
                ? 'border-red-300 bg-red-50 hover:border-red-400'
                : 'border-slate-200 bg-slate-50 hover:border-[#0f4c81]/40 hover:bg-blue-50/30'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <input
                ref={archivoRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleArchivoChange}
                disabled={disabled}
              />
              <svg className={`w-10 h-10 ${errorArchivo ? 'text-red-400' : 'text-slate-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.25}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-700">
                  Hacé clic para seleccionar el archivo PDF
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Solo archivos .pdf — máximo {MAX_MB} MB
                </p>
              </div>
            </label>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{archivo.name}</p>
                <p className="text-xs text-slate-500">{formatBytes(archivo.size)}</p>
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={quitarArchivo}
                  className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Quitar archivo"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Error de archivo */}
          {errorArchivo && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-xs text-red-700 font-medium leading-relaxed">{errorArchivo}</p>
            </div>
          )}
        </div>

        {/* ─ PIE ───────────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <p className="text-[10px] text-slate-400 font-medium">
            Los campos marcados con * son obligatorios
          </p>
          <div className="flex items-center gap-3">
            <Link
              href={volverHref}
              className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all"
            >
              CANCELAR
            </Link>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={disabled}
              className="px-5 py-2 rounded-lg bg-[#0f4c81] hover:bg-[#0d3f6d] text-white text-sm font-bold tracking-wide transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {guardando && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {guardando ? 'REGISTRANDO...' : 'REGISTRAR NORMATIVA'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
