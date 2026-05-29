import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function DocentesLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
