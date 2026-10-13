'use client';

import { useMemo, useState } from 'react';
import '../schedule.css';

type ExamType = 'gk' | 'ck' | 'all';

interface Exam {
    stt: number;
    subject: string;
    date: string;
    time: string;
    type: string;
    room: string;
    sbd: string;
}

const EXAMS: Exam[] = [
    { stt: 1, subject: 'Toán', date: '15/10/2026', time: '07:30 – 09:00', type: 'Tự luận', room: 'P.201', sbd: '001' },
    { stt: 2, subject: 'Ngữ văn', date: '16/10/2026', time: '07:30 – 09:30', type: 'Tự luận', room: 'P.105', sbd: '001' },
    { stt: 3, subject: 'Tiếng Anh', date: '17/10/2026', time: '07:30 – 09:00', type: 'TN + TL', room: 'P.302', sbd: '001' },
    { stt: 4, subject: 'Vật lý', date: '18/10/2026', time: '07:30 – 09:00', type: 'Trắc nghiệm', room: 'P.203', sbd: '001' },
    { stt: 5, subject: 'Hóa học', date: '20/10/2026', time: '07:30 – 09:00', type: 'Trắc nghiệm', room: 'P.204', sbd: '001' },
    { stt: 6, subject: 'Sinh học', date: '21/10/2026', time: '07:30 – 09:00', type: 'Trắc nghiệm', room: 'P.205', sbd: '001' },
    { stt: 7, subject: 'Lịch sử', date: '22/10/2026', time: '07:30 – 09:00', type: 'Tự luận', room: 'P.108', sbd: '001' },
    { stt: 8, subject: 'Địa lý', date: '23/10/2026', time: '07:30 – 09:00', type: 'Tự luận', room: 'P.110', sbd: '001' },
];

function parseVNDate(s: string) {
    const [d, m, y] = s.split('/').map(Number);
    return new Date(y, m - 1, d);
}

function getStatus(dateStr: string): 'upcoming' | 'done' | 'today' {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = parseVNDate(dateStr);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === today.getTime()) return 'today';
    if (d < today) return 'done';
    return 'upcoming';
}

function daysUntil(dateStr: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = parseVNDate(dateStr);
    d.setHours(0, 0, 0, 0);
    return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export default function StudentExamSchedulePage() {
    const [semester, setSemester] = useState('hk1');
    const [examType, setExamType] = useState<ExamType>('gk');

    const exams = useMemo(
        () => EXAMS.map((e) => ({ ...e, status: getStatus(e.date) })),
        []
    );

    const upcoming = exams.filter((e) => e.status === 'upcoming' || e.status === 'today');
    const doneCount = exams.filter((e) => e.status === 'done').length;
    const nextExam = upcoming.sort(
        (a, b) => parseVNDate(a.date).getTime() - parseVNDate(b.date).getTime()
    )[0];

    return (
        <div className="sch-page exam-page">
            {/* Header */}
            <div className="exam-hero">
                <div>
                    <p className="exam-hero-label">Cổng thông tin học sinh</p>
                    <h1>Lịch thi</h1>
                    <p className="exam-hero-sub">Lớp 10A2 · Năm học 2025 – 2026 · Học kỳ 1</p>
                </div>
                {nextExam && (
                    <div className="exam-next">
                        <span className="exam-next-label">Môn thi gần nhất</span>
                        <strong>{nextExam.subject}</strong>
                        <span className="exam-next-meta">
              {nextExam.date} · {nextExam.time}
                            {daysUntil(nextExam.date) > 0 && (
                                <em> · còn {daysUntil(nextExam.date)} ngày</em>
                            )}
                            {daysUntil(nextExam.date) === 0 && <em> · Hôm nay</em>}
            </span>
                    </div>
                )}
            </div>

            {/* Stats */}
            <div className="exam-stats">
                <div className="exam-stat-card">
                    <div className="exam-stat-icon blue">📋</div>
                    <div>
                        <span className="exam-stat-num">{exams.length}</span>
                        <span className="exam-stat-label">Tổng môn thi</span>
                    </div>
                </div>
                <div className="exam-stat-card">
                    <div className="exam-stat-icon amber">⏰</div>
                    <div>
                        <span className="exam-stat-num amber">{upcoming.length}</span>
                        <span className="exam-stat-label">Sắp / đang thi</span>
                    </div>
                </div>
                <div className="exam-stat-card">
                    <div className="exam-stat-icon green">✅</div>
                    <div>
                        <span className="exam-stat-num green">{doneCount}</span>
                        <span className="exam-stat-label">Đã thi</span>
                    </div>
                </div>
            </div>

            {/* Bảng */}
            <div className="sch-panel exam-panel">
                <div className="sch-toolbar">
                    <div className="sch-filters">
                        <select className="sch-select" value={semester} onChange={(e) => setSemester(e.target.value)}>
                            <option value="hk1">Học kỳ 1</option>
                            <option value="hk2">Học kỳ 2</option>
                        </select>
                        <select className="sch-select" value={examType} onChange={(e) => setExamType(e.target.value as ExamType)}>
                            <option value="gk">Thi giữa kỳ</option>
                            <option value="ck">Thi cuối kỳ</option>
                            <option value="all">Tất cả</option>
                        </select>
                    </div>
                    <button type="button" className="sch-btn-primary">Xem lịch</button>
                </div>

                <div className="exam-table-head">
                    <h3>Lịch thi cá nhân</h3>
                    <span className="exam-count">{exams.length} môn</span>
                </div>

                <div className="sch-table-wrap">
                    <table className="exam-table">
                        <thead>
                        <tr>
                            <th className="col-stt">STT</th>
                            <th>Môn thi</th>
                            <th>Ngày thi</th>
                            <th>Thời gian</th>
                            <th>Hình thức</th>
                            <th>Phòng</th>
                            <th>SBD</th>
                            <th>Trạng thái</th>
                        </tr>
                        </thead>
                        <tbody>
                        {exams.map((ex) => (
                            <tr key={ex.stt} className={ex.status === 'today' ? 'exam-row-today' : ''}>
                                <td className="exam-stt">{ex.stt}</td>
                                <td>
                                    <div className="exam-subject-cell">
                                        <span className="exam-subject">{ex.subject}</span>
                                    </div>
                                </td>
                                <td className="exam-date">{ex.date}</td>
                                <td className="exam-time">{ex.time}</td>
                                <td><span className="exam-type">{ex.type}</span></td>
                                <td className="exam-room">{ex.room}</td>
                                <td className="exam-sbd">{ex.sbd}</td>
                                <td>
                                    {ex.status === 'today' && <span className="exam-badge today">Hôm nay</span>}
                                    {ex.status === 'upcoming' && <span className="exam-badge upcoming">Sắp tới</span>}
                                    {ex.status === 'done' && <span className="exam-badge done">Đã thi</span>}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>

                <div className="sch-note">
                    <strong>Lưu ý:</strong> Có mặt trước giờ thi ít nhất <strong>15 phút</strong>.
                    Mang theo thẻ học sinh và dụng cụ theo quy định nhà trường.
                </div>
            </div>
        </div>
    );
}