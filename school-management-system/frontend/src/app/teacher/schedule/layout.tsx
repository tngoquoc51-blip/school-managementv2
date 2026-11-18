'use client';

import '../attendance/attendance.css';
import './schedule.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar, Btn, Ico, Settings, Staff, TaContext, getStaff, longDate, todayStr } from '../attendance/_ta';
import { Slot, fromNow, minsUntil, tk, timeText } from './_tk';

const NAV = [
    { href: '/teacher/schedule', label: 'Tổng quan', icon: 'home' },
    { href: '/teacher/schedule/tuan', label: 'Thời khóa biểu tuần', icon: 'cal' },
    { href: '/teacher/schedule/lop', label: 'Lớp của tôi', icon: 'users' },
    { href: '/teacher/schedule/khoi-luong', label: 'Khối lượng & tiết trống', icon: 'stats' },
    { href: '/teacher/schedule/yeu-cau', label: 'Yêu cầu', icon: 'send', badge: true },
    { href: '/teacher/schedule/ghi-chu', label: 'Ghi chú & giáo án', icon: 'pen' },
];
const DEFAULTS: Settings = { lock_days: 7, good_rate: 95, warn_rate: 85, alert_absent: 3 };
type Ov = { next: Slot | null; pending_requests: number };

export default function TeacherScheduleLayout({ children }: { children: React.ReactNode }) {
    const path = usePathname() || '';
    const [ready, setReady] = useState(false);
    const [staff, setStaff] = useState<Staff | null>(null);
    const [expired, setExpired] = useState(false);
    const [version, setVersion] = useState(0);
    const [pending, setPending] = useState(0);
    const [remind, setRemind] = useState(false);
    const [toastMsg, setToastMsg] = useState<{ m: string; k: 'ok' | 'err' } | null>(null);
    const tt = useRef<ReturnType<typeof setTimeout> | null>(null);
    const nextRef = useRef<Slot | null>(null);
    const told = useRef<Set<string>>(new Set());

    useEffect(() => {
        setStaff(getStaff()); setReady(true);
        try { setRemind(localStorage.getItem('ts-remind') === '1'); } catch { /* bỏ qua */ }
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

    // lấy tiết kế tiếp + số yêu cầu chờ duyệt, làm mới mỗi 2 phút
    useEffect(() => {
        if (!ready || expired) return;
        const load = () => tk<Ov>('overview').then((o) => { nextRef.current = o.next; setPending(o.pending_requests || 0); }).catch(() => { /* trang con sẽ báo lỗi */ });
        load(); const t = setInterval(load, 120000);
        return () => clearInterval(t);
    }, [ready, expired, version]);

    // nhắc trước giờ dạy 10 phút
    useEffect(() => {
        if (!remind) return;
        const t = setInterval(() => {
            const n = nextRef.current; if (!n || !n.start) return;
            const m = minsUntil(n.date, n.start); const key = `${n.date}|${n.cs}|${n.period}`;
            if (m > 0 && m <= 10 && !told.current.has(key)) {
                told.current.add(key);
                const msg = `${n.subject} – ${n.class_name} ${fromNow(m)} (${timeText(n)})`;
                toast(`Sắp đến giờ dạy: ${msg}`);
                try { if ('Notification' in window && Notification.permission === 'granted') new Notification('Sắp đến giờ dạy', { body: msg }); } catch { /* bỏ qua */ }
            }
        }, 30000);
        return () => clearInterval(t);
    }, [remind, toast]);

    const toggleRemind = async () => {
        const on = !remind;
        if (on && 'Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch { /* bỏ qua */ } }
        setRemind(on);
        try { localStorage.setItem('ts-remind', on ? '1' : '0'); } catch { /* bỏ qua */ }
        toast(on ? 'Đã bật nhắc giờ dạy (trước 10 phút, khi đang mở trang này).' : 'Đã tắt nhắc giờ dạy.');
    };

    if (!ready) return <div className="ta ta-boot"><div className="ta-spin" /></div>;
    if (expired || !staff) {
        return (
            <div className="ta"><div className="ta-gate"><div className="ta-gate-c">
                <div className="ta-gate-ic"><Ico n="lock" size={26} /></div>
                <h2>Phiên đăng nhập đã hết hạn</h2>
                <p>Vui lòng đăng nhập lại bằng tài khoản giáo viên để xem thời khóa biểu.</p>
                <Btn tone="primary" onClick={() => { window.location.href = '/login'; }}>Đăng nhập lại</Btn>
            </div></div></div>
        );
    }
    const isActive = (h: string) => path === h || (h !== '/teacher/schedule' && path.startsWith(h + '/'));

    return (
        <TaContext.Provider value={{ staff, settings: DEFAULTS, toast, refresh, version }}>
            <div className="ta ts">
                <div className="ta-hero">
                    <div className="ta-hero-in">
                        <div className="ta-hero-ic"><Ico n="cal" size={26} /></div>
                        <div className="ta-hero-tx">
                            <h1>Thời khóa biểu</h1>
                            <p>Lịch dạy, lớp phụ trách, đổi tiết – dạy bù và ghi chú giáo án · {longDate(todayStr())}</p>
                        </div>
                        <div className="ta-hero-r">
                            <button type="button" className={`ta-btn light${remind ? ' ts-on' : ''}`} onClick={toggleRemind} title="Nhắc trước giờ dạy 10 phút"><Ico n="bell" size={16} />{remind ? 'Đang nhắc giờ dạy' : 'Bật nhắc giờ dạy'}</button>
                            <span className="ta-who"><Avatar name={staff.name} tone="teal" /><span><b>{staff.name}</b><small>Giáo viên</small></span></span>
                            <Link href="/teacher/attendance" className="ta-btn primary hero"><Ico n="checks" size={16} />Điểm danh</Link>
                        </div>
                    </div>
                    <nav className="ta-nav" aria-label="Thời khóa biểu">
                        {NAV.map((n) => (
                            <Link key={n.href} href={n.href} className={isActive(n.href) ? 'on' : ''}>
                                <Ico n={n.icon} size={16} />{n.label}{n.badge && pending > 0 && <em title="Yêu cầu đang chờ duyệt">{pending}</em>}
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