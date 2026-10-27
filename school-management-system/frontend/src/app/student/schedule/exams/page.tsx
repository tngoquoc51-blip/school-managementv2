'use client';

import { useEffect, useMemo, useState } from 'react';
import '../schedule.css';
import './exams.css';
import { getStudentToken, useCurrentStudent } from '@/hooks/useCurrentStudent';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

type ExamKind = 'gk' | 'ck';
type ExamStatus = 'upcoming' | 'done' | 'today';
type ViewMode = 'list' | 'timeline';

interface Exam {
    id: string;
    stt: number;
    subject: string;
    date: string; // dd/mm/yyyy
    weekday: string;
    time: string;
    type: string;
    format: string;
    duration: string;
    semester: number;
    kind: ExamKind;
    periodName: string;
    status: ExamStatus;
    rawDate: string;
}

function parseVNDate(s: string) {
    const [d, m, y] = s.split('/').map(Number);
    return new Date(y, m - 1, d);
}

function formatDateFromApi(raw: string) {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function toIsoLike(vn: string) {
    const [d, m, y] = vn.split('/').map(Number);
    if (!y) return vn;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function computeStatus(dateStr: string): ExamStatus {
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
    return String(t).slice(0, 5);
}

export default function StudentExamSchedulePage() {
    const { student, loading: stLoading } = useCurrentStudent();
    const [semester, setSemester] = useState<'hk1' | 'hk2'>('hk1');
    const [kind, setKind] = useState<'all' | ExamKind>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | ExamStatus>('all');
    const [q, setQ] = useState('');
    const [view, setView] = useState<ViewMode>('list');
    const [exams, setExams] = useState<Exam[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [detail, setDetail] = useState<Exam | null>(null);

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
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        })
            .then(async (r) => {
                if (!r.ok) {
                    throw new Error(
                        r.status === 401
                            ? 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại'
                            : `HTTP ${r.status}`
                    );
                }
                return r.json();
            })
            .then((j) => {
                const periods = j?.data?.periods;
                if (!Array.isArray(periods)) throw new Error(j?.message || 'Lỗi API');
                const list: Exam[] = [];
                periods.forEach((p: any) => {
                    (p.items || []).forEach((e: any, idx: number) => {
                        const date = formatDateFromApi(e.date || '');
                        const apiStatus = e.status as ExamStatus | undefined;
                        const status =
                            apiStatus === 'done' || apiStatus === 'today' || apiStatus === 'upcoming'
                                ? apiStatus
                                : computeStatus(date);
                        list.push({
                            id: `${p.code || p.semester}-${e.subject}-${e.date}-${idx}`,
                            stt: 0,
                            subject: e.subject || '',
                            date,
                            weekday: e.weekday_label || '',
                            time: [trimTime(e.start), trimTime(e.end)].filter(Boolean).join(' – '),
                            type: [e.format, e.duration_minutes ? `${e.duration_minutes} phút` : '']
                                .filter(Boolean)
                                .join(' · '),
                            format: e.format || '',
                            duration: e.duration_minutes ? `${e.duration_minutes} phút` : '',
                            semester: Number(p.semester) || 1,
                            kind: String(p.code || '').toUpperCase().startsWith('CK') ? 'ck' : 'gk',
                            periodName: p.name || '',
                            status,
                            rawDate: e.date || toIsoLike(date),
                        });
                    });
                });
                setExams(list);
            })
            .catch((e) => setError(e.message || 'Không tải được lịch thi'))
            .finally(() => setLoading(false));
    }, [student?.class_name]);

    const visible = useMemo(() => {
        const n = q.trim().toLowerCase();
        return exams
            .filter((e) => e.semester === (semester === 'hk2' ? 2 : 1))
            .filter((e) => kind === 'all' || e.kind === kind)
            .filter((e) => statusFilter === 'all' || e.status === statusFilter)
            .filter((e) => !n || e.subject.toLowerCase().includes(n) || e.type.toLowerCase().includes(n))
            .sort((a, b) => parseVNDate(a.date).getTime() - parseVNDate(b.date).getTime())
            .map((e, i) => ({ ...e, stt: i + 1 }));
    }, [exams, semester, kind, statusFilter, q]);

    const stats = useMemo(() => {
        const scope = exams.filter((e) => e.semester === (semester === 'hk2' ? 2 : 1));
        return {
            total: scope.length,
            upcoming: scope.filter((e) => e.status === 'upcoming' || e.status === 'today').length,
            done: scope.filter((e) => e.status === 'done').length,
            today: scope.filter((e) => e.status === 'today').length,
        };
    }, [exams, semester]);

    const nextExam = useMemo(() => {
        return visible
            .filter((e) => e.status === 'upcoming' || e.status === 'today')
            .sort((a, b) => parseVNDate(a.date).getTime() - parseVNDate(b.date).getTime())[0];
    }, [visible]);

    const groupedByDate = useMemo(() => {
        const map = new Map<string, Exam[]>();
        visible.forEach((e) => {
            const key = e.date;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(e);
        });
        return Array.from(map.entries());
    }, [visible]);

    const onPrint = () => window.print();

    if (stLoading || loading) {
        return (
            <div className="ex-page">
                <div className="ex-skel">Đang tải lịch thi…</div>
            </div>
        );
    }

    return (
        <div className="ex-page">
            {/* Hero */}
            <header className="ex-hero">
                <div className="ex-hero-left">
                    <p className="ex-kicker">Cổng thông tin học sinh · Học tập</p>
                    <h1>Lịch thi</h1>
                    <p className="ex-sub">
                        {student?.class_name ? `Lớp ${student.class_name}` : '—'}
                        {' · '}
                        Năm học {(student?.academic_year || '2025-2026').replace('-', ' – ')}
                    </p>
                </div>
                {nextExam ? (
                    <div className="ex-next">
                        <span className="ex-next-tag">
                            {nextExam.status === 'today' ? 'Thi hôm nay' : 'Môn gần nhất'}
                        </span>
                        <strong>{nextExam.subject}</strong>
                        <span className="ex-next-meta">
                            {nextExam.weekday ? `${nextExam.weekday}, ` : ''}
                            {nextExam.date}
                            {nextExam.time ? ` · ${nextExam.time}` : ''}
                            {daysUntil(nextExam.date) > 0 && (
                                <em> · còn {daysUntil(nextExam.date)} ngày</em>
                            )}
                        </span>
                        <button type="button" className="ex-btn-ghost light" onClick={() => setDetail(nextExam)}>
                            Xem chi tiết
                        </button>
                    </div>
                ) : (
                    <div className="ex-next muted">
                        <span className="ex-next-tag">Không còn lịch sắp tới</span>
                        <strong>Học kỳ này</strong>
                        <span className="ex-next-meta">Tất cả môn đã hoàn thành hoặc chưa công bố</span>
                    </div>
                )}
            </header>

            {error && <div className="ex-alert">{error}</div>}

            {/* Stats */}
            <div className="ex-stats">
                <button type="button" className={`ex-stat ${statusFilter === 'all' ? 'on' : ''}`} onClick={() => setStatusFilter('all')}>
                    <span className="ex-stat-ico blue">📋</span>
                    <span>
                        <b>{stats.total}</b>
                        <small>Tổng môn (HK đang chọn)</small>
                    </span>
                </button>
                <button type="button" className={`ex-stat ${statusFilter === 'upcoming' ? 'on' : ''}`} onClick={() => setStatusFilter(statusFilter === 'upcoming' ? 'all' : 'upcoming')}>
                    <span className="ex-stat-ico amber">⏰</span>
                    <span>
                        <b className="amber">{stats.upcoming}</b>
                        <small>Sắp / hôm nay</small>
                    </span>
                </button>
                <button type="button" className={`ex-stat ${statusFilter === 'done' ? 'on' : ''}`} onClick={() => setStatusFilter(statusFilter === 'done' ? 'all' : 'done')}>
                    <span className="ex-stat-ico green">✅</span>
                    <span>
                        <b className="green">{stats.done}</b>
                        <small>Đã thi</small>
                    </span>
                </button>
                <div className="ex-stat static">
                    <span className="ex-stat-ico sky">📅</span>
                    <span>
                        <b className="sky">{stats.today}</b>
                        <small>Thi hôm nay</small>
                    </span>
                </div>
            </div>

            {/* Toolbar chức năng con */}
            <div className="ex-toolbar">
                <div className="ex-seg">
                    <button type="button" className={semester === 'hk1' ? 'on' : ''} onClick={() => setSemester('hk1')}>
                        Học kỳ 1
                    </button>
                    <button type="button" className={semester === 'hk2' ? 'on' : ''} onClick={() => setSemester('hk2')}>
                        Học kỳ 2
                    </button>
                </div>
                <div className="ex-seg">
                    <button type="button" className={kind === 'all' ? 'on' : ''} onClick={() => setKind('all')}>
                        Tất cả
                    </button>
                    <button type="button" className={kind === 'gk' ? 'on gk' : ''} onClick={() => setKind('gk')}>
                        Giữa kỳ
                    </button>
                    <button type="button" className={kind === 'ck' ? 'on ck' : ''} onClick={() => setKind('ck')}>
                        Cuối kỳ
                    </button>
                </div>
                <div className="ex-search">
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Tìm môn thi…"
                        aria-label="Tìm môn"
                    />
                </div>
                <div className="ex-seg">
                    <button type="button" className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>
                        Bảng
                    </button>
                    <button type="button" className={view === 'timeline' ? 'on' : ''} onClick={() => setView('timeline')}>
                        Theo ngày
                    </button>
                </div>
                <button type="button" className="ex-btn-outline" onClick={onPrint}>
                    In lịch
                </button>
            </div>

            {/* Nội dung */}
            <section className="ex-panel">
                <div className="ex-panel-head">
                    <div>
                        <h2>
                            Lịch thi · Lớp {student?.class_name || '—'}
                        </h2>
                        <p>
                            {semester === 'hk1' ? 'Học kỳ 1' : 'Học kỳ 2'}
                            {kind === 'gk' ? ' · Giữa kỳ' : kind === 'ck' ? ' · Cuối kỳ' : ''}
                        </p>
                    </div>
                    <span className="ex-chip">{visible.length} môn</span>
                </div>

                {view === 'list' && (
                    <div className="ex-table-wrap">
                        <table className="ex-table">
                            <thead>
                            <tr>
                                <th className="c-stt">STT</th>
                                <th>Môn thi</th>
                                <th>Ngày thi</th>
                                <th>Thời gian</th>
                                <th>Hình thức</th>
                                <th>Loại</th>
                                <th>Trạng thái</th>
                                <th></th>
                            </tr>
                            </thead>
                            <tbody>
                            {visible.map((ex) => (
                                <tr key={ex.id} className={ex.status === 'today' ? 'is-today' : ''}>
                                    <td className="c-stt">{ex.stt}</td>
                                    <td>
                                        <strong className="ex-subname">{ex.subject}</strong>
                                        {ex.periodName && <div className="ex-muted">{ex.periodName}</div>}
                                    </td>
                                    <td>
                                        {ex.weekday ? `${ex.weekday}, ` : ''}
                                        {ex.date}
                                    </td>
                                    <td className="mono">{ex.time || '—'}</td>
                                    <td>
                                        <span className="ex-pill">{ex.type || '—'}</span>
                                    </td>
                                    <td>
                                            <span className={`ex-kind ${ex.kind}`}>
                                                {ex.kind === 'ck' ? 'Cuối kỳ' : 'Giữa kỳ'}
                                            </span>
                                    </td>
                                    <td>
                                        {ex.status === 'today' && <span className="ex-badge today">Hôm nay</span>}
                                        {ex.status === 'upcoming' && <span className="ex-badge up">Sắp tới</span>}
                                        {ex.status === 'done' && <span className="ex-badge done">Đã thi</span>}
                                    </td>
                                    <td>
                                        <button type="button" className="ex-link" onClick={() => setDetail(ex)}>
                                            Chi tiết
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {visible.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="ex-empty">
                                        Không có lịch thi phù hợp bộ lọc. Thử đổi học kỳ hoặc loại kỳ thi.
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                )}

                {view === 'timeline' && (
                    <div className="ex-timeline">
                        {groupedByDate.map(([date, items]) => (
                            <div key={date} className="ex-day">
                                <div className="ex-day-label">
                                    <b>{items[0]?.weekday || '—'}</b>
                                    <span>{date}</span>
                                    {items.some((i) => i.status === 'today') && (
                                        <em className="ex-badge today">Hôm nay</em>
                                    )}
                                </div>
                                <div className="ex-day-items">
                                    {items.map((ex) => (
                                        <button
                                            key={ex.id}
                                            type="button"
                                            className={`ex-card ${ex.status}`}
                                            onClick={() => setDetail(ex)}
                                        >
                                            <span className="ex-card-time">{ex.time || '—'}</span>
                                            <span className="ex-card-body">
                                                <strong>{ex.subject}</strong>
                                                <small>
                                                    {ex.kind === 'ck' ? 'Cuối kỳ' : 'Giữa kỳ'}
                                                    {ex.type ? ` · ${ex.type}` : ''}
                                                </small>
                                            </span>
                                            <span className={`ex-badge ${ex.status === 'upcoming' ? 'up' : ex.status}`}>
                                                {ex.status === 'today' ? 'Hôm nay' : ex.status === 'done' ? 'Đã thi' : 'Sắp tới'}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {groupedByDate.length === 0 && (
                            <p className="ex-empty">Không có lịch theo bộ lọc hiện tại.</p>
                        )}
                    </div>
                )}

                <div className="ex-note">
                    <strong>Lưu ý:</strong> Có mặt trước giờ thi ít nhất <b>15 phút</b>. Mang theo thẻ học sinh
                    và dụng cụ theo quy định nhà trường. Lịch có thể điều chỉnh — theo dõi thông báo từ giáo vụ.
                </div>
            </section>

            {/* Modal chi tiết */}
            {detail && (
                <div className="ex-modal-bg" onClick={() => setDetail(null)} role="presentation">
                    <div className="ex-modal" onClick={(e) => e.stopPropagation()} role="dialog">
                        <div className="ex-modal-head">
                            <div>
                                <span className={`ex-kind ${detail.kind}`}>
                                    {detail.kind === 'ck' ? 'Thi cuối kỳ' : 'Thi giữa kỳ'}
                                </span>
                                <h3>{detail.subject}</h3>
                            </div>
                            <button type="button" className="ex-close" onClick={() => setDetail(null)} aria-label="Đóng">
                                ×
                            </button>
                        </div>
                        <div className="ex-modal-grid">
                            <div>
                                <small>Ngày thi</small>
                                <b>
                                    {detail.weekday ? `${detail.weekday}, ` : ''}
                                    {detail.date}
                                </b>
                            </div>
                            <div>
                                <small>Thời gian</small>
                                <b>{detail.time || '—'}</b>
                            </div>
                            <div>
                                <small>Hình thức</small>
                                <b>{detail.format || detail.type || '—'}</b>
                            </div>
                            <div>
                                <small>Thời lượng</small>
                                <b>{detail.duration || '—'}</b>
                            </div>
                            <div>
                                <small>Đợt thi</small>
                                <b>{detail.periodName || '—'}</b>
                            </div>
                            <div>
                                <small>Trạng thái</small>
                                <b>
                                    {detail.status === 'today'
                                        ? 'Thi hôm nay'
                                        : detail.status === 'done'
                                            ? 'Đã thi'
                                            : `Sắp tới${daysUntil(detail.date) > 0 ? ` (còn ${daysUntil(detail.date)} ngày)` : ''}`}
                                </b>
                            </div>
                        </div>
                        <div className="ex-modal-acts">
                            <button type="button" className="ex-btn-outline" onClick={() => setDetail(null)}>
                                Đóng
                            </button>
                            <button type="button" className="ex-btn-primary" onClick={onPrint}>
                                In / Lưu PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}