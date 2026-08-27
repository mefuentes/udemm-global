const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

// Singleton para evitar múltiples renovaciones simultáneas
let renovandoToken: Promise<boolean> | null = null;

async function tentarRenovar(): Promise<boolean> {
  if (!renovandoToken) {
    renovandoToken = fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
      .then(r => r.ok)
      .finally(() => { renovandoToken = null; });
  }
  return renovandoToken;
}

/**
 * Wrapper de fetch con cookies HttpOnly (credentials: 'include').
 * Reintenta automáticamente tras renovar el access token en caso de 401.
 * Si la renovación falla, emite el evento 'auth:sesion-expirada'.
 *
 * Incluye X-Requested-With en todas las solicitudes mutantes (POST/PUT/PATCH/DELETE)
 * como cabecera de protección CSRF (verificada por CsrfMiddleware en el backend).
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = path.startsWith('http') ? path : `${API_URL}${path}`;
  const esFormData = init?.body instanceof FormData;
  const method = (init?.method ?? 'GET').toUpperCase();
  const esMutante = !['GET', 'HEAD', 'OPTIONS'].includes(method);

  const headersBase: Record<string, string> = {
    ...(esMutante ? { 'X-Requested-With': 'XMLHttpRequest' } : {}),
    ...(esFormData ? {} : { 'Content-Type': 'application/json' }),
  };

  const respuesta = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: { ...headersBase, ...(init?.headers as Record<string, string> | undefined) },
  });

  if (respuesta.status === 401) {
    const renovado = await tentarRenovar();
    if (renovado) {
      return fetch(url, {
        ...init,
        credentials: 'include',
        headers: { ...headersBase, ...(init?.headers as Record<string, string> | undefined) },
      });
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:sesion-expirada'));
    }
  }

  return respuesta;
}
