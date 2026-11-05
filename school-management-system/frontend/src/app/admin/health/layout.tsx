'use client';

import './health.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, Ctx, MonCtx, Staff, clearSession, getToken, getUser, hm, login, logoutServer, mon, saveSession } from './_hl';

const NAV = [
    { href: '/admin/health', label: 'Tổng quan', icon: 'M3 12l9-8 9 8M5 10v10h14V10' },
    { href: '/admin/health/dich-vu', label: 'Dịch vụ', icon: 'M5 12h14M12 5v14M4 4h6v6H4zM14 14h6v6h-6z' },
    { href: '/admin/health/nhat-ky', label: 'Nhật ký', icon: 'M6 3h9l4 4v14H6zM9 12h7M9 16h7M9 8h3' },
    { href: '/admin/health/hieu-nang', label: 'Hiệu năng', icon: 'M3 17l5-6 4 3 6-8M3 21h18' },
    { href: '/admin/health/co-so-du-lieu', label: 'Cơ sở dữ liệu', icon: 'M4 6c0-2 16-2 16 0s-16 2-16 0v12c0 2 16 2 16 0V6M4 12c0 2 16 2 16 0' },
    { href: '/admin/health/phien-bao-mat', label: 'Phiên & bảo mật', icon: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4' },
    { href: '/admin/health/canh-bao', label: 'Cảnh báo', icon: 'M12 4l9 16H3zM12 10v4M12 17v1', badge: true },
    { href: '/admin/health/thong-bao', label: 'Thông báo', icon: 'M4 10v4h3l6 4V6L7 10zM17 9a4 4 0 010 6' },
    { href: '/admin/health/cai-dat', label: 'Cài đặt', icon: 'M12 8a4 4 0 100 8 4 4 0 000-8zM4 12h2M18 12h2M12 4v2M12 18v2' },
];

export default function HealthLayout({ children }: { children: React.ReactNode }) {
    const path = usePathname() || '';
    const [ready, setReady] = useState(false);
    const [staff, setStaff] = useState<Staff | null>(null);
    const [updated, setUpdated] = useState<Date | null>(null);
    const [badge, setBadge] = useState(0);
    const [toastMsg, setToastMsg] = useState<{ m: string; k: 'ok' | 'err' } | null>(null);
    const tt = useRef<any>(null);

    useEffect(() => {
        setStaff(getToken() ? getUser() : null);
        setReady(true);
        const f = () => setStaff(null);
        window.addEventListener('mon-auth', f);
        return () => window.removeEventListener('mon-auth', f);
    }, []);

    const toast = useCallback((m: string, k: 'ok' | 'err' = 'ok') => {
        setToastMsg({ m, k });
        clearTimeout(tt.current);
        tt.current = setTimeout(() => setToastMsg(null), 3600);
    }, []);

    const refreshBadge = useCallback(() => {
        mon<any>('alerts?status=active').then((d) => setBadge((d.counts?.open ?? 0))).catch(() => {});
    }, []);
    useEffect(() => {
        if (!staff) return;
        refreshBadge();
        const id = setInterval(refreshBadge, 60000);
        return () => clearInterval(id);
    }, [staff, refreshBadge]);

    if (!ready) return <div className="hl hl-boot"><div className="hl-spin" /></div>;
    if (!staff) return <div className="hl"><Gate onDone={(s) => setStaff(s)} /></div>;

    const roleOk = ['super_admin', 'principal', 'vice_principal'].includes(staff.role);
    if (!roleOk) {
        return (
            <div className="hl"><div className="hl-gate"><div className="hl-gate-c">
                <div className="hl-gate-ic bad">!</div><h2>Không đủ quyền</h2>
                <p>Tài khoản <b>{staff.name}</b> ({staff.role_label}) không được xem khu Giám sát hệ thống.</p>
                <button className="hl-btn primary" onClick={() => { clearSession(); setStaff(null); }}>Dùng tài khoản khác</button>
            </div></div></div>
        );
    }

    const ctx: Ctx = { staff, canWrite: staff.role === 'super_admin', toast, refreshBadge, setUpdated };
    const active = (h: string) => (h === '/admin/health' ? path === h : path.startsWith(h));

    return (
        <MonCtx.Provider value={ctx}>
            <div className="hl">
                <header className="hl-top">
                    <div className="hl-brand">
                        <span className="hl-logo"><svg viewBox="0 0 24 24"><path d="M3 12h4l3-8 4 16 3-8h4" /></svg></span>
                        <div><h1>Giám sát hệ thống</h1><p>Sức khỏe, bảo mật và vận hành của toàn hệ thống</p></div>
                    </div>
                    <div className="hl-top-r">
                        <span className="hl-live"><i />{updated ? `Cập nhật ${hm(updated)}` : 'Đang tải…'}</span>
                        <span className="hl-who" title={staff.role_label}><b>{staff.name.charAt(0)}</b>{staff.name}<small>{ctx.canWrite ? 'Quản trị' : 'Chỉ xem'}</small></span>
                        <button className="hl-btn ghost" onClick={() => { logoutServer(); clearSession(); setStaff(null); }}>Khóa phiên</button>
                    </div>
                </header>
                <nav className="hl-nav" aria-label="Chức năng giám sát">
                    {NAV.map((n) => (
                        <Link key={n.href} href={n.href} className={active(n.href) ? 'on' : ''}>
                            <svg viewBox="0 0 24 24"><path d={n.icon} /></svg>{n.label}
                            {n.badge && badge > 0 && <i className="hl-bd">{badge}</i>}
                        </Link>
                    ))}
                </nav>
                <main className="hl-main">{children}</main>
                {toastMsg && <div className={`hl-toast ${toastMsg.k}`} role="status">{toastMsg.k === 'ok' ? '✓' : '!'} {toastMsg.m}</div>}
            </div>
        </MonCtx.Provider>
    );
}

function Gate({ onDone }: { onDone: (s: Staff) => void }) {
    const [u, setU] = useState('');
    const [p, setP] = useState('');
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!u.trim() || !p) { setErr('Nhập tên đăng nhập và mật khẩu.'); return; }
        setBusy(true); setErr('');
        try {
            const r = await login(u.trim(), p);
            if (r.staff.role !== 'super_admin' && !['principal', 'vice_principal'].includes(r.staff.role)) {
                setErr('Tài khoản này không có quyền vào khu Giám sát. Hãy dùng tài khoản Quản trị hệ thống.'); setBusy(false); return;
            }
            saveSession(r.token, r.staff);
            onDone(r.staff);
        } catch (ex: any) { setErr(ex instanceof ApiError ? ex.message : 'Không đăng nhập được.'); setBusy(false); }
    };
    return (
        <div className="hl-gate">
            <form className="hl-gate-c" onSubmit={submit}>
                <div className="hl-gate-ic"><svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></svg></div>
                <h2>Xác thực quản trị</h2>
                <p>Khu giám sát chứa dữ liệu vận hành và bảo mật nên cần đăng nhập bằng tài khoản <b>Quản trị hệ thống</b> (hoặc Ban giám hiệu để xem).</p>
                <label className="hl-field"><span>Tên đăng nhập</span><input value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" autoFocus /></label>
                <label className="hl-field"><span>Mật khẩu</span><input type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" /></label>
                {err && <div className="hl-form-err" role="alert">{err}</div>}
                <button className="hl-btn primary lg" disabled={busy}>{busy ? 'Đang xác thực…' : 'Vào khu giám sát'}</button>
            </form>
        </div>
    );
}