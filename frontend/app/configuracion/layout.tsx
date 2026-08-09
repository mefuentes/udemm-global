'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const ROLES_CONFIGURACION = ['ADMINISTRADOR_SISTEMA', 'SECRETARIA_ACADEMICA', 'DIRECTOR_CARRERA'];

export default function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
  const { usuario } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (usuario && !ROLES_CONFIGURACION.includes(usuario.rol?.nombre ?? '')) {
      router.replace('/');
    }
  }, [usuario, router]);

  if (!usuario || !ROLES_CONFIGURACION.includes(usuario.rol?.nombre ?? '')) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {children}
    </div>
  );
}
