'use client';

import Link from 'next/link';

const TODAY = [
    { period: 'Tiết 1', subject: 'Toán 12A1', room: 'Phòng 201', time: '07:00 – 07:45', live: false },
    { period: 'Tiết 3', subject: 'Toán 11B2', room: 'Phòng 305', time: '09:00 – 09:45', live: true },
    { period: 'Tiết 5', subject: 'Toán 10A3', room: 'Phòng 102', time: '10:40 – 11:25', live: false },
];

const QUICK = [
    { href: '/teacher/attendance', title: 'Điểm danh', desc: 'Lớp hôm nay' },
    { href: '/teacher/lesson-log', title: 'Sổ đầu bài', desc: 'Ghi tiết dạy' },
    { href: '/teacher/grades', title: 'Nhập điểm', desc: 'Theo Thông tư 22' },
    { href: '/teacher/lesson-plan', title: 'Kế hoạch bài dạy', desc: 'Soạn & duyệt' },
];

export default function TeacherDashboard() {
    return (
        <>
            <div className="tc-stats">
                <div className="tc-stat">
                    <div className="tc-stat-label">Lớp đang dạy</div>
                    <div className="tc-stat-value">6</div>
                    <div className="tc-stat-meta">Năm học hiện tại</div>
                </div>
                <div className="tc-stat">
                    <div className="tc-stat-label">Tiết hôm nay</div>
                    <div className="tc-stat-value">4</div>
                    <div className="tc-stat-meta">Còn 2 tiết</div>
                </div>
                <div className="tc-stat">
                    <div className="tc-stat-label">Chưa nhập điểm</div>
                    <div className="tc-stat-value">2</div>
                    <div className="tc-stat-meta">Cần hoàn thành</div>
                </div>
                <div className="tc-stat">
                    <div className="tc-stat-label">Thông báo mới</div>
                    <div className="tc-stat-value">3</div>
                    <div className="tc-stat-meta">Từ nhà trường</div>
                </div>
            </div>

            <section className="tc-section">
                <div className="tc-section-head">
                    <h2>Thời khóa biểu hôm nay</h2>
                    <Link href="/teacher/schedule">Xem tất cả</Link>
                </div>
                <div className="tc-schedule-list">
                    {TODAY.map((item) => (
                        <div key={item.period} className="tc-schedule-item">
                            <div className="tc-period">{item.period}</div>
                            <div>
                                <div className="tc-subject">{item.subject}</div>
                                <div className="tc-room">{item.room}</div>
                                {item.live && <span className="tc-badge-live">Đang diễn ra</span>}
                            </div>
                            <div className="tc-time">{item.time}</div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="tc-section">
                <div className="tc-section-head">
                    <h2>Thao tác nhanh</h2>
                </div>
                <div className="tc-quick-grid">
                    {QUICK.map((q) => (
                        <Link key={q.href} href={q.href} className="tc-quick-card">
                            <b>{q.title}</b>
                            <span>{q.desc}</span>
                        </Link>
                    ))}
                </div>
            </section>
        </>
    );
}