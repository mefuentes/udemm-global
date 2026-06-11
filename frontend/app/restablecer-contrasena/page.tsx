'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

type Vista = 'form' | 'exito' | 'token-invalido';

export default function RestablecerContrasenaPage() {
  return (
    <Suspense fallback={null}>
      <RestablecerContrasenaContent />
    </Suspense>
  );
}

function RestablecerContrasenaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [vista, setVista] = useState<Vista>('form');
  const [nuevaContrasena, setNuevaContrasena] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [mostrarContrasena, setMostrarContrasena] = useState(false);

  useEffect(() => {
    if (!token) setVista('token-invalido');
  }, [token]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (nuevaContrasena.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (nuevaContrasena !== confirmar) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setCargando(true);
    try {
      const res = await fetch(`${API}/auth/restablecer-contrasena`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, nuevaContrasena }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? 'Error al restablecer la contraseña');
      setVista('exito');
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.toLowerCase().includes('inválido') || msg.toLowerCase().includes('expirado')) {
        setVista('token-invalido');
      } else {
        setError(msg);
      }
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0d2244] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">

        {/* Encabezado */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#1a5ea8] mb-4 shadow-lg shadow-black/30">
            <span className="text-lg font-bold text-white tracking-wide">U</span>
          </div>
          <h1 className="text-lg font-bold text-white tracking-wide">UDEMM Global</h1>
          <p className="text-xs text-blue-300/50 mt-1 tracking-wide">Plataforma de Gestión Académica</p>
        </div>

        {/* ── Formulario ── */}
        {vista === 'form' && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-2xl shadow-black/40 p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-slate-800">Nueva contraseña</h2>
              <p className="text-xs text-slate-500 mt-0.5">Elegí una contraseña segura para tu cuenta.</p>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2.5">
                <p className="text-xs font-medium text-red-700">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-600">Nueva contraseña</label>
                  <button
                    type="button"
                    onClick={() => setMostrarContrasena(v => !v)}
                    className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {mostrarContrasena ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
                <input
                  type={mostrarContrasena ? 'text' : 'password'}
                  data-no-uppercase="true"
                  value={nuevaContrasena}
                  onChange={(e) => setNuevaContrasena(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                  disabled={cargando}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1a5ea8] focus:ring-2 focus:ring-[#1a5ea8]/15 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Confirmar contraseña</label>
                <input
                  type={mostrarContrasena ? 'text' : 'password'}
                  data-no-uppercase="true"
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  placeholder="Repetí la contraseña"
                  required
                  disabled={cargando}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1a5ea8] focus:ring-2 focus:ring-[#1a5ea8]/15 disabled:opacity-50"
                />
              </div>

              {/* Indicador de requisitos */}
              <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2 space-y-1">
                <p className="text-[11px] font-medium text-slate-500 mb-1">Requisitos:</p>
                <RequisitoCumplido cumple={nuevaContrasena.length >= 8} texto="Mínimo 8 caracteres" />
                <RequisitoCumplido cumple={/[A-Z]/.test(nuevaContrasena)} texto="Al menos una mayúscula" />
                <RequisitoCumplido cumple={/[0-9]/.test(nuevaContrasena)} texto="Al menos un número" />
                <RequisitoCumplido cumple={confirmar.length > 0 && nuevaContrasena === confirmar} texto="Las contraseñas coinciden" />
              </div>

              <button
                type="submit"
                disabled={cargando}
                className="w-full rounded-md bg-[#0f4c81] py-2.5 text-sm font-semibold text-white transition hover:bg-[#0a3960] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cargando ? 'Guardando...' : 'Guardar nueva contraseña'}
              </button>
            </div>
          </form>
        )}

        {/* ── Éxito ── */}
        {vista === 'exito' && (
          <div className="bg-white rounded-xl shadow-2xl shadow-black/40 p-6 space-y-5 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-50 border border-green-200 mx-auto">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">Contraseña actualizada</h2>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                Tu contraseña fue cambiada correctamente. Ya podés iniciar sesión con tus nuevas credenciales.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="w-full rounded-md bg-[#0f4c81] py-2.5 text-sm font-semibold text-white transition hover:bg-[#0a3960]"
            >
              Ir al inicio de sesión
            </button>
          </div>
        )}

        {/* ── Token inválido ── */}
        {vista === 'token-invalido' && (
          <div className="bg-white rounded-xl shadow-2xl shadow-black/40 p-6 space-y-5 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-50 border border-red-200 mx-auto">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">Enlace inválido o expirado</h2>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                Este enlace de recuperación ya fue utilizado o ha expirado. Solicitá uno nuevo desde la pantalla de inicio de sesión.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="w-full rounded-md border border-slate-300 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Volver al inicio de sesión
            </button>
          </div>
        )}

        <p className="text-center text-[11px] text-blue-300/30 mt-6">
          © 2026 UDEMM · Sistema de Gestión Institucional
        </p>
      </div>
    </div>
  );
}

function RequisitoCumplido({ cumple, texto }: { cumple: boolean; texto: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full flex-shrink-0 ${cumple ? 'bg-green-500' : 'bg-slate-200'}`}>
        {cumple && (
          <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      <span className={`text-[11px] ${cumple ? 'text-green-700' : 'text-slate-400'}`}>{texto}</span>
    </div>
  );
}
