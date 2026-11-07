'use client';

import Link from 'next/link';
import React, { useState } from 'react';
import { StudentDrawer } from './_student';
import {
    Btn, Card, ClassInfo, Counts, DayPoint, Donut, Empty, ErrorBox, Ico, Legend, Loading, Pill, RatePill, Ring, ST, ST_KEYS, StackBar, StatusBadge, TrendChart,
    addDays, ca, fmtD, longDate, num, rateTone, todayStr, useCa, useLoad,
} from './_ca';

type Ov = {
    date: string; is_weekend: boolean; students: number; classes_total: number; classes_marked: number; unmarked: ClassInfo[]; day: Counts; month: Counts; series: DayPoint[];
    by_grade: ({ grade: number } & Counts)[]; worst: (ClassInfo & Counts & { days: number })[];
    absent_today: { student_id: number; code: string; name: string; class_name: string; status: string; note: string | null }[];
    alerts_count: number; alerts_high: number; pending_leaves: number; open_cases: number; leaves_today: number; good_rate: number; warn_rate: number;
};

export default function Overview() {
    const { staff } = useCa();
    const [date, setDate] = useState(todayStr());
    const { data, err, loading, reload } = useLoad(async () => (await ca<Ov>(`overview?date=${date}`)).data, [date]);
    const [open, setOpen] = useState<number | null>(null);

    if (loading && !data) return <Loading />;
    if (err && !data) return <ErrorBox msg={err} retry={reload} />;
    if (!data) return null;
    const d = data.day; const g = data.good_rate, w = data.warn_rate;
    const isToday = date === todayStr();
    const hour = new Date().getHours();
    const hello = hour < 11 ? 'Chào buổi sáng' : hour < 14 ? 'Chào buổi trưa' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
    const pendingClasses = data.unmarked.length;

    const kpis = [
        { l: 'Tỉ lệ chuyên cần', v: d.total ? `${d.rate}%` : '—', s: d.total ? `${num(d.present + d.late)}/${num(d.total)} học sinh đi học` : 'chưa có điểm danh', t: rateTone(d.rate, g, w, d.total), i: 'trend', href: '/bgh/attendance/lop' },
        { l: 'Vắng mặt', v: num(d.absent), s: `${num(d.unexcused)} không phép · ${num(d.excused)} có phép`, t: d.unexcused ? 'rose' : 'sky', i: 'user', href: '/bgh/attendance/hoc-sinh?filter=risk' },
        { l: 'Lớp chưa điểm danh', v: num(pendingClasses), s: pendingClasses ? `${data.classes_marked}/${data.classes_total} lớp đã xong` : 'tất cả lớp đã xong', t: pendingClasses ? 'amber' : 'green', i: 'checks', href: '/bgh/attendance/diem-danh' },
        { l: 'Cảnh báo nghỉ nhiều', v: num(data.alerts_count), s: data.alerts_high ? `${data.alerts_high} mức cao` : 'chưa có mức cao', t: data.alerts_high ? 'rose' : 'violet', i: 'alert', href: '/bgh/attendance/canh-bao' },
        { l: 'Đơn nghỉ chờ duyệt', v: num(data.pending_leaves), s: data.leaves_today ? `${data.leaves_today} đơn có hiệu lực hôm nay` : 'không tồn đọng', t: data.pending_leaves ? 'amber' : 'teal', i: 'doc', href: '/bgh/attendance/don-nghi' },
    ];

    return (
        <div className="ca-page">
            <div className="ca-welcome">
                <div>
                    <h2>{hello}, {staff.name} 👋</h2>
                    <p>{data.is_weekend ? 'Ngày cuối tuần, thường không có điểm danh.' : d.total === 0 ? `${isToday ? 'Hôm nay' : 'Ngày này'} chưa có lớp nào điểm danh.` : <>{isToday ? 'Hôm nay' : fmtD(date)} có <b>{num(d.present + d.late)}</b>/<b>{num(d.total)}</b> học sinh đi học{pendingClasses ? <>, còn <b>{pendingClasses}</b> lớp chưa điểm danh.</> : ', tất cả các lớp đã điểm danh.'}</>}</p>
                </div>
                <div className="acts">
                    <button type="button" className="ca-btn light" onClick={() => setDate(addDays(date, -1))} aria-label="Ngày trước"><Ico n="chevR" size={15} className="flip" /></button>
                    <input type="date" className="ca-datein" value={date} max={todayStr()} onChange={(e) => e.target.value && setDate(e.target.value)} />
                    <button type="button" className="ca-btn light" disabled={isToday} onClick={() => setDate(addDays(date, 1))} aria-label="Ngày sau"><Ico n="chevR" size={15} /></button>
                    {!isToday && <button type="button" className="ca-btn light" onClick={() => setDate(todayStr())}>Hôm nay</button>}
                    <button type="button" className="ca-btn light" onClick={reload} aria-label="Tải lại"><Ico n="refresh" size={15} /></button>
                </div>
            </div>

            <div className="ca-kpis">
                {kpis.map((x) => (
                    <Link key={x.l} href={x.href} className={`ca-kpi t-${x.t}`}>
                        <span className="ic"><Ico n={x.i} size={20} /></span>
                        <div><small>{x.l}</small><b>{x.v}</b><em>{x.s}</em></div>
                    </Link>
                ))}
            </div>

            <div className="ca-grid g21">
                <Card title="Xu hướng 14 ngày" sub="Tỉ lệ chuyên cần toàn trường mỗi ngày" right={<Legend />}>
                    {data.series.every((p) => p.total === 0) ? <Empty icon="trend" title="Chưa có số liệu" text="Biểu đồ xuất hiện khi các lớp bắt đầu điểm danh." action={<Link className="ca-btn primary" href="/bgh/attendance/diem-danh">Điểm danh ngay</Link>} /> : <TrendChart data={data.series} good={g} warn={w} />}
                </Card>
                <Card title="Cơ cấu trong ngày" sub={`${longDate(date)}`}>
                    {d.total === 0 ? <Empty icon="user" title="Chưa có dữ liệu" /> : (
                        <><Donut center="lượt điểm danh" items={ST_KEYS.filter((k) => d[k] > 0).map((k) => ({ label: ST[k].label, n: d[k] }))} /><div style={{ height: 14 }} /><StackBar c={d} tall /></>
                    )}
                </Card>
            </div>

            <div className="ca-grid g2">
                <Card title="Lớp chưa điểm danh" sub={data.is_weekend ? 'Cuối tuần' : `${isToday ? 'Hôm nay' : fmtD(date)} · ${pendingClasses} lớp`} right={<Link href="/bgh/attendance/diem-danh" className="ca-more">Mở điểm danh <Ico n="chevR" size={14} /></Link>} pad={false}>
                    {pendingClasses === 0 ? <Empty icon="checks" title="Tất cả các lớp đã điểm danh" /> : (
                        <div className="ca-chips-list">{data.unmarked.slice(0, 24).map((c) => (
                            <Link key={c.id} href={`/bgh/attendance/diem-danh?class=${c.id}&date=${date}`} className="ca-clschip"><b>{c.name}</b><small>{c.students} HS</small></Link>
                        ))}{pendingClasses > 24 && <span className="ca-mute">… và {pendingClasses - 24} lớp nữa</span>}</div>
                    )}
                </Card>
                <Card title="Vắng và đi muộn" sub={`${longDate(date)}`} right={<Link href="/bgh/attendance/hoc-sinh" className="ca-more">Xem học sinh <Ico n="chevR" size={14} /></Link>} pad={false}>
                    {data.absent_today.length === 0 ? <Empty icon="check" title={d.total ? 'Không có học sinh vắng hay đi muộn' : 'Chưa có dữ liệu'} /> : data.absent_today.map((x) => (
                        <div key={x.student_id} className="ca-line" role="button" onClick={() => setOpen(x.student_id)}>
                            <span className={`ic t-${ST[x.status as keyof typeof ST]?.tone || 'gray'}`}><Ico n={ST[x.status as keyof typeof ST]?.icon || 'user'} size={17} /></span>
                            <div className="mid"><b>{x.name}</b><small>{x.class_name} · {x.code}{x.note ? ` · ${x.note}` : ''}</small></div>
                            <div className="rt"><StatusBadge s={x.status} /></div>
                        </div>
                    ))}
                </Card>
            </div>

            <div className="ca-grid g2">
                <Card title="Theo khối · 30 ngày" sub="Tỉ lệ chuyên cần trung bình">
                    {data.by_grade.length === 0 ? <Empty icon="stats" title="Chưa có dữ liệu" /> : (
                        <div className="ca-grp">{data.by_grade.map((x) => (
                            <div key={x.grade}><span>Khối {x.grade}</span><StackBar c={x} /><b><RatePill c={x} good={g} warn={w} /></b></div>
                        ))}</div>
                    )}
                    <div style={{ height: 12 }} /><Pill tone="teal">Toàn trường 30 ngày: {data.month.total ? `${data.month.rate}%` : '—'}</Pill>
                </Card>
                <Card title="Lớp cần quan tâm" sub="Tỉ lệ thấp nhất trong 30 ngày" right={<Link href="/bgh/attendance/lop" className="ca-more">Tất cả lớp <Ico n="chevR" size={14} /></Link>} pad={false}>
                    {data.worst.length === 0 ? <Empty icon="stats" title="Chưa có dữ liệu" /> : data.worst.map((c) => (
                        <Link key={c.id} href={`/bgh/attendance/lop?open=${c.id}`} className="ca-line">
                            <Ring value={c.rate} size={44} tone={rateTone(c.rate, g, w, c.total)} />
                            <div className="mid"><b>Lớp {c.name}</b><small>{c.students} học sinh · {c.days} buổi · {c.unexcused} vắng không phép</small></div>
                            <div className="rt"><RatePill c={c} good={g} warn={w} /></div>
                        </Link>
                    ))}
                </Card>
            </div>

            <p className="ca-foot">Tỉ lệ = (có mặt + đi muộn) / tổng lượt điểm danh. Có thể đổi cách tính trong <Link href="/bgh/attendance/cai-dat" className="ca-link">Cài đặt</Link>. <Btn tone="ghost" size="sm" onClick={reload}>Tải lại</Btn></p>
            {open !== null && <StudentDrawer id={open} range={{ from: addDays(date, -29), to: date }} onClose={() => setOpen(null)} onChanged={reload} />}
        </div>
    );
}