'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { adminProfile as API } from '@/services/adminProfile';
import './profile.css';

type ToastT = { id: number; type: 'success' | 'error' | 'info'; text: string };
const TABS = [
    ['info', 'Thông tin cá nhân'], ['security', 'Mật khẩu & bảo mật'], ['sessions', 'Thiết bị đăng nhập'],
    ['activity', 'Nhật ký hoạt động'], ['notices', 'Hộp thư'], ['prefs', 'Tuỳ chọn thông báo'],
] as const;
const ROLE: Record<string, string> = {
    super_admin: 'Quản trị hệ thống', admin: 'Quản trị', principal: 'Hiệu trưởng', vice_principal: 'Phó hiệu trưởng',
    academic: 'Giáo vụ', accountant: 'Kế toán', teacher: 'Giáo viên',
};
const EMPTY = { name: '', phone: '', gender: '', date_of_birth: '', address: '', position: '', department: '', bio: '' };
const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString('vi-VN') : 'Chưa có');
const errMsg = (e: any) => {
    const er = e?.response?.data?.errors ?? e?.data?.errors;
    const first = er && (Object.values(er)[0] as string[])[0];
    return first || e?.response?.data?.message || e?.data?.message || e?.message || 'Có lỗi xảy ra, vui lòng thử lại.';
};
const code = (e: any) => e?.response?.status ?? e?.status;

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return <label className="pf-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
function Toggle({ on, set, title, desc }: { on: boolean; set: (v: boolean) => void; title: string; desc: string }) {
    return (
        <div className="pf-sw">
            <div><b>{title}</b><span>{desc}</span></div>
            <button type="button" role="switch" aria-checked={on} className="pf-tg" onClick={() => set(!on)}><i /></button>
        </div>
    );
}
function strength(p: string): [string, number, number] {
    const n = [/.{8,}/, /[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length;
    const i = p ? n || 1 : 0;
    return [['', 'Rất yếu', 'Yếu', 'Trung bình', 'Khá mạnh', 'Mạnh'][i], i, i * 20];
}

export default function AdminProfilePage() {
    const [tab, setTab] = useState<(typeof TABS)[number][0]>('info');
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
    const loadNotices = useCallback(() => API.notices().then((r) => { setNotices(r.data || []); setUnread(r.unread || 0); }).catch(() => {}), []);

    const apply = (res: any) => {
        if (!res?.user || !res?.profile) throw new Error('Máy chủ trả về dữ liệu không đúng định dạng: ' + JSON.stringify(res)?.slice(0, 120));
        const { user: u, profile: p } = res;
        setUser(u); setAvatar(p.avatar_url);
        setForm({ name: u.name || '', phone: u.phone || '', gender: p.gender || '', date_of_birth: p.date_of_birth || '',
            address: p.address || '', position: p.position || '', department: p.department || '', bio: p.bio || '' });
        setPrefs({ notify_login: !!p.notify_login, notify_system: !!p.notify_system, notify_email: !!p.notify_email });
    };

    useEffect(() => {
        API.get().then(apply).catch((e) => setLoadErr(`${code(e) ? `[${code(e)}] ` : ''}${errMsg(e)}`)).finally(() => setLoading(false));
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
        try { const r = await fn(); toast('success', typeof ok === 'function' ? ok(r) : ok); return r; }
        catch (e) { toast('error', errMsg(e)); }
        finally { setBusy(''); }
    };
    const saveInfo = async (e: React.FormEvent) => { e.preventDefault(); const r = await run('info', () => API.update(form), 'Đã lưu thông tin cá nhân.'); if (r) apply(r); };
    const savePw = async (e: React.FormEvent) => {
        e.preventDefault();
        const r = await run('pw', () => API.password(pw), (x) => x.message);
        if (r) { setPw({ current_password: '', password: '', password_confirmation: '' }); loadNotices(); }
    };
    const saveEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        const r = await run('email', () => API.email(em), (x) => x.message);
        if (r) { setUser({ ...user, email: r.email }); setEm({ email: '', current_password: '' }); loadNotices(); }
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
    const initials = (user?.name || 'AD').split(' ').slice(-2).map((w: string) => w[0]).join('').toUpperCase();

    if (loading) return <div className="pf"><p className="pf-card">Đang tải hồ sơ…</p></div>;
    if (loadErr || !user) return (
        <div className="pf"><div className="pf-card pf-err">
            <h2>Không tải được hồ sơ</h2>
            <code>{loadErr || 'Máy chủ không trả về dữ liệu.'}</code>
            <p className="pf-mut">{loadErr.startsWith('[401]')
                ? 'Phiên đăng nhập không được máy chủ chấp nhận. Hãy bấm Đăng xuất, đăng nhập lại bằng tài khoản admin rồi mở lại trang này.'
                : 'Kiểm tra: backend đang chạy, route đã dán trên Route::any, hai file SQL đã chạy.'}</p>
            <button className="pf-btn" style={{ marginTop: 12 }} onClick={() => location.reload()}>Thử lại</button>
        </div></div>
    );

    return (
        <div className="pf">
            <div className="pf-toasts" aria-live="polite">
                {toasts.map((t) => (
                    <div key={t.id} className={`pf-toast ${t.type}`} role="status">
                        <p>{t.text}</p><button aria-label="Đóng" onClick={() => setToasts((x) => x.filter((i) => i.id !== t.id))}>✕</button>
                    </div>
                ))}
            </div>

            <section className="pf-card pf-hero">
                <div className="pf-banner" />
                <div className="pf-head">
                    <div className="pf-avwrap">
                        {avatar ? <img src={avatar} alt="Ảnh đại diện" className="pf-av" /> : <div className="pf-av">{initials}</div>}
                        <button className="pf-avbtn" disabled={busy === 'avatar'} onClick={() => fileRef.current?.click()}>{busy === 'avatar' ? '…' : 'Đổi ảnh'}</button>
                        <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => { pickAvatar(e.target.files?.[0]); e.target.value = ''; }} />
                    </div>
                    <div className="pf-id">
                        <h1 className="pf-name">{user.name}</h1>
                        <p className="pf-sub">{form.position || 'Chưa cập nhật chức vụ'}{form.department ? ` – ${form.department}` : ''}</p>
                        <div className="pf-chips">
                            {(user.roles || []).map((r: string) => <span key={r} className="pf-chip">{ROLE[r] || r}</span>)}
                            <span className={`pf-chip ${user.status === 'active' ? 'ok' : 'bad'}`}>{user.status === 'active' ? 'Đang hoạt động' : 'Đã khoá'}</span>
                        </div>
                    </div>
                    <div className="pf-meta">
                        <span>Tài khoản</span><b>{user.username || user.email}</b>
                        <span>Tạo ngày</span><b>{user.created_at ? new Date(user.created_at).toLocaleDateString('vi-VN') : '—'}</b>
                    </div>
                </div>
            </section>

            <nav className="pf-tabs" role="tablist">
                {TABS.map(([k, label]) => (
                    <button key={k} role="tab" aria-selected={tab === k} className={`pf-tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
                        {label}{k === 'notices' && unread > 0 && <span className="pf-badge">{unread}</span>}
                    </button>
                ))}
            </nav>

            <section className="pf-card">
                {tab === 'info' && (
                    <form onSubmit={saveInfo} className="pf-stack">
                        <div className="pf-grid">
                            <Field label="Họ và tên"><input className="pf-in" value={form.name} onChange={set('name')} required maxLength={255} /></Field>
                            <Field label="Số điện thoại" hint="10 chữ số, bắt đầu bằng 0"><input className="pf-in" value={form.phone} onChange={set('phone')} inputMode="tel" /></Field>
                            <Field label="Email đăng nhập" hint="Đổi email ở tab Mật khẩu & bảo mật"><input className="pf-in" value={user.email || ''} disabled /></Field>
                            <Field label="Tên đăng nhập"><input className="pf-in" value={user.username || ''} disabled /></Field>
                            <Field label="Giới tính">
                                <select className="pf-in" value={form.gender} onChange={set('gender')}>
                                    <option value="">Chưa chọn</option><option value="male">Nam</option><option value="female">Nữ</option><option value="other">Khác</option>
                                </select>
                            </Field>
                            <Field label="Ngày sinh"><input type="date" className="pf-in" value={form.date_of_birth} onChange={set('date_of_birth')} max={new Date().toISOString().slice(0, 10)} /></Field>
                            <Field label="Chức vụ"><input className="pf-in" value={form.position} onChange={set('position')} maxLength={100} placeholder="Ví dụ: Quản trị hệ thống" /></Field>
                            <Field label="Phòng / Bộ phận"><input className="pf-in" value={form.department} onChange={set('department')} maxLength={100} placeholder="Ví dụ: Văn phòng nhà trường" /></Field>
                        </div>
                        <Field label="Địa chỉ"><input className="pf-in" value={form.address} onChange={set('address')} maxLength={255} /></Field>
                        <Field label="Giới thiệu ngắn" hint={`${(form.bio || '').length}/500 ký tự`}><textarea className="pf-in" rows={3} value={form.bio} onChange={set('bio')} maxLength={500} /></Field>
                        <button className="pf-btn" disabled={busy === 'info'}>{busy === 'info' ? 'Đang lưu…' : 'Lưu thay đổi'}</button>
                    </form>
                )}

                {tab === 'security' && (<>
                    <div className="pf-two">
                        <form onSubmit={savePw} className="pf-stack">
                            <Field label="Mật khẩu hiện tại"><input type="password" autoComplete="current-password" className="pf-in" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} required /></Field>
                            <Field label="Mật khẩu mới">
                                <input type="password" autoComplete="new-password" className="pf-in" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} required />
                                <div className="pf-meter"><i className={`s${st[1]}`} style={{ width: `${st[2]}%` }} /></div>
                                <small>{st[0]}</small>
                            </Field>
                            <Field label="Nhập lại mật khẩu mới"><input type="password" autoComplete="new-password" className="pf-in" value={pw.password_confirmation} onChange={(e) => setPw({ ...pw, password_confirmation: e.target.value })} required /></Field>
                            <button className="pf-btn" disabled={busy === 'pw'}>{busy === 'pw' ? 'Đang đổi…' : 'Đổi mật khẩu'}</button>
                        </form>
                        <aside className="pf-aside"><b>Mật khẩu hợp lệ cần có</b>
                            <ul><li>Ít nhất 8 ký tự</li><li>Có chữ hoa và chữ thường</li><li>Có ít nhất một chữ số</li><li>Khác mật khẩu hiện tại</li></ul>
                            <p>Sau khi đổi, các thiết bị khác sẽ tự động bị đăng xuất.</p>
                        </aside>
                    </div>
                    <form onSubmit={saveEmail} className="pf-stack pf-sep">
                        <div><b>Đổi email đăng nhập</b><p className="pf-mut" style={{ margin: '4px 0 0' }}>Hiện tại: {user.email}. Cần nhập mật khẩu để xác nhận.</p></div>
                        <Field label="Email mới"><input type="email" className="pf-in" value={em.email} onChange={(e) => setEm({ ...em, email: e.target.value })} required /></Field>
                        <Field label="Mật khẩu hiện tại"><input type="password" autoComplete="current-password" className="pf-in" value={em.current_password} onChange={(e) => setEm({ ...em, current_password: e.target.value })} required /></Field>
                        <button className="pf-btn" disabled={busy === 'email'}>{busy === 'email' ? 'Đang đổi…' : 'Đổi email'}</button>
                    </form>
                </>)}

                {tab === 'sessions' && (<>
                    <div className="pf-bar">
                        <span className="pf-mut">Các thiết bị đang đăng nhập tài khoản này. Thu hồi phiên bạn không nhận ra.</span>
                        <button className="pf-btn line" disabled={busy === 'rev' || sessions.length < 2}
                                onClick={() => confirm('Đăng xuất tất cả thiết bị khác?') && run('rev', API.revokeOthers, (r) => r.message).then(reloadSessions)}>Đăng xuất thiết bị khác</button>
                    </div>
                    <ul className="pf-list">
                        {sessions.map((s) => (
                            <li key={s.id}>
                                <div className="grow">
                                    <p className="t">Phiên #{s.id} {s.current && <span className="pf-chip ok">Thiết bị này</span>}</p>
                                    <p className="pf-mut">Đăng nhập: {fmt(s.created_at)} · Hoạt động gần nhất: {fmt(s.last_used_at)}</p>
                                </div>
                                {!s.current && <button className="pf-link" style={{ color: 'var(--bad)' }} onClick={() => run('r' + s.id, () => API.revoke(s.id), (r) => r.message).then(reloadSessions)}>Thu hồi</button>}
                            </li>
                        ))}
                        {!sessions.length && <li className="pf-mut">Chưa có phiên nào.</li>}
                    </ul>
                </>)}

                {tab === 'activity' && (
                    <ol className="pf-tl">
                        {logs.map((l) => <li key={l.id}><p className="t" style={{ margin: 0, fontWeight: 600 }}>{l.description}</p><p className="pf-mut" style={{ margin: 0 }}>{fmt(l.created_at)}{l.ip ? ` · IP ${l.ip}` : ''}</p></li>)}
                        {!logs.length && <p className="pf-mut">Chưa có hoạt động nào được ghi lại. Hãy thử cập nhật hồ sơ.</p>}
                    </ol>
                )}

                {tab === 'notices' && (<>
                    <div className="pf-bar">
                        <span className="pf-mut">{unread ? `Bạn có ${unread} thông báo chưa đọc.` : 'Bạn đã đọc hết thông báo.'}</span>
                        <button className="pf-link" disabled={!unread} onClick={async () => { after(await API.readAllNotices().catch(() => null)); loadNotices(); }}>Đánh dấu đã đọc tất cả</button>
                    </div>
                    <ul className="pf-list">
                        {notices.map((n) => (
                            <li key={n.id} className={n.read_at ? '' : 'unread'} onClick={() => openNotice(n)}>
                                <span className={`pf-dot ${n.level}`} />
                                <div className="grow">
                                    <p className="t" style={{ fontWeight: n.read_at ? 500 : 700 }}>{n.title}</p>
                                    {n.body && <p>{n.body}</p>}
                                    <p className="pf-mut">{fmt(n.created_at)}</p>
                                </div>
                                <button className="pf-link" aria-label="Xoá thông báo" onClick={async (e) => { e.stopPropagation(); after(await API.deleteNotice(n.id).catch(() => null)); setNotices((l) => l.filter((x) => x.id !== n.id)); }}>✕</button>
                            </li>
                        ))}
                        {!notices.length && <li className="pf-mut">Hộp thư trống. Cảnh báo bảo mật và thông báo hệ thống sẽ hiện ở đây.</li>}
                    </ul>
                </>)}

                {tab === 'prefs' && (<>
                    <Toggle on={prefs.notify_login} set={(v) => setPrefs({ ...prefs, notify_login: v })} title="Cảnh báo đăng nhập" desc="Thông báo khi có thiết bị mới đăng nhập tài khoản của bạn." />
                    <Toggle on={prefs.notify_system} set={(v) => setPrefs({ ...prefs, notify_system: v })} title="Thông báo hệ thống" desc="Bảo trì, cập nhật phiên bản và các thay đổi quan trọng." />
                    <Toggle on={prefs.notify_email} set={(v) => setPrefs({ ...prefs, notify_email: v })} title="Gửi thêm qua email" desc="Nhận bản sao thông báo qua email đăng nhập." />
                    <button className="pf-btn" style={{ marginTop: 8 }} disabled={busy === 'prefs'} onClick={() => run('prefs', () => API.preferences(prefs), 'Đã lưu tuỳ chọn thông báo.')}>{busy === 'prefs' ? 'Đang lưu…' : 'Lưu tuỳ chọn'}</button>
                </>)}
            </section>
        </div>
    );
}