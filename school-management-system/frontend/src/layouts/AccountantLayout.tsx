'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import '../app/design-tokens.css'; // src/app/design-tokens.css
import './accountant-layout.css';
import './accountant-ui.css';

/* ======================================================
   ICON (SVG inline – không cần cài thư viện)
   ====================================================== */
const ICONS = {
    dashboard: (<><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>),
    fees: (<><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M9 12h6M9 16h6" /></>),
    periods: (<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 14h3" /></>),
    collection: (<><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></>),
    receipts: (<><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z" /><path d="M9 8h6M9 12h6" /></>),
    debts: (<><path d="M12 3L2 21h20L12 3z" /><path d="M12 10v5M12 18h.01" /></>),
    reminders: (<><path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7" /><path d="M10 20a2 2 0 0 0 4 0" /></>),
    waivers: (<><path d="M19 5L5 19" /><circle cx="7" cy="7" r="2.5" /><circle cx="17" cy="17" r="2.5" /></>),
    refunds: (<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>),
    insurance: (<><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z" /><path d="M12 9v6M9 12h6" /></>),
    scholarships: (<><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" /><path d="M12 8c-1-3-5-4-5-1.5S10 8 12 8zM12 8c1-3 5-4 5-1.5S14 8 12 8z" /></>),
    payments: (<><path d="M7 17L17 7M8 7h9v9" /><rect x="2" y="3" width="20" height="18" rx="3" /></>),
    cashbook: (<><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 21h15M9 8h6M9 12h6" /></>),
    bank: (<><path d="M3 10l9-6 9 6z" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18" /></>),
    payroll: (<><circle cx="9" cy="7" r="3.5" /><path d="M2 21v-1a6 6 0 0 1 12 0v1" /><path d="M16 4a3.5 3.5 0 0 1 0 6.5M18 14.5a6 6 0 0 1 4 5.5V21" /></>),
    budget: (<><path d="M21 12A9 9 0 1 1 12 3v9z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15z" /></>),
    assets: (<><path d="M21 8l-9-5-9 5v8l9 5 9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></>),
    students: (<><path d="M2 9l10-5 10 5-10 5L2 9z" /><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" /></>),
    invoices: (<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></>),
    reports: (<><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></>),
    closing: (<><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>),
    audit: (<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>),
    settings: (<><path d="M4 6h8M16 6h4M4 12h2M10 12h10M4 18h10M18 18h2" /><circle cx="14" cy="6" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="16" cy="18" r="2" /></>),
    search: (<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>),
    logout: (<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>),
    menu: (<path d="M4 6h16M4 12h16M4 18h16" />),
    close: (<path d="M6 6l12 12M18 6L6 18" />),
    plus: (<path d="M12 5v14M5 12h14" />),
} as const;

type IconName = keyof typeof ICONS;

function Icon({ name }: { name: IconName }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ICONS[name]}
        </svg>
    );
}

/* ======================================================
   MENU CHỨC NĂNG KẾ TOÁN (chia nhóm)
   Thêm / bớt chức năng chỉ cần sửa mảng này.
   ====================================================== */
interface MenuItem {
    href: string;
    label: string;
    icon: IconName;
}
interface MenuGroup {
    title: string;
    items: MenuItem[];
}

const MENU: MenuGroup[] = [
    {
        title: 'Tổng quan',
        items: [{ href: '/accountant/dashboard', label: 'Tổng quan', icon: 'dashboard' }],
    },
    {
        title: 'Thu phí',
        items: [
            { href: '/accountant/fees', label: 'Danh mục khoản thu', icon: 'fees' },
            { href: '/accountant/periods', label: 'Đợt thu / Kỳ thu', icon: 'periods' },
            { href: '/accountant/collection', label: 'Thu học phí', icon: 'collection' },
            { href: '/accountant/receipts', label: 'Phiếu thu', icon: 'receipts' },
            { href: '/accountant/debts', label: 'Công nợ', icon: 'debts' },
            { href: '/accountant/reminders', label: 'Nhắc nợ phụ huynh', icon: 'reminders' },
            { href: '/accountant/waivers', label: 'Miễn giảm học phí', icon: 'waivers' },
            { href: '/accountant/refunds', label: 'Hoàn trả', icon: 'refunds' },
            { href: '/accountant/insurance', label: 'Bảo hiểm y tế', icon: 'insurance' },
            { href: '/accountant/scholarships', label: 'Học bổng & hỗ trợ', icon: 'scholarships' },
        ],
    },
    {
        title: 'Chi & quỹ',
        items: [
            { href: '/accountant/payments', label: 'Phiếu chi', icon: 'payments' },
            { href: '/accountant/cashbook', label: 'Sổ quỹ tiền mặt', icon: 'cashbook' },
            { href: '/accountant/bank', label: 'Ngân hàng & đối soát', icon: 'bank' },
            { href: '/accountant/payroll', label: 'Lương & phụ cấp', icon: 'payroll' },
            { href: '/accountant/budget', label: 'Dự toán ngân sách', icon: 'budget' },
            { href: '/accountant/assets', label: 'Tài sản & vật tư', icon: 'assets' },
        ],
    },
    {
        title: 'Hồ sơ & báo cáo',
        items: [
            { href: '/accountant/students', label: 'Hồ sơ tài chính học sinh', icon: 'students' },
            { href: '/accountant/invoices', label: 'Hóa đơn / Biên lai điện tử', icon: 'invoices' },
            { href: '/accountant/reports', label: 'Báo cáo', icon: 'reports' },
        ],
    },
    {
        title: 'Hệ thống',
        items: [
            { href: '/accountant/closing', label: 'Khóa sổ kỳ kế toán', icon: 'closing' },
            { href: '/accountant/audit', label: 'Nhật ký hoạt động', icon: 'audit' },
            { href: '/accountant/settings', label: 'Cài đặt kế toán', icon: 'settings' },
        ],
    },
];

/* ======================================================
   TIỆN ÍCH
   ====================================================== */
interface StoredUser {
    name?: string;
    id?: string;
}

/* Đọc cả localStorage (ghi nhớ) lẫn sessionStorage (không ghi nhớ) */
const readStore = (key: string) => localStorage.getItem(key) ?? sessionStorage.getItem(key);

/* Chỉ kế toán và quản trị viên được vào module này */
const ALLOWED_ROLES = ['accountant', 'super_admin'];

/* Bỏ dấu để gõ "cong no" vẫn tìm ra "Công nợ" */
const normalize = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();

/* Năm học tự tính: từ tháng 8 trở đi là năm học mới */
function schoolYear(d = new Date()) {
    const start = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
    return `${start} – ${start + 1}`;
}

interface Props {
    children: ReactNode;
}

/* ======================================================
   LAYOUT
   ====================================================== */
export default function AccountantLayout({ children }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<StoredUser | null>(null);
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false); // sidebar trên điện thoại

    useEffect(() => {
        try {
            const rawUser = readStore('user');
            const roles: string[] = JSON.parse(readStore('roles') || '[]');
            if (rawUser && roles.some((r) => ALLOWED_ROLES.includes(r))) {
                setUser(JSON.parse(rawUser));
                return;
            }
        } catch {
            /* dữ liệu hỏng → coi như chưa đăng nhập */
        }
        router.replace('/login');
    }, [router]);

    // đóng sidebar khi chuyển trang
    useEffect(() => setOpen(false), [pathname]);

    const handleLogout = () => {
        ['token', 'user', 'roles'].forEach((k) => {
            localStorage.removeItem(k);
            sessionStorage.removeItem(k);
        });
        router.push('/login');
    };

    const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

    const groups = useMemo(() => {
        const q = normalize(query.trim());
        if (!q) return MENU;
        return MENU.map((g) => ({ ...g, items: g.items.filter((i) => normalize(i.label).includes(q)) })).filter(
            (g) => g.items.length > 0
        );
    }, [query]);

    const current = useMemo(() => {
        for (const g of MENU) {
            const item = g.items.find((i) => isActive(i.href));
            if (item) return { group: g.title, label: item.label };
        }
        return { group: 'Kế toán', label: 'Tổng quan' };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

    if (!user) return null; // tránh nháy giao diện trước khi kiểm tra đăng nhập

    return (
        <div className="acc-layout">
            {open && <div className="acc-overlay" onClick={() => setOpen(false)} />}

            <aside className={`acc-sidebar ${open ? 'open' : ''}`}>
                <div className="acc-brand">
                    <div className="acc-logo">TH</div>
                    <div>
                        <div className="acc-brand-name">Phòng Kế toán</div>
                        <div className="acc-brand-sub">Trường THPT</div>
                    </div>
                    <button type="button" className="acc-close" onClick={() => setOpen(false)} aria-label="Đóng menu">
                        <Icon name="close" />
                    </button>
                </div>

                <div className="acc-user">
                    <div className="acc-avatar">{user.name?.charAt(0) || 'K'}</div>
                    <div className="acc-user-text">
                        <div className="acc-user-name">{user.name || 'Kế toán'}</div>
                        <div className="acc-user-role">Phòng Kế toán</div>
                    </div>
                </div>

                <div className="acc-search">
                    <Icon name="search" />
                    <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Tìm chức năng..."
                        aria-label="Tìm chức năng"
                    />
                </div>

                <nav className="acc-nav" aria-label="Chức năng kế toán">
                    {groups.map((group) => (
                        <div className="acc-group" key={group.title}>
                            <div className="acc-group-title">{group.title}</div>
                            {group.items.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`acc-nav-item ${isActive(item.href) ? 'active' : ''}`}
                                    aria-current={isActive(item.href) ? 'page' : undefined}
                                >
                                    <span className="acc-nav-icon">
                                        <Icon name={item.icon} />
                                    </span>
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                    ))}
                    {groups.length === 0 && <p className="acc-empty">Không tìm thấy chức năng phù hợp.</p>}
                </nav>

                <div className="acc-footer">
                    <button type="button" onClick={handleLogout} className="acc-btn-logout">
                        <Icon name="logout" />
                        Đăng xuất
                    </button>
                </div>
            </aside>

            <div className="acc-main">
                <header className="acc-header">
                    <button type="button" className="acc-burger" onClick={() => setOpen(true)} aria-label="Mở menu">
                        <Icon name="menu" />
                    </button>
                    <div className="acc-title">
                        <p>
                            Hệ thống Quản lý Trường THPT · {current.group}
                        </p>
                        <h1>{current.label}</h1>
                    </div>
                    <div className="acc-header-right">
                        <span className="acc-year">Năm học {schoolYear()}</span>
                        <Link href="/accountant/collection" className="acc-quick">
                            <Icon name="plus" />
                            Lập phiếu thu
                        </Link>
                    </div>
                </header>
                <main className="acc-content">{children}</main>
            </div>
        </div>
    );
}