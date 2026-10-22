'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import '../grades-extra.css';
import { useCurrentStudent } from '@/hooks/useCurrentStudent';
import { SEM_LABEL, Sem, fmt, rankClass, rankOf, rowsOf, useHsGrades } from '@/hooks/useHsGrades';

const tone = (n: number | null) => (n === null ? 'none' : n >= 8 ? 'hi' : n >= 6.5 ? 'mid' : n >= 5 ? 'lo' : 'bad');

export default function GradesSubjectsPage() {
    const { student } = useCurrentStudent();
    const { data, loading, error, reload } = useHsGrades();
    const [yearId, setYearId] = useState<string | null>(null);
    const [sem, setSem] = useState<Sem>('2');
    const [picked, setPicked] = useState<string | null>(null);

    // Đọc ?mon=...&nam=... từ trang Bảng điểm (không dùng useSearchParams để tránh lỗi build)
    useEffect(() => {
        const q = new URLSearchParams(window.location.search);
        const mon = q.get('mon');
        if (mon) setPicked(mon);
    }, []);

    const years = data?.years ?? [];
    useEffect(() => {
        const nam = new URLSearchParams(window.location.search).get('nam');
        if (!nam || !years.length) return;
        const norm = (s: string) => s.replace(/[^0-9]+/g, '-').replace(/^-|-$/g, '');
        const y = years.find((x) => norm(x.label) === norm(nam));
        if (y) setYearId(y.id);
    }, [years]);

    const year = years.find((y) => y.id === yearId) ?? years.find((y) => y.is_current) ?? years[years.length - 1];
    const rows = useMemo(() => rowsOf(year, sem), [year, sem]);
    const sel = rows.find((r) => r.subject === picked) ?? null;

    // Quá trình của môn đang chọn qua các năm / học kỳ
    const history = useMemo(() => {
        if (!picked) return [];
        return years.map((y) => ({
            label: y.label.replace('-', ' – '),
            cls: y.class_name,
            hk1: y.semesters.hk1.find((r) => r.subject === picked) ?? null,
            hk2: y.semesters.hk2.find((r) => r.subject === picked) ?? null,
        }));
    }, [years, picked]);

    return (
        <div className="gx-page">
            <header className="gx-hero">
                <p className="gx-eyebrow">Góc học tập</p>
                <h1>Chi tiết môn học</h1>
                <p className="gx-sub">
                    {data?.student.name || student?.full_name || 'Học sinh'}
                    {year?.class_name ? ` · Lớp ${year.class_name}` : ''}
                    {year ? ` · Năm học ${year.label.replace('-', ' – ')}` : ''} · {SEM_LABEL[sem]}
                </p>
            </header>

            <nav className="gx-tabs" aria-label="Điều hướng điểm số">
                <Link href="/student/grades">Bảng điểm</Link>
                <Link href="/student/grades/summary">Tổng kết học kỳ</Link>
                <Link href="/student/grades/subjects" className="on" aria-current="page">Chi tiết môn học</Link>
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

                    {rows.length === 0 ? (
                        <section className="gx-card gx-empty">Chưa có điểm cho {SEM_LABEL[sem].toLowerCase()} của năm học này.</section>
                    ) : (
                        <div className="gx-grid">
                            {rows.map((r) => {
                                const isPass = r.type === 'pass';
                                const rank = isPass ? r.rank : r.tbm !== null ? rankOf(r.tbm) : null;
                                return (
                                    <button
                                        key={r.id + r.subject}
                                        type="button"
                                        className={`gx-sub-card ${picked === r.subject ? 'on' : ''}`}
                                        aria-pressed={picked === r.subject}
                                        onClick={() => setPicked(picked === r.subject ? null : r.subject)}
                                    >
                                        <div className="gx-sub-top">
                                            <h3>{r.subject}</h3>
                                            {rank && <span className={`gx-rank ${rankClass(rank)}`}>{rank}</span>}
                                        </div>
                                        {isPass ? (
                                            <div className="gx-tbm gx-s-none">—</div>
                                        ) : (
                                            <div className={`gx-tbm gx-s-${tone(r.tbm)}`}>{fmt(r.tbm)}</div>
                                        )}
                                        <p className="gx-meta">{isPass ? 'Đánh giá Đạt / Chưa đạt' : `TBM ${SEM_LABEL[sem].toLowerCase()}`}{r.teacher_name ? ` · GV ${r.teacher_name}` : ''}</p>
                                        {!isPass && sem !== '0' && (
                                            <>
                                                <div className="gx-txline">TX: {r.tx.map((t) => fmt(t)).join(' · ')}</div>
                                                <div className="gx-det">
                                                    <div>Giữa kỳ<strong>{fmt(r.gk)}</strong></div>
                                                    <div>Cuối kỳ<strong>{fmt(r.ck)}</strong></div>
                                                    <div>TBM<strong>{fmt(r.tbm)}</strong></div>
                                                </div>
                                            </>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {picked && (
                        <section className="gx-card">
                            <h2>Quá trình môn {picked}</h2>
                            <div className="gx-tablewrap">
                                <table className="gx-table">
                                    <thead>
                                    <tr><th>Năm học</th><th>Lớp</th><th>TBM HK1</th><th>TBM HK2</th><th>Cả năm</th></tr>
                                    </thead>
                                    <tbody>
                                    {history.map((h) => {
                                        const pass = h.hk1?.type === 'pass';
                                        const t1 = h.hk1?.tbm ?? null;
                                        const t2 = h.hk2?.tbm ?? null;
                                        const yr = t1 !== null && t2 !== null ? Math.round(((t1 + 2 * t2) / 3) * 10) / 10 : null;
                                        return (
                                            <tr key={h.label}>
                                                <td>{h.label}</td>
                                                <td>{h.cls}</td>
                                                <td>{pass ? h.hk1?.rank ?? '—' : fmt(t1)}</td>
                                                <td>{pass ? h.hk2?.rank ?? '—' : fmt(t2)}</td>
                                                <td><b>{pass ? '—' : fmt(yr)}</b></td>
                                            </tr>
                                        );
                                    })}
                                    </tbody>
                                </table>
                            </div>
                            {sel?.updated_at && <p className="gx-note">Giáo viên cập nhật điểm lần cuối: {sel.updated_at}.</p>}
                        </section>
                    )}
                </>
            )}
        </div>
    );
}