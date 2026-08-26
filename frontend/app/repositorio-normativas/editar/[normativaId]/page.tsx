'use client';

import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NormativaForm } from '../../_components/NormativaForm';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';
const ROLES_GESTION = ['SECRETARIA_ACADEMICA', 'DECANO', 'RECTORADO', 'ADMINISTRADOR_SISTEMA'];

interface NormativaDetalle {
  id: string;
  titulo: string;
  tipoNormativa: { id: string; nombre: string };
  fechaEmision: string;
  areaEmisora: string;
  numeroNorma: string;
  anio: number;
  vigencia: string;
  palabrasClave: string | null;
  tieneArchivo: boolean;
  nombreArchivoOriginal: string | null;
  tamanioArchivo: number | null;
}

export default function EditarNormativaPage() {
  const { usuario } = useAuth();
  const router       = useRouter();
  const params       = useParams();
  const searchParams = useSearchParams();

  const normativaId  = params?.normativaId as string;
  const tipoNombre   = searchParams?.get('tipoNombre') ?? '';

  const rol            = usuario?.rol?.nombre ?? '';
  const puedeGestionar = ROLES_GESTION.includes(rol);

  const [normativa, setNormativa] = useState<NormativaDetalle | null>(null);
  const [cargando, setCargando]   = useState(true);
  const [error, setError]         = useState('');

  useEffect(() => {
    if (usuario !== undefined && !puedeGestionar) router.replace('/repositorio-normativas');
  }, [usuario, puedeGestionar, router]);

  useEffect(() => {
    if (!normativaId || !puedeGestionar) return;
    apiFetch(`${API}/normativas/${normativaId}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setNormativa)
      .catch(status => {
        if (status === 404) setError('La normativa no fue encontrada.');
        else setError('No se pudieron cargar los datos de la normativa.');
      })
      .finally(() => setCargando(false));
  }, [normativaId, puedeGestionar]);

  if (usuario === undefined || !puedeGestionar) return null;

  const nombreTipo = normativa?.tipoNormativa?.nombre ?? tipoNombre;
  const tipoId     = normativa?.tipoNormativa?.id ?? '';

  const volverHref = tipoId
    ? `/repositorio-normativas/${tipoId}?nombre=${encodeURIComponent(nombreTipo)}`
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
            {tipoId && nombreTipo && (
              <>
                <Link href={volverHref} className="text-xs text-[#0f4c81] hover:underline font-medium truncate max-w-[160px]">
                  {nombreTipo}
                </Link>
                <span className="text-slate-300 text-xs">/</span>
              </>
            )}
            <span className="text-xs text-slate-500">Editar</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">EDITAR NORMATIVA</h1>
          <p className="mt-1 text-sm text-slate-500 font-medium tracking-wide">
            REPOSITORIO DE NORMATIVAS — Edición de normativa
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

      {/* Cargando */}
      {cargando && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 flex items-center justify-center gap-3 text-slate-500">
          <svg className="w-5 h-5 animate-spin text-[#0f4c81]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-sm font-medium">Cargando normativa...</span>
        </div>
      )}

      {/* Error carga */}
      {!cargando && error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {error}
        </div>
      )}

      {/* Formulario */}
      {!cargando && !error && normativa && (
        <NormativaForm
          modo="editar"
          normativaId={normativa.id}
          volverHref={volverHref}
          valoresIniciales={{
            titulo:          normativa.titulo,
            tipoNormativaId: normativa.tipoNormativa.id,
            fechaEmision:    normativa.fechaEmision.slice(0, 10),
            areaEmisora:     normativa.areaEmisora,
            numeroNorma:     normativa.numeroNorma,
            anio:            String(normativa.anio).padStart(2, '0'),
            vigencia:        normativa.vigencia,
            palabrasClave:   normativa.palabrasClave ?? '',
          }}
          archivoActual={
            normativa.tieneArchivo
              ? { nombre: normativa.nombreArchivoOriginal, tamanio: normativa.tamanioArchivo }
              : undefined
          }
          onSuccess={({ tipoId: tid, tipoNombre: tnom }) => {
            const nom = tnom || nombreTipo;
            const id  = tid  || tipoId;
            router.push(`/repositorio-normativas/${id}?nombre=${encodeURIComponent(nom)}`);
          }}
        />
      )}
    </div>
  );
}
