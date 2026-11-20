'use client';
// Nhắc việc cá nhân (/teacher/notifications/nhac-viec)
import Link from 'next/link';
import React, { useState } from 'react';
import { Btn, Confirm, Empty, ErrorBox, Field, Ico, Loading, Modal, Pill, Prio, PRIO, Tabs, ago, dt, inHours, isoToLocalInput, nextMonday, nt, todayAt, tomorrowAt, useLoad, useTa } from '../_nt';

type R = { id: number; title: string; body: string | null; priority: Prio; link: string | null; due_at: string | null; done_at: string | null; overdue: boolean; created_at: string };
type Res = { counts: { open: number; done: number }; data: R[] };
const QUICK: [string, () => string][] = [['Hôm nay 17h', () => todayAt(17)], ['Sau 2 giờ', () => inHours(2)], ['7h sáng mai', () => tomorrowAt(7)], ['Thứ Hai tuần sau', nextMonday]];

export default function Reminders() {
    const { toast, refresh } = useTa();
    const [tab, setTab] = useState<'open' | 'done' | 'all'>('open');
    const { data, err, loading, reload } = useLoad(() => nt<Res>(`reminders?tab=${tab}`), [tab]);
    const [title, setTitle] = useState(''); const [due, setDue] = useState(''); const [prio, setPrio] = useState<Prio>('normal'); const [busy, setBusy] = useState(false);
    const [edit, setEdit] = useState<R | null>(null); const [del, setDel] = useState<R | null>(null);
    const after = () => { refresh(); reload(); };
    const add = async () => {
        if (title.trim().length < 2) { toast('Hãy nhập nội dung nhắc việc.', 'err'); return; }
        setBusy(true);
        try { await nt('reminders', { method: 'POST', body: { title: title.trim(), due_at: due || null, priority: prio } }); toast('Đã thêm nhắc việc.'); setTitle(''); setDue(''); setPrio('normal'); after(); } catch (e) { toast((e as Error).message, 'err'); }
        setBusy(false);
    };
    const toggle = async (r: R) => { try { await nt(`reminders/${r.id}/done`, { method: 'POST', body: { done: !r.done_at } }); toast(r.done_at ? 'Đã mở lại nhắc việc.' : 'Đã hoàn thành. Làm tốt lắm!'); after(); } catch (e) { toast((e as Error).message, 'err'); } };
    return (
        <div className="ta-page">
            <div className="ta-card" style={{ padding: 18 }}>
                <div className="nt-quick">
                    <Field label="Việc cần nhớ"><input value={title} maxLength={200} placeholder="Ví dụ: Nộp giáo án tuần 12 cho tổ trưởng" onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} /></Field>
                    <Field label="Hạn (không bắt buộc)"><input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
                    <Field label="Mức độ"><select value={prio} onChange={(e) => setPrio(e.target.value as Prio)}>{(Object.keys(PRIO) as Prio[]).map((p) => <option key={p} value={p}>{PRIO[p].label}</option>)}</select></Field>
                    <Btn tone="primary" busy={busy} onClick={add}><Ico n="plus" size={16} />Thêm</Btn>
                </div>
                <div className="nt-tpl" style={{ marginTop: 10 }}><span className="ta-mute" style={{ alignSelf: 'center' }}>Hạn nhanh:</span>{QUICK.map(([l, f]) => <button key={l} type="button" className="nt-chip" onClick={() => setDue(f())}><Ico n="clock" size={13} />{l}</button>)}</div>
                <p className="ta-mute" style={{ marginTop: 8 }}>Khi nhắc việc sắp đến hạn (trong 24 giờ) hoặc quá hạn, hệ thống tự đưa vào Hộp thư để bạn không bỏ sót.</p>
            </div>
            <Tabs value={tab} onChange={setTab} items={[{ key: 'open', label: 'Đang mở', count: data?.counts.open, tone: 'rose' }, { key: 'done', label: 'Đã xong', count: data?.counts.done }, { key: 'all', label: 'Tất cả' }]} />
            <div className="ta-card">
                {loading && !data ? <Loading /> : err || !data ? <ErrorBox msg={err || 'Không có dữ liệu'} retry={reload} /> : data.data.length === 0 ? <Empty icon="clock" title={tab === 'done' ? 'Chưa có việc nào hoàn thành' : 'Không có nhắc việc nào'} text="Thêm việc cần nhớ ở khung phía trên." /> : data.data.map((r) => (
                    <div key={r.id} className={`nt-rem${r.done_at ? ' done' : ''}`}>
                        <button type="button" className="ck" onClick={() => toggle(r)} aria-label={r.done_at ? 'Mở lại' : 'Hoàn thành'}>{r.done_at && <Ico n="check" size={14} />}</button>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <b>{r.title}</b>{r.body && <p>{r.body}</p>}
                            <div className="rm">{r.due_at ? <Pill tone={r.overdue ? 'rose' : 'sky'} dot>{r.overdue ? 'Quá hạn' : 'Hạn'} {dt(r.due_at)} · {ago(r.due_at)}</Pill> : <Pill tone="slate">Không hạn</Pill>}{r.priority !== 'normal' && <Pill tone={PRIO[r.priority].tone}>{PRIO[r.priority].label}</Pill>}{r.done_at && <Pill tone="green">Xong {ago(r.done_at)}</Pill>}{r.link && <Link href={r.link} className="ta-link">Mở liên kết</Link>}</div>
                        </div>
                        <div className="act"><Btn size="sm" onClick={() => setEdit(r)}><Ico n="edit" size={14} />Sửa</Btn><Btn size="sm" tone="danger" onClick={() => setDel(r)}><Ico n="trash" size={14} /></Btn></div>
                    </div>))}
            </div>
            {edit && <EditModal r={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); toast('Đã cập nhật nhắc việc.'); after(); }} />}
            {del && <Confirm title="Xóa nhắc việc?" tone="danger" okText="Xóa" text={<>Xóa “{del.title}”? Thao tác không hoàn tác được.</>} onClose={() => setDel(null)} onOk={async () => { await nt(`reminders/${del.id}`, { method: 'DELETE' }); toast('Đã xóa nhắc việc.'); setDel(null); after(); }} />}
        </div>
    );
}

function EditModal({ r, onClose, onDone }: { r: R; onClose: () => void; onDone: () => void }) {
    const [title, setTitle] = useState(r.title); const [body, setBody] = useState(r.body || ''); const [due, setDue] = useState(isoToLocalInput(r.due_at)); const [prio, setPrio] = useState<Prio>(r.priority);
    const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
    const go = async () => { if (title.trim().length < 2) { setErr('Hãy nhập nội dung.'); return; } setBusy(true); try { await nt(`reminders/${r.id}`, { method: 'PUT', body: { title: title.trim(), body: body.trim() || null, due_at: due || null, priority: prio, link: r.link } }); onDone(); } catch (e) { setErr((e as Error).message); setBusy(false); } };
    return (
        <Modal title="Sửa nhắc việc" onClose={onClose} foot={<><Btn onClick={onClose}>Hủy</Btn><Btn tone="primary" busy={busy} onClick={go}>Lưu</Btn></>}>
            <Field label="Việc cần nhớ *"><input autoFocus value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} /></Field>
            <Field label="Ghi chú"><textarea rows={3} value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} /></Field>
            <div className="fi-twocol" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Hạn"><input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
                <Field label="Mức độ"><select value={prio} onChange={(e) => setPrio(e.target.value as Prio)}>{(Object.keys(PRIO) as Prio[]).map((p) => <option key={p} value={p}>{PRIO[p].label}</option>)}</select></Field>
            </div>
            {err && <p className="ta-ferr">{err}</p>}
        </Modal>
    );
}