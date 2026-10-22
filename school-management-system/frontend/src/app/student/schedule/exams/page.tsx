'use client';

import { useEffect, useMemo, useState } from 'react';
import '../schedule.css';
import { getStudentToken, useCurrentStudent } from '@/hooks/useCurrentStudent';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

type ExamType = 'gk' | 'ck' | 'all';

interface Exam {
    stt: number;
    subject: string;
    date: string;
    weekday: string;
    time: string;
    type: string;
    semester: number;
    kind: 'gk' | 'ck';
    periodName: string;
    status: 'upcoming' | 'done' | 'today';
}

function parseVNDate(s: string) {
    const [d, m, y] = s.split('/').map(Number);
    return new Date(y, m - 1, d);
}

function formatDateFromApi(raw: string) {
    // "2026-10-15" hoặc ISO
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
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

function trimTime(t?: string | null) {
    if (!t) return '';
    // "07:30:00" → "07:30"
    return String(t).slice(0, 5);
}

export default function StudentExamSchedulePage() {
    const { student, loading: stLoading } = useCurrentStudent();
    const [semester, setSemester] = useState('hk1');
    const [examType, setExamType] = useState<ExamType>('all');
    const [exams, setExams] = useState<Exam[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const token = getStudentToken();
        if (!token) {
            setLoading(false);
            setError('Chưa đăng nhập');
            return;
        }

        setLoading(true);
        setError('');

        fetch(`${API}/hs/exams`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
            },
        })
            .then(async (r) => {
                if (!r.ok) throw new Error(r.status === 401 ? 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại' : `HTTP ${r.status}`);
                return r.json();
            })
            .then((j) => {
                const periods = j?.data?.periods;
                if (!Array.isArray(periods)) throw new Error(j?.message || 'Lỗi API');
                const list: Exam[] = [];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                periods.forEach((p: any) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (p.items || []).forEach((e: any) => {
                        list.push({
                            stt: 0,
                            subject: e.subject || '',
                            date: formatDateFromApi(e.date || ''),
                            weekday: e.weekday_label || '',
                            time: [trimTime(e.start), trimTime(e.end)].filter(Boolean).join(' – '),
                            type: [e.format, e.duration_minutes ? `${e.duration_minutes} phút` : ''].filter(Boolean).join(' · '),
                            semester: Number(p.semester) || 1,
                            kind: String(p.code || '').toUpperCase().startsWith('CK') ? 'ck' : 'gk',
                            periodName: p.name || '',
                            status: e.status === 'done' || e.status === 'today' ? e.status : 'upcoming',
                        });
                    });
                });
                setExams(list);
            })
            .catch((e) => setError(e.message || 'Không tải được lịch thi'))
            .finally(() => setLoading(false));
    }, [student?.class_name]);

    const visible = useMemo(
        () =>
            exams
                .filter((e) => e.semester === (semester === 'hk2' ? 2 : 1))
                .filter((e) => examType === 'all' || e.kind === examType)
                .map((e, i) => ({ ...e, stt: i + 1 })),
        [exams, semester, examType]
    );

    const upcoming = useMemo(
        () => exams.filter((e) => e.status === 'upcoming' || e.status === 'today'),
        [exams]
    );
    const doneCount = useMemo(
        () => exams.filter((e) => e.status === 'done').length,
        [exams]
    );
    const nextExam = useMemo(() => {
        return [...upcoming].sort(
            (a, b) => parseVNDate(a.date).getTime() - parseVNDate(b.date).getTime()
        )[0];
    }, [upcoming]);

    if (stLoading || loading) {
        return (
            <div className="sch-page exam-page" style={{ padding: 24 }}>
                Đang tải lịch thi...
            </div>
        );
    }

    return (
        <div className="sch-page exam-page">
            <div className="exam-hero">
                <div>
                    <p className="exam-hero-label">Cổng thông tin học sinh</p>
                    <h1>Lịch thi</h1>
                    <p className="exam-hero-sub">
                        {student?.class_name ? `Lớp ${student.class_name}` : '—'}
                        {' · '}
                        Năm học {(student?.academic_year || '2025-2026').replace('-', ' – ')}
                    </p>
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

            {error && (
                <div
                    style={{
                        margin: '0 0 12px',
                        padding: '10px 14px',
                        background: '#fef2f2',
                        color: '#b91c1c',
                        borderRadius: 10,
                        fontSize: 13.5,
                    }}
                >
                    {error}
                </div>
            )}

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

            <div className="sch-panel exam-panel">
                <div className="sch-toolbar">
                    <div className="sch-filters">
                        <select
                            className="sch-select"
                            value={semester}
                            onChange={(e) => setSemester(e.target.value)}
                        >
                            <option value="hk1">Học kỳ 1</option>
                            <option value="hk2">Học kỳ 2</option>
                        </select>
                        <select
                            className="sch-select"
                            value={examType}
                            onChange={(e) => setExamType(e.target.value as ExamType)}
                        >
                            <option value="gk">Thi giữa kỳ</option>
                            <option value="ck">Thi cuối kỳ</option>
                            <option value="all">Tất cả</option>
                        </select>
                    </div>
                </div>

                <div className="exam-table-head">
                    <h3>Lịch thi khối {student?.class_name ? student.class_name.replace(/\D/g, '').slice(0, 2) : ''} · lớp {student?.class_name || ''}</h3>
                    <span className="exam-count">{visible.length} môn</span>
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
                            <th>Trạng thái</th>
                        </tr>
                        </thead>
                        <tbody>
                        {visible.map((ex) => (
                            <tr
                                key={ex.stt}
                                className={ex.status === 'today' ? 'exam-row-today' : ''}
                            >
                                <td className="exam-stt">{ex.stt}</td>
                                <td>
                                    <div className="exam-subject-cell">
                                        <span className="exam-subject">{ex.subject}</span>
                                    </div>
                                </td>
                                <td className="exam-date">{ex.weekday ? `${ex.weekday}, ` : ''}{ex.date}</td>
                                <td className="exam-time">{ex.time}</td>
                                <td>
                                    <span className="exam-type">{ex.type}</span>
                                </td>
                                <td>
                                    {ex.status === 'today' && (
                                        <span className="exam-badge today">Hôm nay</span>
                                    )}
                                    {ex.status === 'upcoming' && (
                                        <span className="exam-badge upcoming">Sắp tới</span>
                                    )}
                                    {ex.status === 'done' && (
                                        <span className="exam-badge done">Đã thi</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {visible.length === 0 && (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                                    Chưa có lịch thi cho lựa chọn này.
                                </td>
                            </tr>
                        )}
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