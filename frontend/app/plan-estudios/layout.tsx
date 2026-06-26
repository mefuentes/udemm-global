'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ROLES_CON_ACCESO_PLAN_ESTUDIOS } from '@/lib/permisos-plan-estudios';

export default function PlanEstudiosLayout({ children }: { children: React.ReactNode }) {
  const { usuario, cargando } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!cargando && usuario) {
      const rolNombre = usuario.rol?.nombre ?? '';
      const tieneAcceso = (ROLES_CON_ACCESO_PLAN_ESTUDIOS as readonly string[]).includes(rolNombre);
      if (!tieneAcceso) router.replace('/');
    }
    if (!cargando && !usuario) {
      router.replace('/login');
    }
  }, [usuario, cargando, router]);

  if (cargando || !usuario) return null;

  const rolNombre = usuario.rol?.nombre ?? '';
  const tieneAcceso = (ROLES_CON_ACCESO_PLAN_ESTUDIOS as readonly string[]).includes(rolNombre);
  if (!tieneAcceso) return null;

  return (
    <div className="min-h-screen bg-[#f1f5f9] p-6 sm:p-8">
      {children}
    </div>
  );
}
