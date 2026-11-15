'use client';

import React, { useState } from 'react';
import { Btn, Card, Confirm, Empty, ErrorBox, Ico, Loading, Pill, ST, StatusBadge, StatusKey, addDays, dt, fmtD, longDate, num, ta, tapi, todayStr, useLoad, useTa } from '../_ta';

type Stu = { id: number; code: string; name: string; status: StatusKey | null; note: string | null; leave: string | null; periods: Record<string, StatusKey> };
type Home = {
    class: { id: number; name: string; grade: number } | null; message?: string; date: string; total: number; summary: Record<string, number>;
    lessons: { period: number; subject: string; teacher: string | null; marked: number; submitted: boolean }[]; data: Stu[];
};
type Leave = { id: number; student_id: number; code: string; full_name: string; leave_type: string; from_date: string; to_date: string; reason: string; status: string; created_at: string };
const KIND: Record<string, string> = { sick: 'Ốm đau', family: 'Việc gia đình', other: 'Lý do khác' };

export default function Homeroom() {
    const { toast, refresh } = useTa();
    const [date, setDate] = useState(todayStr()); const [q, setQ] = useState(''); const [only, setOnly] = useState(false);
    const { data, err, loading, reload } = useLoad(async () => (await ta<unknown>(`homeroom?date=${date}`)) as unknown as Home, [date]);
    const lv = useLoad(async () => (await tapi<Leave[]>('gv/teacher/homeroom/leaves?status=pending')).data, []);
    const [act, setAct] = useState<{ l: Leave; d: 'approve' | 'reject' } | null>(null);

    if (loading && !data) return <div className="ta-page"><Card><Loading /></Card></div>;
    if (err && !data) return <div className="ta-page"><ErrorBox msg={err} retry={reload} /></div>;
    if (!data?.class) return <div className="ta-page"><Card><Empty icon="school" title="Bạn chưa chủ nhiệm lớp nào" text={data?.message || 'Trang này chỉ dành cho giáo viên chủ nhiệm.'} /></Card></div>;
    const sm = data.summary; const marked = data.total - (sm.unmarked ?? 0);
    const rows = data.data.filter((s) => (!only || s.status === 'excused' || s.status === 'unexcused' || s.status === 'late') && (!q.trim() || (s.name + s.code).toLowerCase().includes(q.trim().toLowerCase())));
    const pers = Array.from(new Set(data.lessons.map((l) => l.period))).sort((a, b) => a - b);
    const review = async (note: string) => {
        if (!act) return;
        const r = await tapi(`gv/teacher/homeroom/leaves/${act.l.id}/review`, { method: 'POST', body: { decision: act.d, note } });
        toast(r.message || 'Đã xử lý đơn.'); setAct(null); lv.reload(); reload(); refresh();
    };

    return (
        <div className="ta-page">
            <div className="ta-ptitle">
                <div><h2>Lớp chủ nhiệm {data.class.name}</h2><p>{longDate(date)} · {data.total} học sinh · {marked > 0 ? `${marked} em đã có dữ liệu điểm danh` : 'chưa có điểm danh'}</p></div>
                <div className="acts ta-daynav">
                    <Btn size="sm" onClick={() => setDate(addDays(date, -1))}><Ico n="chevR" size={14} className="flip" /></Btn>
                    <input type="date" className="ta-datein dark" value={date} max={todayStr()} onChange={(e) => e.target.value && setDate(e.target.value)} />
                    <Btn size="sm" disabled={date >= todayStr()} onClick={() => setDate(addDays(date, 1))}><Ico n="chevR" size={14} /></Btn>
                    {date !== todayStr() && <Btn size="sm" onClick={() => setDate(todayStr())}>Hôm nay</Btn>}
                </div>
            </div>

            <div className="ta-kpis four">
                {(['present', 'late', 'excused', 'unexcused'] as StatusKey[]).map((k) => (
                    <div key={k} className={`ta-kpi t-${ST[k].tone}`}><span className="ic"><Ico n={ST[k].icon} size={18} /></span><div><small>{ST[k].label}</small><b>{num(sm[k])}</b><em>học sinh</em></div></div>))}
            </div>

            <div className="ta-grid2">
                <div className="ta-col">
                    <Card title="Chuyên cần cả ngày" sub="Tổng hợp từ điểm danh các tiết; vắng từ nửa số tiết trở lên tính là vắng cả ngày"
                          right={<><label className="ta-search"><Ico n="search" size={15} /><input placeholder="Tìm học sinh…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
                              <label className="ta-check"><input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} />Chỉ vắng / muộn</label></>} pad={false}>
                        <div className="ta-tablewrap">
                            <table className="ta-tbl">
                                <thead><tr><th>#</th><th>Học sinh</th><th>Cả ngày</th>{pers.map((p) => <th key={p} className="c">T{p}</th>)}<th>Ghi chú</th></tr></thead>
                                <tbody>
                                {rows.map((s, i) => (
                                    <tr key={s.id} className={s.status ? `st-${s.status}` : 'st-none'}>
                                        <td className="ta-mute">{i + 1}</td>
                                        <td><b>{s.name}</b><small>{s.code}{s.leave && <> · <span className="ta-leavetag" title={s.leave}>Có đơn nghỉ</span></>}</small></td>
                                        <td><StatusBadge s={s.status} /></td>
                                        {pers.map((p) => <td key={p} className="c">{s.periods[p] ? <i className="ta-dot" style={{ background: ST[s.periods[p]].color }} title={ST[s.periods[p]].label} /> : <span className="ta-mute">·</span>}</td>)}
                                        <td className="ta-mute">{s.note || ''}</td>
                                    </tr>))}
                                {rows.length === 0 && <tr><td colSpan={4 + pers.length}><Empty icon="search" title="Không có học sinh phù hợp" /></td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
                <div className="ta-side">
                    <Card title="Tình hình điểm danh các tiết" sub="Giáo viên bộ môn đã gửi chưa">
                        {data.lessons.length === 0 ? <p className="ta-mute">Ngày này lớp không có tiết.</p> : <ul className="ta-miss static">{data.lessons.map((l) => (
                            <li key={l.period}><div><b>Tiết {l.period} · {l.subject}</b><small>{l.teacher || 'Chưa phân công'}</small></div>
                                {l.submitted ? <Pill tone="green" dot>Đã gửi</Pill> : l.marked > 0 ? <Pill tone="sky" dot>{l.marked}/{data.total}</Pill> : <Pill tone="amber" dot>Chưa</Pill>}</li>))}</ul>}
                    </Card>
                    <Card title="Đơn xin nghỉ chờ duyệt" sub="Duyệt xong, các buổi vắng không phép tự chuyển thành vắng có phép">
                        {lv.loading && !lv.data ? <Loading /> : (lv.data?.length ?? 0) === 0 ? <Empty icon="doc" title="Không có đơn chờ duyệt" /> : (
                            <ul className="ta-leaves">{lv.data!.map((l) => (
                                <li key={l.id}><b>{l.full_name}<small> {l.code}</small></b>
                                    <p>{KIND[l.leave_type] || l.leave_type} · {fmtD(l.from_date.slice(0, 10))}{l.to_date !== l.from_date ? ` → ${fmtD(l.to_date.slice(0, 10))}` : ''}</p>
                                    <p className="why">{l.reason}</p><small>Gửi {dt(l.created_at)}</small>
                                    <div className="acts"><Btn size="sm" tone="success" onClick={() => setAct({ l, d: 'approve' })}><Ico n="check" size={13} />Duyệt</Btn><Btn size="sm" tone="danger" onClick={() => setAct({ l, d: 'reject' })}><Ico n="x" size={13} />Từ chối</Btn></div></li>))}
                            </ul>)}
                    </Card>
                </div>
            </div>
            {act && <Confirm title={act.d === 'approve' ? 'Duyệt đơn xin nghỉ?' : 'Từ chối đơn xin nghỉ?'} tone={act.d === 'approve' ? 'success' : 'danger'} okText={act.d === 'approve' ? 'Duyệt đơn' : 'Từ chối'}
                             text={<>Đơn của <b>{act.l.full_name}</b>, từ {fmtD(act.l.from_date.slice(0, 10))} đến {fmtD(act.l.to_date.slice(0, 10))}.</>} noteLabel={act.d === 'approve' ? 'Ghi chú (không bắt buộc)' : 'Lý do từ chối'} noteRequired={act.d === 'reject'} onOk={review} onClose={() => setAct(null)} />}
        </div>
    );
}