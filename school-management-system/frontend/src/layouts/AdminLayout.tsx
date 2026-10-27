'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { adm } from '../lib/adminApi';
import './admin-layout.css';
import './admin-ui.css';

interface Props {
    children: ReactNode;
}

const NAV_GROUPS = [
    {
        label: 'Tổng quan',
        items: [
            { href: '/admin/dashboard', label: 'Dashboard', icon: 'grid' },
        ],
    },
    {
        label: 'Người dùng & Bảo mật',
        items: [
            { href: '/admin/users', label: 'Quản lý tài khoản', icon: 'users' },
            { href: '/admin/roles', label: 'Vai trò & Phân quyền', icon: 'shield' },
        ],
    },
    {
        label: 'Tổ chức nhà trường',
        items: [
            { href: '/admin/school-year', label: 'Năm học - Học kỳ', icon: 'calendar' },
            { href: '/admin/classes', label: 'Lớp học', icon: 'layers' },
            { href: '/admin/subjects', label: 'Môn học', icon: 'book' },
            { href: '/admin/teachers', label: 'Giáo viên', icon: 'teacher' },
            { href: '/admin/students', label: 'Học sinh', icon: 'student' },
        ],
    },
    {
        label: 'Hoạt động dạy & học',
        items: [
            { href: '/admin/timetable', label: 'Thời khóa biểu', icon: 'clock' },
            { href: '/admin/exams', label: 'Lịch thi & Kiểm tra', icon: 'exam' },
            { href: '/admin/grades', label: 'Quản lý điểm', icon: 'score' },
            { href: '/admin/attendance', label: 'Điểm danh', icon: 'check' },
        ],
    },
    {
        label: 'Điều hành',
        items: [
            { href: '/admin/finance', label: 'Học phí & Tài chính', icon: 'money' },
            { href: '/admin/notifications', label: 'Thông báo', icon: 'bell' },
            { href: '/admin/reports', label: 'Báo cáo thống kê', icon: 'chart' },
        ],
    },
    {
        label: 'Hệ thống',
        items: [
            { href: '/admin/categories', label: 'Danh mục hệ thống', icon: 'folder' },
            { href: '/admin/settings', label: 'Cài đặt hệ thống', icon: 'sliders' },
            { href: '/admin/health', label: 'Giám sát hệ thống', icon: 'pulse' },
            { href: '/admin/checks', label: 'Kiểm tra dữ liệu', icon: 'shieldcheck' },
            { href: '/admin/data', label: 'Nhập / Xuất dữ liệu', icon: 'transfer' },
            { href: '/admin/logs', label: 'Nhật ký hệ thống', icon: 'log' },
            { href: '/admin/backup', label: 'Sao lưu & Phục hồi', icon: 'backup' },
        ],
    },
    {
        label: 'Tài khoản của tôi',
        items: [
            { href: '/admin/profile', label: 'Hồ sơ cá nhân', icon: 'profile' },
            { href: '/admin/password', label: 'Đổi mật khẩu', icon: 'lock' },
        ],
    },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items.map((it) => ({ ...it, group: g.label })));

function NavIcon({ name }: { name: string }) {
    const common = {
        width: 18,
        height: 18,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
    };
    switch (name) {
        case 'grid':
            return (
                <svg {...common}>
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
            );
        case 'users':
            return (
                <svg {...common}>
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
            );
        case 'shield':
            return (
                <svg {...common}>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
            );
        case 'calendar':
            return (
                <svg {...common}>
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
            );
        case 'layers':
            return (
                <svg {...common}>
                    <path d="M12 2 2 7l10 5 10-5-10-5z" />
                    <path d="m2 17 10 5 10-5" />
                    <path d="m2 12 10 5 10-5" />
                </svg>
            );
        case 'book':
            return (
                <svg {...common}>
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
            );
        case 'teacher':
            return (
                <svg {...common}>
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
            );
        case 'student':
            return (
                <svg {...common}>
                    <path d="m12 3 10 5-10 5L2 8l10-5z" />
                    <path d="M6 12.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-3.5" />
                </svg>
            );
        case 'clock':
            return (
                <svg {...common}>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                </svg>
            );
        case 'exam':
            return (
                <svg {...common}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6M9 15h6M9 11h6" />
                </svg>
            );
        case 'score':
            return (
                <svg {...common}>
                    <path d="M12 20V10" />
                    <path d="M18 20V4" />
                    <path d="M6 20v-4" />
                </svg>
            );
        case 'check':
            return (
                <svg {...common}>
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
            );
        case 'money':
            return (
                <svg {...common}>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v12M15 9.5c0-1.2-1.3-2-3-2s-3 .9-3 2 1.3 2 3 2 3 .9 3 2-1.3 2-3 2" />
                </svg>
            );
        case 'bell':
            return (
                <svg {...common}>
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                </svg>
            );
        case 'chart':
            return (
                <svg {...common}>
                    <path d="M3 3v18h18" />
                    <path d="M18 17V9" />
                    <path d="M13 17V5" />
                    <path d="M8 17v-3" />
                </svg>
            );
        case 'folder':
            return (
                <svg {...common}>
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
            );
        case 'log':
            return (
                <svg {...common}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                </svg>
            );
        case 'backup':
            return (
                <svg {...common}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
            );
        /* --- icon cho chức năng mới --- */
        case 'sliders':
            return (
                <svg {...common}>
                    <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
                </svg>
            );
        case 'pulse':
            return (
                <svg {...common}>
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
            );
        case 'shieldcheck':
            return (
                <svg {...common}>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="m9 12 2 2 4-4" />
                </svg>
            );
        case 'transfer':
            return (
                <svg {...common}>
                    <path d="M7 4v13M3 13l4 4 4-4M17 20V7M13 11l4-4 4 4" />
                </svg>
            );
        case 'profile':
            return (
                <svg {...common}>
                    <circle cx="12" cy="12" r="9" />
                    <circle cx="12" cy="10" r="3" />
                    <path d="M6.2 19a6 6 0 0 1 11.6 0" />
                </svg>
            );
        case 'lock':
            return (
                <svg {...common}>
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
            );
        case 'chevd':
            return (
                <svg {...common}>
                    <path d="M6 9l6 6 6-6" />
                </svg>
            );
        case 'panel':
            return (
                <svg {...common}>
                    <rect x="3" y="5" width="18" height="14" rx="1.5" />
                    <path d="M9 5v14" />
                </svg>
            );
        case 'menu':
            return (
                <svg {...common}>
                    <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
            );
        case 'close':
            return (
                <svg {...common}>
                    <path d="M6 6l12 12M18 6L6 18" />
                </svg>
            );
        case 'logout':
            return (
                <svg {...common}>
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <path d="M16 17l5-5-5-5M21 12H9" />
                </svg>
            );
        default:
            return (
                <svg {...common}>
                    <circle cx="12" cy="12" r="3" />
                </svg>
            );
    }
}

/* Dự phòng khi chưa có API /admin/context: tính theo ngày (từ tháng 8 là năm học mới) */
function fallbackYear(d = new Date()) {
    const start = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
    return `${start} – ${start + 1}`;
}
function fallbackSemester(d = new Date()) {
    const m = d.getMonth() + 1;
    if (m >= 8 && m <= 12) return 'Học kỳ 1';
    if (m >= 1 && m <= 5) return 'Học kỳ 2';
    return 'Nghỉ hè';
}

export default function AdminLayout({ children }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<{ name?: string } | null>(null);
    const [collapsed, setCollapsed] = useState(false);
    const [open, setOpen] = useState(false);
    const [closed, setClosed] = useState<Record<string, boolean>>({});
    const [logoFail, setLogoFail] = useState(false);
    const [ctx, setCtx] = useState<{ year?: string | null; semester?: string | null }>({});

    useEffect(() => {
        const stored = localStorage.getItem('user');
        if (stored) {
            try {
                setUser(JSON.parse(stored));
            } catch {
                router.push('/login/admin');
            }
        } else {
            router.push('/login/admin');
        }
    }, [router]);

    /* Năm học / học kỳ hiện hành lấy từ CSDL (nếu backend có /admin/context) */
    useEffect(() => {
        adm<{ year?: string | null; semester?: string | null }>('context')
            .then((r) => setCtx(r.data ?? {}))
            .catch(() => { /* dùng giá trị dự phòng */ });
    }, []);

    useEffect(() => setOpen(false), [pathname]);

    useEffect(() => {
        try { setCollapsed(localStorage.getItem('adm-collapsed') === '1'); } catch { /* ignore */ }
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const toggleCollapsed = () => {
        const next = !collapsed;
        setCollapsed(next);
        try { localStorage.setItem('adm-collapsed', next ? '1' : '0'); } catch { /* ignore */ }
    };

    const handleLogout = () => {
        localStorage.clear();
        router.push('/login/admin');
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

    const isDash = !current || current.href === '/admin/dashboard';
    const title = isDash ? 'Bảng điều khiển quản trị' : current!.label;
    const desc = isDash ? 'Điều hành toàn bộ hoạt động nhà trường' : `Quản trị hệ thống · ${current!.group}`;
    const year = ctx.year ? ctx.year.replace('-', ' – ') : fallbackYear();
    const semester = ctx.semester || fallbackSemester();
    const initial = (user?.name || 'A').charAt(0).toUpperCase();

    return (
        <div className={`adm ${collapsed ? 'adm--collapsed' : ''}`}>
            {open && <div className="adm-overlay" onClick={() => setOpen(false)} />}

            <aside className={`adm-sidebar ${open ? 'open' : ''}`}>
                <button type="button" className="adm-close" onClick={() => setOpen(false)} aria-label="Đóng menu">
                    <NavIcon name="close" />
                </button>

                <div className="adm-brand">
                    {logoFail ? (
                        <div className="adm-brand-mark adm-brand-fb">TH</div>
                    ) : (
                        <img
                            src="/images/logo-thpt-ngo-sy-lien.png"
                            alt="Logo trường"
                            className="adm-brand-mark"
                            onError={() => setLogoFail(true)}
                        />
                    )}
                    <div className="adm-brand-text">
                        <div className="adm-brand-title">Quản trị hệ thống</div>
                        <div className="adm-brand-sub">Trường THPT</div>
                    </div>
                </div>

                <nav className="adm-nav" aria-label="Menu quản trị">
                    {NAV_GROUPS.map((group) => {
                        const shut = !!closed[group.label];
                        return (
                            <div key={group.label} className="adm-nav-group">
                                <button
                                    type="button"
                                    className="adm-nav-label"
                                    aria-expanded={!shut}
                                    onClick={() => setClosed((c) => ({ ...c, [group.label]: !c[group.label] }))}
                                >
                                    <span>{group.label}</span>
                                    <span className={`adm-nav-chev${shut ? ' shut' : ''}`}><NavIcon name="chevd" /></span>
                                </button>

                                <div className={`adm-nav-items${shut ? ' shut' : ''}`}>
                                    {group.items.map((item) => (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={`adm-nav-item ${isActive(item.href) ? 'is-active' : ''}`}
                                            title={item.label}
                                            aria-current={isActive(item.href) ? 'page' : undefined}
                                        >
                                            <span className="adm-nav-icon">
                                                <NavIcon name={item.icon} />
                                            </span>
                                            <span className="adm-nav-text">{item.label}</span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </nav>

                <div className="adm-sidebar-foot">
                    <div className="adm-user-card">
                        <div className="adm-user-avatar">{initial}</div>
                        <div className="adm-user-meta">
                            <div className="adm-user-name">{user?.name || 'Quản trị viên'}</div>
                            <div className="adm-user-role">Super Admin</div>
                        </div>
                    </div>
                    <button type="button" onClick={handleLogout} className="adm-logout" title="Đăng xuất">
                        <NavIcon name="logout" />
                        <span>Đăng xuất</span>
                    </button>
                </div>
            </aside>

            <div className="adm-main">
                <header className="adm-topbar">
                    <button type="button" className="adm-burger" onClick={() => setOpen(true)} aria-label="Mở menu">
                        <NavIcon name="menu" />
                    </button>
                    <button
                        type="button"
                        className="adm-collapse-btn"
                        onClick={toggleCollapsed}
                        aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
                        title={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
                    >
                        <NavIcon name="panel" />
                    </button>

                    <div className="adm-topbar-left">
                        <p className="adm-page-desc">{desc}</p>
                        <h1 className="adm-page-title">{title}</h1>
                    </div>
                    <div className="adm-topbar-right">
                        <span className="adm-chip">Năm học {year}</span>
                        <span className="adm-chip adm-chip--sky">{semester}</span>
                        <span className="adm-chip adm-chip--soft">Super Admin</span>
                    </div>
                </header>

                <main className="adm-content">{children}</main>
            </div>
        </div>
    );
}