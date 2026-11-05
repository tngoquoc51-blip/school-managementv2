import ApprovalPage from '@/modules/bgh/pages/ApprovalPage';

export const metadata = { title: 'Phê duyệt' };

// Đây là đường dẫn chính (khớp menu BGH: /bgh/approvals). BGHLayout đã bọc sẵn ở cấp trên.
export default function Page() {
    return <ApprovalPage />;
}