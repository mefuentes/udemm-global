'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface FormData {
  nombre: string;
  apellido: string;
  tipoDocumento: string;
  numeroDocumento: string;
  correoElectronico: string;
  telefono: string;
  domicilio: string;
  tituloGrado: string;
  tituloPosgrado: string;
  cargoDeclarado: string;
  justificacionPertinencia: string;
  actividadesProfesionales: string;
  antecedentesAcademicos: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';
const STORAGE_TIPOS_DOCUMENTO = 'docenteTiposDocumento';
const TIPOS_DOCUMENTO_PREDETERMINADOS = ['DNI', 'CUIL', 'Pasaporte', 'LC', 'LE'];

export default function NuevoDocentePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [tiposDocumento, setTiposDocumento] = useState<string[]>(TIPOS_DOCUMENTO_PREDETERMINADOS);
  const [formData, setFormData] = useState<FormData>({
    nombre: '',
    apellido: '',
    tipoDocumento: 'DNI',
    numeroDocumento: '',
    correoElectronico: '',
    telefono: '',
    domicilio: '',
    tituloGrado: '',
    tituloPosgrado: '',
    cargoDeclarado: '',
    justificacionPertinencia: '',
    actividadesProfesionales: '',
    antecedentesAcademicos: ''
  });

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_TIPOS_DOCUMENTO);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
          setTiposDocumento(parsed);
          if (!parsed.includes(formData.tipoDocumento)) {
            setFormData((prev) => ({ ...prev, tipoDocumento: parsed[0] || 'DNI' }));
          }
        }
      } catch {
        // Ignorar si no es JSON válido
      }
    }
  }, []);

  function sanitizeTexto(valor: string) {
    return valor.replace(/[^A-Za-zÀ-ÿ\s]/g, '').toUpperCase();
  }

  function sanitizeNumero(valor: string) {
    return valor.replace(/\D/g, '');
  }

  function actualizarCampo(campo: keyof FormData, valor: string) {
    let actual = valor;

    if (campo === 'nombre' || campo === 'apellido') {
      actual = sanitizeTexto(actual);
    }

    if (campo === 'numeroDocumento' || campo === 'telefono') {
      actual = sanitizeNumero(actual);
    }

    if (campo !== 'correoElectronico' && campo !== 'tipoDocumento') {
      actual = actual.toUpperCase();
    }

    if (campo === 'tipoDocumento') {
      actual = actual.toUpperCase();
    }

    setFormData((prev) => ({ ...prev, [campo]: actual }));
  }

  async function guardar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setExito(null);
    setEnviando(true);

    try {
      const payload = {
        nombre: formData.nombre.trim(),
        apellido: formData.apellido.trim(),
        tipoDocumento: formData.tipoDocumento.trim(),
        numeroDocumento: formData.numeroDocumento.trim(),
        correoElectronico: formData.correoElectronico.trim(),
        telefono: formData.telefono ? formData.telefono.trim() : undefined,
        domicilio: formData.domicilio ? formData.domicilio.trim() : undefined,
        tituloGrado: formData.tituloGrado ? formData.tituloGrado.trim() : undefined,
        tituloPosgrado: formData.tituloPosgrado ? formData.tituloPosgrado.trim() : undefined,
        cargoDeclarado: formData.cargoDeclarado ? formData.cargoDeclarado.trim() : undefined,
        justificacionPertinencia: formData.justificacionPertinencia ? formData.justificacionPertinencia.trim() : undefined,
        actividadesProfesionales: formData.actividadesProfesionales ? formData.actividadesProfesionales.trim() : undefined,
        antecedentesAcademicos: formData.antecedentesAcademicos ? formData.antecedentesAcademicos.trim() : undefined
      };

      const response = await apiFetch(`${API_URL}/docentes`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ message: 'Error desconocido' }));
        throw new Error(body?.message || `Error ${response.status}`);
      }

      const nuevoDocente = await response.json();
      setExito(`Docente ${nuevoDocente.nombre} ${nuevoDocente.apellido} creado con éxito.`);
      setTimeout(() => {
        router.push(`/docentes/${nuevoDocente.id}`);
      }, 1500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="max-w-4xl mx-auto space-y-5">
      <div>
        <Link href="/docentes" className="text-xs text-slate-500 hover:text-slate-700 transition">
          ← Volver al listado
        </Link>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5 mt-1">Docentes</p>
        <h1 className="text-xl font-bold text-slate-800">Nuevo docente</h1>
        <p className="text-sm text-slate-500 mt-0.5">Complete el formulario para crear un nuevo docente.</p>
      </div>

        {error && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {exito && (
          <div className="mb-6 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {exito}
          </div>
        )}

        <form className="space-y-5 rounded-xl bg-white p-6 shadow-sm border border-slate-200" onSubmit={guardar}>
          <fieldset disabled={enviando} className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-3 border-b border-slate-100 pb-2">Datos personales</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  value={formData.nombre}
                  onChange={(e) => actualizarCampo('nombre', e.target.value)}
                  placeholder="Nombre *"
                  required
                  style={{ textTransform: 'uppercase' }}
                  className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[#0f4c81] focus:bg-white focus:ring-1 focus:ring-[#0f4c81]/20 transition"
                />
                <input
                  value={formData.apellido}
                  onChange={(e) => actualizarCampo('apellido', e.target.value)}
                  placeholder="Apellido *"
                  required
                  style={{ textTransform: 'uppercase' }}
                  className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[#0f4c81] focus:bg-white focus:ring-1 focus:ring-[#0f4c81]/20 transition"
                />
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-3 border-b border-slate-100 pb-2">Documento</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm text-slate-500">Tipo de documento *</span>
                  <select
                    value={formData.tipoDocumento}
                    onChange={(e) => actualizarCampo('tipoDocumento', e.target.value)}
                    required
                    className="mt-2 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[#0f4c81] focus:bg-white focus:ring-1 focus:ring-[#0f4c81]/20 transition"
                  >
                    {tiposDocumento.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {tipo}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm text-slate-500">Número de documento *</span>
                  <input
                    value={formData.numeroDocumento}
                    onChange={(e) => actualizarCampo('numeroDocumento', e.target.value)}
                    placeholder="Número de documento *"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    required
                    style={{ textTransform: 'uppercase' }}
                    className="mt-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[#0f4c81] focus:bg-white focus:ring-1 focus:ring-[#0f4c81]/20 transition"
                  />
                </label>
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-3 border-b border-slate-100 pb-2">Contacto</h2>
              <div className="grid gap-4">
                <input
                  type="email"
                  value={formData.correoElectronico}
                  onChange={(e) => actualizarCampo('correoElectronico', e.target.value)}
                  placeholder="Correo electrónico *"
                  required
                  className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[#0f4c81] focus:bg-white focus:ring-1 focus:ring-[#0f4c81]/20 transition"
                />
                <input
                  value={formData.telefono}
                  onChange={(e) => actualizarCampo('telefono', e.target.value)}
                  placeholder="Teléfono"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  style={{ textTransform: 'uppercase' }}
                  className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[#0f4c81] focus:bg-white focus:ring-1 focus:ring-[#0f4c81]/20 transition"
                />
                <input
                  value={formData.domicilio}
                  onChange={(e) => actualizarCampo('domicilio', e.target.value)}
                  placeholder="Domicilio"
                  style={{ textTransform: 'uppercase' }}
                  className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[#0f4c81] focus:bg-white focus:ring-1 focus:ring-[#0f4c81]/20 transition"
                />
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-3 border-b border-slate-100 pb-2">Formación</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  value={formData.tituloGrado}
                  onChange={(e) => actualizarCampo('tituloGrado', e.target.value)}
                  placeholder="Título de grado"
                  style={{ textTransform: 'uppercase' }}
                  className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[#0f4c81] focus:bg-white focus:ring-1 focus:ring-[#0f4c81]/20 transition"
                />
                <input
                  value={formData.tituloPosgrado}
                  onChange={(e) => actualizarCampo('tituloPosgrado', e.target.value)}
                  placeholder="Título de posgrado"
                  style={{ textTransform: 'uppercase' }}
                  className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[#0f4c81] focus:bg-white focus:ring-1 focus:ring-[#0f4c81]/20 transition"
                />
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-3 border-b border-slate-100 pb-2">Cargo y trayectoria</h2>
              <div className="grid gap-4">
                <textarea
                  value={formData.cargoDeclarado}
                  onChange={(e) => actualizarCampo('cargoDeclarado', e.target.value)}
                  placeholder="Cargo declarado"
                  style={{ textTransform: 'uppercase' }}
                  className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[#0f4c81] focus:bg-white focus:ring-1 focus:ring-[#0f4c81]/20 transition"
                  rows={2}
                />
                <textarea
                  value={formData.justificacionPertinencia}
                  onChange={(e) => actualizarCampo('justificacionPertinencia', e.target.value)}
                  placeholder="Justificación de pertinencia"
                  style={{ textTransform: 'uppercase' }}
                  className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[#0f4c81] focus:bg-white focus:ring-1 focus:ring-[#0f4c81]/20 transition"
                  rows={2}
                />
                <textarea
                  value={formData.actividadesProfesionales}
                  onChange={(e) => actualizarCampo('actividadesProfesionales', e.target.value)}
                  placeholder="Actividades profesionales"
                  style={{ textTransform: 'uppercase' }}
                  className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[#0f4c81] focus:bg-white focus:ring-1 focus:ring-[#0f4c81]/20 transition"
                  rows={2}
                />
                <textarea
                  value={formData.antecedentesAcademicos}
                  onChange={(e) => actualizarCampo('antecedentesAcademicos', e.target.value)}
                  placeholder="Antecedentes académicos"
                  style={{ textTransform: 'uppercase' }}
                  className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[#0f4c81] focus:bg-white focus:ring-1 focus:ring-[#0f4c81]/20 transition"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-4">
              <button
                type="submit"
                disabled={enviando}
                className="rounded-md bg-[#0f4c81] px-4 py-2 text-sm text-white font-medium hover:bg-[#0a3960] disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {enviando ? 'Guardando...' : 'Guardar docente'}
              </button>
              <Link
                href="/docentes"
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 font-medium hover:bg-slate-50 transition"
              >
                Cancelar
              </Link>
            </div>
          </fieldset>

          <p className="text-xs text-slate-400 pt-2">Los campos marcados con * son obligatorios.</p>
        </form>
    </main>
  );
}
