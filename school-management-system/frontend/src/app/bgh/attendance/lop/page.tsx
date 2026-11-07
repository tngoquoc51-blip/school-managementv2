'use client';

import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import { StudentDrawer, StudentRow } from '../_student';
import {
    Card, ClassInfo, Counts, Drawer, Empty, ErrorBox, Ico, Legend, Loading, Pill, RangeBar, RatePill, Ring, StackBar, ca, fmtD, num, presetRange, qs, rateTone, useLoad,
} from '../_ca';

type ClsRow = ClassInfo & Counts & { days: number };
type Res = { rows: ClsRow[]; sum: Counts; good: number; warn: number };

export default function ByClass() {
    const [range, setRange] = useState(presetRange('month'));
    const [grade, setGrade] = useState(0);
    const [sort, setSort] = useState<'name' | 'rate' | 'absent'>('rate');
    const [open, setOpen] = useState<number | null>(null);
    const { data, err, loading, reload } = useLoad<Res>(async () => {
        const r = await ca<ClsRow[]>(`classes${qs({ from: range.from, to: range.to })}`);
        const m = r.meta as unknown as { summary: Counts; good_rate: number; warn_rate: number };
        return { rows: r.data, sum: m.summary, good: m.good_rate, warn: m.warn_rate };
    }, [range.from, range.to]);

    useEffect(() => { const o = Number(new URLSearchParams(window.location.search).get('open') || 0); if (o) setOpen(o); }, []);

    const grades = useMemo(() => Array.from(new Set((data?.rows ?? []).map((c) => c.grade))).sort((a, b) => a - b), [data]);
    const rows = useMemo(() => {
        const x = (data?.rows ?? []).filter((c) => !grade || c.grade === grade);
        return [...x].sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'vi', { numeric: true }) : sort === 'absent' ? b.absent - a.absent : (a.total === 0 ? 1 : 0) - (b.total === 0 ? 1 : 0) || a.rate - b.rate);
    }, [data, grade, sort]);

    return (
        <div className="ca-page">
            <div className="ca-ptitle">
                <div><h2>Chuyên cần theo lớp</h2><p>So sánh tỉ lệ chuyên cần giữa các lớp trong khoảng thời gian đã chọn. Bấm vào một lớp để xem từng học sinh.</p></div>
            </div>
            <RangeBar value={range} onChange={setRange} />

            {loading && !data ? <Loading /> : err && !data ? <ErrorBox msg={err} retry={reload} /> : data && (
                <>
                    <div className="ca-kpis four">
                        <div className={`ca-kpi t-${rateTone(data.sum.rate, data.good, data.warn, data.sum.total)}`}><span className="ic"><Ico n="trend" size={20} /></span><div><small>Toàn trường</small><b>{data.sum.total ? `${data.sum.rate}%` : '—'}</b><em>{num(data.sum.total)} lượt điểm danh</em></div></div>
                        <div className="ca-kpi t-rose"><span className="ic"><Ico n="x" size={20} /></span><div><small>Vắng không phép</small><b>{num(data.sum.unexcused)}</b><em>{data.sum.total ? ((data.sum.unexcused * 100) / data.sum.total).toFixed(1) : 0}% tổng lượt</em></div></div>
                        <div className="ca-kpi t-sky"><span className="ic"><Ico n="doc" size={20} /></span><div><small>Vắng có phép</small><b>{num(data.sum.excused)}</b><em>có đơn hoặc báo trước</em></div></div>
                        <div className="ca-kpi t-amber"><span className="ic"><Ico n="clock" size={20} /></span><div><small>Đi muộn</small><b>{num(data.sum.late)}</b><em>{fmtD(range.from)} → {fmtD(range.to)}</em></div></div>
                    </div>

                    <div className="ca-filters">
                        <div className="ca-gradetabs inline"><button type="button" className={grade === 0 ? 'on' : ''} onClick={() => setGrade(0)}>Tất cả</button>{grades.map((g) => <button key={g} type="button" className={grade === g ? 'on' : ''} onClick={() => setGrade(g)}>Khối {g}</button>)}</div>
                        <select value={sort} onChange={(e) => setSort(e.target.value as 'name' | 'rate' | 'absent')}><option value="rate">Tỉ lệ thấp nhất trước</option><option value="absent">Nhiều lượt vắng nhất</option><option value="name">Theo tên lớp</option></select>
                        <Legend />
                    </div>

                    <Card pad={false}>
                        {rows.length === 0 ? <Empty icon="school" title="Không có lớp nào" /> : (
                            <div className="ca-tablewrap"><table className="ca-tbl big">
                                <thead><tr><th>Lớp</th><th>Sĩ số</th><th>Số buổi</th><th style={{ minWidth: 220 }}>Cơ cấu</th><th>Vắng</th><th>Muộn</th><th>Tỉ lệ</th><th /></tr></thead>
                                <tbody>{rows.map((c) => (
                                    <tr key={c.id} onClick={() => setOpen(c.id)}>
                                        <td><b>Lớp {c.name}</b><small>Khối {c.grade}</small></td>
                                        <td>{c.students}</td><td>{c.days || <span className="ca-mute">0</span>}</td>
                                        <td><StackBar c={c} /></td>
                                        <td>{c.absent}{c.unexcused ? <small className="rj">{c.unexcused} không phép</small> : null}</td>
                                        <td>{c.late}</td>
                                        <td><RatePill c={c} good={data.good} warn={data.warn} /></td>
                                        <td className="ca-rowact" onClick={(e) => e.stopPropagation()}><Link href={`/bgh/attendance/diem-danh?class=${c.id}`} className="ca-btn sm">Điểm danh</Link></td>
                                    </tr>
                                ))}</tbody></table></div>
                        )}
                    </Card>
                </>
            )}
            {open !== null && data && <ClassDrawer cls={data.rows.find((c) => c.id === open)} id={open} range={range} good={data.good} warn={data.warn} onClose={() => setOpen(null)} />}
        </div>
    );
}

function ClassDrawer({ cls, id, range, good, warn, onClose }: { cls?: ClsRow; id: number; range: { from: string; to: string }; good: number; warn: number; onClose: () => void }) {
    const { data, err, loading, reload } = useLoad(async () => (await ca<StudentRow[]>(`students${qs({ class_id: id, from: range.from, to: range.to, per: 100, sort: 'rate' })}`)).data, [id, range.from, range.to]);
    const [stu, setStu] = useState<number | null>(null);
    return (
        <Drawer title={cls ? `Lớp ${cls.name}` : 'Lớp'} sub={cls ? <>Khối {cls.grade} · {cls.students} học sinh · {fmtD(range.from)} → {fmtD(range.to)}</> : undefined} onClose={onClose}
                foot={<Link href={`/bgh/attendance/diem-danh?class=${id}`} className="ca-btn primary sm"><Ico n="checks" size={14} />Điểm danh lớp này</Link>}>
            {cls && (
                <div className="ca-statrow" style={{ marginBottom: 16 }}>
                    <Ring value={cls.total ? cls.rate : 0} label="chuyên cần" tone={rateTone(cls.rate, good, warn, cls.total)} />
                    <div><b>{cls.days}</b><small>buổi điểm danh</small></div><div><b>{cls.absent}</b><small>lượt vắng</small></div><div><b>{cls.late}</b><small>lượt muộn</small></div>
                </div>
            )}
            {loading && !data ? <Loading /> : err && !data ? <ErrorBox msg={err} retry={reload} /> : !data || data.length === 0 ? <Empty icon="user" title="Lớp chưa có học sinh" /> : (
                <div className="ca-tablewrap"><table className="ca-tbl big"><thead><tr><th>Học sinh</th><th>Vắng</th><th>Muộn</th><th>Tỉ lệ</th></tr></thead><tbody>
                {data.map((s) => (
                    <tr key={s.id} onClick={() => setStu(s.id)}><td><b>{s.name}</b><small>{s.code}</small></td><td>{s.absent}{s.unexcused ? <small className="rj">{s.unexcused} không phép</small> : null}</td><td>{s.late}</td><td>{s.total ? <Pill tone={rateTone(s.rate, good, warn, s.total)}>{s.rate}%</Pill> : <span className="ca-mute">—</span>}</td></tr>
                ))}</tbody></table></div>
            )}
            {stu !== null && <StudentDrawer id={stu} range={range} onClose={() => setStu(null)} onChanged={reload} />}
        </Drawer>
    );
}