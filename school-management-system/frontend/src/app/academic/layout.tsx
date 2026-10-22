'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Be_Vietnam_Pro } from 'next/font/google';
import { api, clearSession, getStaff, getToken, Staff } from './_lib/api';
import './academic.css';

const font = Be_Vietnam_Pro({ subsets: ['vietnamese', 'latin'], weight: ['400', '500', '600', '700'], fallback: ['system-ui', 'Segoe UI', 'Arial', 'sans-serif'] });

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
};
export const Icon = ({ n, s = 18 }: { n: string; s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={I[n]} /></svg>
);

const MENU = [
    { g: 'Tổng quan', items: [{ href: '/academic/dashboard', t: 'Dashboard', i: 'dash' }] },
    { g: 'Học sinh', items: [
            { href: '/academic/students', t: 'Hồ sơ học sinh', i: 'users' },
            { href: '/academic/students/requests', t: 'Duyệt hồ sơ', i: 'check', badge: true },
            { href: '/academic/classes', t: 'Quản lý lớp', i: 'school' },
        ] },
    { g: 'Đào tạo', items: [
            { href: '/academic/assignments', t: 'Phân công giảng dạy', i: 'link' },
            { href: '/academic/timetable', t: 'Thời khóa biểu', i: 'cal' },
            { href: '/academic/exams', t: 'Lịch thi', i: 'exam' },
        ] },
    { g: 'Kết quả', items: [
            { href: '/academic/grades', t: 'Quản lý điểm', i: 'grade' },
            { href: '/academic/promotion', t: 'Xét lên lớp', i: 'up' },
            { href: '/academic/reports', t: 'Báo cáo thống kê', i: 'pie' },
        ] },
];

export default function AcademicLayout({ children }: { children: ReactNode }) {
    const path = usePathname();
    const router = useRouter();
    const [staff, setStaff] = useState<Staff | null>(null);
    const [ready, setReady] = useState(false);
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState(0);
    const [year, setYear] = useState('');

    useEffect(() => {
        if (!getToken() || !getStaff()) { router.replace('/login/academic'); return; }
        setStaff(getStaff()); setReady(true);
        api('me').catch(() => {});
        api<any>('profile-requests?status=pending').then((d) => setPending(d?.counts?.pending ?? 0)).catch(() => {});
        api<any>('classes').then((d) => setYear(d?.year ?? '')).catch(() => {});
    }, [router, path]);
    useEffect(() => setOpen(false), [path]);

    const logout = async () => {
        try { await api('logout', { method: 'POST' }); } catch {}
        clearSession(); router.replace('/login/academic');
    };
    if (!ready) return <div className={`ac-root ${font.className}`}><div className="ac-loading full"><i className="ac-spin" />Đang kiểm tra phiên đăng nhập…</div></div>;

    const active = (h: string) => path === h || (h !== '/academic/students' && path.startsWith(h + '/')) || (h === '/academic/students' && (path === h || (path.startsWith(h + '/') && !path.startsWith('/academic/students/requests'))));

    return (
        <div className={`ac-root ${font.className}`}>
            <aside className={`ac-side ${open ? 'open' : ''}`}>
                <div className="ac-brand">
                    <span className="ac-logo">GV</span>
                    <div><b>Cổng Giáo vụ</b><small>THPT · Quản lý đào tạo</small></div>
                </div>
                <nav>
                    {MENU.map((g) => (
                        <div key={g.g} className="ac-grp">
                            <p>{g.g}</p>
                            {g.items.map((it) => (
                                <Link key={it.href} href={it.href} className={active(it.href) ? 'on' : ''}>
                                    <Icon n={it.i} /><span>{it.t}</span>
                                    {it.badge && pending > 0 && <em>{pending}</em>}
                                </Link>
                            ))}
                        </div>
                    ))}
                </nav>
                <div className="ac-me">
                    <span className="ac-av">{staff?.name?.split(' ').slice(-1)[0]?.[0] ?? 'G'}</span>
                    <div><b>{staff?.name}</b><small>{staff?.role_label}</small></div>
                    <button onClick={logout} title="Đăng xuất" aria-label="Đăng xuất"><Icon n="out" /></button>
                </div>
            </aside>
            {open && <div className="ac-scrim" onClick={() => setOpen(false)} />}
            <div className="ac-main">
                <header className="ac-top">
                    <button className="ac-burger" onClick={() => setOpen(true)} aria-label="Mở menu"><Icon n="menu" s={22} /></button>
                    <div className="ac-crumb">Năm học <b>{year || '—'}</b></div>
                    <div className="ac-top-r">
                        <span className="ac-role">{staff?.role_label}</span>
                        <button className="ac-btn ghost sm" onClick={logout}>Đăng xuất</button>
                    </div>
                </header>
                <main className="ac-content">{children}</main>
            </div>
        </div>
    );
}