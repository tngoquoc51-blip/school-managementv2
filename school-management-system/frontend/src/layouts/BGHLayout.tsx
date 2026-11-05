'use client';

import { usePathname, useRouter } from 'next/navigation';
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import './bgh-layout.css';
import { usePendingApprovals } from '@/hooks/usePendingApprovals';
interface Props {
    children: ReactNode;
}

/* Giữ nguyên toàn bộ mục menu, đường dẫn và huy hiệu cũ */
const NAV_GROUPS = [
    {
        label: 'Tổng quan',
        items: [
            { href: '/bgh/dashboard', label: 'Dashboard', icon: 'grid', badge: 0 },
        ],
    },
    {
        label: 'Phê duyệt & Điều hành',
        items: [
            { href: '/bgh/approvals', label: 'Phê duyệt', icon: 'check', badge: 0 },
            { href: '/bgh/academic', label: 'Chuyên môn', icon: 'book', badge: 0 },
            { href: '/bgh/timetable', label: 'Thời khóa biểu', icon: 'clock', badge: 0 },
            { href: '/bgh/exams', label: 'Lịch thi & Kiểm tra', icon: 'exam', badge: 0 },
            { href: '/bgh/meetings', label: 'Lịch công tác & Họp', icon: 'cal', badge: 0 },
            { href: '/bgh/documents', label: 'Công văn', icon: 'mail', badge: 0 },
            { href: '/bgh/plans', label: 'Kế hoạch', icon: 'target', badge: 0 },
            { href: '/bgh/delegations', label: 'Ủy quyền phê duyệt', icon: 'delegate', badge: 0 },
        ],
    },
    {
        label: 'Nhân sự & Học sinh',
        items: [
            { href: '/bgh/staff', label: 'Nhân sự', icon: 'users', badge: 0 },
            { href: '/bgh/students', label: 'Học sinh', icon: 'student', badge: 0 },
            { href: '/bgh/classes', label: 'Lớp học', icon: 'layers', badge: 0 },
            { href: '/bgh/attendance', label: 'Chuyên cần', icon: 'attendance', badge: 0 },
            { href: '/bgh/evaluations', label: 'Dự giờ & Đánh giá GV', icon: 'eval', badge: 0 },
        ],
    },
    {
        label: 'Thi đua & Khen thưởng',
        items: [
            { href: '/bgh/rewards', label: 'Khen thưởng', icon: 'award', badge: 0 },
            { href: '/bgh/discipline', label: 'Kỷ luật', icon: 'alert', badge: 0 },
            { href: '/bgh/competition', label: 'Thi đua', icon: 'flag', badge: 0 },
        ],
    },
    {
        label: 'Báo cáo & Thông tin',
        items: [
            { href: '/bgh/reports', label: 'Báo cáo thống kê', icon: 'chart', badge: 0 },
            { href: '/bgh/notices', label: 'Thông báo', icon: 'bell', badge: 0 },
            { href: '/bgh/logs', label: 'Nhật ký', icon: 'log', badge: 0 },
        ],
    },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items.map((it) => ({ ...it, group: g.label })));

/* Icon đơn sắc (nét mảnh, không màu) – dùng currentColor */
function NavIcon({ name }: { name: string }) {
    const c = {
        width: 18,
        height: 18,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
        'aria-hidden': true,
    };
    switch (name) {
        case 'grid':
            return (
                <svg {...c}>
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
            );
        case 'check':
            return (
                <svg {...c}>
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
            );
        case 'book':
            return (
                <svg {...c}>
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
            );
        case 'clock':
            return (
                <svg {...c}>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                </svg>
            );
        case 'exam':
            return (
                <svg {...c}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6M9 15h6M9 11h6" />
                </svg>
            );
        case 'users':
            return (
                <svg {...c}>
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
            );
        case 'student':
            return (
                <svg {...c}>
                    <path d="m12 3 10 5-10 5L2 8l10-5z" />
                    <path d="M6 12.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-3.5" />
                </svg>
            );
        case 'layers':
            return (
                <svg {...c}>
                    <path d="M12 2 2 7l10 5 10-5-10-5z" />
                    <path d="m2 17 10 5 10-5" />
                    <path d="m2 12 10 5 10-5" />
                </svg>
            );
        case 'attendance':
            return (
                <svg {...c}>
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
            );
        case 'award':
            return (
                <svg {...c}>
                    <circle cx="12" cy="8" r="6" />
                    <path d="M15.5 14.5 17 22l-5-3-5 3 1.5-7.5" />
                </svg>
            );
        case 'alert':
            return (
                <svg {...c}>
                    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L12.7 3.9a2 2 0 0 0-3.4 0z" />
                    <path d="M12 9v4M12 17h.01" />
                </svg>
            );
        case 'flag':
            return (
                <svg {...c}>
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="22" x2="4" y2="15" />
                </svg>
            );
        case 'chart':
            return (
                <svg {...c}>
                    <path d="M3 3v18h18" />
                    <path d="M18 17V9" />
                    <path d="M13 17V5" />
                    <path d="M8 17v-3" />
                </svg>
            );
        case 'bell':
            return (
                <svg {...c}>
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                </svg>
            );
        case 'log':
            return (
                <svg {...c}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                </svg>
            );
        /* dùng cho khung mới */
        case 'search':
            return (
                <svg {...c}>
                    <circle cx="11" cy="11" r="6" />
                    <path d="M21 21l-4.3-4.3" />
                </svg>
            );
        case 'chevd':
            return (
                <svg {...c}>
                    <path d="M6 9l6 6 6-6" />
                </svg>
            );
        case 'panel':
            return (
                <svg {...c}>
                    <rect x="3" y="5" width="18" height="14" rx="1.5" />
                    <path d="M9 5v14" />
                </svg>
            );
        case 'menu':
            return (
                <svg {...c}>
                    <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
            );
        case 'close':
            return (
                <svg {...c}>
                    <path d="M6 6l12 12M18 6L6 18" />
                </svg>
            );
        case 'switch':
            return (
                <svg {...c}>
                    <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />
                </svg>
            );
        case 'logout':
            return (
                <svg {...c}>
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <path d="M16 17l5-5-5-5M21 12H9" />
                </svg>
            );
        case 'cal':
            return (
                <svg {...c}>
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
            );
        case 'mail':
            return (
                <svg {...c}>
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m4 7.5 8 6 8-6" />
                </svg>
            );
        case 'target':
            return (
                <svg {...c}>
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="6" />
                    <circle cx="12" cy="12" r="2" />
                </svg>
            );
        case 'delegate':
            return (
                <svg {...c}>
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M16 11l2 2 4-4" />
                </svg>
            );
        case 'eval':
            return (
                <svg {...c}>
                    <path d="M9 3h6v3H9zM15 4.5h3a1 1 0 0 1 1 1V21a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1h3" />
                    <path d="M9 14l2 2 4-4" />
                </svg>
            );
        case 'plus':
            return (
                <svg {...c}>
                    <path d="M12 5v14M5 12h14" />
                </svg>
            );
        default:
            return (
                <svg {...c}>
                    <circle cx="12" cy="12" r="3" />
                </svg>
            );
    }
}

/* Bỏ dấu để gõ "phe duyet" vẫn tìm ra "Phê duyệt" */
const normalize = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();

/* Năm học bắt đầu từ tháng 8; học kỳ 1: T8–T12, học kỳ 2: T1–T5 */
function schoolYear(d = new Date()) {
    const start = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
    return `${start} – ${start + 1}`;
}
function semester(d = new Date()) {
    const m = d.getMonth() + 1;
    if (m >= 8 && m <= 12) return 'Học kỳ 1';
    if (m >= 1 && m <= 5) return 'Học kỳ 2';
    return 'Nghỉ hè';
}


/* ===================================================================
   CHỨC NĂNG BỔ SUNG (tích hợp sẵn trong khung)
   Dữ liệu lưu trong trình duyệt (localStorage) của máy đang dùng – chưa lưu lên máy chủ.
   =================================================================== */
type FieldType = 'text' | 'textarea' | 'date' | 'datetime-local' | 'select' | 'number';
interface Field { key: string; label: string; type: FieldType; options?: string[]; required?: boolean; table?: boolean; full?: boolean }
interface Status { label: string; tone: 'sky' | 'ok' | 'warn' | 'err' | 'mut' }
interface Mod { slug: string; title: string; subtitle: string; noun: string; fields: Field[]; statusKey: string; statuses: Status[]; sortKey: string }
type Row = Record<string, string>;

const MODULES: Mod[] = [
    {
        slug: 'meetings', title: 'Lịch công tác & Họp', noun: 'cuộc họp', statusKey: 'status', sortKey: 'starts_at',
        subtitle: 'Lịch họp BGH, hội đồng sư phạm, họp tổ chuyên môn, họp phụ huynh; ghi chương trình và biên bản.',
        statuses: [{ label: 'Sắp diễn ra', tone: 'sky' }, { label: 'Đã họp', tone: 'ok' }, { label: 'Đã hủy', tone: 'mut' }],
        fields: [
            { key: 'title', label: 'Nội dung / tên cuộc họp', type: 'text', required: true, full: true },
            { key: 'type', label: 'Loại', type: 'select', options: ['Họp BGH', 'Hội đồng sư phạm', 'Họp tổ chuyên môn', 'Họp phụ huynh', 'Khác'] },
            { key: 'starts_at', label: 'Thời gian', type: 'datetime-local', required: true },
            { key: 'location', label: 'Địa điểm', type: 'text' },
            { key: 'attendees', label: 'Thành phần tham dự', type: 'text', table: false },
            { key: 'status', label: 'Trạng thái', type: 'select', options: ['Sắp diễn ra', 'Đã họp', 'Đã hủy'] },
            { key: 'agenda', label: 'Chương trình họp', type: 'textarea', table: false, full: true },
            { key: 'minutes', label: 'Biên bản / kết luận', type: 'textarea', table: false, full: true },
        ],
    },
    {
        slug: 'documents', title: 'Công văn', noun: 'công văn', statusKey: 'status', sortKey: 'issued_date',
        subtitle: 'Công văn đến / đi: số hiệu, trích yếu, người xử lý, hạn xử lý và ý kiến chỉ đạo.',
        statuses: [{ label: 'Mới', tone: 'sky' }, { label: 'Đang xử lý', tone: 'warn' }, { label: 'Đã xử lý', tone: 'ok' }],
        fields: [
            { key: 'number', label: 'Số hiệu', type: 'text', required: true },
            { key: 'direction', label: 'Loại', type: 'select', options: ['Công văn đến', 'Công văn đi'] },
            { key: 'issued_date', label: 'Ngày ban hành', type: 'date', required: true },
            { key: 'title', label: 'Trích yếu', type: 'text', required: true, full: true },
            { key: 'organization', label: 'Cơ quan ban hành / nhận', type: 'text', table: false },
            { key: 'handler', label: 'Người xử lý', type: 'text' },
            { key: 'due_date', label: 'Hạn xử lý', type: 'date' },
            { key: 'status', label: 'Trạng thái', type: 'select', options: ['Mới', 'Đang xử lý', 'Đã xử lý'] },
            { key: 'note', label: 'Ghi chú / ý kiến chỉ đạo', type: 'textarea', table: false, full: true },
        ],
    },
    {
        slug: 'plans', title: 'Kế hoạch', noun: 'kế hoạch', statusKey: 'status', sortKey: 'start_date',
        subtitle: 'Kế hoạch năm học, học kỳ, tháng và tuần của nhà trường; theo dõi tiến độ thực hiện.',
        statuses: [{ label: 'Nháp', tone: 'mut' }, { label: 'Đang thực hiện', tone: 'sky' }, { label: 'Hoàn thành', tone: 'ok' }],
        fields: [
            { key: 'title', label: 'Tên kế hoạch', type: 'text', required: true, full: true },
            { key: 'period', label: 'Kỳ', type: 'select', options: ['Năm học', 'Học kỳ', 'Tháng', 'Tuần'] },
            { key: 'owner', label: 'Phụ trách', type: 'text' },
            { key: 'start_date', label: 'Bắt đầu', type: 'date' },
            { key: 'end_date', label: 'Kết thúc', type: 'date' },
            { key: 'status', label: 'Trạng thái', type: 'select', options: ['Nháp', 'Đang thực hiện', 'Hoàn thành'] },
            { key: 'content', label: 'Nội dung chi tiết', type: 'textarea', table: false, full: true },
        ],
    },
    {
        slug: 'delegations', title: 'Ủy quyền phê duyệt', noun: 'ủy quyền', statusKey: 'status', sortKey: 'from_date',
        subtitle: 'Ghi nhận việc ủy quyền phê duyệt cho Phó Hiệu trưởng khi vắng mặt: phạm vi, thời hạn, lý do.',
        statuses: [{ label: 'Đang hiệu lực', tone: 'ok' }, { label: 'Đã hết hạn', tone: 'mut' }, { label: 'Đã thu hồi', tone: 'err' }],
        fields: [
            { key: 'delegate', label: 'Người được ủy quyền', type: 'text', required: true },
            { key: 'scope', label: 'Phạm vi', type: 'select', options: ['Toàn bộ phê duyệt', 'Phê duyệt chuyên môn', 'Phê duyệt tài chính', 'Phê duyệt nhân sự'] },
            { key: 'from_date', label: 'Từ ngày', type: 'date', required: true },
            { key: 'to_date', label: 'Đến ngày', type: 'date', required: true },
            { key: 'status', label: 'Trạng thái', type: 'select', options: ['Đang hiệu lực', 'Đã hết hạn', 'Đã thu hồi'] },
            { key: 'reason', label: 'Lý do / ghi chú', type: 'textarea', table: false, full: true },
        ],
    },
    {
        slug: 'evaluations', title: 'Dự giờ & Đánh giá giáo viên', noun: 'phiếu dự giờ', statusKey: 'rating', sortKey: 'date',
        subtitle: 'Phiếu dự giờ, xếp loại tiết dạy; ghi ưu điểm, góp ý cải thiện và gửi lại cho giáo viên.',
        statuses: [{ label: 'Xuất sắc', tone: 'ok' }, { label: 'Tốt', tone: 'ok' }, { label: 'Khá', tone: 'sky' }, { label: 'Đạt', tone: 'warn' }, { label: 'Chưa đạt', tone: 'err' }],
        fields: [
            { key: 'teacher', label: 'Giáo viên', type: 'text', required: true },
            { key: 'subject', label: 'Môn', type: 'text' },
            { key: 'class', label: 'Lớp', type: 'text' },
            { key: 'date', label: 'Ngày dự giờ', type: 'date', required: true },
            { key: 'lesson', label: 'Tên bài dạy', type: 'text', table: false },
            { key: 'score', label: 'Điểm (0–10)', type: 'number' },
            { key: 'rating', label: 'Xếp loại', type: 'select', options: ['Xuất sắc', 'Tốt', 'Khá', 'Đạt', 'Chưa đạt'] },
            { key: 'strengths', label: 'Ưu điểm', type: 'textarea', table: false, full: true },
            { key: 'improvements', label: 'Góp ý cải thiện', type: 'textarea', table: false, full: true },
        ],
    },
];

const showVal = (f: Field, v: string | undefined) => {
    if (!v) return '—';
    if (f.type === 'date') { const [y, mo, d] = v.split('-'); return y && mo && d ? `${d}/${mo}/${y}` : v; }
    if (f.type === 'datetime-local') { const [dt, tm] = v.split('T'); const [y, mo, d] = (dt || '').split('-'); return y ? `${d}/${mo}/${y} ${tm ?? ''}`.trim() : v; }
    return v;
};

function BuiltInModule({ m }: { m: Mod }) {
    const KEY = `bgh:${m.slug}`;
    const [rows, setRows] = useState<Row[]>([]);
    const [q, setQ] = useState('');
    const [flt, setFlt] = useState('');
    const [form, setForm] = useState<Row | null>(null);
    const [msg, setMsg] = useState('');

    useEffect(() => {
        try { setRows(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { setRows([]); }
    }, [KEY]);

    useEffect(() => {
        if (!form) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setForm(null);
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [form]);

    const toast = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 3200); };
    const persist = (next: Row[]) => {
        setRows(next);
        try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { toast('Không lưu được: bộ nhớ trình duyệt đã đầy.'); }
    };

    const list = useMemo(() => {
        const k = normalize(q.trim());
        return rows
            .filter((r) => (!flt || r[m.statusKey] === flt) && (!k || normalize(m.fields.map((f) => r[f.key] ?? '').join(' ')).includes(k)))
            .sort((a, b) => String(b[m.sortKey] || b.createdAt).localeCompare(String(a[m.sortKey] || a.createdAt)));
    }, [rows, q, flt, m]);

    const openNew = () => {
        const d: Row = {};
        m.fields.forEach((f) => { if (f.type === 'select' && f.options) d[f.key] = f.options[0]; });
        setForm(d);
    };

    const save = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!form) return;
        const miss = m.fields.find((f) => f.required && !(form[f.key] ?? '').trim());
        if (miss) return toast(`Vui lòng nhập “${miss.label}”.`);
        if (form.id) {
            persist(rows.map((r) => (r.id === form.id ? { ...r, ...form } : r)));
            toast('Đã cập nhật.');
        } else {
            persist([{ ...form, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), createdAt: new Date().toISOString() }, ...rows]);
            toast(`Đã thêm ${m.noun} mới.`);
        }
        setForm(null);
    };

    const remove = (r: Row) => {
        if (confirm(`Xóa ${m.noun} “${r[m.fields[0].key]}”? Hành động này không thể hoàn lại.`)) {
            persist(rows.filter((x) => x.id !== r.id));
            toast('Đã xóa.');
        }
    };

    const exportCsv = () => {
        const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = [m.fields.map((f) => esc(f.label)).join(','), ...list.map((r) => m.fields.map((f) => esc(showVal(f, r[f.key]) === '—' ? '' : showVal(f, r[f.key]))).join(','))].join('\r\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
        a.download = `${m.slug}.csv`;
        document.body.appendChild(a); a.click(); a.remove();
        toast(`Đã xuất ${list.length} dòng.`);
    };

    const tone = (label: string) => m.statuses.find((s) => s.label === label)?.tone ?? 'mut';
    const cols = m.fields.filter((f) => f.table !== false);

    return (
        <div className="bgh-mod">
            <div className="bgh-mod-head">
                <div>
                    <h2>{m.title}</h2>
                    <p>{m.subtitle}</p>
                </div>
                <div className="bgh-mod-actions">
                    <button type="button" className="bgh-mod-btn ghost" onClick={exportCsv} disabled={!list.length}>Xuất CSV</button>
                    <button type="button" className="bgh-mod-btn" onClick={openNew}><NavIcon name="plus" />Thêm mới</button>
                </div>
            </div>

            <div className="bgh-mod-note">Dữ liệu của mục này được lưu trong trình duyệt của máy đang dùng. Cần dùng chung nhiều máy thì phải nối với máy chủ.</div>

            <div className="bgh-mod-stats">
                <div className="bgh-mod-stat"><span>Tổng số</span><b>{rows.length}</b></div>
                {m.statuses.slice(0, 3).map((s) => (
                    <div key={s.label} className={`bgh-mod-stat ${s.tone}`}><span>{s.label}</span><b>{rows.filter((r) => r[m.statusKey] === s.label).length}</b></div>
                ))}
            </div>

            <div className="bgh-mod-bar">
                <input className="bgh-mod-in" type="search" placeholder="Tìm kiếm…" value={q} onChange={(e) => setQ(e.target.value)} />
                <select className="bgh-mod-in" value={flt} onChange={(e) => setFlt(e.target.value)}>
                    <option value="">Tất cả {m.fields.find((f) => f.key === m.statusKey)?.label.toLowerCase()}</option>
                    {m.statuses.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
                </select>
            </div>

            <div className="bgh-mod-tw">
                <table className="bgh-mod-table">
                    <thead>
                    <tr>{cols.map((f) => <th key={f.key}>{f.label}</th>)}<th /></tr>
                    </thead>
                    <tbody>
                    {list.map((r) => (
                        <tr key={r.id}>
                            {cols.map((f, i) => (
                                <td key={f.key}>
                                    {f.key === m.statusKey
                                        ? <span className={`bgh-pill ${tone(r[f.key])}`}>{r[f.key] || '—'}</span>
                                        : i === 0 ? <b>{showVal(f, r[f.key])}</b> : showVal(f, r[f.key])}
                                </td>
                            ))}
                            <td className="bgh-mod-act">
                                <button type="button" className="bgh-mod-btn ghost sm" onClick={() => setForm({ ...r })}>Sửa</button>
                                <button type="button" className="bgh-mod-btn ghost sm danger" onClick={() => remove(r)}>Xóa</button>
                            </td>
                        </tr>
                    ))}
                    {!list.length && (
                        <tr><td colSpan={cols.length + 1} className="bgh-mod-empty">{rows.length ? 'Không có kết quả phù hợp.' : `Chưa có ${m.noun} nào. Bấm “Thêm mới” để bắt đầu.`}</td></tr>
                    )}
                    </tbody>
                </table>
            </div>

            {form && (
                <div className="bgh-mod-bg" onMouseDown={(e) => e.target === e.currentTarget && setForm(null)}>
                    <form className="bgh-mod-modal" onSubmit={save} role="dialog" aria-modal="true" aria-label={m.title}>
                        <header><h3>{form.id ? 'Sửa' : 'Thêm'} {m.noun}</h3><button type="button" onClick={() => setForm(null)} aria-label="Đóng"><NavIcon name="close" /></button></header>
                        <div className="bgh-mod-form">
                            {m.fields.map((f) => (
                                <label key={f.key} className={f.full ? 'full' : ''}>
                                    <span>{f.label}{f.required && ' *'}</span>
                                    {f.type === 'textarea' ? (
                                        <textarea className="bgh-mod-in" rows={3} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                                    ) : f.type === 'select' ? (
                                        <select className="bgh-mod-in" value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                                            {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    ) : (
                                        <input className="bgh-mod-in" type={f.type} value={form[f.key] ?? ''} min={f.type === 'number' ? 0 : undefined} max={f.type === 'number' ? 10 : undefined} step={f.type === 'number' ? '0.1' : undefined}
                                               onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                                    )}
                                </label>
                            ))}
                        </div>
                        <footer>
                            <button type="button" className="bgh-mod-btn ghost" onClick={() => setForm(null)}>Hủy</button>
                            <button type="submit" className="bgh-mod-btn">Lưu</button>
                        </footer>
                    </form>
                </div>
            )}
            {msg && <div className="bgh-mod-toast" role="status">{msg}</div>}
        </div>
    );
}

export default function BGHLayout({ children }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<{ name?: string } | null>(null);
    const [collapsed, setCollapsed] = useState(false);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [closed, setClosed] = useState<Record<string, boolean>>({});
    const [logoFail, setLogoFail] = useState(false);
    const [today, setToday] = useState('');
    const searchRef = useRef<HTMLInputElement>(null);
    const pending = usePendingApprovals() ?? 0;
    useEffect(() => {
        const stored = localStorage.getItem('user');
        if (stored) {
            try {
                setUser(JSON.parse(stored));
            } catch {
                /* ignore */
            }
        }
        setToday(new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }));
    }, []);

    useEffect(() => setOpen(false), [pathname]);

    /* nhớ trạng thái thu gọn, phím Esc đóng menu, Ctrl+K tìm nhanh chức năng */
    useEffect(() => {
        try { setCollapsed(localStorage.getItem('bgh-collapsed') === '1'); } catch { /* ignore */ }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setCollapsed(false);
                setOpen(true);
                setTimeout(() => searchRef.current?.focus(), 60);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const toggleCollapsed = () => {
        const next = !collapsed;
        setCollapsed(next);
        try { localStorage.setItem('bgh-collapsed', next ? '1' : '0'); } catch { /* ignore */ }
    };

    const handleLogout = () => {
        localStorage.clear();
        router.push('/login/bgh');
    };

    const isActive = (href: string) =>
        pathname === href || (pathname?.startsWith(href + '/') ?? false);

    const current = useMemo(
        () => ALL_ITEMS.find((it) => pathname === it.href || (pathname?.startsWith(it.href + '/') ?? false)),
        [pathname],
    );
    const curGroup = current?.group;

    /* Vào trang thuộc nhóm đang gập → tự mở nhóm đó */
    useEffect(() => {
        if (!curGroup) return;
        setClosed((c) => (c[curGroup] ? { ...c, [curGroup]: false } : c));
    }, [curGroup]);

    const q = normalize(query.trim());
    const groups = useMemo(() => {
        if (!q) return NAV_GROUPS;
        return NAV_GROUPS
            .map((g) => ({ ...g, items: g.items.filter((i) => normalize(i.label).includes(q)) }))
            .filter((g) => g.items.length > 0);
    }, [q]);

    const isDash = !current || current.href === '/bgh/dashboard';
    const title = isDash ? 'Ban Giám hiệu' : current!.label;
    const desc = isDash ? 'Điều hành chuyên môn & phê duyệt toàn trường' : `Ban Giám hiệu · ${current!.group}`;
    const initial = (user?.name || 'H').charAt(0).toUpperCase();
    const builtin = MODULES.find((m) => pathname === `/bgh/${m.slug}` || (pathname?.startsWith(`/bgh/${m.slug}/`) ?? false));

    return (
        <div className={`bgh ${collapsed ? 'bgh--collapsed' : ''}`}>
            {open && <div className="bgh-overlay" onClick={() => setOpen(false)} />}

            {/* ============ SIDEBAR ============ */}
            <aside className={`bgh-sidebar ${open ? 'open' : ''}`}>
                <button type="button" className="bgh-close" onClick={() => setOpen(false)} aria-label="Đóng menu">
                    <NavIcon name="close" />
                </button>

                <div className="bgh-brand">
                    {logoFail ? (
                        <div className="bgh-brand-mark bgh-brand-fb">TH</div>
                    ) : (
                        <img
                            src="/images/logo-thpt-ngo-sy-lien.png"
                            alt="Logo trường"
                            className="bgh-brand-mark"
                            onError={() => setLogoFail(true)}
                        />
                    )}
                    <div className="bgh-brand-text">
                        <div className="bgh-brand-title">Ban Giám hiệu</div>
                        <div className="bgh-brand-sub">Trường THPT</div>
                    </div>
                </div>

                <div className="bgh-search">
                    <NavIcon name="search" />
                    <input
                        ref={searchRef}
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && groups[0]?.items[0]) {
                                router.push(groups[0].items[0].href);
                                setQuery('');
                            }
                        }}
                        placeholder="Tìm chức năng…"
                        aria-label="Tìm chức năng"
                    />
                    <kbd>Ctrl K</kbd>
                </div>

                <nav className="bgh-nav" aria-label="Menu Ban Giám hiệu">
                    {groups.map((group) => {
                        const shut = !q && !!closed[group.label];
                        return (
                            <div key={group.label} className="bgh-nav-group">
                                <button
                                    type="button"
                                    className="bgh-nav-label"
                                    aria-expanded={!shut}
                                    onClick={() => setClosed((c) => ({ ...c, [group.label]: !c[group.label] }))}
                                >
                                    <span>{group.label}</span>
                                    <span className={`bgh-nav-chev${shut ? ' shut' : ''}`}><NavIcon name="chevd" /></span>
                                </button>

                                <div className={`bgh-nav-items${shut ? ' shut' : ''}`}>
                                    {group.items.map((item) => (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={`bgh-nav-item ${isActive(item.href) ? 'is-active' : ''}`}
                                            title={item.label}
                                            aria-current={isActive(item.href) ? 'page' : undefined}
                                        >
                                            <span className="bgh-nav-icon">
                                                <NavIcon name={item.icon} />
                                            </span>
                                            <span className="bgh-nav-text">{item.label}</span>
                                            {(() => {
                                                const n = item.href === '/bgh/approvals' ? pending : item.badge;
                                                return n > 0 ? <span className="bgh-nav-badge">{n}</span> : null;
                                            })()}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                    {groups.length === 0 && <p className="bgh-empty">Không tìm thấy chức năng phù hợp.</p>}
                </nav>

                <div className="bgh-sidebar-foot">
                    <div className="bgh-user-card">
                        <div className="bgh-user-avatar">{initial}</div>
                        <div className="bgh-user-meta">
                            <div className="bgh-user-name">{user?.name || 'Hiệu trưởng'}</div>
                            <div className="bgh-user-role">Ban Giám hiệu</div>
                        </div>
                    </div>
                    <Link href="/" className="bgh-switch-role" title="Đổi vai trò">
                        <NavIcon name="switch" />
                        <span>Đổi vai trò</span>
                    </Link>
                    <button type="button" onClick={handleLogout} className="bgh-logout" title="Đăng xuất">
                        <NavIcon name="logout" />
                        <span>Đăng xuất</span>
                    </button>
                </div>
            </aside>

            {/* ============ MAIN ============ */}
            <div className="bgh-main">
                <header className="bgh-topbar">
                    <button type="button" className="bgh-burger" onClick={() => setOpen(true)} aria-label="Mở menu">
                        <NavIcon name="menu" />
                    </button>
                    <button
                        type="button"
                        className="bgh-collapse-btn"
                        onClick={toggleCollapsed}
                        aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
                        title={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
                    >
                        <NavIcon name="panel" />
                    </button>

                    <div className="bgh-topbar-left">
                        <p className="bgh-page-desc">{desc}</p>
                        <h1 className="bgh-page-title">{title}</h1>
                    </div>

                    <div className="bgh-topbar-right">
                        <Link href="/bgh/approvals" className="bgh-approve" title="Việc cần phê duyệt">
                            <NavIcon name="check" />
                            <span>Phê duyệt</span>
                            {pending > 0 && <em>{pending}</em>}
                        </Link>
                        <Link href="/bgh/notices" className="bgh-bell" aria-label="Thông báo" title="Thông báo">
                            <NavIcon name="bell" />
                        </Link>
                        {today && <span className="bgh-chip bgh-chip--date"><NavIcon name="cal" />{today}</span>}
                        <span className="bgh-chip">Năm học {schoolYear()}</span>
                        <span className="bgh-chip bgh-chip--sky">{semester()}</span>
                        <span className="bgh-chip bgh-chip--soft">Hiệu trưởng</span>
                    </div>
                </header>
                <main className="bgh-content">{builtin ? <BuiltInModule key={builtin.slug} m={builtin} /> : children}</main>
            </div>
        </div>
    );
}