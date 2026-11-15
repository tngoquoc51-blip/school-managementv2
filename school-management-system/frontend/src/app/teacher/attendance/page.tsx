'use client';

import './attendance.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar, Btn, Ico, Settings, Staff, TaContext, ta, getStaff, getToken, longDate, todayStr } from './_ta';

const NAV = [
    { href: '/teacher/attendance', label: 'Hôm nay', icon: 'home' },
    { href: '/teacher/attendance/tiet', label: 'Điểm danh tiết', icon: 'checks' },
    { href: '/teacher/attendance/lich', label: 'Lịch tuần', icon: 'cal' },
    { href: '/teacher/attendance/lich-su', label: 'Lịch sử & khóa', icon: 'lock', badge: true },
    { href: '/teacher/attendance/chu-nhiem', label: 'Lớp chủ nhiệm', icon: 'school' },
    { href: '/teacher/attendance/thong-ke', label: 'Thống kê', icon: 'stats' },
];
const DEFAULTS: Settings = { lock_days: 7, good_rate: 95, warn_rate: 85, alert_absent: 3 };

export default function TeacherAttendanceLayout({ children }: { children: React.ReactNode }) {
    const path = usePathname() || '';
    const [ready, setReady] = useState(false);
    const [staff, setStaff] = useState<Staff | null>(null);
    const [expired, setExpired] = useState(false);
    const [settings, setSettings] = useState<Settings>(DEFAULTS);
    const [missing, setMissing] = useState(0);
    const [version, setVersion] = useState(0);
    const [toastMsg, setToastMsg] = useState<{ m: string; k: 'ok' | 'err' } | null>(null);
    const tt = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setStaff(getStaff()); setExpired(!getToken()); setReady(true);
        const f = () => setExpired(true);
        window.addEventListener('ta-auth', f);
        return () => window.removeEventListener('ta-auth', f);
    }, []);

    const toast = useCallback((m: string, k: 'ok' | 'err' = 'ok') => {
        setToastMsg({ m, k });
        if (tt.current) clearTimeout(tt.current);
        tt.current = setTimeout(() => setToastMsg(null), 4200);
    }, []);
    const refresh = useCallback(() => setVersion((v) => v + 1), []);

    useEffect(() => {
        if (!ready || expired) return;
        ta<unknown>('missing').then((r) => setMissing(Number((r as { total?: number }).total ?? 0))).catch(() => { /* trang con sẽ báo lỗi */ });
    }, [ready, expired, version]);
    useEffect(() => {
        if (!ready || expired) return;
        ta<unknown>('overview').then((r) => { const s = (r as { settings?: Settings }).settings; if (s) setSettings(s); }).catch(() => { /* bỏ qua */ });
    }, [ready, expired]);

    if (!ready) return <div className="ta ta-boot"><div className="ta-spin" /></div>;
    if (expired || !staff) {
        return (
            <div className="ta"><div className="ta-gate"><div className="ta-gate-c">
                <div className="ta-gate-ic"><Ico n="lock" size={26} /></div>
                <h2>Phiên đăng nhập đã hết hạn</h2>
                <p>Vui lòng đăng nhập lại bằng tài khoản giáo viên để điểm danh.</p>
                <Btn tone="primary" onClick={() => { window.location.href = '/login'; }}>Đăng nhập lại</Btn>
            </div></div></div>
        );
    }
    const isActive = (h: string) => path === h || (h !== '/teacher/attendance' && path.startsWith(h + '/'));

    return (
        <TaContext.Provider value={{ staff, settings, toast, refresh, version }}>
            <div className="ta">
                <div className="ta-hero">
                    <div className="ta-hero-in">
                        <div className="ta-hero-ic"><Ico n="checks" size={26} /></div>
                        <div className="ta-hero-tx">
                            <h1>Điểm danh từng tiết</h1>
                            <p>Điểm danh học sinh, hoàn tất để tự khóa và gửi về nhà trường · {longDate(todayStr())}</p>
                        </div>
                        <div className="ta-hero-r">
                            <span className="ta-who"><Avatar name={staff.name} tone="teal" /><span><b>{staff.name}</b><small>Giáo viên</small></span></span>
                            <Link href="/teacher/attendance/tiet" className="ta-btn primary hero"><Ico n="checks" size={16} />Điểm danh ngay</Link>
                        </div>
                    </div>
                    <nav className="ta-nav" aria-label="Điểm danh">
                        {NAV.map((n) => (
                            <Link key={n.href} href={n.href} className={isActive(n.href) ? 'on' : ''}>
                                <Ico n={n.icon} size={16} />{n.label}{n.badge && missing > 0 && <em title="Tiết cần bổ sung">{missing}</em>}
                            </Link>
                        ))}
                    </nav>
                </div>
                <main className="ta-main">{children}</main>
                {toastMsg && <div className={`ta-toast ${toastMsg.k}`} role="status"><Ico n={toastMsg.k === 'ok' ? 'check' : 'alert'} size={18} />{toastMsg.m}</div>}
            </div>
        </TaContext.Provider>
    );
}