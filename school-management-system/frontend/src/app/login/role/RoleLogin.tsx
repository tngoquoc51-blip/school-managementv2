'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Be_Vietnam_Pro } from 'next/font/google';
import '../../design-tokens.css'; // src/app/design-tokens.css
import './role-login.css';

const beVietnam = Be_Vietnam_Pro({
    subsets: ['vietnamese', 'latin'],
    weight: ['400', '500', '600', '700', '800'],
    variable: '--font-be-vietnam',
});

/* ======================================================
   CẤU HÌNH 3 VAI TRÒ QUẢN TRỊ
   (khớp với 3 đường dẫn của /quan-tri)
   ====================================================== */
export type RoleKey = 'admin' | 'bgh' | 'accountant';

const ROLES: Record<
    RoleKey,
    {
        no: string;
        name: string;
        desc: string;
        tasks: string[];
        idLabel: string;
        idPlaceholder: string;
        redirect: string;
        roles: string[];
        userName: string;
        demo: { id: string; password: string };
        icon: ReactNode;
    }
> = {
    admin: {
        no: '01',
        name: 'Quản trị hệ thống',
        desc: 'Quản lý tài khoản, phân quyền và cấu hình toàn hệ thống của nhà trường.',
        tasks: ['Cấp tài khoản và phân quyền', 'Thiết lập năm học, học kỳ', 'Sao lưu và khôi phục dữ liệu'],
        idLabel: 'Email quản trị',
        idPlaceholder: 'ten@truong.edu.vn',
        redirect: '/admin/dashboard',
        roles: ['super_admin'],
        userName: 'Quản trị viên',
        demo: { id: 'admin@thpt.edu.vn', password: '123456' },
        icon: (<><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></>),
    },
    bgh: {
        no: '02',
        name: 'Ban Giám hiệu',
        desc: 'Điều hành, phê duyệt và theo dõi tình hình toàn trường cho Hiệu trưởng và Phó Hiệu trưởng.',
        tasks: ['Xem bảng điều khiển toàn trường', 'Phê duyệt kế hoạch, báo cáo', 'Theo dõi thi đua, chuyên cần'],
        idLabel: 'Email hoặc mã cán bộ',
        idPlaceholder: 'VD: BGH0001',
        redirect: '/bgh/dashboard', // TODO: đổi theo route thật của BGH
        roles: ['principal'],
        userName: 'Ban Giám hiệu',
        demo: { id: 'BGH0001', password: '123456' },
        icon: (<><path d="M3 10l9-6 9 6z" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18" /></>),
    },
    accountant: {
        no: '03',
        name: 'Kế toán',
        desc: 'Quản lý học phí, công nợ, thu chi và báo cáo tài chính của nhà trường.',
        tasks: ['Thu học phí, lập phiếu thu', 'Theo dõi công nợ, nhắc nợ', 'Sổ quỹ và báo cáo tài chính'],
        idLabel: 'Email hoặc mã cán bộ',
        idPlaceholder: 'VD: KT0001',
        redirect: '/accountant/dashboard',
        roles: ['accountant'],
        userName: 'Kế toán',
        demo: { id: 'KT0001', password: '123456' },
        icon: (<><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></>),
    },
};

const OTHER_LINKS: Record<RoleKey, string> = {
    admin: '/login/admin',
    bgh: '/login/bgh',
    accountant: '/login/accountant',
};

/* ---------- Icon ---------- */
const Svg = ({ children }: { children: ReactNode }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
    </svg>
);
const Shield = (<><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></>);

/* ======================================================
   COMPONENT
   ====================================================== */
export default function RoleLogin({ role }: { role: RoleKey }) {
    const router = useRouter();
    const cfg = ROLES[role];

    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [remember, setRemember] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await new Promise((r) => setTimeout(r, 600)); // TODO: thay bằng gọi API đăng nhập

            if (identifier.trim() === cfg.demo.id && password === cfg.demo.password) {
                // Ghi nhớ → localStorage · không ghi nhớ → sessionStorage
                const store = remember ? localStorage : sessionStorage;
                store.setItem('token', 'demo-token');
                store.setItem('user', JSON.stringify({ name: cfg.userName, id: identifier.trim() }));
                store.setItem('roles', JSON.stringify(cfg.roles));
                router.push(cfg.redirect);
            } else {
                setError(`Sai ${cfg.idLabel.toLowerCase()} hoặc mật khẩu. Hãy kiểm tra lại và chắc chắn bạn đang ở đúng cổng "${cfg.name}".`);
            }
        } catch {
            setError('Không kết nối được hệ thống. Vui lòng thử lại sau ít phút.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`rl-page ${role} ${beVietnam.variable}`}>
            {/* ================= TRÁI ================= */}
            <aside className="rl-left">
                <div className="rl-left-in">
                    <div className="rl-brand">
                        <div className="rl-logo"><Svg>{Shield}</Svg></div>
                        <div>
                            <b>Cổng Quản trị</b>
                            <small>Hệ thống Quản lý Trường THPT</small>
                        </div>
                    </div>

                    <div className="rl-role-tile"><Svg>{cfg.icon}</Svg></div>
                    <h1>Cổng {cfg.name}</h1>
                    <p className="rl-desc">{cfg.desc}</p>

                    <p className="rl-tasks-title">Bạn có thể</p>
                    <ul className="rl-tasks">
                        {cfg.tasks.map((t) => (
                            <li key={t}>
                                <span><Svg><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg></span>
                                {t}
                            </li>
                        ))}
                    </ul>

                    <div className="rl-note">
                        <Svg><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Svg>
                        Chỉ dành cho cán bộ được nhà trường cấp tài khoản. Mọi phiên đăng nhập được kiểm soát theo vai trò.
                    </div>
                </div>
            </aside>

            {/* ================= PHẢI ================= */}
            <main className="rl-right">
                <div className="rl-mobile-brand">
                    <div className="rl-logo"><Svg>{cfg.icon}</Svg></div>
                    Cổng {cfg.name}
                </div>

                <div className="rl-box">
                    <Link href="/quan-tri" className="rl-back">
                        <Svg><path d="M19 12H5M11 6l-6 6 6 6" /></Svg>
                        Quay lại Cổng Quản trị
                    </Link>

                    <div className="rl-badge">
                        <i><Svg>{cfg.icon}</Svg></i>
                        Cổng {cfg.no} · {cfg.name}
                    </div>
                    <h2>Đăng nhập</h2>
                    <p className="rl-sub">Nhập thông tin tài khoản do nhà trường cấp để tiếp tục.</p>

                    <form onSubmit={handleLogin} noValidate>
                        {error && <div className="rl-error" role="alert">{error}</div>}

                        <div className="rl-field">
                            <label htmlFor="identifier">{cfg.idLabel}</label>
                            <div className="rl-input">
                                <Svg><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Svg>
                                <input
                                    id="identifier"
                                    type="text"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    placeholder={cfg.idPlaceholder}
                                    autoComplete="username"
                                    required
                                />
                            </div>
                        </div>

                        <div className="rl-field">
                            <label htmlFor="password">Mật khẩu</label>
                            <div className="rl-input has-toggle">
                                <Svg><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Svg>
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
                                    className="rl-toggle"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                >
                                    {showPassword ? 'Ẩn' : 'Hiện'}
                                </button>
                            </div>
                        </div>

                        <div className="rl-options">
                            <label>
                                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                                Ghi nhớ đăng nhập
                            </label>
                            <Link href="/forgot-password">Quên mật khẩu?</Link>
                        </div>

                        <button type="submit" className="rl-submit" disabled={loading || !identifier || !password}>
                            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                            {!loading && <Svg><path d="M5 12h14M13 6l6 6-6 6" /></Svg>}
                        </button>
                    </form>

                    {process.env.NODE_ENV === 'development' && (
                        <p className="rl-demo">
                            Demo: <code>{cfg.demo.id}</code> / <code>{cfg.demo.password}</code>
                        </p>
                    )}

                    <div className="rl-others">
                        <span>Cổng khác:</span>
                        {(Object.keys(ROLES) as RoleKey[])
                            .filter((k) => k !== role)
                            .map((k) => (
                                <Link key={k} href={OTHER_LINKS[k]}>{ROLES[k].name}</Link>
                            ))}
                    </div>
                </div>
            </main>
        </div>
    );
}