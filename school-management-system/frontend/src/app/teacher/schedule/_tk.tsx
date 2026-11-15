'use client';
// Thư viện dùng chung cho module Thời khóa biểu giáo viên (/teacher/schedule)
import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { Btn, Drawer, Empty, ErrorBox, Field, Ico, LS, Loading, Modal, Pill, Seg, Switch, addDays, fmtD, fmtS, longDate, num, tapi, todayStr, useLoad, useTa, weekday } from '../attendance/_ta';
import { lessonHref } from '../attendance/_lesson';

/** Gọi API thời khóa biểu của giáo viên: /api/gv/teacher/tt/... (trả về nguyên JSON máy chủ) */
export const tk = <T,>(path: string, o: { method?: string; body?: unknown } = {}) => tapi<unknown>(`gv/teacher/tt/${path}`, o) as unknown as Promise<T>;

/* ---------------- kiểu dữ liệu ---------------- */
export type Period = { id: number; start: string | null; end: string | null };
export type Att = { marked: number; locked: boolean; state: 'todo' | 'draft' | 'ready' | 'locked' };
export type ReqKind = 'swap' | 'makeup' | 'absent' | 'room';
export type NoteLite = { id: number; kind: string; title: string | null; content: string | null; color: string; pinned: boolean; date: string | null };
export type Slot = {
    weekday: number; period: number; cs: number; class_id: number; class_name: string; grade: number; subject_id: number; subject: string; code: string | null; total: number;
    date: string; start: string | null; end: string | null; room: string | null; phase: 'upcoming' | 'ongoing' | 'ended'; att: Att;
    notes: NoteLite[]; request: { id: number; kind: ReqKind; status: string; to_date: string | null; to_period: number | null } | null; moved: boolean; extra?: boolean;
};
export type Teacher = { id: number; name: string; homeroom: { id: number; name: string; grade: number } | null };
export type WeekRes = { teacher: Teacher; today: string; from: string; to: string; periods: Period[]; data: Slot[] };

export const REQ: Record<ReqKind, { label: string; tone: string; icon: string; hint: string }> = {
    swap: { label: 'Đổi tiết', tone: 'indigo', icon: 'refresh', hint: 'Chuyển tiết này sang một tiết trống khác' },
    makeup: { label: 'Dạy bù', tone: 'teal', icon: 'plus', hint: 'Dạy bù cho tiết nghỉ vào một tiết trống' },
    absent: { label: 'Xin nghỉ tiết', tone: 'amber', icon: 'flag', hint: 'Báo nghỉ tiết này để nhà trường sắp xếp' },
    room: { label: 'Đổi phòng', tone: 'violet', icon: 'pin', hint: 'Đề nghị đổi phòng học cho buổi này' },
};
export const REQ_ST: Record<string, { label: string; tone: string }> = {
    pending: { label: 'Chờ duyệt', tone: 'amber' }, approved: { label: 'Đã duyệt', tone: 'green' }, rejected: { label: 'Từ chối', tone: 'rose' }, cancelled: { label: 'Đã hủy', tone: 'slate' },
};
export const NOTE_COLORS = ['sky', 'indigo', 'green', 'amber', 'rose', 'violet', 'teal', 'slate'];

/* ---------------- màu theo môn ---------------- */
const SUBJ: [string, string][] = [['#0284c7', '#e0f2fe'], ['#4f46e5', '#e0e7ff'], ['#059669', '#d1fae5'], ['#d97706', '#fef3c7'], ['#e11d48', '#ffe4e9'], ['#7c3aed', '#ede9fe'], ['#0d9488', '#ccfbf1'], ['#ea580c', '#ffedd5']];
export const subjStyle = (id: number): React.CSSProperties => { const [c, cs] = SUBJ[Math.abs(id) % SUBJ.length]; return { ['--c' as string]: c, ['--cs' as string]: cs } as React.CSSProperties; };

/* ---------------- thời gian ---------------- */
export const DAYS = [2, 3, 4, 5, 6, 7];
export const dayName = (w: number) => `Thứ ${w}`;
export const timeText = (s: { start: string | null; end: string | null; period: number }) => (s.start && s.end ? `${s.start} – ${s.end}` : `Tiết ${s.period}`);
export const minsUntil = (date: string, hm: string | null) => (hm ? Math.round((new Date(`${date}T${hm}:00`).getTime() - Date.now()) / 60000) : 0);
export const fromNow = (m: number) => (m <= 0 ? 'đang diễn ra' : m < 60 ? `sau ${m} phút` : m < 1440 ? `sau ${Math.floor(m / 60)} giờ ${m % 60 ? (m % 60) + ' phút' : ''}`.trim() : `sau ${Math.round(m / 1440)} ngày`);
export function useNow(ms = 30000) {
    const [n, setN] = useState(() => new Date());
    useEffect(() => { const t = setInterval(() => setN(new Date()), ms); return () => clearInterval(t); }, [ms]);
    return n;
}
export const PHASE: Record<Slot['phase'], { label: string; tone: string }> = { upcoming: { label: 'Sắp tới', tone: 'sky' }, ongoing: { label: 'Đang diễn ra', tone: 'green' }, ended: { label: 'Đã qua', tone: 'slate' } };

/** Trạng thái điểm danh của 1 tiết (chỉ có nghĩa khi tiết đã/đang diễn ra) */
export function AttPill({ s }: { s: Slot }) {
    if (s.phase === 'upcoming' || s.extra) return null;
    const x = LS[s.att.state === 'locked' ? 'locked' : s.att.state];
    return <Pill tone={x.tone} dot>{x.label}</Pill>;
}

/* ---------------- xuất lịch .ics ---------------- */
export function downloadIcs(slots: Slot[], name: string) {
    const z = (s: string, hm: string) => `${s.replace(/-/g, '')}T${hm.replace(':', '')}00`;
    const esc = (t: string) => t.replace(/[\;,]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//THPT Ngo Sy Lien//Thoi khoa bieu//VI', 'CALSCALE:GREGORIAN', 'X-WR-TIMEZONE:Asia/Ho_Chi_Minh'];
    slots.filter((s) => s.start && s.end && !(s.moved)).forEach((s) => {
        L.push('BEGIN:VEVENT', `UID:tkb-${s.cs}-${s.date}-${s.period}@school`, `DTSTAMP:${z(todayStr(), '00:00')}`,
            `DTSTART;TZID=Asia/Ho_Chi_Minh:${z(s.date, s.start!)}`, `DTEND;TZID=Asia/Ho_Chi_Minh:${z(s.date, s.end!)}`,
            `SUMMARY:${esc(`${s.subject} – ${s.class_name}`)}`, `LOCATION:${esc(s.room || '')}`, `DESCRIPTION:${esc(`Tiết ${s.period} · ${s.total} học sinh`)}`,
            'BEGIN:VALARM', 'TRIGGER:-PT10M', 'ACTION:DISPLAY', 'DESCRIPTION:Sắp đến giờ dạy', 'END:VALARM', 'END:VEVENT');
    });
    L.push('END:VCALENDAR');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([L.join('\r\n')], { type: 'text/calendar;charset=utf-8' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------------- thẻ tiết học (trong lưới & danh sách) ---------------- */
export function SlotCard({ s, onClick, compact }: { s: Slot; onClick: () => void; compact?: boolean }) {
    const r = s.request;
    return (
        <button type="button" style={subjStyle(s.subject_id)} onClick={onClick}
                className={`ts-slot ${s.phase}${s.moved ? ' moved' : ''}${s.extra ? ' extra' : ''}${compact ? ' compact' : ''}`} title={`${s.subject} – ${s.class_name}`}>
            <b>{s.subject}</b>
            <span>{s.class_name}{s.room ? ` · ${s.room}` : ''}</span>
            {!compact && (
                <em>
                    {s.phase === 'ongoing' && <i className="live">Đang dạy</i>}
                    {s.extra && <i className="x">Dạy bù/đổi</i>}
                    {r && r.status === 'pending' && <i className="p">Chờ duyệt: {REQ[r.kind].label}</i>}
                    {r && r.status === 'approved' && s.moved && <i className="m">{r.kind === 'absent' ? 'Nghỉ tiết' : 'Đã chuyển'}</i>}
                    {s.phase !== 'upcoming' && !s.extra && !s.moved && <i className={`a ${s.att.state}`}>{s.att.state === 'locked' ? 'Đã khóa' : s.att.state === 'todo' ? 'Chưa điểm danh' : s.att.state === 'ready' ? 'Chờ gửi' : 'Nháp'}</i>}
                </em>
            )}
        </button>
    );
}

/* ---------------- chọn 1 tiết theo ngày ---------------- */
export function PickSlot({ title = 'Chọn tiết học', onPick, onClose, from }: { title?: string; onPick: (s: Slot) => void; onClose: () => void; from?: string }) {
    const [date, setDate] = useState(from || todayStr());
    const { data, err, loading, reload } = useLoad(() => tk<WeekRes>(`week?date=${date}`), [date]);
    const list = (data?.data || []).filter((s) => s.date === date && !s.extra);
    return (
        <Modal title={title} onClose={onClose} wide>
            <div className="ts-pick-top">
                <button className="ta-btn sm" onClick={() => setDate(addDays(date, -1))}>‹</button>
                <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
                <button className="ta-btn sm" onClick={() => setDate(addDays(date, 1))}>›</button>
                <b>{longDate(date)}</b>
            </div>
            {loading && !data ? <Loading /> : err ? <ErrorBox msg={err} retry={reload} /> : list.length === 0
                ? <Empty icon="cal" title="Ngày này bạn không có tiết dạy" text="Hãy chọn ngày khác (thứ 2 đến thứ 7)." />
                : <ul className="ts-pick">{list.map((s) => (
                    <li key={`${s.cs}-${s.period}`}><button style={subjStyle(s.subject_id)} onClick={() => onPick(s)}>
                        <span className="pn">Tiết {s.period}</span><span className="tx"><b>{s.subject}</b><small>{s.class_name} · {timeText(s)}{s.room ? ` · ${s.room}` : ''}</small></span><Ico n="chevR" size={16} /></button></li>
                ))}</ul>}
        </Modal>
    );
}

/* ---------------- gửi yêu cầu đổi tiết / dạy bù / nghỉ / đổi phòng ---------------- */
type Sug = { date: string; weekday: number; period: number; start: string | null; end: string | null };
export function RequestModal({ slot, initialKind = 'swap', onClose, onDone }: { slot: Slot; initialKind?: ReqKind; onClose: () => void; onDone: () => void }) {
    const { toast } = useTa();
    const [kind, setKind] = useState<ReqKind>(initialKind);
    const [reason, setReason] = useState(''); const [room, setRoom] = useState('');
    const [pick, setPick] = useState<Sug | null>(null);
    const [sug, setSug] = useState<Sug[] | null>(null); const [sugErr, setSugErr] = useState('');
    const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
    const needSlot = kind === 'swap' || kind === 'makeup';
    useEffect(() => {
        if (!needSlot || sug) return;
        tk<{ data: Sug[] }>(`suggest?class_subject_id=${slot.cs}`).then((r) => setSug(r.data || [])).catch((e: Error) => setSugErr(e.message));
    }, [needSlot, sug, slot.cs]);
    const byDate: Record<string, Sug[]> = {}; (sug || []).forEach((x) => { (byDate[x.date] ||= []).push(x); });
    const go = async () => {
        setErr('');
        if (needSlot && !pick) { setErr('Hãy chọn một tiết trống để chuyển sang.'); return; }
        if (kind === 'room' && !room.trim()) { setErr('Hãy nhập phòng học mới.'); return; }
        if (reason.trim().length < 5) { setErr('Hãy nhập lý do (ít nhất 5 ký tự).'); return; }
        setBusy(true);
        try {
            await tk('requests', { method: 'POST', body: { kind, class_subject_id: slot.cs, date: slot.date, period: slot.period, to_date: pick?.date, to_period: pick?.period, to_room: room.trim() || undefined, reason: reason.trim() } });
            toast('Đã gửi yêu cầu đến nhà trường. Bạn sẽ thấy kết quả ở mục Yêu cầu.'); onDone();
        } catch (e) { setErr((e as Error).message); setBusy(false); }
    };
    return (
        <Modal wide title="Gửi yêu cầu thay đổi tiết học" onClose={onClose} foot={<><Btn onClick={onClose}>Hủy</Btn><Btn tone="primary" busy={busy} onClick={go}><Ico n="send" size={15} />Gửi nhà trường</Btn></>}>
            <div className="ts-src" style={subjStyle(slot.subject_id)}><b>{slot.subject} · {slot.class_name}</b><span>{longDate(slot.date)} · Tiết {slot.period} ({timeText(slot)})</span></div>
            <div className="ts-kinds">{(Object.keys(REQ) as ReqKind[]).map((k) => (
                <button key={k} type="button" className={`t-${REQ[k].tone}${kind === k ? ' on' : ''}`} onClick={() => { setKind(k); setErr(''); }}><Ico n={REQ[k].icon} size={17} /><b>{REQ[k].label}</b><small>{REQ[k].hint}</small></button>
            ))}</div>
            {needSlot && (
                <div className="ts-sugbox"><h4>Chọn tiết trống (giáo viên và lớp đều không có tiết)</h4>
                    {sugErr ? <p className="ta-ferr">{sugErr}</p> : !sug ? <Loading text="Đang tìm tiết trống…" /> : sug.length === 0 ? <p className="ta-mute">Không tìm thấy tiết trống phù hợp trong 3 tuần tới.</p>
                        : Object.entries(byDate).map(([d, xs]) => (
                            <div key={d} className="ts-sugrow"><span>{weekday(d) === 'CN' ? 'CN' : 'Thứ ' + weekday(d).slice(1)} {fmtS(d)}</span>
                                <div>{xs.map((x) => <button key={x.period} type="button" className={pick && pick.date === x.date && pick.period === x.period ? 'on' : ''} onClick={() => setPick(x)}>Tiết {x.period}{x.start ? ` · ${x.start}` : ''}</button>)}</div></div>
                        ))}
                </div>
            )}
            {kind === 'room' && <Field label="Phòng học đề nghị *"><input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Ví dụ: Phòng Tin học 2, Phòng 305…" maxLength={40} /></Field>}
            <Field label="Lý do *"><textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Ví dụ: Đi tập huấn chuyên môn, họp hội đồng, việc gia đình đột xuất…" /></Field>
            {err && <p className="ta-ferr">{err}</p>}
        </Modal>
    );
}

/* ---------------- ghi chú / giáo án ---------------- */
export function NoteModal({ slot, note, onClose, onDone }: { slot: Pick<Slot, 'cs' | 'weekday' | 'period' | 'date' | 'subject' | 'class_name'>; note?: NoteLite | null; onClose: () => void; onDone: () => void }) {
    const { toast } = useTa();
    const [kind, setKind] = useState(note?.kind === 'plan' ? 'plan' : 'note');
    const [title, setTitle] = useState(note?.title || ''); const [content, setContent] = useState(note?.content || '');
    const [color, setColor] = useState(note?.color || 'sky'); const [pinned, setPinned] = useState(!!note?.pinned);
    const [scope, setScope] = useState(note && !note.date ? 'weekly' : 'once');
    const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
    const go = async () => {
        if (!title.trim() && !content.trim()) { setErr('Hãy nhập tiêu đề hoặc nội dung.'); return; }
        setBusy(true);
        try {
            await tk('notes', { method: 'POST', body: { id: note?.id, class_subject_id: slot.cs, weekday: slot.weekday, period: slot.period, date: scope === 'once' ? slot.date : null, kind, title: title.trim() || null, content: content.trim() || null, color, pinned } });
            toast('Đã lưu ghi chú.'); onDone();
        } catch (e) { setErr((e as Error).message); setBusy(false); }
    };
    return (
        <Modal title={note ? 'Sửa ghi chú' : 'Thêm ghi chú cho tiết học'} onClose={onClose} foot={<><Btn onClick={onClose}>Hủy</Btn><Btn tone="primary" busy={busy} onClick={go}><Ico n="save" size={15} />Lưu</Btn></>}>
            <p className="ta-mute" style={{ marginBottom: 12 }}>{slot.subject} · {slot.class_name} · {dayName(slot.weekday)}, tiết {slot.period}</p>
            <Seg value={kind} onChange={setKind} items={[['note', 'Ghi chú'], ['plan', 'Giáo án / nội dung bài']]} />
            <Field label="Tiêu đề"><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder={kind === 'plan' ? 'Ví dụ: Bài 12 – Phương trình bậc hai' : 'Ví dụ: Mang máy chiếu'} /></Field>
            <Field label="Nội dung"><textarea rows={5} value={content} onChange={(e) => setContent(e.target.value)} maxLength={5000} /></Field>
            <div className="ts-row2">
                <div><span className="ts-lbl">Áp dụng</span><Seg value={scope} onChange={setScope} items={[['once', `Chỉ ngày ${fmtS(slot.date)}`], ['weekly', 'Mọi tuần']]} /></div>
                <div><span className="ts-lbl">Màu</span><div className="ts-colors">{NOTE_COLORS.map((c) => <button key={c} type="button" className={`t-${c}${color === c ? ' on' : ''}`} onClick={() => setColor(c)} aria-label={c} />)}</div></div>
            </div>
            <Switch on={pinned} onChange={setPinned} label="Ghim lên đầu" sub="Ghi chú ghim luôn hiện trước" />
            {err && <p className="ta-ferr">{err}</p>}
        </Modal>
    );
}

export function RoomModal({ slot, onClose, onDone }: { slot: Slot; onClose: () => void; onDone: () => void }) {
    const { toast } = useTa();
    const [room, setRoom] = useState(slot.room || ''); const [scope, setScope] = useState('weekly'); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
    const go = async () => {
        if (!room.trim()) { setErr('Hãy nhập tên phòng học.'); return; }
        setBusy(true);
        try { await tk('notes', { method: 'POST', body: { class_subject_id: slot.cs, weekday: slot.weekday, period: slot.period, date: scope === 'once' ? slot.date : null, kind: 'room', room: room.trim() } }); toast('Đã cập nhật phòng học.'); onDone(); }
        catch (e) { setErr((e as Error).message); setBusy(false); }
    };
    return (
        <Modal title="Phòng học của tiết này" onClose={onClose} foot={<><Btn onClick={onClose}>Hủy</Btn><Btn tone="primary" busy={busy} onClick={go}>Lưu</Btn></>}>
            <p className="ta-mute" style={{ marginBottom: 12 }}>Chỉ hiển thị trên lịch của bạn. Muốn nhà trường đổi phòng chính thức, hãy dùng “Yêu cầu → Đổi phòng”.</p>
            <Field label="Tên phòng"><input autoFocus value={room} onChange={(e) => setRoom(e.target.value)} maxLength={40} placeholder="Ví dụ: 203, Phòng Lab 1…" /></Field>
            <Seg value={scope} onChange={setScope} items={[['weekly', 'Mọi tuần'], ['once', `Chỉ ngày ${fmtS(slot.date)}`]]} />
            {err && <p className="ta-ferr">{err}</p>}
        </Modal>
    );
}

/* ---------------- ngăn chi tiết 1 tiết ---------------- */
export function SlotDrawer({ slot, onClose, onChanged }: { slot: Slot; onClose: () => void; onChanged: () => void }) {
    const [m, setM] = useState<null | { t: 'req'; k: ReqKind } | { t: 'note' } | { t: 'room' }>(null);
    const future = slot.date >= todayStr();
    const done = () => { setM(null); onChanged(); };
    const r = slot.request;
    return (
        <>
            <Drawer onClose={onClose} title={slot.subject} sub={`${slot.class_name} · ${longDate(slot.date)}`}
                    foot={<Link href={lessonHref({ class_subject_id: slot.cs, period: slot.period, date: slot.date }, slot.date)} className={`ta-btn ${slot.att.locked ? '' : 'primary'}`}><Ico n="checks" size={16} />{slot.att.locked ? 'Xem điểm danh tiết này' : 'Điểm danh tiết này'}</Link>}>
                <div className="ts-dr" style={subjStyle(slot.subject_id)}>
                    <div className="ts-dr-hero"><span>Tiết {slot.period}</span><b>{timeText(slot)}</b><em>{slot.room ? `Phòng ${slot.room}` : 'Chưa nhập phòng học'}</em></div>
                    <div className="ts-dr-tags"><Pill tone={PHASE[slot.phase].tone} dot>{PHASE[slot.phase].label}</Pill><AttPill s={slot} />{slot.extra && <Pill tone="teal">Tiết dạy bù/đổi</Pill>}</div>
                    {r && <div className={`ts-banner t-${REQ_ST[r.status]?.tone || 'gray'}`}><Ico n={REQ[r.kind].icon} size={16} /><span><b>{REQ[r.kind].label} – {REQ_ST[r.status]?.label}</b>{r.to_date && <small> → {fmtD(r.to_date)}, tiết {r.to_period}</small>}</span></div>}
                    <dl className="ts-dl"><div><dt>Lớp</dt><dd>{slot.class_name} (khối {slot.grade})</dd></div><div><dt>Sĩ số</dt><dd>{num(slot.total)} học sinh</dd></div>
                        <div><dt>Đã điểm danh</dt><dd>{slot.phase === 'upcoming' ? '—' : `${slot.att.marked}/${slot.total}`}</dd></div></dl>
                    <div className="ts-acts">
                        <button onClick={() => setM({ t: 'room' })}><Ico n="pin" size={16} />Phòng học</button>
                        <button onClick={() => setM({ t: 'note' })}><Ico n="pen" size={16} />Thêm ghi chú</button>
                        <Link href={`/teacher/schedule/lop?c=${slot.class_id}`}><Ico n="users" size={16} />TKB của lớp</Link>
                        <Link href="/teacher/attendance/lich-su"><Ico n="lock" size={16} />Lịch sử điểm danh</Link>
                    </div>
                    {future && !slot.moved && !slot.extra && (
                        <><h4 className="ts-h4">Cần thay đổi?</h4>
                            <div className="ts-reqbtn">{(Object.keys(REQ) as ReqKind[]).map((k) => (
                                <button key={k} className={`t-${REQ[k].tone}`} disabled={!!r && r.status === 'pending'} onClick={() => setM({ t: 'req', k })}><Ico n={REQ[k].icon} size={15} />{REQ[k].label}</button>))}</div>
                            {r && r.status === 'pending' && <p className="ta-mute">Tiết này đang có yêu cầu chờ duyệt.</p>}</>
                    )}
                    <h4 className="ts-h4">Ghi chú & giáo án ({slot.notes.length})</h4>
                    {slot.notes.length === 0 ? <p className="ta-mute">Chưa có ghi chú cho tiết này.</p> : <ul className="ts-notes-mini">{slot.notes.map((n) => (
                        <li key={n.id} className={`t-${n.color}`}><b>{n.pinned && '📌 '}{n.title || (n.kind === 'plan' ? 'Giáo án' : 'Ghi chú')}</b>{n.content && <p>{n.content}</p>}<small>{n.date ? `Ngày ${fmtD(n.date)}` : 'Mọi tuần'}</small></li>))}</ul>}
                </div>
            </Drawer>
            {m?.t === 'req' && <RequestModal slot={slot} initialKind={m.k} onClose={() => setM(null)} onDone={done} />}
            {m?.t === 'note' && <NoteModal slot={slot} onClose={() => setM(null)} onDone={done} />}
            {m?.t === 'room' && <RoomModal slot={slot} onClose={() => setM(null)} onDone={done} />}
        </>
    );
}

/* ---------------- thời khóa biểu cả lớp ---------------- */
type ClassTb = { class: { id: number; name: string; grade: number; homeroom: string | null; total: number }; periods: Period[]; mine: number; data: { weekday: number; period: number; subject: string; code: string | null; teacher_id: number; teacher: string | null; cs: number }[] };
export function ClassTable({ id }: { id: number }) {
    const { data, err, loading, reload } = useLoad(() => tk<ClassTb>(`class/${id}`), [id]);
    if (loading && !data) return <Loading />;
    if (err || !data) return <ErrorBox msg={err || 'Không có dữ liệu'} retry={reload} />;
    const cell = (w: number, p: number) => data.data.filter((x) => x.weekday === w && x.period === p);
    const hue = (s: string) => Array.from(s).reduce((a, c) => a + c.charCodeAt(0), 0);
    return (
        <div>
            <p className="ta-mute" style={{ marginBottom: 10 }}>Lớp {data.class.name} · {num(data.class.total)} học sinh{data.class.homeroom ? ` · GVCN: ${data.class.homeroom}` : ''}</p>
            <div className="ts-mini"><table>
                <thead><tr><th />{DAYS.map((w) => <th key={w}>{dayName(w)}</th>)}</tr></thead>
                <tbody>{data.periods.map((p) => (
                    <tr key={p.id}><th>Tiết {p.id}{p.start && <small>{p.start}</small>}</th>
                        {DAYS.map((w) => <td key={w}>{cell(w, p.id).map((x) => (
                            <div key={x.cs} className={x.teacher_id === data.mine ? 'mine' : ''} style={subjStyle(hue(x.subject))}><b>{x.subject}</b><small>{x.teacher || ''}</small></div>))}</td>)}</tr>))}
                </tbody></table></div>
            <p className="ta-mute" style={{ marginTop: 8 }}><span className="ts-dot" /> Viền đậm là tiết do bạn dạy.</p>
        </div>
    );
}