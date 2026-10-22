'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import './notifications.css';

type NotiType = 'grade' | 'schedule' | 'exam' | 'fee' | 'conduct' | 'system' | 'message';
type FilterKey = 'all' | 'unread' | NotiType;

interface Notification {
    id: number;
    type: NotiType;
    title: string;
    body: string;
    time: string;
    read: boolean;
    important?: boolean;
    actionHref?: string;
    actionLabel?: string;
}

const TYPE_META: Record<NotiType, { label: string; icon: string; tone: string }> = {
    grade: { label: 'Điểm số', icon: '📊', tone: 'blue' },
    schedule: { label: 'Lịch học', icon: '📅', tone: 'sky' },
    exam: { label: 'Lịch thi', icon: '📝', tone: 'violet' },
    fee: { label: 'Học phí', icon: '💳', tone: 'amber' },
    conduct: { label: 'Nề nếp', icon: '☑', tone: 'green' },
    system: { label: 'Hệ thống', icon: '⚙️', tone: 'slate' },
    message: { label: 'Tin nhắn', icon: '💬', tone: 'rose' },
};

const DEMO: Notification[] = [
    {
        id: 1,
        type: 'grade',
        title: 'Có điểm mới – Toán (giữa kỳ)',
        body: 'Giáo viên đã nhập điểm giữa kỳ môn Toán: 8.5. Xem chi tiết trong bảng điểm.',
        time: 'Hôm nay · 09:12',
        read: false,
        important: true,
        actionHref: '/student/grades',
        actionLabel: 'Xem bảng điểm',
    },
    {
        id: 2,
        type: 'exam',
        title: 'Lịch thi học kỳ 1 đã công bố',
        body: 'Thời gian thi từ 15/12–22/12. Mang theo thẻ học sinh, có mặt trước giờ thi 15 phút.',
        time: 'Hôm nay · 08:05',
        read: false,
        actionHref: '/student/schedule/exams',
        actionLabel: 'Xem lịch thi',
    },
    {
        id: 3,
        type: 'fee',
        title: 'Nhắc đóng học phí đợt 2',
        body: 'Hạn đóng: 30/11. Còn nợ 1.250.000 đ. Liên hệ kế toán nếu cần gia hạn.',
        time: 'Hôm qua · 16:40',
        read: false,
        important: true,
        actionHref: '/student/fees',
        actionLabel: 'Xem học phí',
    },
    {
        id: 4,
        type: 'schedule',
        title: 'Thay đổi tiết 3 – Thứ Sáu',
        body: 'Tiết Vật lí chuyển sang phòng thực hành. Lớp học tại P.Lab 2.',
        time: 'Hôm qua · 11:20',
        read: true,
        actionHref: '/student/schedule',
        actionLabel: 'Xem TKB',
    },
    {
        id: 5,
        type: 'conduct',
        title: 'Nhận xét nề nếp tuần 12',
        body: 'GVCN: Chuyên cần tốt. Nhắc nhở nộp bài tập đúng hạn.',
        time: '2 ngày trước',
        read: true,
        actionHref: '/student/attendance',
        actionLabel: 'Xem chuyên cần',
    },
    {
        id: 6,
        type: 'message',
        title: 'Tin từ GVCN',
        body: 'Họp phụ huynh dự kiến tuần sau. Học sinh nhắc gia đình theo dõi sổ liên lạc.',
        time: '3 ngày trước',
        read: true,
    },
    {
        id: 7,
        type: 'system',
        title: 'Bảo trì hệ thống cuối tuần',
        body: 'Cổng học sinh tạm ngưng 22:00–23:00 ngày Chủ nhật để nâng cấp máy chủ.',
        time: '4 ngày trước',
        read: true,
    },
];

const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'Tất cả' },
    { key: 'unread', label: 'Chưa đọc' },
    { key: 'grade', label: 'Điểm' },
    { key: 'exam', label: 'Thi' },
    { key: 'schedule', label: 'Lịch học' },
    { key: 'fee', label: 'Học phí' },
    { key: 'conduct', label: 'Nề nếp' },
    { key: 'message', label: 'Tin nhắn' },
    { key: 'system', label: 'Hệ thống' },
];

export default function StudentNotificationsPage() {
    const [items, setItems] = useState<Notification[]>(DEMO);
    const [filter, setFilter] = useState<FilterKey>('all');
    const [q, setQ] = useState('');
    const [openId, setOpenId] = useState<number | null>(null);

    const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

    const list = useMemo(() => {
        return items.filter((n) => {
            if (filter === 'unread' && n.read) return false;
            if (filter !== 'all' && filter !== 'unread' && n.type !== filter) return false;
            if (q.trim()) {
                const s = `${n.title} ${n.body}`.toLowerCase();
                if (!s.includes(q.trim().toLowerCase())) return false;
            }
            return true;
        });
    }, [items, filter, q]);

    const markRead = (id: number) => {
        setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    };

    const markAllRead = () => {
        setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    };

    const toggleOpen = (id: number) => {
        setOpenId((cur) => (cur === id ? null : id));
        markRead(id);
    };

    return (
        <div className="nt-page">
            {/* Header */}
            <header className="nt-hero">
                <div className="nt-hero-text">
                    <p className="nt-kicker">Cổng học sinh</p>
                    <h1>Thông báo</h1>
                    <p className="nt-sub">
                        Điểm mới, lịch thi, học phí, tin từ giáo viên và nhà trường — tất cả tại một nơi.
                    </p>
                </div>
                <div className="nt-hero-stats">
                    <div className="nt-stat">
                        <strong>{items.length}</strong>
                        <span>Tổng thông báo</span>
                    </div>
                    <div className="nt-stat warn">
                        <strong>{unreadCount}</strong>
                        <span>Chưa đọc</span>
                    </div>
                </div>
            </header>

            {/* Toolbar */}
            <div className="nt-toolbar">
                <div className="nt-search">
                    <span className="nt-search-ico">⌕</span>
                    <input
                        type="search"
                        placeholder="Tìm theo tiêu đề, nội dung…"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                </div>
                <button type="button" className="nt-btn-ghost" onClick={markAllRead} disabled={unreadCount === 0}>
                    Đánh dấu đã đọc hết
                </button>
            </div>

            {/* Filters */}
            <div className="nt-filters" role="tablist">
                {FILTERS.map((f) => (
                    <button
                        key={f.key}
                        type="button"
                        role="tab"
                        className={`nt-chip ${filter === f.key ? 'on' : ''}`}
                        onClick={() => setFilter(f.key)}
                    >
                        {f.label}
                        {f.key === 'unread' && unreadCount > 0 && (
                            <em>{unreadCount}</em>
                        )}
                    </button>
                ))}
            </div>

            {/* Layout: list + tips */}
            <div className="nt-grid">
                <section className="nt-list" aria-label="Danh sách thông báo">
                    {list.length === 0 && (
                        <div className="nt-empty">
                            <div className="nt-empty-ico">🔔</div>
                            <h3>Không có thông báo phù hợp</h3>
                            <p>Thử đổi bộ lọc hoặc xóa từ khóa tìm kiếm.</p>
                        </div>
                    )}

                    {list.map((n) => {
                        const meta = TYPE_META[n.type];
                        const open = openId === n.id;
                        return (
                            <article
                                key={n.id}
                                className={`nt-card ${n.read ? 'read' : 'unread'} ${open ? 'open' : ''} tone-${meta.tone}`}
                            >
                                <button type="button" className="nt-card-main" onClick={() => toggleOpen(n.id)}>
                                    <div className={`nt-ico tone-${meta.tone}`}>{meta.icon}</div>
                                    <div className="nt-body">
                                        <div className="nt-top">
                                            <span className={`nt-type tone-${meta.tone}`}>{meta.label}</span>
                                            {n.important && <span className="nt-badge">Quan trọng</span>}
                                            {!n.read && <span className="nt-dot" title="Chưa đọc" />}
                                        </div>
                                        <h3>{n.title}</h3>
                                        <p className={open ? '' : 'clamp'}>{n.body}</p>
                                        <time>{n.time}</time>
                                    </div>
                                    <span className={`nt-chevron ${open ? 'up' : ''}`}>▾</span>
                                </button>

                                {open && (
                                    <div className="nt-detail">
                                        <p>{n.body}</p>
                                        <div className="nt-detail-actions">
                                            {n.actionHref && (
                                                <Link href={n.actionHref} className="nt-btn-primary">
                                                    {n.actionLabel || 'Xem chi tiết'}
                                                </Link>
                                            )}
                                            {!n.read && (
                                                <button type="button" className="nt-btn-ghost" onClick={() => markRead(n.id)}>
                                                    Đánh dấu đã đọc
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </article>
                        );
                    })}
                </section>

                <aside className="nt-side">
                    <div className="nt-side-card">
                        <h3>Phân loại nhanh</h3>
                        <ul className="nt-side-list">
                            {(Object.keys(TYPE_META) as NotiType[]).map((t) => {
                                const c = items.filter((n) => n.type === t).length;
                                const u = items.filter((n) => n.type === t && !n.read).length;
                                return (
                                    <li key={t}>
                                        <button type="button" onClick={() => setFilter(t)}>
                                            <span>{TYPE_META[t].icon} {TYPE_META[t].label}</span>
                                            <span className="nt-side-count">
                                                {u > 0 ? <em>{u} mới</em> : null}
                                                <b>{c}</b>
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    <div className="nt-side-card tip">
                        <h3>Gợi ý</h3>
                        <ul>
                            <li>Bật thông báo trình duyệt để nhận tin điểm và lịch thi sớm.</li>
                            <li>Thông báo học phí quan trọng sẽ được gắn nhãn đỏ.</li>
                            <li>Tin từ GVCN nằm trong mục <b>Tin nhắn</b>.</li>
                        </ul>
                    </div>

                    <div className="nt-side-card links">
                        <h3>Liên kết nhanh</h3>
                        <Link href="/student/grades">Bảng điểm</Link>
                        <Link href="/student/schedule">Thời khóa biểu</Link>
                        <Link href="/student/schedule/exams">Lịch thi</Link>
                        <Link href="/student/fees">Học phí</Link>
                    </div>
                </aside>
            </div>
        </div>
    );
}