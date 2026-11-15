'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Be_Vietnam_Pro } from 'next/font/google';
import '../login.css';
import { Branch, Flower, IconArrow, IconCheck, IconLock, IconShield, IconStar, IconUser, OtherPortals } from '../_shared/parts';

const beVietnam = Be_Vietnam_Pro({
    subsets: ['vietnamese', 'latin'],
    weight: ['400', '500', '600', '700'],
    variable: '--font-be-vietnam',
});

export default function BghLoginPage() {
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
            // username: hieutruong@thpt.edu.vn → hieutruong
            const raw = identifier.trim();
            const username = raw.toLowerCase().replace(/@thpt\.edu\.vn$/i, '');

            const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

            const res = await fetch(`${API}/gv/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const json = await res.json().catch(() => ({} as any));

            if (!res.ok) {
                if (res.status === 423) {
                    setError('Tài khoản đang bị khóa. Liên hệ quản trị.');
                } else if (res.status === 401 || res.status === 422) {
                    setError(json.message || 'Email hoặc mật khẩu không đúng');
                } else {
                    setError(json.message || 'Đăng nhập thất bại');
                }
                return;
            }

            const payload = json.data ?? json;
            const token: string | undefined = payload.token;
            if (!token) {
                setError('Máy chủ không trả về phiên đăng nhập');
                return;
            }

            const staff = payload.staff ?? {};
            const role = String(staff.role || 'principal').toLowerCase();

            // Chỉ BGH được vào cổng này
            if (!['principal', 'vice_principal', 'bgh'].includes(role)) {
                setError('Tài khoản này không thuộc Ban Giám hiệu');
                return;
            }

            const store = remember ? localStorage : sessionStorage;
            ['token', 'user', 'roles', 'current_role'].forEach((k) => {
                localStorage.removeItem(k);
                sessionStorage.removeItem(k);
            });

// BGH: luôn localStorage để layout / API đọc được
            localStorage.setItem('token', token);
            localStorage.setItem(
                'user',
                JSON.stringify({
                    name: staff.full_name || staff.name || 'Ban Giám hiệu',
                    email: raw,
                    username: staff.username || username,
                    role,
                }),
            );
            localStorage.setItem('roles', JSON.stringify([role]));
            localStorage.setItem('current_role', 'bgh');

            router.push('/bgh/dashboard');
        } catch {
            setError('Không kết nối được máy chủ. Kiểm tra API đang chạy.');
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

                    <h1>Cổng đăng nhập Ban Giám hiệu</h1>
                    <p className="login-desc">Dành cho Hiệu trưởng và Phó Hiệu trưởng – điều hành, phê duyệt và theo dõi toàn trường.</p>

                    <div className="logbook-wrap" aria-hidden="true">
                        <div className="logbook">
                            <div className="logbook-head">
                                <strong>Bảng điều khiển BGH</strong>
                                <span>Tuần này</span>
                            </div>
                            <div className="logbook-row">
                                <span className="logbook-period">HS</span>
                                <div className="logbook-subject">
                                    <b>Học sinh</b>
                                    <span>1.245 học sinh</span>
                                </div>
                                <span className="logbook-count">100%</span>
                            </div>
                            <div className="logbook-row">
                                <span className="logbook-period">GV</span>
                                <div className="logbook-subject">
                                    <b>Giáo viên</b>
                                    <span>86 giáo viên</span>
                                </div>
                                <span className="logbook-count">OK</span>
                            </div>
                            <div className="logbook-row">
                                <span className="logbook-period">PD</span>
                                <div className="logbook-subject">
                                    <b>Chờ phê duyệt</b>
                                    <span>12 đề xuất</span>
                                </div>
                                <span className="logbook-count warn">Cần xử lý</span>
                            </div>
                        </div>
                        <div className="chip chip-a"><IconCheck /> Đã duyệt 8</div>
                        <div className="chip chip-b"><IconStar /> Báo cáo tuần</div>
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
                            <span>Khu vực dành cho Ban Giám hiệu</span>
                            <Flower className="login-band-flower" />
                        </div>

                        <div className="login-body">
                            <h2>Đăng nhập Ban Giám hiệu</h2>
                            <p className="login-subtitle">Nhập email Ban Giám hiệu được cấp</p>

                            <form onSubmit={handleLogin} noValidate>
                                {error && <div className="login-error" role="alert">{error}</div>}

                                <div className="form-group">
                                    <label htmlFor="identifier">Email Ban Giám hiệu</label>
                                    <div className="input-wrap">
                                        <IconUser />
                                        <input
                                            id="identifier"
                                            type="text"
                                            inputMode="email"
                                            value={identifier}
                                            onChange={(e) => setIdentifier(e.target.value)}
                                            placeholder="hieutruong@thpt.edu.vn"
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
                                <code>hieutruong@thpt.edu.vn</code> <code>123456</code>
                            </p>
                        </div>
                    </div>

                    <OtherPortals current="/login/bgh" />

                    <div className="login-footer">
                        <Link href="/">← Quay lại trang chủ</Link>
                    </div>
                </div>
            </main>
        </div>
    );
}