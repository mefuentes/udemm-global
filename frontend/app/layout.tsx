import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import { SidebarProvider } from '@/lib/sidebar-context';
import { LayoutClient } from './layout-client';
import { UppercaseInputGuard } from '@/components/UppercaseInputGuard';

export const metadata: Metadata = {
  title: 'UDEMM Global',
  description: 'Plataforma institucional académica para procesos de acreditación CONEAU.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-slate-50">
        <AuthProvider>
          <SidebarProvider>
            <UppercaseInputGuard />
            <LayoutClient>{children}</LayoutClient>
          </SidebarProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
