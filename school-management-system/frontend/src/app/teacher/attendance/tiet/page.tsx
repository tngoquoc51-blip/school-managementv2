'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LessonCard, ReopenModal } from '../_lesson';
import {
    Btn, Card, Confirm, Empty, ErrorBox, Ico, Lesson, Loading, Pill, ST, ST_KEYS, StackBar, StatusKey, addDays, dt, fmtD, longDate, num, ta, todayStr, useLoad, useTa,
} from '../_ta';

type Stu = {
    id: number; code: string; name: string; status: StatusKey | null; note: string; abs30: number; late30: number;
    leave: { id: number; reason: string } | null; others: Record<string, StatusKey>;
};
type Info = {
    class_subject_id: number; class_id: number; class_name: string; grade: number; subject: string; teacher: string | null; date: string; period: number; start: string | null; end: string | null;
    locked: boolean; lock_reason: 'future' | 'submitted' | 'old' | null; submitted_at: string | null; auto: boolean; status: string | null;
    request: { reason: string; at: string } | null; reopen_note: string | null; lock_days: number;
};
type Roster = { lesson: Info; data: Stu[] };
type Row = { status: StatusKey | null; note: string };
type Filter = 'all' | 'todo' | 'absent' | 'late';

export default function Mark() {
    const [sel, setSel] = useState<{ cs: number; period: number; date: string } | null>(null);
    const [ready, setReady] = useState(false);
    useEffect(() => {
        const sp = new URLSearchParams(window.location.search);
        const cs = Number(sp.get('cs') || 0), period = Number(sp.get('period') || 0), date = sp.get('date') || '';
        if (cs && period && /^\d{4}-\d{2}-\d{2}$/.test(date)) setSel({ cs, period, date });
        setReady(true);
    }, []);
    const open = (l: { class_subject_id: number; period: number }, date: string) => {
        setSel({ cs: l.class_subject_id, period: l.period, date });
        window.history.replaceState(null, '', `/teacher/attendance/tiet?cs=${l.class_subject_id}&period=${l.period}&date=${date}`);
    };
    const back = () => { setSel(null); window.history.replaceState(null, '', '/teacher/attendance/tiet'); };
    if (!ready) return <Loading />;
    return sel ? <Roster key={`${sel.cs}-${sel.period}-${sel.date}`} sel={sel} onBack={back} /> : <Picker onOpen={open} />;
}

/* ---------- Chọn tiết cần điểm danh ---------- */
function Picker({ onOpen }: { onOpen: (l: { class_subject_id: number; period: number }, date: string) => void }) {
    const [date, setDate] = useState(todayStr());
    const { data, err, loading, reload } = useLoad(async () => (await ta<unknown>(`overview?date=${date}`)) as unknown as { data: Lesson[] }, [date]);
    const lessons = data?.data ?? [];
    return (
        <div className="ta-page">
            <div className="ta-ptitle">
                <div><h2>Chọn tiết để điểm danh</h2><p>Chọn ngày rồi chọn tiết trong thời khóa biểu của bạn.</p></div>
                <div className="acts ta-daynav">
                    <Btn size="sm" onClick={() => setDate(addDays(date, -1))}><Ico n="chevR" size={14} className="flip" /></Btn>
                    <input type="date" className="ta-datein dark" value={date} max={todayStr()} onChange={(e) => e.target.value && setDate(e.target.value)} />
                    <Btn size="sm" disabled={date >= todayStr()} onClick={() => setDate(addDays(date, 1))}><Ico n="chevR" size={14} /></Btn>
                    {date !== todayStr() && <Btn size="sm" onClick={() => setDate(todayStr())}>Hôm nay</Btn>}
                </div>
            </div>
            <Card title={longDate(date)}>
                {loading && !data ? <Loading /> : err && !data ? <ErrorBox msg={err} retry={reload} /> : lessons.length === 0 ? <Empty icon="cal" title="Không có tiết dạy" text="Chọn ngày khác có tiết trong thời khóa biểu." /> : (
                    <div className="ta-lessons pick">
                        {lessons.map((l) => (
                            <div key={`${l.class_subject_id}-${l.period}`} onClick={() => onOpen(l, date)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen(l, date)}>
                                <LessonCard l={l} date={date} />
                            </div>))}
                    </div>)}
            </Card>
        </div>
    );
}

/* ---------- Danh sách học sinh của một tiết ---------- */
function Roster({ sel, onBack }: { sel: { cs: number; period: number; date: string }; onBack: () => void }) {
    const { toast, refresh } = useTa();
    const { data, err, loading, reload } = useLoad(async () => (await ta<unknown>(`roster?class_subject_id=${sel.cs}&date=${sel.date}&period=${sel.period}`)) as unknown as Roster, [sel.cs, sel.date, sel.period]);
    const [rows, setRows] = useState<Record<number, Row>>({});
    const [base, setBase] = useState('');
    const [q, setQ] = useState(''); const [filter, setFilter] = useState<Filter>('all');
    const [busy, setBusy] = useState<'' | 'draft' | 'submit'>('');
    const [confirm, setConfirm] = useState(false); const [ask, setAsk] = useState(false);

    const init = useCallback((d: Roster) => {
        const r: Record<number, Row> = {};
        d.data.forEach((s) => { r[s.id] = { status: s.status ?? (s.leave ? 'excused' : null), note: s.note || (!s.status && s.leave ? s.leave.reason : '') }; });
        setRows(r); setBase(JSON.stringify(d.data.map((s) => [s.id, s.status ?? (s.leave ? 'excused' : null), r[s.id].note])));
    }, []);
    useEffect(() => { if (data) init(data); }, [data, init]);

    const set = (id: number, p: Partial<Row>) => setRows((x) => ({ ...x, [id]: { ...x[id], ...p } }));
    const all = (st: StatusKey) => data && setRows(Object.fromEntries(data.data.map((s) => [s.id, { status: rows[s.id]?.status && rows[s.id].status !== 'present' && st === 'present' ? rows[s.id].status : st, note: rows[s.id]?.note ?? '' }])));

    const counts = useMemo(() => {
        const c = { total: 0, present: 0, late: 0, excused: 0, unexcused: 0, todo: 0 };
        Object.values(rows).forEach((r) => { c.total++; if (r.status) c[r.status]++; else c.todo++; });
        return c;
    }, [rows]);
    const cur = data ? JSON.stringify(data.data.map((s) => [s.id, rows[s.id]?.status ?? null, rows[s.id]?.note ?? ''])) : '';
    const dirty = !!data && cur !== base;

    const payload = (onlyMarked: boolean) => data!.data.filter((s) => !onlyMarked || rows[s.id]?.status).map((s) => ({ student_id: s.id, status: rows[s.id].status ?? 'present', note: rows[s.id].note }));
    const save = async (submit: boolean) => {
        if (!data) return;
        const items = payload(!submit);
        if (items.length === 0) { toast('Hãy đánh dấu ít nhất một học sinh.', 'err'); return; }
        setBusy(submit ? 'submit' : 'draft');
        try {
            const r = await ta('save', { method: 'POST', body: { class_subject_id: sel.cs, date: sel.date, period: sel.period, items, submit } });
            toast(r.message || 'Đã lưu.'); setConfirm(false); refresh(); reload();
        } catch (e) { toast((e as Error).message, 'err'); setConfirm(false); } finally { setBusy(''); }
    };

    if (loading && !data) return <div className="ta-page"><Card><Loading /></Card></div>;
    if (err && !data) return <div className="ta-page"><Btn onClick={onBack}>← Chọn tiết khác</Btn><ErrorBox msg={err} retry={reload} /></div>;
    if (!data) return null;
    const L = data.lesson; const ro = L.locked;
    const list = data.data.filter((s) => {
        const r = rows[s.id]; if (!r) return false;
        if (q.trim() && !(s.name + ' ' + s.code).toLowerCase().includes(q.trim().toLowerCase())) return false;
        return filter === 'all' ? true : filter === 'todo' ? !r.status : filter === 'absent' ? r.status === 'excused' || r.status === 'unexcused' : r.status === 'late';
    });
    const complete = counts.todo === 0 && counts.total > 0;

    return (
        <div className="ta-page">
            <div className="ta-ptitle">
                <div>
                    <button type="button" className="ta-link" onClick={onBack}>← Chọn tiết khác</button>
                    <h2>{L.class_name} · {L.subject}</h2>
                    <p>Tiết {L.period}{L.start ? ` (${L.start} – ${L.end})` : ''} · {longDate(L.date)}{L.teacher ? ` · ${L.teacher}` : ''}</p>
                </div>
                <div className="acts"><Pill tone={ro ? 'green' : 'sky'} dot>{ro ? (L.lock_reason === 'future' ? 'Chưa đến ngày' : L.lock_reason === 'old' ? 'Quá hạn chỉnh sửa' : 'Đã gửi & khóa') : L.status === 'reopened' ? 'Được mở khóa' : 'Đang điểm danh'}</Pill></div>
            </div>

            {ro && L.lock_reason === 'submitted' && (
                <div className="ta-lockbar">
                    <div className="ic"><Ico n="lock" size={22} /></div>
                    <div className="tx"><b>Tiết này đã gửi về nhà trường và bị khóa</b>
                        <p>Gửi lúc {dt(L.submitted_at)}{L.auto ? ' · hệ thống tự khóa sau khi hết ngày' : ''}. {L.request ? <>Bạn đã xin mở khóa: “{L.request.reason}”. Đang chờ Ban Giám hiệu.</> : 'Cần chỉnh sửa? Hãy gửi yêu cầu mở khóa kèm lý do.'}
                            {L.reopen_note && !L.request ? <> Phản hồi gần nhất: “{L.reopen_note}”.</> : null}</p></div>
                    {!L.request && <Btn tone="primary" onClick={() => setAsk(true)}><Ico n="send" size={15} />Xin mở khóa</Btn>}
                </div>
            )}
            {ro && L.lock_reason === 'old' && <div className="ta-lockbar warn"><div className="ic"><Ico n="clock" size={22} /></div><div className="tx"><b>Đã quá {L.lock_days} ngày</b><p>Tiết học này không còn chỉnh sửa được. Hãy liên hệ Ban Giám hiệu nếu cần cập nhật.</p></div></div>}
            {ro && L.lock_reason === 'future' && <div className="ta-lockbar warn"><div className="ic"><Ico n="cal" size={22} /></div><div className="tx"><b>Chưa đến ngày học</b><p>Không thể điểm danh cho ngày trong tương lai.</p></div></div>}

            <Card pad={false} className="ta-roster">
                <header className="ta-rhead">
                    <div className="ta-chips">
                        {([['all', 'Tất cả', counts.total], ['todo', 'Chưa đánh dấu', counts.todo], ['absent', 'Vắng', counts.excused + counts.unexcused], ['late', 'Đi muộn', counts.late]] as [Filter, string, number][]).map(([k, l, n]) => (
                            <button key={k} type="button" className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}<em>{n}</em></button>))}
                    </div>
                    <div className="acts">
                        <label className="ta-search"><Ico n="search" size={15} /><input placeholder="Tìm học sinh…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
                        {!ro && <><Btn size="sm" onClick={() => all('present')}><Ico n="check" size={14} />Tất cả có mặt</Btn>
                            <Btn size="sm" tone="ghost" onClick={() => init(data)} title="Hoàn tác thay đổi"><Ico n="undo" size={14} /></Btn></>}
                    </div>
                </header>
                {data.data.length === 0 ? <Empty icon="user" title="Lớp chưa có học sinh" /> : (
                    <div className="ta-tablewrap">
                        <table className="ta-tbl roster">
                            <thead><tr><th style={{ width: 44 }}>#</th><th>Học sinh</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead>
                            <tbody>
                            {list.map((s) => {
                                const r = rows[s.id]; const idx = data.data.indexOf(s) + 1; const others = Object.entries(s.others);
                                return (
                                    <tr key={s.id} className={r.status ? `st-${r.status}` : 'st-none'}>
                                        <td className="ta-mute">{idx}</td>
                                        <td><b>{s.name}</b>
                                            <small>{s.code}
                                                {s.leave && <> · <span className="ta-leavetag" title={s.leave.reason}>Có đơn nghỉ</span></>}
                                                {s.abs30 >= 2 && <> · <span className="ta-flag rose" title="Số tiết vắng môn này trong 30 ngày">Vắng {s.abs30} tiết/30 ngày</span></>}
                                                {s.late30 >= 3 && <> · <span className="ta-flag amber">Muộn {s.late30} lần</span></>}
                                                {others.length > 0 && <> · <span className="ta-others" title="Các tiết khác trong ngày">{others.map(([p, st]) => <i key={p} style={{ background: ST[st].color }} title={`Tiết ${p}: ${ST[st].label}`}>{p}</i>)}</span></>}
                                            </small></td>
                                        <td>
                                            <div className="ta-stbtns" role="radiogroup" aria-label={`Trạng thái của ${s.name}`}>
                                                {ST_KEYS.map((k) => (
                                                    <button key={k} type="button" role="radio" aria-checked={r.status === k} disabled={ro} className={`b-${k}${r.status === k ? ' on' : ''}`} onClick={() => set(s.id, { status: k })} title={ST[k].label}>
                                                        <Ico n={ST[k].icon} size={14} /><span>{ST[k].label}</span>
                                                    </button>))}
                                            </div>
                                        </td>
                                        <td><input className="ta-note-in" disabled={ro} placeholder={r.status && r.status !== 'present' ? 'Lý do / ghi chú' : ''} value={r.note} onChange={(e) => set(s.id, { note: e.target.value })} maxLength={200} /></td>
                                    </tr>);
                            })}
                            {list.length === 0 && <tr><td colSpan={4}><Empty icon="search" title="Không có học sinh phù hợp" /></td></tr>}
                            </tbody>
                        </table>
                    </div>)}
            </Card>

            <div className="ta-savebar">
                <div className="sum">
                    <StackBar c={{ total: counts.total - counts.todo, present: counts.present, late: counts.late, excused: counts.excused, unexcused: counts.unexcused }} />
                    <div className="nums">
                        {ST_KEYS.map((k) => <span key={k}><i style={{ background: ST[k].color }} /><b>{num(counts[k])}</b> {ST[k].label.toLowerCase()}</span>)}
                        <span className="tot">{counts.todo > 0 ? <b className="rj">{counts.todo} chưa đánh dấu</b> : 'Đã đánh dấu đủ'} / {num(counts.total)} học sinh</span>
                    </div>
                </div>
                <div className="acts">
                    {dirty && !ro && <span className="ta-dirty"><i />Chưa lưu</span>}
                    {!ro && <Btn busy={busy === 'draft'} disabled={!dirty || !!busy} onClick={() => save(false)}><Ico n="save" size={16} />Lưu nháp</Btn>}
                    {!ro && <Btn tone="primary" busy={busy === 'submit'} disabled={!complete || !!busy} title={complete ? '' : 'Cần đánh dấu đủ tất cả học sinh'} onClick={() => setConfirm(true)}><Ico n="lock" size={16} />Hoàn tất & gửi nhà trường</Btn>}
                    {ro && <Link href="/teacher/attendance/lich-su" className="ta-btn">Xem lịch sử</Link>}
                </div>
            </div>

            {confirm && (
                <Confirm title="Hoàn tất và gửi về nhà trường?" okText="Gửi & khóa tiết học"
                         text={<>Lớp <b>{L.class_name}</b> · {L.subject} · tiết {L.period} ngày <b>{fmtD(L.date)}</b>:<br /><b>{counts.present}</b> có mặt, <b>{counts.late}</b> muộn, <b>{counts.excused}</b> vắng có phép, <b>{counts.unexcused}</b> vắng không phép.<br />Sau khi gửi, tiết học bị <b>khóa</b>. Muốn sửa phải xin Ban Giám hiệu mở khóa.</>}
                         onOk={() => save(true)} onClose={() => setConfirm(false)} />
            )}
            {ask && <ReopenModal sel={sel} onClose={() => setAsk(false)} onDone={() => { setAsk(false); refresh(); reload(); }} />}
        </div>
    );
}