'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Btn, Card, ClassInfo, Confirm, Empty, ErrorBox, Ico, Loading, ST, ST_KEYS, StackBar, StatusKey, addDays, ca, fmtD, longDate, num, todayStr, useCa, useLoad,
} from '../_ca';

type Stu = { id: number; code: string; name: string; status: StatusKey | null; note: string; leave: { id: number; reason: string } | null };
type Day = {
    class: { id: number; grade: number; name: string }; date: string; students: Stu[]; summary: Record<string, number>; marked: boolean; marked_by: string | null; marked_at: string | null;
    locked: boolean; future: boolean; lock_days: number;
};
type Row = { status: StatusKey; note: string };

export default function Mark() {
    const { meta, toast, refresh, staff } = useCa();
    const [classId, setClassId] = useState(0);
    const [date, setDate] = useState(todayStr());
    const [grade, setGrade] = useState(0);

    useEffect(() => {
        const sp = new URLSearchParams(window.location.search);
        const c = Number(sp.get('class') || 0); if (c) setClassId(c);
        const d = sp.get('date'); if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) setDate(d);
    }, []);
    useEffect(() => { if (!classId && meta?.classes.length) setClassId(meta.classes[0].id); }, [meta, classId]);

    const classes = meta?.classes ?? [];
    const grades = useMemo(() => Array.from(new Set(classes.map((c) => c.grade))).sort((a, b) => a - b), [classes]);
    const shown = grade ? classes.filter((c) => c.grade === grade) : classes;

    // lớp nào đã/chưa điểm danh trong ngày đang chọn
    const marks = useLoad(async () => (await ca<{ unmarked: ClassInfo[] }>(`overview?date=${date}`)).data.unmarked.map((c) => c.id), [date]);
    const unmarked = new Set(marks.data ?? []);

    return (
        <div className="ca-page">
            <div className="ca-ptitle">
                <div><h2>Điểm danh theo lớp</h2><p>Chọn lớp và ngày, đánh dấu từng học sinh rồi bấm Lưu. Học sinh có đơn nghỉ đã duyệt được gợi ý sẵn “vắng có phép”.</p></div>
                <div className="acts ca-daynav">
                    <Btn size="sm" onClick={() => setDate(addDays(date, -1))} aria-label="Ngày trước"><Ico n="chevR" size={14} className="flip" /></Btn>
                    <input type="date" className="ca-datein dark" value={date} max={todayStr()} onChange={(e) => e.target.value && setDate(e.target.value)} />
                    <Btn size="sm" disabled={date >= todayStr()} onClick={() => setDate(addDays(date, 1))} aria-label="Ngày sau"><Ico n="chevR" size={14} /></Btn>
                    {date !== todayStr() && <Btn size="sm" onClick={() => setDate(todayStr())}>Hôm nay</Btn>}
                </div>
            </div>

            <div className="ca-split">
                <aside className="ca-classlist">
                    <div className="ca-gradetabs">
                        <button type="button" className={grade === 0 ? 'on' : ''} onClick={() => setGrade(0)}>Tất cả</button>
                        {grades.map((g) => <button key={g} type="button" className={grade === g ? 'on' : ''} onClick={() => setGrade(g)}>Khối {g}</button>)}
                    </div>
                    <div className="ca-clslegend"><span><i className="d ok" />Đã điểm danh</span><span><i className="d no" />Chưa</span></div>
                    <ul>
                        {shown.map((c) => (
                            <li key={c.id}>
                                <button type="button" className={classId === c.id ? 'on' : ''} onClick={() => setClassId(c.id)}>
                                    <i className={`d ${marks.data ? (unmarked.has(c.id) ? 'no' : 'ok') : ''}`} /><b>{c.name}</b><small>{c.students} HS</small>
                                </button>
                            </li>
                        ))}
                        {shown.length === 0 && <li className="ca-mute pad">Chưa có lớp nào.</li>}
                    </ul>
                </aside>

                {classId ? <Roster key={`${classId}-${date}`} classId={classId} date={date} canForce={['super_admin', 'principal'].includes(staff.role)} onSaved={() => { marks.reload(); refresh(); }} toast={toast} /> : <Card><Empty icon="school" title="Chọn một lớp ở bên trái" /></Card>}
            </div>
        </div>
    );
}

function Roster({ classId, date, canForce, onSaved, toast }: { classId: number; date: string; canForce: boolean; onSaved: () => void; toast: (m: string, k?: 'ok' | 'err') => void }) {
    const { data, err, loading, reload } = useLoad(async () => (await ca<Day>(`day?class_id=${classId}&date=${date}`)).data, [classId, date]);
    const [rows, setRows] = useState<Record<number, Row>>({});
    const [base, setBase] = useState('');
    const [q, setQ] = useState('');
    const [busy, setBusy] = useState(false);
    const [clear, setClear] = useState(false);

    const init = useCallback((d: Day) => {
        const r: Record<number, Row> = {};
        d.students.forEach((s) => { r[s.id] = { status: s.status ?? (s.leave ? 'excused' : 'present'), note: s.note || (!s.status && s.leave ? s.leave.reason : '') }; });
        setRows(r); setBase(JSON.stringify(d.students.map((s) => [s.id, r[s.id].status, r[s.id].note])));
    }, []);
    useEffect(() => { if (data) init(data); }, [data, init]);

    const cur = data ? JSON.stringify(data.students.map((s) => [s.id, rows[s.id]?.status, rows[s.id]?.note])) : '';
    const dirty = !!data && (cur !== base || !data.marked);
    const set = (id: number, p: Partial<Row>) => setRows((x) => ({ ...x, [id]: { ...x[id], ...p } }));
    const all = (st: StatusKey) => data && setRows(Object.fromEntries(data.students.map((s) => [s.id, { status: st, note: rows[s.id]?.note ?? '' }])));

    const counts = useMemo(() => {
        const c = { total: 0, present: 0, late: 0, excused: 0, unexcused: 0 };
        Object.values(rows).forEach((r) => { c.total++; c[r.status]++; });
        return c;
    }, [rows]);

    const save = async () => {
        if (!data) return;
        setBusy(true);
        try {
            const r = await ca('mark', { method: 'POST', body: { class_id: classId, date, items: data.students.map((s) => ({ student_id: s.id, status: rows[s.id].status, note: rows[s.id].note })) } });
            toast(r.message || 'Đã lưu điểm danh.'); onSaved(); reload();
        } catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(false); }
    };
    const doClear = async () => {
        await ca('day/clear', { method: 'POST', body: { class_id: classId, date } });
        toast('Đã xóa điểm danh của ngày này.'); setClear(false); onSaved(); reload();
    };

    if (loading && !data) return <Card><Loading /></Card>;
    if (err && !data) return <Card><ErrorBox msg={err} retry={reload} /></Card>;
    if (!data) return null;
    const ro = data.locked || data.future;
    const list = q.trim() ? data.students.filter((s) => (s.name + ' ' + s.code).toLowerCase().includes(q.trim().toLowerCase())) : data.students;

    return (
        <div className="ca-rosterwrap">
            <Card pad={false} className="ca-roster">
                <header className="ca-rhead">
                    <div><h3>Lớp {data.class.name} <small>· {longDate(date)}</small></h3>
                        <p>{data.marked ? <>Đã điểm danh{data.marked_by ? <> bởi <b>{data.marked_by}</b></> : null}</> : 'Chưa điểm danh ngày này'}{ro && <> · <b className="rj">{data.future ? 'Ngày trong tương lai' : `Đã khóa chỉnh sửa (quá ${data.lock_days} ngày)`}</b></>}</p></div>
                    <div className="acts">
                        <label className="ca-search"><Ico n="search" size={15} /><input placeholder="Tìm học sinh…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
                        {!ro && <><Btn size="sm" onClick={() => all('present')}><Ico n="check" size={14} />Tất cả có mặt</Btn>
                            <Btn size="sm" tone="ghost" onClick={() => init(data)} title="Hoàn tác thay đổi"><Ico n="undo" size={14} /></Btn></>}
                        {data.marked && !ro && <Btn size="sm" tone="danger" onClick={() => setClear(true)} title="Xóa điểm danh của ngày này"><Ico n="trash" size={14} /></Btn>}
                    </div>
                </header>

                {data.students.length === 0 ? <Empty icon="user" title="Lớp chưa có học sinh" text="Hãy xếp học sinh vào lớp ở phần quản lý lớp." /> : (
                    <div className="ca-tablewrap">
                        <table className="ca-tbl roster">
                            <thead><tr><th style={{ width: 44 }}>#</th><th>Học sinh</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead>
                            <tbody>
                            {list.map((s) => {
                                const r = rows[s.id]; if (!r) return null;
                                const idx = data.students.indexOf(s) + 1;
                                return (
                                    <tr key={s.id} className={`st-${r.status}`}>
                                        <td className="ca-mute">{idx}</td>
                                        <td><b>{s.name}</b><small>{s.code}{s.leave ? <> · <span className="ca-leavetag" title={s.leave.reason}>Có đơn nghỉ</span></> : null}</small></td>
                                        <td>
                                            <div className="ca-stbtns" role="radiogroup" aria-label={`Trạng thái của ${s.name}`}>
                                                {ST_KEYS.map((k) => (
                                                    <button key={k} type="button" role="radio" aria-checked={r.status === k} disabled={ro} className={`b-${k}${r.status === k ? ' on' : ''}`} onClick={() => set(s.id, { status: k })} title={ST[k].label}>
                                                        <Ico n={ST[k].icon} size={14} /><span>{ST[k].label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </td>
                                        <td><input className="ca-note-in" disabled={ro} placeholder={r.status === 'present' ? '' : 'Lý do / ghi chú'} value={r.note} onChange={(e) => set(s.id, { note: e.target.value })} maxLength={200} /></td>
                                    </tr>
                                );
                            })}
                            {list.length === 0 && <tr><td colSpan={4}><Empty icon="search" title="Không tìm thấy học sinh" /></td></tr>}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <div className="ca-savebar">
                <div className="sum">
                    <StackBar c={counts} />
                    <div className="nums">
                        {ST_KEYS.map((k) => <span key={k}><i style={{ background: ST[k].color }} /><b>{num(counts[k])}</b> {ST[k].label.toLowerCase()}</span>)}
                        <span className="tot">/ {num(counts.total)} học sinh · {counts.total ? Math.round(((counts.present + counts.late) / counts.total) * 100) : 0}% đi học</span>
                    </div>
                </div>
                <div className="acts">
                    {dirty && !ro && <span className="ca-dirty"><i />Chưa lưu</span>}
                    {canForce === false && ro && data.locked && <span className="ca-mute">Liên hệ Hiệu trưởng để sửa ngày đã khóa</span>}
                    <Btn tone="primary" busy={busy} disabled={ro || (!dirty && data.marked) || data.students.length === 0} onClick={save}><Ico n="save" size={16} />{data.marked ? 'Lưu thay đổi' : 'Lưu điểm danh'}</Btn>
                </div>
            </div>
            {clear && <Confirm title="Xóa điểm danh ngày này?" tone="danger" okText="Xóa điểm danh" text={<>Toàn bộ điểm danh của lớp <b>{data.class.name}</b> ngày <b>{fmtD(date)}</b> sẽ bị xóa. Thao tác được ghi vào nhật ký.</>} onOk={doClear} onClose={() => setClear(false)} />}
        </div>
    );
}