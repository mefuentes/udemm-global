'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './auth-context';

// Cuenta vinculaciones PENDIENTE_DE_APROBACION + notificaciones no leídas para DOCENTE.
// Otros roles retornan 0 (no tienen badge).

interface NotificacionesContextType {
  contadorNovedades: number;
  recargarContador: () => Promise<void>;
}

const NotificacionesContext = createContext<NotificacionesContextType>({
  contadorNovedades: 0,
  recargarContador: async () => {},
});

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

export function NotificacionesProvider({ children }: { children: React.ReactNode }) {
  const { usuario, obtenerTokenActual } = useAuth();
  const [contadorNovedades, setContadorNovedades] = useState(0);

  const esDocente = usuario?.rol?.nombre === 'DOCENTE';

  const recargarContador = useCallback(async () => {
    if (!esDocente) {
      setContadorNovedades(0);
      return;
    }
    try {
      const token = obtenerTokenActual();
      if (!token) return;

      const [resNotif, resVinc] = await Promise.all([
        fetch(`${API}/notificaciones/no-leidas/count`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API}/vinculaciones-catedra?estado=PENDIENTE_DE_APROBACION`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      let total = 0;

      if (resNotif.ok) {
        const d = await resNotif.json();
        total += d.count ?? 0;
      }
      if (resVinc.ok) {
        const d = await resVinc.json();
        const lista = Array.isArray(d) ? d : (d.data ?? []);
        total += lista.length;
      }

      setContadorNovedades(total);
    } catch {
      // silencioso
    }
  }, [esDocente, obtenerTokenActual]);

  useEffect(() => {
    recargarContador();
  }, [recargarContador]);

  return (
    <NotificacionesContext.Provider value={{ contadorNovedades, recargarContador }}>
      {children}
    </NotificacionesContext.Provider>
  );
}

export const useNotificaciones = () => useContext(NotificacionesContext);
