'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Usuario {
  id: string;
  correoElectronico: string;
  nombre: string;
  apellido: string;
  rol: {
    id: string;
    nombre: string;
  };
}

interface AuthContextType {
  usuario: Usuario | null;
  cargando: boolean;
  login: (correoElectronico: string, contrasena: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const router = useRouter();

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // ignorar errores de red — la sesión local se limpia igual
    }
    setUsuario(null);
    router.push('/login');
  }, [router]);

  // Restaurar sesión desde el servidor al montar la aplicación
  useEffect(() => {
    let activo = true;
    fetch(`${API_URL}/auth/me`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (activo && data?.usuario) {
          setUsuario(data.usuario);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => { activo = false; };
  }, []);

  // Escuchar evento de sesión expirada emitido por apiFetch
  useEffect(() => {
    const onExpirada = () => {
      setUsuario(null);
      router.push('/login');
    };
    window.addEventListener('auth:sesion-expirada', onExpirada);
    return () => window.removeEventListener('auth:sesion-expirada', onExpirada);
  }, [router]);

  const login = async (correoElectronico: string, contrasena: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ correoElectronico, contrasena }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error((error as { message?: string }).message || 'Credenciales inválidas');
      }

      const data = await response.json();
      setUsuario(data.usuario);
      router.push('/');
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error(`No se pudo conectar al servidor. Backend no disponible en ${API_URL}`);
      }
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}
