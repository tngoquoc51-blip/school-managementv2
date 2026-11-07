import type { Metadata } from 'next';
import ApprovalsApp from '@/modules/bgh/approvals/ApprovalsApp';

export const metadata: Metadata = { title: 'Phê duyệt – Cổng Ban giám hiệu' };

// Không bọc BGHLayout ở đây: src/app/bgh/layout.tsx (nếu có) đã bọc sẵn.
export default function Page() {
    return <ApprovalsApp />;
}