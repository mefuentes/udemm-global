'use client';

import Link from 'next/link';
import { jsPDF } from 'jspdf';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';

interface Docente {
  id: string;
  nombre: string;
  apellido: string;
  tipoDocumento: string;
  numeroDocumento: string;
  correoElectronico: string;
  activo: boolean;
  fechaActualizacion: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

export default function DocentesPage() {
  const { token, obtenerTokenActual, logout, usuario } = useAuth();
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const [limite] = useState(10);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Docentes individuales no deben ver el listado general
    if (!token) return;
    if (usuario?.rol?.nombre === 'DOCENTE') return;
    fetchDocentes();
  }, [token, busqueda, pagina, limite, usuario]);

  async function fetchDocentes() {
    try {
      setError(null);
      const token = obtenerTokenActual();
      if (!token) {
        throw new Error('No hay sesión activa');
      }

      const url = new URL(`${API_URL}/docentes`);
      if (busqueda) url.searchParams.set('buscar', busqueda);
      url.searchParams.set('page', String(pagina));
      url.searchParams.set('limit', String(limite));

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const backendMessage = data?.message ?? response.statusText ?? 'No se pudo cargar el listado de docentes.';
        if (response.status === 401 || response.status === 403) {
          logout();
          throw new Error(`Sesión inválida o expirada: ${backendMessage}`);
        }
        throw new Error(backendMessage);
      }

      setDocentes(data?.data ?? []);
      setTotal(data?.total ?? 0);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function exportCsv() {
    const headers = ['Nombre', 'Apellido', 'Email', 'Tipo de Documento', 'Número de Documento', 'Activo'];
    const rows = docentes.map((docente) => [
      docente.nombre,
      docente.apellido,
      docente.correoElectronico,
      docente.tipoDocumento,
      docente.numeroDocumento,
      docente.activo ? 'Sí' : 'No'
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map((value) => '"' + String(value).replace(/"/g, '""') + '"').join(','))
      .join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `docentes-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const title = 'Listado de Docentes';
    doc.setFontSize(18);
    doc.text(title, 40, 50);
    doc.setFontSize(11);

    const startY = 80;
    let cursorY = startY;
    const rowHeight = 18;

    const headerText = ['Nombre', 'Email', 'Documento', 'Activo'].join(' | ');
    doc.text(headerText, 40, cursorY);
    cursorY += rowHeight;

    docentes.forEach((docente, index) => {
      const line = `${index + 1}. ${docente.nombre} ${docente.apellido} | ${docente.correoElectronico} | ${docente.tipoDocumento} ${docente.numeroDocumento} | ${docente.activo ? 'Sí' : 'No'}`;
      const lines = doc.splitTextToSize(line, 520);
      if (cursorY + lines.length * rowHeight > 780) {
        doc.addPage();
        cursorY = 40;
      }
      doc.text(lines, 40, cursorY);
      cursorY += lines.length * rowHeight;
    });

    doc.save(`docentes-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  const totalPaginas = Math.max(1, Math.ceil(total / limite));
  const roleName = (usuario as any)?.rol?.nombre ?? null;
  const canCreate = ['ADMINISTRADOR_SISTEMA', 'DECANO', 'RECTORADO', 'SECRETARIA_ACADEMICA', 'ADMINISTRATIVO', 'DIRECTOR_CARRERA'].includes(roleName);
  const canExport = ['ADMINISTRADOR_SISTEMA', 'DECANO', 'RECTORADO', 'SECRETARIA_ACADEMICA', 'ADMINISTRATIVO', 'DIRECTOR_CARRERA'].includes(roleName);

  if (!token) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow-lg shadow-slate-200/50">
          <h1 className="text-3xl font-semibold text-slate-900">Docentes</h1>
          <p className="mt-3 text-slate-600">Debes iniciar sesión para acceder al módulo de docentes.</p>
          <Link href="/login" className="mt-6 inline-flex rounded-full bg-slate-900 px-6 py-3 text-white font-semibold hover:bg-slate-800">
            Ir a login
          </Link>
        </div>
      </main>
    );
  }

  // Si el usuario es DOCENTE, redirigir/mostrar acceso a su propia ficha
  if (usuario?.rol?.nombre === 'DOCENTE') {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow-lg shadow-slate-200/50">
          <h1 className="text-3xl font-semibold text-slate-900">Docentes</h1>
          <p className="mt-3 text-slate-600">No tiene permisos para ver el listado general.</p>
          <Link href="/docentes/mi-ficha" className="mt-6 inline-flex rounded-full bg-slate-900 px-6 py-3 text-white font-semibold hover:bg-slate-800">
            Ir a mi ficha docente
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-8 shadow-lg shadow-slate-200/50">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Módulo</p>
              <h1 className="text-3xl font-semibold text-slate-900">Docentes</h1>
              <p className="mt-2 max-w-2xl text-slate-600">
                Administra docentes con búsqueda, paginación y baja lógica.
              </p>
            </div>
            {canCreate ? (
              <Link
                href="/docentes/nuevo"
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Nuevo docente
              </Link>
            ) : null}
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/50">
              <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Listado de docentes</h2>
                  <p className="text-sm text-slate-500">Buscar por nombre, apellido, correo o documento.</p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    value={busqueda}
                    onChange={(event) => setBusqueda(event.target.value)}
                    placeholder="Buscar docentes..."
                    className="w-full max-w-xs rounded-full border border-slate-300 bg-slate-50 px-4 py-2 text-sm outline-none transition focus:border-slate-900"
                  />
                  {canExport ? (
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={exportCsv}
                        className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        Exportar CSV
                      </button>
                      <button
                        type="button"
                        onClick={exportPdf}
                        className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        Exportar PDF
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="overflow-x-auto rounded-3xl border border-slate-200">
                <table className="min-w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-100 text-slate-900">
                    <tr>
                      <th className="px-4 py-3">Nombre</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Documento</th>
                      <th className="px-4 py-3">Activo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docentes.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                          No se encontraron docentes.
                        </td>
                      </tr>
                    ) : (
                      docentes.map((docente) => (
                        <tr
                          key={docente.id}
                          className="cursor-pointer border-t border-slate-200 hover:bg-slate-50"
                          onClick={() => window.location.assign(`/docentes/${docente.id}`)}
                        >
                          <td className="px-4 py-4">{docente.nombre} {docente.apellido}</td>
                          <td className="px-4 py-4">{docente.correoElectronico}</td>
                          <td className="px-4 py-4">{docente.tipoDocumento} {docente.numeroDocumento}</td>
                          <td className="px-4 py-4">{docente.activo ? 'Sí' : 'No'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
                <p>
                  Página {pagina} de {totalPaginas} · {total} docente(s)
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPagina(Math.max(1, pagina - 1))}
                    disabled={pagina <= 1}
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setPagina(Math.min(totalPaginas, pagina + 1))}
                    disabled={pagina >= totalPaginas}
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </div>
        </section>
      </div>
    </main>
  );
}
