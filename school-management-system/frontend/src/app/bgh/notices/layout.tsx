'use client';

import './notices.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ALLOWED_ROLES, Avatar, Btn, Ico, Meta, NtContext, Staff, clearSession, getSession, login, nt, saveSession } from './_nt';

const NAV = [
    { href: '/bgh/notices', label: 'Tổng quan', icon: 'home' },
    { href: '/bgh/notices/soan', label: 'Soạn thông báo', icon: 'pen' },
    { href: '/bgh/notices/danh-sach', label: 'Danh sách', icon: 'list' },
    { href: '/bgh/notices/phe-duyet', label: 'Phê duyệt', icon: 'checks', badge: true },
    { href: '/bgh/notices/thong-ke', label: 'Thống kê', icon: 'stats' },
    { href: '/bgh/notices/mau', label: 'Mẫu thông báo', icon: 'tpl' },
    { href: '/bgh/notices/cai-dat', label: 'Cài đặt', icon: 'cog' },
];

export default function NoticesLayout({ children }: { children: React.ReactNode }) {
    const path = usePathname() || '';
    const [ready, setReady] = useState(false);
    const [staff, setStaff] = useState<Staff | null>(null);
    const [meta, setMeta] = useState<Meta | null>(null);
    const [badge, setBadge] = useState(0);
    const [version, setVersion] = useState(0);
    const [toastMsg, setToastMsg] = useState<{ m: string; k: 'ok' | 'err' } | null>(null);
    const tt = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setStaff(getSession()?.staff ?? null);
        setReady(true);
        const f = () => setStaff(null);
        window.addEventListener('nt-auth', f);
        return () => window.removeEventListener('nt-auth', f);
    }, []);

    const toast = useCallback((m: string, k: 'ok' | 'err' = 'ok') => {
        setToastMsg({ m, k });
        if (tt.current) clearTimeout(tt.current);
        tt.current = setTimeout(() => setToastMsg(null), 3800);
    }, []);
    const refresh = useCallback(() => setVersion((v) => v + 1), []);

    const loadBadge = useCallback(() => {
        nt<unknown[]>('?status=pending&per=5').then((r) => setBadge(r.counts?.pending ?? 0)).catch(() => { /* bỏ qua */ });
    }, []);
    useEffect(() => {
        if (!staff) return;
        nt<unknown>('meta').then((r) => setMeta(r.data as Meta)).catch(() => { /* trang con sẽ báo lỗi */ });
    }, [staff]);
    useEffect(() => {
        if (!staff) return;
        loadBadge();
        const id = setInterval(loadBadge, 60000);
        return () => clearInterval(id);
    }, [staff, loadBadge, version]);

    if (!ready) return <div className="nt nt-boot"><div className="nt-spin" /></div>;
    if (!staff) return <div className="nt"><Gate onDone={(s) => setStaff(s)} /></div>;

    const canApprove = ['super_admin', 'principal'].includes(staff.role);
    const isActive = (h: string) => (h === '/bgh/notices' ? path === h : path.startsWith(h));

    return (
        <NtContext.Provider value={{ staff, canApprove, meta, toast, refresh, version }}>
            <div className="nt">
                <div className="nt-hero">
                    <div className="nt-hero-in">
                        <div className="nt-hero-ic"><Ico n="mega" size={26} /></div>
                        <div className="nt-hero-tx">
                            <h1>Thông báo nhà trường</h1>
                            <p>Soạn, duyệt và gửi thông báo tới giáo viên, học sinh, phụ huynh · theo dõi ai đã đọc</p>
                        </div>
                        <div className="nt-hero-r">
                            <span className="nt-who"><Avatar name={staff.name} tone="violet" /><span><b>{staff.name}</b><small>{staff.role_label}</small></span></span>
                            <Link href="/bgh/notices/soan" className="nt-btn primary hero"><Ico n="plus" size={16} />Soạn thông báo</Link>
                        </div>
                    </div>
                    <nav className="nt-nav" aria-label="Thông báo">
                        {NAV.map((n) => (
                            <Link key={n.href} href={n.href} className={isActive(n.href) ? 'on' : ''}>
                                <Ico n={n.icon} size={16} />{n.label}
                                {n.badge && badge > 0 && <em>{badge}</em>}
                            </Link>
                        ))}
                    </nav>
                </div>
                <main className="nt-main">{children}</main>
                {toastMsg && <div className={`nt-toast ${toastMsg.k}`} role="status"><Ico n={toastMsg.k === 'ok' ? 'check' : 'alert'} size={18} />{toastMsg.m}</div>}
            </div>
        </NtContext.Provider>
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
            if (!ALLOWED_ROLES.includes(d.staff.role)) { setErr('Tài khoản này không thuộc Ban Giám hiệu nên không vào được phần Thông báo.'); setBusy(false); return; }
            saveSession(d.token, d.staff); onDone(d.staff);
        } catch (e2) { setErr((e2 as Error).message); setBusy(false); }
    };
    return (
        <div className="nt-gate">
            <form className="nt-gate-c" onSubmit={submit}>
                <div className="nt-gate-ic"><Ico n="lock" size={26} /></div>
                <h2>Đăng nhập Ban Giám hiệu</h2>
                <p>Phần Thông báo dành cho Hiệu trưởng, Phó hiệu trưởng và Quản trị hệ thống.</p>
                <label className="nt-field"><span>Tên đăng nhập</span><input value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" autoFocus placeholder="hieutruong" /></label>
                <label className="nt-field"><span>Mật khẩu</span><input type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" /></label>
                {err && <p className="nt-ferr">{err}</p>}
                <Btn tone="primary" busy={busy} type="submit">Đăng nhập</Btn>
                <button type="button" className="nt-link" onClick={() => { clearSession(); window.location.href = '/login'; }}>← Về trang đăng nhập chung</button>
            </form>
        </div>
    );
}