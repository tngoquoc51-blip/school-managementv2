'use client';

import s from './homework.module.css';
import type { HomeworkItem } from './api';
import { pad } from './utils';

interface Props {
    month: Date; items: HomeworkItem[]; selected: string | null;
    onSelect: (day: string | null) => void; onMonth: (d: Date) => void;
}

export default function MiniCalendar({ month, items, selected, onSelect, onMonth }: Props) {
    const y = month.getFullYear(), m = month.getMonth();
    const lead = (new Date(y, m, 1).getDay() + 6) % 7; // tuần bắt đầu từ Thứ Hai
    const days = new Date(y, m + 1, 0).getDate();
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    const byDay = new Map<string, HomeworkItem[]>();
    items.forEach((i) => { const k = i.due_at.slice(0, 10); byDay.set(k, [...(byDay.get(k) ?? []), i]); });

    const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

    return (
        <div className={s.cal}>
            <div className={s.calHead}>
                <button type="button" aria-label="Tháng trước" onClick={() => onMonth(new Date(y, m - 1, 1))}>‹</button>
                <strong>Tháng {m + 1}/{y}</strong>
                <button type="button" aria-label="Tháng sau" onClick={() => onMonth(new Date(y, m + 1, 1))}>›</button>
            </div>
            <div className={s.calGrid} role="grid" aria-label={`Hạn nộp bài tháng ${m + 1}`}>
                {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => <span key={d} className={s.calDow}>{d}</span>)}
                {cells.map((d, i) => {
                    if (d === null) return <span key={`e${i}`} />;
                    const key = `${y}-${pad(m + 1)}-${pad(d)}`;
                    const list = byDay.get(key) ?? [];
                    const tone = list.some((x) => x.status === 'overdue' || x.status === 'returned') ? s.calLate
                        : list.some((x) => x.status === 'todo') ? s.calTodo : list.length ? s.calDone : '';
                    return (
                        <button
                            key={key} type="button"
                            className={`${s.calDay} ${tone} ${key === todayKey ? s.calToday : ''} ${key === selected ? s.calSel : ''}`}
                            aria-pressed={key === selected}
                            aria-label={`Ngày ${d}${list.length ? `, ${list.length} bài đến hạn` : ''}`}
                            onClick={() => onSelect(key === selected ? null : key)}
                        >{d}</button>
                    );
                })}
            </div>
        </div>
    );
}