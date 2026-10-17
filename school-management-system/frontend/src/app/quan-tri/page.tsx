import Link from 'next/link';
import { Be_Vietnam_Pro } from 'next/font/google';
import type { ReactElement, ReactNode } from 'react';
import '../design-tokens.css';
import './quan-tri.css';

/* CỔNG QUẢN TRỊ – http://localhost:3000/quan-tri
   Chỉ: Admin · Ban Giám hiệu · Kế toán
   Không link từ trang chủ công khai
   CSS riêng: quan-tri.css (không dùng chung home.css) */

const beVietnam = Be_Vietnam_Pro({
    subsets: ['vietnamese', 'latin'],
    weight: ['400', '500', '600', '700', '800'],
    variable: '--font-be-vietnam',
});

/* ====================== DỮ LIỆU ====================== */
const roles: {
    key: 'admin' | 'bgh' | 'acc';
    href: string;
    name: string;
    note: string;
    tasks: string[];
    icon: ReactElement;
}[] = [
    {
        key: 'admin',
        href: '/login/admin',
        name: 'Quản trị hệ thống',
        note: 'Quản lý tài khoản, phân quyền và cấu hình toàn hệ thống.',
        tasks: ['Phân quyền', 'Năm học, học kỳ', 'Báo cáo', 'Sao lưu dữ liệu'],
        icon: (<><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></>),
    },
    {
        key: 'bgh',
        href: '/login/bgh',
        name: 'Ban Giám hiệu',
        note: 'Hiệu trưởng và Phó Hiệu trưởng điều hành, phê duyệt.',
        tasks: ['Bảng điều khiển', 'Phê duyệt', 'Báo cáo toàn trường', 'Thi đua'],
        icon: (<><path d="M3 10l9-6 9 6z" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18" /></>),
    },
    {
        key: 'acc',
        href: '/login/accountant',
        name: 'Kế toán',
        note: 'Quản lý học phí, công nợ và thu chi của nhà trường.',
        tasks: ['Học phí', 'Công nợ', 'Thu chi', 'Báo cáo tài chính'],
        icon: (<><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></>),
    },
];

/* Ma trận quyền mặc định: full = toàn quyền · view = chỉ xem · none = không có */
type Level = 'full' | 'view' | 'none';
const matrix: { feature: string; admin: Level; bgh: Level; acc: Level }[] = [
    { feature: 'Quản lý tài khoản & phân quyền', admin: 'full', bgh: 'none', acc: 'none' },
    { feature: 'Cấu hình năm học, học kỳ', admin: 'full', bgh: 'view', acc: 'none' },
    { feature: 'Sao lưu & khôi phục dữ liệu', admin: 'full', bgh: 'none', acc: 'none' },
    { feature: 'Báo cáo toàn trường', admin: 'full', bgh: 'full', acc: 'none' },
    { feature: 'Phê duyệt & thi đua', admin: 'view', bgh: 'full', acc: 'none' },
    { feature: 'Học phí & công nợ', admin: 'view', bgh: 'view', acc: 'full' },
    { feature: 'Thu chi & báo cáo tài chính', admin: 'view', bgh: 'view', acc: 'full' },
];

const steps = [
    { title: 'Đăng nhập đúng cổng', text: 'Dùng tài khoản do Quản trị viên cấp và chọn cổng theo vai trò của bạn.' },
    { title: 'Xác thực & phân quyền', text: 'Hệ thống kiểm tra danh tính, chỉ mở những chức năng thuộc phạm vi vai trò.' },
    { title: 'Làm việc & ghi nhận', text: 'Các thao tác quan trọng được ghi lại để đối chiếu và truy vết khi cần.' },
];

const stats = [
    ['3', 'Vai trò quản trị'],
    ['TT 22', 'Chuẩn Bộ GD&ĐT'],
    ['RBAC', 'Phân quyền theo vai trò'],
    ['Nội bộ', 'Không công khai'],
];

/* ====================== ICON ====================== */
const Svg = ({ children, size = 24 }: { children: ReactNode; size?: number }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
    </svg>
);

const Arrow = () => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
);

const Shield = (
    <><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></>
);

function LevelCell({ level }: { level: Level }) {
    if (level === 'full')
        return (
            <span className="qt-level full">
                <Svg size={14}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>Toàn quyền
            </span>
        );
    if (level === 'view')
        return (
            <span className="qt-level view">
                <Svg size={14}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Svg>Chỉ xem
            </span>
        );
    return <span className="qt-level none" aria-label="Không có quyền">—</span>;
}

/* Năm học tự tính: từ tháng 8 là năm học mới */
function schoolYear(d = new Date()) {
    const start = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
    return `${start} – ${start + 1}`;
}

/* ====================== TRANG ====================== */
export default function QuanTriPortal() {
    return (
        <div className={`qt-page ${beVietnam.variable}`}>
            {/* ---------- THANH TIỆN ÍCH ---------- */}
            <div className="qt-topbar">
                <div className="qt-wrap">
                    <span>
                        <Svg size={14}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Svg>
                        Hệ thống Quản lý Trường THPT
                    </span>
                    <span>Năm học {schoolYear()}</span>
                </div>
            </div>

            {/* ---------- NAV ---------- */}
            <header className="qt-nav">
                <div className="qt-wrap">
                    <Link href="/quan-tri" className="qt-brand">
                        <span className="qt-logo"><Svg>{Shield}</Svg></span>
                        <span>
                            <b>Cổng Quản trị</b>
                            <small>Nội bộ nhà trường · Không công khai</small>
                        </span>
                    </Link>
                    <nav className="qt-links" aria-label="Điều hướng">
                        <a href="#vai-tro">Vai trò</a>
                        <a href="#phan-quyen">Phân quyền</a>
                        <a href="#quy-trinh">Quy trình</a>
                    </nav>
                    <Link href="/login/admin" className="qt-btn primary small">Đăng nhập quản trị</Link>
                </div>
            </header>

            <main>
                {/* ---------- HERO ---------- */}
                <section className="qt-hero">
                    <div className="qt-blob b1" /><div className="qt-blob b2" /><div className="qt-blob b3" />
                    <div className="qt-wrap">
                        <div>
                            <div className="qt-eyebrow">
                                <Svg size={16}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Svg>
                                Khu vực nội bộ · Chỉ dành cho cán bộ quản lý
                            </div>
                            <h1>
                                Cổng Quản trị &amp; <span className="qt-grad">Ban Giám hiệu</span>
                            </h1>
                            <p className="qt-lead">
                                Phân quyền, điều hành toàn trường, phê duyệt, học phí và báo cáo. Trang này không hiển thị
                                trên cổng công khai dành cho giáo viên và học sinh.
                            </p>
                            <div className="qt-cta">
                                <Link href="/login/admin" className="qt-btn primary">
                                    Đăng nhập hệ thống quản trị <Arrow />
                                </Link>
                                <a href="#vai-tro" className="qt-btn ghost">Chọn cổng quản trị</a>
                            </div>
                            <p className="qt-trust">
                                <Svg size={20}><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.5" /></Svg>
                                Chỉ tài khoản Admin, Ban Giám hiệu và Kế toán mới đăng nhập được.
                            </p>
                        </div>

                        <div className="qt-art" aria-hidden="true">
                            <div className="qt-float f1"><Svg size={18}><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.5" /></Svg>Đã phê duyệt</div>
                            <div className="qt-glass">
                                <div className="qt-glass-top">
                                    <b>Tổng quan nhà trường</b>
                                    <span className="qt-live"><i />Trực tuyến</span>
                                </div>
                                <div className="qt-kpis">
                                    <div className="qt-kpi v"><b>1.248</b><span>Học sinh</span></div>
                                    <div className="qt-kpi c"><b>97,8%</b><span>Chuyên cần</span></div>
                                    <div className="qt-kpi t"><b>56%</b><span>Học phí đã thu</span></div>
                                </div>
                                <div className="qt-chart">
                                    <small>Chuyên cần 8 tuần gần nhất</small>
                                    <svg viewBox="0 0 300 74" preserveAspectRatio="none">
                                        <defs>
                                            <linearGradient id="qt-spark" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0" stopColor="#0ea5e9" stopOpacity="0.35" />
                                                <stop offset="1" stopColor="#0ea5e9" stopOpacity="0" />
                                            </linearGradient>
                                        </defs>
                                        <path d="M0 52 C30 46 45 58 75 44 S120 30 150 36 S210 14 240 22 S280 10 300 8 V74 H0Z" fill="url(#qt-spark)" />
                                        <path d="M0 52 C30 46 45 58 75 44 S120 30 150 36 S210 14 240 22 S280 10 300 8" fill="none" stroke="#0ea5e9" strokeWidth="2.6" strokeLinecap="round" />
                                    </svg>
                                </div>
                                <div className="qt-approve">
                                    <span className="qt-dot">
                                        <Svg size={18}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></Svg>
                                    </span>
                                    <div><b>Kế hoạch học kỳ</b><span>Gửi bởi Tổ Toán – Tin</span></div>
                                    <span className="qt-pill">Chờ duyệt</span>
                                </div>
                            </div>
                            <div className="qt-float f2"><Svg size={18}>{Shield}</Svg>Phân quyền 3 vai trò</div>
                            <p className="qt-art-note">Dữ liệu minh hoạ</p>
                        </div>
                    </div>
                </section>

                {/* ---------- CHỌN CỔNG ---------- */}
                <section id="vai-tro" className="qt-section">
                    <div className="qt-wrap">
                        <div className="qt-head">
                            <span className="qt-kicker">Ba cổng · Ba vai trò</span>
                            <h2>Chọn cổng quản trị</h2>
                            <p>Mỗi vai trò có giao diện và quyền hạn riêng. Đăng nhập bằng tài khoản được cấp.</p>
                        </div>

                        <ul className="qt-roles">
                            {roles.map((r, i) => (
                                <li key={r.href}>
                                    <Link href={r.href} className={`qt-role ${r.key}`}>
                                        <div className="qt-role-top">
                                            <div className="qt-role-icon"><Svg size={30}>{r.icon}</Svg></div>
                                            <span className="qt-role-no">CỔNG 0{i + 1}</span>
                                        </div>
                                        <h3>{r.name}</h3>
                                        <p className="qt-role-note">{r.note}</p>
                                        <ul className="qt-tasks">
                                            {r.tasks.map((t) => (<li key={t}>{t}</li>))}
                                        </ul>
                                        <span className="qt-role-go">Vào cổng <Arrow /></span>
                                    </Link>
                                </li>
                            ))}
                        </ul>

                        <p className="qt-help">
                            <Svg size={20}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></Svg>
                            Chưa có tài khoản hoặc quên mật khẩu? Liên hệ Quản trị viên hệ thống của nhà trường để được cấp lại.
                        </p>
                    </div>
                </section>

                {/* ---------- PHÂN QUYỀN ---------- */}
                <section id="phan-quyen" className="qt-section white">
                    <div className="qt-wrap">
                        <div className="qt-head">
                            <span className="qt-kicker">Phạm vi quyền hạn</span>
                            <h2>Ai được làm gì trong hệ thống</h2>
                            <p>Quyền được chia theo vai trò. Mỗi cán bộ chỉ thấy và thao tác trong phạm vi của mình.</p>
                        </div>

                        <div className="qt-matrix-wrap">
                            <table className="qt-matrix">
                                <thead>
                                <tr>
                                    <th scope="col">Chức năng</th>
                                    <th scope="col" className="qt-col-v">Quản trị</th>
                                    <th scope="col" className="qt-col-c">Ban Giám hiệu</th>
                                    <th scope="col" className="qt-col-t">Kế toán</th>
                                </tr>
                                </thead>
                                <tbody>
                                {matrix.map((row) => (
                                    <tr key={row.feature}>
                                        <th scope="row">{row.feature}</th>
                                        <td><LevelCell level={row.admin} /></td>
                                        <td><LevelCell level={row.bgh} /></td>
                                        <td><LevelCell level={row.acc} /></td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="qt-legend">Quyền mặc định, Quản trị viên có thể điều chỉnh trong mục Phân quyền.</p>
                    </div>
                </section>

                {/* ---------- QUY TRÌNH ---------- */}
                <section id="quy-trinh" className="qt-section">
                    <div className="qt-wrap">
                        <div className="qt-head">
                            <span className="qt-kicker">Cách hệ thống vận hành</span>
                            <h2>Ba bước làm việc an toàn</h2>
                        </div>
                        <ol className="qt-steps">
                            {steps.map((s, i) => (
                                <li key={s.title} className="qt-step">
                                    <div className="qt-step-no">{i + 1}</div>
                                    <h3>{s.title}</h3>
                                    <p>{s.text}</p>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>

                {/* ---------- SỐ LIỆU ---------- */}
                <section className="qt-stats" aria-label="Thông tin về cổng quản trị">
                    <div className="qt-wrap">
                        <dl>
                            {stats.map(([num, label]) => (
                                <div key={label} className="qt-stat">
                                    <dt>{num}</dt>
                                    <dd>{label}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                </section>
            </main>

            {/* ---------- FOOTER ---------- */}
            <footer className="qt-footer">
                <div className="qt-wrap">
                    <div>
                        <b>Cổng Quản trị nội bộ</b>
                        Không công bố địa chỉ này cho học sinh và giáo viên
                    </div>
                    <nav aria-label="Liên kết nhanh">
                        <Link href="/login/admin">Đăng nhập Admin</Link>
                        <Link href="/login/bgh">Đăng nhập BGH</Link>
                        <Link href="/login/accountant">Đăng nhập Kế toán</Link>
                    </nav>
                    <p className="qt-copy">© {new Date().getFullYear()} Hệ thống Quản lý Trường THPT · Cổng nội bộ</p>
                </div>
            </footer>
        </div>
    );
}