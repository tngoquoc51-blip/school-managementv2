'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import './student-layout.css';

interface Props {
    children: ReactNode;
}

interface MenuItem {
    href: string;
    label: string;
    icon: string;
}

interface MenuSection {
    title: string;
    items: MenuItem[];
}

const MENU_SECTIONS: MenuSection[] = [
    {
        title: 'Tổng quan',
        items: [{ href: '/student/dashboard', label: 'Trang chủ', icon: '▣' }],
    },
    {
        title: 'Học tập',
        items: [
            { href: '/student/schedule', label: 'Lịch học', icon: '◷' },
            { href: '/student/schedule/exams', label: 'Lịch thi', icon: '▭' },
            { href: '/student/grades', label: 'Bảng điểm', icon: '▥' },
            { href: '/student/grades/summary', label: 'Tổng kết học kỳ', icon: '▤' },
            { href: '/student/grades/subjects', label: 'Chi tiết môn học', icon: '▦' },
            { href: '/student/attendance', label: 'Chuyên cần', icon: '☑' },
            { href: '/student/homework', label: 'Bài tập', icon: '☰' },
        ],
    },
    {
        title: 'Tài chính',
        items: [
            { href: '/student/fees', label: 'Hóa đơn học phí', icon: '◈' },
            { href: '/student/fees/history', label: 'Lịch sử giao dịch', icon: '⇄' },
            { href: '/student/fees/wallet', label: 'Ví học phí', icon: '◇' },
        ],
    },
    {
        title: 'Thông tin',
        items: [
            { href: '/student/notifications', label: 'Thông báo', icon: '◉' },
            { href: '/student/profile', label: 'Thông tin cá nhân', icon: '☺' },
            { href: '/student/change-password', label: 'Đổi mật khẩu', icon: '⊛' },
        ],
    },
];

export default function StudentLayout({ children }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const stored = localStorage.getItem('user');
        if (stored) {
            try {
                setUser(JSON.parse(stored));
            } catch {
                router.push('/login');
            }
        } else {
            router.push('/login');
        }
    }, [router]);

    const handleLogout = () => {
        localStorage.clear();
        sessionStorage.clear();
        router.push('/login');
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

                <nav className="sidebar-nav" aria-label="Menu học sinh">
                    {MENU_SECTIONS.map((section) => (
                        <div key={section.title} className="nav-section">
                            <div className="nav-section-title">{section.title}</div>
                            {section.items.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`nav-item ${pathname === item.href ? 'active' : ''}`}
                                >
                                    <span className="nav-icon">{item.icon}</span>
                                    <span className="nav-text">{item.label}</span>
                                </Link>
                            ))}
                        </div>
                    ))}
                </nav>

                {/* Khối user + đăng xuất – giống Admin */}
                <div className="sidebar-bottom">
                    <div className="sidebar-user-card">
                        <div className="avatar">{user?.name?.charAt(0) || 'H'}</div>
                        <div className="sidebar-user-meta">
                            <div className="user-name">{user?.name || 'Học sinh'}</div>
                            <div className="user-class">Lớp 10A2</div>
                        </div>
                    </div>
                    <button type="button" onClick={handleLogout} className="btn-logout">
                        Đăng xuất
                    </button>
                </div>
            </aside>

            <div className="student-main">
                <header className="student-header">
                    <div className="header-left">
                        <h1>Cổng thông tin Học sinh</h1>
                        <p>Điều hành học tập · xem điểm · học phí</p>
                    </div>
                    <div className="header-right">
                        <span className="chip">Năm học 2025 – 2026</span>
                        <span className="chip">Học kỳ 1</span>
                        <div className="user-chip">{user?.name || 'Học sinh'}</div>
                    </div>
                </header>
                <main className="student-content">{children}</main>
            </div>
        </div>
    );
}