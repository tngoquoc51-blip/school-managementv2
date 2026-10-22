'use client';

import { useState, type ReactElement } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Be_Vietnam_Pro } from 'next/font/google';
import './login.css';

const beVietnam = Be_Vietnam_Pro({
    subsets: ['vietnamese', 'latin'],
    weight: ['400', '500', '600', '700', '800'],
    variable: '--font-be-vietnam',
});

/* ======================================================
   VAI TRÒ + TÀI KHOẢN DEMO
   ====================================================== */
/* ======================================================
   VAI TRÒ + TÀI KHOẢN DEMO
   ====================================================== */
type RoleKey = 'admin' | 'bgh' | 'teacher' | 'academic' | 'accountant' | 'student' | 'parent';

const ROLES: Record<
    RoleKey,
    { label: string; idLabel: string; idPlaceholder: string; redirect: string; roles: string[]; userName: string }
> = {
    admin: {
        label: 'Quản trị',
        idLabel: 'Email quản trị',
        idPlaceholder: 'admin@thpt.edu.vn',
        redirect: '/admin/dashboard',
        roles: ['super_admin'],
        userName: 'Quản trị viên',
    },
    bgh: {
        label: 'Ban Giám hiệu',
        idLabel: 'Email Ban Giám hiệu',
        idPlaceholder: 'hieutruong@thpt.edu.vn',
        redirect: '/bgh/dashboard',
        roles: ['principal', 'vice_principal'],
        userName: 'Ban Giám hiệu',
    },
    teacher: {
        label: 'Giáo viên',
        idLabel: 'Email hoặc mã giáo viên',
        idPlaceholder: 'VD: GV0001',
        redirect: '/teacher/dashboard',
        roles: ['teacher', 'homeroom_teacher', 'department_head'],
        userName: 'Giáo viên',
    },
    academic: {
        label: 'Giáo vụ',
        idLabel: 'Email Giáo vụ',
        idPlaceholder: 'giaovu@thpt.edu.vn',
        redirect: '/academic/dashboard',
        roles: ['academic'],
        userName: 'Giáo vụ',
    },
    accountant: {
        label: 'Kế toán',
        idLabel: 'Email Kế toán',
        idPlaceholder: 'ketoan@thpt.edu.vn',
        redirect: '/accountant/dashboard',
        roles: ['accountant'],
        userName: 'Kế toán',
    },
    student: {
        label: 'Học sinh',
        idLabel: 'Mã học sinh',
        idPlaceholder: 'VD: HS0001',
        redirect: '/student/dashboard',
        roles: ['student'],
        userName: 'Học sinh',
    },
    parent: {
        label: 'Phụ huynh',
        idLabel: 'Số điện thoại đã đăng ký',
        idPlaceholder: 'VD: 0900000000',
        redirect: '/parent/dashboard',
        roles: ['parent'],
        userName: 'Phụ huynh',
    },
};

/* TÀI KHOẢN DEMO */
const DEMO: Record<RoleKey, { id: string; password: string }> = {
    admin:      { id: 'admin@thpt.edu.vn', password: '123456' },
    bgh:        { id: 'hieutruong@thpt.edu.vn', password: '123456' },
    teacher:    { id: 'gv0001', password: '123456' },
    academic:   { id: 'giaovu@thpt.edu.vn', password: '123456' },
    accountant: { id: 'ketoan@thpt.edu.vn', password: '123456' },
    student:    { id: 'hs0001', password: '123456' },
    parent:     { id: '0900000000', password: '123456' },
};

/* ======================================================
   HỌA TIẾT
   ====================================================== */

/* Nét vẽ toán học / học đường, lát thành nền (như nháp trong vở) */
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

/* Một bông phượng 5 cánh (vẽ trong hộp -50..50) */
const FlowerShape = () => (
    <g>
        {[0, 72, 144, 216, 288].map((a) => (
            <path
                key={a}
                transform={`rotate(${a})`}
                d="M0 0C-16 -10 -20 -36 0 -46C20 -36 16 -10 0 0Z"
                fill="#e63946"
                stroke="#b3202d"
                strokeWidth="1.2"
            />
        ))}
        {[36, 108, 180, 252, 324].map((a) => (
            <path
                key={a}
                transform={`rotate(${a})`}
                d="M0 0C-8 -6 -10 -20 0 -26C10 -20 8 -6 0 0Z"
                fill="#ff7b84"
                opacity="0.85"
            />
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

/* Cành phượng buông từ góc phải */
const LEAF_CLUSTERS: [number, number, number][] = [
    [522, 30, 168],
    [470, 42, 166],
    [420, 58, 160],
    [372, 80, 152],
    [326, 108, 142],
    [286, 142, 132],
    [254, 182, 122],
    [232, 222, 112],
];
const FLOWERS: [number, number, number, number][] = [
    [410, 122, 10, 1.25],
    [300, 196, -20, 1.05],
    [484, 190, 30, 0.9],
    [238, 282, 15, 0.8],
    [352, 58, -30, 0.7],
];

const Branch = () => (
    <svg className="branch" viewBox="0 0 560 420" aria-hidden="true">
        <path
            d="M570 14C440 34 330 88 250 186C222 222 210 256 206 300"
            stroke="#8a5a44"
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
        />
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
                            fill={o === 14 ? '#2fb583' : '#1f9a6e'}
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
        {[
            [214, 226],
            [274, 112],
            [524, 108],
        ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="7" fill="#e63946" stroke="#b3202d" strokeWidth="1.2" />
        ))}
    </svg>
);

const LOOSE_PETALS = [
    { top: '58%', left: '8%', rot: 40, s: 0.9 },
    { top: '30%', left: '46%', rot: -25, s: 0.7 },
    { top: '72%', left: '40%', rot: 130, s: 1 },
    { top: '14%', left: '30%', rot: 80, s: 0.6 },
];

/* ======================================================
   ICON
   ====================================================== */
const stroke = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
};

const IconShield = () => (
    <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true">
        <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z" />
        <path d="M9 12l2 2 4-4" />
    </svg>
);
const IconBoard = () => (
    <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true">
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20l4-4 4 4M7 9h6M7 12h4" />
    </svg>
);
const IconCap = () => (
    <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true">
        <path d="M2 9l10-5 10 5-10 5L2 9z" />
        <path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" />
    </svg>
);
const IconFamily = () => (
    <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true">
        <circle cx="9" cy="7" r="3" />
        <path d="M3 20v-1a6 6 0 0 1 12 0v1" />
        <circle cx="18" cy="9" r="2.2" />
        <path d="M16.5 14.2A4.5 4.5 0 0 1 21 18.5V20" />
    </svg>
);
const IconUser = () => (
    <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
);
const IconLock = () => (
    <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true">
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
);
const IconCheck = () => (
    <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2.4} aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12.5l2.7 2.7L16 9.5" />
    </svg>
);
const IconStar = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" />
    </svg>
);
const IconArrow = () => (
    <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2.4} aria-hidden="true">
        <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
);

const IconBuilding = () => (
    <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true">
        <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h.01M15 10h.01M9 14h.01M15 14h.01" />
    </svg>
);

const IconClipboard = () => (
    <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 12h6M9 16h4" />
    </svg>
);

const IconMoney = () => (
    <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 6v12M15 9.5c0-1.5-1.3-2.5-3-2.5s-3 1-3 2.5 1.3 2.5 3 2.5 3 1 3 2.5-1.3 2.5-3 2.5" />
    </svg>
);

const ROLE_ICONS: Record<RoleKey, ReactElement> = {
    admin: <IconShield />,
    bgh: <IconBuilding />,
    teacher: <IconBoard />,
    academic: <IconClipboard />,
    accountant: <IconMoney />,
    student: <IconCap />,
    parent: <IconFamily />,
};

/* ======================================================
   TRANG ĐĂNG NHẬP
   ====================================================== */
export default function LoginPage() {
    const router = useRouter();
    const [role, setRole] = useState<RoleKey>('admin');
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [remember, setRemember] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const current = ROLES[role];

    const changeRole = (key: RoleKey) => {
        setRole(key);
        setIdentifier('');
        setPassword('');
        setError('');
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

            const res = await fetch(`${API}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    identifier: identifier.trim(),
                    password,
                }),
            });

            const json = await res.json();

            if (!res.ok || !json.success) {
                setError(json.message || 'Sai email/mã hoặc mật khẩu. Vui lòng kiểm tra lại.');
                return;
            }

            const apiRoles: string[] = Array.isArray(json.roles) ? json.roles : [];

            // Chưa gán role trong DB vẫn cho vào theo tab đang chọn
            const matchRole =
                apiRoles.length === 0 ||
                apiRoles.some((r) => current.roles.includes(r));

            if (!matchRole) {
                setError('Tài khoản không đúng với vai trò đã chọn.');
                return;
            }

            localStorage.setItem('token', json.token);
            localStorage.setItem('user', JSON.stringify(json.user));
            localStorage.setItem(
                'roles',
                JSON.stringify(apiRoles.length ? apiRoles : current.roles)
            );
            localStorage.setItem('current_role', role);

            router.push(current.redirect);
        } catch {
            setError('Không kết nối được máy chủ. Kiểm tra php artisan serve.');
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
                    <svg
                        key={i}
                        className="loose-petal"
                        viewBox="-24 -50 48 54"
                        style={{ top: p.top, left: p.left, transform: `rotate(${p.rot}deg) scale(${p.s})` }}
                        aria-hidden="true"
                    >
                        <path
                            d="M0 0C-16 -10 -20 -36 0 -46C20 -36 16 -10 0 0Z"
                            fill="#e63946"
                            opacity="0.85"
                        />
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

                    <h1>
                        <span>Quản lý trường học, từ tiết dạy đến sổ liên lạc</span>
                    </h1>
                    <p className="login-desc">
                        Giáo viên điểm danh, nhập điểm theo Thông tư 22. Phụ huynh theo dõi con ngay trong ngày.
                    </p>

                    <div className="logbook-wrap" aria-hidden="true">
                        <div className="logbook">
                            <div className="logbook-head">
                                <strong>Sổ đầu bài · Lớp 10A2</strong>
                                <span>Thứ Hai</span>
                            </div>
                            <div className="logbook-row">
                                <span className="logbook-period">Tiết 1</span>
                                <div className="logbook-subject">
                                    <b>Toán</b>
                                    <span>Hàm số bậc hai</span>
                                </div>
                                <span className="logbook-count">42/42 có mặt</span>
                            </div>
                            <div className="logbook-row">
                                <span className="logbook-period">Tiết 2</span>
                                <div className="logbook-subject">
                                    <b>Ngữ văn</b>
                                    <span>Truyện Kiều – đọc hiểu</span>
                                </div>
                                <span className="logbook-count warn">1 vắng</span>
                            </div>
                            <div className="logbook-row">
                                <span className="logbook-period">Tiết 3</span>
                                <div className="logbook-subject">
                                    <b>Tiếng Anh</b>
                                    <span>Unit 3 – Reading</span>
                                </div>
                                <span className="logbook-count">42/42 có mặt</span>
                            </div>
                        </div>
                        <div className="chip chip-a">
                            <IconCheck /> Đã điểm danh
                        </div>
                        <div className="chip chip-b">
                            <IconStar /> Điểm 15 phút Toán: 9,0
                        </div>
                    </div>
                    <p className="login-note">Dữ liệu minh hoạ</p>
                </div>
            </aside>

            {/* ================= PHẢI ================= */}
            <main className="login-right">
                <Flower className="right-flower f1" />
                <Flower className="right-flower f2" />

                <div className="mobile-brand">
                    <div className="login-logo">TH</div>
                    Trường THPT
                </div>

                <div className="login-box">
                    <div className="login-title">
                        <div className="login-title-flower">
                            <Flower />
                        </div>
                        <h2>Đăng nhập</h2>
                    </div>
                    <p className="login-subtitle">Chọn vai trò của bạn, sau đó nhập thông tin được nhà trường cấp.</p>

                    <span className="role-label" id="role-label">
                        Bạn là
                    </span>
                    <div className="role-tabs" role="tablist" aria-labelledby="role-label">
                        {(Object.keys(ROLES) as RoleKey[]).map((key) => (
                            <button
                                key={key}
                                type="button"
                                role="tab"
                                aria-selected={role === key}
                                className="role-tab"
                                onClick={() => changeRole(key)}
                            >
                                {ROLE_ICONS[key]}
                                {ROLES[key].label}
                            </button>
                        ))}
                    </div>

                    <form onSubmit={handleLogin} noValidate>
                        {error && (
                            <div className="login-error" role="alert">
                                {error}
                            </div>
                        )}

                        <div className="form-group">
                            <label htmlFor="identifier">{current.idLabel}</label>
                            <div className="input-wrap">
                                <IconUser />
                                <input
                                    id="identifier"
                                    type="text"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    placeholder={current.idPlaceholder}
                                    autoComplete="username"
                                    required
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
                                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                >
                                    {showPassword ? 'Ẩn' : 'Hiện'}
                                </button>
                            </div>
                        </div>

                        <div className="form-options">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={remember}
                                    onChange={(e) => setRemember(e.target.checked)}
                                />
                                Ghi nhớ đăng nhập
                            </label>
                            <Link href="/forgot-password">Quên mật khẩu?</Link>
                        </div>

                        <button type="submit" className="btn-login" disabled={loading || !identifier || !password}>
                            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                            {!loading && (
                                <span className="arrow">
                                    <IconArrow />
                                </span>
                            )}
                        </button>
                    </form>

                    {role === 'student' && (
                        <p className="login-help">
                            Chưa có tài khoản? Liên hệ giáo viên chủ nhiệm hoặc văn phòng nhà trường để được cấp mã học sinh.
                        </p>
                    )}
                    {role === 'parent' && (
                        <p className="login-help">
                            Dùng số điện thoại bạn đã đăng ký với nhà trường. Nếu chưa đăng ký, hãy liên hệ giáo viên chủ nhiệm.
                        </p>
                    )}
                    {process.env.NODE_ENV === 'development' && (
                        <p className="login-help">
                            Demo: <code>{DEMO[role].id}</code> / <code>{DEMO[role].password}</code>
                        </p>
                    )}

                    <div className="login-footer">
                        <Link href="/">← Quay lại trang chủ</Link>
                    </div>
                </div>
            </main>
        </div>
    );
}