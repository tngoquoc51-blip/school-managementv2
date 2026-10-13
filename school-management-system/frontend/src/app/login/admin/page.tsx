'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Be_Vietnam_Pro } from 'next/font/google';
import './login.css';

const beVietnam = Be_Vietnam_Pro({
    subsets: ['vietnamese', 'latin'],
    weight: ['400', '500', '600', '700'],
    variable: '--font-be-vietnam',
});

/* ===== Hoa phượng – họa tiết nhận diện của trường ===== */
const FlowerShape = () => (
    <g>
        {[0, 72, 144, 216, 288].map((a) => (
            <path key={a} transform={`rotate(${a})`} d="M0 0C-16 -10 -20 -36 0 -46C20 -36 16 -10 0 0Z" fill="#d63a33" stroke="#a52621" strokeWidth="1.2" />
        ))}
        {[36, 108, 180, 252, 324].map((a) => (
            <path key={a} transform={`rotate(${a})`} d="M0 0C-8 -6 -10 -20 0 -26C10 -20 8 -6 0 0Z" fill="#f0776f" opacity="0.85" />
        ))}
        {[20, 92, 164, 236, 308].map((a) => (
            <g key={a} transform={`rotate(${a})`}>
                <path d="M0 0V-18" stroke="#f2b632" strokeWidth="1.5" />
                <circle cy="-19" r="2.2" fill="#f2b632" />
            </g>
        ))}
        <circle r="4" fill="#a52621" />
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
                        <ellipse
                            key={`${s}-${o}`}
                            cx={o}
                            cy={s * (10 + o * 0.35)}
                            rx="12"
                            ry="4.2"
                            transform={`rotate(${s * 38} ${o} ${s * (10 + o * 0.35)})`}
                            fill={o === 14 ? '#47b98c' : '#2f9e73'}
                        />
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

/* ===== Icon ===== */
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const IconUser = () => (<svg viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>);
const IconLock = () => (<svg viewBox="0 0 24 24" {...stroke}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>);
const IconCheck = () => (<svg viewBox="0 0 24 24" {...stroke} strokeWidth={2.4}><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.5" /></svg>);
const IconShield = () => (<svg viewBox="0 0 24 24" {...stroke}><path d="M12 3l8 3v5c0 4.6-3.3 8.3-8 10-4.7-1.7-8-5.4-8-10V6l8-3z" /><path d="M9 12l2.2 2.2L15.5 10" /></svg>);
const IconArrow = () => (<svg viewBox="0 0 24 24" {...stroke} strokeWidth={2.4}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);

/* Dữ liệu minh họa cho thẻ xem trước */
const STATS: [string, string][] = [
    ['1.562', 'Tài khoản'],
    ['13', 'Vai trò'],
    ['38', 'Lớp học'],
];
const ATTENDANCE: [string, string, number][] = [
    ['K10', '97,8', 97.8],
    ['K11', '96,9', 96.9],
    ['K12', '98,2', 98.2],
];

/* Cổng đăng nhập của các vai trò khác (theo thư mục src/app/login/*) */
const OTHER_PORTALS: [string, string][] = [
    ['/login/bgh', 'Ban giám hiệu'],
    ['/login/academic', 'Giáo vụ'],
    ['/login/accountant', 'Kế toán'],
    ['/login/teacher', 'Giáo viên'],
    ['/login/student', 'Học sinh'],
    ['/login/parent', 'Phụ huynh'],
];

export default function AdminLoginPage() {
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

            if (identifier.toLowerCase() === 'admin@thpt.edu.vn' && password === '123456') {
                localStorage.setItem('token', 'demo-token');
                localStorage.setItem('user', JSON.stringify({ name: 'Quản trị viên', email: identifier }));
                localStorage.setItem('roles', JSON.stringify(['super_admin']));
                localStorage.setItem('current_role', 'super_admin');
                router.push('/admin/dashboard');
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
                <Branch />

                <div className="login-left-content">
                    <div className="login-brand">
                        <div className="login-logo">TH</div>
                        <div className="login-brand-name">
                            Trường THPT
                            <small>Năm học 2026 – 2027</small>
                        </div>
                    </div>

                    <h1>Quản lý trường học, từ sổ điểm đến sĩ số</h1>
                    <p className="login-desc">
                        Cổng dành cho quản trị hệ thống: tài khoản, phân quyền, cấu hình năm học và sao lưu dữ liệu.
                    </p>

                    <div className="logbook-wrap" aria-hidden="true">
                        <div className="logbook">
                            <div className="logbook-head">
                                <strong>Sổ theo dõi hôm nay</strong>
                                <span>Toàn trường</span>
                            </div>

                            <div className="lb-stats">
                                {STATS.map(([num, label]) => (
                                    <div key={label}>
                                        <b>{num}</b>
                                        <span>{label}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="lb-section">Chuyên cần theo khối</div>
                            {ATTENDANCE.map(([k, label, pct]) => (
                                <div className="lb-row" key={k}>
                                    <span className="logbook-period">{k}</span>
                                    <div className="lb-bar"><i style={{ width: `${pct}%` }} /></div>
                                    <span className="lb-val">{label}%</span>
                                </div>
                            ))}

                            <div className="logbook-row">
                                <span className="logbook-period">Log</span>
                                <div className="logbook-subject">
                                    <b>Nhật ký hệ thống</b>
                                    <span>2 thao tác cần xem lại</span>
                                </div>
                                <span className="logbook-count warn">Cảnh báo 2</span>
                            </div>
                        </div>
                        <div className="chip chip-a"><IconCheck /> Hệ thống ổn định</div>
                        <div className="chip chip-b"><IconShield /> Sao lưu tự động</div>
                    </div>
                    <p className="login-note">Dữ liệu minh họa</p>
                </div>
            </aside>

            {/* ================= PHẢI ================= */}
            <main className="login-right">
                <Flower className="right-flower f1" />
                <Flower className="right-flower f2" />

                <div className="login-right-inner">
                    <div className="login-box">
                        <div className="login-band">
                            <span className="login-band-icon"><IconShield /></span>
                            <span>Khu vực dành cho quản trị viên</span>
                            <Flower className="login-band-flower" />
                        </div>

                        <div className="login-body">
                            <h2>Đăng nhập Quản trị</h2>
                            <p className="login-subtitle">Nhập email quản trị được cấp</p>

                            <form onSubmit={handleLogin} noValidate>
                                {error && <div className="login-error" role="alert">{error}</div>}

                                <div className="form-group">
                                    <label htmlFor="identifier">Email quản trị</label>
                                    <div className="input-wrap">
                                        <IconUser />
                                        <input
                                            id="identifier"
                                            type="text"
                                            inputMode="email"
                                            value={identifier}
                                            onChange={(e) => setIdentifier(e.target.value)}
                                            placeholder="admin@thpt.edu.vn"
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
                                        <button
                                            type="button"
                                            className="toggle-pass"
                                            onClick={() => setShowPassword(!showPassword)}
                                            aria-pressed={showPassword}
                                            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                        >
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
                                    {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
                                    {!loading && <span className="arrow"><IconArrow /></span>}
                                </button>
                            </form>

                            <p className="login-help">
                                Tài khoản demo<br />
                                <code>admin@thpt.edu.vn</code> <code>123456</code>
                            </p>
                        </div>
                    </div>

                    <nav className="login-portals" aria-label="Cổng đăng nhập khác">
                        <span>Bạn không phải quản trị viên? Chọn cổng của bạn</span>
                        <ul>
                            {OTHER_PORTALS.map(([href, label]) => (
                                <li key={href}><Link href={href}>{label}</Link></li>
                            ))}
                        </ul>
                    </nav>

                    <div className="login-footer">
                        <Link href="/">← Quay lại trang chủ</Link>
                    </div>
                </div>
            </main>
        </div>
    );
}