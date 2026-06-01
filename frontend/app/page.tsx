'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { usuario } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (usuario?.rol?.nombre === 'DOCENTE') {
      router.push('/docentes/mi-ficha');
    }
  }, [usuario, router]);

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <section className="rounded-3xl bg-white shadow-lg shadow-slate-200/50 p-8 sm:p-12 mb-8">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Bienvenida</p>
              <h1 className="mt-4 text-4xl sm:text-5xl font-bold text-slate-900">
                UDEMM Global
              </h1>
              <p className="mt-4 max-w-2xl text-lg text-slate-600">
                Plataforma institucional académica/documental diseñada para acompañar los procesos de acreditación CONEAU.
              </p>
              {usuario && (
                <p className="mt-6 text-slate-700">
                  Hola, <span className="font-semibold">{usuario.nombre} {usuario.apellido}</span>. 
                  Accedes como <span className="font-medium text-[#0f4c81]">{usuario.rol.nombre}</span>.
                </p>
              )}
            </div>
          </section>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
            <Link
              href="/docentes"
              className="rounded-3xl bg-white shadow-lg shadow-slate-200/50 p-6 hover:shadow-xl hover:shadow-slate-200/75 transition group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <span className="text-lg font-bold text-white">D</span>
                </div>
              </div>
              <h2 className="text-lg font-semibold text-slate-900 group-hover:text-[#0f4c81] transition">
                Docentes
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Gestión completa de docentes con búsqueda, paginación y baja lógica.
              </p>
              <p className="mt-4 text-xs font-medium text-slate-500">
                → Ir al módulo
              </p>
            </Link>

            <div className="rounded-3xl bg-white shadow-lg shadow-slate-200/50 p-6 opacity-50 cursor-not-allowed">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
                  <span className="text-lg font-bold text-slate-400">M</span>
                </div>
              </div>
              <h2 className="text-lg font-semibold text-slate-400">
                Materias
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Próximamente: gestión de materias y planes de estudio.
              </p>
              <p className="mt-4 text-xs font-medium text-slate-400">
                Próxima fase
              </p>
            </div>

            <div className="rounded-3xl bg-white shadow-lg shadow-slate-200/50 p-6 opacity-50 cursor-not-allowed">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
                  <span className="text-lg font-bold text-slate-400">R</span>
                </div>
              </div>
              <h2 className="text-lg font-semibold text-slate-400">
                Reportes
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Próximamente: reportes y estadísticas de acreditación.
              </p>
              <p className="mt-4 text-xs font-medium text-slate-400">
                Próxima fase
              </p>
            </div>
          </div>

          <section className="rounded-3xl bg-white shadow-lg shadow-slate-200/50 p-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Información del Sistema</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                <p className="text-xs uppercase tracking-wider text-slate-500">Frontend</p>
                <p className="mt-2 font-medium text-slate-900">Next.js 14 + TailwindCSS</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                <p className="text-xs uppercase tracking-wider text-slate-500">Backend</p>
                <p className="mt-2 font-medium text-slate-900">NestJS + Prisma + PostgreSQL</p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </ProtectedRoute>
  );
}
