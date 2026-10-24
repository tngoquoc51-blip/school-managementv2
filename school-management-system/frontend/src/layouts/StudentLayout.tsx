'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ReactNode, useEffect, useMemo, useState } from 'react';
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

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

/* Icon SVG */
const ICONS: Record<string, string> = {
    home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
    clock: 'M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    exam: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M8 13h8M8 17h5',
    grades: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
    summary: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
    subjects: 'M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 006.5 22H20V2H6.5A2.5 2.5 0 004 4.5z',
    check: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2zM9 15l2 2 4-4',
    book: 'M4 6h16M4 12h16M4 18h10',
    invoice: 'M4 3h16v18l-3-2-3 2-3-2-3 2-4-2zM8 8h8M8 12h8',
    history: 'M7 4l-4 4 4 4M3 8h14a4 4 0 010 8h-3M17 20l4-4-4-4',
    wallet: 'M3 7a2 2 0 012-2h13v4M3 7v10a2 2 0 002 2h15a1 1 0 001-1v-8a1 1 0 00-1-1H5a2 2 0 01-2-2zM17 14h.01',
    bell: 'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0',
    user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8',
    lock: 'M5 11h14v10H5zM8 11V7a4 4 0 018 0v4',
    search: 'M21 21l-4.3-4.3M17 11a6 6 0 11-12 0 6 6 0 0112 0z',
    out: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
    menu: 'M3 6h18M3 12h18M3 18h18',
    close: 'M18 6L6 18M6 6l12 12',
    chev: 'M9 18l6-6-6-6',
    chevd: 'M6 9l6 6 6-6',
    panel: 'M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2zM9 4v16',
};

const Ic = ({ n, s = 18 }: { n: string; s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={ICONS[n]} />
    </svg>
);

const MENU_SECTIONS: MenuSection[] = [
    {
        title: 'Tổng quan',
        items: [{ href: '/student/dashboard', label: 'Trang chủ', icon: 'home' }],
    },
    {
        title: 'Học tập',
        items: [
            { href: '/student/schedule', label: 'Lịch học', icon: 'clock' },
            { href: '/student/schedule/exams', label: 'Lịch thi', icon: 'exam' },
            { href: '/student/grades', label: 'Bảng điểm', icon: 'grades' },
            { href: '/student/grades/summary', label: 'Tổng kết học kỳ', icon: 'summary' },
            { href: '/student/grades/subjects', label: 'Chi tiết môn học', icon: 'subjects' },
            { href: '/student/attendance', label: 'Chuyên cần', icon: 'check' },
            { href: '/student/homework', label: 'Bài tập', icon: 'book' },
        ],
    },
    {
        title: 'Tài chính',
        items: [
            { href: '/student/fees', label: 'Hóa đơn học phí', icon: 'invoice' },
            { href: '/student/fees/history', label: 'Lịch sử giao dịch', icon: 'history' },
            { href: '/student/fees/wallet', label: 'Ví học phí', icon: 'wallet' },
        ],
    },
    {
        title: 'Thông tin',
        items: [
            { href: '/student/notifications', label: 'Thông báo', icon: 'bell' },
            { href: '/student/profile', label: 'Thông tin cá nhân', icon: 'user' },
            { href: '/student/change-password', label: 'Đổi mật khẩu', icon: 'lock' },
        ],
    },
];

const ALL_ITEMS = MENU_SECTIONS.flatMap((s) => s.items);

export default function StudentLayout({ children }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const [displayName, setDisplayName] = useState('Học sinh');
    const [className, setClassName] = useState('');
    const [yearLabel, setYearLabel] = useState('');
    const [search, setSearch] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [open, setOpen] = useState(false);
    const [mini, setMini] = useState(false);
    const [closed, setClosed] = useState<Record<string, boolean>>({});
    const [logoFail, setLogoFail] = useState(false);

    const searchResults = search.trim()
        ? ALL_ITEMS.filter((item) => item.label.toLowerCase().includes(search.trim().toLowerCase()))
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

    useEffect(() => setOpen(false), [pathname]);

    /* Nhớ trạng thái thu gọn menu + phím Esc */
    useEffect(() => {
        try { setMini(localStorage.getItem('hs_side_mini') === '1'); } catch {}
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { setOpen(false); setSearchOpen(false); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const toggleMini = () => {
        const next = !mini;
        setMini(next);
        try { localStorage.setItem('hs_side_mini', next ? '1' : '0'); } catch {}
    };

    const handleLogout = () => {
        localStorage.clear();
        sessionStorage.clear();
        router.push('/login/student');
    };

    /* Mục đang chọn: khớp chính xác, hoặc là mục con gần nhất */
    const activeHref = useMemo(() => {
        const exact = ALL_ITEMS.find((i) => i.href === pathname);
        if (exact) return exact.href;
        const parents = ALL_ITEMS.filter((i) => pathname.startsWith(i.href + '/')).sort((a, b) => b.href.length - a.href.length);
        return parents[0]?.href ?? '';
    }, [pathname]);

    const current = ALL_ITEMS.find((i) => i.href === activeHref);
    const currentSection = useMemo(
        () => MENU_SECTIONS.find((s) => s.items.some((i) => i.href === activeHref)),
        [activeHref],
    );

    /* Vào trang thuộc nhóm đang gập → tự mở nhóm đó */
    useEffect(() => {
        if (!currentSection) return;
        setClosed((c) => (c[currentSection.title] ? { ...c, [currentSection.title]: false } : c));
    }, [currentSection]);

    const initial = displayName.charAt(0).toUpperCase();

    return (
        <div className={`student-layout${mini ? ' mini' : ''}`}>
            {/* ===== SIDEBAR ===== */}
            <aside className={`student-sidebar ${open ? 'open' : ''}`}>
                <button type="button" className="sidebar-close" onClick={() => setOpen(false)} aria-label="Đóng menu">
                    <Ic n="close" />
                </button>

                <div className="sidebar-brand">
                    {logoFail ? (
                        <span className="sidebar-logo-img sidebar-logo-fallback">NSL</span>
                    ) : (
                        <img
                            src="/images/logo-thpt-ngo-sy-lien.png"
                            alt="Logo THPT Ngô Sỹ Liên"
                            className="sidebar-logo-img"
                            onError={() => setLogoFail(true)}
                        />
                    )}
                    <div className="brand-text-stack">
                        <div className="brand-name">THPT Ngô Sỹ Liên</div>
                        <div className="brand-sub">Cổng Học sinh</div>
                    </div>
                </div>

                <nav className="sidebar-nav" aria-label="Menu chính">
                    {MENU_SECTIONS.map((section, si) => {
                        const shut = !!closed[section.title];
                        return (
                            <div key={section.title} className={`nav-section sec-${si}`}>
                                <button
                                    type="button"
                                    className="nav-section-title"
                                    aria-expanded={!shut}
                                    onClick={() => setClosed((c) => ({ ...c, [section.title]: !c[section.title] }))}
                                >
                                    <span>{section.title}</span>
                                    <span className={`nav-chev${shut ? ' shut' : ''}`}><Ic n="chevd" s={14} /></span>
                                </button>

                                <div className={`nav-items${shut ? ' shut' : ''}`}>
                                    {section.items.map((item) => {
                                        const on = item.href === activeHref;
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                title={item.label}
                                                className={`nav-item ${on ? 'active' : ''}`}
                                                aria-current={on ? 'page' : undefined}
                                            >
                                                <span className="nav-icon"><Ic n={item.icon} s={17} /></span>
                                                <span className="nav-text">{item.label}</span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </nav>

                <div className="sidebar-bottom">
                    {/* Thẻ người dùng chỉ hiện trong menu trượt trên điện thoại (desktop đã có ở thanh trên) */}
                    <div className="sidebar-user-card">
                        <div className="avatar">{initial}</div>
                        <div className="sidebar-user-meta">
                            <div className="user-name">{displayName}</div>
                            <div className="user-class">{className ? `Lớp ${className}` : '—'}</div>
                        </div>
                    </div>
                    <button type="button" onClick={handleLogout} className="btn-logout" title="Đăng xuất">
                        <Ic n="out" s={16} /> <span>Đăng xuất</span>
                    </button>
                </div>
            </aside>

            {open && <div className="student-scrim" onClick={() => setOpen(false)} />}

            {/* ===== MAIN ===== */}
            <div className="student-main">
                <header className="student-topbar">
                    <button type="button" className="topbar-burger" onClick={() => setOpen(true)} aria-label="Mở menu">
                        <Ic n="menu" s={22} />
                    </button>
                    <button
                        type="button"
                        className="topbar-collapse"
                        onClick={toggleMini}
                        aria-label={mini ? 'Mở rộng menu' : 'Thu gọn menu'}
                        title={mini ? 'Mở rộng menu' : 'Thu gọn menu'}
                    >
                        <Ic n="panel" s={19} />
                    </button>

                    <nav className="topbar-left" aria-label="Đường dẫn">
                        <span className="topbar-crumb">Cổng Học sinh</span>
                        {current && currentSection ? (
                            <>
                                <span className="topbar-sep"><Ic n="chev" s={14} /></span>
                                <span className="topbar-crumb topbar-crumb-sec">{currentSection.title}</span>
                                <span className="topbar-sep topbar-sep-sec"><Ic n="chev" s={14} /></span>
                                <b className="topbar-title">{current.label}</b>
                            </>
                        ) : (
                            <>
                                <span className="topbar-sep"><Ic n="chev" s={14} /></span>
                                <b className="topbar-title">Thông tin</b>
                            </>
                        )}
                    </nav>

                    <div className="topbar-search-wrap">
                        <form
                            className="topbar-search"
                            onSubmit={(e) => {
                                e.preventDefault();
                                goSearch();
                            }}
                        >
                            <span className="topbar-search-lead"><Ic n="search" s={17} /></span>
                            <input
                                type="search"
                                placeholder="Tìm chức năng, thông báo…"
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
                                <Ic n="search" s={16} />
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
                                            <span className="topbar-search-ico"><Ic n={item.icon} s={16} /></span>
                                            <span>{item.label}</span>
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    <span className="topbar-year">
                        <Ic n="clock" s={15} />
                        Năm học {yearLabel ? yearLabel.replace('-', ' – ') : '2025 – 2026'}
                    </span>

                    <Link href="/student/notifications" className="topbar-bell" aria-label="Thông báo" title="Thông báo">
                        <Ic n="bell" s={19} />
                    </Link>

                    <div className="topbar-user">
                        <div className="topbar-avatar">{initial}</div>
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