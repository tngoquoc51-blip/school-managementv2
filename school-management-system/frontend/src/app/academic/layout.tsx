'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Be_Vietnam_Pro } from 'next/font/google';
import { api, clearSession, getStaff, getToken, type Staff } from '@/app/academic/_lib/api';
import '@/app/academic/academic.css';

const font = Be_Vietnam_Pro({
    subsets: ['vietnamese', 'latin'],
    weight: ['400', '500', '600', '700'],
    fallback: ['system-ui', 'Segoe UI', 'Arial', 'sans-serif'],
});

const I: Record<string, string> = {
    dash: 'M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10',
    users: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8',
    check: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
    school: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h.01M15 10h.01',
    link: 'M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1',
    cal: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
    exam: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M8 13h8M8 17h5',
    grade: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
    up: 'M12 19V5M5 12l7-7 7 7',
    pie: 'M21.2 15.9A10 10 0 118.1 2.8M22 12A10 10 0 0012 2v10z',
    out: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
    menu: 'M3 6h18M3 12h18M3 18h18',
    close: 'M18 6L6 18M6 6l12 12',
    panel: 'M3 5h18v14H3zM9 5v14',
    search: 'M21 21l-4.3-4.3M17 11a6 6 0 11-12 0 6 6 0 0112 0z',
    chev: 'M9 18l6-6-6-6',
    chevd: 'M6 9l6 6 6-6',
    bell: 'M6 9a6 6 0 0112 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 004 0',
    user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8',
};

export const Icon = ({ n, s = 18 }: { n: string; s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={I[n]} />
    </svg>
);

type Item = { href: string; t: string; i: string; badge?: boolean };

const MENU: { g: string; items: Item[] }[] = [
    { g: 'Tổng quan', items: [{ href: '/academic/dashboard', t: 'Dashboard', i: 'dash' }] },
    {
        g: 'Học sinh',
        items: [
            { href: '/academic/students', t: 'Hồ sơ học sinh', i: 'users' },
            { href: '/academic/students/requests', t: 'Duyệt hồ sơ', i: 'check', badge: true },
            { href: '/academic/classes', t: 'Quản lý lớp', i: 'school' },
        ],
    },
    {
        g: 'Đào tạo',
        items: [
            { href: '/academic/assignments', t: 'Phân công giảng dạy', i: 'link' },
            { href: '/academic/timetable', t: 'Thời khóa biểu', i: 'cal' },
            { href: '/academic/exams', t: 'Lịch thi', i: 'exam' },
        ],
    },
    {
        g: 'Kết quả',
        items: [
            { href: '/academic/grades', t: 'Quản lý điểm', i: 'grade' },
            { href: '/academic/promotion', t: 'Xét lên lớp', i: 'up' },
            { href: '/academic/reports', t: 'Báo cáo thống kê', i: 'pie' },
        ],
    },
    {
        g: 'Hệ thống',
        items: [
            { href: '/academic/notifications', t: 'Thông báo', i: 'bell' },
            { href: '/academic/profile', t: 'Hồ sơ của tôi', i: 'user' },
        ],
    },
];

const ALL_ITEMS = MENU.flatMap((g) => g.items.map((it) => ({ ...it, g: g.g })));

export default function AcademicLayout({ children }: { children: ReactNode }) {
    const path = usePathname();
    const router = useRouter();
    const [staff, setStaff] = useState<Staff | null>(null);
    const [ready, setReady] = useState(false);
    const [open, setOpen] = useState(false);
    const [mini, setMini] = useState(false);
    const [closed, setClosed] = useState<Record<string, boolean>>({});
    const [logoFail, setLogoFail] = useState(false);
    const [search, setSearch] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [pending, setPending] = useState(0);
    const [year, setYear] = useState('');

    useEffect(() => {
        if (!getToken() || !getStaff()) {
            router.replace('/login/academic');
            return;
        }
        setStaff(getStaff());
        setReady(true);
        api('me').catch(() => {});
        api<any>('profile-requests?status=pending')
            .then((d) => setPending(d?.counts?.pending ?? 0))
            .catch(() => {});
        api<any>('classes')
            .then((d) => setYear(d?.year ?? ''))
            .catch(() => {});
    }, [router, path]);

    useEffect(() => setOpen(false), [path]);

    useEffect(() => {
        try {
            setMini(localStorage.getItem('ac-mini') === '1');
        } catch {}
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setOpen(false);
                setSearchOpen(false);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const toggleMini = () => {
        const next = !mini;
        setMini(next);
        try {
            localStorage.setItem('ac-mini', next ? '1' : '0');
        } catch {}
    };

    const logout = async () => {
        try {
            await api('logout', { method: 'POST' });
        } catch {}
        clearSession();
        router.replace('/login/academic');
    };

    const today = useMemo(
        () =>
            new Date().toLocaleDateString('vi-VN', {
                weekday: 'long',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
            }),
        []
    );

    const active = (h: string) =>
        path === h ||
        (h !== '/academic/students' && path.startsWith(h + '/')) ||
        (h === '/academic/students' &&
            (path === h || (path.startsWith(h + '/') && !path.startsWith('/academic/students/requests'))));

    const current = ALL_ITEMS.find((it) => active(it.href));
    const curGroup = current?.g;

    useEffect(() => {
        if (!curGroup) return;
        setClosed((c) => (c[curGroup] ? { ...c, [curGroup]: false } : c));
    }, [curGroup]);

    if (!ready) {
        return (
            <div className={`ac-root ${font.className}`}>
                <div className="ac-loading full">
                    <i className="ac-spin" />
                    Đang kiểm tra phiên đăng nhập…
                </div>
            </div>
        );
    }

    const q = search.trim().toLowerCase();
    const results = q ? ALL_ITEMS.filter((it) => it.t.toLowerCase().includes(q)) : [];
    const goTo = (href?: string) => {
        const h = href ?? results[0]?.href;
        if (!h) return;
        router.push(h);
        setSearch('');
        setSearchOpen(false);
    };

    const initial = (staff?.name?.split(' ').slice(-1)[0]?.[0] ?? 'G').toUpperCase();

    return (
        <div className={`ac-root ${font.className} ${mini ? 'mini' : ''}`}>
            <aside className={`ac-side ${open ? 'open' : ''}`}>
                <button className="ac-side-x" onClick={() => setOpen(false)} aria-label="Đóng menu">
                    <Icon n="close" />
                </button>
                <div className="ac-brand">
                    {logoFail ? (
                        <span className="ac-logo ac-logo-fb">GV</span>
                    ) : (
                        <img
                            src="/images/logo-thpt-ngo-sy-lien.png"
                            alt="Logo THPT Ngô Sỹ Liên"
                            className="ac-logo"
                            onError={() => setLogoFail(true)}
                        />
                    )}
                    <div className="ac-brand-t">
                        <b>THPT Ngô Sỹ Liên</b>
                        <small>Cổng Giáo vụ</small>
                    </div>
                </div>
                <nav aria-label="Menu chính">
                    {MENU.map((g) => {
                        const shut = !!closed[g.g];
                        return (
                            <div key={g.g} className="ac-grp">
                                <button
                                    type="button"
                                    className="ac-grp-h"
                                    aria-expanded={!shut}
                                    onClick={() => setClosed((c) => ({ ...c, [g.g]: !c[g.g] }))}
                                >
                                    <span>{g.g}</span>
                                    <span className={`ac-grp-chev${shut ? ' shut' : ''}`}>
                                        <Icon n="chevd" s={14} />
                                    </span>
                                </button>
                                <div className={`ac-grp-items${shut ? ' shut' : ''}`}>
                                    {g.items.map((it) => {
                                        const on = active(it.href);
                                        return (
                                            <Link
                                                key={it.href}
                                                href={it.href}
                                                className={on ? 'on' : ''}
                                                aria-current={on ? 'page' : undefined}
                                                title={it.t}
                                            >
                                                <span className="ac-ic">
                                                    <Icon n={it.i} s={18} />
                                                </span>
                                                <span className="ac-lb">{it.t}</span>
                                                {it.badge && pending > 0 && <em>{pending}</em>}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </nav>
                <div className="ac-bottom">
                    <div className="ac-me">
                        <span className="ac-av">{initial}</span>
                        <div className="ac-me-t">
                            <b>{staff?.name}</b>
                            <small>{staff?.role_label}</small>
                        </div>
                    </div>
                    <button type="button" className="ac-logout" onClick={logout} title="Đăng xuất">
                        <Icon n="out" s={16} /> <span>Đăng xuất</span>
                    </button>
                </div>
            </aside>
            {open && <div className="ac-scrim" onClick={() => setOpen(false)} />}
            <div className="ac-main">
                <header className="ac-top">
                    <button className="ac-burger" onClick={() => setOpen(true)} aria-label="Mở menu">
                        <Icon n="menu" s={22} />
                    </button>
                    <button className="ac-rail" onClick={toggleMini} aria-label="Thu gọn menu" title="Thu gọn menu">
                        <Icon n="panel" s={19} />
                    </button>
                    <nav className="ac-crumb" aria-label="Đường dẫn">
                        <span className="ac-crumb-root">Cổng Giáo vụ</span>
                        {current && (
                            <>
                                <span className="ac-chev">
                                    <Icon n="chev" s={14} />
                                </span>
                                <span className="ac-crumb-g">{current.g}</span>
                                <span className="ac-chev ac-chev-g">
                                    <Icon n="chev" s={14} />
                                </span>
                                <b className="ac-here">{current.t}</b>
                            </>
                        )}
                    </nav>
                    <div className="ac-search-wrap">
                        <form
                            className="ac-search"
                            onSubmit={(e) => {
                                e.preventDefault();
                                goTo();
                            }}
                        >
                            <span className="ac-search-lead">
                                <Icon n="search" s={17} />
                            </span>
                            <input
                                type="search"
                                placeholder="Tìm chức năng…"
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
                                <Icon n="search" s={16} />
                            </button>
                        </form>
                        {searchOpen && q && (
                            <div className="ac-search-dd">
                                {results.length === 0 ? (
                                    <div className="ac-search-empty">Không tìm thấy chức năng phù hợp</div>
                                ) : (
                                    results.map((it) => (
                                        <button
                                            key={it.href}
                                            type="button"
                                            className="ac-search-item"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => goTo(it.href)}
                                        >
                                            <span className="ac-search-ico">
                                                <Icon n={it.i} s={16} />
                                            </span>
                                            <span>{it.t}</span>
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                    <span className="ac-year">
                        <Icon n="cal" s={15} />
                        Năm học <b>{year || '—'}</b>
                    </span>
                    <span className="ac-date">{today}</span>
                    <div className="ac-user">
                        <span className="ac-user-av">{initial}</span>
                        <div className="ac-user-t">
                            <b>{staff?.name}</b>
                            <small>{staff?.role_label}</small>
                        </div>
                    </div>
                </header>
                <main className="ac-content">{children}</main>
            </div>
        </div>
    );
}