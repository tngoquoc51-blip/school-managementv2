'use client';

import Link from 'next/link';
import './dashboard.css';

export default function StudentDashboard() {
    return (
        <div className="st-dashboard">
            {/* ===== Banner chào ===== */}
            <div className="st-banner">
                <div className="st-banner-text">
                    <p className="st-banner-hello">Chào buổi sáng,</p>
                    <h1>Trần Thị Học</h1>
                    <p className="st-banner-date">Thứ Bảy, ngày 10/10/2026 · Lớp 10A2</p>
                </div>
                <div className="st-banner-icon">🎓</div>
            </div>

            {/* ===== 4 ô chức năng nhanh ===== */}
            <div className="st-quick-grid">
                <Link href="/student/schedule" className="st-quick-card">
                    <div className="st-quick-icon blue">📅</div>
                    <div>
                        <h3>Thời khóa biểu</h3>
                        <p>Xem lịch học tuần</p>
                    </div>
                </Link>

                <Link href="/student/grades" className="st-quick-card">
                    <div className="st-quick-icon green">📊</div>
                    <div>
                        <h3>Góc Học Tập</h3>
                        <p>Điểm các môn học</p>
                    </div>
                </Link>

                <Link href="/student/attendance" className="st-quick-card">
                    <div className="st-quick-icon orange">✅</div>
                    <div>
                        <h3>Chuyên cần</h3>
                        <p>Điểm danh & nghỉ học</p>
                    </div>
                </Link>

                <Link href="/student/notifications" className="st-quick-card">
                    <div className="st-quick-icon red">🔔</div>
                    <div>
                        <h3>Thông báo</h3>
                        <p>Tin mới từ nhà trường</p>
                    </div>
                </Link>
            </div>

            {/* ===== Thống kê nhanh ===== */}
            <div className="st-stats">
                <div className="st-stat-card">
                    <p className="st-stat-label">Điểm TB HK1</p>
                    <p className="st-stat-value sky">8.4</p>
                </div>
                <div className="st-stat-card">
                    <p className="st-stat-label">Học lực</p>
                    <p className="st-stat-value green">Giỏi</p>
                </div>
                <div className="st-stat-card">
                    <p className="st-stat-label">Rèn luyện</p>
                    <p className="st-stat-value blue">Tốt</p>
                </div>
                <div className="st-stat-card">
                    <p className="st-stat-label">Số buổi nghỉ</p>
                    <p className="st-stat-value">1</p>
                </div>
            </div>

            {/* ===== 2 cột dưới ===== */}
            <div className="st-two-col">
                {/* Thông báo */}
                <div className="st-panel">
                    <div className="st-panel-head">
                        <h2>Thông báo nhà trường</h2>
                        <Link href="/student/notifications">Xem tất cả</Link>
                    </div>
                    <div className="st-notice-list">
                        <div className="st-notice-item">
                            <div className="st-notice-dot" />
                            <div>
                                <p className="st-notice-title">Lịch thi giữa kỳ I năm học 2025-2026</p>
                                <p className="st-notice-date">08/10/2026</p>
                            </div>
                        </div>
                        <div className="st-notice-item">
                            <div className="st-notice-dot" />
                            <div>
                                <p className="st-notice-title">Thông báo nghỉ lễ 20/11 và lịch học bù</p>
                                <p className="st-notice-date">05/10/2026</p>
                            </div>
                        </div>
                        <div className="st-notice-item">
                            <div className="st-notice-dot" />
                            <div>
                                <p className="st-notice-title">Hướng dẫn đăng ký môn tự chọn học kỳ 2</p>
                                <p className="st-notice-date">01/10/2026</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Lịch học hôm nay */}
                <div className="st-panel">
                    <div className="st-panel-head">
                        <h2>Lịch học hôm nay</h2>
                        <Link href="/student/schedule">Xem TKB</Link>
                    </div>
                    <div className="st-schedule-list">
                        <div className="st-schedule-item">
                            <span className="st-period">Tiết 1-2</span>
                            <div>
                                <p className="st-subject">Toán</p>
                                <p className="st-meta">Thầy Nguyễn Văn A · Phòng 201</p>
                            </div>
                        </div>
                        <div className="st-schedule-item">
                            <span className="st-period">Tiết 3</span>
                            <div>
                                <p className="st-subject">Ngữ văn</p>
                                <p className="st-meta">Cô Trần Thị B · Phòng 105</p>
                            </div>
                        </div>
                        <div className="st-schedule-item">
                            <span className="st-period">Tiết 5-6</span>
                            <div>
                                <p className="st-subject">Tiếng Anh</p>
                                <p className="st-meta">Cô Lê Thị C · Phòng 302</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}