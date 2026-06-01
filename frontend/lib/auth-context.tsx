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
  token: string | null;
  cargando: boolean;
  login: (correoElectronico: string, contrasena: string) => Promise<void>;
  logout: () => void;
  obtenerTokenActual: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const router = useRouter();

  // Obtener token actual desde localStorage
  const obtenerTokenActual = useCallback(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem('accessToken')?.trim() ?? null;
  }, []);

  // Obtener usuario actual desde localStorage
  const obtenerUsuarioActual = useCallback(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = window.localStorage.getItem('usuario');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  // Inicializar sesión desde localStorage
  useEffect(() => {
    const tokenGuardado = obtenerTokenActual();
    const usuarioGuardado = obtenerUsuarioActual();

    if (tokenGuardado && usuarioGuardado) {
      setToken(tokenGuardado);
      setUsuario(usuarioGuardado);
    }
    setCargando(false);
  }, [obtenerTokenActual, obtenerUsuarioActual]);

  const login = async (correoElectronico: string, contrasena: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correoElectronico, contrasena })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Credenciales inválidas');
      }

      const data = await response.json();
      const { accessToken, usuario: usuarioData } = data;

      window.localStorage.setItem('accessToken', accessToken);
      window.localStorage.setItem('usuario', JSON.stringify(usuarioData));

      setToken(accessToken);
      setUsuario(usuarioData);

      router.push('/');
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    window.localStorage.removeItem('accessToken');
    window.localStorage.removeItem('usuario');
    setToken(null);
    setUsuario(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ usuario, token, cargando, login, logout, obtenerTokenActual }}>
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
