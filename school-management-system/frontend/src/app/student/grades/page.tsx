'use client';

import { useState } from 'react';
import Link from 'next/link';
import './grades.css';

interface GradeRow {
    stt: number;
    subject: string;
    tx1: number | null;
    tx2: number | null;
    tx3: number | null;
    tx4: number | null;
    gk: number | null;
    ck: number | null;
    tbm: number | null;
    rank: string;
}

const GRADES_HK1: GradeRow[] = [
    { stt: 1, subject: 'Toán', tx1: 8.5, tx2: 9.0, tx3: 8.0, tx4: 8.5, gk: 8.5, ck: 9.0, tbm: 8.6, rank: 'Giỏi' },
    { stt: 2, subject: 'Ngữ văn', tx1: 7.5, tx2: 8.0, tx3: 7.0, tx4: 7.5, gk: 7.5, ck: 8.0, tbm: 7.6, rank: 'Khá' },
    { stt: 3, subject: 'Tiếng Anh', tx1: 9.0, tx2: 8.5, tx3: 9.0, tx4: 8.5, gk: 9.0, ck: 8.5, tbm: 8.8, rank: 'Giỏi' },
    { stt: 4, subject: 'Vật lý', tx1: 8.0, tx2: 7.5, tx3: 8.5, tx4: 8.0, gk: 8.0, ck: 7.5, tbm: 7.9, rank: 'Khá' },
    { stt: 5, subject: 'Hóa học', tx1: 7.0, tx2: 7.5, tx3: 8.0, tx4: 7.5, gk: 7.5, ck: 8.0, tbm: 7.6, rank: 'Khá' },
    { stt: 6, subject: 'Sinh học', tx1: 8.5, tx2: 8.0, tx3: 8.5, tx4: 9.0, gk: 8.5, ck: 8.5, tbm: 8.5, rank: 'Giỏi' },
    { stt: 7, subject: 'Lịch sử', tx1: 8.0, tx2: 8.5, tx3: 7.5, tx4: 8.0, gk: 8.0, ck: 8.5, tbm: 8.1, rank: 'Giỏi' },
    { stt: 8, subject: 'Địa lý', tx1: 7.5, tx2: 8.0, tx3: 7.5, tx4: 8.0, gk: 7.5, ck: 8.0, tbm: 7.7, rank: 'Khá' },
    { stt: 9, subject: 'GDCD', tx1: 9.0, tx2: 9.0, tx3: 8.5, tx4: 9.0, gk: 9.0, ck: 9.0, tbm: 8.9, rank: 'Giỏi' },
    { stt: 10, subject: 'Tin học', tx1: 9.5, tx2: 9.0, tx3: 9.5, tx4: 9.0, gk: 9.0, ck: 9.5, tbm: 9.3, rank: 'Giỏi' },
    { stt: 11, subject: 'Công nghệ', tx1: 8.0, tx2: 8.5, tx3: 8.0, tx4: 8.5, gk: 8.0, ck: 8.5, tbm: 8.2, rank: 'Giỏi' },
    { stt: 12, subject: 'Thể dục', tx1: null, tx2: null, tx3: null, tx4: null, gk: null, ck: null, tbm: null, rank: 'Đạt' },
];

function rankClass(rank: string) {
    if (rank === 'Giỏi') return 'rank-gioi';
    if (rank === 'Khá') return 'rank-kha';
    if (rank === 'TB' || rank === 'Trung bình') return 'rank-tb';
    if (rank === 'Đạt') return 'rank-dat';
    return 'rank-yeu';
}

function fmt(n: number | null) {
    if (n === null) return '—';
    return n.toFixed(1);
}

export default function StudentGradesPage() {
    const [semester, setSemester] = useState('hk1');

    const avg =
        GRADES_HK1.filter((g) => g.tbm !== null).reduce((s, g) => s + (g.tbm || 0), 0) /
        GRADES_HK1.filter((g) => g.tbm !== null).length;

    return (
        <div className="gr-page">
            {/* Hero */}
            <div className="gr-hero">
                <div>
                    <p className="gr-hero-label">Góc học tập</p>
                    <h1>Bảng điểm</h1>
                    <p className="gr-hero-sub">Lớp 10A2 · Năm học 2025 – 2026</p>
                </div>
                <div className="gr-hero-avg">
                    <span className="gr-hero-avg-label">Điểm TB HK1</span>
                    <strong>{avg.toFixed(1)}</strong>
                    <span className="gr-hero-rank">Học lực: Giỏi</span>
                </div>
            </div>

            {/* Tabs nhanh */}
            <div className="gr-tabs">
                <Link href="/student/grades" className="gr-tab active">Bảng điểm</Link>
                <Link href="/student/grades/summary" className="gr-tab">Tổng kết học kỳ</Link>
                <Link href="/student/grades/subjects" className="gr-tab">Chi tiết môn học</Link>
            </div>

            {/* Stats */}
            <div className="gr-stats">
                <div className="gr-stat">
                    <span className="gr-stat-val sky">{avg.toFixed(1)}</span>
                    <span className="gr-stat-lbl">Điểm trung bình</span>
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
                    <span className="gr-stat-val">{GRADES_HK1.length}</span>
                    <span className="gr-stat-lbl">Số môn</span>
                </div>
            </div>

            {/* Bảng */}
            <div className="gr-panel">
                <div className="gr-toolbar">
                    <div className="gr-filters">
                        <select className="gr-select" value={semester} onChange={(e) => setSemester(e.target.value)}>
                            <option value="hk1">Học kỳ 1</option>
                            <option value="hk2">Học kỳ 2</option>
                            <option value="cn">Cả năm</option>
                        </select>
                    </div>
                    <button type="button" className="gr-btn-outline">Xuất bảng điểm</button>
                </div>

                <div className="gr-table-wrap">
                    <table className="gr-table">
                        <thead>
                        <tr>
                            <th rowSpan={2} className="col-stt">STT</th>
                            <th rowSpan={2} className="col-subject">Môn học</th>
                            <th colSpan={4}>Điểm thường xuyên (TX)</th>
                            <th rowSpan={2}>Giữa kỳ</th>
                            <th rowSpan={2}>Cuối kỳ</th>
                            <th rowSpan={2}>TBM</th>
                            <th rowSpan={2}>Xếp loại</th>
                        </tr>
                        <tr>
                            <th>TX1</th>
                            <th>TX2</th>
                            <th>TX3</th>
                            <th>TX4</th>
                        </tr>
                        </thead>
                        <tbody>
                        {GRADES_HK1.map((g) => (
                            <tr key={g.stt}>
                                <td className="col-stt">{g.stt}</td>
                                <td className="col-subject">
                                    <Link href={`/student/grades/subjects?mon=${encodeURIComponent(g.subject)}`}>
                                        {g.subject}
                                    </Link>
                                </td>
                                <td>{fmt(g.tx1)}</td>
                                <td>{fmt(g.tx2)}</td>
                                <td>{fmt(g.tx3)}</td>
                                <td>{fmt(g.tx4)}</td>
                                <td className="col-mid">{fmt(g.gk)}</td>
                                <td className="col-final">{fmt(g.ck)}</td>
                                <td className="col-avg">{fmt(g.tbm)}</td>
                                <td>
                                    <span className={`gr-rank ${rankClass(g.rank)}`}>{g.rank}</span>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>

                <div className="gr-note">
                    <strong>Ghi chú (Thông tư 22):</strong> TBM = (TX×2 + GK×2 + CK×3) / hệ số tương ứng theo quy định từng môn.
                    Điểm Thể dục, Âm nhạc, Mỹ thuật đánh giá Đạt / Chưa đạt.
                </div>
            </div>
        </div>
    );
}