'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import './student-layout.css';

interface Props {
    children: ReactNode;
}

const MENU = [
    { href: '/student/dashboard', label: 'Trang chủ', icon: '🏠' },
    {
        href: '/student/schedule',
        label: 'Thời khóa biểu',
        icon: '📅',
        children: [
            { href: '/student/schedule', label: 'Lịch học' },
            { href: '/student/schedule/exams', label: 'Lịch thi' },
        ],
    },
    {
        href: '/student/grades',
        label: 'Góc học tập',
        icon: '📊',
        children: [
            { href: '/student/grades', label: 'Bảng điểm' },
            { href: '/student/grades/summary', label: 'Tổng kết học kỳ' },
            { href: '/student/grades/subjects', label: 'Chi tiết môn học' },
        ],
    },
    { href: '/student/attendance', label: 'Chuyên cần', icon: '✅' },
    { href: '/student/homework', label: 'Bài tập', icon: '📚' },
    { href: '/student/notifications', label: 'Thông báo', icon: '🔔' },
    { href: '/student/profile', label: 'Thông tin cá nhân', icon: '👤' },
];

export default function StudentLayout({ children }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<any>(null);
    const [openMenu, setOpenMenu] = useState<string | null>(null);

    useEffect(() => {
        const stored = localStorage.getItem('user');
        if (stored) {
            setUser(JSON.parse(stored));
        } else {
            router.push('/login');
        }

        // Tự mở submenu nếu đang ở trang schedule
        if (pathname.startsWith('/student/schedule')) {
            setOpenMenu('/student/schedule');
        }
    }, [router, pathname]);

    const handleLogout = () => {
        localStorage.clear();
        router.push('/login');
    };

    const toggleMenu = (href: string) => {
        setOpenMenu((prev) => (prev === href ? null : href));
    };

    return (
        <div className="student-layout">
            <aside className="student-sidebar">
                <div className="sidebar-brand">
                    <div className="logo">TH</div>
                    <div>
                        <div className="brand-name">Cổng Học sinh</div>
                        <div className="brand-sub">Trường THPT</div>
                    </div>
                </div>

                <div className="sidebar-user">
                    <div className="avatar">{user?.name?.charAt(0) || 'H'}</div>
                    <div>
                        <div className="user-name">{user?.name || 'Học sinh'}</div>
                        <div className="user-class">Lớp 10A2</div>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {MENU.map((item) => {
                        const hasChildren = !!item.children;
                        const isOpen = openMenu === item.href;
                        const isActive =
                            pathname === item.href ||
                            (hasChildren && pathname.startsWith(item.href));

                        if (hasChildren) {
                            return (
                                <div key={item.href} className="nav-group">
                                    <button
                                        type="button"
                                        className={`nav-item nav-parent ${isActive ? 'active' : ''}`}
                                        onClick={() => toggleMenu(item.href)}
                                    >
                                        <span className="nav-icon">{item.icon}</span>
                                        <span className="nav-label">{item.label}</span>
                                        <span className={`nav-arrow ${isOpen ? 'open' : ''}`}>▾</span>
                                    </button>

                                    {isOpen && (
                                        <div className="nav-children">
                                            {item.children!.map((child) => (
                                                <Link
                                                    key={child.href}
                                                    href={child.href}
                                                    className={`nav-child ${pathname === child.href ? 'active' : ''}`}
                                                >
                                                    {child.label}
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`nav-item ${pathname === item.href ? 'active' : ''}`}
                            >
                                <span className="nav-icon">{item.icon}</span>
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="sidebar-footer">
                    <button onClick={handleLogout} className="btn-logout">
                        Đăng xuất
                    </button>
                </div>
            </aside>

            <div className="student-main">
                <header className="student-header">
                    <div className="header-left">
                        <h1>Cổng thông tin Học sinh</h1>
                        <p>Năm học 2025 – 2026 | Học kỳ 1</p>
                    </div>
                    <div className="header-right">
                        <div className="search-box">
                            <input type="text" placeholder="Tìm kiếm..." />
                        </div>
                        <div className="user-chip">
                            <span>{user?.name || 'Học sinh'}</span>
                        </div>
                    </div>
                </header>

                <main className="student-content">{children}</main>
            </div>
        </div>
    );
}