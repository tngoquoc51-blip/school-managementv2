'use client';

import '../attendance/attendance.css';
import './observations.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar, Btn, Ico, Settings, Staff, TaContext, getStaff, longDate, todayStr } from '../attendance/_ta';
import { ADMIN_ROLES, SessionForm, ob } from './_ob';

const DEFAULTS: Settings = { lock_days: 7, good_rate: 95, warn_rate: 85, alert_absent: 3 };
type Ov = { personal: boolean; kpi?: { waiting: number; eval_todo: number; unack: number; upcoming: number; actions_open: number } };

export default function TeacherObservationsLayout({ children }: { children: React.ReactNode }) {
    const path = usePathname() || '';
    const [ready, setReady] = useState(false); const [staff, setStaff] = useState<Staff | null>(null); const [expired, setExpired] = useState(false);
    const [version, setVersion] = useState(0); const [ov, setOv] = useState<Ov | null>(null); const [form, setForm] = useState(false);
    const [toastMsg, setToastMsg] = useState<{ m: string; k: 'ok' | 'err' } | null>(null); const tt = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setStaff(getStaff()); setReady(true);
        const f = () => setExpired(true); window.addEventListener('ta-auth', f); return () => window.removeEventListener('ta-auth', f);
    }, []);
    const toast = useCallback((m: string, k: 'ok' | 'err' = 'ok') => { setToastMsg({ m, k }); if (tt.current) clearTimeout(tt.current); tt.current = setTimeout(() => setToastMsg(null), 5200); }, []);
    const refresh = useCallback(() => setVersion((v) => v + 1), []);

    // số việc đang chờ hiện trên thanh điều hướng
    useEffect(() => {
        if (!ready || expired) return;
        const load = () => ob<Ov>('overview').then(setOv).catch(() => { /* trang con sẽ báo lỗi */ });
        load(); const t = setInterval(load, 60000); return () => clearInterval(t);
    }, [ready, expired, version]);

    if (!ready) return <div className="ta ta-boot"><div className="ta-spin" /></div>;
    if (expired || !staff) {
        return (
            <div className="ta"><div className="ta-gate"><div className="ta-gate-c">
                <div className="ta-gate-ic"><Ico n="lock" size={26} /></div><h2>Phiên đăng nhập đã hết hạn</h2><p>Vui lòng đăng nhập lại bằng tài khoản giáo viên để dùng chức năng dự giờ.</p>
                <Btn tone="primary" onClick={() => { window.location.href = '/login'; }}>Đăng nhập lại</Btn>
            </div></div></div>
        );
    }
    const isAdmin = ADMIN_ROLES.includes(staff.role); const k = ov?.kpi;
    const NAV = [
        { href: '/teacher/observations', label: 'Tổng quan', icon: 'home' },
        { href: '/teacher/observations/lich', label: 'Lịch dự giờ', icon: 'cal', badge: k?.waiting || 0 },
        { href: '/teacher/observations/phieu', label: 'Phiếu đánh giá', icon: 'pen', badge: k?.eval_todo || 0 },
        { href: '/teacher/observations/ket-qua', label: 'Kết quả của tôi', icon: 'trend', badge: (k?.unack || 0) },
        { href: '/teacher/observations/tieu-chi', label: 'Tiêu chí & chỉ tiêu', icon: 'list' },
        ...(isAdmin ? [{ href: '/teacher/observations/bao-cao', label: 'Báo cáo', icon: 'stats' }] : []),
    ];
    const isActive = (h: string) => path === h || (h !== '/teacher/observations' && path.startsWith(h + '/'));
    const todo = (k?.waiting || 0) + (k?.eval_todo || 0);

    return (
        <TaContext.Provider value={{ staff, settings: DEFAULTS, toast, refresh, version }}>
            <div className="ta ob">
                <div className="ta-hero">
                    <div className="ta-hero-in">
                        <div className="ta-hero-ic"><Ico n="eye" size={26} /></div>
                        <div className="ta-hero-tx">
                            <h1>Dự giờ & đánh giá tiết dạy</h1>
                            <p>{ov?.personal === false ? 'Quản lý hoạt động dự giờ toàn trường' : todo > 0 ? `Bạn có ${todo} việc cần xử lý` : 'Bạn đã xử lý xong các việc dự giờ'}{(k?.upcoming || 0) > 0 ? ` · ${k?.upcoming} buổi sắp tới` : ''} · {longDate(todayStr())}</p>
                        </div>
                        <div className="ta-hero-r">
                            <span className="ta-who"><Avatar name={staff.name} tone="teal" /><span><b>{staff.name}</b><small>{isAdmin ? 'Quản lý' : 'Giáo viên'}</small></span></span>
                            <button type="button" className="ta-btn primary hero" onClick={() => setForm(true)}><Ico n="plus" size={16} />{isAdmin ? 'Phân công dự giờ' : 'Lên lịch dự giờ'}</button>
                        </div>
                    </div>
                    <nav className="ta-nav" aria-label="Dự giờ">
                        {NAV.map((n) => (
                            <Link key={n.href} href={n.href} className={isActive(n.href) ? 'on' : ''}><Ico n={n.icon} size={16} />{n.label}{(n.badge || 0) > 0 && <em className="rose">{n.badge}</em>}</Link>
                        ))}
                    </nav>
                </div>
                <main className="ta-main">{children}</main>
                {form && <SessionForm onClose={() => setForm(false)} onDone={() => { setForm(false); refresh(); }} />}
                {toastMsg && <div className={`ta-toast ${toastMsg.k}`} role="status"><Ico n={toastMsg.k === 'ok' ? 'check' : 'alert'} size={18} />{toastMsg.m}</div>}
            </div>
        </TaContext.Provider>
    );
}