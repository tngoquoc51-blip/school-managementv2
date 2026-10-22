'use client';

import { useEffect, useMemo, useState } from 'react';
import './schedule.css';
import { getStudentToken, useCurrentStudent } from '@/hooks/useCurrentStudent';
import ClassmatesModal from '@/components/student/ClassmatesModal';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const WEEKDAY_HEADERS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

// Giờ mặc định; sẽ được thay bằng giờ thật từ API
const DEFAULT_PERIODS = [
    { id: 1, time: '07:00 – 07:45' },
    { id: 2, time: '07:50 – 08:35' },
    { id: 3, time: '08:55 – 09:40' },
    { id: 4, time: '09:45 – 10:30' },
    { id: 5, time: '10:35 – 11:20' },
];

const SUBJECT_COLORS: Record<string, string> = {
    Toán: 'blue',
    'Ngữ văn': 'violet',
    'Tiếng Anh': 'sky',
    'Vật lý': 'amber',
    'Hóa học': 'emerald',
    'Sinh học': 'green',
    'Lịch sử': 'rose',
    'Địa lý': 'orange',
    GDCD: 'slate',
    'Tin học': 'cyan',
    'Công nghệ': 'indigo',
    'Thể dục': 'lime',
    'GDQP-AN': 'rose',
    'HĐ trải nghiệm': 'emerald',
};

type Cell = { subject: string; teacher: string } | null;

function startOfWeek(date: Date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function addDays(date: Date, n: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
}

function formatVN(date: Date) {
    return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

function sameDay(a: Date, b: Date) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

export default function StudentSchedulePage() {
    const { student, loading: stLoading } = useCurrentStudent();

    const today = useMemo(() => {
        const t = new Date();
        t.setHours(0, 0, 0, 0);
        return t;
    }, []);

    const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
    const [calMonth, setCalMonth] = useState(
        () => new Date(today.getFullYear(), today.getMonth(), 1)
    );
    const [timetable, setTimetable] = useState<Record<number, Record<number, Cell>>>({});
    const [tkLoading, setTkLoading] = useState(true);
    const [tkError, setTkError] = useState('');
    const [PERIODS, setPeriods] = useState(DEFAULT_PERIODS);

    const [rosterOpen, setRosterOpen] = useState(false);
    const [activeCell, setActiveCell] = useState<{
        subject?: string;
        teacher?: string;
        dayLabel?: string;
        period?: number;
    } | null>(null);

    // Load TKB từ API theo lớp của học sinh đăng nhập
    useEffect(() => {
        const token = getStudentToken();
        if (!token) {
            setTkLoading(false);
            setTkError('Chưa đăng nhập');
            return;
        }

        setTkLoading(true);
        setTkError('');

        fetch(`${API}/hs/schedule`, {
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
                const d = j?.data;
                if (!d) throw new Error(j?.message || 'Lỗi API');
                const map: Record<number, Record<number, Cell>> = {};
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                for (const day of d.days || []) {
                    const dayIdx = Number(day.weekday) - 2; // 2 = Thứ 2 → 0
                    if (dayIdx < 0 || dayIdx > 5) continue;
                    map[dayIdx] = {};
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    for (const l of day.lessons || []) {
                        map[dayIdx][Number(l.period)] = { subject: l.subject || '', teacher: l.teacher || '' };
                    }
                }
                setTimetable(map);
                if (Array.isArray(d.periods) && d.periods.length) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    setPeriods(d.periods.map((p: any) => ({ id: Number(p.period), time: `${p.start} – ${p.end}` })));
                }
            })
            .catch((e) => setTkError(e.message || 'Không tải được thời khóa biểu'))
            .finally(() => setTkLoading(false));
    }, [student?.class_name]);

    const weekDays = useMemo(
        () => Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)),
        [weekStart]
    );

    const weekLabel = `Tuần ${formatVN(weekStart)} – ${formatVN(addDays(weekStart, 5))}`;

    const calendarDays = useMemo(() => {
        const year = calMonth.getFullYear();
        const month = calMonth.getMonth();
        const first = new Date(year, month, 1);
        const startPad = first.getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const cells: (Date | null)[] = [];
        for (let i = 0; i < startPad; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
        while (cells.length % 7 !== 0) cells.push(null);
        return cells;
    }, [calMonth]);

    const goToday = () => {
        setWeekStart(startOfWeek(new Date()));
        setCalMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    };

    const prevWeek = () => setWeekStart((d) => addDays(d, -7));
    const nextWeek = () => setWeekStart((d) => addDays(d, 7));
    const prevMonth = () =>
        setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    const nextMonth = () =>
        setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    const selectDate = (date: Date) => setWeekStart(startOfWeek(date));

    const monthTitle = calMonth.toLocaleDateString('vi-VN', {
        month: 'long',
        year: 'numeric',
    });

    if (stLoading || tkLoading) {
        return (
            <div className="sch-page" style={{ padding: 24 }}>
                Đang tải lịch học...
            </div>
        );
    }

    return (
        <div className="sch-page">
            <div className="sch-header">
                <div>
                    <h1>Lịch học</h1>
                    <p>
                        {student?.class_name ? `Lớp ${student.class_name}` : '—'}
                        {' · '}
                        Năm học {(student?.academic_year || '2025-2026').replace('-', ' – ')}
                    </p>
                </div>
            </div>

            {tkError && (
                <div style={{ margin: '0 0 12px', padding: '10px 14px', background: '#fef2f2', color: '#b91c1c', borderRadius: 10, fontSize: 13.5 }}>
                    {tkError}
                </div>
            )}

            <div className="sch-layout">
                <div className="sch-main">
                    <div className="sch-panel">
                        <div className="sch-toolbar">
                            <div className="sch-week-nav">
                                <button type="button" className="sch-nav-btn" onClick={prevWeek} aria-label="Tuần trước">
                                    ←
                                </button>
                                <span className="sch-week-label">{weekLabel}</span>
                                <button type="button" className="sch-nav-btn" onClick={nextWeek} aria-label="Tuần sau">
                                    →
                                </button>
                            </div>
                            <button type="button" className="sch-btn-outline" onClick={goToday}>
                                Hôm nay
                            </button>
                        </div>

                        <div className="sch-table-wrap">
                            <table className="sch-table">
                                <thead>
                                <tr>
                                    <th className="sch-th-period">Tiết</th>
                                    {weekDays.map((d, i) => (
                                        <th key={i} className={sameDay(d, today) ? 'sch-th-today' : ''}>
                                            <span className="sch-th-day">{WEEKDAY_HEADERS[i]}</span>
                                            <span className="sch-th-date">
                                                    {d.getDate()}/{d.getMonth() + 1}
                                                </span>
                                        </th>
                                    ))}
                                </tr>
                                </thead>
                                <tbody>
                                {PERIODS.map((p) => (
                                    <tr key={p.id}>
                                        <td className="sch-period-cell">
                                            <span className="sch-period-num">Tiết {p.id}</span>
                                            <span className="sch-period-time">{p.time}</span>
                                        </td>
                                        {weekDays.map((d, dayIdx) => {
                                            const cell = timetable[dayIdx]?.[p.id] ?? null;
                                            const isToday = sameDay(d, today);
                                            if (!cell) {
                                                return (
                                                    <td
                                                        key={dayIdx}
                                                        className={`sch-empty ${isToday ? 'sch-col-today' : ''}`}
                                                    >
                                                        <span className="sch-dash">—</span>
                                                    </td>
                                                );
                                            }
                                            const color = SUBJECT_COLORS[cell.subject] || 'sky';
                                            return (
                                                <td key={dayIdx} className={isToday ? 'sch-col-today' : ''}>
                                                    <button
                                                        type="button"
                                                        className={`sch-card sch-card-${color} sch-card-click`}
                                                        onClick={() => {
                                                            setActiveCell({
                                                                subject: cell.subject,
                                                                teacher: cell.teacher,
                                                                dayLabel: WEEKDAY_HEADERS[dayIdx],
                                                                period: p.id,
                                                            });
                                                            setRosterOpen(true);
                                                        }}
                                                    >
                                                        <p className="sch-subject">{cell.subject}</p>
                                                        {cell.teacher && (
                                                            <p className="sch-teacher">{cell.teacher}</p>
                                                        )}
                                                    </button>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="sch-note">
                            <strong>Ghi chú:</strong> Thời khóa biểu theo lớp{' '}
                            {student?.class_name || 'của bạn'}. Cột ngày hôm nay được tô sáng.
                        </div>
                    </div>
                </div>

                <aside className="sch-side">
                    <div className="sch-calendar">
                        <div className="sch-cal-header">
                            <button type="button" className="sch-nav-btn" onClick={prevMonth}>
                                ←
                            </button>
                            <span className="sch-cal-title">{monthTitle}</span>
                            <button type="button" className="sch-nav-btn" onClick={nextMonth}>
                                →
                            </button>
                        </div>

                        <div className="sch-cal-grid">
                            {DAY_LABELS.map((l) => (
                                <div key={l} className="sch-cal-weekday">
                                    {l}
                                </div>
                            ))}
                            {calendarDays.map((date, idx) => {
                                if (!date) return <div key={idx} className="sch-cal-day empty" />;
                                const isToday = sameDay(date, today);
                                const inWeek = weekDays.some((w) => sameDay(w, date));
                                return (
                                    <button
                                        key={idx}
                                        type="button"
                                        className={`sch-cal-day ${isToday ? 'today' : ''} ${inWeek ? 'in-week' : ''}`}
                                        onClick={() => selectDate(date)}
                                    >
                                        {date.getDate()}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="sch-cal-legend">
                            <span className="leg-today" /> Hôm nay
                            <span className="leg-week" /> Tuần đang xem
                        </div>
                    </div>

                    <div className="sch-side-tip">
                        <p>
                            <strong>Mẹo:</strong> Bấm vào ngày trên lịch để chuyển sang tuần tương ứng.
                        </p>
                    </div>
                </aside>
            </div>

            <ClassmatesModal
                open={rosterOpen}
                onClose={() => setRosterOpen(false)}
                cell={activeCell}
            />
        </div>
    );
}