'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import './teacher-layout.css';

interface Props {
    children: ReactNode;
}

const MENU = [
    { href: '/teacher/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/teacher/schedule', label: 'Thời khóa biểu', icon: '📅' },
    { href: '/teacher/attendance', label: 'Điểm danh', icon: '✅' },
    { href: '/teacher/lesson-log', label: 'Sổ đầu bài', icon: '📝' },
    { href: '/teacher/grades', label: 'Nhập điểm', icon: '🎯' },
    { href: '/teacher/lesson-plan', label: 'Kế hoạch bài dạy', icon: '📋' },
    { href: '/teacher/exams', label: 'Kiểm tra', icon: '📌' },
    { href: '/teacher/profile', label: 'Hồ sơ cá nhân', icon: '👤' },
];

export default function TeacherLayout({ children }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const stored = localStorage.getItem('user');
        if (stored) {
            setUser(JSON.parse(stored));
        } else {
            router.push('/login');
        }
    }, [router]);

    const handleLogout = () => {
        localStorage.clear();
        router.push('/login');
    };

    return (
        <div className="teacher-layout">
            {/* Sidebar */}
            <aside className="teacher-sidebar">
                <div className="sidebar-header">
                    <div className="logo">TH</div>
                    <div>
                        <div className="sidebar-title">Giáo viên bộ môn</div>
                        <div className="sidebar-user">{user?.name || 'Giáo viên'}</div>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {MENU.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`nav-item ${pathname === item.href ? 'active' : ''}`}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <button onClick={handleLogout} className="btn-logout">
                        Đăng xuất
                    </button>
                </div>
            </aside>

            {/* Main */}
            <div className="teacher-main">
                <header className="teacher-header">
                    <div>
                        <h1>Hệ thống Quản lý Trường THPT</h1>
                        <p className="header-sub">Năm học 2025 – 2026 | Học kỳ 1</p>
                    </div>
                    <div className="header-right">
                        <span className="badge">Giáo viên bộ môn</span>
                    </div>
                </header>

                <main className="teacher-content">{children}</main>
            </div>
        </div>
    );
}