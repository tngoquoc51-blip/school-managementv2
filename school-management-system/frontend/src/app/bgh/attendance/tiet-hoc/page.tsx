'use client';

import React, { useState } from 'react';
import { Bar, Btn, Card, Confirm, Empty, ErrorBox, Ico, Loading, Pill, StackBar, addDays, ca, dt, longDate, num, pct, todayStr, useCa, useLoad } from '../_ca';

type Row = {
    class_subject_id: number; class_id: number; class_name: string; grade: number; subject: string; teacher: string | null; period: number; start: string | null; end: string | null;
    total: number; marked: number; state: 'todo' | 'draft' | 'ready' | 'locked' | 'reopened'; phase: string; overdue: boolean; counts: { present: number; late: number; excused: number; unexcused: number };
    submitted_at: string | null; auto: boolean; request: { reason: string; at: string } | null; reopen_note: string | null;
};
type Data = {
    date: string; data: Row[]; teachers: { name: string; lessons: number; locked: number; overdue: number }[];
    summary: { lessons: number; locked: number; ready: number; draft: number; todo: number; reopened: number; overdue: number; requests: number };
};
const STATE: Record<Row['state'], [string, string]> = { todo: ['Chưa điểm danh', 'amber'], draft: ['Đang điểm danh', 'sky'], ready: ['Chờ gửi', 'indigo'], locked: ['Đã nộp & khóa', 'green'], reopened: ['Đã mở khóa', 'violet'] };
type Filter = 'all' | 'locked' | 'pending' | 'request';

export default function Lessons() {
    const { toast } = useCa();
    const [date, setDate] = useState(todayStr()); const [filter, setFilter] = useState<Filter>('all'); const [q, setQ] = useState('');
    const { data, err, loading, reload } = useLoad(async () => (await ca<unknown>(`lessons?date=${date}`)) as unknown as Data, [date]);
    const [act, setAct] = useState<{ r: Row; a: 'approve' | 'reject' | 'unlock' } | null>(null);
    const s = data?.summary;
    const rows = (data?.data ?? []).filter((r) => {
        if (q.trim() && !(`${r.class_name} ${r.subject} ${r.teacher ?? ''}`).toLowerCase().includes(q.trim().toLowerCase())) return false;
        return filter === 'all' ? true : filter === 'locked' ? r.state === 'locked' : filter === 'pending' ? r.state !== 'locked' : !!r.request;
    });
    const go = async (note: string) => {
        if (!act) return;
        const r = await ca('lessons/reopen', { method: 'POST', body: { class_subject_id: act.r.class_subject_id, date, period: act.r.period, action: act.a, note } });
        toast(r.message || 'Đã xử lý.'); setAct(null); reload();
    };

    return (
        <div className="ca-page">
            <div className="ca-ptitle">
                <div><h2>Tiết học giáo viên đã nộp</h2><p>Điểm danh từng tiết do giáo viên gửi về. Tiết đã nộp bị khóa, chỉ Hiệu trưởng hoặc Quản trị mở khóa.</p></div>
                <div className="acts" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Btn size="sm" onClick={() => setDate(addDays(date, -1))}><Ico n="chevR" size={14} className="flip" /></Btn>
                    <input type="date" value={date} max={todayStr()} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ border: '1px solid var(--line)', borderRadius: 11, padding: '7px 11px', background: '#fff' }} />
                    <Btn size="sm" disabled={date >= todayStr()} onClick={() => setDate(addDays(date, 1))}><Ico n="chevR" size={14} /></Btn>
                    {date !== todayStr() && <Btn size="sm" onClick={() => setDate(todayStr())}>Hôm nay</Btn>}
                    <Btn size="sm" onClick={reload}><Ico n="refresh" size={14} /></Btn>
                </div>
            </div>

            {err && !data ? <ErrorBox msg={err} retry={reload} /> : loading && !data ? <Loading /> : data && s && (
                <>
                    <div className="ca-kpis four">
                        <div className="ca-kpi t-indigo"><span className="ic"><Ico n="book" size={20} /></span><div><small>Tổng số tiết</small><b>{num(s.lessons)}</b><em>{longDate(date)}</em></div></div>
                        <div className="ca-kpi t-green"><span className="ic"><Ico n="lock" size={20} /></span><div><small>Đã nộp & khóa</small><b>{num(s.locked)}</b><em>{pct(s.locked, s.lessons)}% tổng số tiết</em></div></div>
                        <div className="ca-kpi t-amber"><span className="ic"><Ico n="clock" size={20} /></span><div><small>Chưa nộp</small><b>{num(s.lessons - s.locked)}</b><em>{s.overdue > 0 ? `${s.overdue} tiết đã quá giờ` : 'chưa đến hạn'}</em></div></div>
                        <div className="ca-kpi t-violet"><span className="ic"><Ico n="send" size={20} /></span><div><small>Xin mở khóa</small><b>{num(s.requests)}</b><em>chờ Ban Giám hiệu</em></div></div>
                    </div>

                    <div className="ca-grid g21">
                        <Card pad={false} title="Danh sách tiết"
                              right={<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                  <div className="ca-seg">{([['all', 'Tất cả'], ['locked', 'Đã nộp'], ['pending', 'Chưa nộp'], ['request', 'Xin mở khóa']] as [Filter, string][]).map(([k, l]) => <button key={k} type="button" className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>)}</div>
                                  <input placeholder="Tìm lớp, môn, giáo viên…" value={q} onChange={(e) => setQ(e.target.value)} style={{ border: '1px solid var(--line)', borderRadius: 11, padding: '7px 11px', minWidth: 190 }} />
                              </div>}>
                            {rows.length === 0 ? <Empty icon="book" title={s.lessons === 0 ? 'Ngày này không có tiết học' : 'Không có tiết phù hợp'} text={s.lessons === 0 ? 'Cuối tuần hoặc ngày nghỉ không có thời khóa biểu.' : undefined} /> : (
                                <div className="ca-tablewrap" style={{ overflowX: 'auto' }}>
                                    <table className="ca-tbl">
                                        <thead><tr><th>Tiết</th><th>Lớp · Môn</th><th>Giáo viên</th><th>Chuyên cần</th><th>Trạng thái</th><th /></tr></thead>
                                        <tbody>{rows.map((r) => (
                                            <tr key={`${r.class_subject_id}-${r.period}`}>
                                                <td><b>Tiết {r.period}</b><small>{r.start ? `${r.start}–${r.end}` : ''}</small></td>
                                                <td><b>{r.class_name}</b><small>{r.subject}</small></td>
                                                <td>{r.teacher || <span className="ca-mute">Chưa phân công</span>}</td>
                                                <td style={{ minWidth: 200 }}>{r.marked > 0 ? <><StackBar c={{ total: r.marked, ...r.counts }} /><small>{r.counts.present} có mặt · {r.counts.late} muộn · {r.counts.excused + r.counts.unexcused} vắng · {r.marked}/{r.total}</small></> : <span className="ca-mute">Chưa có dữ liệu</span>}</td>
                                                <td><Pill tone={STATE[r.state][1]} dot>{STATE[r.state][0]}</Pill>{r.overdue && <small style={{ color: 'var(--rose)', fontWeight: 700 }}>Quá giờ chưa nộp</small>}
                                                    {r.state === 'locked' && r.submitted_at && <small>{dt(r.submitted_at)}{r.auto ? ' · tự khóa' : ''}</small>}
                                                    {r.request && <small style={{ color: 'var(--violet)', fontWeight: 700 }}>Xin mở khóa: {r.request.reason}</small>}</td>
                                                <td style={{ whiteSpace: 'nowrap' }}>
                                                    {r.request ? <><Btn size="sm" tone="success" onClick={() => setAct({ r, a: 'approve' })}>Duyệt</Btn> <Btn size="sm" tone="danger" onClick={() => setAct({ r, a: 'reject' })}>Từ chối</Btn></> :
                                                        r.state === 'locked' ? <Btn size="sm" onClick={() => setAct({ r, a: 'unlock' })}><Ico n="lock" size={13} />Mở khóa</Btn> : null}
                                                </td>
                                            </tr>))}</tbody>
                                    </table>
                                </div>)}
                        </Card>
                        <Card title="Theo giáo viên" sub="Ai chưa nộp điểm danh">
                            {data.teachers.length === 0 ? <p className="ca-mute">Không có dữ liệu.</p> : (
                                <ul style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{data.teachers.map((t) => (
                                    <li key={t.name}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13.5 }}><b>{t.name}</b><span className="ca-mute">{t.locked}/{t.lessons} tiết</span></div>
                                        <Bar value={pct(t.locked, t.lessons)} tone={t.overdue > 0 ? 'rose' : 'green'} slim />{t.overdue > 0 && <small style={{ color: 'var(--rose)', fontWeight: 700 }}>{t.overdue} tiết quá giờ chưa nộp</small>}</li>))}</ul>)}
                        </Card>
                    </div>
                </>)}

            {act && (
                <Confirm
                    title={act.a === 'approve' ? 'Duyệt yêu cầu mở khóa?' : act.a === 'reject' ? 'Từ chối mở khóa?' : 'Mở khóa tiết học?'}
                    tone={act.a === 'reject' ? 'danger' : 'primary'} okText={act.a === 'reject' ? 'Từ chối' : 'Mở khóa'}
                    text={<>Lớp <b>{act.r.class_name}</b> · {act.r.subject} · tiết {act.r.period}{act.r.teacher ? ` · ${act.r.teacher}` : ''}.{act.r.request ? <><br />Lý do giáo viên: “{act.r.request.reason}”.</> : null}<br />{act.a === 'reject' ? 'Tiết học vẫn giữ nguyên trạng thái khóa.' : 'Giáo viên sẽ chỉnh sửa được và phải gửi lại.'}</>}
                    noteLabel={act.a === 'reject' ? 'Lý do từ chối' : 'Ghi chú cho giáo viên (không bắt buộc)'} noteRequired={act.a === 'reject'} onOk={go} onClose={() => setAct(null)} />
            )}
        </div>
    );
}