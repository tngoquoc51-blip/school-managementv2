'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import './change-password.css';
import { getStudentToken, useCurrentStudent } from '@/hooks/useCurrentStudent';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

/* ===================== kiểu dữ liệu từ GET /hs/security ===================== */
interface Check { key: string; label: string; ok: boolean; weight: number; hint: string }
interface Session { id: number; created_at: string; expires_at: string; current: boolean }
interface Security {
    account: { username: string; email: string | null; email_linked: boolean };
    password: { must_change: boolean; changed_at: string | null };
    last_login_at: string | null;
    score: number;
    level: 'low' | 'medium' | 'high';
    checks: Check[];
    sessions: Session[];
}

/* ===================== tiện ích ===================== */
const rules = (p: string) => [
    { ok: p.length >= 8, text: 'Ít nhất 8 ký tự' },
    { ok: /\p{L}/u.test(p), text: 'Có ít nhất 1 chữ cái' },
    { ok: /\d/.test(p), text: 'Có ít nhất 1 chữ số' },
];

const strength = (p: string) => {
    if (!p) return { level: 0, label: 'Chưa nhập' };
    let s = rules(p).filter((r) => r.ok).length;
    if (p.length >= 12) s += 1;
    if (/[^\p{L}\d]/u.test(p)) s += 1;
    if (s <= 2) return { level: 1, label: 'Yếu' };
    if (s === 3) return { level: 2, label: 'Trung bình' };
    if (s === 4) return { level: 3, label: 'Khá mạnh' };
    return { level: 4, label: 'Mạnh' };
};

const parse = (s?: string | null) => (s ? new Date(s.replace(' ', 'T')) : null);
const fmt = (s?: string | null) => {
    const d = parse(s);
    if (!d || Number.isNaN(d.getTime())) return '—';
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const ago = (s?: string | null) => {
    const d = parse(s);
    if (!d || Number.isNaN(d.getTime())) return null;
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days <= 0) return 'Hôm nay';
    if (days === 1) return 'Hôm qua';
    if (days < 30) return `${days} ngày trước`;
    if (days < 365) return `${Math.floor(days / 30)} tháng trước`;
    return `${Math.floor(days / 365)} năm trước`;
};

/* ===================== icon ===================== */
const P = {
    lock: <path d="M7 10V7a5 5 0 0 1 10 0v3M6 10h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Zm6 4v3" />,
    key: <path d="M14.5 9.5a4.5 4.5 0 1 1-1.9 3.7L4 21v-3h3v-3h3l2.6-2.6a4.5 4.5 0 0 1 1.9-2.9ZM17 8.5h.01" />,
    eye: <><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    eyeOff: <path d="M3 3l18 18M10.6 6.2A9.8 9.8 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 7.6A16.6 16.6 0 0 0 2 12s3.6 6 10 6a9.6 9.6 0 0 0 4-.9M9.9 9.9a3 3 0 0 0 4.2 4.2" />,
    check: <path d="m5 12.5 4.2 4.2L19 7" />,
    x: <path d="M6 6l12 12M18 6 6 18" />,
    alert: <path d="M12 8v5m0 3.5h.01M10.3 4.2 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />,
    shield: <path d="M12 3 5 6v5.5c0 4.3 2.9 7.9 7 9.5 4.1-1.6 7-5.2 7-9.5V6l-7-3Zm-3 9 2.2 2.2L15.5 10" />,
    device: <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9H4V6Zm-1 12h18M10 18v1.5h4V18" />,
    user: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />,
    mail: <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-11Zm2 .6 7 5 7-5" />,
    clock: <path d="M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
    login: <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 8l-4 4 4 4m-4-4h11" />,
    logout: <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4m6-12 4 4-4 4m4-4H9" />,
};
type IconName = keyof typeof P;
const Icon = ({ d, size = 18 }: { d: IconName; size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {P[d]}
    </svg>
);

/* ===================== vòng điểm bảo mật ===================== */
function ScoreRing({ score, level }: { score: number; level: string }) {
    const R = 52;
    const C = 2 * Math.PI * R;
    return (
        <div className={`cp-ring ${level}`} role="img" aria-label={`Điểm bảo mật ${score} trên 100`}>
            <svg viewBox="0 0 130 130">
                <circle cx="65" cy="65" r={R} className="trk" />
                <circle cx="65" cy="65" r={R} className="bar" strokeDasharray={`${(C * score) / 100} ${C}`} transform="rotate(-90 65 65)" />
            </svg>
            <div><b>{score}</b><small>/100</small></div>
        </div>
    );
}

const LEVEL_TEXT: Record<string, string> = { high: 'Bảo mật tốt', medium: 'Cần cải thiện', low: 'Bảo mật yếu' };

/* ===================== ô nhập mật khẩu ===================== */
function PasswordField(props: {
    id: string; label: string; value: string; onChange: (v: string) => void; placeholder: string;
    autoComplete: string; show: boolean; onToggle: () => void; bad?: boolean; autoFocus?: boolean; hint?: string;
}) {
    const { id, label, value, onChange, placeholder, autoComplete, show, onToggle, bad, autoFocus, hint } = props;
    return (
        <div className="cp-group">
            <label className="cp-label" htmlFor={id}>{label}</label>
            <div className={`cp-field ${bad ? 'bad' : ''}`}>
                <Icon d="lock" />
                <input id={id} type={show ? 'text' : 'password'} value={value} placeholder={placeholder}
                       autoComplete={autoComplete} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} />
                <button type="button" className="cp-eye" onClick={onToggle} aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
                    <Icon d={show ? 'eyeOff' : 'eye'} />
                </button>
            </div>
            {hint && <p className={`cp-fhint ${bad ? 'bad' : ''}`}>{hint}</p>}
        </div>
    );
}

/* ===================== trang chính ===================== */
export default function StudentChangePasswordPage() {
    const { student } = useCurrentStudent();

    const [sec, setSec] = useState<Security | null>(null);
    const [secErr, setSecErr] = useState(false);

    const [cur, setCur] = useState('');
    const [next, setNext] = useState('');
    const [conf, setConf] = useState('');
    const [show, setShow] = useState({ cur: false, next: false, conf: false });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
    const [busy, setBusy] = useState<number | 'all' | null>(null);
    const [confirmAll, setConfirmAll] = useState(false);

    const authFetch = useCallback(async (path: string, method = 'GET', body?: object) => {
        const token = getStudentToken();
        if (!token) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        const res = await fetch(`${API}${path}`, {
            method,
            headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
            body: body ? JSON.stringify(body) : undefined,
        });
        const json = await res.json().catch(() => ({}));
        if (res.status === 401) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        if (!res.ok) throw new Error(json?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
        return json;
    }, []);

    const loadSecurity = useCallback(async () => {
        try {
            const j = await authFetch('/hs/security');
            setSec(j.data);
            setSecErr(false);
            try {
                if (j.data?.password?.must_change) localStorage.setItem('must_change_password', '1');
                else localStorage.removeItem('must_change_password');
            } catch { /* bỏ qua */ }
        } catch {
            setSecErr(true);
        }
    }, [authFetch]);

    useEffect(() => { loadSecurity(); }, [loadSecurity]);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 4500);
        return () => clearTimeout(t);
    }, [toast]);

    const rl = useMemo(() => rules(next), [next]);
    const st = useMemo(() => strength(next), [next]);
    const pwOk = rl.every((r) => r.ok);
    const mismatch = conf.length > 0 && conf !== next;
    const same = next.length > 0 && next === cur;
    const canSubmit = !!cur && pwOk && !!conf && !mismatch && !same && !loading;

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!canSubmit) return;
        setError('');
        setLoading(true);
        try {
            await authFetch('/hs/change-password', 'POST', { current_password: cur, new_password: next });
            setCur(''); setNext(''); setConf('');
            setToast({ type: 'ok', text: 'Đổi mật khẩu thành công. Các thiết bị khác đã được đăng xuất.' });
            await loadSecurity();
        } catch (err: any) {
            setError(err.message || 'Không kết nối được máy chủ.');
        } finally {
            setLoading(false);
        }
    }

    async function revoke(id: number) {
        setBusy(id);
        try {
            await authFetch(`/hs/security/sessions/${id}/revoke`, 'POST');
            setToast({ type: 'ok', text: 'Đã đăng xuất phiên đăng nhập đó.' });
            await loadSecurity();
        } catch (err: any) {
            setToast({ type: 'err', text: err.message });
        } finally {
            setBusy(null);
        }
    }

    async function revokeAll() {
        setBusy('all');
        try {
            const j = await authFetch('/hs/security/revoke-others', 'POST');
            setToast({ type: 'ok', text: j.message || 'Đã đăng xuất các thiết bị khác.' });
            setConfirmAll(false);
            await loadSecurity();
        } catch (err: any) {
            setToast({ type: 'err', text: err.message });
        } finally {
            setBusy(null);
        }
    }

    const others = sec ? sec.sessions.filter((s) => !s.current) : [];
    const changedAgo = ago(sec?.password.changed_at);

    return (
        <div className="cp-page">
            {toast && (
                <div className={`cp-toast ${toast.type}`} role="status">
                    <Icon d={toast.type === 'ok' ? 'check' : 'alert'} size={18} />
                    <span>{toast.text}</span>
                    <button type="button" onClick={() => setToast(null)} aria-label="Đóng"><Icon d="x" size={16} /></button>
                </div>
            )}

            {/* ===== Hero ===== */}
            <header className="cp-hero">
                <div className="cp-hero-text">
                    <p className="cp-eyebrow"><Icon d="shield" size={15} /> Cổng thông tin học sinh · Bảo mật tài khoản</p>
                    <h1>Trung tâm bảo mật</h1>
                    <p className="cp-sub">Quản lý mật khẩu, theo dõi các thiết bị đang đăng nhập và kiểm tra mức an toàn của tài khoản.</p>
                    {student && (
                        <div className="cp-who">
                            <span className="cp-avatar"><Icon d="user" size={18} /></span>
                            <div>
                                <b>{student.full_name}</b>
                                <small>{[student.code, student.class_name && `Lớp ${student.class_name}`].filter(Boolean).join(' · ')}</small>
                            </div>
                        </div>
                    )}
                </div>
                <div className="cp-score">
                    {sec ? (
                        <>
                            <ScoreRing score={sec.score} level={sec.level} />
                            <div>
                                <span className="cp-score-k">Điểm bảo mật</span>
                                <b className={`cp-score-v ${sec.level}`}>{LEVEL_TEXT[sec.level]}</b>
                                <small>{sec.checks.filter((c) => c.ok).length}/{sec.checks.length} tiêu chí đạt</small>
                            </div>
                        </>
                    ) : (
                        <div className="cp-score-skel">{secErr ? 'Chưa tải được điểm bảo mật' : 'Đang tải…'}</div>
                    )}
                </div>
            </header>

            {sec?.password.must_change && (
                <div className="cp-banner warn" role="status">
                    <Icon d="alert" size={20} />
                    <div><b>Bạn đang dùng mật khẩu mặc định.</b> Hãy đặt mật khẩu mới để bảo vệ điểm số và thông tin cá nhân.</div>
                </div>
            )}

            {/* ===== 4 ô thông tin ===== */}
            <section className="cp-stats" aria-label="Thông tin tài khoản">
                <div className="cp-stat">
                    <span className="cp-stat-ic"><Icon d="user" size={20} /></span>
                    <div><small>Tên đăng nhập</small><b>{sec?.account.username ?? '—'}</b></div>
                </div>
                <div className="cp-stat">
                    <span className="cp-stat-ic"><Icon d="mail" size={20} /></span>
                    <div>
                        <small>Gmail khôi phục</small>
                        {sec ? (sec.account.email_linked
                            ? <b>{sec.account.email}</b>
                            : <b className="warn">Chưa liên kết</b>) : <b>—</b>}
                    </div>
                </div>
                <div className="cp-stat">
                    <span className="cp-stat-ic"><Icon d="key" size={20} /></span>
                    <div>
                        <small>Đổi mật khẩu gần nhất</small>
                        <b>{sec?.password.changed_at ? changedAgo : sec ? 'Chưa từng đổi' : '—'}</b>
                    </div>
                </div>
                <div className="cp-stat">
                    <span className="cp-stat-ic"><Icon d="login" size={20} /></span>
                    <div><small>Đăng nhập gần nhất</small><b>{sec?.last_login_at ? fmt(sec.last_login_at) : '—'}</b></div>
                </div>
            </section>

            <div className="cp-grid">
                {/* ===== Cột trái ===== */}
                <div className="cp-col">
                    <section className="cp-card">
                        <div className="cp-card-head">
                            <span className="cp-badge"><Icon d="key" size={22} /></span>
                            <div>
                                <h2>Đổi mật khẩu</h2>
                                <p>Nhập mật khẩu hiện tại để xác nhận đúng là bạn, sau đó đặt mật khẩu mới.</p>
                            </div>
                        </div>

                        {error && (
                            <div className="cp-banner err" role="alert">
                                <Icon d="alert" size={18} /> <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={submit} noValidate className="cp-form">
                            <div className="cp-form-main">
                                <PasswordField id="cp-cur" label="Mật khẩu hiện tại" value={cur} onChange={setCur}
                                               placeholder="Nhập mật khẩu đang dùng" autoComplete="current-password"
                                               show={show.cur} onToggle={() => setShow((s) => ({ ...s, cur: !s.cur }))} autoFocus />
                                <PasswordField id="cp-new" label="Mật khẩu mới" value={next} onChange={setNext}
                                               placeholder="Tối thiểu 8 ký tự, gồm chữ và số" autoComplete="new-password"
                                               show={show.next} onToggle={() => setShow((s) => ({ ...s, next: !s.next }))} bad={same}
                                               hint={same ? 'Mật khẩu mới phải khác mật khẩu hiện tại.' : undefined} />
                                <PasswordField id="cp-conf" label="Nhập lại mật khẩu mới" value={conf} onChange={setConf}
                                               placeholder="Nhập lại để xác nhận" autoComplete="new-password"
                                               show={show.conf} onToggle={() => setShow((s) => ({ ...s, conf: !s.conf }))} bad={mismatch}
                                               hint={mismatch ? 'Hai lần nhập chưa khớp nhau.' : undefined} />
                                <button type="submit" className="cp-btn" disabled={!canSubmit}>
                                    {loading ? <span className="cp-spin" /> : <><Icon d="shield" size={18} /> Cập nhật mật khẩu</>}
                                </button>
                            </div>

                            <div className="cp-form-side" aria-live="polite">
                                <div className="cp-sidehead">
                                    <span>Độ mạnh mật khẩu</span>
                                    <em className={`lv${st.level}`}>{st.label}</em>
                                </div>
                                <div className={`cp-meter lv${st.level}`} aria-hidden="true"><span /><span /><span /><span /></div>
                                <ul className="cp-rules">
                                    {rl.map((r) => (
                                        <li key={r.text} className={r.ok ? 'ok' : ''}><Icon d="check" size={14} /> {r.text}</li>
                                    ))}
                                    <li className={next && !same ? 'ok' : ''}><Icon d="check" size={14} /> Khác mật khẩu hiện tại</li>
                                    <li className={conf && !mismatch ? 'ok' : ''}><Icon d="check" size={14} /> Hai lần nhập khớp nhau</li>
                                </ul>
                                <p className="cp-note">Mẹo: dùng một câu dễ nhớ nhưng khó đoán, ví dụ <i>Toi-hoc-lop-12A1</i>.</p>
                            </div>
                        </form>
                    </section>

                    <section className="cp-card">
                        <div className="cp-card-head">
                            <span className="cp-badge"><Icon d="device" size={22} /></span>
                            <div>
                                <h2>Phiên đăng nhập</h2>
                                <p>Các thiết bị đang đăng nhập tài khoản của bạn.</p>
                            </div>
                            {others.length > 0 && !confirmAll && (
                                <button type="button" className="cp-btn-sm danger" onClick={() => setConfirmAll(true)}>
                                    <Icon d="logout" size={16} /> Đăng xuất thiết bị khác
                                </button>
                            )}
                        </div>

                        {confirmAll && (
                            <div className="cp-confirm" role="alertdialog">
                                <span>Đăng xuất {others.length} phiên khác? Chỉ thiết bị này được giữ lại.</span>
                                <div>
                                    <button type="button" className="cp-btn-sm" onClick={() => setConfirmAll(false)}>Hủy</button>
                                    <button type="button" className="cp-btn-sm danger solid" onClick={revokeAll} disabled={busy === 'all'}>
                                        {busy === 'all' ? 'Đang xử lý…' : 'Đăng xuất'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {!sec ? (
                            <p className="cp-empty">{secErr ? 'Chưa tải được danh sách phiên. Kiểm tra API đang chạy.' : 'Đang tải…'}</p>
                        ) : (
                            <ul className="cp-sessions">
                                {sec.sessions.map((s) => (
                                    <li key={s.id} className={s.current ? 'current' : ''}>
                                        <span className="cp-sess-ic"><Icon d="device" size={20} /></span>
                                        <div className="cp-sess-main">
                                            <b>{s.current ? 'Thiết bị này' : 'Phiên đăng nhập khác'}
                                                {s.current && <span className="cp-pill">Đang dùng</span>}</b>
                                            <small><Icon d="clock" size={13} /> Đăng nhập {fmt(s.created_at)} · Hết hạn {fmt(s.expires_at)}</small>
                                        </div>
                                        {!s.current && (
                                            <button type="button" className="cp-btn-sm danger" onClick={() => revoke(s.id)} disabled={busy === s.id}>
                                                {busy === s.id ? 'Đang xử lý…' : 'Đăng xuất'}
                                            </button>
                                        )}
                                    </li>
                                ))}
                                {sec.sessions.length === 0 && <li className="cp-empty">Không có phiên nào.</li>}
                            </ul>
                        )}
                    </section>
                </div>

                {/* ===== Cột phải ===== */}
                <aside className="cp-col">
                    <section className="cp-card">
                        <div className="cp-card-head tight">
                            <span className="cp-badge sm"><Icon d="shield" size={20} /></span>
                            <div><h2>Kiểm tra bảo mật</h2><p>Hoàn thành để đạt 100 điểm.</p></div>
                        </div>
                        {!sec ? (
                            <p className="cp-empty">{secErr ? '—' : 'Đang tải…'}</p>
                        ) : (
                            <ul className="cp-checks">
                                {sec.checks.map((c) => (
                                    <li key={c.key} className={c.ok ? 'ok' : 'todo'}>
                                        <span className="cp-check-ic"><Icon d={c.ok ? 'check' : 'alert'} size={15} /></span>
                                        <div>
                                            <b>{c.label}</b>
                                            {!c.ok && <small>{c.hint}</small>}
                                        </div>
                                        <em>{c.ok ? `+${c.weight}` : `${c.weight}`}</em>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <section className="cp-card cp-tips">
                        <h3>Lời khuyên an toàn</h3>
                        <ul>
                            <li>Không dùng ngày sinh hoặc dãy số dễ đoán như 12345678.</li>
                            <li>Không chia sẻ mật khẩu hoặc mã xác nhận cho bất kỳ ai, kể cả giáo viên.</li>
                            <li>Luôn đăng xuất sau khi dùng máy tính ở phòng máy hoặc quán net.</li>
                            <li>Quên mật khẩu? Dùng “Quên mật khẩu” ở trang đăng nhập (cần Gmail đã liên kết).</li>
                        </ul>
                    </section>
                </aside>
            </div>
        </div>
    );
}