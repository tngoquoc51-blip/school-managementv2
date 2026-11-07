'use client';
// Phần dùng chung: hồ sơ chuyên cần của một học sinh, form đơn nghỉ, hồ sơ theo dõi
import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import {
    ApiError, Btn, CASE_ST, Confirm, Counts, Drawer, Empty, ErrorBox, Field, Ico, LEAVE_ST, Legend, Loading, Modal, MonthCalendar, Pill, Range, ST, StackBar, StatusBadge,
    Switch, Tabs, Avatar, Ring, ca, dt, fmtD, fmtS, monthLabel, num, qs, todayStr, useCa, useDebounced, useLoad, weekday,
} from './_ca';

export type StudentRow = Counts & { id: number; code: string; name: string; class_id: number; class_name: string; grade: number };
export type Leave = {
    id: number; student_id: number; code: string; name: string; class_name: string; from_date: string; to_date: string; days: number; reason: string; kind: string; kind_label: string;
    status: string; reviewed_by: string | null; reviewed_at: string | null; review_note: string | null; created_at: string;
};
export type CaseRow = { id: number; student_id: number; code: string; name: string; class_name: string; title: string; status: string; note: string; created_by_name: string; created_at: string; updated_at: string };
export type StudentDetail = {
    student: { id: number; code: string; name: string; class_id: number | null; class_name: string | null; grade: number | null };
    summary: Counts; records: { date: string; status: string; note: string | null; by: string }[]; months: ({ m: string } & Counts)[]; leaves: Leave[]; cases: CaseRow[]; streak: number; from: string; to: string;
};
export type Lookup = { id: number; code: string; name: string; class_name: string | null };

/* ================= Form đơn nghỉ ================= */
export function LeaveModal({ student, onClose, onSaved }: { student?: Lookup | null; onClose: () => void; onSaved: () => void }) {
    const { meta, toast } = useCa();
    const [pick, setPick] = useState<Lookup | null>(student ?? null);
    const [q, setQ] = useState(''); const dq = useDebounced(q, 300);
    const [found, setFound] = useState<Lookup[]>([]);
    const [from, setFrom] = useState(todayStr()); const [to, setTo] = useState(todayStr());
    const [kind, setKind] = useState('sick'); const [reason, setReason] = useState(''); const [approve, setApprove] = useState(true);
    const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({}); const [top, setTop] = useState('');

    useEffect(() => {
        if (pick || dq.trim().length < 2) { setFound([]); return; }
        let live = true;
        ca<Lookup[]>(`students/lookup${qs({ q: dq.trim() })}`).then((r) => { if (live) setFound(r.data); }).catch(() => { if (live) setFound([]); });
        return () => { live = false; };
    }, [dq, pick]);

    const save = async () => {
        setBusy(true); setErrs({}); setTop('');
        try {
            const r = await ca('leaves', { method: 'POST', body: { student_id: pick?.id ?? 0, from_date: from, to_date: to, kind, reason, approve } });
            toast(r.message || 'Đã lưu đơn nghỉ.'); onSaved(); onClose();
        } catch (e) {
            const er = e as ApiError; setErrs(er.errors ?? {}); setTop(er.message); setBusy(false);
        }
    };
    return (
        <Modal title="Ghi nhận đơn nghỉ" onClose={onClose} foot={<><Btn onClick={onClose}>Hủy</Btn><Btn tone="primary" busy={busy} onClick={save}>Lưu đơn nghỉ</Btn></>}>
            <Field label="Học sinh" error={errs.student_id}>
                {pick ? (
                    <div className="ca-picked"><Avatar name={pick.name} tone="teal" /><div><b>{pick.name}</b><small>{pick.code} · {pick.class_name || 'chưa xếp lớp'}</small></div>{!student && <button type="button" onClick={() => { setPick(null); setQ(''); }}>Đổi</button>}</div>
                ) : (
                    <div className="ca-lookup">
                        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Gõ tên hoặc mã học sinh (ít nhất 2 ký tự)…" autoFocus />
                        {found.length > 0 && <ul>{found.map((x) => <li key={x.id}><button type="button" onClick={() => setPick(x)}><b>{x.name}</b><small>{x.code} · {x.class_name || 'chưa xếp lớp'}</small></button></li>)}</ul>}
                    </div>
                )}
            </Field>
            <div className="ca-two">
                <Field label="Từ ngày" error={errs.from_date}><input type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value > to) setTo(e.target.value); }} /></Field>
                <Field label="Đến ngày" error={errs.to_date}><input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field>
            </div>
            <Field label="Loại nghỉ"><select value={kind} onChange={(e) => setKind(e.target.value)}>{Object.entries(meta?.kinds ?? { sick: 'Ốm đau', other: 'Lý do khác' }).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
            <Field label="Lý do" error={errs.reason}><textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ví dụ: Phụ huynh gọi điện báo con bị sốt, xin nghỉ 2 ngày." /></Field>
            <Switch on={approve} onChange={setApprove} label="Ghi nhận luôn là đã duyệt" sub="Các buổi vắng không phép trong khoảng này sẽ tự chuyển thành “vắng có phép”." />
            {top && !Object.keys(errs).length && <p className="ca-ferr">{top}</p>}
        </Modal>
    );
}

/* ================= Hồ sơ theo dõi ================= */
export function CaseModal({ student, defaultTitle, onClose, onSaved }: { student: { id: number; name: string }; defaultTitle?: string; onClose: () => void; onSaved: () => void }) {
    const { toast } = useCa();
    const [title, setTitle] = useState(defaultTitle ?? 'Nghỉ học nhiều, cần liên hệ phụ huynh'); const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({});
    const save = async () => {
        setBusy(true); setErrs({});
        try { const r = await ca('cases', { method: 'POST', body: { student_id: student.id, title, note } }); toast(r.message || 'Đã mở hồ sơ.'); onSaved(); onClose(); }
        catch (e) { setErrs((e as ApiError).errors ?? { title: (e as Error).message }); setBusy(false); }
    };
    return (
        <Modal title={`Mở hồ sơ theo dõi · ${student.name}`} onClose={onClose} foot={<><Btn onClick={onClose}>Hủy</Btn><Btn tone="primary" busy={busy} onClick={save}>Mở hồ sơ</Btn></>}>
            <Field label="Tiêu đề" error={errs.title}><input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <Field label="Ghi chú ban đầu" hint="Ví dụ: lý do nghỉ, người đã liên hệ, hẹn gặp phụ huynh…"><textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </Modal>
    );
}

export function CaseCard({ c, onChanged }: { c: CaseRow; onChanged: () => void }) {
    const { toast } = useCa();
    const [edit, setEdit] = useState(false); const [note, setNote] = useState(c.note); const [busy, setBusy] = useState(false);
    const patch = async (body: Record<string, unknown>, msg: string) => {
        setBusy(true);
        try { await ca(`cases/${c.id}`, { method: 'PUT', body }); toast(msg); setEdit(false); onChanged(); } catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(false); }
    };
    const s = CASE_ST[c.status] ?? CASE_ST.open;
    return (
        <div className="ca-case">
            <header><div><b>{c.title}</b><small>{c.created_by_name} · mở {dt(c.created_at)}</small></div><Pill tone={s.tone} dot>{s.label}</Pill></header>
            {edit ? (
                <><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú xử lý…" />
                    <div className="acts"><Btn size="sm" onClick={() => { setEdit(false); setNote(c.note); }}>Hủy</Btn><Btn size="sm" tone="primary" busy={busy} onClick={() => patch({ note }, 'Đã lưu ghi chú.')}>Lưu ghi chú</Btn></div></>
            ) : (
                <>{c.note ? <p>{c.note}</p> : <p className="ca-mute">Chưa có ghi chú.</p>}
                    <div className="acts">
                        <Btn size="sm" onClick={() => setEdit(true)}><Ico n="edit" size={14} />Ghi chú</Btn>
                        {c.status === 'open' && <Btn size="sm" busy={busy} onClick={() => patch({ status: 'contacted' }, 'Đã chuyển sang “đã liên hệ phụ huynh”.')}><Ico n="phone" size={14} />Đã liên hệ phụ huynh</Btn>}
                        {c.status !== 'resolved' && <Btn size="sm" tone="success" busy={busy} onClick={() => patch({ status: 'resolved' }, 'Đã đóng hồ sơ.')}><Ico n="check" size={14} />Đã xử lý xong</Btn>}
                        {c.status === 'resolved' && <Btn size="sm" busy={busy} onClick={() => patch({ status: 'open' }, 'Đã mở lại hồ sơ.')}><Ico n="undo" size={14} />Mở lại</Btn>}
                    </div></>
            )}
        </div>
    );
}

export function LeaveRow({ l, onChanged, compact }: { l: Leave; onChanged: () => void; compact?: boolean }) {
    const { toast } = useCa();
    const [dlg, setDlg] = useState<'reject' | 'cancel' | null>(null);
    const run = async (action: string, note = '') => {
        try { const r = await ca(`leaves/${l.id}/action`, { method: 'POST', body: { action, note } }); toast(r.message || 'Đã cập nhật.'); setDlg(null); onChanged(); }
        catch (e) { if (action === 'approve') toast((e as Error).message, 'err'); else throw e; }
    };
    const s = LEAVE_ST[l.status] ?? LEAVE_ST.pending;
    return (
        <div className={`ca-leave${compact ? ' compact' : ''}`}>
            <span className={`ic t-${s.tone}`}><Ico n="doc" size={17} /></span>
            <div className="mid">
                <b>{compact ? l.kind_label : l.name}<Pill tone={s.tone} dot>{s.label}</Pill></b>
                <small>{!compact && <>{l.code} · {l.class_name || '—'} · </>}{fmtD(l.from_date)}{l.to_date !== l.from_date ? ` → ${fmtD(l.to_date)}` : ''} ({l.days} ngày){!compact && ` · ${l.kind_label}`}</small>
                <p>{l.reason}</p>
                {l.review_note && <small className="rj">Ghi chú: {l.review_note}</small>}
            </div>
            <div className="rt">
                {l.status === 'pending' && <><Btn size="sm" tone="success" onClick={() => run('approve')}>Duyệt</Btn><Btn size="sm" tone="danger" onClick={() => setDlg('reject')}>Từ chối</Btn></>}
                {(l.status === 'pending' || l.status === 'approved') && <Btn size="sm" tone="ghost" onClick={() => setDlg('cancel')} title="Hủy đơn"><Ico n="trash" size={14} /></Btn>}
            </div>
            {dlg === 'reject' && <Confirm title="Từ chối đơn nghỉ" tone="danger" okText="Từ chối" noteLabel="Lý do từ chối" noteRequired text={<>Đơn nghỉ của <b>{l.name}</b> ({fmtD(l.from_date)}).</>} onOk={(n) => run('reject', n)} onClose={() => setDlg(null)} />}
            {dlg === 'cancel' && <Confirm title="Hủy đơn nghỉ" tone="danger" okText="Hủy đơn" noteLabel="Ghi chú (không bắt buộc)" text="Các buổi đã chuyển thành “có phép” sẽ không tự đổi lại, bạn cần sửa trong phần Điểm danh nếu muốn." onOk={(n) => run('cancel', n)} onClose={() => setDlg(null)} />}
        </div>
    );
}

/* ================= Hồ sơ chuyên cần của học sinh ================= */
export function StudentDrawer({ id, range, onClose, onChanged }: { id: number; range: Range; onClose: () => void; onChanged?: () => void }) {
    const { meta, refresh } = useCa();
    const { data, err, loading, reload } = useLoad(async () => (await ca<StudentDetail>(`students/${id}${qs({ from: range.from, to: range.to })}`)).data, [id, range.from, range.to]);
    const [tab, setTab] = useState<'hist' | 'leaves' | 'cases'>('hist');
    const [month, setMonth] = useState(range.to.slice(0, 7));
    const [leaveOpen, setLeaveOpen] = useState(false); const [caseOpen, setCaseOpen] = useState(false);
    const good = Number(meta?.settings.good_rate ?? 95), warn = Number(meta?.settings.warn_rate ?? 85);
    const changed = () => { reload(); refresh(); onChanged?.(); };

    const sum = data?.summary;
    const tone = sum ? (sum.total <= 0 ? 'slate' : sum.rate >= good ? 'green' : sum.rate >= warn ? 'amber' : 'rose') : 'slate';
    return (
        <Drawer
            title={data ? <span className="ca-dr-t"><Avatar name={data.student.name} tone="teal" />{data.student.name}</span> : 'Hồ sơ chuyên cần'}
            sub={data ? <>{data.student.code} · Lớp {data.student.class_name || 'chưa xếp'} · {fmtD(data.from)} → {fmtD(data.to)}</> : undefined}
            onClose={onClose}
            foot={data ? <div className="ca-dr-act"><Btn size="sm" tone="primary" onClick={() => setLeaveOpen(true)}><Ico n="doc" size={14} />Ghi nhận đơn nghỉ</Btn><Btn size="sm" onClick={() => setCaseOpen(true)}><Ico n="flag" size={14} />Mở hồ sơ theo dõi</Btn>
                <Link href="/bgh/notices/soan" className="ca-btn sm"><Ico n="send" size={14} />Soạn thông báo cho phụ huynh</Link></div> : undefined}
        >
            {loading && !data ? <Loading /> : err && !data ? <ErrorBox msg={err} retry={reload} /> : data && sum ? (
                <div className="ca-dr-sec">
                    {data.streak >= 2 && <div className="ca-note bad"><Ico n="alert" size={20} /><div><b>Đang nghỉ liên tiếp {data.streak} buổi</b><p>Nên liên hệ phụ huynh sớm và mở hồ sơ theo dõi.</p></div></div>}
                    <div className="ca-statrow">
                        <Ring value={sum.total ? sum.rate : 0} label="chuyên cần" tone={tone} />
                        <div><b>{num(sum.total)}</b><small>buổi đã ghi nhận</small></div>
                        <div><b style={{ color: ST.present.color }}>{num(sum.present)}</b><small>có mặt</small></div>
                        <div><b style={{ color: ST.late.color }}>{num(sum.late)}</b><small>đi muộn</small></div>
                        <div><b style={{ color: ST.excused.color }}>{num(sum.excused)}</b><small>vắng có phép</small></div>
                        <div><b style={{ color: ST.unexcused.color }}>{num(sum.unexcused)}</b><small>vắng không phép</small></div>
                    </div>
                    <StackBar c={sum} tall />
                    <div className="ca-two top">
                        <div><div className="ca-h4">Lịch điểm danh</div><MonthCalendar records={data.records} month={month} onMonth={setMonth} /><Legend /></div>
                        <div><div className="ca-h4">6 tháng gần nhất</div>
                            {data.months.length === 0 ? <p className="ca-mute">Chưa có số liệu.</p> : (
                                <div className="ca-grp">{data.months.map((m) => (
                                    <div key={m.m}><span>{monthLabel(m.m)}</span><StackBar c={m} /><b>{m.total ? `${m.rate}%` : '—'}</b></div>
                                ))}</div>)}
                        </div>
                    </div>
                    <Tabs value={tab} onChange={setTab} items={[{ key: 'hist', label: 'Lịch sử', count: data.records.length }, { key: 'leaves', label: 'Đơn nghỉ', count: data.leaves.length, tone: 'sky' }, { key: 'cases', label: 'Hồ sơ theo dõi', count: data.cases.length, tone: 'rose' }]} />
                    {tab === 'hist' && (data.records.length === 0 ? <Empty icon="cal" title="Chưa có điểm danh trong khoảng này" /> : (
                        <div className="ca-tablewrap"><table className="ca-tbl"><thead><tr><th>Ngày</th><th>Trạng thái</th><th>Ghi chú</th><th>Người ghi</th></tr></thead><tbody>
                        {data.records.filter((r) => r.status !== 'present').concat(data.records.filter((r) => r.status === 'present').slice(0, 10)).sort((a, b) => b.date.localeCompare(a.date)).map((r) => (
                            <tr key={r.date}><td>{weekday(r.date)} {fmtS(r.date)}</td><td><StatusBadge s={r.status} /></td><td>{r.note || <span className="ca-mute">—</span>}</td><td>{r.by || '—'}</td></tr>
                        ))}</tbody></table><p className="ca-foot">Hiển thị mọi buổi vắng, muộn và 10 buổi có mặt gần nhất.</p></div>))}
                    {tab === 'leaves' && (data.leaves.length === 0 ? <Empty icon="doc" title="Chưa có đơn nghỉ" action={<Btn tone="primary" onClick={() => setLeaveOpen(true)}>Ghi nhận đơn nghỉ</Btn>} /> : <div className="ca-leaves">{data.leaves.map((l) => <LeaveRow key={l.id} l={l} compact onChanged={changed} />)}</div>)}
                    {tab === 'cases' && (data.cases.length === 0 ? <Empty icon="flag" title="Chưa có hồ sơ theo dõi" text="Mở hồ sơ để ghi lại việc liên hệ phụ huynh và kết quả xử lý." action={<Btn tone="primary" onClick={() => setCaseOpen(true)}>Mở hồ sơ</Btn>} /> : <div className="ca-cases">{data.cases.map((c) => <CaseCard key={c.id} c={c} onChanged={changed} />)}</div>)}
                </div>
            ) : null}
            {leaveOpen && data && <LeaveModal student={{ id: data.student.id, code: data.student.code, name: data.student.name, class_name: data.student.class_name }} onClose={() => setLeaveOpen(false)} onSaved={changed} />}
            {caseOpen && data && <CaseModal student={{ id: data.student.id, name: data.student.name }} onClose={() => setCaseOpen(false)} onSaved={() => { setTab('cases'); changed(); }} />}
        </Drawer>
    );
}