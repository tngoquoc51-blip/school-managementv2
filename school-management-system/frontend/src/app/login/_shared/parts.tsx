import Link from 'next/link';

/* Phần dùng chung cho các trang đăng nhập (giao diện login.css của bạn) */

/* ===== Hoa phượng ===== */
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

export const Flower = ({ className }: { className?: string }) => (
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

export const Branch = () => (
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
export const IconUser = () => (<svg viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>);
export const IconLock = () => (<svg viewBox="0 0 24 24" {...stroke}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>);
export const IconCheck = () => (<svg viewBox="0 0 24 24" {...stroke} strokeWidth={2.4}><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.5" /></svg>);
export const IconShield = () => (<svg viewBox="0 0 24 24" {...stroke}><path d="M12 3l8 3v5c0 4.6-3.3 8.3-8 10-4.7-1.7-8-5.4-8-10V6l8-3z" /><path d="M9 12l2.2 2.2L15.5 10" /></svg>);
export const IconStar = () => (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" /></svg>);
export const IconArrow = () => (<svg viewBox="0 0 24 24" {...stroke} strokeWidth={2.4}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);

/* ===== Cổng đăng nhập của các vai trò khác (theo src/app/login/*) =====
   Không liệt kê cổng Quản trị để không lộ địa chỉ nội bộ. */
const PORTALS: [string, string][] = [
    ['/login/bgh', 'Ban giám hiệu'],
    ['/login/academic', 'Giáo vụ'],
    ['/login/accountant', 'Kế toán'],
    ['/login/teacher', 'Giáo viên'],
    ['/login/student', 'Học sinh'],
    ['/login/parent', 'Phụ huynh'],
];

export function OtherPortals({ current }: { current: string }) {
    return (
        <nav className="login-portals" aria-label="Cổng đăng nhập khác">
            <span>Không phải cổng của bạn? Chọn cổng khác</span>
            <ul>
                {PORTALS.filter(([href]) => href !== current).map(([href, label]) => (
                    <li key={href}><Link href={href}>{label}</Link></li>
                ))}
            </ul>
        </nav>
    );
}