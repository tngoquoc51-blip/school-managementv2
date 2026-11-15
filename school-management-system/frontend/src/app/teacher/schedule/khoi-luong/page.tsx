'use client';
// Khối lượng giảng dạy & tiết trống (/teacher/schedule/khoi-luong)
import React from 'react';
import { Bar, Card, Donut, ErrorBox, Ico, Loading, num, useLoad } from '../../attendance/_ta';
import { DAYS, Period, dayName, tk } from '../_tk';

type Res = {
    periods: Period[]; total: number; by_day: number[]; by_period: number[]; gaps: number; busiest_weekday: number;
    free: { weekday: number; period: number }[]; classes: { class_name: string; subject: string; n: number }[]; subjects: Record<string, number>;
    busy: { weekday: number; period: number; class_name: string; subject: string }[];
};

export default function LoadPage() {
    const { data, err, loading, reload } = useLoad(() => tk<Res>('load'), []);
    if (loading && !data) return <Loading />;
    if (err || !data) return <ErrorBox msg={err || 'Không có dữ liệu'} retry={reload} />;
    const max = Math.max(1, ...data.by_day);
    const maxC = Math.max(1, ...data.classes.map((c) => c.n));
    const busy = (w: number, p: number) => data.busy.find((b) => b.weekday === w && b.period === p);
    const free = data.free.length;
    return (
        <div className="ta-page">
            <div className="ta-kpis four">
                <div className="ta-kpi t-indigo"><span className="ic"><Ico n="book" size={18} /></span><div><small>Tổng tiết/tuần</small><b>{num(data.total)}</b><em>{data.classes.length} lớp-môn</em></div></div>
                <div className="ta-kpi t-rose"><span className="ic"><Ico n="trend" size={18} /></span><div><small>Ngày nhiều tiết nhất</small><b>{dayName(data.busiest_weekday)}</b><em>{data.by_day[data.busiest_weekday - 2]} tiết</em></div></div>
                <div className="ta-kpi t-amber"><span className="ic"><Ico n="clock" size={18} /></span><div><small>Tiết trống xen giữa</small><b>{data.gaps}</b><em>nằm giữa các tiết dạy</em></div></div>
                <div className="ta-kpi t-green"><span className="ic"><Ico n="sun" size={18} /></span><div><small>Tiết trống trong tuần</small><b>{free}</b><em>có thể xếp dạy bù</em></div></div>
            </div>
            <div className="ta-grid g2">
                <Card title="Số tiết theo ngày" sub="Giúp cân đối công việc trong tuần">
                    <div className="ts-bars">{data.by_day.map((n, i) => <div key={i} className={n === max && n > 0 ? 'on' : ''}><b>{n}</b><i style={{ height: `${(n / max) * 100}%` }} /><small>T{i + 2}</small></div>)}</div>
                </Card>
                <Card title="Theo môn học"><Donut items={Object.entries(data.subjects).map(([label, n]) => ({ label, n }))} center="tiết/tuần" /></Card>
            </div>
            <Card title="Bản đồ tiết dạy & tiết trống" sub="Ô xanh dương: có tiết dạy · Ô xanh lá nét đứt: tiết trống">
                <div className="ts-heat" style={{ gridTemplateColumns: `70px repeat(${DAYS.length}, minmax(70px, 1fr))`, overflowX: 'auto' }}>
                    <div className="c h" />{DAYS.map((w) => <div key={w} className="c h">{dayName(w)}</div>)}
                    {data.periods.map((p) => (
                        <React.Fragment key={p.id}>
                            <div className="c h">Tiết {p.id}<br /><small>{p.start || ''}</small></div>
                            {DAYS.map((w) => { const b = busy(w, p.id); return b ? <div key={w} className="c busy">{b.class_name}<small>{b.subject}</small></div> : <div key={w} className="c free">Trống</div>; })}
                        </React.Fragment>
                    ))}
                </div>
            </Card>
            <Card title="Số tiết mỗi lớp – môn">
                {data.classes.length === 0 ? <p className="ta-mute">Chưa có dữ liệu.</p> : data.classes.map((c, i) => (
                    <div className="ts-hbar" key={i}><span>{c.class_name}<small>{c.subject}</small></span><Bar value={(c.n / maxC) * 100} tone="sky" /><b>{c.n}</b></div>
                ))}
            </Card>
        </div>
    );
}