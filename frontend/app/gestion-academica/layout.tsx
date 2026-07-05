'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ROLES_CON_ACCESO_GESTION_ACADEMICA } from '@/lib/permisos-gestion-academica';

export default function GestionAcademicaLayout({ children }: { children: React.ReactNode }) {
  const { usuario, cargando } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!cargando && usuario) {
      const rol = usuario.rol?.nombre ?? '';
      if (!(ROLES_CON_ACCESO_GESTION_ACADEMICA as readonly string[]).includes(rol)) {
        router.replace('/');
      }
    }
    if (!cargando && !usuario) {
      router.replace('/login');
    }
  }, [usuario, cargando, router]);

  if (cargando || !usuario) return null;

  const tieneAcceso = (ROLES_CON_ACCESO_GESTION_ACADEMICA as readonly string[]).includes(
    usuario.rol?.nombre ?? ''
  );
  if (!tieneAcceso) return null;

  return (
    <div className="min-h-screen bg-[#f1f5f9] p-6 sm:p-8">
      {children}
    </div>
  );
}
