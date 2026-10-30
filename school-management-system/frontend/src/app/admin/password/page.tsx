'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { adminProfile as API } from '@/services/adminProfile';
import './password.css';

type ToastT = { id: number; type: 'success' | 'error' | 'info'; text: string };

const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString('vi-VN') : '—');

const errMsg = (e: any) => {
    const er = e?.response?.data?.errors ?? e?.data?.errors;
    const first = er && (Object.values(er)[0] as string[])[0];
    return first || e?.response?.data?.message || e?.data?.message || e?.message || 'Có lỗi xảy ra.';
};

function strength(p: string): { label: string; score: number; pct: number; checks: boolean[] } {
    const checks = [/.{8,}/.test(p), /[a-z]/.test(p), /[A-Z]/.test(p), /\d/.test(p), /[^A-Za-z0-9]/.test(p)];
    const score = p ? checks.filter(Boolean).length || 1 : 0;
    const labels = ['', 'Rất yếu', 'Yếu', 'Trung bình', 'Khá mạnh', 'Mạnh'];
    return { label: labels[score], score, pct: score * 20, checks };
}

function Icon({ name }: { name: string }) {
    const paths: Record<string, JSX.Element> = {
        lock: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
        shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></>,
        device: <><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" /></>,
        check: <><path d="M20 6 9 17l-5-5" /></>,
        alert: <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></>,
        eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
        eyeOff: <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><path d="M1 1l22 22" /></>,
        mail: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><path d="m22 6-10 7L2 6" /></>,
        user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
        arrow: <><path d="M19 12H5M12 19l-7-7 7-7" /></>,
    };
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {paths[name]}
        </svg>
    );
}

export default function AdminPasswordPage() {
    const [pw, setPw] = useState({ current_password: '', password: '', password_confirmation: '' });
    const [em, setEm] = useState({ email: '', current_password: '' });
    const [show, setShow] = useState({ cur: false, neu: false, conf: false });
    const [sessions, setSessions] = useState<any[]>([]);
    const [userEmail, setUserEmail] = useState('');
    const [busy, setBusy] = useState('');
    const [toasts, setToasts] = useState<ToastT[]>([]);
    const [loaded, setLoaded] = useState(false);

    const toast = useCallback((type: ToastT['type'], text: string) => {
        const id = Date.now() + Math.random();
        setToasts((t) => [...t, { id, type, text }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
    }, []);

    const run = async (key: string, fn: () => Promise<any>, ok: string | ((r: any) => string)) => {
        setBusy(key);
        try {
            const r = await fn();
            toast('success', typeof ok === 'function' ? ok(r) : ok);
            return r;
        } catch (e) {
            toast('error', errMsg(e));
        } finally {
            setBusy('');
        }
    };

    const loadSessions = useCallback(() => {
        API.sessions()
            .then((r) => setSessions(r.data || r || []))
            .catch(() => setSessions([]));
    }, []);

    useEffect(() => {
        API.get()
            .then((r) => {
                setUserEmail(r?.user?.email || '');
            })
            .catch(() => {})
            .finally(() => setLoaded(true));
        loadSessions();
    }, [loadSessions]);

    const st = strength(pw.password);
    const match = pw.password.length > 0 && pw.password === pw.password_confirmation;
    const canSubmit =
        pw.current_password.length > 0 &&
        st.score >= 3 &&
        match &&
        busy !== 'pw';

    const savePw = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;
        const r = await run('pw', () => API.password(pw), (x) => x?.message || 'Đã đổi mật khẩu thành công.');
        if (r) {
            setPw({ current_password: '', password: '', password_confirmation: '' });
            loadSessions();
        }
    };

    const saveEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        const r = await run('email', () => API.email(em), (x) => x?.message || 'Đã đổi email.');
        if (r) {
            setUserEmail(r.email || em.email);
            setEm({ email: '', current_password: '' });
        }
    };

    const checkLabels = [
        'Ít nhất 8 ký tự',
        'Có chữ thường (a–z)',
        'Có chữ hoa (A–Z)',
        'Có chữ số (0–9)',
        'Có ký tự đặc biệt (!@#…)',
    ];

    return (
        <div className="apw">
            <div className="apw-toasts" aria-live="polite">
                {toasts.map((t) => (
                    <div key={t.id} className={`apw-toast ${t.type}`}>
                        <p>{t.text}</p>
                        <button type="button" aria-label="Đóng" onClick={() => setToasts((x) => x.filter((i) => i.id !== t.id))}>✕</button>
                    </div>
                ))}
            </div>

            {/* Header */}
            <header className="apw-head">
                <div>
                    <p className="apw-crumb">
                        <Link href="/admin/profile">Hồ sơ cá nhân</Link>
                        <span>/</span>
                        Bảo mật
                    </p>
                    <h1>Đổi mật khẩu & bảo mật</h1>
                    <p className="apw-sub">
                        Quản lý mật khẩu đăng nhập, email và các phiên thiết bị đang hoạt động trên hệ thống quản trị nhà trường.
                    </p>
                </div>
                <div className="apw-head-badge">
                    <Icon name="shield" />
                    <div>
                        <b>Tài khoản quản trị</b>
                        <span>{userEmail || (loaded ? '—' : 'Đang tải…')}</span>
                    </div>
                </div>
            </header>

            <div className="apw-grid">
                {/* Cột chính */}
                <div className="apw-main">
                    {/* Đổi mật khẩu */}
                    <section className="apw-card">
                        <div className="apw-card-head">
                            <span className="apw-ico"><Icon name="lock" /></span>
                            <div>
                                <h2>Đổi mật khẩu</h2>
                                <p>Sau khi đổi, các thiết bị khác sẽ bị đăng xuất (trừ phiên hiện tại, tùy cấu hình máy chủ).</p>
                            </div>
                        </div>

                        <form onSubmit={savePw} className="apw-form" autoComplete="off">
                            <label className="apw-field">
                                <span>Mật khẩu hiện tại</span>
                                <div className="apw-input-wrap">
                                    <input
                                        type={show.cur ? 'text' : 'password'}
                                        autoComplete="current-password"
                                        value={pw.current_password}
                                        onChange={(e) => setPw({ ...pw, current_password: e.target.value })}
                                        required
                                        placeholder="Nhập mật khẩu đang dùng"
                                    />
                                    <button type="button" className="apw-eye" onClick={() => setShow({ ...show, cur: !show.cur })} aria-label="Hiện/ẩn">
                                        <Icon name={show.cur ? 'eyeOff' : 'eye'} />
                                    </button>
                                </div>
                            </label>

                            <label className="apw-field">
                                <span>Mật khẩu mới</span>
                                <div className="apw-input-wrap">
                                    <input
                                        type={show.neu ? 'text' : 'password'}
                                        autoComplete="new-password"
                                        value={pw.password}
                                        onChange={(e) => setPw({ ...pw, password: e.target.value })}
                                        required
                                        placeholder="Tối thiểu 8 ký tự"
                                    />
                                    <button type="button" className="apw-eye" onClick={() => setShow({ ...show, neu: !show.neu })} aria-label="Hiện/ẩn">
                                        <Icon name={show.neu ? 'eyeOff' : 'eye'} />
                                    </button>
                                </div>
                                <div className="apw-meter">
                                    <i className={`s${st.score}`} style={{ width: `${st.pct}%` }} />
                                </div>
                                <small className="apw-hint">{st.label || 'Nhập mật khẩu để xem độ mạnh'}</small>
                            </label>

                            <label className="apw-field">
                                <span>Nhập lại mật khẩu mới</span>
                                <div className="apw-input-wrap">
                                    <input
                                        type={show.conf ? 'text' : 'password'}
                                        autoComplete="new-password"
                                        value={pw.password_confirmation}
                                        onChange={(e) => setPw({ ...pw, password_confirmation: e.target.value })}
                                        required
                                        placeholder="Nhập lại mật khẩu mới"
                                    />
                                    <button type="button" className="apw-eye" onClick={() => setShow({ ...show, conf: !show.conf })} aria-label="Hiện/ẩn">
                                        <Icon name={show.conf ? 'eyeOff' : 'eye'} />
                                    </button>
                                </div>
                                {pw.password_confirmation.length > 0 && (
                                    <small className={match ? 'apw-ok' : 'apw-bad'}>
                                        {match ? 'Hai mật khẩu khớp nhau' : 'Hai mật khẩu chưa khớp'}
                                    </small>
                                )}
                            </label>

                            <ul className="apw-checks">
                                {checkLabels.map((label, i) => (
                                    <li key={label} className={st.checks[i] ? 'on' : ''}>
                                        <Icon name="check" />
                                        {label}
                                    </li>
                                ))}
                            </ul>

                            <div className="apw-actions">
                                <button type="submit" className="apw-btn" disabled={!canSubmit}>
                                    {busy === 'pw' ? 'Đang đổi…' : 'Đổi mật khẩu'}
                                </button>
                                <Link href="/admin/profile" className="apw-btn ghost">
                                    Về hồ sơ
                                </Link>
                            </div>
                        </form>
                    </section>

                    {/* Đổi email */}
                    <section className="apw-card">
                        <div className="apw-card-head">
                            <span className="apw-ico teal"><Icon name="mail" /></span>
                            <div>
                                <h2>Đổi email đăng nhập</h2>
                                <p>
                                    Email hiện tại: <strong>{userEmail || '—'}</strong>. Cần nhập mật khẩu để xác nhận.
                                </p>
                            </div>
                        </div>
                        <form onSubmit={saveEmail} className="apw-form">
                            <div className="apw-row2">
                                <label className="apw-field">
                                    <span>Email mới</span>
                                    <input
                                        type="email"
                                        value={em.email}
                                        onChange={(e) => setEm({ ...em, email: e.target.value })}
                                        required
                                        placeholder="admin-moi@thpt.edu.vn"
                                    />
                                </label>
                                <label className="apw-field">
                                    <span>Mật khẩu hiện tại</span>
                                    <input
                                        type="password"
                                        autoComplete="current-password"
                                        value={em.current_password}
                                        onChange={(e) => setEm({ ...em, current_password: e.target.value })}
                                        required
                                        placeholder="Xác nhận bằng mật khẩu"
                                    />
                                </label>
                            </div>
                            <button type="submit" className="apw-btn" disabled={busy === 'email'}>
                                {busy === 'email' ? 'Đang đổi…' : 'Đổi email'}
                            </button>
                        </form>
                    </section>

                    {/* Phiên đăng nhập */}
                    <section className="apw-card">
                        <div className="apw-card-head between">
                            <div className="apw-card-head-left">
                                <span className="apw-ico amber"><Icon name="device" /></span>
                                <div>
                                    <h2>Thiết bị & phiên đăng nhập</h2>
                                    <p>Thu hồi phiên bạn không nhận ra để bảo vệ tài khoản quản trị.</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="apw-btn line"
                                disabled={busy === 'rev' || sessions.length < 2}
                                onClick={() =>
                                    confirm('Đăng xuất tất cả thiết bị khác?') &&
                                    run('rev', API.revokeOthers, (r) => r?.message || 'Đã thu hồi các phiên khác.').then(loadSessions)
                                }
                            >
                                Đăng xuất thiết bị khác
                            </button>
                        </div>

                        <ul className="apw-sessions">
                            {sessions.map((s) => (
                                <li key={s.id}>
                                    <span className="apw-sess-ico"><Icon name="device" /></span>
                                    <div className="grow">
                                        <p className="t">
                                            Phiên #{s.id}
                                            {s.current && <em className="apw-tag">Thiết bị này</em>}
                                        </p>
                                        <p className="m">
                                            Đăng nhập: {fmt(s.created_at)} · Gần nhất: {fmt(s.last_used_at)}
                                            {s.ip ? ` · IP ${s.ip}` : ''}
                                        </p>
                                    </div>
                                    {!s.current && (
                                        <button
                                            type="button"
                                            className="apw-link danger"
                                            onClick={() =>
                                                run('r' + s.id, () => API.revoke(s.id), (r) => r?.message || 'Đã thu hồi phiên.').then(loadSessions)
                                            }
                                        >
                                            Thu hồi
                                        </button>
                                    )}
                                </li>
                            ))}
                            {!sessions.length && (
                                <li className="apw-empty">Chưa có dữ liệu phiên. Đăng nhập lại nếu danh sách trống.</li>
                            )}
                        </ul>
                    </section>
                </div>

                {/* Sidebar gợi ý */}
                <aside className="apw-side">
                    <div className="apw-side-card">
                        <div className="apw-side-icon"><Icon name="shield" /></div>
                        <h3>Quy tắc mật khẩu nhà trường</h3>
                        <ul>
                            <li>Không dùng mật khẩu trùng email / tên đăng nhập</li>
                            <li>Không chia sẻ mật khẩu quản trị cho người khác</li>
                            <li>Đổi mật khẩu định kỳ mỗi học kỳ</li>
                            <li>Thu hồi ngay thiết bị lạ trong danh sách phiên</li>
                        </ul>
                    </div>

                    <div className="apw-side-card warn">
                        <div className="apw-side-icon warn"><Icon name="alert" /></div>
                        <h3>Lưu ý bảo mật</h3>
                        <p>
                            Tài khoản <strong>Super Admin</strong> có toàn quyền hệ thống. Mọi thao tác đổi mật khẩu và thu hồi phiên đều được ghi nhật ký.
                        </p>
                    </div>

                    <div className="apw-side-links">
                        <Link href="/admin/profile">
                            <Icon name="user" /> Hồ sơ cá nhân
                        </Link>
                        <Link href="/admin/profile">
                            <Icon name="device" /> Nhật ký hoạt động (trong hồ sơ)
                        </Link>
                    </div>
                </aside>
            </div>
        </div>
    );
}