'use client';

import { useMemo, useState } from 'react';
import './schedule.css';

const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const WEEKDAY_HEADERS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

const PERIODS = [
    { id: 1, time: '07:00 – 07:45' },
    { id: 2, time: '07:50 – 08:35' },
    { id: 3, time: '08:45 – 09:30' },
    { id: 4, time: '09:40 – 10:25' },
    { id: 5, time: '10:35 – 11:20' },
];

// Màu theo môn (cố định)
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
};

type Cell = { subject: string; teacher: string; room: string } | null;

const TIMETABLE: Record<number, Record<number, Cell>> = {
    // 0 = Thứ 2 ... 5 = Thứ 7
    0: {
        1: { subject: 'Toán', teacher: 'Thầy Nguyễn Văn A', room: 'P.201' },
        2: { subject: 'Toán', teacher: 'Thầy Nguyễn Văn A', room: 'P.201' },
        3: { subject: 'Ngữ văn', teacher: 'Cô Trần Thị B', room: 'P.105' },
        4: { subject: 'Tiếng Anh', teacher: 'Cô Lê Thị C', room: 'P.302' },
        5: { subject: 'Lịch sử', teacher: 'Thầy Phạm Văn D', room: 'P.108' },
    },
    1: {
        1: { subject: 'Vật lý', teacher: 'Thầy Hoàng Văn E', room: 'P.203' },
        2: { subject: 'Vật lý', teacher: 'Thầy Hoàng Văn E', room: 'P.203' },
        3: { subject: 'Hóa học', teacher: 'Cô Nguyễn Thị F', room: 'P.204' },
        4: { subject: 'Toán', teacher: 'Thầy Nguyễn Văn A', room: 'P.201' },
        5: null,
    },
    2: {
        1: { subject: 'Ngữ văn', teacher: 'Cô Trần Thị B', room: 'P.105' },
        2: { subject: 'Tiếng Anh', teacher: 'Cô Lê Thị C', room: 'P.302' },
        3: { subject: 'Địa lý', teacher: 'Cô Vũ Thị G', room: 'P.110' },
        4: { subject: 'GDCD', teacher: 'Thầy Lê Văn H', room: 'P.106' },
        5: { subject: 'Thể dục', teacher: 'Thầy Trần Văn I', room: 'Sân' },
    },
    3: {
        1: { subject: 'Toán', teacher: 'Thầy Nguyễn Văn A', room: 'P.201' },
        2: { subject: 'Hóa học', teacher: 'Cô Nguyễn Thị F', room: 'P.204' },
        3: { subject: 'Sinh học', teacher: 'Cô Đỗ Thị K', room: 'P.205' },
        4: { subject: 'Tin học', teacher: 'Thầy Ngô Văn L', room: 'P.Lab1' },
        5: { subject: 'Tin học', teacher: 'Thầy Ngô Văn L', room: 'P.Lab1' },
    },
    4: {
        1: { subject: 'Tiếng Anh', teacher: 'Cô Lê Thị C', room: 'P.302' },
        2: { subject: 'Ngữ văn', teacher: 'Cô Trần Thị B', room: 'P.105' },
        3: { subject: 'Vật lý', teacher: 'Thầy Hoàng Văn E', room: 'P.203' },
        4: { subject: 'Công nghệ', teacher: 'Thầy Bùi Văn M', room: 'P.207' },
        5: null,
    },
    5: {
        1: { subject: 'Toán', teacher: 'Thầy Nguyễn Văn A', room: 'P.201' },
        2: { subject: 'Sinh học', teacher: 'Cô Đỗ Thị K', room: 'P.205' },
        3: { subject: 'Thể dục', teacher: 'Thầy Trần Văn I', room: 'Sân' },
        4: null,
        5: null,
    },
};

function startOfWeek(date: Date) {
    const d = new Date(date);
    const day = d.getDay(); // 0 CN
    const diff = day === 0 ? -6 : 1 - day; // về Thứ 2
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
    const today = useMemo(() => {
        const t = new Date();
        t.setHours(0, 0, 0, 0);
        return t;
    }, []);

    const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
    const [calMonth, setCalMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

    const weekDays = useMemo(
        () => Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)),
        [weekStart]
    );

    const weekLabel = `Tuần ${formatVN(weekStart)} – ${formatVN(addDays(weekStart, 5))}`;

    // Lịch tháng
    const calendarDays = useMemo(() => {
        const year = calMonth.getFullYear();
        const month = calMonth.getMonth();
        const first = new Date(year, month, 1);
        const startPad = first.getDay(); // 0 CN
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const cells: (Date | null)[] = [];

        for (let i = 0; i < startPad; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
        while (cells.length % 7 !== 0) cells.push(null);

        return cells;
    }, [calMonth]);

    const goToday = () => {
        const s = startOfWeek(new Date());
        setWeekStart(s);
        setCalMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    };

    const prevWeek = () => setWeekStart((d) => addDays(d, -7));
    const nextWeek = () => setWeekStart((d) => addDays(d, 7));

    const prevMonth = () =>
        setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    const nextMonth = () =>
        setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

    const selectDate = (date: Date) => {
        setWeekStart(startOfWeek(date));
    };

    const monthTitle = calMonth.toLocaleDateString('vi-VN', {
        month: 'long',
        year: 'numeric',
    });

    return (
        <div className="sch-page">
            <div className="sch-header">
                <div>
                    <h1>Lịch học</h1>
                    <p>Lớp 10A2 · Năm học 2025 – 2026 · Học kỳ 1</p>
                </div>
            </div>

            <div className="sch-layout">
                {/* ===== Cột chính: Thời khóa biểu ===== */}
                <div className="sch-main">
                    <div className="sch-panel">
                        <div className="sch-toolbar">
                            <div className="sch-week-nav">
                                <button className="sch-nav-btn" onClick={prevWeek} aria-label="Tuần trước">
                                    ←
                                </button>
                                <span className="sch-week-label">{weekLabel}</span>
                                <button className="sch-nav-btn" onClick={nextWeek} aria-label="Tuần sau">
                                    →
                                </button>
                            </div>
                            <button className="sch-btn-outline" onClick={goToday}>
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
                                            <span className="sch-th-date">{d.getDate()}/{d.getMonth() + 1}</span>
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
                                            const cell = TIMETABLE[dayIdx]?.[p.id];
                                            const isToday = sameDay(d, today);
                                            if (!cell) {
                                                return (
                                                    <td key={dayIdx} className={`sch-empty ${isToday ? 'sch-col-today' : ''}`}>
                                                        <span className="sch-dash">—</span>
                                                    </td>
                                                );
                                            }
                                            const color = SUBJECT_COLORS[cell.subject] || 'sky';
                                            return (
                                                <td key={dayIdx} className={isToday ? 'sch-col-today' : ''}>
                                                    <div className={`sch-card sch-card-${color}`}>
                                                        <p className="sch-subject">{cell.subject}</p>
                                                        <p className="sch-teacher">{cell.teacher}</p>
                                                        <p className="sch-room">{cell.room}</p>
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="sch-note">
                            <strong>Ghi chú:</strong> Thời khóa biểu có thể thay đổi theo thông báo của Giáo vụ. Cột ngày hôm nay được tô sáng.
                        </div>
                    </div>
                </div>

                {/* ===== Cột phải: Lịch tháng ===== */}
                <aside className="sch-side">
                    <div className="sch-calendar">
                        <div className="sch-cal-header">
                            <button className="sch-nav-btn" onClick={prevMonth}>←</button>
                            <span className="sch-cal-title">{monthTitle}</span>
                            <button className="sch-nav-btn" onClick={nextMonth}>→</button>
                        </div>

                        <div className="sch-cal-grid">
                            {DAY_LABELS.map((l) => (
                                <div key={l} className="sch-cal-weekday">{l}</div>
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
                        <p><strong>Mẹo:</strong> Bấm vào ngày trên lịch để chuyển sang tuần tương ứng.</p>
                    </div>
                </aside>
            </div>
        </div>
    );
}