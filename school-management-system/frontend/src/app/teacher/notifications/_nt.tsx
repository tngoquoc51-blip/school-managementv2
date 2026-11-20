'use client';
// Thư viện dùng chung cho Trung tâm thông báo giáo viên (/teacher/notifications)
import Link from 'next/link';
import React, { useState } from 'react';
import { Btn, Confirm, Drawer, Empty, ErrorBox, Field, Ico, Loading, Modal, Pager, Pill, Seg, Switch, Tabs, ago, dt, fmtD, longDate, num, qs, tapi, todayStr, useDebounced, useLoad, useTa } from '../attendance/_ta';

export { Btn, Confirm, Drawer, Empty, ErrorBox, Field, Ico, Loading, Modal, Pager, Pill, Seg, Switch, Tabs, ago, dt, fmtD, longDate, num, qs, todayStr, useDebounced, useLoad, useTa };

/** Gọi API thông báo giáo viên: /api/gv/teacher/nt/... (trả về nguyên JSON máy chủ) */
export const nt = <T,>(path: string, o: { method?: string; body?: unknown } = {}) => tapi<unknown>(`gv/teacher/nt/${path}`, o) as unknown as Promise<T>;

/* ---------------- kiểu dữ liệu ---------------- */
export type Kind = 'announcement' | 'schedule' | 'attendance' | 'exam' | 'finance' | 'event' | 'system' | 'reminder';
export type Prio = 'normal' | 'high' | 'urgent';
export type Item = {
    key: string; src: 'stored' | 'auto'; id: number | null; kind: Kind; priority: Prio; title: string; body: string | null; link: string | null; sender: string; sender_role: string | null;
    pinned: boolean; created_at: string; due_at: string | null; read: boolean; starred: boolean; archived: boolean; snoozed: boolean; snooze_until: string | null;
};
export type Counts = { all: number; unread: number; starred: number; snoozed: number; archived: number; urgent?: number; high?: number };
export type Page = { total: number; page: number; per: number; pages: number };

export const KIND: Record<Kind, { label: string; icon: string; c: string; cs: string }> = {
    announcement: { label: 'Thông báo', icon: 'mega', c: '#4f46e5', cs: '#e0e7ff' },
    schedule: { label: 'Thời khóa biểu', icon: 'cal', c: '#0284c7', cs: '#e0f2fe' },
    attendance: { label: 'Điểm danh', icon: 'checks', c: '#0d9488', cs: '#ccfbf1' },
    exam: { label: 'Kiểm tra – thi', icon: 'scroll', c: '#d97706', cs: '#fef3c7' },
    finance: { label: 'Tài chính', icon: 'coin', c: '#059669', cs: '#d1fae5' },
    event: { label: 'Sự kiện', icon: 'flag', c: '#7c3aed', cs: '#ede9fe' },
    system: { label: 'Hệ thống', icon: 'cog', c: '#475569', cs: '#e2e8f0' },
    reminder: { label: 'Nhắc việc', icon: 'clock', c: '#e11d48', cs: '#ffe4e9' },
};
export const KINDS = Object.keys(KIND) as Kind[];
export const PRIO: Record<Prio, { label: string; tone: string }> = { normal: { label: 'Bình thường', tone: 'slate' }, high: { label: 'Quan trọng', tone: 'amber' }, urgent: { label: 'Khẩn cấp', tone: 'rose' } };

export function KindIcon({ kind, size = 38 }: { kind: Kind; size?: number }) {
    const k = KIND[kind] || KIND.announcement;
    return <span className="nt-kic" style={{ width: size, height: size, background: k.cs, color: k.c }}><Ico n={k.icon} size={Math.round(size * 0.5)} /></span>;
}
export function Star({ on, size = 17 }: { on: boolean; size?: number }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill={on ? '#f59e0b' : 'none'} stroke={on ? '#f59e0b' : 'currentColor'} strokeWidth="1.8" strokeLinejoin="round"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z" /></svg>;
}
export const PrioPill = ({ p }: { p: Prio }) => (p === 'normal' ? null : <Pill tone={PRIO[p].tone} dot>{PRIO[p].label}</Pill>);

/* ---------------- thời gian ---------------- */
const d0 = (s: string) => new Date(s);
export const groupOf = (iso: string): string => {
    const d = d0(iso); if (isNaN(d.getTime())) return 'Cũ hơn';
    const t = new Date(); const sod = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((sod(t) - sod(d)) / 86400000);
    return diff <= 0 ? 'Hôm nay' : diff === 1 ? 'Hôm qua' : diff < 7 ? 'Tuần này' : diff < 31 ? 'Tháng này' : 'Cũ hơn';
};
/** chuỗi giờ địa phương cho input datetime-local */
export const localInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
export const isoToLocalInput = (iso: string | null) => (iso ? localInput(new Date(iso)) : '');
export const inHours = (h: number) => localInput(new Date(Date.now() + h * 3600000));
export const tomorrowAt = (h: number) => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(h, 0, 0, 0); return localInput(d); };
export const todayAt = (h: number) => { const d = new Date(); d.setHours(h, 0, 0, 0); return localInput(d); };
export const nextMonday = () => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); d.setHours(7, 0, 0, 0); return localInput(d); };
export const preview = (s: string | null, n = 110) => { const t = (s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

/* ---------------- hành động trạng thái ---------------- */
export type Act = 'read' | 'unread' | 'star' | 'unstar' | 'archive' | 'unarchive' | 'snooze' | 'unsnooze';
export const act = (keys: string[], action: Act, extra: { minutes?: number; until?: string } = {}) => nt<{ message: string }>('state', { method: 'POST', body: { keys, action, ...extra } });

export const SNOOZE: [string, () => { minutes?: number; until?: string }][] = [
    ['30 phút nữa', () => ({ minutes: 30 })], ['1 giờ nữa', () => ({ minutes: 60 })], ['3 giờ nữa', () => ({ minutes: 180 })],
    ['7h sáng mai', () => ({ until: tomorrowAt(7) })], ['Thứ Hai tuần sau', () => ({ until: nextMonday() })],
];

/** Hộp chọn thời điểm nhắc lại */
export function SnoozeModal({ keys, onClose, onDone }: { keys: string[]; onClose: () => void; onDone: () => void }) {
    const { toast } = useTa(); const [custom, setCustom] = useState(inHours(2)); const [busy, setBusy] = useState(false);
    const go = async (extra: { minutes?: number; until?: string }) => { setBusy(true); try { await act(keys, 'snooze', extra); toast('Đã tạm hoãn. Thông báo sẽ hiện lại đúng giờ.'); onDone(); } catch (e) { toast((e as Error).message, 'err'); setBusy(false); } };
    return (
        <Modal title="Nhắc lại sau…" onClose={onClose} foot={<><Btn onClick={onClose}>Đóng</Btn><Btn tone="primary" busy={busy} onClick={() => go({ until: custom })}><Ico n="clock" size={15} />Hẹn giờ này</Btn></>}>
            <div className="nt-snz">{SNOOZE.map(([l, f]) => <button key={l} type="button" disabled={busy} onClick={() => go(f())}><Ico n="clock" size={16} />{l}</button>)}</div>
            <Field label="Hoặc chọn thời điểm khác"><input type="datetime-local" value={custom} min={localInput(new Date())} onChange={(e) => setCustom(e.target.value)} /></Field>
        </Modal>
    );
}

/* ---------------- chi tiết một thông báo ---------------- */
export function ItemDetail({ it, onChange, onClose, compact }: { it: Item; onChange: () => void; onClose?: () => void; compact?: boolean }) {
    const { toast, refresh } = useTa(); const [snz, setSnz] = useState(false); const [busy, setBusy] = useState(false);
    const run = async (a: Act, msg: string) => { setBusy(true); try { await act([it.key], a); toast(msg); refresh(); onChange(); } catch (e) { toast((e as Error).message, 'err'); } setBusy(false); };
    const k = KIND[it.kind] || KIND.announcement;
    return (
        <article className={`nt-detail${compact ? ' compact' : ''}`}>
            <header>
                <KindIcon kind={it.kind} size={48} />
                <div className="nt-dh">
                    <div className="nt-dtags"><Pill tone="slate">{k.label}</Pill><PrioPill p={it.priority} />{it.pinned && <Pill tone="indigo"><Ico n="pin" size={12} /> Ghim</Pill>}{it.src === 'auto' && <Pill tone="teal"><Ico n="spark" size={12} /> Tự động</Pill>}</div>
                    <h2>{it.title}</h2>
                    <p className="nt-dmeta"><Ico n="user" size={14} />{it.sender}{it.sender_role && it.sender_role !== 'system' ? '' : ''} · {dt(it.created_at)} · {ago(it.created_at)}</p>
                </div>
                {onClose && <button type="button" className="nt-x" onClick={onClose} aria-label="Đóng"><Ico n="x" size={18} /></button>}
            </header>
            {it.due_at && <div className="nt-due"><Ico n="clock" size={16} /><span>Hạn: <b>{dt(it.due_at)}</b> ({ago(it.due_at)})</span></div>}
            {it.snoozed && it.snooze_until && <div className="nt-due snz"><Ico n="clock" size={16} /><span>Đang tạm hoãn, sẽ hiện lại lúc <b>{dt(it.snooze_until)}</b></span><button type="button" onClick={() => run('unsnooze', 'Đã bỏ tạm hoãn.')}>Bỏ hoãn</button></div>}
            <div className="nt-body">{(it.body || 'Không có nội dung chi tiết.').split(/\n+/).map((p, i) => <p key={i}>{p}</p>)}</div>
            <footer>
                {it.link && <Link href={it.link} className="ta-btn primary"><Ico n="link" size={15} />Mở chức năng liên quan</Link>}
                <Btn busy={busy} onClick={() => run(it.read ? 'unread' : 'read', it.read ? 'Đã đánh dấu chưa đọc.' : 'Đã đánh dấu đã đọc.')}><Ico n={it.read ? 'eye' : 'check'} size={15} />{it.read ? 'Chưa đọc' : 'Đã đọc'}</Btn>
                <Btn busy={busy} onClick={() => run(it.starred ? 'unstar' : 'star', it.starred ? 'Đã bỏ gắn sao.' : 'Đã gắn sao.')}><Star on={it.starred} size={15} />{it.starred ? 'Bỏ sao' : 'Gắn sao'}</Btn>
                {!it.snoozed && <Btn onClick={() => setSnz(true)}><Ico n="clock" size={15} />Nhắc lại sau</Btn>}
                <Btn busy={busy} onClick={() => run(it.archived ? 'unarchive' : 'archive', it.archived ? 'Đã đưa về hộp thư.' : 'Đã lưu trữ.')}><Ico n="archive" size={15} />{it.archived ? 'Bỏ lưu trữ' : 'Lưu trữ'}</Btn>
            </footer>
            {snz && <SnoozeModal keys={[it.key]} onClose={() => setSnz(false)} onDone={() => { setSnz(false); refresh(); onChange(); }} />}
        </article>
    );
}

/** Một dòng thông báo (dùng ở tổng quan và hộp thư) */
export function Row({ it, active, checked, onOpen, onCheck, onStar }: { it: Item; active?: boolean; checked?: boolean; onOpen: () => void; onCheck?: (v: boolean) => void; onStar?: () => void }) {
    return (
        <div className={`nt-row${it.read ? '' : ' unread'}${active ? ' active' : ''} p-${it.priority}`} onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}>
            {onCheck && <label className="nt-chk" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={!!checked} onChange={(e) => onCheck(e.target.checked)} aria-label="Chọn" /></label>}
            <KindIcon kind={it.kind} />
            <div className="nt-rb">
                <div className="nt-rt"><b>{it.title}</b>{it.pinned && <Ico n="pin" size={13} className="nt-pin" />}</div>
                <p>{preview(it.body)}</p>
                <div className="nt-rm"><span>{it.sender}</span><PrioPill p={it.priority} />{it.snoozed && <Pill tone="sky">Hoãn</Pill>}</div>
            </div>
            <div className="nt-rr"><time title={dt(it.created_at)}>{ago(it.created_at)}</time>{onStar && <button type="button" className={`nt-star${it.starred ? ' on' : ''}`} onClick={(e) => { e.stopPropagation(); onStar(); }} aria-label="Gắn sao"><Star on={it.starred} /></button>}{!it.read && <i className="nt-dot" aria-label="Chưa đọc" />}</div>
        </div>
    );
}

/* ---------------- biểu đồ nhỏ ---------------- */
export function Spark({ days }: { days: { date: string; n: number }[] }) {
    const max = Math.max(1, ...days.map((d) => d.n)); const W = 560, H = 120, pad = 6; const bw = (W - pad * 2) / days.length;
    return (
        <svg className="nt-spark" viewBox={`0 0 ${W} ${H + 20}`} role="img" aria-label="Số thông báo 14 ngày gần nhất" preserveAspectRatio="none">
            {days.map((d, i) => { const h = Math.max(3, (d.n / max) * (H - 14)); return <g key={d.date}><rect x={pad + i * bw + 3} y={H - h} width={bw - 6} height={h} rx="5" className={d.date === todayStr() ? 'on' : ''}><title>{`${fmtD(d.date)}: ${d.n} thông báo`}</title></rect>{(i % 2 === 0 || i === days.length - 1) && <text x={pad + i * bw + bw / 2} y={H + 14} textAnchor="middle">{d.date.slice(8, 10)}/{d.date.slice(5, 7)}</text>}</g>; })}
        </svg>
    );
}
export const EmptyList = ({ text, icon = 'bell' }: { text: string; icon?: string }) => <Empty icon={icon} title={text} />;