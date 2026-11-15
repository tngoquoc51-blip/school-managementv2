'use client';

import React, { useState } from 'react';
import { Btn, Card, Drawer, Empty, ErrorBox, Ico, Loading, Pill, RangeBar, Range, RatePill, ST, StackBar, StatusBadge, Settings, TrendChart, DayPoint, fmtD, num, presetRange, ta, useLoad } from '../_ta';

type Stat = { class_subject_id: number; class_name: string; grade: number; subject: string; sessions: number; total: number; present: number; late: number; excused: number; unexcused: number; rate: number | null };
type Risk = { id: number; code: string; name: string; class_name: string; total: number; absent: number; unexcused: number; late: number };
type Data = { from: string; to: string; settings: Settings; data: Stat[]; trend: DayPoint[]; risk: Risk[] };
type Detail = { student: { id: number; code: string; name: string; class_name: string }; summary: { total: number; present: number; late: number; excused: number; unexcused: number }; records: { date: string; period: number; status: string; note: string | null; subject: string }[] };

export default function Stats() {
    const [range, setRange] = useState<Range>(() => presetRange('month'));
    const { data, err, loading, reload } = useLoad(async () => (await ta<unknown>(`stats?from=${range.from}&to=${range.to}`)) as unknown as Data, [range.from, range.to]);
    const [sid, setSid] = useState(0);
    const s = data?.settings ?? { good_rate: 95, warn_rate: 85, lock_days: 7, alert_absent: 3 };
    const tot = (data?.data ?? []).reduce((a, x) => ({ total: a.total + x.total, present: a.present + x.present, late: a.late + x.late, excused: a.excused + x.excused, unexcused: a.unexcused + x.unexcused, sessions: a.sessions + x.sessions }), { total: 0, present: 0, late: 0, excused: 0, unexcused: 0, sessions: 0 });
    const rate = tot.total ? Math.round(((tot.present + tot.late) / tot.total) * 1000) / 10 : 0;

    return (
        <div className="ta-page">
            <div className="ta-ptitle"><div><h2>Thống kê chuyên cần</h2><p>Các lớp – môn bạn dạy và những học sinh vắng nhiều cần quan tâm.</p></div><div className="acts"><Btn size="sm" onClick={reload}><Ico n="refresh" size={14} />Làm mới</Btn></div></div>
            <RangeBar value={range} onChange={setRange} />
            {err && !data ? <ErrorBox msg={err} retry={reload} /> : loading && !data ? <Loading /> : data && (
                <>
                    <div className="ta-kpis four">
                        <div className="ta-kpi t-green"><span className="ic"><Ico n="trend" size={18} /></span><div><small>Tỉ lệ đi học</small><b>{tot.total ? `${rate}%` : '—'}</b><em>{num(tot.total)} lượt điểm danh</em></div></div>
                        <div className="ta-kpi t-indigo"><span className="ic"><Ico n="book" size={18} /></span><div><small>Số tiết đã dạy</small><b>{num(tot.sessions)}</b><em>có điểm danh</em></div></div>
                        <div className="ta-kpi t-rose"><span className="ic"><Ico n="x" size={18} /></span><div><small>Lượt vắng</small><b>{num(tot.excused + tot.unexcused)}</b><em>{tot.unexcused} không phép</em></div></div>
                        <div className="ta-kpi t-amber"><span className="ic"><Ico n="clock" size={18} /></span><div><small>Lượt đi muộn</small><b>{num(tot.late)}</b><em>trong khoảng đã chọn</em></div></div>
                    </div>
                    <Card title="Xu hướng theo ngày" sub="Tỉ lệ đi học của các tiết bạn dạy">
                        {data.trend.length < 2 ? <Empty icon="trend" title="Chưa đủ dữ liệu" text="Cần điểm danh từ 2 ngày trở lên để vẽ biểu đồ." /> : <TrendChart data={data.trend} good={s.good_rate} warn={s.warn_rate} />}
                    </Card>
                    <div className="ta-grid2 even">
                        <Card title="Theo lớp – môn" pad={false}>
                            {data.data.length === 0 ? <Empty icon="school" title="Chưa có phân công" /> : (
                                <div className="ta-tablewrap"><table className="ta-tbl"><thead><tr><th>Lớp · Môn</th><th>Tiết</th><th>Chuyên cần</th><th>Tỉ lệ</th></tr></thead><tbody>
                                {data.data.map((x) => (
                                    <tr key={x.class_subject_id}><td><b>{x.class_name}</b><small>{x.subject}</small></td><td>{x.sessions}</td>
                                        <td className="wide"><StackBar c={x} /></td><td><RatePill c={{ rate: x.rate ?? 0, total: x.total }} good={s.good_rate} warn={s.warn_rate} /></td></tr>))}
                                </tbody></table></div>)}
                        </Card>
                        <Card title="Học sinh vắng nhiều" sub={`Từ ${s.alert_absent} lượt vắng trở lên`} pad={false}>
                            {data.risk.length === 0 ? <Empty icon="check" title="Không có học sinh nào cần lưu ý" /> : (
                                <div className="ta-tablewrap"><table className="ta-tbl"><thead><tr><th>Học sinh</th><th>Vắng</th><th>Không phép</th><th>Muộn</th></tr></thead><tbody>
                                {data.risk.map((x) => (
                                    <tr key={x.id} className="click" onClick={() => setSid(x.id)}><td><b>{x.name}</b><small>{x.class_name} · {x.code}</small></td>
                                        <td><Pill tone={x.absent >= s.alert_absent * 2 ? 'rose' : 'amber'}>{x.absent}</Pill></td><td>{x.unexcused}</td><td>{x.late}</td></tr>))}
                                </tbody></table></div>)}
                        </Card>
                    </div>
                </>)}
            {sid > 0 && <StudentDrawer id={sid} onClose={() => setSid(0)} />}
        </div>
    );
}

function StudentDrawer({ id, onClose }: { id: number; onClose: () => void }) {
    const { data, err, loading } = useLoad(async () => (await ta<unknown>(`student/${id}`)) as unknown as Detail, [id]);
    return (
        <Drawer title={data?.student.name ?? 'Học sinh'} sub={data ? `${data.student.code} · lớp ${data.student.class_name} · 90 ngày gần nhất` : undefined} onClose={onClose}>
            {loading && !data ? <Loading /> : err && !data ? <ErrorBox msg={err} /> : data && (
                <>
                    <StackBar c={data.summary} tall />
                    <div className="ta-dnums">{(['present', 'late', 'excused', 'unexcused'] as const).map((k) => <div key={k}><b style={{ color: ST[k].color }}>{data.summary[k]}</b><small>{ST[k].label}</small></div>)}</div>
                    {data.records.length === 0 ? <Empty icon="doc" title="Chưa có dữ liệu" /> : (
                        <ul className="ta-recs">{data.records.map((r, i) => (
                            <li key={i}><span>{fmtD(r.date)} · Tiết {r.period}</span><b>{r.subject}</b><StatusBadge s={r.status} />{r.note && <small>{r.note}</small>}</li>))}</ul>)}
                </>)}
        </Drawer>
    );
}