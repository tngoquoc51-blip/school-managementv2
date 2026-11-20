'use client';

import { createContext, FormEvent, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { errMsg, get, getToken, http, send, setToken } from './api';
import type { Meta, Staff } from './types';
import { Icon, Spinner } from './ui';
import { useToast } from './Toast';

interface Sess {
    user: Staff;
    meta: Meta;
    canWrite: boolean;
    logout: () => void;
}

const Ctx = createContext<Sess | null>(null);

export function useSession(): Sess {
    const c = useContext(Ctx);
    if (!c) throw new Error('useSession phải nằm trong SessionProvider');
    return c;
}

/** Bảo vệ khu vực kế toán: cần đăng nhập bằng tài khoản nhân sự (bảng sm_staff_accounts). */
export function SessionProvider({ children }: { children: ReactNode }) {
    const toast = useToast();
    const [state, setState] = useState<'loading' | 'out' | 'in'>('loading');
    const [user, setUser] = useState<Staff | null>(null);
    const [meta, setMeta] = useState<Meta | null>(null);
    const [fatal, setFatal] = useState('');

    const boot = useCallback(async () => {
        setFatal('');
        try {
            if (!getToken()) {
                const shared =
                    localStorage.getItem('accountant_token') ||
                    localStorage.getItem('kt_token') ||
                    localStorage.getItem('token') ||
                    localStorage.getItem('staff_token');
                if (shared) setToken(shared);
            }
            const u = await get<Staff>('/auth/me');
            const m = await get<Meta>('/meta');
            setUser(u);
            setMeta(m);
            setState('in');
        } catch (e) {
            const status = (e as { response?: { status?: number } })?.response?.status;
            if (status === 401 || !getToken()) {
                setState('out');
            } else {
                setFatal(errMsg(e));
                setState('out');
            }
        }
    }, []);

    useEffect(() => {
        boot();
        const h = () => {
            setState('out');
            toast.warn('Phiên đăng nhập đã hết hạn', 'Vui lòng đăng nhập lại.');
        };
        window.addEventListener('fx:unauth', h);
        return () => window.removeEventListener('fx:unauth', h);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const logout = useCallback(async () => {
        try {
            await http.post('/auth/logout');
        } catch {
            /* bỏ qua */
        }
        setToken(null);
        setUser(null);
        setMeta(null);
        setState('out');
    }, []);

    if (state === 'loading') {
        return (
            <div className="fx-login">
                <div style={{ color: '#fff' }}>
                    <Spinner /> &nbsp;Đang tải hệ thống…
                </div>
            </div>
        );
    }

    // Không có phiên kế toán hợp lệ → hiện form login trong module
    if (state === 'out' || !user || !meta) {
        return <Login onDone={boot} fatal={fatal} />;
    }

    return (
        <Ctx.Provider value={{ user, meta, canWrite: !!user.can_write, logout }}>
            {children}
        </Ctx.Provider>
    );
}

function Login({ onDone, fatal }: { onDone: () => void; fatal: string }) {
    const toast = useToast();
    const [u, setU] = useState('');
    const [p, setP] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState(fatal);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setErr('');
        try {
            const r = await send<{ token: string; user: Staff }>('post', '/auth/login', {
                username: u,
                password: p,
            });
            setToken(r.data.token);
            try {
                localStorage.setItem('accountant_token', r.data.token);
                localStorage.setItem('kt_token', r.data.token);
            } catch {
                /* bỏ qua */
            }
            toast.success(`Xin chào ${r.data.user.full_name}`, 'Đăng nhập thành công.');
            onDone();
        } catch (ex) {
            setErr(errMsg(ex));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fx-login">
            <form className="fx-card" onSubmit={submit}>
                <div className="fx-row">
                    <div className="fx-logo" style={{ width: 48, height: 48 }}>
                        <Icon name="wallet" size={24} />
                    </div>
                    <div>
                        <div className="fx-h2">Phòng Kế toán</div>
                        <div className="fx-muted fx-small">Đăng nhập để quản lý tài chính học sinh</div>
                    </div>
                </div>
                {err && (
                    <div className="fx-alert bad">
                        <Icon name="alert" />
                        <div className="grow">{err}</div>
                    </div>
                )}
                <div className="fx-field">
                    <label>Tài khoản</label>
                    <input
                        className="fx-in"
                        autoFocus
                        value={u}
                        onChange={(e) => setU(e.target.value)}
                        placeholder="ví dụ: ketoan"
                        autoComplete="username"
                        required
                    />
                </div>
                <div className="fx-field">
                    <label>Mật khẩu</label>
                    <input
                        className="fx-in"
                        type="password"
                        value={p}
                        onChange={(e) => setP(e.target.value)}
                        autoComplete="current-password"
                        required
                    />
                </div>
                <button
                    className="fx-btn pri"
                    style={{ justifyContent: 'center', height: 46 }}
                    disabled={busy}
                    type="submit"
                >
                    {busy ? <Spinner /> : <Icon name="shield" />} Đăng nhập
                </button>
            </form>
        </div>
    );
}