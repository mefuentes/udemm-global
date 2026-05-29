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
  fechaActualizacion: string;
  usuario?: {
    id: string;
    correoElectronico: string;
    rol: {
      id: string;
      nombre: string;
    };
  };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

interface DocentePageProps {
  params: { id: string };
}

export default function DetallDocentePage({ params }: DocentePageProps) {
  const router = useRouter();
  const { token, obtenerTokenActual, usuario } = useAuth();
  const { id } = params;
  const [docente, setDocente] = useState<Docente | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

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
      setDocente(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }

  async function darDeBaja() {
    if (!docente) return;
    if (!window.confirm('¿Dar de baja este docente? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      setError(null);
      const tokenActual = obtenerTokenActual();
      if (!tokenActual) {
        throw new Error('No hay sesión activa');
      }

      const response = await fetch(`${API_URL}/docentes/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${tokenActual}`
        }
      });

      if (!response.ok) {
        throw new Error('No se pudo dar de baja el docente');
      }

      setDocente((prev) => prev ? { ...prev, activo: false } : null);
      setTimeout(() => {
        router.push('/docentes');
      }, 1000);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!token) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
        <div className="mx-auto max-w-2xl rounded-3xl bg-white p-8 shadow-lg shadow-slate-200/50">
          <h1 className="text-3xl font-semibold text-slate-900">Detalle de docente</h1>
          <p className="mt-2 text-slate-600">Necesitas un JWT para ver docentes.</p>
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

  if (error) {
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

  if (!docente) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
        <div className="mx-auto max-w-4xl">
          <p className="text-slate-600">Docente no encontrado</p>
          <Link href="/docentes" className="mt-4 inline-block rounded-full bg-slate-900 px-6 py-3 text-white font-semibold hover:bg-slate-800">
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
            <Link href="/docentes" className="text-slate-600 hover:text-slate-900 font-semibold">
              ← Volver al listado
            </Link>
            <h1 className="mt-4 text-3xl font-semibold text-slate-900">
              {docente.nombre} {docente.apellido}
            </h1>
            <p className="mt-2 text-slate-600">Ficha de docente</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {(['ADMINISTRADOR_SISTEMA', 'DECANO', 'RECTORADO', 'SECRETARIA_ACADEMICA', 'DIRECTOR_CARRERA', 'ADMINISTRATIVO'].includes(usuario?.rol?.nombre)) ? (
              <Link
                href={`/docentes/${id}/editar`}
                className="rounded-full bg-slate-900 px-6 py-3 text-white font-semibold hover:bg-slate-800"
              >
                Editar
              </Link>
            ) : null}
            {docente.activo && (['ADMINISTRADOR_SISTEMA', 'DECANO', 'RECTORADO', 'SECRETARIA_ACADEMICA'].includes(usuario?.rol?.nombre)) && (
              <button
                onClick={darDeBaja}
                className="rounded-full border border-red-300 bg-red-50 px-6 py-3 text-red-700 font-semibold hover:bg-red-100"
              >
                Dar de baja
              </button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl bg-white p-8 shadow-lg shadow-slate-200/50">
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-xl font-semibold text-slate-900">Estado</h2>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${docente.activo ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-700'}`}>
                {docente.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <p className="text-sm text-slate-600">
              Última actualización: {new Date(docente.fechaActualizacion).toLocaleDateString('es-AR')}
            </p>
          </section>

          <section className="rounded-3xl bg-white p-8 shadow-lg shadow-slate-200/50">
            <h2 className="mb-6 text-xl font-semibold text-slate-900">Datos personales</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase text-slate-500">Nombre</p>
                <p className="mt-2 font-medium text-slate-900">{docente.nombre}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase text-slate-500">Apellido</p>
                <p className="mt-2 font-medium text-slate-900">{docente.apellido}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase text-slate-500">Tipo de documento</p>
                <p className="mt-2 font-medium text-slate-900">{docente.tipoDocumento}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase text-slate-500">Número de documento</p>
                <p className="mt-2 font-medium text-slate-900">{docente.numeroDocumento}</p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl bg-white p-8 shadow-lg shadow-slate-200/50">
            <h2 className="mb-6 text-xl font-semibold text-slate-900">Contacto</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase text-slate-500">Correo electrónico</p>
                <p className="mt-2 font-medium text-slate-900 break-all">{docente.correoElectronico}</p>
              </div>
              {docente.telefono && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase text-slate-500">Teléfono</p>
                  <p className="mt-2 font-medium text-slate-900">{docente.telefono}</p>
                </div>
              )}
              {docente.domicilio && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                  <p className="text-xs uppercase text-slate-500">Domicilio</p>
                  <p className="mt-2 font-medium text-slate-900">{docente.domicilio}</p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl bg-white p-8 shadow-lg shadow-slate-200/50">
            <h2 className="mb-6 text-xl font-semibold text-slate-900">Formación</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {docente.tituloGrado && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase text-slate-500">Título de grado</p>
                  <p className="mt-2 font-medium text-slate-900">{docente.tituloGrado}</p>
                </div>
              )}
              {docente.tituloPosgrado && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase text-slate-500">Título de posgrado</p>
                  <p className="mt-2 font-medium text-slate-900">{docente.tituloPosgrado}</p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl bg-white p-8 shadow-lg shadow-slate-200/50">
            <h2 className="mb-6 text-xl font-semibold text-slate-900">Cargo y trayectoria</h2>
            <div className="space-y-4">
              {docente.cargoDeclarado && (
                <div>
                  <p className="text-xs uppercase text-slate-500 font-semibold">Cargo declarado</p>
                  <p className="mt-2 text-slate-900 whitespace-pre-wrap">{docente.cargoDeclarado}</p>
                </div>
              )}
              {docente.justificacionPertinencia && (
                <div>
                  <p className="text-xs uppercase text-slate-500 font-semibold">Justificación de pertinencia</p>
                  <p className="mt-2 text-slate-900 whitespace-pre-wrap">{docente.justificacionPertinencia}</p>
                </div>
              )}
              {docente.actividadesProfesionales && (
                <div>
                  <p className="text-xs uppercase text-slate-500 font-semibold">Actividades profesionales</p>
                  <p className="mt-2 text-slate-900 whitespace-pre-wrap">{docente.actividadesProfesionales}</p>
                </div>
              )}
              {docente.antecedentesAcademicos && (
                <div>
                  <p className="text-xs uppercase text-slate-500 font-semibold">Antecedentes académicos</p>
                  <p className="mt-2 text-slate-900 whitespace-pre-wrap">{docente.antecedentesAcademicos}</p>
                </div>
              )}
              {!docente.cargoDeclarado && !docente.justificacionPertinencia && !docente.actividadesProfesionales && !docente.antecedentesAcademicos && (
                <p className="text-slate-500">Sin información registrada</p>
              )}
            </div>
          </section>

          {docente.usuario && (
            <section className="rounded-3xl bg-white p-8 shadow-lg shadow-slate-200/50">
              <h2 className="mb-6 text-xl font-semibold text-slate-900">Usuario asociado</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase text-slate-500">Email</p>
                  <p className="mt-2 font-medium text-slate-900 break-all">{docente.usuario.correoElectronico}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase text-slate-500">Rol</p>
                  <p className="mt-2 font-medium text-slate-900">{docente.usuario.rol.nombre}</p>
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/docentes" className="rounded-full border border-slate-300 bg-white px-6 py-3 text-slate-700 font-semibold hover:bg-slate-50">
            Volver al listado
          </Link>
        </div>
      </div>
    </main>
  );
}
