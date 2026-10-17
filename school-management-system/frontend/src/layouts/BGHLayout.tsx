'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import './bgh-layout.css';

interface Props {
    children: ReactNode;
}

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
            { href: '/bgh/approvals', label: 'Phê duyệt', icon: 'check', badge: 7 },
            { href: '/bgh/academic', label: 'Chuyên môn', icon: 'book', badge: 0 },
            { href: '/bgh/timetable', label: 'Thời khóa biểu', icon: 'clock', badge: 0 },
            { href: '/bgh/exams', label: 'Lịch thi & Kiểm tra', icon: 'exam', badge: 0 },
        ],
    },
    {
        label: 'Nhân sự & Học sinh',
        items: [
            { href: '/bgh/staff', label: 'Nhân sự', icon: 'users', badge: 0 },
            { href: '/bgh/students', label: 'Học sinh', icon: 'student', badge: 0 },
            { href: '/bgh/classes', label: 'Lớp học', icon: 'layers', badge: 0 },
            { href: '/bgh/attendance', label: 'Chuyên cần', icon: 'attendance', badge: 0 },
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
        default:
            return (
                <svg {...c}>
                    <circle cx="12" cy="12" r="3" />
                </svg>
            );
    }
}

export default function BGHLayout({ children }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<{ name?: string } | null>(null);
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('user');
        if (stored) {
            try {
                setUser(JSON.parse(stored));
            } catch {
                /* ignore */
            }
        }
    }, []);

    const handleLogout = () => {
        localStorage.clear();
        router.push('/login/bgh');
    };

    const isActive = (href: string) =>
        pathname === href || (pathname?.startsWith(href + '/') ?? false);

    return (
        <div className={`bgh ${collapsed ? 'bgh--collapsed' : ''}`}>
            <aside className="bgh-sidebar">
                <div className="bgh-brand">
                    <div className="bgh-brand-mark">TH</div>
                    {!collapsed && (
                        <div>
                            <div className="bgh-brand-title">Ban Giám hiệu</div>
                            <div className="bgh-brand-sub">Trường THPT</div>
                        </div>
                    )}
                    <button
                        type="button"
                        className="bgh-collapse-btn"
                        onClick={() => setCollapsed((v) => !v)}
                        aria-label="Thu gọn menu"
                    >
                        {collapsed ? '»' : '«'}
                    </button>
                </div>

                <nav className="bgh-nav">
                    {NAV_GROUPS.map((group) => (
                        <div key={group.label} className="bgh-nav-group">
                            {!collapsed && <div className="bgh-nav-label">{group.label}</div>}
                            {group.items.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`bgh-nav-item ${isActive(item.href) ? 'is-active' : ''}`}
                                    title={item.label}
                                >
                                    <span className="bgh-nav-icon">
                                        <NavIcon name={item.icon} />
                                    </span>
                                    {!collapsed && (
                                        <>
                                            <span className="bgh-nav-text">{item.label}</span>
                                            {item.badge > 0 && (
                                                <span className="bgh-nav-badge">{item.badge}</span>
                                            )}
                                        </>
                                    )}
                                </Link>
                            ))}
                        </div>
                    ))}
                </nav>

                <div className="bgh-sidebar-foot">
                    {!collapsed && (
                        <div className="bgh-user-card">
                            <div className="bgh-user-avatar">
                                {(user?.name || 'H').charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div className="bgh-user-name">{user?.name || 'Hiệu trưởng'}</div>
                                <div className="bgh-user-role">Ban Giám hiệu</div>
                            </div>
                        </div>
                    )}
                    <Link href="/" className="bgh-switch-role">
                        {collapsed ? '⇄' : 'Đổi vai trò'}
                    </Link>
                    <button type="button" onClick={handleLogout} className="bgh-logout">
                        {collapsed ? '⎋' : 'Đăng xuất'}
                    </button>
                </div>
            </aside>

            <div className="bgh-main">
                <header className="bgh-topbar">
                    <div>
                        <h1 className="bgh-page-title">Ban Giám hiệu</h1>
                        <p className="bgh-page-desc">Điều hành chuyên môn & phê duyệt toàn trường</p>
                    </div>
                    <div className="bgh-topbar-right">
                        <span className="bgh-chip">Năm học 2025 – 2026</span>
                        <span className="bgh-chip bgh-chip--sky">Học kỳ 1</span>
                        <span className="bgh-chip bgh-chip--soft">Hiệu trưởng</span>
                    </div>
                </header>
                <main className="bgh-content">{children}</main>
            </div>
        </div>
    );
}