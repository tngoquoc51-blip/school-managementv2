'use client';

import { useState } from 'react';
import Link from 'next/link';
import './dashboard.css';

interface Stats {
    totalUsers: number;
    activeUsers: number;
    totalClasses: number;
    logsToday: number;
    newUsersWeek: number;
    activePercent: number;
    warnings: number;
}

interface Activity {
    time: string;
    account: string;
    action: string;
    status: 'success' | 'warning' | 'error';
}

interface QuickLink {
    href: string;
    title: string;
    desc: string;
    icon: string;
}

const DEMO_STATS: Stats = {
    totalUsers: 1562,
    activeUsers: 1489,
    totalClasses: 38,
    logsToday: 348,
    newUsersWeek: 24,
    activePercent: 95.3,
    warnings: 2,
};

const DEMO_ACTIVITY: Activity[] = [
    { time: '08:42', account: 'gv0001', action: 'Cập nhật điểm lớp 10A2 – Toán', status: 'success' },
    { time: '08:15', account: 'admin', action: 'Sao lưu tự động thành công', status: 'success' },
    { time: '07:50', account: 'hs0001', action: 'Đăng nhập cổng học sinh', status: 'success' },
    { time: '07:12', account: 'system', action: '2 phiên đăng nhập bất thường', status: 'warning' },
    { time: '06:45', account: 'giaovu', action: 'Khóa sổ điểm học kỳ 1 – khối 10', status: 'success' },
    { time: '06:20', account: 'ketoan', action: 'Lập phiếu thu học phí đợt 1', status: 'success' },
];

const QUICK_LINKS: QuickLink[] = [
    { href: '/admin/users', title: 'Tài khoản', desc: 'Tạo, khóa, phân quyền', icon: 'users' },
    { href: '/admin/classes', title: 'Lớp học', desc: 'Quản lý lớp, sĩ số', icon: 'class' },
    { href: '/admin/timetable', title: 'Thời khóa biểu', desc: 'Xếp lịch lớp / GV', icon: 'calendar' },
    { href: '/admin/exams', title: 'Lịch thi', desc: 'Giữa kỳ, cuối kỳ', icon: 'exam' },
    { href: '/admin/grades', title: 'Điểm số', desc: 'Tổng hợp theo TT22', icon: 'grade' },
    { href: '/admin/attendance', title: 'Điểm danh', desc: 'Chuyên cần toàn trường', icon: 'check' },
    { href: '/accountant/dashboard', title: 'Học phí', desc: 'Thu chi, công nợ', icon: 'money' },
    { href: '/admin/reports', title: 'Báo cáo', desc: 'Thống kê học lực', icon: 'chart' },
];

const ICONS: Record<string, React.ReactNode> = {
    users: (
        <>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </>
    ),
    class: (
        <>
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </>
    ),
    calendar: (
        <>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
        </>
    ),
    exam: (
        <>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6M9 13h6M9 17h4" />
        </>
    ),
    grade: <path d="M12 20V10M18 20V4M6 20v-4" />,
    check: (
        <>
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </>
    ),
    money: (
        <>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v12M16 10c0-1.5-1.5-2.5-4-2.5S8 8.5 8 10s1.5 2.5 4 2.5 4 1 4 2.5-1.5 2.5-4 2.5" />
        </>
    ),
    chart: (
        <>
            <path d="M3 3v18h18" />
            <path d="M7 15l4-4 3 3 5-6" />
        </>
    ),
};

function Svg({ children }: { children: React.ReactNode }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            {children}
        </svg>
    );
}

export default function AdminDashboard() {
    const [stats] = useState<Stats>(DEMO_STATS);
    const [activity] = useState<Activity[]>(DEMO_ACTIVITY);

    const statusLabel = (s: Activity['status']) => {
        if (s === 'success') return <span className="ad-badge ok">Thành công</span>;
        if (s === 'warning') return <span className="ad-badge warn">Cảnh báo</span>;
        return <span className="ad-badge bad">Lỗi</span>;
    };

    return (
        <div className="ad-dashboard">
            <div className="ad-page-head">
                <div>
                    <h1>Bảng điều khiển quản trị</h1>
                    <p>Điều hành toàn bộ hoạt động nhà trường</p>
                </div>
                <div className="ad-page-tags">
                    <span className="ad-tag">Năm học 2025 – 2026</span>
                    <span className="ad-tag">Học kỳ 1</span>
                    <span className="ad-tag primary">Super Admin</span>
                </div>
            </div>

            <div className="ad-stats">
                <div className="ad-stat">
                    <div className="ad-stat-label">Tổng tài khoản</div>
                    <div className="ad-stat-value">{stats.totalUsers.toLocaleString('vi-VN')}</div>
                    <div className="ad-stat-meta up">+{stats.newUsersWeek} tuần này</div>
                </div>
                <div className="ad-stat">
                    <div className="ad-stat-label">Đang hoạt động</div>
                    <div className="ad-stat-value">{stats.activeUsers.toLocaleString('vi-VN')}</div>
                    <div className="ad-stat-meta">{stats.activePercent}% hệ thống</div>
                </div>
                <div className="ad-stat">
                    <div className="ad-stat-label">Lớp học</div>
                    <div className="ad-stat-value">{stats.totalClasses}</div>
                    <div className="ad-stat-meta">Khối 10 · 11 · 12</div>
                </div>
                <div className="ad-stat">
                    <div className="ad-stat-label">Nhật ký hôm nay</div>
                    <div className="ad-stat-value">{stats.logsToday}</div>
                    <div className="ad-stat-meta warn">{stats.warnings} cảnh báo</div>
                </div>
            </div>

            <section className="ad-section">
                <div className="ad-section-head">
                    <h2>Truy cập nhanh chức năng nhà trường</h2>
                </div>
                <div className="ad-quick-grid">
                    {QUICK_LINKS.map((item) => (
                        <Link key={item.href} href={item.href} className="ad-quick-card">
                            <div className="ad-quick-icon">
                                <Svg>{ICONS[item.icon]}</Svg>
                            </div>
                            <div>
                                <div className="ad-quick-title">{item.title}</div>
                                <div className="ad-quick-desc">{item.desc}</div>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            <div className="ad-two-col">
                <section className="ad-section">
                    <div className="ad-section-head">
                        <h2>Nhật ký gần đây</h2>
                        <Link href="/admin/logs">Xem tất cả</Link>
                    </div>
                    <div className="ad-table-wrap">
                        <table className="ad-table">
                            <thead>
                            <tr>
                                <th>Giờ</th>
                                <th>Tài khoản</th>
                                <th>Hành động</th>
                                <th>Trạng thái</th>
                            </tr>
                            </thead>
                            <tbody>
                            {activity.map((row, i) => (
                                <tr key={i}>
                                    <td className="ad-time">{row.time}</td>
                                    <td>
                                        <code className="ad-code">{row.account}</code>
                                    </td>
                                    <td>{row.action}</td>
                                    <td>{statusLabel(row.status)}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="ad-section">
                    <div className="ad-section-head">
                        <h2>Tình trạng hệ thống</h2>
                    </div>
                    <div className="ad-health">
                        <div className="ad-health-item">
                            <span className="ad-dot ok" />
                            <div>
                                <b>Máy chủ API</b>
                                <p>Hoạt động bình thường</p>
                            </div>
                        </div>
                        <div className="ad-health-item">
                            <span className="ad-dot ok" />
                            <div>
                                <b>Cơ sở dữ liệu</b>
                                <p>MySQL · Kết nối ổn định</p>
                            </div>
                        </div>
                        <div className="ad-health-item">
                            <span className="ad-dot ok" />
                            <div>
                                <b>Sao lưu tự động</b>
                                <p>Lần cuối: hôm nay 02:00</p>
                            </div>
                        </div>
                        <div className="ad-health-item">
                            <span className="ad-dot warn" />
                            <div>
                                <b>Phiên đăng nhập</b>
                                <p>2 phiên bất thường cần xem</p>
                            </div>
                        </div>
                    </div>
                    <div className="ad-health-actions">
                        <Link href="/admin/backup" className="ad-btn-soft">
                            Sao lưu ngay
                        </Link>
                        <Link href="/admin/logs" className="ad-btn-soft">
                            Xem nhật ký
                        </Link>
                    </div>
                </section>
            </div>
        </div>
    );
}