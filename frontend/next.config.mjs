/** @type {import('next').NextConfig} */

const securityHeaders = [
  // Deshabilitar la detección automática de DNS para recursos embebidos
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  // Prevenir que la app sea embebida en iframes desde otros orígenes
  { key: 'X-Frame-Options', value: 'DENY' },
  // Evitar MIME-type sniffing por el navegador
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Controlar información de referrer enviada en navegaciones externas
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Restringir APIs de navegador no usadas por la aplicación
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Aplicar a todas las rutas
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
