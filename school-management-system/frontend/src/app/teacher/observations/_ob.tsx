'use client';
// Thư viện dùng chung cho module Dự giờ & đánh giá tiết dạy (/teacher/observations)
import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { Avatar, Bar, Btn, Card, Confirm, Drawer, Empty, ErrorBox, Field, Ico, Loading, Modal, Pager, Pill, Ring, Seg, Tabs, addDays, ago, dt, fmtD, fmtS, longDate, num, parseYmd, qs, tapi, todayStr, useDebounced, useLoad, useTa, weekday, ymd } from '../attendance/_ta';

export { Avatar, Bar, Btn, Card, Confirm, Drawer, Empty, ErrorBox, Field, Ico, Loading, Modal, Pager, Pill, Ring, Seg, Tabs, addDays, ago, dt, fmtD, fmtS, longDate, num, parseYmd, qs, todayStr, useDebounced, useLoad, useTa, weekday, ymd };

/** Gọi API dự giờ: /api/gv/teacher/ob/... (trả về nguyên JSON máy chủ) */
export const ob = <T,>(path: string, o: { method?: string; body?: unknown } = {}) => tapi<unknown>(`gv/teacher/ob/${path}`, o) as unknown as Promise<T>;
export const ADMIN_ROLES = ['academic', 'principal', 'vice_principal', 'super_admin'];

/* ---------------- kiểu dữ liệu ---------------- */
export type Rating = 'Tốt' | 'Khá' | 'Đạt' | 'Chưa đạt';
export type SStatus = 'pending' | 'scheduled' | 'completed' | 'cancelled' | 'declined';
export type Observer = { teacher_id: number; name: string; status: 'invited' | 'accepted' | 'declined'; note: string | null; eval_status: 'draft' | 'submitted' | null; eval_id: number | null; percent: number | null; rating: Rating | null; submitted_at: string | null };
export type Session = {
    id: number; title: string; kind: string; kind_label: string; status: SStatus; initiator: string; lesson_date: string; period: number | null; start: string | null; end: string | null; room: string | null;
    class_id: number | null; class_subject_id: number | null; class_name: string | null; subject: string | null; objective: string | null; observed_id: number; observed_name: string; created_by_name: string | null; cancel_note: string | null;
    created_at: string; phase: 'past' | 'today' | 'upcoming'; observers: Observer[];
    me: { observed: boolean; observer: boolean; status: string | null; eval_status: string | null; eval_id: number | null };
    can_respond: boolean; can_evaluate: boolean; can_edit: boolean;
};
export type Crit = { id: number; group: string; name: string; hint: string | null; weight: number; score: number | null; note: string | null };
export type Meta = { is_admin: boolean; teacher_id: number | null; kinds: Record<string, string>; settings: { quota_observe: number; quota_taught: number } };

export const STATUS: Record<SStatus, { label: string; tone: string }> = {
    pending: { label: 'Chờ xác nhận', tone: 'amber' }, scheduled: { label: 'Đã lên lịch', tone: 'sky' }, completed: { label: 'Hoàn thành', tone: 'green' }, cancelled: { label: 'Đã hủy', tone: 'slate' }, declined: { label: 'Bị từ chối', tone: 'rose' },
};
export const RATING: Record<Rating, { tone: string; c: string; cs: string }> = {
    'Tốt': { tone: 'green', c: '#059669', cs: '#d1fae5' }, 'Khá': { tone: 'sky', c: '#0284c7', cs: '#e0f2fe' }, 'Đạt': { tone: 'amber', c: '#d97706', cs: '#fef3c7' }, 'Chưa đạt': { tone: 'rose', c: '#e11d48', cs: '#ffe4e9' },
};
export const SCORE: { v: number; label: string; c: string }[] = [{ v: 1, label: 'Chưa đạt', c: '#e11d48' }, { v: 2, label: 'Đạt', c: '#d97706' }, { v: 3, label: 'Khá', c: '#0284c7' }, { v: 4, label: 'Tốt', c: '#059669' }];
export const KIND_OPTS: [string, string][] = [['periodic', 'Dự giờ định kỳ'], ['demo', 'Thao giảng'], ['topic', 'Chuyên đề'], ['surprise', 'Đột xuất'], ['review', 'Kiểm tra chuyên môn']];
export const ratingOf = (p: number | null | undefined): Rating | null => (p === null || p === undefined ? null : p >= 85 ? 'Tốt' : p >= 70 ? 'Khá' : p >= 50 ? 'Đạt' : 'Chưa đạt');
/** % điểm có trọng số – giống hệt cách máy chủ tính */
export const calcPercent = (cs: { score: number | null; weight: number }[]): number | null => {
    let a = 0, b = 0; cs.forEach((c) => { if (c.score !== null) { a += c.score * c.weight; b += 4 * c.weight; } }); return b > 0 ? Math.round((a / b) * 10000) / 100 : null;
};

/* ---------------- thành phần nhỏ ---------------- */
export const StatusPill = ({ s }: { s: SStatus }) => <Pill tone={STATUS[s].tone} dot>{STATUS[s].label}</Pill>;
export function RatingPill({ rating, percent }: { rating: Rating | null; percent?: number | null }) {
    if (!rating) return <Pill tone="slate">Chưa có</Pill>;
    return <Pill tone={RATING[rating].tone}>{rating}{percent !== null && percent !== undefined ? ` · ${percent}%` : ''}</Pill>;
}
export const relDay = (d: string) => { const t = todayStr(); if (d === t) return 'Hôm nay'; if (d === addDays(t, 1)) return 'Ngày mai'; if (d === addDays(t, -1)) return 'Hôm qua'; const n = Math.round((new Date(d).getTime() - new Date(t).getTime()) / 86400000); return n > 0 ? `${n} ngày nữa` : `${-n} ngày trước`; };
export const slotText = (s: Pick<Session, 'period' | 'start' | 'end'>) => (s.period ? `Tiết ${s.period}${s.start ? ` · ${s.start}–${s.end ?? ''}` : ''}` : 'Cả buổi');
export function DateBlock({ d, tone }: { d: string; tone?: string }) {
    const mon = Number(d.slice(5, 7)); return <div className={`ob-date${tone ? ' ' + tone : ''}`}><b>{d.slice(8, 10)}</b><small>Th{mon}</small></div>;
}
export function Donut2({ items }: { items: { label: string; n: number; c: string }[] }) {
    const tot = items.reduce((s, i) => s + i.n, 0); const r = 44, C = 2 * Math.PI * r; let off = 0;
    return (
        <div className="ob-donut"><svg width="120" height="120" viewBox="0 0 120 120"><circle cx="60" cy="60" r={r} fill="none" stroke="#e3eef7" strokeWidth="14" />
            {tot > 0 && items.map((i) => { const len = (i.n / tot) * C; const el = <circle key={i.label} cx="60" cy="60" r={r} fill="none" stroke={i.c} strokeWidth="14" strokeDasharray={`${Math.max(0, len - 1.5)} ${C}`} strokeDashoffset={-off} transform="rotate(-90 60 60)" />; off += len; return el; })}
            <text x="60" y="58" textAnchor="middle" fontSize="22" fontWeight="800" fill="#082f49">{tot}</text><text x="60" y="74" textAnchor="middle" fontSize="10" fill="#5b7388">phiếu</text></svg>
            <ul>{items.map((i) => <li key={i.label}><i style={{ background: i.c }} /><span>{i.label}</span><b>{i.n}</b></li>)}</ul></div>
    );
}

/* ---------------- chọn giáo viên ---------------- */
export type Person = { id: number; name: string; subjects?: string | null };
export function PeoplePicker({ value, onChange, exclude = [], max = 5, placeholder }: { value: Person[]; onChange: (v: Person[]) => void; exclude?: number[]; max?: number; placeholder?: string }) {
    const [q, setQ] = useState(''); const dq = useDebounced(q, 250); const [open, setOpen] = useState(false);
    const { data } = useLoad(() => ob<{ data: Person[] }>(`teachers?q=${encodeURIComponent(dq)}`), [dq]);
    const skip = new Set([...exclude, ...value.map((v) => v.id)]); const list = (data?.data || []).filter((p) => !skip.has(p.id));
    return (
        <div className="ob-pick">
            <div className="ob-chips">{value.map((p) => <span key={p.id} className="ob-chip on"><Avatar name={p.name} tone="sky" />{p.name}<button type="button" aria-label="Bỏ" onClick={() => onChange(value.filter((x) => x.id !== p.id))}><Ico n="x" size={12} /></button></span>)}</div>
            {value.length < max && (
                <div className="ob-pick-in"><Ico n="search" size={15} /><input value={q} placeholder={placeholder || 'Gõ tên giáo viên để tìm…'} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} />
                    {open && <div className="ob-pick-dd">{list.length === 0 ? <p>Không có giáo viên phù hợp.</p> : list.map((p) => <button key={p.id} type="button" onClick={() => { onChange([...value, p]); setQ(''); setOpen(false); }}><Avatar name={p.name} tone="sky" /><span><b>{p.name}</b><small>{p.subjects || 'Chưa phân công môn'}</small></span></button>)}</div>}
                </div>)}
        </div>
    );
}

/* ---------------- lên lịch / sửa buổi dự giờ ---------------- */
type Slot = { class_subject_id: number; class_id: number; class_name: string; subject: string; period: number; start: string | null; end: string | null; booked: boolean };
export function SessionForm({ edit, onClose, onDone }: { edit?: Session; onClose: () => void; onDone: (id?: number) => void }) {
    const { staff, toast } = useTa(); const isAdmin = ADMIN_ROLES.includes(staff.role); const meta = useLoad(() => ob<Meta>('meta'), []);
    const [mode, setMode] = useState<'request' | 'invite'>('request');
    const [observed, setObserved] = useState<Person[]>([]); const [observers, setObservers] = useState<Person[]>([]);
    const [kind, setKind] = useState(edit?.kind || 'periodic'); const [date, setDate] = useState(edit?.lesson_date || addDays(todayStr(), 1)); const [title, setTitle] = useState(edit?.title || '');
    const [objective, setObjective] = useState(edit?.objective || ''); const [room, setRoom] = useState(edit?.room || ''); const [period, setPeriod] = useState(edit?.period ? String(edit.period) : '');
    const [slot, setSlot] = useState<number>(edit?.class_subject_id || 0); const [manual, setManual] = useState(false); const [subject, setSubject] = useState(''); const [className, setClassName] = useState('');
    const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [conflict, setConflict] = useState('');
    const myId = meta.data?.teacher_id || 0; const targetId = edit ? edit.observed_id : isAdmin ? observed[0]?.id || 0 : mode === 'invite' ? myId : observed[0]?.id || 0;
    const slots = useLoad(() => (!edit && targetId && date ? ob<{ data: Slot[] }>(`slots?teacher_id=${targetId}&date=${date}`) : Promise.resolve({ data: [] as Slot[] })), [targetId, date, !!edit]);
    useEffect(() => { setSlot(0); }, [targetId, date]);
    const chosen = (slots.data?.data || []).find((s) => s.class_subject_id === slot && String(s.period) === period) || null;
    const submit = async (force = false) => {
        setErr('');
        if (title.trim().length < 3) { setErr('Hãy nhập tên bài dạy (ít nhất 3 ký tự).'); return; }
        if (!edit) {
            if ((isAdmin || mode === 'request') && !observed[0]) { setErr('Hãy chọn giáo viên được dự giờ.'); return; }
            if ((isAdmin || mode === 'invite') && observers.length === 0) { setErr(isAdmin ? 'Hãy chọn ít nhất một người dự giờ.' : 'Hãy chọn đồng nghiệp bạn mời dự giờ.'); return; }
            if (!manual && !chosen) { setErr('Hãy chọn tiết dạy trong thời khóa biểu, hoặc bấm “Nhập tay” nếu tiết chưa có trong thời khóa biểu.'); return; }
            if (manual && subject.trim().length < 2) { setErr('Hãy nhập môn học.'); return; }
        }
        setBusy(true);
        try {
            if (edit) { const r = await ob<{ message: string }>(`sessions/${edit.id}`, { method: 'PUT', body: { title: title.trim(), kind, lesson_date: date, period: period ? Number(period) : null, room: room.trim() || null, objective: objective.trim() || null, force } }); toast(r.message); onDone(edit.id); }
            else {
                const body: Record<string, unknown> = { title: title.trim(), kind, lesson_date: date, room: room.trim() || null, objective: objective.trim() || null, force };
                if (isAdmin || mode === 'request') body.observed_id = observed[0]?.id;
                if (isAdmin || mode === 'invite') body.observer_ids = observers.map((p) => p.id);
                if (!manual && chosen) { body.class_subject_id = chosen.class_subject_id; body.period = chosen.period; } else { body.subject = subject.trim(); body.class_name = className.trim() || null; body.period = period ? Number(period) : null; }
                const r = await ob<{ id: number; message: string }>('sessions', { method: 'POST', body }); toast(r.message); onDone(r.id);
            }
        } catch (e) { const m = (e as Error).message; if (m.startsWith('Trùng tiết dạy')) setConflict(m); else setErr(m); setBusy(false); }
    };
    return (
        <Modal wide title={edit ? 'Sửa / đổi lịch buổi dự giờ' : isAdmin ? 'Phân công dự giờ' : 'Lên lịch dự giờ'} onClose={onClose} foot={<><Btn onClick={onClose}>Hủy</Btn><Btn tone="primary" busy={busy} onClick={() => submit(false)}><Ico n="cal" size={15} />{edit ? 'Lưu thay đổi' : isAdmin ? 'Phân công' : mode === 'request' ? 'Gửi đề nghị dự giờ' : 'Gửi lời mời'}</Btn></>}>
            {!edit && !isAdmin && <div style={{ marginBottom: 14 }}><Seg value={mode} onChange={(v) => { setMode(v as 'request' | 'invite'); setObserved([]); setObservers([]); }} items={[['request', 'Tôi xin dự giờ đồng nghiệp'], ['invite', 'Tôi mời đồng nghiệp dự giờ lớp mình']]} />
                <p className="ta-mute" style={{ marginTop: 6 }}>{mode === 'request' ? 'Đồng nghiệp sẽ nhận thông báo và xác nhận trước khi buổi dự giờ có hiệu lực.' : 'Lời mời có hiệu lực ngay, các đồng nghiệp được mời sẽ nhận lời hoặc từ chối.'}</p></div>}
            {!edit && (isAdmin || mode === 'request') && <Field label="Giáo viên được dự giờ *"><PeoplePicker value={observed} onChange={setObserved} max={1} exclude={myId && !isAdmin ? [myId] : []} /></Field>}
            {!edit && (isAdmin || mode === 'invite') && <Field label={isAdmin ? 'Người dự giờ *' : 'Mời đồng nghiệp dự giờ *'}><PeoplePicker value={observers} onChange={setObservers} exclude={[...(observed[0] ? [observed[0].id] : []), ...(isAdmin ? [] : myId ? [myId] : [])]} /></Field>}
            <div className="ob-grid2">
                <Field label="Hình thức"><select value={kind} onChange={(e) => setKind(e.target.value)}>{KIND_OPTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
                <Field label="Ngày dự giờ *"><input type="date" value={date} min={addDays(todayStr(), -30)} onChange={(e) => setDate(e.target.value)} /></Field>
            </div>
            {!edit && (
                <Field label="Tiết dạy *" hint="Lấy từ thời khóa biểu của giáo viên được dự vào đúng ngày đã chọn.">
                    {manual ? (<div className="ob-grid3"><input placeholder="Môn học *" value={subject} onChange={(e) => setSubject(e.target.value)} /><input placeholder="Lớp (ví dụ 10A1)" value={className} onChange={(e) => setClassName(e.target.value)} /><input type="number" min={1} max={15} placeholder="Tiết số" value={period} onChange={(e) => setPeriod(e.target.value)} /></div>)
                        : !targetId ? <p className="ta-mute">Hãy chọn giáo viên được dự giờ trước.</p> : slots.loading ? <p className="ta-mute">Đang tải thời khóa biểu…</p> : (slots.data?.data || []).length === 0 ? <p className="ta-mute">Ngày này giáo viên không có tiết dạy trong thời khóa biểu. Chọn ngày khác hoặc bấm “Nhập tay”.</p> : (
                            <div className="ob-slots">{(slots.data?.data || []).map((s) => (
                                <button type="button" key={`${s.class_subject_id}-${s.period}`} disabled={s.booked} className={slot === s.class_subject_id && period === String(s.period) ? 'on' : ''} onClick={() => { setSlot(s.class_subject_id); setPeriod(String(s.period)); }}>
                                    <b>Tiết {s.period}</b><span>{s.subject} · lớp {s.class_name}</span><small>{s.booked ? 'Đã có người đăng ký' : s.start ? `${s.start}–${s.end}` : ''}</small></button>))}</div>)}
                    <button type="button" className="ob-link" onClick={() => { setManual(!manual); setPeriod(''); setSlot(0); }}>{manual ? '← Chọn từ thời khóa biểu' : 'Tiết không có trong thời khóa biểu? Nhập tay'}</button>
                </Field>)}
            {edit && <div className="ob-grid2"><Field label="Tiết số"><input type="number" min={1} max={15} value={period} onChange={(e) => setPeriod(e.target.value)} /></Field><Field label="Phòng / địa điểm"><input value={room} maxLength={40} onChange={(e) => setRoom(e.target.value)} /></Field></div>}
            <Field label="Tên bài dạy *"><input value={title} maxLength={200} placeholder="Ví dụ: Phương trình bậc hai một ẩn" onChange={(e) => setTitle(e.target.value)} /></Field>
            {!edit && <Field label="Phòng / địa điểm"><input value={room} maxLength={40} onChange={(e) => setRoom(e.target.value)} /></Field>}
            <Field label="Mục đích / nội dung cần quan sát"><textarea rows={3} value={objective} maxLength={2000} placeholder="Ví dụ: Quan sát hoạt động nhóm và việc ứng dụng CNTT" onChange={(e) => setObjective(e.target.value)} /></Field>
            {chosen && <p className="ob-ok"><Ico n="check" size={14} /> Đã khớp thời khóa biểu: {chosen.subject} lớp {chosen.class_name}, tiết {chosen.period}.</p>}
            {err && <p className="ta-ferr">{err}</p>}
            {conflict && <Confirm title="Trùng tiết dạy" tone="danger" okText="Vẫn lên lịch" text={<>{conflict}<br />Bạn vẫn muốn tiếp tục?</>} onClose={() => { setConflict(''); setBusy(false); }} onOk={async () => { setConflict(''); await submit(true); }} />}
        </Modal>
    );
}

/* ---------------- hàng buổi dự giờ ---------------- */
export function SessionRow({ s, onOpen }: { s: Session; onOpen: () => void }) {
    const tone = s.status === 'completed' ? 'green' : s.status === 'pending' ? 'amber' : s.status === 'cancelled' || s.status === 'declined' ? 'slate' : s.phase === 'today' ? 'rose' : '';
    const role = s.me.observed ? 'Tôi được dự' : s.me.observer ? 'Tôi dự giờ' : 'Quản lý';
    return (
        <div className="ob-srow" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}>
            <DateBlock d={s.lesson_date} tone={tone} />
            <div className="ob-sb">
                <div className="ob-st"><b>{s.title}</b></div>
                <p><Ico n="user" size={13} /> {s.observed_name}{s.subject ? ` · ${s.subject}` : ''}{s.class_name ? ` · lớp ${s.class_name}` : ''} · {slotText(s)} · {relDay(s.lesson_date)}</p>
                <div className="ob-sm"><StatusPill s={s.status} /><Pill tone="slate">{s.kind_label}</Pill><Pill tone={s.me.observed ? 'violet' : s.me.observer ? 'indigo' : 'gray'}>{role}</Pill>
                    {s.can_respond && <Pill tone="rose" dot>Cần phản hồi</Pill>}{s.can_evaluate && s.me.eval_status !== 'submitted' && <Pill tone="rose" dot>Cần điền phiếu</Pill>}</div>
            </div>
            <div className="ob-sr"><div className="ob-avs">{s.observers.slice(0, 4).map((o) => <Avatar key={o.teacher_id} name={o.name} tone={o.status === 'declined' ? 'slate' : 'sky'} />)}</div><small>{s.observers.length} người dự</small></div>
        </div>
    );
}

/* ---------------- chi tiết buổi dự giờ ---------------- */
type Detail = { data: Session; links: Record<string, string | null>; comments: { id: number; author: string; body: string; created_at: string; mine: boolean }[] };
export function SessionDrawer({ id, onClose, onChange }: { id: number; onClose: () => void; onChange: () => void }) {
    const { staff, toast, refresh } = useTa(); const { data, err, loading, reload } = useLoad(() => ob<Detail>(`sessions/${id}`), [id]);
    const [decline, setDecline] = useState(false); const [cancel, setCancel] = useState(false); const [edit, setEdit] = useState(false); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
    const done = () => { refresh(); reload(); onChange(); };
    const accept = async () => { setBusy(true); try { const r = await ob<{ message: string }>(`sessions/${id}/respond`, { method: 'POST', body: { action: 'accept' } }); toast(r.message); done(); } catch (e) { toast((e as Error).message, 'err'); } setBusy(false); };
    const send = async () => { if (!msg.trim()) return; setBusy(true); try { await ob(`sessions/${id}/comments`, { method: 'POST', body: { body: msg.trim() } }); setMsg(''); reload(); } catch (e) { toast((e as Error).message, 'err'); } setBusy(false); };
    const s = data?.data;
    return (
        <Drawer title={s ? s.title : 'Buổi dự giờ'} sub={s ? `${s.kind_label} · ${longDate(s.lesson_date)}` : undefined} onClose={onClose}>
            {loading && !s ? <Loading /> : err || !s || !data ? <ErrorBox msg={err || 'Không có dữ liệu'} retry={reload} /> : (<div className="ob-dr">
                <div className="ob-dr-h"><StatusPill s={s.status} /><Pill tone="slate">{relDay(s.lesson_date)}</Pill>{s.me.observed && <Pill tone="violet">Tôi được dự</Pill>}{s.me.observer && <Pill tone="indigo">Tôi dự giờ</Pill>}</div>
                {s.status === 'cancelled' && s.cancel_note && <div className="ob-note rose"><Ico n="alert" size={16} /><span>Đã hủy: {s.cancel_note}</span></div>}
                {s.status === 'declined' && <div className="ob-note rose"><Ico n="alert" size={16} /><span>Bị từ chối{s.cancel_note ? `: ${s.cancel_note}` : '.'}</span></div>}
                {s.status === 'pending' && <div className="ob-note amber"><Ico n="clock" size={16} /><span>{s.me.observed ? 'Đồng nghiệp đang chờ bạn xác nhận buổi dự giờ này.' : 'Đang chờ giáo viên được dự xác nhận.'}</span></div>}
                <dl className="ob-kv">
                    <div><dt>Giáo viên được dự</dt><dd>{s.observed_name}</dd></div><div><dt>Tiết dạy</dt><dd>{slotText(s)}</dd></div>
                    <div><dt>Môn / lớp</dt><dd>{s.subject || '—'}{s.class_name ? ` · lớp ${s.class_name}` : ''}</dd></div><div><dt>Địa điểm</dt><dd>{s.room || '—'}</dd></div>
                    <div><dt>Người tạo</dt><dd>{s.created_by_name || '—'}</dd></div><div><dt>Tạo lúc</dt><dd>{dt(s.created_at)}</dd></div>
                </dl>
                {s.objective && <div className="ob-sec"><h4>Mục đích quan sát</h4><p className="ob-pre">{s.objective}</p></div>}
                <div className="ob-sec"><h4>Người dự giờ</h4>
                    {s.observers.map((o) => (<div key={o.teacher_id} className="ob-person"><Avatar name={o.name} tone={o.status === 'declined' ? 'slate' : 'sky'} /><div><b>{o.name}</b><small>{o.status === 'accepted' ? 'Đã nhận lời' : o.status === 'invited' ? 'Chưa phản hồi' : `Từ chối${o.note ? `: ${o.note}` : ''}`}</small></div>
                        <div className="r">{o.eval_status === 'submitted' ? (<>{o.rating && <RatingPill rating={o.rating} percent={o.percent} />}{o.eval_id && (s.me.observed || ADMIN_ROLES.includes(staff.role)) && <Link href={`/teacher/observations/ket-qua?eval=${o.eval_id}`} className="ta-link">Xem phiếu</Link>}{o.eval_id && s.me.eval_id === o.eval_id && <Link href={`/teacher/observations/phieu?session=${s.id}`} className="ta-link">Phiếu của tôi</Link>}</>) : o.status === 'accepted' ? <Pill tone="gray">{o.eval_status === 'draft' ? 'Đang soạn phiếu' : 'Chưa có phiếu'}</Pill> : null}</div></div>))}
                </div>
                <div className="ob-sec"><h4>Liên kết hệ thống</h4><div className="ob-links">
                    <Link href="/teacher/schedule" className="ta-btn"><Ico n="cal" size={15} />Thời khóa biểu</Link>
                    {data.links.attendance && <Link href="/teacher/attendance" className="ta-btn"><Ico n="checks" size={15} />Điểm danh</Link>}
                    <Link href="/teacher/notifications/hop-thu" className="ta-btn"><Ico n="bell" size={15} />Hộp thư</Link></div></div>
                <div className="ob-sec"><h4>Trao đổi ({data.comments.length})</h4>
                    <div className="ob-cm">{data.comments.length === 0 && <p className="ta-mute">Chưa có trao đổi nào.</p>}{data.comments.map((c) => <div key={c.id} className={c.mine ? 'me' : ''}><b>{c.author}</b><span>{ago(c.created_at)}</span><p>{c.body}</p></div>)}</div>
                    <div className="ob-cmf"><input value={msg} placeholder="Nhắn cho những người trong buổi dự giờ…" maxLength={1500} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} /><Btn tone="primary" busy={busy} onClick={send}><Ico n="send" size={15} /></Btn></div></div>
                <div className="ob-acts">
                    {s.can_respond && <><Btn tone="success" busy={busy} onClick={accept}><Ico n="check" size={15} />{s.me.observed ? 'Đồng ý cho dự giờ' : 'Nhận lời dự giờ'}</Btn><Btn tone="danger" onClick={() => setDecline(true)}><Ico n="x" size={15} />Từ chối</Btn></>}
                    {s.can_evaluate && <Link href={`/teacher/observations/phieu?session=${s.id}`} className="ta-btn primary"><Ico n="pen" size={15} />{s.me.eval_status === 'submitted' ? 'Xem / sửa phiếu của tôi' : 'Điền phiếu nhận xét'}</Link>}
                    {s.can_edit && <><Btn onClick={() => setEdit(true)}><Ico n="edit" size={15} />Đổi lịch / sửa</Btn><Btn tone="danger" onClick={() => setCancel(true)}><Ico n="trash" size={15} />Hủy buổi</Btn></>}
                </div>
                {decline && <Confirm title="Từ chối buổi dự giờ" tone="danger" okText="Từ chối" noteLabel="Lý do từ chối" noteRequired text="Lý do sẽ được gửi tới người liên quan." onClose={() => setDecline(false)} onOk={async (note) => { const r = await ob<{ message: string }>(`sessions/${id}/respond`, { method: 'POST', body: { action: 'decline', note } }); toast(r.message); setDecline(false); done(); }} />}
                {cancel && <Confirm title="Hủy buổi dự giờ" tone="danger" okText="Hủy buổi" noteLabel="Lý do hủy" noteRequired text="Mọi người trong buổi dự giờ sẽ nhận thông báo." onClose={() => setCancel(false)} onOk={async (note) => { const r = await ob<{ message: string }>(`sessions/${id}/cancel`, { method: 'POST', body: { note } }); toast(r.message); setCancel(false); done(); }} />}
                {edit && <SessionForm edit={s} onClose={() => setEdit(false)} onDone={() => { setEdit(false); done(); }} />}
            </div>)}
        </Drawer>
    );
}