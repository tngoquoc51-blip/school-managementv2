'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import './teacher-layout.css';

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
    plan: (
        <>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </>
    ),
    exam: (
        <>
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
            <path d="M9 12h6M9 16h4" />
        </>
    ),
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
} as const;

type IconName = keyof typeof ICONS;

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ICONS[name]}
        </svg>
    );
}

/* ===== MENU GIÁO VIÊN BỘ MÔN (THPT) ===== */
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
        items: [{ href: '/teacher/dashboard', label: 'Dashboard', icon: 'dashboard' }],
    },
    {
        title: 'Giảng dạy',
        items: [
            { href: '/teacher/schedule', label: 'Thời khóa biểu', icon: 'schedule' },
            { href: '/teacher/attendance', label: 'Điểm danh', icon: 'attendance' },
            { href: '/teacher/lesson-log', label: 'Sổ đầu bài', icon: 'logbook' },
            { href: '/teacher/lesson-plan', label: 'Kế hoạch bài dạy', icon: 'plan' },
            { href: '/teacher/lesson-notes', label: 'Giáo án', icon: 'plan' },
        ],
    },
    {
        title: 'Đánh giá',
        items: [
            { href: '/teacher/grades', label: 'Nhập điểm', icon: 'grades' },
            { href: '/teacher/exams', label: 'Kiểm tra', icon: 'exam' },
            { href: '/teacher/comments', label: 'Nhận xét học sinh', icon: 'logbook' },
            { href: '/teacher/classes', label: 'Lớp được phân công', icon: 'class' },
        ],
    },
    {
        title: 'Chuyên môn',
        items: [
            { href: '/teacher/observations', label: 'Dự giờ', icon: 'exam' },
            { href: '/teacher/reports', label: 'Báo cáo chuyên môn', icon: 'grades' },
        ],
    },
    {
        title: 'Cá nhân',
        items: [
            { href: '/teacher/notifications', label: 'Thông báo', icon: 'notify' },
            { href: '/teacher/profile', label: 'Hồ sơ cá nhân', icon: 'profile' },
        ],
    },
];

const ALL_ITEMS = MENU.flatMap((g) => g.items.map((it) => ({ ...it, group: g.title })));

const ALLOWED_ROLES = ['teacher', 'homeroom_teacher', 'department_head', 'super_admin'];

/* Nhãn vai trò hiển thị (ưu tiên từ trên xuống) */
const ROLE_LABELS: [string, string][] = [
    ['super_admin', 'Quản trị hệ thống'],
    ['department_head', 'Tổ trưởng chuyên môn'],
    ['homeroom_teacher', 'Giáo viên chủ nhiệm'],
    ['teacher', 'Giáo viên bộ môn'],
];

interface StoredUser {
    name?: string;
}

const readStore = (key: string) => localStorage.getItem(key) ?? sessionStorage.getItem(key);

function schoolYear(d = new Date()) {
    const start = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
    return `${start} – ${start + 1}`;
}

interface Props {
    children: ReactNode;
}

export default function TeacherLayout({ children }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<StoredUser | null>(null);
    const [roles, setRoles] = useState<string[]>([]);
    const [open, setOpen] = useState(false);
    const [mini, setMini] = useState(false);
    const [closed, setClosed] = useState<Record<string, boolean>>({});
    const [logoFail, setLogoFail] = useState(false);
    const [search, setSearch] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);

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

    useEffect(() => setOpen(false), [pathname]);

    /* Nhớ trạng thái thu gọn menu + phím Esc */
    useEffect(() => {
        try { setMini(localStorage.getItem('tc-mini') === '1'); } catch { /* ignore */ }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { setOpen(false); setSearchOpen(false); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const toggleMini = () => {
        const next = !mini;
        setMini(next);
        try { localStorage.setItem('tc-mini', next ? '1' : '0'); } catch { /* ignore */ }
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

    /* Vào trang thuộc nhóm đang gập → tự mở nhóm đó */
    useEffect(() => {
        if (!curGroup) return;
        setClosed((c) => (c[curGroup] ? { ...c, [curGroup]: false } : c));
    }, [curGroup]);

    const roleLabel = useMemo(
        () => ROLE_LABELS.find(([r]) => roles.includes(r))?.[1] ?? 'Giáo viên',
        [roles],
    );

    if (!user) {
        return (
            <div className="tc-layout">
                <div className="tc-loading"><i className="tc-spin" />Đang kiểm tra phiên đăng nhập…</div>
            </div>
        );
    }

    const q = search.trim().toLowerCase();
    const results = q ? ALL_ITEMS.filter((it) => it.label.toLowerCase().includes(q)) : [];
    const goTo = (href?: string) => {
        const h = href ?? results[0]?.href;
        if (!h) return;
        router.push(h);
        setSearch('');
        setSearchOpen(false);
    };

    const name = user.name || 'Giáo viên';
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
                        <div className="tc-brand-sub">Cổng Giáo viên</div>
                    </div>
                </div>

                <nav className="tc-nav" aria-label="Menu giáo viên">
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
                    {/* Thẻ người dùng chỉ hiện trong menu trượt trên điện thoại */}
                    <div className="tc-me">
                        <span className="tc-av">{initial}</span>
                        <div className="tc-me-t"><b>{name}</b><small>{roleLabel}</small></div>
                    </div>
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
                        <span>Cổng Giáo viên</span>
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