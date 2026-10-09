'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import './login.css';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('admin@thpt.edu.vn');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await new Promise((r) => setTimeout(r, 600));

            if (email === 'admin@thpt.edu.vn' && password === '123456') {
                localStorage.setItem('token', 'demo-token');
                localStorage.setItem('user', JSON.stringify({ name: 'Quản trị viên', email }));
                localStorage.setItem('roles', JSON.stringify(['super_admin']));
                router.push('/admin/dashboard');
            } else {
                setError('Email hoặc mật khẩu không chính xác');
            }
        } catch {
            setError('Có lỗi xảy ra, vui lòng thử lại');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            {/* LEFT */}
            <div className="login-left">
                <div className="login-left-content">
                    <div className="login-logo">TH</div>
                    <h1>Hệ thống Quản lý<br />Trường THPT</h1>
                    <p className="login-desc">
                        Quản lý toàn diện hoạt động dạy và học.<br />
                        Kết nối nhà trường – giáo viên – học sinh – phụ huynh.
                    </p>

                    <ul className="login-features">
                        <li><span>✓</span> Điểm danh & Sổ đầu bài điện tử</li>
                        <li><span>✓</span> Nhập điểm theo Thông tư 22</li>
                        <li><span>✓</span> Sổ liên lạc 2 chiều với phụ huynh</li>
                        <li><span>✓</span> Phân quyền theo phạm vi rõ ràng</li>
                    </ul>
                </div>
            </div>

            {/* RIGHT */}
            <div className="login-right">
                <div className="login-box">
                    <h2>Đăng nhập</h2>
                    <p className="login-subtitle">Vui lòng đăng nhập để tiếp tục sử dụng hệ thống</p>

                    <form onSubmit={handleLogin}>
                        {error && <div className="login-error">{error}</div>}

                        <div className="form-group">
                            <label>Email hoặc Mã định danh</label>
                            <input
                                type="text"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="admin@thpt.edu.vn"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Mật khẩu</label>
                            <div className="password-wrap">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Nhập mật khẩu"
                                    required
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}>
                                    {showPassword ? 'Ẩn' : 'Hiện'}
                                </button>
                            </div>
                        </div>

                        <div className="form-options">
                            <label>
                                <input type="checkbox" /> Ghi nhớ đăng nhập
                            </label>
                            <Link href="/forgot-password">Quên mật khẩu?</Link>
                        </div>

                        <button type="submit" className="btn-login" disabled={loading}>
                            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                        </button>
                    </form>

                    <div className="login-footer">
                        <Link href="/">← Quay lại trang chủ</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}