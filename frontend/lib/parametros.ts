import { apiFetch } from './api';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

export interface ParametrosPublicos {
  nombreInstitucion: string;
  siglaInstitucion:  string;
  cicloLectivoActual: string;
}

const DEFAULTS: ParametrosPublicos = {
  nombreInstitucion:  'Universidad de la Marina Mercante',
  siglaInstitucion:   'UDEMM',
  cicloLectivoActual: String(new Date().getFullYear()),
};

let cache: ParametrosPublicos | null = null;
let cacheLogoDataUrl: string | null | undefined = undefined; // undefined = no cargado aún

export async function obtenerParametrosPublicos(): Promise<ParametrosPublicos> {
  if (cache) return cache;
  try {
    const res = await apiFetch(`${API}/configuracion/parametros/publico`);
    if (!res.ok) return DEFAULTS;
    const lista: Array<{ clave: string; valor: string }> = await res.json();
    const map = Object.fromEntries(lista.map(p => [p.clave, p.valor]));
    cache = {
      nombreInstitucion:  map['nombreInstitucion']  ?? DEFAULTS.nombreInstitucion,
      siglaInstitucion:   map['siglaInstitucion']   ?? DEFAULTS.siglaInstitucion,
      cicloLectivoActual: map['cicloLectivoActual'] ?? DEFAULTS.cicloLectivoActual,
    };
    return cache;
  } catch {
    return DEFAULTS;
  }
}

/** Retorna el data URL del logo institucional, o null si no está configurado. */
export async function obtenerLogoInstitucion(): Promise<string | null> {
  if (cacheLogoDataUrl !== undefined) return cacheLogoDataUrl;
  try {
    const res = await apiFetch(`${API}/configuracion/parametros/logo`);
    if (!res.ok) { cacheLogoDataUrl = null; return null; }
    const data: { valor: string | null } = await res.json();
    cacheLogoDataUrl = data.valor ?? null;
    return cacheLogoDataUrl;
  } catch {
    cacheLogoDataUrl = null;
    return null;
  }
}

/** Invalida el cache al guardar nuevos parámetros. */
export function invalidarCacheParametros() {
  cache = null;
  cacheLogoDataUrl = undefined;
}
