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
    <div className="min-h-screen bg-[#0d2244] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">

        {/* Encabezado institucional */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#1a5ea8] mb-4 shadow-lg shadow-black/30">
            <span className="text-lg font-bold text-white tracking-wide">U</span>
          </div>
          <h1 className="text-lg font-bold text-white tracking-wide">UDEMM Global</h1>
          <p className="text-xs text-blue-300/50 mt-1 tracking-wide">Plataforma de Gestión Académica</p>
        </div>

        {/* Tarjeta del formulario */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-2xl shadow-black/40 p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Acceso al sistema</h2>
            <p className="text-xs text-slate-500 mt-0.5">Ingresá tus credenciales institucionales</p>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2.5">
              <p className="text-xs font-medium text-red-700">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-slate-600 mb-1.5">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                data-no-uppercase="true"
                value={correoElectronico}
                onChange={(e) => setCorreoElectronico(e.target.value)}
                placeholder="usuario@udemm.edu.ar"
                required
                disabled={cargando}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1a5ea8] focus:ring-2 focus:ring-[#1a5ea8]/15 disabled:opacity-50 disabled:bg-slate-50"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-slate-600 mb-1.5">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                data-no-uppercase="true"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                placeholder="••••••••"
                required
                disabled={cargando}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1a5ea8] focus:ring-2 focus:ring-[#1a5ea8]/15 disabled:opacity-50 disabled:bg-slate-50"
              />
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="w-full rounded-md bg-[#0f4c81] py-2.5 text-sm font-semibold text-white transition hover:bg-[#0a3960] active:bg-[#082f52] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cargando ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </button>
          </div>

          <div className="pt-1 border-t border-slate-100">
            <p className="text-[11px] text-slate-400 text-center">
              Demo: <span className="font-medium text-slate-600">admin@udemm.edu.ar</span> · <span className="font-medium text-slate-600">Admin1234!</span>
            </p>
          </div>
        </form>

        <p className="text-center text-[11px] text-blue-300/30 mt-6">
          © 2026 UDEMM · Sistema de Gestión Institucional
        </p>
      </div>
    </div>
  );
}
