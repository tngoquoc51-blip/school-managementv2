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
            await new Promise((r) => setTimeout(r, 500)); // TODO: thay bằng gọi API đăng nhập

            if (identifier.trim().toLowerCase() === 'ketoan@thpt.edu.vn' && password === '123456') {
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
                <Branch />

                <div className="login-left-content">
                    <div className="login-brand">
                        <div className="login-logo">TH</div>
                        <div className="login-brand-name">
                            Trường THPT
                            <small>Năm học 2026 – 2027</small>
                        </div>
                    </div>

                    <h1>Cổng đăng nhập Kế toán</h1>
                    <p className="login-desc">Dành cho bộ phận Kế toán – quản lý học phí, công nợ và báo cáo tài chính nhà trường.</p>

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
                            <span>Khu vực dành cho Kế toán</span>
                            <Flower className="login-band-flower" />
                        </div>

                        <div className="login-body">
                            <h2>Đăng nhập Kế toán</h2>
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
                                            inputMode="email"
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
                                <code>ketoan@thpt.edu.vn</code> <code>123456</code>
                            </p>
                        </div>
                    </div>

                    <OtherPortals current="/login/accountant" />

                    <div className="login-footer">
                        <Link href="/">← Quay lại trang chủ</Link>
                    </div>
                </div>
            </main>
        </div>
    );
}