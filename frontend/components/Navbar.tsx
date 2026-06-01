'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

export function Navbar() {
  const { usuario, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  if (!usuario || pathname === '/login') {
    return null;
  }

  function handleLogout() {
    if (window.confirm('¿Deseas cerrar sesión?')) {
      logout();
    }
  }

  return (
    <nav className="bg-slate-900 border-b border-slate-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-[#f26b22] to-orange-600">
              <span className="text-sm font-bold text-white">U</span>
            </div>
            <span className="text-lg font-semibold text-white hidden sm:inline">UDEMM</span>
          </Link>

          {/* Menu Links */}
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="/"
              className="text-slate-300 hover:text-white transition text-sm font-medium"
            >
              Inicio
            </Link>
            <Link
              href="/docentes"
              className="text-slate-300 hover:text-white transition text-sm font-medium"
            >
              Docentes
            </Link>
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-white">
                {usuario.nombre} {usuario.apellido}
              </p>
              <p className="text-xs text-slate-400">{usuario.rol.nombre}</p>
            </div>

            <button
              onClick={handleLogout}
              className="rounded-full bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-medium text-white transition"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
