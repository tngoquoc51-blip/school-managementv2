'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import './parent-layout.css';

interface Props {
    children: ReactNode;
}

/* ===== ICON (giữ nguyên bộ icon cũ, chỉ thêm vài icon cho khung mới) ===== */
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
    message: <path d="M21 15a4 4 0 0 1-4 4H7l-4 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />,
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
    /* dùng cho khung mới */
    search: (
        <>
            <circle cx="11" cy="11" r="6" />
            <path d="M21 21l-4.3-4.3" />
        </>
    ),
    chevd: <path d="M6 9l6 6 6-6" />,
    panel: (
        <>
            <rect x="3" y="5" width="18" height="14" rx="1.5" />
            <path d="M9 5v14" />
        </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="M6 6l12 12M18 6L6 18" />,
    logout: (
        <>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5M21 12H9" />
        </>
    ),
    cal: (
        <>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
        </>
    ),
};

type IconName = keyof typeof ICONS;

function Icon({ name }: { name: IconName }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ICONS[name]}
        </svg>
    );
}

type NavItem = { href: string; label: string; icon: IconName };

/* Giữ nguyên toàn bộ mục menu cũ */
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

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items.map((it) => ({ ...it, group: g.title })));

/* Bỏ dấu để gõ "bang diem" vẫn tìm ra "Bảng điểm" */
const normalize = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();

type Child = { name?: string; className?: string; class?: string; class_name?: string };

export default function ParentLayout({ children }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<{ name?: string; id?: number } | null>(null);
    const [child, setChild] = useState<Child | null>(null);
    const [open, setOpen] = useState(false);
    const [mini, setMini] = useState(false);
    const [query, setQuery] = useState('');
    const [closed, setClosed] = useState<Record<string, boolean>>({});
    const [logoFail, setLogoFail] = useState(false);

    /* ---- đăng nhập + con đang chọn (giữ nguyên logic cũ) ---- */
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

        const readChild = () => {
            const c = localStorage.getItem('parent_child');
            if (!c) return setChild(null);
            try {
                setChild(JSON.parse(c));
            } catch {
                /* ignore */
            }
        };
        readChild();
        // cập nhật ngay khi trang "Chọn con" đổi con (cùng tab hoặc tab khác)
        window.addEventListener('storage', readChild);
        window.addEventListener('parent-child-changed', readChild);
        return () => {
            window.removeEventListener('storage', readChild);
            window.removeEventListener('parent-child-changed', readChild);
        };
    }, [router]);

    useEffect(() => setOpen(false), [pathname]);

    /* nhớ trạng thái thu gọn + phím Esc */
    useEffect(() => {
        try { setMini(localStorage.getItem('ph-mini') === '1'); } catch { /* ignore */ }
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const toggleMini = () => {
        const next = !mini;
        setMini(next);
        try { localStorage.setItem('ph-mini', next ? '1' : '0'); } catch { /* ignore */ }
    };

    const handleLogout = () => {
        localStorage.clear();
        router.push('/login');
    };

    const yearLabel = '2025 – 2026';
    const activePath = useMemo(() => pathname || '', [pathname]);
    const isActive = (href: string) => activePath === href || activePath.startsWith(href + '/');

    const current = useMemo(
        () => ALL_ITEMS.find((it) => activePath === it.href || activePath.startsWith(it.href + '/')),
        [activePath],
    );
    const curGroup = current?.group;

    /* Vào trang thuộc nhóm đang gập → tự mở nhóm đó */
    useEffect(() => {
        if (!curGroup) return;
        setClosed((c) => (c[curGroup] ? { ...c, [curGroup]: false } : c));
    }, [curGroup]);

    /* Tìm nhanh chức năng trong menu */
    const q = normalize(query.trim());
    const groups = useMemo(() => {
        if (!q) return NAV_GROUPS;
        return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => normalize(i.label).includes(q)) })).filter((g) => g.items.length > 0);
    }, [q]);

    const isDash = !current || current.href === '/parent/dashboard';
    const title = isDash ? 'Cổng thông tin Phụ huynh' : current!.label;
    const desc = isDash ? 'Theo dõi học tập · chuyên cần · học phí của con' : `Cổng Phụ huynh · ${current!.group}`;
    const initial = (user?.name || 'P').charAt(0).toUpperCase();
    const childClass = child?.className || child?.class_name || child?.class;

    return (
        <div className={`ph-layout${mini ? ' mini' : ''}`}>
            {open && <div className="ph-overlay" onClick={() => setOpen(false)} />}

            {/* ============ SIDEBAR ============ */}
            <aside className={`ph-sidebar ${open ? 'open' : ''}`}>
                <button type="button" className="ph-close" onClick={() => setOpen(false)} aria-label="Đóng menu">
                    <Icon name="close" />
                </button>

                <div className="ph-brand">
                    {logoFail ? (
                        <div className="ph-logo ph-logo-fb">TH</div>
                    ) : (
                        <img
                            src="/images/logo-thpt-ngo-sy-lien.png"
                            alt="Logo trường"
                            className="ph-logo"
                            onError={() => setLogoFail(true)}
                        />
                    )}
                    <div className="ph-brand-text">
                        <strong>Cổng Phụ huynh</strong>
                        <small>Trường THPT</small>
                    </div>
                </div>

                <div className="ph-search">
                    <Icon name="search" />
                    <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Tìm chức năng…"
                        aria-label="Tìm chức năng"
                    />
                </div>

                <nav className="ph-nav" aria-label="Menu phụ huynh">
                    {groups.map((g) => {
                        const shut = !q && !!closed[g.title];
                        return (
                            <div key={g.title} className="ph-nav-group">
                                <button
                                    type="button"
                                    className="ph-nav-title"
                                    aria-expanded={!shut}
                                    onClick={() => setClosed((c) => ({ ...c, [g.title]: !c[g.title] }))}
                                >
                                    <span>{g.title}</span>
                                    <span className={`ph-chev${shut ? ' shut' : ''}`}><Icon name="chevd" /></span>
                                </button>

                                <div className={`ph-nav-items${shut ? ' shut' : ''}`}>
                                    {g.items.map((item) => {
                                        const active = isActive(item.href);
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                title={item.label}
                                                className={`ph-nav-item ${active ? 'active' : ''}`}
                                                aria-current={active ? 'page' : undefined}
                                                onClick={() => setOpen(false)}
                                            >
                                                <span className="ph-nav-icon"><Icon name={item.icon} /></span>
                                                <span className="ph-nav-label">{item.label}</span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                    {groups.length === 0 && <p className="ph-empty">Không tìm thấy chức năng phù hợp.</p>}
                </nav>

                <div className="ph-sidebar-foot">
                    <div className="ph-user">
                        <span className="ph-avatar">{initial}</span>
                        <div className="ph-user-t">
                            <b>{user?.name || 'Phụ huynh'}</b>
                            <small>{child?.name ? `Con: ${child.name}` : 'Chưa chọn con'}</small>
                        </div>
                    </div>
                    <button type="button" className="ph-logout" onClick={handleLogout} title="Đăng xuất">
                        <Icon name="logout" />
                        <span>Đăng xuất</span>
                    </button>
                </div>
            </aside>

            {/* ============ MAIN ============ */}
            <div className="ph-main">
                <header className="ph-header">
                    <button type="button" className="ph-burger" onClick={() => setOpen(true)} aria-label="Mở menu">
                        <Icon name="menu" />
                    </button>
                    <button
                        type="button"
                        className="ph-rail"
                        onClick={toggleMini}
                        aria-label={mini ? 'Mở rộng menu' : 'Thu gọn menu'}
                        title={mini ? 'Mở rộng menu' : 'Thu gọn menu'}
                    >
                        <Icon name="panel" />
                    </button>

                    <div className="ph-title">
                        <p>{desc}</p>
                        <h1>{title}</h1>
                    </div>

                    <div className="ph-header-right">
                        <Link href="/parent/children" className="ph-kid" title="Đổi / chọn con">
                            <span className="ph-kid-av">{(child?.name || 'C').charAt(0).toUpperCase()}</span>
                            <span className="ph-kid-t">{child?.name ? child.name : 'Chọn con'}</span>
                        </Link>
                        <Link href="/parent/notifications" className="ph-bell" aria-label="Thông báo" title="Thông báo">
                            <Icon name="notice" />
                        </Link>
                        <span className="ph-badge"><Icon name="cal" />Năm học {yearLabel}</span>
                        {childClass && <span className="ph-badge sky">Lớp {childClass}</span>}
                    </div>
                </header>
                <div className="ph-content">{children}</div>
            </div>
        </div>
    );
}