'use client';

import Link from 'next/link';
import '../grades.css';

const SUBJECTS = [
    { name: 'Toán', tbm: 8.6, rank: 'Giỏi', tx: '8.5 · 9.0 · 8.0 · 8.5', gk: 8.5, ck: 9.0 },
    { name: 'Ngữ văn', tbm: 7.6, rank: 'Khá', tx: '7.5 · 8.0 · 7.0 · 7.5', gk: 7.5, ck: 8.0 },
    { name: 'Tiếng Anh', tbm: 8.8, rank: 'Giỏi', tx: '9.0 · 8.5 · 9.0 · 8.5', gk: 9.0, ck: 8.5 },
    { name: 'Vật lý', tbm: 7.9, rank: 'Khá', tx: '8.0 · 7.5 · 8.5 · 8.0', gk: 8.0, ck: 7.5 },
    { name: 'Hóa học', tbm: 7.6, rank: 'Khá', tx: '7.0 · 7.5 · 8.0 · 7.5', gk: 7.5, ck: 8.0 },
    { name: 'Sinh học', tbm: 8.5, rank: 'Giỏi', tx: '8.5 · 8.0 · 8.5 · 9.0', gk: 8.5, ck: 8.5 },
];

function rankClass(rank: string) {
    if (rank === 'Giỏi') return 'rank-gioi';
    if (rank === 'Khá') return 'rank-kha';
    return 'rank-tb';
}

export default function GradesSubjectsPage() {
    return (
        <div className="gr-page">
            <div className="gr-hero">
                <div>
                    <p className="gr-hero-label">Góc học tập</p>
                    <h1>Chi tiết môn học</h1>
                    <p className="gr-hero-sub">Chọn môn để xem quá trình nhập điểm</p>
                </div>
            </div>

            <div className="gr-tabs">
                <Link href="/student/grades" className="gr-tab">Bảng điểm</Link>
                <Link href="/student/grades/summary" className="gr-tab">Tổng kết học kỳ</Link>
                <Link href="/student/grades/subjects" className="gr-tab active">Chi tiết môn học</Link>
            </div>

            <div className="gr-subject-grid">
                {SUBJECTS.map((s) => (
                    <div key={s.name} className="gr-subject-card">
                        <div className="gr-subject-top">
                            <h3>{s.name}</h3>
                            <span className={`gr-rank ${rankClass(s.rank)}`}>{s.rank}</span>
                        </div>
                        <div className="gr-subject-tbm">{s.tbm.toFixed(1)}</div>
                        <p className="gr-subject-meta">TBM học kỳ</p>
                        <div className="gr-subject-detail">
                            <div><span>TX</span><strong>{s.tx}</strong></div>
                            <div><span>Giữa kỳ</span><strong>{s.gk.toFixed(1)}</strong></div>
                            <div><span>Cuối kỳ</span><strong>{s.ck.toFixed(1)}</strong></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}