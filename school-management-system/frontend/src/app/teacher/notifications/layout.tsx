'use client';

import '../attendance/attendance.css';
import './notifications.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar, Btn, Ico, Settings, Staff, TaContext, getStaff, longDate, todayStr } from '../attendance/_ta';
import { nt } from './_nt';

const ADMIN = ['academic', 'principal', 'vice_principal', 'super_admin'];
const DEFAULTS: Settings = { lock_days: 7, good_rate: 95, warn_rate: 85, alert_absent: 3 };
type Ov = { counts: { unread: number; urgent: number; high: number }; reminders: { overdue: number; soon: number } };
type Pf = { sound: boolean; desktop: boolean; quiet_from: string | null; quiet_to: string | null };

const inQuiet = (p: Pf) => {
    if (!p.quiet_from || !p.quiet_to) return false;
    const n = new Date(); const m = n.getHours() * 60 + n.getMinutes(); const [fh, fm] = p.quiet_from.split(':').map(Number); const [th, tm] = p.quiet_to.split(':').map(Number);
    const f = fh * 60 + fm, t = th * 60 + tm; return f <= t ? m >= f && m < t : m >= f || m < t;
};
const beep = () => {
    try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; const c = new AC(); const o = c.createOscillator(); const g = c.createGain();
        o.type = 'sine'; o.frequency.value = 880; g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(0.18, c.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.35);
        o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.4);
    } catch { /* trình duyệt chặn âm thanh */ }
};

export default function TeacherNotificationsLayout({ children }: { children: React.ReactNode }) {
    const path = usePathname() || '';
    const [ready, setReady] = useState(false); const [staff, setStaff] = useState<Staff | null>(null); const [expired, setExpired] = useState(false);
    const [version, setVersion] = useState(0); const [ov, setOv] = useState<Ov | null>(null);
    const [toastMsg, setToastMsg] = useState<{ m: string; k: 'ok' | 'err' } | null>(null);
    const tt = useRef<ReturnType<typeof setTimeout> | null>(null); const last = useRef<number | null>(null); const pf = useRef<Pf>({ sound: true, desktop: false, quiet_from: null, quiet_to: null });

    useEffect(() => {
        setStaff(getStaff()); setReady(true);
        const f = () => setExpired(true); window.addEventListener('ta-auth', f); return () => window.removeEventListener('ta-auth', f);
    }, []);
    const toast = useCallback((m: string, k: 'ok' | 'err' = 'ok') => { setToastMsg({ m, k }); if (tt.current) clearTimeout(tt.current); tt.current = setTimeout(() => setToastMsg(null), 5200); }, []);
    const refresh = useCallback(() => setVersion((v) => v + 1), []);

    // đếm thông báo chưa đọc, báo khi có thông báo mới
    useEffect(() => {
        if (!ready || expired) return;
        nt<{ data: Pf }>('prefs').then((r) => { pf.current = r.data; }).catch(() => { /* dùng mặc định */ });
        const load = () => nt<Ov & { attention: { title: string }[] }>('overview').then((o) => {
            setOv(o);
            if (last.current !== null && o.counts.unread > last.current) {
                const quiet = inQuiet(pf.current);
                if (!quiet && pf.current.sound) beep();
                const top = o.attention?.[0]?.title;
                toast(`Có ${o.counts.unread - last.current} thông báo mới${top ? `: ${top}` : ''}`);
                try { if (!quiet && pf.current.desktop && 'Notification' in window && Notification.permission === 'granted') new Notification('Thông báo mới', { body: top || 'Bạn có thông báo mới.' }); } catch { /* bỏ qua */ }
            }
            last.current = o.counts.unread;
        }).catch(() => { /* trang con sẽ báo lỗi */ });
        load(); const t = setInterval(load, 60000);
        return () => clearInterval(t);
    }, [ready, expired, version, toast]);

    if (!ready) return <div className="ta ta-boot"><div className="ta-spin" /></div>;
    if (expired || !staff) {
        return (
            <div className="ta"><div className="ta-gate"><div className="ta-gate-c">
                <div className="ta-gate-ic"><Ico n="lock" size={26} /></div><h2>Phiên đăng nhập đã hết hạn</h2><p>Vui lòng đăng nhập lại bằng tài khoản giáo viên để xem thông báo.</p>
                <Btn tone="primary" onClick={() => { window.location.href = '/login'; }}>Đăng nhập lại</Btn>
            </div></div></div>
        );
    }
    const isAdmin = ADMIN.includes(staff.role);
    const NAV = [
        { href: '/teacher/notifications', label: 'Tổng quan', icon: 'home' },
        { href: '/teacher/notifications/hop-thu', label: 'Hộp thư', icon: 'bell', badge: ov?.counts.unread || 0, tone: (ov?.counts.urgent || 0) > 0 ? 'rose' : '' },
        { href: '/teacher/notifications/nhac-viec', label: 'Nhắc việc', icon: 'clock', badge: ov?.reminders.overdue || 0, tone: 'rose' },
        { href: '/teacher/notifications/gui-hoc-sinh', label: 'Gửi học sinh', icon: 'send' },
        ...(isAdmin ? [{ href: '/teacher/notifications/phat-hanh', label: 'Phát hành', icon: 'mega' }] : []),
        { href: '/teacher/notifications/cai-dat', label: 'Cài đặt', icon: 'cog' },
    ];
    const isActive = (h: string) => path === h || (h !== '/teacher/notifications' && path.startsWith(h + '/'));
    const unread = ov?.counts.unread || 0;

    return (
        <TaContext.Provider value={{ staff, settings: DEFAULTS, toast, refresh, version }}>
            <div className="ta nt">
                <div className="ta-hero">
                    <div className="ta-hero-in">
                        <div className="ta-hero-ic nt-bell"><Ico n="bell" size={26} />{unread > 0 && <em>{unread > 99 ? '99+' : unread}</em>}</div>
                        <div className="ta-hero-tx">
                            <h1>Trung tâm thông báo</h1>
                            <p>{unread > 0 ? `Bạn có ${unread} thông báo chưa đọc` : 'Bạn đã xem hết thông báo'}{(ov?.counts.urgent || 0) > 0 ? ` · ${ov?.counts.urgent} khẩn cấp` : ''} · {longDate(todayStr())}</p>
                        </div>
                        <div className="ta-hero-r">
                            <span className="ta-who"><Avatar name={staff.name} tone="teal" /><span><b>{staff.name}</b><small>{isAdmin ? 'Quản lý' : 'Giáo viên'}</small></span></span>
                            <Link href="/teacher/notifications/hop-thu" className="ta-btn primary hero"><Ico n="bell" size={16} />Mở hộp thư</Link>
                        </div>
                    </div>
                    <nav className="ta-nav" aria-label="Thông báo">
                        {NAV.map((n) => (
                            <Link key={n.href} href={n.href} className={isActive(n.href) ? 'on' : ''}><Ico n={n.icon} size={16} />{n.label}{(n.badge || 0) > 0 && <em className={n.tone}>{n.badge}</em>}</Link>
                        ))}
                    </nav>
                </div>
                <main className="ta-main">{children}</main>
                {toastMsg && <div className={`ta-toast ${toastMsg.k}`} role="status"><Ico n={toastMsg.k === 'ok' ? 'check' : 'alert'} size={18} />{toastMsg.m}</div>}
            </div>
        </TaContext.Provider>
    );
}