import { redirect } from 'next/navigation';

// Đường dẫn cũ (số ít) tự chuyển sang /bgh/approvals để menu sáng đúng mục Phê duyệt.
export default function Page() {
    redirect('/bgh/approvals');
}