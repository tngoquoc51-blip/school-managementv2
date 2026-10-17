'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import './teacher-layout.css';

/* ===== ICON SVG ===== */
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
    grades: (
        <>
            <path d="M12 20V10M18 20V4M6 20v-4" />
        </>
    ),
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
} as const;

type IconName = keyof typeof ICONS;

function Icon({ name }: { name: IconName }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
const ALLOWED_ROLES = ['teacher', 'homeroom_teacher', 'department_head', 'super_admin'];

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
    const [open, setOpen] = useState(false);

    useEffect(() => {
        try {
            const rawUser = readStore('user');
            const roles: string[] = JSON.parse(readStore('roles') || '[]');
            if (rawUser && roles.some((r) => ALLOWED_ROLES.includes(r))) {
                setUser(JSON.parse(rawUser));
                return;
            }
        } catch {
            /* ignore */
        }
        router.replace('/login/teacher');
    }, [router]);

    useEffect(() => setOpen(false), [pathname]);

    const handleLogout = () => {
        ['token', 'user', 'roles', 'current_role'].forEach((k) => {
            localStorage.removeItem(k);
            sessionStorage.removeItem(k);
        });
        router.push('/login/teacher');
    };

    const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

    const current = useMemo(() => {
        for (const g of MENU) {
            const item = g.items.find((i) => isActive(i.href));
            if (item) return item.label;
        }
        return 'Dashboard';
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

    if (!user) return null;

    return (
        <div className="tc-layout">
            {open && <div className="tc-overlay" onClick={() => setOpen(false)} />}

            <aside className={`tc-sidebar ${open ? 'open' : ''}`}>
                <div className="tc-brand">
                    <div className="tc-logo">TH</div>
                    <div>
                        <div className="tc-brand-name">Giáo viên bộ môn</div>
                        <div className="tc-brand-sub">{user.name || 'Giáo viên'}</div>
                    </div>
                    <button type="button" className="tc-close" onClick={() => setOpen(false)} aria-label="Đóng menu">
                        <Icon name="close" />
                    </button>
                </div>

                <nav className="tc-nav" aria-label="Menu giáo viên">
                    {MENU.map((group) => (
                        <div className="tc-group" key={group.title}>
                            <div className="tc-group-title">{group.title}</div>
                            {group.items.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`tc-nav-item ${isActive(item.href) ? 'active' : ''}`}
                                    aria-current={isActive(item.href) ? 'page' : undefined}
                                >
                                    <span className="tc-nav-icon">
                                        <Icon name={item.icon} />
                                    </span>
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                    ))}
                </nav>

                <div className="tc-footer">
                    <button type="button" onClick={handleLogout} className="tc-btn-logout">
                        <Icon name="logout" />
                        Đăng xuất
                    </button>
                </div>
            </aside>

            <div className="tc-main">
                <header className="tc-header">
                    <button type="button" className="tc-burger" onClick={() => setOpen(true)} aria-label="Mở menu">
                        <Icon name="menu" />
                    </button>
                    <div className="tc-title">
                        <p>Hệ thống Quản lý Trường THPT · Giáo viên</p>
                        <h1>{current}</h1>
                    </div>
                    <div className="tc-header-right">
                        <span className="tc-year">Năm học {schoolYear()}</span>
                        <span className="tc-badge">Giáo viên bộ môn</span>
                    </div>
                </header>

                <main className="tc-content">{children}</main>
            </div>
        </div>
    );
}