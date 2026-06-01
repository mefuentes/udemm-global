'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';

const menuDocente = [
  { label: 'Ficha Docente', href: '/docentes/mi-ficha' },
  { label: 'Bandeja de Aprobaciones', href: '/docentes/aprobaciones' }
];

export default function BandejaAprobacionesPage() {
  const pathname = usePathname();
  const [solicitudes, setSolicitudes] = useState<Array<{
    id: string;
    docente: string;
    tipo: string;
    detalle: string;
    estado: 'Pendiente' | 'Aceptada' | 'Rechazada';
  }>>([]);

  function responderSolicitud(id: string, estado: 'Aceptada' | 'Rechazada') {
    setSolicitudes((prev) => prev.map((item) => (item.id === id ? { ...item, estado } : item)));
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto flex max-w-7xl gap-6">
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Rol</p>
            <h2 className="mt-1 text-lg font-semibold text-[#0f4c81]">DOCENTE</h2>
            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-500">Modulo</p>
            <nav className="mt-2 space-y-2">
              {menuDocente.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href} className={`block rounded-xl px-3 py-2 text-sm font-medium ${active ? 'bg-[#0f4c81] text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        <section className="flex-1 rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/50">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Docente</p>
          <h1 className="mt-2 text-3xl font-semibold text-[#0f4c81]">Bandeja de Aprobaciones</h1>
          <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Docente</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Detalle</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {solicitudes.length === 0 ? (
                  <tr className="border-t border-slate-100">
                    <td className="px-3 py-3 text-slate-500">-</td>
                    <td className="px-3 py-3 text-slate-500">-</td>
                    <td className="px-3 py-3 text-slate-500">-</td>
                    <td className="px-3 py-3 text-right">
                      <button type="button" disabled className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-500">Aceptar</button>
                      <button type="button" disabled className="ml-2 rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-500">Rechazar</button>
                    </td>
                  </tr>
                ) : (
                  solicitudes.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-3 py-3">{item.docente || '-'}</td>
                      <td className="px-3 py-3">{item.tipo || '-'}</td>
                      <td className="px-3 py-3">{item.detalle || '-'}</td>
                      <td className="px-3 py-3 text-right">
                        {item.estado === 'Pendiente' ? (
                          <>
                            <button type="button" onClick={() => responderSolicitud(item.id, 'Aceptada')} className="rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white">Aceptar</button>
                            <button type="button" onClick={() => responderSolicitud(item.id, 'Rechazada')} className="ml-2 rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">Rechazar</button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-500">{item.estado}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
