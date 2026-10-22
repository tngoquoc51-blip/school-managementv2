'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import './student-layout.css';
import SchoolLogo from '@/components/SchoolLogo';

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

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

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
    const [displayName, setDisplayName] = useState('Học sinh');
    const [className, setClassName] = useState('');
    const [yearLabel, setYearLabel] = useState('');
    const [search, setSearch] = useState('');

    const [searchOpen, setSearchOpen] = useState(false);

    const allMenuItems = MENU_SECTIONS.flatMap((s) => s.items);

    const searchResults = search.trim()
        ? allMenuItems.filter((item) =>
            item.label.toLowerCase().includes(search.trim().toLowerCase())
        )
        : [];

    const goSearch = (href?: string) => {
        if (href) {
            router.push(href);
            setSearch('');
            setSearchOpen(false);
            return;
        }
        if (searchResults.length === 1) {
            router.push(searchResults[0].href);
            setSearch('');
            setSearchOpen(false);
            return;
        }
        if (search.trim()) {
            router.push(`/student/notifications?q=${encodeURIComponent(search.trim())}`);
            setSearchOpen(false);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('hs_token') ?? localStorage.getItem('token');
        const stored = localStorage.getItem('user');

        if (!token || !stored) {
            router.push('/login/student');
            return;
        }

        try {
            const u = JSON.parse(stored);
            if (u?.name || u?.full_name) setDisplayName(u.full_name || u.name);
            if (u?.class_name) setClassName(u.class_name);
            if (u?.school_year) setYearLabel(u.school_year);
        } catch {
            router.push('/login/student');
            return;
        }

        fetch(`${API}/hs/me`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
            },
        })
            .then((r) => r.json())
            .then((j) => {
                const d = j?.data;
                if (d) {
                    if (d.name) setDisplayName(d.name);
                    if (d.class?.name) setClassName(d.class.name);
                    if (d.year?.label) setYearLabel(d.year.label);
                }
            })
            .catch(() => {});
    }, [router]);

    const handleLogout = () => {
        localStorage.clear();
        sessionStorage.clear();
        router.push('/login/student');
    };

    const onSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const q = search.trim();
        if (!q) return;
        router.push(`/student/notifications?q=${encodeURIComponent(q)}`);
    };

    return (
        <div className="student-layout">
            {/* ===== CỘT TRÁI ===== */}
            <aside className="student-sidebar">
                <div className="sidebar-brand sidebar-brand--stack">
                    <img
                        src="/images/logo-thpt-ngo-sy-lien.png"
                        alt="Logo THPT Ngô Sỹ Liên"
                        className="sidebar-logo-img"
                    />
                    <div className="brand-text-stack">
                        <div className="brand-name">THPT Ngô Sỹ Liên</div>
                        <div className="brand-sub">Cổng Học sinh</div>
                    </div>
                </div>

                <nav className="sidebar-nav">
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

                <div className="sidebar-bottom">
                    <div className="sidebar-user-card">
                        <div className="avatar">{displayName.charAt(0).toUpperCase()}</div>
                        <div className="sidebar-user-meta">
                            <div className="user-name">{displayName}</div>
                            <div className="user-class">{className ? `Lớp ${className}` : '—'}</div>
                        </div>
                    </div>
                    <button type="button" onClick={handleLogout} className="btn-logout">
                        Đăng xuất
                    </button>
                </div>
            </aside>

            {/* ===== CỘT PHẢI ===== */}
            <div className="student-main">
                <header className="student-topbar">
                    <div className="topbar-left">
                        <span className="topbar-title">Cổng thông tin Học sinh</span>
                        {yearLabel ? (
                            <span className="topbar-year">Năm học {yearLabel.replace('-', ' – ')}</span>
                        ) : (
                            <span className="topbar-year">Năm học 2025 – 2026</span>
                        )}
                    </div>

                    <div className="topbar-search-wrap">
                        <form
                            className="topbar-search"
                            onSubmit={(e) => {
                                e.preventDefault();
                                goSearch();
                            }}
                        >
                            <input
                                type="search"
                                placeholder="Tìm kiếm thông tin..."
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setSearchOpen(true);
                                }}
                                onFocus={() => setSearchOpen(true)}
                                onBlur={() => setTimeout(() => setSearchOpen(false), 180)}
                                autoComplete="off"
                            />
                            <button type="submit" aria-label="Tìm">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                                    <circle cx="11" cy="11" r="7" />
                                    <path d="M20 20l-3.5-3.5" />
                                </svg>
                            </button>
                        </form>

                        {searchOpen && search.trim() && (
                            <div className="topbar-search-dropdown">
                                {searchResults.length === 0 ? (
                                    <div className="topbar-search-empty">
                                        Không khớp menu — Enter để tìm trong Thông báo
                                    </div>
                                ) : (
                                    searchResults.map((item) => (
                                        <button
                                            key={item.href}
                                            type="button"
                                            className="topbar-search-item"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => goSearch(item.href)}
                                        >
                                            <span className="topbar-search-ico">{item.icon}</span>
                                            <span>{item.label}</span>
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    <div className="topbar-user">
                        <div className="topbar-avatar">{displayName.charAt(0).toUpperCase()}</div>
                        <div className="topbar-user-text">
                            <span className="topbar-user-name">{displayName}</span>
                            {className && <span className="topbar-user-class">Lớp {className}</span>}
                        </div>
                    </div>
                </header>

                <main className="student-content">{children}</main>
            </div>
        </div>
    );
}