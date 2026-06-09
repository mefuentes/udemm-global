'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function DocentesLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#f1f5f9] p-6 sm:p-8">
        {children}
      </div>
    </ProtectedRoute>
  );
}
