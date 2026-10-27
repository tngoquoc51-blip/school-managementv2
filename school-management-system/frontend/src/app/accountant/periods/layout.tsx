'use client';
import { FormEvent, ReactNode, useCallback, useEffect, useState } from 'react';
import { api, clearSession, getStaff, getToken, saveSession, Staff } from './_lib/api';
import { StaffCtx } from './_components/ui';
import './periods.css';

/**
 * Khung chung của các trang Đợt thu. Nằm trong khung menu kế toán sẵn có của dự án.
 * Dùng tài khoản nhân viên (vai trò Kế toán / Ban giám hiệu) – nếu chưa đăng nhập thì hiện form đăng nhập ngay tại đây.
 */
export default function PeriodsLayout({ children }: { children: ReactNode }) {
    const [staff, setStaff] = useState<Staff | null>(null);
    const [ready, setReady] = useState(false);

    const logout = useCallback(async () => {
        try { await api('logout', { method: 'POST' }); } catch { /* bỏ qua */ }
        clearSession(); setStaff(null);
    }, []);

    useEffect(() => {
        const s = getStaff();
        if (getToken() && s) {
            setStaff(s);
            api<Staff>('me').then((m) => setStaff(m)).catch(() => {});
        }
        setReady(true);
        const off = () => setStaff(null);
        window.addEventListener('kt-unauth', off);
        return () => window.removeEventListener('kt-unauth', off);
    }, []);

    if (!ready) return <div className="pd"><div className="pd-loading"><i className="pd-spin" />Đang kiểm tra phiên đăng nhập…</div></div>;
    if (!staff) return <div className="pd"><Login onDone={setStaff} /></div>;

    return (
        <StaffCtx.Provider value={{ staff, logout }}>
            <div className="pd">
                <div className="pd-who">
                    <span><i aria-hidden>●</i> Đang đăng nhập: <b>{staff.name}</b> · {staff.role_label}</span>
                    <button className="pd-link" onClick={logout}>Đăng xuất</button>
                </div>
                {children}
            </div>
        </StaffCtx.Provider>
    );
}

function Login({ onDone }: { onDone: (s: Staff) => void }) {
    const [u, setU] = useState('');
    const [p, setP] = useState('');
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (!u.trim() || !p) { setErr('Vui lòng nhập tên đăng nhập và mật khẩu.'); return; }
        setBusy(true); setErr('');
        try {
            const r = await api<{ token: string; staff: Staff }>('login', { method: 'POST', body: { username: u.trim(), password: p }, auth: false });
            saveSession(r.token, r.staff); onDone(r.staff);
        } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
    };
    return (
        <div className="pd-login">
            <form onSubmit={submit} noValidate>
                <span className="pd-login-ico" aria-hidden>₫</span>
                <h1>Đăng nhập Kế toán</h1>
                <p>Dùng tài khoản nhân viên của phòng Kế toán hoặc Ban giám hiệu để quản lý đợt thu.</p>
                <div className="pd-field"><label htmlFor="kt-u">Tên đăng nhập hoặc email</label><input id="kt-u" className="pd-in" autoComplete="username" value={u} onChange={(e) => setU(e.target.value)} placeholder="ví dụ: ketoan@thpt.edu.vn" autoFocus /></div>
                <div className="pd-field"><label htmlFor="kt-p">Mật khẩu</label><input id="kt-p" className="pd-in" type="password" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} /></div>
                {err && <div className="pd-alert err" role="alert">{err}</div>}
                <button className="pd-btn" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
            </form>
        </div>
    );
}