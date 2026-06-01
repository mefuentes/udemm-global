'use client';

import { FormEvent, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [correoElectronico, setCorreoElectronico] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const { login, usuario } = useAuth();
  const router = useRouter();

  // Si ya hay usuario logueado, redirigir a home
  if (usuario) {
    router.push('/');
    return null;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCargando(true);

    try {
      await login(correoElectronico, contrasena);
    } catch (err) {
      setError((err as Error).message || 'Error al iniciar sesión');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#f26b22] to-orange-600 mb-4">
            <span className="text-2xl font-bold text-white">U</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">UDEMM Global</h1>
          <p className="text-slate-300">Plataforma Académica Institucional</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-2xl p-8 space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 mb-2">Iniciar sesión</h2>
            <p className="text-sm text-slate-500">Ingresa con tu cuenta institucional</p>
          </div>

          {error && (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              value={correoElectronico}
              onChange={(e) => setCorreoElectronico(e.target.value)}
              placeholder="tu.email@udemm.edu.ar"
              required
              disabled={cargando}
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#0f4c81] focus:bg-white focus:ring-2 focus:ring-[#0f4c81]/20 disabled:opacity-50"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              placeholder="••••••••"
              required
              disabled={cargando}
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#0f4c81] focus:bg-white focus:ring-2 focus:ring-[#0f4c81]/20 disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="w-full rounded-full bg-gradient-to-r from-[#0f4c81] to-blue-700 py-3 text-sm font-semibold text-white transition hover:from-[#0f3a5f] hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cargando ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>

          <div className="border-t border-slate-200 pt-4">
            <p className="text-xs text-slate-500 text-center">
              Credenciales de demo: <br />
              <span className="font-medium text-slate-700">admin@udemm.edu.ar</span> / <span className="font-medium text-slate-700">Admin1234!</span>
            </p>
          </div>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-8">
          © 2026 UDEMM. Plataforma de Gestión Académica.
        </p>
      </div>
    </div>
  );
}
