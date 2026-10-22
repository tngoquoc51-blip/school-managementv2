'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Be_Vietnam_Pro } from 'next/font/google';
import './forgot-password.css';

const beVietnam = Be_Vietnam_Pro({
    subsets: ['vietnamese', 'latin'],
    weight: ['400', '500', '600', '700', '800'],
    variable: '--font-be-vietnam',
});

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';
const CODE_LEN = 6;
type Step = 1 | 2 | 3 | 4;

const STEPS = [
    { n: 1, title: 'Xác định tài khoản', sub: 'Nhập Gmail đã đăng ký' },
    { n: 2, title: 'Nhập mã xác nhận', sub: 'Mã 6 số gửi qua Gmail' },
    { n: 3, title: 'Tạo mật khẩu mới', sub: 'Đặt mật khẩu an toàn' },
    { n: 4, title: 'Hoàn tất', sub: 'Đăng nhập lại' },
];

const HEAD: Record<Step, { title: string; desc: string }> = {
    1: { title: 'Quên mật khẩu?', desc: 'Nhập Gmail đã liên kết với tài khoản học sinh. Chúng tôi sẽ gửi mã xác nhận gồm 6 chữ số.' },
    2: { title: 'Kiểm tra Gmail của bạn', desc: '' },
    3: { title: 'Tạo mật khẩu mới', desc: 'Mật khẩu mới cần khác mật khẩu cũ và đủ mạnh để bảo vệ tài khoản.' },
    4: { title: 'Đổi mật khẩu thành công', desc: 'Tài khoản của bạn đã được bảo vệ bằng mật khẩu mới. Hãy dùng nó ở lần đăng nhập tiếp theo.' },
};

const maskEmail = (e: string) => {
    const [u, d] = e.split('@');
    if (!d) return e;
    return `${u.slice(0, 2)}${'•'.repeat(Math.max(2, Math.min(u.length - 2, 6)))}@${d}`;
};

const rules = (p: string) => [
    { ok: p.length >= 8, text: 'Ít nhất 8 ký tự' },
    { ok: /\p{L}/u.test(p), text: 'Có ít nhất 1 chữ cái' },
    { ok: /\d/.test(p), text: 'Có ít nhất 1 chữ số' },
];

const strength = (p: string) => {
    if (!p) return { level: 0, label: '' };
    let s = rules(p).filter((r) => r.ok).length;
    if (p.length >= 12) s += 1;
    if (/[^\p{L}\d]/u.test(p)) s += 1;
    if (s <= 2) return { level: 1, label: 'Yếu' };
    if (s === 3) return { level: 2, label: 'Trung bình' };
    if (s === 4) return { level: 3, label: 'Khá mạnh' };
    return { level: 4, label: 'Mạnh' };
};

/* ===== Icon (SVG, không dùng emoji) ===== */
const I = {
    mail: <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-11Zm2 .6 7 5 7-5" />,
    lock: <path d="M7 10V7a5 5 0 0 1 10 0v3M6 10h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Zm6 4v3" />,
    eye: <><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    eyeOff: <path d="M3 3l18 18M10.6 6.2A9.8 9.8 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 7.6A16.6 16.6 0 0 0 2 12s3.6 6 10 6a9.6 9.6 0 0 0 4-.9M9.9 9.9a3 3 0 0 0 4.2 4.2" />,
    check: <path d="m5 12.5 4.2 4.2L19 7" />,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    back: <path d="M19 12H5m6-6-6 6 6 6" />,
    alert: <path d="M12 8v5m0 3.5h.01M10.3 4.2 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />,
    shield: <path d="M12 3 5 6v5.5c0 4.3 2.9 7.9 7 9.5 4.1-1.6 7-5.2 7-9.5V6l-7-3Zm-3 9 2.2 2.2L15.5 10" />,
};
const Icon = ({ d, size = 20 }: { d: keyof typeof I; size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {I[d]}
    </svg>
);

/* ===== Minh họa theo từng bước ===== */
const Illustration = ({ step }: { step: Step }) => (
    <svg className="fp-illu" viewBox="0 0 220 160" fill="none" aria-hidden="true">
        <circle cx="110" cy="80" r="64" fill="rgba(255,255,255,.07)" />
        <circle cx="110" cy="80" r="44" fill="rgba(255,255,255,.08)" />
        {step === 1 && (
            <g stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <rect x="62" y="52" width="96" height="62" rx="9" fill="rgba(255,255,255,.15)" />
                <path d="m66 58 44 32 44-32" />
                <circle cx="158" cy="52" r="14" fill="#38bdf8" stroke="#fff" />
                <path d="M158 46v7m0 4h.01" />
            </g>
        )}
        {step === 2 && (
            <g stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <rect x="56" y="58" width="108" height="52" rx="9" fill="rgba(255,255,255,.15)" />
                {[0, 1, 2, 3, 4, 5].map((i) => (
                    <rect key={i} x={65 + i * 16} y="72" width="11" height="24" rx="3" fill={i < 4 ? '#38bdf8' : 'rgba(255,255,255,.25)'} strokeWidth="1.5" />
                ))}
                <path d="M110 40v12m-7-6 7 6 7-6" />
            </g>
        )}
        {step === 3 && (
            <g stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M84 70V58a26 26 0 0 1 52 0v12" />
                <rect x="72" y="70" width="76" height="52" rx="10" fill="rgba(255,255,255,.15)" />
                <circle cx="110" cy="94" r="7" fill="#38bdf8" />
                <path d="M110 100v10" />
            </g>
        )}
        {step === 4 && (
            <g stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M110 36 66 54v26c0 26 18 44 44 54 26-10 44-28 44-54V54l-44-18Z" fill="rgba(255,255,255,.15)" />
                <path d="m92 82 14 14 24-28" stroke="#6ee7b7" />
            </g>
        )}
    </svg>
);

export default function ForgotPasswordPage() {
    const [step, setStep] = useState<Step>(1);
    const [email, setEmail] = useState('');
    const [code, setCode] = useState<string[]>(Array(CODE_LEN).fill(''));
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [devCode, setDevCode] = useState('');
    const [cooldown, setCooldown] = useState(0);
    const cellRefs = useRef<(HTMLInputElement | null)[]>([]);

    const codeStr = code.join('');
    const rl = useMemo(() => rules(password), [password]);
    const st = useMemo(() => strength(password), [password]);
    const pwOk = rl.every((r) => r.ok);
    const mismatch = confirm.length > 0 && confirm !== password;

    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    useEffect(() => {
        if (step === 2) setTimeout(() => cellRefs.current[0]?.focus(), 60);
    }, [step]);

    async function post(path: string, body: object) {
        const res = await fetch(`${API}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
            const first = json?.errors ? (Object.values(json.errors)[0] as string[])[0] : '';
            throw new Error(first || json?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
        }
        return json;
    }

    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

    async function sendCode(e?: React.FormEvent) {
        e?.preventDefault();
        if (loading) return;
        setError('');
        setInfo('');
        if (!emailValid) return setError('Vui lòng nhập địa chỉ Gmail hợp lệ.');
        setLoading(true);
        try {
            const json = await post('/hs/forgot-password', { email: email.trim() });
            setDevCode(json?.data?.dev_code || '');
            setCooldown(json?.data?.resend_in ?? 60);
            setCode(Array(CODE_LEN).fill(''));
            setStep(2);
            setInfo('Đã gửi mã xác nhận.');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function resend() {
        if (cooldown > 0 || loading) return;
        setError('');
        setLoading(true);
        try {
            const json = await post('/hs/forgot-password', { email: email.trim() });
            setDevCode(json?.data?.dev_code || '');
            setCooldown(json?.data?.resend_in ?? 60);
            setCode(Array(CODE_LEN).fill(''));
            setInfo('Đã gửi lại mã mới. Mã cũ không còn dùng được.');
            cellRefs.current[0]?.focus();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function verify(value = codeStr) {
        if (loading) return;
        setError('');
        setInfo('');
        if (value.length !== CODE_LEN) return setError('Vui lòng nhập đủ 6 chữ số.');
        setLoading(true);
        try {
            await post('/hs/forgot-password/verify', { email: email.trim(), code: value });
            setStep(3);
        } catch (err: any) {
            setError(err.message);
            setCode(Array(CODE_LEN).fill(''));
            cellRefs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    }

    async function reset(e: React.FormEvent) {
        e.preventDefault();
        if (loading) return;
        setError('');
        if (!pwOk) return setError('Mật khẩu chưa đáp ứng đủ yêu cầu bên dưới.');
        if (password !== confirm) return setError('Hai lần nhập mật khẩu không khớp.');
        setLoading(true);
        try {
            await post('/hs/forgot-password/reset', {
                email: email.trim(),
                code: codeStr,
                password,
                password_confirmation: confirm,
            });
            setStep(4);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    /* ----- ô nhập mã ----- */
    function setDigit(i: number, v: string) {
        const d = v.replace(/\D/g, '');
        if (!d) {
            const next = [...code];
            next[i] = '';
            setCode(next);
            return;
        }
        const next = [...code];
        let k = i;
        for (const ch of d) {
            if (k >= CODE_LEN) break;
            next[k++] = ch;
        }
        setCode(next);
        cellRefs.current[Math.min(k, CODE_LEN - 1)]?.focus();
        if (next.every(Boolean)) verify(next.join(''));
    }

    function onKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Backspace' && !code[i] && i > 0) {
            cellRefs.current[i - 1]?.focus();
        } else if (e.key === 'ArrowLeft' && i > 0) cellRefs.current[i - 1]?.focus();
        else if (e.key === 'ArrowRight' && i < CODE_LEN - 1) cellRefs.current[i + 1]?.focus();
    }

    function changeEmail() {
        setStep(1);
        setError('');
        setInfo('');
        setDevCode('');
        setCode(Array(CODE_LEN).fill(''));
    }

    const head = HEAD[step];

    return (
        <div className={`fp-root ${beVietnam.variable}`}>
            {/* ===== Cột thương hiệu ===== */}
            <aside className="fp-aside">
                <div className="fp-brand">
                    <span className="fp-logo"><Icon d="shield" size={22} /></span>
                    <div>
                        <b>Cổng thông tin học sinh</b>
                        <small>Hệ thống quản lý nhà trường</small>
                    </div>
                </div>

                <div className="fp-aside-mid">
                    <Illustration step={step} />
                    <h2>Khôi phục tài khoản<br />an toàn, nhanh chóng</h2>
                    <p>Xác minh qua Gmail đã đăng ký với nhà trường để bảo vệ thông tin điểm số và hồ sơ của bạn.</p>
                </div>

                <ol className="fp-steps">
                    {STEPS.map((s) => {
                        const state = step > s.n || step === 4 ? 'done' : step === s.n ? 'active' : '';
                        return (
                            <li key={s.n} className={state}>
                                <span className="fp-dot">{state === 'done' ? <Icon d="check" size={14} /> : s.n}</span>
                                <div>
                                    <b>{s.title}</b>
                                    <small>{s.sub}</small>
                                </div>
                            </li>
                        );
                    })}
                </ol>
                <div className="fp-copy">© Trường THPT · Bảo mật theo chuẩn mã hóa bcrypt</div>
            </aside>

            {/* ===== Thanh trên cho điện thoại ===== */}
            <div className="fp-topbar">
                <span className="fp-logo"><Icon d="shield" size={18} /></span>
                <b>Cổng thông tin học sinh</b>
            </div>

            {/* ===== Thẻ nội dung ===== */}
            <main className="fp-main">
                <section className="fp-card" aria-live="polite">
                    <div className="fp-stepper" aria-label={`Bước ${step} trên 4`}>
                        {[1, 2, 3, 4].map((n) => (
                            <span key={n} className={n < step || step === 4 ? 'done' : n === step ? 'active' : ''} />
                        ))}
                        <em>Bước {step}/4</em>
                    </div>

                    <div className={`fp-badge ${step === 4 ? 'ok' : ''}`}>
                        <Icon d={step === 1 ? 'mail' : step === 2 ? 'mail' : step === 3 ? 'lock' : 'check'} size={26} />
                    </div>

                    <h1>{head.title}</h1>
                    {step === 2 ? (
                        <p className="fp-desc">
                            Mã gồm 6 chữ số đã được gửi tới <b>{maskEmail(email.trim())}</b>. Mã có hiệu lực trong 10 phút.
                        </p>
                    ) : (
                        <p className="fp-desc">{head.desc}</p>
                    )}

                    {error && (
                        <div className="fp-alert err" role="alert">
                            <Icon d="alert" size={18} /> <span>{error}</span>
                        </div>
                    )}
                    {!error && info && step === 2 && (
                        <div className="fp-alert ok" role="status">
                            <Icon d="check" size={18} /> <span>{info}</span>
                        </div>
                    )}

                    {/* ---------- BƯỚC 1 ---------- */}
                    {step === 1 && (
                        <form onSubmit={sendCode} noValidate>
                            <label className="fp-label" htmlFor="fp-email">Địa chỉ Gmail</label>
                            <div className="fp-field">
                                <Icon d="mail" size={18} />
                                <input
                                    id="fp-email"
                                    type="email"
                                    inputMode="email"
                                    autoComplete="email"
                                    autoFocus
                                    placeholder="tenban@gmail.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <p className="fp-hint">Dùng đúng Gmail đã đăng ký với nhà trường. Chưa có? Hãy liên hệ giáo viên chủ nhiệm hoặc văn phòng để được liên kết.</p>
                            <button className="fp-btn" disabled={loading || !email.trim()}>
                                {loading ? <span className="fp-spin" /> : <>Gửi mã xác nhận <Icon d="arrow" size={18} /></>}
                            </button>
                        </form>
                    )}

                    {/* ---------- BƯỚC 2 ---------- */}
                    {step === 2 && (
                        <div>
                            <div className="fp-otp" role="group" aria-label="Mã xác nhận 6 chữ số">
                                {code.map((c, i) => (
                                    <input
                                        key={i}
                                        ref={(el) => { cellRefs.current[i] = el; }}
                                        className={c ? 'filled' : ''}
                                        inputMode="numeric"
                                        autoComplete={i === 0 ? 'one-time-code' : 'off'}
                                        maxLength={CODE_LEN}
                                        value={c}
                                        aria-label={`Chữ số ${i + 1}`}
                                        onChange={(e) => setDigit(i, e.target.value)}
                                        onKeyDown={(e) => onKey(i, e)}
                                        onFocus={(e) => e.target.select()}
                                        readOnly={loading}
                                    />
                                ))}
                            </div>

                            {devCode && (
                                <div className="fp-dev">
                                    Chế độ thử nghiệm: mã của bạn là <b>{devCode}</b>
                                </div>
                            )}

                            <button className="fp-btn" onClick={() => verify()} disabled={loading || codeStr.length !== CODE_LEN}>
                                {loading ? <span className="fp-spin" /> : <>Xác nhận mã <Icon d="arrow" size={18} /></>}
                            </button>

                            <div className="fp-row">
                                <button type="button" className="fp-link" onClick={changeEmail}>Đổi Gmail</button>
                                <button type="button" className="fp-link" onClick={resend} disabled={cooldown > 0 || loading}>
                                    {cooldown > 0 ? `Gửi lại mã sau ${cooldown}s` : 'Gửi lại mã'}
                                </button>
                            </div>
                            <p className="fp-hint center">Không thấy thư? Hãy kiểm tra mục Spam hoặc Quảng cáo trong Gmail.</p>
                        </div>
                    )}

                    {/* ---------- BƯỚC 3 ---------- */}
                    {step === 3 && (
                        <form onSubmit={reset} noValidate>
                            <label className="fp-label" htmlFor="fp-pw">Mật khẩu mới</label>
                            <div className="fp-field">
                                <Icon d="lock" size={18} />
                                <input
                                    id="fp-pw"
                                    type={showPw ? 'text' : 'password'}
                                    autoComplete="new-password"
                                    autoFocus
                                    placeholder="Nhập mật khẩu mới"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <button type="button" className="fp-eye" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
                                    <Icon d={showPw ? 'eyeOff' : 'eye'} size={18} />
                                </button>
                            </div>

                            <div className={`fp-meter lv${st.level}`} aria-hidden="true">
                                <span /><span /><span /><span />
                                <em>{st.label}</em>
                            </div>
                            <ul className="fp-rules">
                                {rl.map((r) => (
                                    <li key={r.text} className={r.ok ? 'ok' : ''}>
                                        <Icon d="check" size={14} /> {r.text}
                                    </li>
                                ))}
                            </ul>

                            <label className="fp-label" htmlFor="fp-cf">Nhập lại mật khẩu mới</label>
                            <div className={`fp-field ${mismatch ? 'bad' : ''}`}>
                                <Icon d="lock" size={18} />
                                <input
                                    id="fp-cf"
                                    type={showPw ? 'text' : 'password'}
                                    autoComplete="new-password"
                                    placeholder="Nhập lại để xác nhận"
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                />
                            </div>
                            {mismatch && <p className="fp-bad">Hai lần nhập chưa khớp nhau.</p>}

                            <button className="fp-btn" disabled={loading || !pwOk || !confirm || mismatch}>
                                {loading ? <span className="fp-spin" /> : <>Đổi mật khẩu <Icon d="arrow" size={18} /></>}
                            </button>
                        </form>
                    )}

                    {/* ---------- BƯỚC 4 ---------- */}
                    {step === 4 && (
                        <div>
                            <div className="fp-note">
                                Vì lý do bảo mật, bạn đã được đăng xuất khỏi mọi thiết bị khác. Nếu không phải bạn thực hiện, hãy báo ngay cho nhà trường.
                            </div>
                            <Link href="/login/student" className="fp-btn as-link">
                                Về trang đăng nhập <Icon d="arrow" size={18} />
                            </Link>
                        </div>
                    )}

                    {step !== 4 && (
                        <Link href="/login/student" className="fp-back">
                            <Icon d="back" size={16} /> Quay lại đăng nhập
                        </Link>
                    )}
                </section>
            </main>
        </div>
    );
}