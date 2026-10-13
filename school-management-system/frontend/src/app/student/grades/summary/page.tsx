'use client';

import Link from 'next/link';
import '../grades.css';

export default function GradesSummaryPage() {
    return (
        <div className="gr-page">
            <div className="gr-hero">
                <div>
                    <p className="gr-hero-label">Góc học tập</p>
                    <h1>Tổng kết học kỳ</h1>
                    <p className="gr-hero-sub">Lớp 10A2 · Học kỳ 1 · 2025 – 2026</p>
                </div>
            </div>

            <div className="gr-tabs">
                <Link href="/student/grades" className="gr-tab">Bảng điểm</Link>
                <Link href="/student/grades/summary" className="gr-tab active">Tổng kết học kỳ</Link>
                <Link href="/student/grades/subjects" className="gr-tab">Chi tiết môn học</Link>
            </div>

            <div className="gr-stats">
                <div className="gr-stat">
                    <span className="gr-stat-val sky">8.4</span>
                    <span className="gr-stat-lbl">Điểm TB các môn</span>
                </div>
                <div className="gr-stat">
                    <span className="gr-stat-val green">Giỏi</span>
                    <span className="gr-stat-lbl">Học lực</span>
                </div>
                <div className="gr-stat">
                    <span className="gr-stat-val blue">Tốt</span>
                    <span className="gr-stat-lbl">Rèn luyện</span>
                </div>
                <div className="gr-stat">
                    <span className="gr-stat-val">Đạt</span>
                    <span className="gr-stat-lbl">Danh hiệu</span>
                </div>
            </div>

            <div className="gr-panel">
                <h3 style={{ margin: '0 0 14px', fontSize: 15, color: '#0f172a' }}>Nhận xét giáo viên chủ nhiệm</h3>
                <p style={{ margin: 0, fontSize: 14, color: '#475569', lineHeight: 1.6 }}>
                    Em có ý thức học tập tốt, tham gia đầy đủ các hoạt động của lớp.
                    Cần phát huy điểm mạnh môn Toán, Tiếng Anh; củng cố thêm Ngữ văn và các môn Khoa học tự nhiên.
                </p>
            </div>

            <div className="gr-panel">
                <h3 style={{ margin: '0 0 12px', fontSize: 15, color: '#0f172a' }}>Tóm tắt theo nhóm môn</h3>
                <div className="gr-table-wrap">
                    <table className="gr-table">
                        <thead>
                        <tr>
                            <th>Nhóm môn</th>
                            <th>Điểm TB</th>
                            <th>Xếp loại</th>
                        </tr>
                        </thead>
                        <tbody>
                        <tr>
                            <td className="col-subject">Toán – Tin</td>
                            <td className="col-avg">9.0</td>
                            <td><span className="gr-rank rank-gioi">Giỏi</span></td>
                        </tr>
                        <tr>
                            <td className="col-subject">Ngữ văn – Ngoại ngữ</td>
                            <td className="col-avg">8.2</td>
                            <td><span className="gr-rank rank-gioi">Giỏi</span></td>
                        </tr>
                        <tr>
                            <td className="col-subject">Khoa học tự nhiên</td>
                            <td className="col-avg">8.0</td>
                            <td><span className="gr-rank rank-gioi">Giỏi</span></td>
                        </tr>
                        <tr>
                            <td className="col-subject">Khoa học xã hội</td>
                            <td className="col-avg">7.9</td>
                            <td><span className="gr-rank rank-kha">Khá</span></td>
                        </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}