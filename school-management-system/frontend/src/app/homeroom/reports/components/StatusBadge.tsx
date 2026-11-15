import { ReportStatus } from '@/types/homeroom-report';

const map: Record<ReportStatus, { label: string; className: string }> = {
    draft: { label: 'Bản nháp', className: 'bg-gray-100 text-gray-700' },
    submitted: { label: 'Đã gửi', className: 'bg-blue-100 text-blue-700' },
    approved: { label: 'Đã duyệt', className: 'bg-green-100 text-green-700' },
    rejected: { label: 'Từ chối', className: 'bg-red-100 text-red-700' },
    archived: { label: 'Lưu trữ', className: 'bg-slate-100 text-slate-600' },
};

export default function StatusBadge({ status }: { status: ReportStatus }) {
    const item = map[status] || map.draft;
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.className}`}>
      {item.label}
    </span>
    );
}