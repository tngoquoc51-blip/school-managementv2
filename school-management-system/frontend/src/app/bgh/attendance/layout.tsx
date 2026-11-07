'use client';

import './attendance.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ALLOWED_ROLES, Avatar, Btn, CaContext, Ico, Meta, Staff, ca, clearSession, getSession, login, saveSession } from './_ca';

const NAV = [
    { href: '/bgh/attendance', label: 'Tổng quan', icon: 'home' },
    { href: '/bgh/attendance/diem-danh', label: 'Điểm danh', icon: 'checks' },
    { href: '/bgh/attendance/lop', label: 'Theo lớp', icon: 'school' },
    { href: '/bgh/attendance/hoc-sinh', label: 'Học sinh', icon: 'user' },
    { href: '/bgh/attendance/don-nghi', label: 'Đơn nghỉ', icon: 'doc', badge: 'leaves' },
    { href: '/bgh/attendance/canh-bao', label: 'Cảnh báo', icon: 'alert', badge: 'alerts' },
    { href: '/bgh/attendance/bao-cao', label: 'Báo cáo', icon: 'stats' },
    { href: '/bgh/attendance/cai-dat', label: 'Cài đặt', icon: 'cog' },
];

export default function AttendanceLayout({ children }: { children: React.ReactNode }) {
    const path = usePathname() || '';
    const [ready, setReady] = useState(false);
    const [staff, setStaff] = useState<Staff | null>(null);
    const [meta, setMeta] = useState<Meta | null>(null);
    const [badge, setBadge] = useState({ leaves: 0, alerts: 0 });
    const [version, setVersion] = useState(0);
    const [toastMsg, setToastMsg] = useState<{ m: string; k: 'ok' | 'err' } | null>(null);
    const tt = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setStaff(getSession()?.staff ?? null);
        setReady(true);
        const f = () => setStaff(null);
        window.addEventListener('ca-auth', f);
        return () => window.removeEventListener('ca-auth', f);
    }, []);

    const toast = useCallback((m: string, k: 'ok' | 'err' = 'ok') => {
        setToastMsg({ m, k });
        if (tt.current) clearTimeout(tt.current);
        tt.current = setTimeout(() => setToastMsg(null), 3800);
    }, []);
    const refresh = useCallback(() => setVersion((v) => v + 1), []);

    const loadBadge = useCallback(() => {
        Promise.all([ca<unknown[]>('leaves?status=pending&per=5'), ca<unknown[]>('alerts?filter=high')])
            .then(([l, a]) => setBadge({ leaves: l.counts?.pending ?? 0, alerts: a.counts?.high ?? 0 }))
            .catch(() => { /* bỏ qua, trang con sẽ báo lỗi */ });
    }, []);
    useEffect(() => {
        if (!staff) return;
        ca<unknown>('meta').then((r) => setMeta(r.data as Meta)).catch(() => { /* trang con sẽ báo lỗi */ });
    }, [staff]);
    useEffect(() => {
        if (!staff) return;
        loadBadge();
        const id = setInterval(loadBadge, 90000);
        return () => clearInterval(id);
    }, [staff, loadBadge, version]);

    if (!ready) return <div className="ca ca-boot"><div className="ca-spin" /></div>;
    if (!staff) return <div className="ca"><Gate onDone={(s) => setStaff(s)} /></div>;

    const canApprove = ['super_admin', 'principal'].includes(staff.role);
    const isActive = (h: string) => (h === '/bgh/attendance' ? path === h : path.startsWith(h));

    return (
        <CaContext.Provider value={{ staff, canApprove, meta, toast, refresh, version }}>
            <div className="ca">
                <div className="ca-hero">
                    <div className="ca-hero-in">
                        <div className="ca-hero-ic"><Ico n="checks" size={26} /></div>
                        <div className="ca-hero-tx">
                            <h1>Chuyên cần học sinh</h1>
                            <p>Điểm danh theo lớp, đơn xin nghỉ, cảnh báo nghỉ nhiều và báo cáo cho toàn trường{meta ? ` · ${meta.classes.length} lớp · ${meta.classes.reduce((a, c) => a + c.students, 0)} học sinh` : ''}</p>
                        </div>
                        <div className="ca-hero-r">
                            <span className="ca-who"><Avatar name={staff.name} tone="teal" /><span><b>{staff.name}</b><small>{staff.role_label}</small></span></span>
                            <Link href="/bgh/attendance/diem-danh" className="ca-btn primary hero"><Ico n="checks" size={16} />Điểm danh hôm nay</Link>
                        </div>
                    </div>
                    <nav className="ca-nav" aria-label="Chuyên cần">
                        {NAV.map((n) => {
                            const b = n.badge ? badge[n.badge as 'leaves' | 'alerts'] : 0;
                            return (
                                <Link key={n.href} href={n.href} className={isActive(n.href) ? 'on' : ''}>
                                    <Ico n={n.icon} size={16} />{n.label}
                                    {b > 0 && <em>{b}</em>}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
                <main className="ca-main">{children}</main>
                {toastMsg && <div className={`ca-toast ${toastMsg.k}`} role="status"><Ico n={toastMsg.k === 'ok' ? 'check' : 'alert'} size={18} />{toastMsg.m}</div>}
            </div>
        </CaContext.Provider>
    );
}

/* ---------- Khung đăng nhập (chỉ hiện khi chưa có phiên Ban Giám hiệu) ---------- */
function Gate({ onDone }: { onDone: (s: Staff) => void }) {
    const [u, setU] = useState(''); const [p, setP] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!u.trim() || !p) { setErr('Nhập tên đăng nhập và mật khẩu.'); return; }
        setBusy(true); setErr('');
        try {
            const d = await login(u.trim(), p);
            if (!ALLOWED_ROLES.includes(d.staff.role)) { setErr('Tài khoản này không thuộc Ban Giám hiệu nên không vào được phần Chuyên cần.'); setBusy(false); return; }
            saveSession(d.token, d.staff); onDone(d.staff);
        } catch (e2) { setErr((e2 as Error).message); setBusy(false); }
    };
    return (
        <div className="ca-gate">
            <form className="ca-gate-c" onSubmit={submit}>
                <div className="ca-gate-ic"><Ico n="lock" size={26} /></div>
                <h2>Đăng nhập Ban Giám hiệu</h2>
                <p>Phần Chuyên cần dành cho Hiệu trưởng, Phó hiệu trưởng và Quản trị hệ thống.</p>
                <label className="ca-field"><span>Tên đăng nhập</span><input value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" autoFocus placeholder="hieutruong" /></label>
                <label className="ca-field"><span>Mật khẩu</span><input type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" /></label>
                {err && <p className="ca-ferr">{err}</p>}
                <Btn tone="primary" busy={busy} type="submit">Đăng nhập</Btn>
                <button type="button" className="ca-link" onClick={() => { clearSession(); window.location.href = '/login'; }}>← Về trang đăng nhập chung</button>
            </form>
        </div>
    );
}