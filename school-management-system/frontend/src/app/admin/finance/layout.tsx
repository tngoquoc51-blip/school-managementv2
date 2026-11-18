'use client';

import '../../teacher/attendance/attendance.css';
import './finance.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Btn, FiContext, FiCtx, Ico, Meta, TaContext, adminName, fi, longDate, todayStr } from './_fi';

const NAV = [
    { href: '/admin/finance', label: 'Tổng quan', icon: 'home' },
    { href: '/admin/finance/hoa-don', label: 'Hóa đơn', icon: 'doc' },
    { href: '/admin/finance/thanh-toan', label: 'Thanh toán & đối soát', icon: 'coin', badge: 'pending' },
    { href: '/admin/finance/cong-no', label: 'Công nợ', icon: 'alert' },
    { href: '/admin/finance/khoan-thu', label: 'Khoản thu', icon: 'tpl' },
    { href: '/admin/finance/mien-giam', label: 'Miễn giảm', icon: 'shield' },
    { href: '/admin/finance/khieu-nai', label: 'Khiếu nại', icon: 'mega', badge: 'disputes' },
    { href: '/admin/finance/chi-phi', label: 'Sổ chi', icon: 'archive' },
    { href: '/admin/finance/bao-cao', label: 'Báo cáo', icon: 'stats' },
    { href: '/admin/finance/cai-dat', label: 'Cài đặt & nhật ký', icon: 'cog' },
];
const SETTINGS = { lock_days: 7, good_rate: 95, warn_rate: 85, alert_absent: 3 };
type Badges = { pending?: { n: number }; disputes_open?: number };

export default function AdminFinanceLayout({ children }: { children: React.ReactNode }) {
    const path = usePathname() || '';
    const [ready, setReady] = useState(false);
    const [expired, setExpired] = useState(false);
    const [meta, setMeta] = useState<Meta | null>(null);
    const [yearId, setYearId] = useState(0);
    const [version, setVersion] = useState(0);
    const [badges, setBadges] = useState<Badges>({});
    const [err, setErr] = useState('');
    const [toastMsg, setToastMsg] = useState<{ m: string; k: 'ok' | 'err' } | null>(null);
    const tt = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setReady(true);
        const f = () => setExpired(true);
        window.addEventListener('ta-auth', f);
        return () => window.removeEventListener('ta-auth', f);
    }, []);
    const toast = useCallback((m: string, k: 'ok' | 'err' = 'ok') => {
        setToastMsg({ m, k });
        if (tt.current) clearTimeout(tt.current);
        tt.current = setTimeout(() => setToastMsg(null), 5200);
    }, []);
    const refresh = useCallback(() => setVersion((v) => v + 1), []);

    useEffect(() => {
        if (!ready || expired) return;
        fi<Meta>(yearId ? `meta?year_id=${yearId}` : 'meta').then((m) => { setMeta(m); if (!yearId) setYearId(m.year_id); setErr(''); }).catch((e: Error) => setErr(e.message));
    }, [ready, expired, yearId]);
    useEffect(() => {
        if (!ready || expired || !yearId) return;
        fi<Badges>(`overview?year_id=${yearId}`).then(setBadges).catch(() => { /* trang con sẽ báo lỗi */ });
    }, [ready, expired, yearId, version]);

    if (!ready) return <div className="ta fi ta-boot"><div className="ta-spin" /></div>;
    if (expired) {
        return (
            <div className="ta fi"><div className="ta-gate"><div className="ta-gate-c">
                <div className="ta-gate-ic"><Ico n="lock" size={26} /></div>
                <h2>Phiên đăng nhập đã hết hạn</h2>
                <p>Vui lòng đăng nhập lại bằng tài khoản quản trị để xem tài chính.</p>
                <Btn tone="primary" onClick={() => { window.location.href = '/login'; }}>Đăng nhập lại</Btn>
            </div></div></div>
        );
    }
    const isActive = (h: string) => path === h || (h !== '/admin/finance' && path.startsWith(h + '/'));
    const badge = (k?: string) => (k === 'pending' ? badges.pending?.n || 0 : k === 'disputes' ? badges.disputes_open || 0 : 0);

    return (
        <TaContext.Provider value={{ staff: { name: adminName(), role: 'admin' }, settings: SETTINGS, toast, refresh, version }}>
            <FiContext.Provider value={(meta && yearId ? { meta, yearId, setYearId } : null) as unknown as FiCtx}>
                <div className="ta fi">
                    <div className="ta-hero">
                        <div className="ta-hero-in">
                            <div className="ta-hero-ic"><Ico n="coin" size={26} /></div>
                            <div className="ta-hero-tx">
                                <h1>Tài chính & Học phí</h1>
                                <p>Thu – chi, hóa đơn, công nợ, đối soát và báo cáo của nhà trường · {longDate(todayStr())}</p>
                            </div>
                            <div className="ta-hero-r">
                                {meta && <label className="fi-year"><Ico n="cal" size={15} /><select value={yearId} onChange={(e) => setYearId(Number(e.target.value))} aria-label="Năm học">{meta.years.map((y) => <option key={y.id} value={y.id}>Năm học {y.label}{y.current ? ' (hiện tại)' : ''}</option>)}</select></label>}
                                <Link href="/admin/finance/thanh-toan" className="ta-btn primary hero"><Ico n="coin" size={16} />Đối soát hôm nay</Link>
                            </div>
                        </div>
                        <nav className="ta-nav" aria-label="Tài chính">
                            {NAV.map((n) => (
                                <Link key={n.href} href={n.href} className={isActive(n.href) ? 'on' : ''}>
                                    <Ico n={n.icon} size={16} />{n.label}{badge(n.badge) > 0 && <em>{badge(n.badge)}</em>}
                                </Link>
                            ))}
                        </nav>
                    </div>
                    <main className="ta-main">{err ? <div className="ta-err"><Ico n="alert" size={20} /><div><b>Không tải được dữ liệu</b><p>{err}</p></div><button className="ta-btn sm" onClick={() => setYearId(0)}>Thử lại</button></div> : meta && yearId ? children : <div className="ta-boot"><div className="ta-spin" /></div>}</main>
                    {toastMsg && <div className={`ta-toast ${toastMsg.k}`} role="status"><Ico n={toastMsg.k === 'ok' ? 'check' : 'alert'} size={18} />{toastMsg.m}</div>}
                </div>
            </FiContext.Provider>
        </TaContext.Provider>
    );
}