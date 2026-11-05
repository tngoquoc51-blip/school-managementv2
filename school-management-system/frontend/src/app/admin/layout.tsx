import AdminLayout from '@/layouts/AdminLayout';
import { ToastProvider } from '@/modules/admin/components/ui/Toast';
import type { ReactNode } from 'react';
import '@/styles/admin.css';

/*
 * Bộ giao diện mới dùng class gốc "ads" (KHÔNG dùng "adm" vì AdminLayout đã dùng "adm" làm class gốc;
 * trùng tên thì CSS mới đè lên menu, đổi màu và biến khung nội dung thành flex nên bị lệch trái).
 */
export default function Layout({ children }: { children: ReactNode }) {
    return (
        <AdminLayout>
            <ToastProvider>
                <div className="ads ads-embed" data-theme="light">{children}</div>
            </ToastProvider>
        </AdminLayout>
    );
}