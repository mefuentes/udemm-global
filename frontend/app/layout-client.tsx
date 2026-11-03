'use client';

import { Sidebar } from '@/components/Sidebar';
import { useSidebar } from '@/lib/sidebar-context';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect } from 'react';

export function LayoutClient({ children }: { children: ReactNode }) {
  const { isOpen, setIsOpen } = useSidebar();
  const pathname = usePathname();
  const sinSidebar = pathname === '/login' || pathname.startsWith('/restablecer-contrasena');

  // Cierra el sidebar automáticamente en pantallas móviles (< 768px)
  useEffect(() => {
    const cerrarEnMovil = () => {
      if (window.innerWidth < 768) setIsOpen(false);
    };
    cerrarEnMovil();
    window.addEventListener('resize', cerrarEnMovil);
    return () => window.removeEventListener('resize', cerrarEnMovil);
  }, [setIsOpen]);

  return (
    <div className="flex">
      <Sidebar />
      <main
        className={`flex-1 overflow-x-hidden transition-all duration-200 min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 ${
          sinSidebar ? '' : (isOpen ? 'ml-64' : 'ml-14')
        }`}
      >
        {children}
      </main>
    </div>
  );
}
