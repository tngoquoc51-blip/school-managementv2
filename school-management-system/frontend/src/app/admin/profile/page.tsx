'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { adminProfile as API } from '@/services/adminProfile';
import './profile.css';

type ToastT = { id: number; type: 'success' | 'error' | 'info'; text: string };

const TABS = [
    { key: 'info', label: 'Thông tin', icon: 'user' },
    { key: 'security', label: 'Bảo mật', icon: 'lock' },
    { key: 'sessions', label: 'Thiết bị', icon: 'device' },
    { key: 'activity', label: 'Nhật ký', icon: 'clock' },
    { key: 'notices', label: 'Hộp thư', icon: 'bell' },
    { key: 'prefs', label: 'Tuỳ chọn', icon: 'sliders' },
] as const;

const ROLE: Record<string, string> = {
    super_admin: 'Quản trị hệ thống',
    admin: 'Quản trị',
    principal: 'Hiệu trưởng',
    vice_principal: 'Phó hiệu trưởng',
    academic: 'Giáo vụ',
    accountant: 'Kế toán',
    teacher: 'Giáo viên',
};

const EMPTY = {
    name: '', phone: '', gender: '', date_of_birth: '',
    address: '', position: '', department: '', bio: '',
};

const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString('vi-VN') : 'Chưa có');
const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString('vi-VN') : '—');

const errMsg = (e: any) => {
    const er = e?.response?.data?.errors ?? e?.data?.errors;
    const first = er && (Object.values(er)[0] as string[])[0];
    return first || e?.response?.data?.message || e?.data?.message || e?.message || 'Có lỗi xảy ra, vui lòng thử lại.';
};
const code = (e: any) => e?.response?.status ?? e?.status;

function Icon({ name }: { name: string }) {
    const p: Record<string, JSX.Element> = {
        user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
        lock: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
        device: <><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" /></>,
        clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
        bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>,
        sliders: <><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></>,
        mail: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><path d="m22 6-10 7L2 6" /></>,
        map: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>,
        brief: <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></>,
        check: <><path d="M20 6 9 17l-5-5" /></>,
        shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></>,
    };
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {p[name] || p.user}
        </svg>
    );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <label className="pf-field">
            <span>{label}</span>
            {children}
            {hint && <small>{hint}</small>}
        </label>
    );
}

function Toggle({ on, set, title, desc }: { on: boolean; set: (v: boolean) => void; title: string; desc: string }) {
    return (
        <div className="pf-sw">
            <div>
                <b>{title}</b>
                <span>{desc}</span>
            </div>
            <button type="button" role="switch" aria-checked={on} className="pf-tg" onClick={() => set(!on)}>
                <i />
            </button>
        </div>
    );
}

function strength(p: string): [string, number, number] {
    const n = [/.{8,}/, /[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length;
    const i = p ? n || 1 : 0;
    return [['', 'Rất yếu', 'Yếu', 'Trung bình', 'Khá mạnh', 'Mạnh'][i], i, i * 20];
}

export default function AdminProfilePage() {
    const [tab, setTab] = useState<(typeof TABS)[number]['key']>('info');
    const [user, setUser] = useState<any>(null);
    const [form, setForm] = useState<any>(EMPTY);
    const [prefs, setPrefs] = useState({ notify_login: true, notify_system: true, notify_email: false });
    const [avatar, setAvatar] = useState<string | null>(null);
    const [busy, setBusy] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadErr, setLoadErr] = useState('');
    const [toasts, setToasts] = useState<ToastT[]>([]);
    const [pw, setPw] = useState({ current_password: '', password: '', password_confirmation: '' });
    const [em, setEm] = useState({ email: '', current_password: '' });
    const [sessions, setSessions] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [notices, setNotices] = useState<any[]>([]);
    const [unread, setUnread] = useState(0);
    const fileRef = useRef<HTMLInputElement>(null);

    const toast = useCallback((type: ToastT['type'], text: string) => {
        const id = Date.now() + Math.random();
        setToasts((t) => [...t, { id, type, text }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
    }, []);

    const loadNotices = useCallback(
        () => API.notices().then((r) => { setNotices(r.data || []); setUnread(r.unread || 0); }).catch(() => {}),
        [],
    );

    const apply = (res: any) => {
        if (!res?.user || !res?.profile) {
            throw new Error('Máy chủ trả về dữ liệu không đúng định dạng: ' + JSON.stringify(res)?.slice(0, 120));
        }
        const { user: u, profile: p } = res;
        setUser(u);
        setAvatar(p.avatar_url);
        setForm({
            name: u.name || '',
            phone: u.phone || '',
            gender: p.gender || '',
            date_of_birth: p.date_of_birth || '',
            address: p.address || '',
            position: p.position || '',
            department: p.department || '',
            bio: p.bio || '',
        });
        setPrefs({
            notify_login: !!p.notify_login,
            notify_system: !!p.notify_system,
            notify_email: !!p.notify_email,
        });
    };

    useEffect(() => {
        API.get()
            .then(apply)
            .catch((e) => setLoadErr(`${code(e) ? `[${code(e)}] ` : ''}${errMsg(e)}`))
            .finally(() => setLoading(false));
        loadNotices();
    }, [loadNotices]);

    useEffect(() => {
        const bad = (e: any) => toast('error', errMsg(e));
        if (tab === 'notices') loadNotices();
        if (tab === 'sessions') API.sessions().then((r) => setSessions(r.data)).catch(bad);
        if (tab === 'activity') API.activity().then((r) => setLogs(r.data)).catch(bad);
    }, [tab, toast, loadNotices]);

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

    const saveInfo = async (e: React.FormEvent) => {
        e.preventDefault();
        const r = await run('info', () => API.update(form), 'Đã lưu thông tin cá nhân.');
        if (r) apply(r);
    };

    const savePw = async (e: React.FormEvent) => {
        e.preventDefault();
        const r = await run('pw', () => API.password(pw), (x) => x.message);
        if (r) {
            setPw({ current_password: '', password: '', password_confirmation: '' });
            loadNotices();
        }
    };

    const saveEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        const r = await run('email', () => API.email(em), (x) => x.message);
        if (r) {
            setUser({ ...user, email: r.email });
            setEm({ email: '', current_password: '' });
            loadNotices();
        }
    };

    const pickAvatar = async (f?: File) => {
        if (!f) return;
        if (f.size > 2 * 1024 * 1024) return toast('error', 'Ảnh tối đa 2MB.');
        const r = await run('avatar', () => API.avatar(f), 'Đã cập nhật ảnh đại diện.');
        if (r) setAvatar(r.avatar_url);
    };

    const reloadSessions = () => API.sessions().then((r) => setSessions(r.data));
    const after = (r: any) => { if (r) setUnread(r.unread); };

    const openNotice = async (n: any) => {
        if (n.read_at) return;
        after(await API.readNotice(n.id).catch(() => null));
        setNotices((l) => l.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    };

    const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });
    const st = strength(pw.password);
    const initials = (user?.name || 'AD')
        .split(' ')
        .slice(-2)
        .map((w: string) => w[0])
        .join('')
        .toUpperCase();

    if (loading) {
        return (
            <div className="pf">
                <div className="pf-skeleton">
                    <div className="sk-banner" />
                    <div className="sk-row" />
                    <div className="sk-card" />
                </div>
            </div>
        );
    }

    if (loadErr || !user) {
        return (
            <div className="pf">
                <div className="pf-card pf-err">
                    <h2>Không tải được hồ sơ</h2>
                    <code>{loadErr || 'Máy chủ không trả về dữ liệu.'}</code>
                    <p className="pf-mut">
                        {loadErr.startsWith('[401]')
                            ? 'Phiên đăng nhập không hợp lệ. Đăng xuất rồi đăng nhập lại bằng tài khoản admin.'
                            : 'Kiểm tra backend đang chạy và route /admin/profile đã đăng ký.'}
                    </p>
                    <button className="pf-btn" style={{ marginTop: 12 }} onClick={() => location.reload()}>
                        Thử lại
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="pf">
            <div className="pf-toasts" aria-live="polite">
                {toasts.map((t) => (
                    <div key={t.id} className={`pf-toast ${t.type}`} role="status">
                        <p>{t.text}</p>
                        <button aria-label="Đóng" onClick={() => setToasts((x) => x.filter((i) => i.id !== t.id))}>✕</button>
                    </div>
                ))}
            </div>

            {/* ===== HERO ===== */}
            <section className="pf-hero">
                <div className="pf-banner">
                    <div className="pf-banner-pattern" />
                </div>
                <div className="pf-head">
                    <div className="pf-avwrap">
                        {avatar ? (
                            <img src={avatar} alt="Ảnh đại diện" className="pf-av" />
                        ) : (
                            <div className="pf-av">{initials}</div>
                        )}
                        <button
                            type="button"
                            className="pf-avbtn"
                            disabled={busy === 'avatar'}
                            onClick={() => fileRef.current?.click()}
                        >
                            {busy === 'avatar' ? '…' : 'Đổi ảnh'}
                        </button>
                        <input
                            ref={fileRef}
                            type="file"
                            hidden
                            accept="image/png,image/jpeg,image/webp"
                            onChange={(e) => {
                                pickAvatar(e.target.files?.[0]);
                                e.target.value = '';
                            }}
                        />
                    </div>

                    <div className="pf-id">
                        <h1 className="pf-name">{user.name}</h1>
                        <p className="pf-sub">
                            {form.position || 'Chưa cập nhật chức vụ'}
                            {form.department ? ` · ${form.department}` : ''}
                        </p>
                        <div className="pf-chips">
                            {(user.roles || []).map((r: string) => (
                                <span key={r} className="pf-chip">{ROLE[r] || r}</span>
                            ))}
                            <span className={`pf-chip ${user.status === 'active' ? 'ok' : 'bad'}`}>
                                {user.status === 'active' ? 'Đang hoạt động' : 'Đã khoá'}
                            </span>
                        </div>
                    </div>

                    <div className="pf-stats">
                        <div className="pf-stat">
                            <span>Tài khoản</span>
                            <b>{user.username || '—'}</b>
                        </div>
                        <div className="pf-stat">
                            <span>Email</span>
                            <b className="pf-stat-email">{user.email || '—'}</b>
                        </div>
                        <div className="pf-stat">
                            <span>Ngày tạo</span>
                            <b>{fmtDate(user.created_at)}</b>
                        </div>
                        <div className="pf-stat">
                            <span>Hộp thư</span>
                            <b>{unread > 0 ? `${unread} chưa đọc` : 'Đã đọc hết'}</b>
                        </div>
                    </div>
                </div>
            </section>

            {/* ===== BODY: sidebar tabs + content ===== */}
            <div className="pf-body">
                <nav className="pf-nav" role="tablist" aria-label="Mục hồ sơ">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            type="button"
                            role="tab"
                            aria-selected={tab === t.key}
                            className={`pf-nav-item ${tab === t.key ? 'on' : ''}`}
                            onClick={() => setTab(t.key)}
                        >
                            <Icon name={t.icon} />
                            <span>{t.label}</span>
                            {t.key === 'notices' && unread > 0 && (
                                <em className="pf-badge">{unread > 9 ? '9+' : unread}</em>
                            )}
                        </button>
                    ))}
                </nav>

                <section className="pf-panel">
                    {tab === 'info' && (
                        <form onSubmit={saveInfo} className="pf-stack">
                            <header className="pf-panel-head">
                                <div>
                                    <h2>Thông tin cá nhân</h2>
                                    <p>Cập nhật hồ sơ quản trị viên trong hệ thống nhà trường.</p>
                                </div>
                                <button type="submit" className="pf-btn" disabled={busy === 'info'}>
                                    {busy === 'info' ? 'Đang lưu…' : 'Lưu thay đổi'}
                                </button>
                            </header>

                            <div className="pf-section">
                                <h3><Icon name="user" /> Định danh</h3>
                                <div className="pf-grid">
                                    <Field label="Họ và tên">
                                        <input className="pf-in" value={form.name} onChange={set('name')} required maxLength={255} />
                                    </Field>
                                    <Field label="Số điện thoại" hint="10 chữ số, bắt đầu bằng 0">
                                        <input className="pf-in" value={form.phone} onChange={set('phone')} inputMode="tel" />
                                    </Field>
                                    <Field label="Email đăng nhập" hint="Đổi email ở mục Bảo mật">
                                        <input className="pf-in" value={user.email || ''} disabled />
                                    </Field>
                                    <Field label="Tên đăng nhập">
                                        <input className="pf-in" value={user.username || ''} disabled />
                                    </Field>
                                </div>
                            </div>

                            <div className="pf-section">
                                <h3><Icon name="brief" /> Công việc</h3>
                                <div className="pf-grid">
                                    <Field label="Chức vụ">
                                        <input className="pf-in" value={form.position} onChange={set('position')} maxLength={100} placeholder="Quản trị hệ thống" />
                                    </Field>
                                    <Field label="Phòng / Bộ phận">
                                        <input className="pf-in" value={form.department} onChange={set('department')} maxLength={100} placeholder="Văn phòng nhà trường" />
                                    </Field>
                                    <Field label="Giới tính">
                                        <select className="pf-in" value={form.gender} onChange={set('gender')}>
                                            <option value="">Chưa chọn</option>
                                            <option value="male">Nam</option>
                                            <option value="female">Nữ</option>
                                            <option value="other">Khác</option>
                                        </select>
                                    </Field>
                                    <Field label="Ngày sinh">
                                        <input type="date" className="pf-in" value={form.date_of_birth} onChange={set('date_of_birth')} max={new Date().toISOString().slice(0, 10)} />
                                    </Field>
                                </div>
                            </div>

                            <div className="pf-section">
                                <h3><Icon name="map" /> Liên hệ & giới thiệu</h3>
                                <div className="pf-grid one">
                                    <Field label="Địa chỉ">
                                        <input className="pf-in" value={form.address} onChange={set('address')} maxLength={255} />
                                    </Field>
                                    <Field label="Giới thiệu ngắn" hint={`${(form.bio || '').length}/500 ký tự`}>
                                        <textarea className="pf-in" rows={3} value={form.bio} onChange={set('bio')} maxLength={500} placeholder="Mô tả ngắn về vai trò của bạn trong nhà trường…" />
                                    </Field>
                                </div>
                            </div>
                        </form>
                    )}

                    {tab === 'security' && (
                        <div className="pf-stack">
                            <header className="pf-panel-head">
                                <div>
                                    <h2>Mật khẩu & bảo mật</h2>
                                    <p>Đổi mật khẩu, email đăng nhập. Các thiết bị khác sẽ bị đăng xuất sau khi đổi mật khẩu.</p>
                                </div>
                            </header>

                            <div className="pf-two">
                                <form onSubmit={savePw} className="pf-section pf-stack">
                                    <h3><Icon name="lock" /> Đổi mật khẩu</h3>
                                    <Field label="Mật khẩu hiện tại">
                                        <input type="password" autoComplete="current-password" className="pf-in" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} required />
                                    </Field>
                                    <Field label="Mật khẩu mới">
                                        <input type="password" autoComplete="new-password" className="pf-in" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} required />
                                        <div className="pf-meter"><i className={`s${st[1]}`} style={{ width: `${st[2]}%` }} /></div>
                                        <small>{st[0] || 'Nhập mật khẩu để xem độ mạnh'}</small>
                                    </Field>
                                    <Field label="Nhập lại mật khẩu mới">
                                        <input type="password" autoComplete="new-password" className="pf-in" value={pw.password_confirmation} onChange={(e) => setPw({ ...pw, password_confirmation: e.target.value })} required />
                                    </Field>
                                    <button type="submit" className="pf-btn" disabled={busy === 'pw'}>
                                        {busy === 'pw' ? 'Đang đổi…' : 'Đổi mật khẩu'}
                                    </button>
                                </form>

                                <aside className="pf-aside">
                                    <div className="pf-aside-icon"><Icon name="shield" /></div>
                                    <b>Mật khẩu an toàn cần</b>
                                    <ul>
                                        <li>Ít nhất 8 ký tự</li>
                                        <li>Có chữ hoa và chữ thường</li>
                                        <li>Có ít nhất một chữ số</li>
                                        <li>Khác mật khẩu hiện tại</li>
                                    </ul>
                                    <p>Không dùng mật khẩu trùng email hoặc tên đăng nhập.</p>
                                </aside>
                            </div>

                            <form onSubmit={saveEmail} className="pf-section pf-stack">
                                <h3><Icon name="mail" /> Đổi email đăng nhập</h3>
                                <p className="pf-mut" style={{ margin: 0 }}>
                                    Hiện tại: <b style={{ color: 'var(--tx)' }}>{user.email}</b> — cần nhập mật khẩu để xác nhận.
                                </p>
                                <div className="pf-grid">
                                    <Field label="Email mới">
                                        <input type="email" className="pf-in" value={em.email} onChange={(e) => setEm({ ...em, email: e.target.value })} required />
                                    </Field>
                                    <Field label="Mật khẩu hiện tại">
                                        <input type="password" autoComplete="current-password" className="pf-in" value={em.current_password} onChange={(e) => setEm({ ...em, current_password: e.target.value })} required />
                                    </Field>
                                </div>
                                <button type="submit" className="pf-btn" disabled={busy === 'email'}>
                                    {busy === 'email' ? 'Đang đổi…' : 'Đổi email'}
                                </button>
                            </form>
                        </div>
                    )}

                    {tab === 'sessions' && (
                        <div className="pf-stack">
                            <header className="pf-panel-head">
                                <div>
                                    <h2>Thiết bị đăng nhập</h2>
                                    <p>Danh sách phiên đang hoạt động. Thu hồi thiết bị không nhận ra.</p>
                                </div>
                                <button
                                    type="button"
                                    className="pf-btn line"
                                    disabled={busy === 'rev' || sessions.length < 2}
                                    onClick={() =>
                                        confirm('Đăng xuất tất cả thiết bị khác?') &&
                                        run('rev', API.revokeOthers, (r) => r.message).then(reloadSessions)
                                    }
                                >
                                    Đăng xuất thiết bị khác
                                </button>
                            </header>

                            <ul className="pf-list">
                                {sessions.map((s) => (
                                    <li key={s.id}>
                                        <span className="pf-list-ico"><Icon name="device" /></span>
                                        <div className="grow">
                                            <p className="t">
                                                Phiên #{s.id}{' '}
                                                {s.current && <span className="pf-chip ok">Thiết bị này</span>}
                                            </p>
                                            <p className="pf-mut">
                                                Đăng nhập: {fmt(s.created_at)} · Gần nhất: {fmt(s.last_used_at)}
                                            </p>
                                        </div>
                                        {!s.current && (
                                            <button
                                                type="button"
                                                className="pf-link danger"
                                                onClick={() =>
                                                    run('r' + s.id, () => API.revoke(s.id), (r) => r.message).then(reloadSessions)
                                                }
                                            >
                                                Thu hồi
                                            </button>
                                        )}
                                    </li>
                                ))}
                                {!sessions.length && <li className="pf-mut">Chưa có phiên nào.</li>}
                            </ul>
                        </div>
                    )}

                    {tab === 'activity' && (
                        <div className="pf-stack">
                            <header className="pf-panel-head">
                                <div>
                                    <h2>Nhật ký hoạt động</h2>
                                    <p>Các thao tác gần đây trên tài khoản quản trị.</p>
                                </div>
                            </header>
                            <ol className="pf-tl">
                                {logs.map((l) => (
                                    <li key={l.id}>
                                        <p className="t">{l.description}</p>
                                        <p className="pf-mut">
                                            {fmt(l.created_at)}
                                            {l.ip ? ` · IP ${l.ip}` : ''}
                                        </p>
                                    </li>
                                ))}
                            </ol>
                            {!logs.length && (
                                <p className="pf-empty">Chưa có hoạt động được ghi lại. Hãy thử cập nhật hồ sơ.</p>
                            )}
                        </div>
                    )}

                    {tab === 'notices' && (
                        <div className="pf-stack">
                            <header className="pf-panel-head">
                                <div>
                                    <h2>Hộp thư hệ thống</h2>
                                    <p>
                                        {unread
                                            ? `Bạn có ${unread} thông báo chưa đọc.`
                                            : 'Bạn đã đọc hết thông báo.'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    className="pf-link"
                                    disabled={!unread}
                                    onClick={async () => {
                                        after(await API.readAllNotices().catch(() => null));
                                        loadNotices();
                                    }}
                                >
                                    Đánh dấu đã đọc tất cả
                                </button>
                            </header>

                            <ul className="pf-list">
                                {notices.map((n) => (
                                    <li
                                        key={n.id}
                                        className={n.read_at ? '' : 'unread'}
                                        onClick={() => openNotice(n)}
                                    >
                                        <span className={`pf-dot ${n.level || ''}`} />
                                        <div className="grow">
                                            <p className="t" style={{ fontWeight: n.read_at ? 500 : 700 }}>
                                                {n.title}
                                            </p>
                                            {n.body && <p className="pf-body">{n.body}</p>}
                                            <p className="pf-mut">{fmt(n.created_at)}</p>
                                        </div>
                                        <button
                                            type="button"
                                            className="pf-link muted"
                                            aria-label="Xoá thông báo"
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                after(await API.deleteNotice(n.id).catch(() => null));
                                                setNotices((l) => l.filter((x) => x.id !== n.id));
                                            }}
                                        >
                                            ✕
                                        </button>
                                    </li>
                                ))}
                                {!notices.length && (
                                    <li className="pf-mut">Hộp thư trống. Cảnh báo bảo mật và thông báo hệ thống sẽ hiện ở đây.</li>
                                )}
                            </ul>
                        </div>
                    )}

                    {tab === 'prefs' && (
                        <div className="pf-stack">
                            <header className="pf-panel-head">
                                <div>
                                    <h2>Tuỳ chọn thông báo</h2>
                                    <p>Chọn loại thông báo bạn muốn nhận trên hệ thống.</p>
                                </div>
                                <button
                                    type="button"
                                    className="pf-btn"
                                    disabled={busy === 'prefs'}
                                    onClick={() =>
                                        run('prefs', () => API.preferences(prefs), 'Đã lưu tuỳ chọn thông báo.')
                                    }
                                >
                                    {busy === 'prefs' ? 'Đang lưu…' : 'Lưu tuỳ chọn'}
                                </button>
                            </header>

                            <div className="pf-section">
                                <Toggle
                                    on={prefs.notify_login}
                                    set={(v) => setPrefs({ ...prefs, notify_login: v })}
                                    title="Cảnh báo đăng nhập"
                                    desc="Thông báo khi có thiết bị mới đăng nhập tài khoản của bạn."
                                />
                                <Toggle
                                    on={prefs.notify_system}
                                    set={(v) => setPrefs({ ...prefs, notify_system: v })}
                                    title="Thông báo hệ thống"
                                    desc="Bảo trì, cập nhật phiên bản và thay đổi quan trọng."
                                />
                                <Toggle
                                    on={prefs.notify_email}
                                    set={(v) => setPrefs({ ...prefs, notify_email: v })}
                                    title="Gửi thêm qua email"
                                    desc="Nhận bản sao thông báo qua email đăng nhập."
                                />
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}