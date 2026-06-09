'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function BandejaAprobacionesPage() {
  const router = useRouter();
  const { usuario } = useAuth();
  const roleName = (usuario as any)?.rol?.nombre ?? '';
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

  useEffect(() => {
    if (!usuario) return;
    if (roleName !== 'DOCENTE' && roleName !== 'ADMINISTRATIVO') {
      router.push('/docentes');
    }
  }, [usuario, roleName, router]);

  return (
    <main className="max-w-5xl mx-auto space-y-5">

      {/* Encabezado */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">
          {roleName === 'DOCENTE' ? 'Docente' : 'Administrativo'}
        </p>
        <h1 className="text-xl font-bold text-slate-800">Bandeja de Aprobaciones</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Solicitudes y modificaciones pendientes de revisión.
        </p>
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-[#0f4c81] text-white text-xs font-semibold uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Docente</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Detalle</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {solicitudes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-400">
                    No hay solicitudes pendientes en este momento.
                  </td>
                </tr>
              ) : (
                solicitudes.map((item, idx) => (
                  <tr key={item.id} className={`border-t border-slate-100 ${idx % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{item.docente || '-'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{item.tipo || '-'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{item.detalle || '-'}</td>
                    <td className="px-4 py-2.5 text-right">
                      {item.estado === 'Pendiente' ? (
                        <div className="inline-flex gap-2">
                          <button
                            type="button"
                            onClick={() => responderSolicitud(item.id, 'Aceptada')}
                            className="rounded-md bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700 transition"
                          >
                            Aceptar
                          </button>
                          <button
                            type="button"
                            onClick={() => responderSolicitud(item.id, 'Rechazada')}
                            className="rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 transition"
                          >
                            Rechazar
                          </button>
                        </div>
                      ) : (
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border ${
                          item.estado === 'Aceptada'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {item.estado}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
