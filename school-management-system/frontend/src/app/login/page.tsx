'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/services/api';
import './login.css';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [remember, setRemember] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await api.post('/auth/login', { email, password });
            const { token, user, roles } = res.data;

            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('roles', JSON.stringify(roles));

            if (roles.length === 1) {
                redirectByRole(roles[0]);
            } else {
                router.push('/select-role');
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Đăng nhập thất bại');
        } finally {
            setLoading(false);
        }
    };

    const redirectByRole = (role: string) => {
        const map: Record<string, string> = {
            super_admin: '/admin/dashboard',
            principal: '/bgh/dashboard',
            vice_principal: '/bgh/dashboard',
            teacher: '/teacher/dashboard',
            homeroom_teacher: '/homeroom/dashboard',
            academic: '/academic/dashboard',
            student: '/student/dashboard',
            parent: '/parent/dashboard',
        };
        router.push(map[role] || '/');
    };

    return (
        <div className="login-page">
            {/* Bên trái - Branding */}
            <div className="login-left">
                <div className="login-brand">
                    <div className="login-logo">TH</div>
                    <h1 className="login-left-title">
                        Hệ thống Quản lý<br />Trường THPT
                    </h1>
                    <p className="login-left-desc">
                        Quản lý toàn diện hoạt động dạy và học – Kết nối nhà trường, giáo viên, học sinh và phụ huynh
                    </p>
                    <ul className="login-features">
                        <li><span>✓</span> Điểm danh & Sổ đầu bài điện tử</li>
                        <li><span>✓</span> Nhập điểm theo Thông tư 22</li>
                        <li><span>✓</span> Sổ liên lạc 2 chiều với phụ huynh</li>
                        <li><span>✓</span> Phân quyền theo phạm vi rõ ràng</li>
                    </ul>
                </div>
            </div>

            {/* Bên phải - Form */}
            <div className="login-right">
                <div className="login-form-wrapper">
                    <div className="login-form-header">
                        <h2 className="login-form-title">Đăng nhập</h2>
                        <p className="login-form-subtitle">Vui lòng đăng nhập để tiếp tục</p>
                    </div>

                    <form onSubmit={handleLogin} className="login-form">
                        {error && <div className="login-error">{error}</div>}

                        <div className="login-field">
                            <label className="login-label">Email hoặc Mã định danh</label>
                            <input
                                type="text"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="login-input"
                                placeholder="Nhập email hoặc mã GV/HS"
                                required
                            />
                        </div>

                        <div className="login-field">
                            <label className="login-label">Mật khẩu</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="login-input"
                                placeholder="Nhập mật khẩu"
                                required
                            />
                        </div>

                        <div className="login-options">
                            <label className="login-remember">
                                <input
                                    type="checkbox"
                                    checked={remember}
                                    onChange={(e) => setRemember(e.target.checked)}
                                />
                                Ghi nhớ đăng nhập
                            </label>
                            <Link href="/forgot-password" className="login-forgot">
                                Quên mật khẩu?
                            </Link>
                        </div>

                        <button type="submit" disabled={loading} className="login-submit">
                            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                        </button>
                    </form>

                    <p className="login-footer">
                        Hệ thống quản lý trường Trung học Phổ thông
                    </p>

                    <Link href="/" className="login-back">
                        ← Quay lại trang chủ
                    </Link>
                </div>
            </div>
        </div>
    );
}