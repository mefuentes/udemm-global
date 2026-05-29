'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';

interface Docente {
  id: string;
  nombre: string;
  apellido: string;
  tipoDocumento: string;
  numeroDocumento: string;
  correoElectronico: string;
  telefono?: string;
  domicilio?: string;
  tituloGrado?: string;
  tituloPosgrado?: string;
  cargoDeclarado?: string;
  justificacionPertinencia?: string;
  actividadesProfesionales?: string;
  antecedentesAcademicos?: string;
  activo: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

interface EditarPageProps {
  params: { id: string };
}

export default function EditarDocentePage({ params }: EditarPageProps) {
  const router = useRouter();
  const { token, obtenerTokenActual } = useAuth();
  const { id } = params;
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [formData, setFormData] = useState<Partial<Docente>>({});

  useEffect(() => {
    if (!token) return;
    cargarDocente();
  }, [token, id]);

  async function cargarDocente() {
    try {
      setCargando(true);
      setError(null);
      const tokenActual = obtenerTokenActual();
      if (!tokenActual) {
        throw new Error('No hay sesión activa');
      }

      const response = await fetch(`${API_URL}/docentes/${id}`, {
        headers: {
          Authorization: `Bearer ${tokenActual}`
        }
      });

      if (!response.ok) {
        throw new Error('No se pudo cargar el docente');
      }

      const data = await response.json();
      setFormData(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }

  function actualizarCampo(campo: string, valor: string) {
    setFormData((prev) => ({ ...prev, [campo]: valor }));
  }

  async function guardar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setExito(null);
    setEnviando(true);

    try {
      const payload = {
        nombre: formData.nombre?.trim(),
        apellido: formData.apellido?.trim(),
        tipoDocumento: formData.tipoDocumento?.trim(),
        numeroDocumento: formData.numeroDocumento?.trim(),
        correoElectronico: formData.correoElectronico?.trim(),
        telefono: formData.telefono ? formData.telefono.trim() : undefined,
        domicilio: formData.domicilio ? formData.domicilio.trim() : undefined,
        tituloGrado: formData.tituloGrado ? formData.tituloGrado.trim() : undefined,
        tituloPosgrado: formData.tituloPosgrado ? formData.tituloPosgrado.trim() : undefined,
        cargoDeclarado: formData.cargoDeclarado ? formData.cargoDeclarado.trim() : undefined,
        justificacionPertinencia: formData.justificacionPertinencia ? formData.justificacionPertinencia.trim() : undefined,
        actividadesProfesionales: formData.actividadesProfesionales ? formData.actividadesProfesionales.trim() : undefined,
        antecedentesAcademicos: formData.antecedentesAcademicos ? formData.antecedentesAcademicos.trim() : undefined
      };

      const tokenActual = obtenerTokenActual();
      if (!tokenActual) {
        throw new Error('No hay sesión activa');
      }

      const response = await fetch(`${API_URL}/docentes/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenActual}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ message: 'Error desconocido' }));
        throw new Error(body?.message || `Error ${response.status}`);
      }

      const actualizado = await response.json();
      setFormData(actualizado);
      setExito(`Docente ${actualizado.nombre} ${actualizado.apellido} actualizado con éxito.`);
      setTimeout(() => {
        router.push(`/docentes/${id}`);
      }, 1500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (!token) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
        <div className="mx-auto max-w-2xl rounded-3xl bg-white p-8 shadow-lg shadow-slate-200/50">
          <h1 className="text-3xl font-semibold text-slate-900">Editar docente</h1>
          <p className="mt-2 text-slate-600">Necesitas un JWT para editar docentes.</p>
          <Link href="/docentes" className="mt-6 inline-block rounded-full bg-slate-900 px-6 py-3 text-white font-semibold hover:bg-slate-800">
            Volver al listado
          </Link>
        </div>
      </main>
    );
  }

  if (cargando) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
        <div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-lg shadow-slate-200/50">
          <p className="text-slate-600">Cargando docente...</p>
        </div>
      </main>
    );
  }

  if (error && !formData.id) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
          <Link href="/docentes" className="inline-block rounded-full bg-slate-900 px-6 py-3 text-white font-semibold hover:bg-slate-800">
            Volver al listado
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link href={`/docentes/${id}`} className="text-slate-600 hover:text-slate-900 font-semibold">
              ← Volver a detalle
            </Link>
            <h1 className="mt-4 text-3xl font-semibold text-slate-900">
              Editar {formData.nombre} {formData.apellido}
            </h1>
            <p className="mt-2 text-slate-600">Actualiza los datos del docente.</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {exito && (
          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {exito}
          </div>
        )}

        <form className="space-y-6 rounded-3xl bg-white p-8 shadow-lg shadow-slate-200/50" onSubmit={guardar}>
          <fieldset disabled={enviando} className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Datos personales</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  value={formData.nombre ?? ''}
                  onChange={(e) => actualizarCampo('nombre', e.target.value)}
                  placeholder="Nombre"
                  required
                  className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-900 focus:bg-white"
                />
                <input
                  value={formData.apellido ?? ''}
                  onChange={(e) => actualizarCampo('apellido', e.target.value)}
                  placeholder="Apellido"
                  required
                  className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-900 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Documento</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  value={formData.tipoDocumento ?? ''}
                  onChange={(e) => actualizarCampo('tipoDocumento', e.target.value)}
                  placeholder="Tipo de documento"
                  required
                  className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-900 focus:bg-white"
                />
                <input
                  value={formData.numeroDocumento ?? ''}
                  onChange={(e) => actualizarCampo('numeroDocumento', e.target.value)}
                  placeholder="Número de documento"
                  required
                  className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-900 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Contacto</h2>
              <div className="grid gap-4">
                <input
                  type="email"
                  value={formData.correoElectronico ?? ''}
                  onChange={(e) => actualizarCampo('correoElectronico', e.target.value)}
                  placeholder="Correo electrónico"
                  required
                  className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-900 focus:bg-white"
                />
                <input
                  value={formData.telefono ?? ''}
                  onChange={(e) => actualizarCampo('telefono', e.target.value)}
                  placeholder="Teléfono"
                  className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-900 focus:bg-white"
                />
                <input
                  value={formData.domicilio ?? ''}
                  onChange={(e) => actualizarCampo('domicilio', e.target.value)}
                  placeholder="Domicilio"
                  className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-900 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Formación</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  value={formData.tituloGrado ?? ''}
                  onChange={(e) => actualizarCampo('tituloGrado', e.target.value)}
                  placeholder="Título de grado"
                  className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-900 focus:bg-white"
                />
                <input
                  value={formData.tituloPosgrado ?? ''}
                  onChange={(e) => actualizarCampo('tituloPosgrado', e.target.value)}
                  placeholder="Título de posgrado"
                  className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-900 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Cargo y trayectoria</h2>
              <div className="grid gap-4">
                <textarea
                  value={formData.cargoDeclarado ?? ''}
                  onChange={(e) => actualizarCampo('cargoDeclarado', e.target.value)}
                  placeholder="Cargo declarado"
                  className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-900 focus:bg-white"
                  rows={2}
                />
                <textarea
                  value={formData.justificacionPertinencia ?? ''}
                  onChange={(e) => actualizarCampo('justificacionPertinencia', e.target.value)}
                  placeholder="Justificación de pertinencia"
                  className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-900 focus:bg-white"
                  rows={2}
                />
                <textarea
                  value={formData.actividadesProfesionales ?? ''}
                  onChange={(e) => actualizarCampo('actividadesProfesionales', e.target.value)}
                  placeholder="Actividades profesionales"
                  className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-900 focus:bg-white"
                  rows={2}
                />
                <textarea
                  value={formData.antecedentesAcademicos ?? ''}
                  onChange={(e) => actualizarCampo('antecedentesAcademicos', e.target.value)}
                  placeholder="Antecedentes académicos"
                  className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-900 focus:bg-white"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-4">
              <button
                type="submit"
                disabled={enviando}
                className="rounded-full bg-slate-900 px-6 py-3 text-white font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {enviando ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <Link
                href={`/docentes/${id}`}
                className="rounded-full border border-slate-300 bg-white px-6 py-3 text-slate-700 font-semibold hover:bg-slate-50"
              >
                Cancelar
              </Link>
            </div>
          </fieldset>
        </form>
      </div>
    </main>
  );
}
