'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import '../grades-extra.css';
import { useCurrentStudent } from '@/hooks/useCurrentStudent';
import { SEM_LABEL, Sem, avgOf, conductOf, fmt, rankClass, rankOf, rowsOf, useHsGrades } from '@/hooks/useHsGrades';

/* Nhóm môn */
const GROUPS: { name: string; subjects: string[] }[] = [
    { name: 'Toán – Tin', subjects: ['Toán', 'Tin học'] },
    { name: 'Ngữ văn – Ngoại ngữ', subjects: ['Ngữ văn', 'Tiếng Anh'] },
    { name: 'Khoa học tự nhiên', subjects: ['Vật lý', 'Hóa học', 'Sinh học'] },
    { name: 'Khoa học xã hội', subjects: ['Lịch sử', 'Địa lý', 'GDCD'] },
    { name: 'Công nghệ – Quốc phòng', subjects: ['Công nghệ', 'GDQP-AN'] },
];

/** Danh hiệu theo kết quả học tập (học lực) và rèn luyện. */
function title(academic: string | null, conduct: string | null) {
    if (!academic || !conduct) return '—';
    if (academic === 'Giỏi' && conduct === 'Tốt') return 'Học sinh Giỏi';
    if ((academic === 'Giỏi' || academic === 'Khá') && (conduct === 'Tốt' || conduct === 'Khá')) return 'Học sinh Tiên tiến';
    return 'Chưa xếp danh hiệu';
}

export default function GradesSummaryPage() {
    const { student } = useCurrentStudent();
    const { data, loading, error, reload } = useHsGrades();
    const [yearId, setYearId] = useState<string | null>(null);
    const [sem, setSem] = useState<Sem>('2');

    const years = data?.years ?? [];
    const year = years.find((y) => y.id === yearId) ?? years.find((y) => y.is_current) ?? years[years.length - 1];
    const rows = useMemo(() => rowsOf(year, sem), [year, sem]);
    const scored = rows.filter((r) => r.tbm !== null);
    const avg = avgOf(rows);
    const academic = avg !== null ? rankOf(avg) : null;
    const conduct = conductOf(year, sem);

    const groups = GROUPS.map((g) => {
        const rs = rows.filter((r) => g.subjects.includes(r.subject));
        const a = avgOf(rs);
        return { name: g.name, avg: a, rank: a !== null ? rankOf(a) : null, n: rs.length };
    }).filter((g) => g.n > 0);

    // Nhận xét tự động từ số liệu (không phải nhận xét của giáo viên)
    const facts: string[] = [];
    if (scored.length) {
        const best = [...scored].sort((a, b) => (b.tbm as number) - (a.tbm as number))[0];
        const worst = [...scored].sort((a, b) => (a.tbm as number) - (b.tbm as number))[0];
        facts.push(`Môn cao nhất: ${best.subject} (${fmt(best.tbm)}).`);
        if (worst.subject !== best.subject) facts.push(`Môn cần cố gắng: ${worst.subject} (${fmt(worst.tbm)}).`);
    }
    if (year && sem === '2') {
        const a1 = avgOf(year.semesters.hk1);
        const a2 = avgOf(year.semesters.hk2);
        if (a1 !== null && a2 !== null) {
            const d = Math.round((a2 - a1) * 10) / 10;
            facts.push(d === 0 ? 'Điểm trung bình HK2 bằng HK1.' : `Điểm trung bình HK2 ${d > 0 ? 'tăng' : 'giảm'} ${Math.abs(d).toFixed(1)} so với HK1.`);
        }
    }

    return (
        <div className="gx-page">
            <header className="gx-hero">
                <p className="gx-eyebrow">Góc học tập</p>
                <h1>Tổng kết học kỳ</h1>
                <p className="gx-sub">
                    {data?.student.name || student?.full_name || 'Học sinh'}
                    {year?.class_name ? ` · Lớp ${year.class_name}` : ''}
                    {year ? ` · Năm học ${year.label.replace('-', ' – ')}` : ''} · {SEM_LABEL[sem]}
                </p>
            </header>

            <nav className="gx-tabs" aria-label="Điều hướng điểm số">
                <Link href="/student/grades">Bảng điểm</Link>
                <Link href="/student/grades/summary" className="on" aria-current="page">Tổng kết học kỳ</Link>
                <Link href="/student/grades/subjects">Chi tiết môn học</Link>
            </nav>

            {error && (
                <div className="gx-alert" role="alert">
                    <span>{error}</span>
                    <button type="button" onClick={reload}>Thử lại</button>
                </div>
            )}

            {loading && !data && <div className="gx-skel" aria-busy="true" />}

            {data && (
                <>
                    <section className="gx-picker" aria-label="Chọn năm học và học kỳ">
                        <div className="gx-years" role="group" aria-label="Năm học">
                            {years.map((y) => (
                                <button key={y.id} type="button" className={`gx-year ${y.id === year?.id ? 'on' : ''}`} aria-pressed={y.id === year?.id} onClick={() => setYearId(y.id)}>
                                    {y.label.replace('-', ' – ')}<small>Lớp {y.class_name}</small>
                                </button>
                            ))}
                        </div>
                        <div className="gx-seg" role="group" aria-label="Học kỳ">
                            {(['1', '2', '0'] as Sem[]).map((s) => (
                                <button key={s} type="button" className={sem === s ? 'on' : ''} aria-pressed={sem === s} onClick={() => setSem(s)}>
                                    {SEM_LABEL[s]}
                                </button>
                            ))}
                        </div>
                    </section>

                    <div className="gx-stats">
                        <div className="gx-stat"><b>{fmt(avg)}</b><span>Điểm TB các môn</span></div>
                        <div className="gx-stat green"><b>{academic ?? '—'}</b><span>Học lực</span></div>
                        <div className="gx-stat violet"><b>{conduct ?? '—'}</b><span>Rèn luyện</span></div>
                        <div className="gx-stat amber"><b style={{ fontSize: 20 }}>{title(academic, conduct)}</b><span>Danh hiệu</span></div>
                    </div>

                    {rows.length === 0 ? (
                        <section className="gx-card gx-empty">Chưa có điểm cho {SEM_LABEL[sem].toLowerCase()} của năm học này.</section>
                    ) : (
                        <div className="gx-two">
                            <section className="gx-card">
                                <h2>Tóm tắt theo nhóm môn</h2>
                                <div className="gx-tablewrap">
                                    <table className="gx-table">
                                        <thead><tr><th>Nhóm môn</th><th>Điểm TB</th><th>Xếp loại</th></tr></thead>
                                        <tbody>
                                        {groups.map((g) => (
                                            <tr key={g.name}>
                                                <td>{g.name}</td>
                                                <td><b>{fmt(g.avg)}</b></td>
                                                <td>{g.rank ? <span className={`gx-rank ${rankClass(g.rank)}`}>{g.rank}</span> : '—'}</td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="gx-note">Điểm TB nhóm = trung bình điểm TBM các môn trong nhóm. Thể dục và HĐ trải nghiệm đánh giá Đạt / Chưa đạt.</p>
                            </section>

                            <section className="gx-card">
                                <h2>Nhận xét từ số liệu</h2>
                                <ul className="gx-facts">
                                    {facts.map((f) => <li key={f}>{f}</li>)}
                                    {facts.length === 0 && <li>Chưa đủ dữ liệu để nhận xét.</li>}
                                </ul>
                                <p className="gx-note">Đây là nhận xét tự động dựa trên điểm, không phải nhận xét của giáo viên chủ nhiệm.</p>
                            </section>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}