'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import './homeroom-layout.css';

/* ===== ICON SVG – nét mảnh, một màu (theo màu chữ), không tô màu nổi ===== */
const ICONS = {
    dashboard: (
        <>
            <rect x="3" y="3" width="7" height="9" rx="1" />
            <rect x="14" y="3" width="7" height="5" rx="1" />
            <rect x="14" y="12" width="7" height="9" rx="1" />
            <rect x="3" y="16" width="7" height="5" rx="1" />
        </>
    ),
    schedule: (
        <>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
        </>
    ),
    attendance: (
        <>
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </>
    ),
    logbook: (
        <>
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </>
    ),
    grades: <path d="M12 20V10M18 20V4M6 20v-4" />,
    class: (
        <>
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </>
    ),
    notify: (
        <>
            <path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7" />
            <path d="M10 20a2 2 0 0 0 4 0" />
        </>
    ),
    profile: (
        <>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
        </>
    ),
    logout: (
        <>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5M21 12H9" />
        </>
    ),
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    close: <path d="M6 6l12 12M18 6L6 18" />,
    search: (
        <>
            <circle cx="11" cy="11" r="6" />
            <path d="M21 21l-4.3-4.3" />
        </>
    ),
    chev: <path d="M9 18l6-6-6-6" />,
    chevd: <path d="M6 9l6 6 6-6" />,
    panel: (
        <>
            <rect x="3" y="5" width="18" height="14" rx="1.5" />
            <path d="M9 5v14" />
        </>
    ),
    cal: (
        <>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
        </>
    ),
    /* ---- Icon riêng cho Giáo viên chủ nhiệm ---- */
    leave: (
        <>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M9 15l2 2 4-4" />
        </>
    ),
    contact: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
    meeting: (
        <>
            <circle cx="9" cy="7" r="4" />
            <path d="M1 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2" />
            <circle cx="19" cy="8" r="3" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        </>
    ),
    report: (
        <>
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            <path d="M9 17v-4M12 17v-7M15 17v-2" />
        </>
    ),
    award: (
        <>
            <circle cx="12" cy="8" r="6" />
            <path d="M9 13.5L7 22l5-3 5 3-2-8.5" />
        </>
    ),
} as const;

type IconName = keyof typeof ICONS;

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ICONS[name]}
        </svg>
    );
}

/* ===== MENU GIÁO VIÊN CHỦ NHIỆM (THPT) ===== */
interface MenuItem {
    href: string;
    label: string;
    icon: IconName;
}

interface MenuGroup {
    title: string;
    items: MenuItem[];
}

const MENU: MenuGroup[] = [
    {
        title: 'Tổng quan',
        items: [{ href: '/homeroom/dashboard', label: 'Dashboard', icon: 'dashboard' }],
    },
    {
        title: 'Lớp chủ nhiệm',
        items: [
            { href: '/homeroom/students', label: 'Danh sách học sinh', icon: 'class' },
            { href: '/homeroom/attendance', label: 'Điểm danh lớp', icon: 'attendance' },
            { href: '/homeroom/conduct', label: 'Nhận xét & Hạnh kiểm', icon: 'logbook' },
            { href: '/homeroom/progress', label: 'Theo dõi học lực', icon: 'grades' },
            { href: '/homeroom/seating', label: 'Sĩ số & sơ đồ lớp', icon: 'panel' },
        ],
    },
    {
        title: 'Phụ huynh & Nghỉ học',
        items: [
            { href: '/homeroom/leaves', label: 'Duyệt đơn xin nghỉ', icon: 'leave' },
            { href: '/homeroom/contact', label: 'Liên hệ phụ huynh', icon: 'contact' },
            { href: '/homeroom/meetings', label: 'Họp phụ huynh', icon: 'meeting' },
        ],
    },
    {
        title: 'Giảng dạy',
        items: [
            { href: '/homeroom/schedule', label: 'Thời khóa biểu', icon: 'schedule' },
            { href: '/homeroom/lesson-log', label: 'Sổ đầu bài', icon: 'logbook' },
            { href: '/homeroom/grades', label: 'Nhập điểm bộ môn', icon: 'grades' },
        ],
    },
    {
        title: 'Báo cáo & Thi đua',
        items: [
            { href: '/homeroom/reports', label: 'Báo cáo lớp chủ nhiệm', icon: 'report' },
            { href: '/homeroom/awards', label: 'Xét thi đua - khen thưởng', icon: 'award' },
        ],
    },
    {
        title: 'Cá nhân',
        items: [
            { href: '/homeroom/notifications', label: 'Thông báo', icon: 'notify' },
            { href: '/homeroom/profile', label: 'Hồ sơ cá nhân', icon: 'profile' },
        ],
    },
];

const ALL_ITEMS = MENU.flatMap((g) => g.items.map((it) => ({ ...it, group: g.title })));

/* Vào được cổng GVCN: trước hết phải là một phiên giáo viên hợp lệ */
const ALLOWED_ROLES = ['teacher', 'homeroom_teacher', 'department_head', 'super_admin'];

const ROLE_LABELS: [string, string][] = [
    ['super_admin', 'Quản trị hệ thống'],
    ['department_head', 'Tổ trưởng chuyên môn'],
    ['homeroom_teacher', 'Giáo viên chủ nhiệm'],
    ['teacher', 'Giáo viên chủ nhiệm'],
];

interface StoredUser {
    name?: string;
}

const readStore = (key: string) => localStorage.getItem(key) ?? sessionStorage.getItem(key);
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

function schoolYear(d = new Date()) {
    const start = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
    return `${start} – ${start + 1}`;
}

interface Props {
    children: ReactNode;
}

export default function HomeroomLayout({ children }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<StoredUser | null>(null);
    const [roles, setRoles] = useState<string[]>([]);
    const [allowed, setAllowed] = useState<boolean | null>(null);
    const [open, setOpen] = useState(false);
    const [mini, setMini] = useState(false);
    const [closed, setClosed] = useState<Record<string, boolean>>({});
    const [logoFail, setLogoFail] = useState(false);
    const [search, setSearch] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);

    /* Bước 1: phải có phiên giáo viên hợp lệ (dùng chung đăng nhập với /teacher/*) */
    useEffect(() => {
        try {
            const rawUser = readStore('user');
            const storedRoles: string[] = JSON.parse(readStore('roles') || '[]');
            if (rawUser && storedRoles.some((r) => ALLOWED_ROLES.includes(r))) {
                setUser(JSON.parse(rawUser));
                setRoles(storedRoles);
                return;
            }
        } catch {
            /* ignore */
        }
        router.replace('/login/teacher');
    }, [router]);

    /* Bước 2: chỉ giáo viên ĐANG chủ nhiệm một lớp mới được vào cổng này.
       Giáo viên bộ môn thường (không chủ nhiệm lớp nào) sẽ tự động quay về /teacher/dashboard. */
    useEffect(() => {
        if (!user) return;
        const token = readStore('token');
        fetch(`${API}/gv/teacher/homeroom`, { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => {
                if (r.ok) { setAllowed(true); return; }
                setAllowed(false);
                router.replace('/teacher/dashboard');
            })
            .catch(() => { setAllowed(false); router.replace('/teacher/dashboard'); });
    }, [user, router]);

    useEffect(() => setOpen(false), [pathname]);

    /* Nhớ trạng thái thu gọn menu + phím Esc */
    useEffect(() => {
        try { setMini(localStorage.getItem('hr-mini') === '1'); } catch { /* ignore */ }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { setOpen(false); setSearchOpen(false); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const toggleMini = () => {
        const next = !mini;
        setMini(next);
        try { localStorage.setItem('hr-mini', next ? '1' : '0'); } catch { /* ignore */ }
    };

    const handleLogout = () => {
        ['token', 'user', 'roles', 'current_role'].forEach((k) => {
            localStorage.removeItem(k);
            sessionStorage.removeItem(k);
        });
        router.push('/login/teacher');
    };

    const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

    const current = useMemo(
        () => ALL_ITEMS.find((i) => pathname === i.href || pathname.startsWith(i.href + '/')),
        [pathname],
    );
    const curGroup = current?.group;

    useEffect(() => {
        if (!curGroup) return;
        setClosed((c) => (c[curGroup] ? { ...c, [curGroup]: false } : c));
    }, [curGroup]);

    const roleLabel = useMemo(
        () => ROLE_LABELS.find(([r]) => roles.includes(r))?.[1] ?? 'Giáo viên chủ nhiệm',
        [roles],
    );

    if (!user || allowed === null) {
        return (
            <div className="tc-layout">
                <div className="tc-loading"><i className="tc-spin" />Đang kiểm tra phiên đăng nhập…</div>
            </div>
        );
    }

    if (!allowed) return null; // đang chuyển hướng về /teacher/dashboard

    const q = search.trim().toLowerCase();
    const results = q ? ALL_ITEMS.filter((it) => it.label.toLowerCase().includes(q)) : [];
    const goTo = (href?: string) => {
        const h = href ?? results[0]?.href;
        if (!h) return;
        router.push(h);
        setSearch('');
        setSearchOpen(false);
    };

    const name = user.name || 'Giáo viên chủ nhiệm';
    const initial = name.trim().split(' ').slice(-1)[0]?.[0]?.toUpperCase() ?? 'G';

    return (
        <div className={`tc-layout${mini ? ' mini' : ''}`}>
            {open && <div className="tc-overlay" onClick={() => setOpen(false)} />}

            {/* ============ SIDEBAR ============ */}
            <aside className={`tc-sidebar ${open ? 'open' : ''}`}>
                <button type="button" className="tc-close" onClick={() => setOpen(false)} aria-label="Đóng menu">
                    <Icon name="close" size={20} />
                </button>

                <div className="tc-brand">
                    {logoFail ? (
                        <div className="tc-logo tc-logo-fb">TH</div>
                    ) : (
                        <img
                            src="/images/logo-thpt-ngo-sy-lien.png"
                            alt="Logo THPT Ngô Sỹ Liên"
                            className="tc-logo"
                            onError={() => setLogoFail(true)}
                        />
                    )}
                    <div className="tc-brand-text">
                        <div className="tc-brand-name">THPT Ngô Sỹ Liên</div>
                        <div className="tc-brand-sub">Cổng Giáo viên chủ nhiệm</div>
                    </div>
                </div>

                <nav className="tc-nav" aria-label="Menu giáo viên chủ nhiệm">
                    {MENU.map((group) => {
                        const shut = !!closed[group.title];
                        return (
                            <div className="tc-group" key={group.title}>
                                <button
                                    type="button"
                                    className="tc-group-title"
                                    aria-expanded={!shut}
                                    onClick={() => setClosed((c) => ({ ...c, [group.title]: !c[group.title] }))}
                                >
                                    <span>{group.title}</span>
                                    <span className={`tc-chev${shut ? ' shut' : ''}`}><Icon name="chevd" size={14} /></span>
                                </button>

                                <div className={`tc-group-items${shut ? ' shut' : ''}`}>
                                    {group.items.map((item) => {
                                        const on = isActive(item.href);
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                title={item.label}
                                                className={`tc-nav-item ${on ? 'active' : ''}`}
                                                aria-current={on ? 'page' : undefined}
                                            >
                                                <span className="tc-nav-icon"><Icon name={item.icon} /></span>
                                                <span className="tc-nav-label">{item.label}</span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </nav>

                <div className="tc-footer">
                    <div className="tc-me">
                        <span className="tc-av">{initial}</span>
                        <div className="tc-me-t"><b>{name}</b><small>{roleLabel}</small></div>
                    </div>
                    <Link href="/teacher/dashboard" className="tc-nav-item" style={{ marginBottom: 8 }}>
                        <span className="tc-nav-icon"><Icon name="class" /></span>
                        <span className="tc-nav-label">Sang Cổng Giảng dạy</span>
                    </Link>
                    <button type="button" onClick={handleLogout} className="tc-btn-logout" title="Đăng xuất">
                        <Icon name="logout" size={16} />
                        <span>Đăng xuất</span>
                    </button>
                </div>
            </aside>

            {/* ============ MAIN ============ */}
            <div className="tc-main">
                <header className="tc-header">
                    <button type="button" className="tc-burger" onClick={() => setOpen(true)} aria-label="Mở menu">
                        <Icon name="menu" size={22} />
                    </button>
                    <button
                        type="button"
                        className="tc-rail"
                        onClick={toggleMini}
                        aria-label={mini ? 'Mở rộng menu' : 'Thu gọn menu'}
                        title={mini ? 'Mở rộng menu' : 'Thu gọn menu'}
                    >
                        <Icon name="panel" size={19} />
                    </button>

                    <nav className="tc-crumb" aria-label="Đường dẫn">
                        <span>Cổng GVCN</span>
                        <span className="tc-sep"><Icon name="chev" size={14} /></span>
                        {current ? (
                            <>
                                <span className="tc-crumb-g">{current.group}</span>
                                <span className="tc-sep tc-sep-g"><Icon name="chev" size={14} /></span>
                                <b className="tc-here">{current.label}</b>
                            </>
                        ) : (
                            <b className="tc-here">Dashboard</b>
                        )}
                    </nav>

                    <div className="tc-search-wrap">
                        <form className="tc-search" onSubmit={(e) => { e.preventDefault(); goTo(); }}>
                            <span className="tc-search-lead"><Icon name="search" size={17} /></span>
                            <input
                                type="search"
                                placeholder="Tìm chức năng…"
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }}
                                onFocus={() => setSearchOpen(true)}
                                onBlur={() => setTimeout(() => setSearchOpen(false), 180)}
                                autoComplete="off"
                            />
                            <button type="submit" aria-label="Tìm"><Icon name="search" size={16} /></button>
                        </form>

                        {searchOpen && q && (
                            <div className="tc-search-dd">
                                {results.length === 0 ? (
                                    <div className="tc-search-empty">Không tìm thấy chức năng phù hợp</div>
                                ) : (
                                    results.map((it) => (
                                        <button
                                            key={it.href}
                                            type="button"
                                            className="tc-search-item"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => goTo(it.href)}
                                        >
                                            <span className="tc-search-ico"><Icon name={it.icon} size={16} /></span>
                                            <span>{it.label}</span>
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    <span className="tc-chip"><Icon name="cal" size={15} />Năm học <b>{schoolYear()}</b></span>

                    <div className="tc-user">
                        <span className="tc-user-av">{initial}</span>
                        <div className="tc-user-t">
                            <b>{name}</b>
                            <small>{roleLabel}</small>
                        </div>
                    </div>
                </header>

                <main className="tc-content">{children}</main>
            </div>
        </div>
    );
}