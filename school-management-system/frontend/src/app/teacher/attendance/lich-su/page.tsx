'use client';

import Link from 'next/link';
import React, { useState } from 'react';
import { Btn, Card, ErrorBox, Ico, LS, Lesson, Loading, Pill, addDays, fmtS, ta, todayStr, useLoad, weekday } from '../_ta';
import { lessonHref } from '../_lesson';

type Week = {
    from: string; to: string; today: string; days: { date: string; lessons: Lesson[] }[]; periods: { id: number; start: string; end: string }[];
    summary: { lessons: number; locked: number; todo: number; draft: number; ready: number; reopened: number; overdue: number };
};

export default function WeekView() {
    const [date, setDate] = useState(todayStr());
    const { data, err, loading, reload } = useLoad(async () => (await ta<unknown>(`week?date=${date}`)) as unknown as Week, [date]);
    const periods = data ? Array.from(new Set([...data.periods.map((p) => p.id), ...data.days.flatMap((d) => d.lessons.map((l) => l.period))])).sort((a, b) => a - b) : [];
    const time = (p: number) => { const x = data?.periods.find((q) => q.id === p); return x ? `${x.start}–${x.end}` : ''; };
    const s = data?.summary;

    return (
        <div className="ta-page">
            <div className="ta-ptitle">
                <div><h2>Lịch dạy trong tuần</h2><p>Bấm vào một tiết để điểm danh. Màu cho biết tiết đã gửi nhà trường hay còn thiếu.</p></div>
                <div className="acts ta-daynav">
                    <Btn size="sm" onClick={() => setDate(addDays(date, -7))}><Ico n="chevR" size={14} className="flip" />Tuần trước</Btn>
                    {data && <b className="ta-weeklab">{fmtS(data.from)} – {fmtS(data.to)}</b>}
                    <Btn size="sm" onClick={() => setDate(addDays(date, 7))}>Tuần sau<Ico n="chevR" size={14} /></Btn>
                    {date !== todayStr() && <Btn size="sm" onClick={() => setDate(todayStr())}>Tuần này</Btn>}
                </div>
            </div>
            {s && <div className="ta-sumrow">
                <Pill tone="indigo">{s.lessons} tiết trong tuần</Pill><Pill tone="green" dot>{s.locked} đã gửi</Pill>
                <Pill tone="amber" dot>{s.todo + s.draft + s.ready + s.reopened} cần điểm danh</Pill>{s.overdue > 0 && <Pill tone="rose" dot>{s.overdue} quá giờ chưa gửi</Pill>}
            </div>}
            <Card pad={false}>
                {loading && !data ? <Loading /> : err && !data ? <ErrorBox msg={err} retry={reload} /> : !data ? null : (
                    <div className="ta-tablewrap">
                        <table className="ta-week">
                            <thead><tr><th>Tiết</th>{data.days.map((d) => <th key={d.date} className={d.date === data.today ? 'today' : ''}>{weekday(d.date) === 'CN' ? 'CN' : `Thứ ${weekday(d.date).slice(1)}`}<small>{fmtS(d.date)}</small></th>)}</tr></thead>
                            <tbody>
                            {periods.length === 0 && <tr><td colSpan={7} className="ta-mute pad">Chưa có thời khóa biểu.</td></tr>}
                            {periods.map((p) => (
                                <tr key={p}>
                                    <th className="per"><b>{p}</b><small>{time(p)}</small></th>
                                    {data.days.map((d) => {
                                        const ls = d.lessons.filter((l) => l.period === p);
                                        return <td key={d.date} className={d.date === data.today ? 'today' : ''}>
                                            {ls.length === 0 ? <span className="ta-empty-cell">—</span> : ls.map((l) => (
                                                <Link key={l.class_subject_id} href={lessonHref(l, d.date)} className={`ta-cell st-${l.state}${l.overdue ? ' overdue' : ''}`} title={LS[l.state].label}>
                                                    <b>{l.class_name}</b><span>{l.subject}</span>
                                                    <em>{l.state === 'locked' ? <Ico n="lock" size={11} /> : null}{LS[l.state].label}</em>
                                                </Link>))}
                                        </td>;
                                    })}
                                </tr>))}
                            </tbody>
                        </table>
                    </div>)}
            </Card>
            <div className="ta-legendrow">{(Object.keys(LS) as (keyof typeof LS)[]).map((k) => <span key={k} className={`ta-cell st-${k} legend`}>{LS[k].label}</span>)}</div>
        </div>
    );
}