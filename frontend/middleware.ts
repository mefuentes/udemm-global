import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rutas accesibles sin autenticación
const PUBLIC_PATHS = [
  '/login',
  '/solicitar-recuperacion',
  '/restablecer-contrasena',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const esPublica = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );

  if (esPublica) {
    return NextResponse.next();
  }

  // El middleware de Next.js puede leer cookies del request server-side,
  // incluyendo las HttpOnly. Esta verificación es solo de navegación:
  // el backend sigue siendo la autoridad de autenticación real.
  const authToken = request.cookies.get('auth_token');

  if (!authToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Excluir assets estáticos, imágenes y archivos con extensión
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
