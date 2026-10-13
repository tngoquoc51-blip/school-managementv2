'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Be_Vietnam_Pro } from 'next/font/google';
import '../login.css';

const beVietnam = Be_Vietnam_Pro({
    subsets: ['vietnamese', 'latin'],
    weight: ['400', '500', '600', '700', '800'],
    variable: '--font-be-vietnam',
});

/* ===== Họa tiết ===== */
const doodle = (c: string) => `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320' viewBox='0 0 320 320' fill='none' stroke='${c}' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'>
<g transform='translate(24 40)'><path d='M0 0h30M8 0c0 10-2 18-6 24M24 0v18c0 4 3 6 7 5'/></g>
<g transform='translate(120 30) rotate(-8)'><path d='M0 14l6-5 8 20 14-34h34'/></g>
<g transform='translate(236 24)'><path d='M0 44V0l56 44z'/><path d='M0 36h8v8'/></g>
<g transform='translate(52 150)'><circle r='22'/><path d='M0 0l16-16M0 0h22'/></g>
<g transform='translate(128 120) rotate(35)'><rect width='64' height='14' rx='2'/><path d='M64 0l14 7-14 7M50 0v14'/></g>
<g transform='translate(240 122)'><path d='M0 8c14-6 24-6 32 2 8-8 18-8 32-2v40c-14-6-24-6-32 2-8-8-18-8-32-2zM32 10v40'/></g>
<g transform='translate(30 222)'><circle cx='18' cy='16' r='14'/><path d='M12 34h12M13 39h10M18 30v-8'/></g>
<g transform='translate(110 240)'><path d='M0 10q10-18 20 0t20 0t20 0'/></g>
<g transform='translate(242 236)'><ellipse rx='26' ry='10'/><ellipse rx='26' ry='10' transform='rotate(60)'/><ellipse rx='26' ry='10' transform='rotate(120)'/><circle r='3'/></g>
<path d='M290 292v14M283 299h14'/>
<path d='M190 292l3 8 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1z'/>
<circle cx='96' cy='300' r='2.5'/><circle cx='168' cy='196' r='2.5'/><circle cx='20' cy='110' r='2.5'/>
</svg>`;

const doodleUrl = (c: string) => `url("data:image/svg+xml,${encodeURIComponent(doodle(c))}")`;

const FlowerShape = () => (
    <g>
        {[0, 72, 144, 216, 288].map((a) => (
            <path key={a} transform={`rotate(${a})`} d="M0 0C-16 -10 -20 -36 0 -46C20 -36 16 -10 0 0Z" fill="#e63946" stroke="#b3202d" strokeWidth="1.2" />
        ))}
        {[36, 108, 180, 252, 324].map((a) => (
            <path key={a} transform={`rotate(${a})`} d="M0 0C-8 -6 -10 -20 0 -26C10 -20 8 -6 0 0Z" fill="#ff7b84" opacity="0.85" />
        ))}
        <path d="M0 -8C-4 -14 -4 -26 0 -32C4 -26 4 -14 0 -8Z" fill="#ffc62b" />
        {[20, 92, 164, 236, 308].map((a) => (
            <g key={a} transform={`rotate(${a})`}>
                <path d="M0 0V-18" stroke="#ffc62b" strokeWidth="1.5" />
                <circle cy="-19" r="2.2" fill="#ffc62b" />
            </g>
        ))}
        <circle r="4" fill="#b3202d" />
    </g>
);

const Flower = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="-50 -50 100 100" aria-hidden="true">
        <FlowerShape />
    </svg>
);

const LEAF_CLUSTERS: [number, number, number][] = [
    [522, 30, 168], [470, 42, 166], [420, 58, 160], [372, 80, 152],
    [326, 108, 142], [286, 142, 132], [254, 182, 122], [232, 222, 112],
];
const FLOWERS: [number, number, number, number][] = [
    [410, 122, 10, 1.25], [300, 196, -20, 1.05], [484, 190, 30, 0.9],
    [238, 282, 15, 0.8], [352, 58, -30, 0.7],
];

const Branch = () => (
    <svg className="branch" viewBox="0 0 560 420" aria-hidden="true">
        <path d="M570 14C440 34 330 88 250 186C222 222 210 256 206 300" stroke="#8a5a44" strokeWidth="7" strokeLinecap="round" fill="none" />
        {LEAF_CLUSTERS.map(([x, y, r]) => (
            <g key={`${x}-${y}`} transform={`translate(${x} ${y}) rotate(${r})`}>
                {[-1, 1].map((s) =>
                    [0, 14, 28].map((o) => (
                        <ellipse key={`${s}-${o}`} cx={o} cy={s * (10 + o * 0.35)} rx="12" ry="4.2"
                                 transform={`rotate(${s * 38} ${o} ${s * (10 + o * 0.35)})`}
                                 fill={o === 14 ? '#2fb583' : '#1f9a6e'} />
                    ))
                )}
            </g>
        ))}
        {FLOWERS.map(([x, y, r, s]) => (
            <g key={`${x}-${y}`} transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
                <FlowerShape />
            </g>
        ))}
    </svg>
);

const LOOSE_PETALS = [
    { top: '58%', left: '8%', rot: 40, s: 0.9 },
    { top: '30%', left: '46%', rot: -25, s: 0.7 },
    { top: '72%', left: '40%', rot: 130, s: 1 },
    { top: '14%', left: '30%', rot: 80, s: 0.6 },
];

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const IconUser = () => (
    <svg viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
);
const IconLock = () => (
    <svg viewBox="0 0 24 24" {...stroke}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
);
const IconCheck = () => (
    <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2.4}><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.5" /></svg>
);
const IconStar = () => (
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" /></svg>
);
const IconArrow = () => (
    <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2.4}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

export default function AccountantLoginPage() {
    const router = useRouter();
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [remember, setRemember] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await new Promise((r) => setTimeout(r, 500));

            if (identifier.toLowerCase() === 'ketoan@thpt.edu.vn' && password === '123456') {
                localStorage.setItem('token', 'demo-token');
                localStorage.setItem('user', JSON.stringify({ name: 'Kế toán', email: identifier }));
                localStorage.setItem('roles', JSON.stringify(['accountant']));
                localStorage.setItem('current_role', 'accountant');
                router.push('/accountant/dashboard');
            } else {
                setError('Email hoặc mật khẩu không đúng');
            }
        } catch {
            setError('Có lỗi xảy ra, vui lòng thử lại');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`login-page ${beVietnam.variable}`}>
            {/* ================= TRÁI ================= */}
            <aside className="login-left">
                <div className="doodle-layer" style={{ backgroundImage: doodleUrl('rgba(255,255,255,0.13)') }} />
                <div className="sun" />
                <svg className="hill" viewBox="0 0 800 180" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M0 110C140 60 260 150 420 110S680 50 800 100V180H0Z" fill="rgba(255,255,255,0.05)" />
                    <path d="M0 150C160 110 300 180 470 142S700 110 800 140V180H0Z" fill="rgba(255,255,255,0.06)" />
                </svg>
                <Branch />
                {LOOSE_PETALS.map((p, i) => (
                    <svg key={i} className="loose-petal" viewBox="-24 -50 48 54"
                         style={{ top: p.top, left: p.left, transform: `rotate(${p.rot}deg) scale(${p.s})` }} aria-hidden="true">
                        <path d="M0 0C-16 -10 -20 -36 0 -46C20 -36 16 -10 0 0Z" fill="#e63946" opacity="0.85" />
                    </svg>
                ))}

                <div className="login-left-content">
                    <div className="login-brand">
                        <div className="login-logo">TH</div>
                        <div className="login-brand-name">
                            Trường THPT
                            <small>Năm học 2026 – 2027</small>
                        </div>
                    </div>

                    <h1><span>Cổng đăng nhập Kế toán</span></h1>
                    <p className="login-desc">
                        Dành cho bộ phận Kế toán – quản lý học phí, công nợ và báo cáo tài chính nhà trường.
                    </p>

                    <div className="logbook-wrap" aria-hidden="true">
                        <div className="logbook">
                            <div className="logbook-head">
                                <strong>Báo cáo thu học phí</strong>
                                <span>Tháng 10</span>
                            </div>
                            <div className="logbook-row">
                                <span className="logbook-period">Lớp 10</span>
                                <div className="logbook-subject">
                                    <b>Đã thu</b>
                                    <span>1.250 học sinh</span>
                                </div>
                                <span className="logbook-count">98%</span>
                            </div>
                            <div className="logbook-row">
                                <span className="logbook-period">Lớp 11</span>
                                <div className="logbook-subject">
                                    <b>Đã thu</b>
                                    <span>1.180 học sinh</span>
                                </div>
                                <span className="logbook-count">96%</span>
                            </div>
                            <div className="logbook-row">
                                <span className="logbook-period">Lớp 12</span>
                                <div className="logbook-subject">
                                    <b>Còn nợ</b>
                                    <span>42 học sinh</span>
                                </div>
                                <span className="logbook-count warn">4%</span>
                            </div>
                        </div>
                        <div className="chip chip-a"><IconCheck /> Đã đối soát</div>
                        <div className="chip chip-b"><IconStar /> Thu đủ 97%</div>
                    </div>
                    <p className="login-note">Dữ liệu minh hoạ</p>
                </div>
            </aside>

            {/* ================= PHẢI ================= */}
            <main className="login-right">
                <Flower className="right-flower f1" />
                <Flower className="right-flower f2" />

                <div className="login-box">
                    <div className="login-title">
                        <div className="login-title-flower"><Flower /></div>
                        <h2>Đăng nhập Kế toán</h2>
                    </div>
                    <p className="login-subtitle">Nhập email kế toán được nhà trường cấp</p>

                    <form onSubmit={handleLogin} noValidate>
                        {error && <div className="login-error" role="alert">{error}</div>}

                        <div className="form-group">
                            <label htmlFor="identifier">Email Kế toán</label>
                            <div className="input-wrap">
                                <IconUser />
                                <input
                                    id="identifier"
                                    type="text"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    placeholder="ketoan@thpt.edu.vn"
                                    autoComplete="username"
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">Mật khẩu</label>
                            <div className="input-wrap has-toggle">
                                <IconLock />
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Nhập mật khẩu"
                                    autoComplete="current-password"
                                    required
                                />
                                <button type="button" className="toggle-pass" onClick={() => setShowPassword(!showPassword)}>
                                    {showPassword ? 'Ẩn' : 'Hiện'}
                                </button>
                            </div>
                        </div>

                        <div className="form-options">
                            <label>
                                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                                Ghi nhớ đăng nhập
                            </label>
                            <Link href="/forgot-password">Quên mật khẩu?</Link>
                        </div>

                        <button type="submit" className="btn-login" disabled={loading || !identifier || !password}>
                            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                            {!loading && <span className="arrow"><IconArrow /></span>}
                        </button>
                    </form>

                    <p className="login-help">
                        Demo: <code>ketoan@thpt.edu.vn</code> / <code>123456</code>
                    </p>

                    <div className="login-footer">
                        <Link href="/">← Quay lại trang chủ</Link>
                    </div>
                </div>
            </main>
        </div>
    );
}