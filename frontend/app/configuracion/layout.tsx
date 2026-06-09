'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
  const { usuario } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (usuario && usuario.rol?.nombre !== 'ADMINISTRADOR_SISTEMA') {
      router.replace('/');
    }
  }, [usuario, router]);

  if (!usuario || usuario.rol?.nombre !== 'ADMINISTRADOR_SISTEMA') return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {children}
    </div>
  );
}
