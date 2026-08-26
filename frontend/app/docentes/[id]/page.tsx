'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';

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
  const { usuario } = useAuth();
  const { id } = params;
  const [docente, setDocente] = useState<Docente | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!usuario) return;
    cargarDocente();
  }, [usuario, id]);

  async function cargarDocente() {
    try {
      setCargando(true);
      setError(null);
      const response = await apiFetch(`${API_URL}/docentes/${id}`);

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
      const response = await apiFetch(`${API_URL}/docentes/${id}`, { method: 'DELETE' });

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

  if (!usuario) {
    return (
      <main className="max-w-2xl mx-auto">
        <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
          <h1 className="text-xl font-bold text-slate-800">Detalle de docente</h1>
          <p className="mt-1 text-sm text-slate-500">Necesitas una sesión activa para ver docentes.</p>
          <Link href="/docentes" className="mt-4 inline-block rounded-md bg-[#0f4c81] px-4 py-2 text-sm text-white font-medium hover:bg-[#0a3960] transition">
            Volver al listado
          </Link>
        </div>
      </main>
    );
  }

  if (cargando) {
    return (
      <main className="max-w-4xl mx-auto">
        <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500">Cargando docente...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-4xl mx-auto space-y-4">
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        <Link href="/docentes" className="inline-block rounded-md bg-[#0f4c81] px-4 py-2 text-sm text-white font-medium hover:bg-[#0a3960] transition">
          Volver al listado
        </Link>
      </main>
    );
  }

  if (!docente) {
    return (
      <main className="max-w-4xl mx-auto space-y-4">
        <p className="text-sm text-slate-500">Docente no encontrado</p>
        <Link href="/docentes" className="inline-block rounded-md bg-[#0f4c81] px-4 py-2 text-sm text-white font-medium hover:bg-[#0a3960] transition">
          Volver al listado
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/docentes" className="text-xs text-slate-500 hover:text-slate-700 transition">
            ← Volver al listado
          </Link>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5 mt-1">Docentes</p>
          <h1 className="text-xl font-bold text-slate-800">
            {docente.nombre} {docente.apellido}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Ficha de docente</p>
        </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['ADMINISTRADOR_SISTEMA', 'DECANO', 'RECTORADO', 'SECRETARIA_ACADEMICA', 'DIRECTOR_CARRERA', 'ADMINISTRATIVO'].includes(usuario?.rol?.nombre ?? '')) ? (
              <Link
                href={`/docentes/${id}/editar`}
                className="rounded-md bg-[#0f4c81] px-4 py-2 text-sm text-white font-medium hover:bg-[#0a3960] transition"
              >
                Editar
              </Link>
            ) : null}
            {docente.activo && (['ADMINISTRADOR_SISTEMA', 'DECANO', 'RECTORADO', 'SECRETARIA_ACADEMICA'].includes(usuario?.rol?.nombre ?? '')) && (
              <button
                onClick={darDeBaja}
                className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 font-medium hover:bg-red-100 transition"
              >
                Dar de baja
              </button>
            )}
          </div>
      </div>
          <section className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-sm font-semibold text-slate-700">Estado</h2>
              <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${docente.activo ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                {docente.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <p className="text-sm text-slate-600">
              Última actualización: {new Date(docente.fechaActualizacion).toLocaleDateString('es-AR')}
            </p>
          </section>

          <section className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Datos personales</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase text-slate-500">Nombre</p>
                <p className="mt-1 font-medium text-slate-800">{docente.nombre}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase text-slate-500">Apellido</p>
                <p className="mt-1 font-medium text-slate-800">{docente.apellido}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase text-slate-500">Tipo de documento</p>
                <p className="mt-1 font-medium text-slate-800">{docente.tipoDocumento}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase text-slate-500">Número de documento</p>
                <p className="mt-1 font-medium text-slate-800">{docente.numeroDocumento}</p>
              </div>
            </div>
          </section>

          <section className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Contacto</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase text-slate-500">Correo electrónico</p>
                <p className="mt-1 font-medium text-slate-800 break-all">{docente.correoElectronico}</p>
              </div>
              {docente.telefono && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase text-slate-500">Teléfono</p>
                  <p className="mt-1 font-medium text-slate-800">{docente.telefono}</p>
                </div>
              )}
              {docente.domicilio && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                  <p className="text-xs uppercase text-slate-500">Domicilio</p>
                  <p className="mt-1 font-medium text-slate-800">{docente.domicilio}</p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Formación</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {docente.tituloGrado && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase text-slate-500">Título de grado</p>
                  <p className="mt-1 font-medium text-slate-800">{docente.tituloGrado}</p>
                </div>
              )}
              {docente.tituloPosgrado && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase text-slate-500">Título de posgrado</p>
                  <p className="mt-1 font-medium text-slate-800">{docente.tituloPosgrado}</p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Cargo y trayectoria</h2>
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
            <section className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Usuario asociado</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase text-slate-500">Email</p>
                  <p className="mt-1 font-medium text-slate-800 break-all">{docente.usuario.correoElectronico}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase text-slate-500">Rol</p>
                  <p className="mt-1 font-medium text-slate-800">{docente.usuario.rol.nombre}</p>
                </div>
              </div>
            </section>
          )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/docentes" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 font-medium hover:bg-slate-50 transition">
            Volver al listado
          </Link>
        </div>
    </main>
  );
}
