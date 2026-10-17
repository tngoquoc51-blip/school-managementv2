'use client';

import Link from 'next/link';
import './dashboard.css';

const STATS = [
    { label: 'Tổng số học sinh', value: '1.248', sub: 'Toàn trường', color: 'sky' },
    { label: 'Sĩ số hôm nay', value: '1.189', sub: 'Có mặt', color: 'emerald' },
    { label: 'Tỷ lệ chuyên cần', value: '95.3%', sub: 'Tuần này', color: 'blue' },
    { label: 'Chờ phê duyệt', value: '7', sub: 'Cần xử lý', color: 'orange', href: '/bgh/approvals' },
];

const GRADE_STATS = [
    { name: 'Giỏi', percent: 28, color: '#10b981' },
    { name: 'Khá', percent: 45, color: '#0ea5e9' },
    { name: 'Trung bình', percent: 22, color: '#f59e0b' },
    { name: 'Yếu', percent: 5, color: '#ef4444' },
];

const APPROVALS = [
    { id: 1, title: 'Phân công giảng dạy học kỳ 2', type: 'Phân công', count: 2, urgent: true },
    { id: 2, title: 'Thời khóa biểu tuần 15', type: 'TKB', count: 1, urgent: false },
    { id: 3, title: 'Đề xuất khen thưởng tháng 10', type: 'Khen thưởng', count: 10, urgent: false },
    { id: 4, title: 'Giáo án khối 12 – Toán', type: 'Giáo án', count: 5, urgent: true },
    { id: 5, title: 'Kết quả dự giờ tuần 14', type: 'Dự giờ', count: 3, urgent: false },
];

const QUICK = [
    { href: '/bgh/approvals', label: 'Phê duyệt ngay', icon: '✅' },
    { href: '/bgh/academic', label: 'Chuyên môn', icon: '📚' },
    { href: '/bgh/notices', label: 'Gửi thông báo', icon: '📢' },
    { href: '/bgh/reports', label: 'Báo cáo', icon: '📈' },
];

export default function BGHDashboard() {
    return (
        <div className="bgh-dash">
            <div className="bgh-dash-header">
                <div>
                    <h1 className="bgh-dash-title">Bảng điều khiển toàn trường</h1>
                    <p className="bgh-dash-sub">
                        Tổng quan hoạt động năm học 2025 – 2026 · Học kỳ 1
                    </p>
                </div>
                <div className="bgh-dash-actions">
                    {QUICK.map((q) => (
                        <Link key={q.href} href={q.href} className="bgh-quick-btn">
                            <span>{q.icon}</span> {q.label}
                        </Link>
                    ))}
                </div>
            </div>

            <div className="bgh-stats">
                {STATS.map((s) => (
                    <div key={s.label} className={`bgh-stat-card bgh-stat-${s.color}`}>
                        <div className="bgh-stat-top">
                            <p className="bgh-stat-label">{s.label}</p>
                            {s.href && (
                                <Link href={s.href} className="bgh-stat-link">
                                    Xử lý →
                                </Link>
                            )}
                        </div>
                        <p className="bgh-stat-value">{s.value}</p>
                        <p className="bgh-stat-sub">{s.sub}</p>
                    </div>
                ))}
            </div>

            <div className="bgh-grid-2">
                <div className="bgh-card">
                    <div className="bgh-card-head">
                        <h2>Tỷ lệ học lực toàn trường</h2>
                        <Link href="/bgh/reports">Chi tiết</Link>
                    </div>
                    <div className="bgh-grade-list">
                        {GRADE_STATS.map((g) => (
                            <div key={g.name} className="bgh-grade-row">
                                <span className="bgh-grade-name">{g.name}</span>
                                <div className="bgh-grade-bar-wrap">
                                    <div
                                        className="bgh-grade-bar"
                                        style={{ width: `${g.percent}%`, background: g.color }}
                                    />
                                </div>
                                <span className="bgh-grade-pct">{g.percent}%</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bgh-card">
                    <div className="bgh-card-head">
                        <h2>Việc cần phê duyệt</h2>
                        <Link href="/bgh/approvals">Xem tất cả</Link>
                    </div>
                    <div className="bgh-approval-list">
                        {APPROVALS.map((a) => (
                            <div
                                key={a.id}
                                className={`bgh-approval-item ${a.urgent ? 'urgent' : ''}`}
                            >
                                <div className="bgh-approval-info">
                                    <p className="bgh-approval-title">{a.title}</p>
                                    <p className="bgh-approval-meta">
                                        {a.type} · {a.count} mục
                                        {a.urgent && (
                                            <span className="bgh-urgent-tag">Ưu tiên</span>
                                        )}
                                    </p>
                                </div>
                                <Link href={`/bgh/approvals/${a.id}`} className="bgh-approval-btn">
                                    Xem
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bgh-grid-3">
                <div className="bgh-card">
                    <h2 className="bgh-card-title">Chuyên cần 7 ngày</h2>
                    <div className="bgh-mini-stats">
                        <div>
                            <strong>95.3%</strong>
                            <span>Trung bình</span>
                        </div>
                        <div>
                            <strong>12</strong>
                            <span>Vắng có phép</span>
                        </div>
                        <div>
                            <strong>5</strong>
                            <span>Vắng không phép</span>
                        </div>
                    </div>
                </div>

                <div className="bgh-card">
                    <h2 className="bgh-card-title">Giáo án chờ duyệt</h2>
                    <div className="bgh-mini-stats">
                        <div>
                            <strong>18</strong>
                            <span>Chờ Tổ trưởng</span>
                        </div>
                        <div>
                            <strong>7</strong>
                            <span>Chờ BGH</span>
                        </div>
                        <div>
                            <strong>42</strong>
                            <span>Đã duyệt tuần</span>
                        </div>
                    </div>
                </div>

                <div className="bgh-card">
                    <h2 className="bgh-card-title">Thông báo gần đây</h2>
                    <ul className="bgh-notice-list">
                        <li>Họp BGH – 10/10/2026</li>
                        <li>Lịch thi giữa kỳ khối 12</li>
                        <li>Kế hoạch tháng 10</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}