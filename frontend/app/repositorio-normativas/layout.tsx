'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const ROLES_CON_ACCESO = [
  'DOCENTE',
  'ADMINISTRATIVO',
  'DIRECTOR_CARRERA',
  'SECRETARIA_ACADEMICA',
  'DECANO',
  'RECTORADO',
  'ADMINISTRADOR_SISTEMA',
] as const;

export default function RepositorioNormativasLayout({ children }: { children: React.ReactNode }) {
  const { usuario, cargando } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!cargando && !usuario) router.replace('/login');
    if (!cargando && usuario) {
      const rol = usuario.rol?.nombre ?? '';
      if (!(ROLES_CON_ACCESO as readonly string[]).includes(rol)) router.replace('/');
    }
  }, [usuario, cargando, router]);

  if (cargando || !usuario) return null;
  if (!(ROLES_CON_ACCESO as readonly string[]).includes(usuario.rol?.nombre ?? '')) return null;

  return (
    <div className="min-h-screen bg-[#f1f5f9] p-6 sm:p-8">
      {children}
    </div>
  );
}
