'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { NormativaForm } from '../_components/NormativaForm';

const ROLES_GESTION = ['SECRETARIA_ACADEMICA', 'DECANO', 'RECTORADO', 'ADMINISTRADOR_SISTEMA'];

export default function NuevaNormativaPage() {
  const { usuario, obtenerTokenActual } = useAuth();
  const router       = useRouter();
  const searchParams = useSearchParams();

  const tipoIdParam = searchParams?.get('tipoId') ?? '';
  const nombreParam = searchParams?.get('nombre') ?? '';

  const rol            = usuario?.rol?.nombre ?? '';
  const puedeGestionar = ROLES_GESTION.includes(rol);

  useEffect(() => {
    if (usuario !== undefined && !puedeGestionar) router.replace('/repositorio-normativas');
  }, [usuario, puedeGestionar, router]);

  if (usuario === undefined || !puedeGestionar) return null;

  const volverHref = tipoIdParam
    ? `/repositorio-normativas/${tipoIdParam}?nombre=${encodeURIComponent(nombreParam)}`
    : '/repositorio-normativas';

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <Link href="/repositorio-normativas" className="text-xs text-[#0f4c81] hover:underline font-medium">
              Repositorio de Normativas
            </Link>
            <span className="text-slate-300 text-xs">/</span>
            {tipoIdParam && nombreParam && (
              <>
                <Link href={volverHref} className="text-xs text-[#0f4c81] hover:underline font-medium truncate max-w-[160px]">
                  {nombreParam}
                </Link>
                <span className="text-slate-300 text-xs">/</span>
              </>
            )}
            <span className="text-xs text-slate-500">Cargar Normativa</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">CARGAR NORMATIVA</h1>
          <p className="mt-1 text-sm text-slate-500 font-medium tracking-wide">
            REPOSITORIO DE NORMATIVAS — Alta de normativa
          </p>
        </div>
        <Link
          href={volverHref}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </Link>
      </div>

      <NormativaForm
        modo="crear"
        volverHref={volverHref}
        valoresIniciales={{ tipoNormativaId: tipoIdParam }}
        obtenerToken={() => obtenerTokenActual() ?? ''}
        onSuccess={({ tipoId, tipoNombre }) => {
          const nom = tipoNombre || nombreParam;
          router.push(`/repositorio-normativas/${tipoId}?nombre=${encodeURIComponent(nom)}`);
        }}
      />
    </div>
  );
}
