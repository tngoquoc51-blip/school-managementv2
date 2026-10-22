'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Be_Vietnam_Pro } from 'next/font/google';
import { api, getToken, saveSession } from '../../academic/_lib/api';
import './academic-login.css';

const font = Be_Vietnam_Pro({ subsets: ['vietnamese', 'latin'], weight: ['400', '500', '600', '700'], fallback: ['system-ui', 'Segoe UI', 'Arial', 'sans-serif'] });

export default function AcademicLogin() {
    const router = useRouter();
    const [u, setU] = useState('');
    const [p, setP] = useState('');
    const [show, setShow] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');

    useEffect(() => { if (getToken()) router.replace('/academic/dashboard'); }, [router]);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (!u.trim() || !p) { setErr('Vui lòng nhập tên đăng nhập và mật khẩu.'); return; }
        setBusy(true); setErr('');
        try {
            const d = await api<{ token: string; staff: any }>('login', { method: 'POST', body: { username: u.trim(), password: p } });
            saveSession(d.token, d.staff);
            router.replace('/academic/dashboard');
        } catch (ex: any) {
            setErr(ex.message);
        } finally { setBusy(false); }
    };

    return (
        <div className={`al-root ${font.className}`}>
            <section className="al-hero">
                <Link href="/" className="al-back">← Trang chủ</Link>
                <div>
                    <span className="al-badge">Cổng Giáo vụ · Ban giám hiệu</span>
                    <h1>Quản lý đào tạo<br />tập trung &amp; chính xác</h1>
                    <p>Hồ sơ học sinh, phân công giảng dạy, thời khóa biểu, lịch thi, điểm số và xét lên lớp — trên một hệ thống thống nhất.</p>
                    <ul>
                        <li>Duyệt đề nghị chỉnh sửa hồ sơ của học sinh</li>
                        <li>Phân công giáo viên, kiểm tra trùng lịch tự động</li>
                        <li>Báo cáo học lực – hạnh kiểm theo khối, theo lớp</li>
                    </ul>
                </div>
                <small>© Trường THPT · Hệ thống quản lý nhà trường</small>
            </section>
            <section className="al-form-wrap">
                <form className="al-form" onSubmit={submit} noValidate>
                    <h2>Đăng nhập</h2>
                    <p className="al-sub">Dành cho Giáo vụ, Hiệu trưởng, Phó hiệu trưởng và Quản trị hệ thống.</p>
                    {err && <div className="al-err" role="alert">{err}</div>}
                    <label>Tên đăng nhập
                        <input value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" placeholder="VD: giaovu01" autoFocus />
                    </label>
                    <label>Mật khẩu
                        <span className="al-pw">
              <input type={show ? 'text' : 'password'} value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" placeholder="••••••••" />
              <button type="button" onClick={() => setShow(!show)}>{show ? 'Ẩn' : 'Hiện'}</button>
            </span>
                    </label>
                    <button className="al-submit" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
                    <p className="al-foot">Chưa có tài khoản? Liên hệ quản trị hệ thống để được cấp.</p>
                </form>
            </section>
        </div>
    );
}
