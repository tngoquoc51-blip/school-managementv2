import AdminLayout from '@/layouts/AdminLayout';
import { ToastProvider } from '@/modules/admin/components/ui/Toast';
import type { ReactNode } from 'react';
import '@/styles/admin.css';

export default function Layout({ children }: { children: ReactNode }) {
  return (
      <AdminLayout>
        <ToastProvider>
          <div className="adm adm-embed" data-theme="light">{children}</div>
        </ToastProvider>
      </AdminLayout>
  );
}