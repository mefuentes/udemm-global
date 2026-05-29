"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

interface FormData {
  nombre: string;
  apellido: string;
  tipoDocumento: string;
  numeroDocumento: string;
  correoElectronico: string;
  telefono?: string;
  domicilio?: string;
  tituloGrado?: string;
  tituloPosgrado?: string;
  cargoDeclarado?: string;
  justificacionPertinencia?: string;
  actividadesProfesionales?: string;
  antecedentesAcademicos?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

export default function MiFichaPage() {
  const router = useRouter();
  const { obtenerTokenActual, usuario } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [formData, setFormData] = useState<FormData | null>(null);

  useEffect(() => {
    if (!usuario) return;
    if (usuario.rol?.nombre !== 'DOCENTE') {
      setError('No tiene permiso para ver su ficha docente.');
      setLoading(false);
      return;
    }
    cargarFicha();
  }, [usuario]);

  async function cargarFicha() {
    setLoading(true);
    setError(null);
    try {
      const token = obtenerTokenActual();
      if (!token) throw new Error('No hay sesión activa');
      const res = await fetch(`${API_URL}/docentes/mi-ficha`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `Error ${res.status}`);
      }
      const data = await res.json();
      setFormData({
        nombre: data.nombre ?? '',
        apellido: data.apellido ?? '',
        tipoDocumento: data.tipoDocumento ?? 'DNI',
        numeroDocumento: data.numeroDocumento ?? '',
        correoElectronico: data.correoElectronico ?? '',
        telefono: data.telefono ?? '',
        domicilio: data.domicilio ?? '',
        tituloGrado: data.tituloGrado ?? '',
        tituloPosgrado: data.tituloPosgrado ?? '',
        cargoDeclarado: data.cargoDeclarado ?? '',
        justificacionPertinencia: data.justificacionPertinencia ?? '',
        actividadesProfesionales: data.actividadesProfesionales ?? '',
        antecedentesAcademicos: data.antecedentesAcademicos ?? ''
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function actualizarCampo<K extends keyof FormData>(campo: K, valor: string) {
    setFormData((prev) => (prev ? { ...prev, [campo]: valor } : prev));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setExito(null);
    setEnviando(true);
    try {
      const token = obtenerTokenActual();
      if (!token) throw new Error('No hay sesión activa');
      const payload = { ...formData };
      const res = await fetch(`${API_URL}/docentes/mi-ficha`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `Error ${res.status}`);
      }
      const data = await res.json();
      setExito('Ficha actualizada con éxito.');
      setTimeout(() => router.push(`/docentes/${data.id}`), 1200);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <Link href="/docentes" className="text-slate-600 hover:text-slate-900 font-semibold">
            ← Volver
          </Link>
          <h1 className="mt-4 text-3xl font-semibold text-slate-900">Mi ficha docente</h1>
        </div>

        {error && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {exito && <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{exito}</div>}

        {formData && (
          <form onSubmit={guardar} className="space-y-6 rounded-3xl bg-white p-8 shadow-lg shadow-slate-200/50">
            <div>
              <div className="grid gap-4 sm:grid-cols-2">
                <input value={formData.nombre} onChange={(e) => actualizarCampo('nombre', e.target.value)} placeholder="Nombre" required className="rounded-2xl border px-4 py-3" />
                <input value={formData.apellido} onChange={(e) => actualizarCampo('apellido', e.target.value)} placeholder="Apellido" required className="rounded-2xl border px-4 py-3" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <select value={formData.tipoDocumento} onChange={(e) => actualizarCampo('tipoDocumento', e.target.value)} className="rounded-2xl border px-4 py-3">
                <option>DNI</option>
                <option>CUIL</option>
                <option>Pasaporte</option>
              </select>
              <input value={formData.numeroDocumento} onChange={(e) => actualizarCampo('numeroDocumento', e.target.value)} placeholder="Número de documento" className="rounded-2xl border px-4 py-3" />
            </div>

            <div className="grid gap-4">
              <input value={formData.correoElectronico} onChange={(e) => actualizarCampo('correoElectronico', e.target.value)} placeholder="Correo electrónico" className="rounded-2xl border px-4 py-3" />
            </div>

            <div className="flex gap-3 pt-4">
              <button type="submit" disabled={enviando} className="rounded-full bg-slate-900 px-6 py-3 text-white">{enviando ? 'Guardando...' : 'Guardar cambios'}</button>
              <Link href="/docentes" className="rounded-full border px-6 py-3">Cancelar</Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
