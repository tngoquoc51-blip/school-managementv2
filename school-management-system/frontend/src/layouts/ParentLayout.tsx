'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import './parent-layout.css';

interface Props {
    children: ReactNode;
}

const ICONS = {
    dashboard: (
        <>
            <rect x="3" y="3" width="7" height="9" rx="1" />
            <rect x="14" y="3" width="7" height="5" rx="1" />
            <rect x="14" y="12" width="7" height="9" rx="1" />
            <rect x="3" y="16" width="7" height="5" rx="1" />
        </>
    ),
    children: (
        <>
            <circle cx="9" cy="7" r="3" />
            <path d="M3 20v-1a6 6 0 0 1 12 0v1" />
            <circle cx="17" cy="8" r="2.2" />
            <path d="M15.5 14a4.5 4.5 0 0 1 5.5 4v2" />
        </>
    ),
    grades: <path d="M12 20V10M18 20V4M6 20v-4" />,
    attendance: (
        <>
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </>
    ),
    conduct: (
        <>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20a8 8 0 0 1 16 0" />
        </>
    ),
    schedule: (
        <>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
        </>
    ),
    notice: (
        <>
            <path d="M18 8A6 6 0 1 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </>
    ),
    message: (
        <>
            <path d="M21 15a4 4 0 0 1-4 4H7l-4 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
        </>
    ),
    fees: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 6v12M15 9.5c0-1.5-1.3-2.5-3-2.5s-3 1-3 2.5 1.3 2.5 3 2.5 3 1 3 2.5-1.3 2.5-3 2.5" />
        </>
    ),
    leave: (
        <>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18M8 14h8" />
        </>
    ),
};

type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
    {
        title: 'Tổng quan',
        items: [
            { href: '/parent/dashboard', label: 'Trang chủ', icon: 'dashboard' },
            { href: '/parent/children', label: 'Chọn con', icon: 'children' },
        ],
    },
    {
        title: 'Học tập của con',
        items: [
            { href: '/parent/grades', label: 'Bảng điểm', icon: 'grades' },
            { href: '/parent/attendance', label: 'Chuyên cần', icon: 'attendance' },
            { href: '/parent/conduct', label: 'Rèn luyện', icon: 'conduct' },
            { href: '/parent/schedule', label: 'Thời khóa biểu', icon: 'schedule' },
        ],
    },
    {
        title: 'Liên lạc & tài chính',
        items: [
            { href: '/parent/notifications', label: 'Thông báo', icon: 'notice' },
            { href: '/parent/messages', label: 'Nhắn tin GVCN', icon: 'message' },
            { href: '/parent/fees', label: 'Học phí', icon: 'fees' },
            { href: '/parent/leave', label: 'Xin nghỉ phép', icon: 'leave' },
        ],
    },
];

export default function ParentLayout({ children }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<{ name?: string; id?: number } | null>(null);
    const [child, setChild] = useState<{ name?: string; className?: string } | null>(null);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('user');
        if (!stored) {
            router.push('/login');
            return;
        }
        try {
            setUser(JSON.parse(stored));
        } catch {
            router.push('/login');
        }

        const c = localStorage.getItem('parent_child');
        if (c) {
            try {
                setChild(JSON.parse(c));
            } catch {
                /* ignore */
            }
        }
    }, [router]);

    const handleLogout = () => {
        localStorage.clear();
        router.push('/login');
    };

    const yearLabel = '2025 – 2026';

    const activePath = useMemo(() => pathname || '', [pathname]);

    return (
        <div className="ph-layout">
            {open && <div className="ph-overlay" onClick={() => setOpen(false)} />}

            <aside className={`ph-sidebar ${open ? 'open' : ''}`}>
                <div className="ph-brand">
                    <div className="ph-logo">TH</div>
                    <div>
                        <strong>Cổng Phụ huynh</strong>
                        <small>Trường THPT</small>
                    </div>
                    <button type="button" className="ph-close" onClick={() => setOpen(false)} aria-label="Đóng menu">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                    </button>
                </div>

                <nav className="ph-nav">
                    {NAV_GROUPS.map((g) => (
                        <div key={g.title} className="ph-nav-group">
                            <span className="ph-nav-title">{g.title}</span>
                            {g.items.map((item) => {
                                const active = activePath === item.href || activePath.startsWith(item.href + '/');
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`ph-nav-item ${active ? 'active' : ''}`}
                                        onClick={() => setOpen(false)}
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                            {ICONS[item.icon]}
                                        </svg>
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                <div className="ph-sidebar-foot">
                    <div className="ph-user">
                        <span className="ph-avatar">{(user?.name || 'P').charAt(0).toUpperCase()}</span>
                        <div>
                            <b>{user?.name || 'Phụ huynh'}</b>
                            <small>{child ? `Con: ${child.name}` : 'Chưa chọn con'}</small>
                        </div>
                    </div>
                    <button type="button" className="ph-logout" onClick={handleLogout}>
                        Đăng xuất
                    </button>
                </div>
            </aside>

            <div className="ph-main">
                <header className="ph-header">
                    <button type="button" className="ph-burger" onClick={() => setOpen(true)} aria-label="Mở menu">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 7h16M4 12h16M4 17h16" />
                        </svg>
                    </button>
                    <div>
                        <h1>Cổng thông tin Phụ huynh</h1>
                        <p>Theo dõi học tập · chuyên cần · học phí của con</p>
                    </div>
                    <div className="ph-header-right">
                        <span className="ph-badge">Năm học {yearLabel}</span>
                        {child?.className && <span className="ph-badge sky">Lớp {child.className}</span>}
                    </div>
                </header>
                <div className="ph-content">{children}</div>
            </div>
        </div>
    );
}