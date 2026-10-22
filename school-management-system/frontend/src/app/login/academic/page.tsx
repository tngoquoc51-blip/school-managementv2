'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Be_Vietnam_Pro } from 'next/font/google';
import { api, getToken, saveSession } from '../../academic/_lib/api';
import './academic-login.css';

const font = Be_Vietnam_Pro({
    subsets: ['vietnamese', 'latin'],
    weight: ['400', '500', '600', '700', '800'],
    variable: '--font-be-vietnam',
});

export default function AcademicLoginPage() {
    const router = useRouter();
    const [u, setU] = useState('');
    const [p, setP] = useState('');
    const [show, setShow] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');

    useEffect(() => {
        if (getToken()) router.replace('/academic/dashboard');
    }, [router]);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (!u.trim() || !p) {
            setErr('Vui lòng nhập tên đăng nhập và mật khẩu.');
            return;
        }
        setBusy(true);
        setErr('');
        try {
            const d = await api<{ token: string; staff: any }>('login', {
                method: 'POST',
                body: { username: u.trim(), password: p },
            });
            saveSession(d.token, d.staff);
            router.replace('/academic/dashboard');
        } catch (ex: any) {
            setErr(ex?.message || 'Đăng nhập thất bại.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={`al-page ${font.variable} ${font.className}`}>
            {/* ===== Cột trái ===== */}
            <aside className="al-left">
                <div className="al-left-bg" aria-hidden />
                <div className="al-left-inner">
                    <Link href="/" className="al-back">
                        ← Trang chủ
                    </Link>

                    <div className="al-left-main">
                        <span className="al-badge">Cổng Giáo vụ · Ban giám hiệu</span>
                        <h1>
                            Quản lý đào tạo
                            <br />
                            tập trung &amp; chính xác
                        </h1>
                        <p>
                            Hồ sơ học sinh, phân công giảng dạy, thời khóa biểu, lịch thi, điểm số và xét lên
                            lớp — trên một hệ thống thống nhất.
                        </p>
                        <ul className="al-feats">
                            <li>Duyệt đề nghị chỉnh sửa hồ sơ học sinh</li>
                            <li>Phân công giáo viên, kiểm tra trùng lịch</li>
                            <li>Báo cáo học lực – hạnh kiểm theo khối, lớp</li>
                        </ul>
                    </div>

                    <footer className="al-left-foot">
                        © Trường THPT · Hệ thống quản lý nhà trường
                    </footer>
                </div>
            </aside>

            {/* ===== Cột phải ===== */}
            <main className="al-right">
                <div className="al-card">
                    <div className="al-card-logo">GV</div>
                    <h2>Đăng nhập</h2>
                    <p className="al-card-sub">
                        Dành cho Giáo vụ, Hiệu trưởng, Phó hiệu trưởng và Quản trị hệ thống.
                    </p>

                    {err && (
                        <div className="al-err" role="alert">
                            {err}
                        </div>
                    )}

                    <form onSubmit={submit} noValidate>
                        <label className="al-field">
                            <span>Tên đăng nhập</span>
                            <input
                                value={u}
                                onChange={(e) => setU(e.target.value)}
                                autoComplete="username"
                                placeholder="VD: giaovu01"
                                autoFocus
                            />
                        </label>

                        <label className="al-field">
                            <span>Mật khẩu</span>
                            <div className="al-pw">
                                <input
                                    type={show ? 'text' : 'password'}
                                    value={p}
                                    onChange={(e) => setP(e.target.value)}
                                    autoComplete="current-password"
                                    placeholder="Nhập mật khẩu"
                                />
                                <button type="button" onClick={() => setShow(!show)}>
                                    {show ? 'Ẩn' : 'Hiện'}
                                </button>
                            </div>
                        </label>

                        <button
                            type="submit"
                            className="al-btn"
                            disabled={busy || !u.trim() || !p}
                        >
                            {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
                        </button>
                    </form>

                    <p className="al-hint">
                        Demo: <code>giaovu</code> / <code>123456</code> (nếu API local hỗ trợ)
                    </p>
                    <p className="al-foot">
                        Chưa có tài khoản? Liên hệ quản trị hệ thống để được cấp.
                    </p>
                </div>
            </main>
        </div>
    );
}