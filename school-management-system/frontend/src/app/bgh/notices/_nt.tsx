'use client';
// Thư viện dùng chung cho module Thông báo của Ban Giám hiệu (/bgh/notices)
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';
export const SERVER_UTC = true; // Laravel lưu giờ UTC. Nếu đã đổi timezone trong config/app.php thì đặt false.

/* ---------------- phiên đăng nhập ---------------- */
export type Staff = { id: number; username: string; name: string; role: string; role_label: string };
const TK = 'gv_token', UK = 'gv_user', OFF = 'nt_demo_off';
export const ALLOWED_ROLES = ['super_admin', 'principal', 'vice_principal'];

/* Đã đăng nhập cổng demo (token "demo-token") → dùng luôn, không hỏi lần 2.
   Backend chỉ chấp nhận token này khi APP_ENV=local; nếu bị từ chối thì tự hiện khung đăng nhập. */
const demo = (): Staff | null => {
    try {
        if (sessionStorage.getItem(OFF)) return null;
        if (localStorage.getItem('token') !== 'demo-token') return null;
        const u = JSON.parse(localStorage.getItem('user') || '{}');
        return { id: 0, username: 'bgh_demo', name: u?.name || 'Hiệu trưởng (demo)', role: 'principal', role_label: 'Hiệu trưởng' };
    } catch { return null; }
};
export const getSession = (): { token: string; staff: Staff } | null => {
    try {
        const t = localStorage.getItem(TK); const s = localStorage.getItem(UK);
        if (t && s) { const u = JSON.parse(s) as Staff; if (ALLOWED_ROLES.includes(u.role)) return { token: t, staff: u }; }
        const d = demo();
        return d ? { token: 'demo-token', staff: d } : null;
    } catch { return null; }
};
export const saveSession = (t: string, u: Staff) => { try { sessionStorage.removeItem(OFF); localStorage.setItem(TK, t); localStorage.setItem(UK, JSON.stringify(u)); } catch { /* bỏ qua */ } };
export const clearSession = () => { try { localStorage.removeItem(TK); localStorage.removeItem(UK); sessionStorage.setItem(OFF, '1'); } catch { /* bỏ qua */ } };

export class ApiError extends Error {
    status: number; errors?: Record<string, string>;
    constructor(m: string, status: number, errors?: Record<string, string>) { super(m); this.status = status; this.errors = errors; }
}
export type R<T> = { data: T; meta?: { total: number; page: number; per: number; pages: number }; counts?: Record<string, number>; message?: string; unread?: number; identified?: boolean };

async function raw(url: string, method: string, body?: unknown): Promise<Response> {
    try {
        return await fetch(url, {
            method,
            headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${getSession()?.token ?? ''}` },
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    } catch { throw new ApiError('Không kết nối được máy chủ. Hãy kiểm tra backend đang chạy.', 0); }
}
async function call<T>(url: string, method: string, body?: unknown): Promise<R<T>> {
    const res = await raw(url, method, body);
    let json: any = null;
    try { json = await res.json(); } catch { /* không phải JSON */ }
    if (res.status === 401) { clearSession(); if (typeof window !== 'undefined') window.dispatchEvent(new Event('nt-auth')); }
    if (!res.ok) throw new ApiError(json?.message || 'Có lỗi xảy ra, vui lòng thử lại.', res.status, json?.errors);
    return (json ?? {}) as R<T>;
}
export const nt = <T = any>(path: string, o: { method?: string; body?: unknown } = {}) => call<T>(`${BASE}/gv/notices/${path}`.replace(/\/$/, ''), o.method || 'GET', o.body);

export async function downloadCsv(id: number, name: string) {
    const res = await raw(`${BASE}/gv/notices/${id}/export`, 'GET');
    if (!res.ok) throw new ApiError('Không xuất được tệp.', res.status);
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a'); a.href = url; a.download = `${name}-da-doc.csv`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export const login = async (username: string, password: string) => (await call<{ token: string; staff: Staff }>(`${BASE}/gv/login`, 'POST', { username, password })).data;

export const qs = (o: Record<string, string | number | null | undefined | boolean>) => {
    const p = new URLSearchParams();
    Object.entries(o).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== '' && v !== false) p.set(k, String(v)); });
    const s = p.toString();
    return s ? `?${s}` : '';
};

/* ---------------- kiểu dữ liệu ---------------- */
export type Link = { label: string; url: string };
export type Notice = {
    id: number; code: string; title: string; excerpt: string; body?: string; category: string; category_label: string; priority: 'normal' | 'high' | 'urgent';
    status: 'draft' | 'pending' | 'scheduled' | 'sent' | 'rejected' | 'archived';
    to_teachers: number; to_students: number; to_parents: number; to_staff: number; grades: number[]; class_ids: number[]; audience_label: string; classes?: { id: number; name: string }[];
    pinned: number; require_ack: number; links: Link[]; scheduled_at: string | null; sent_at: string | null; expires_at: string | null; expired: boolean; last_reminded_at: string | null;
    recipients_total: number; reads_count: number | null; ack_count: number | null; created_by: string; created_by_name: string;
    approved_by: string | null; approved_at: string | null; review_note: string | null; created_at: string; updated_at: string;
};
export type ClassInfo = { id: number; grade: number; name: string; students: number };
export type Meta = { categories: { key: string; label: string }[]; classes: ClassInfo[]; settings: Settings };
export type Settings = { require_approval: string; default_expire_days: string; auto_archive_days: string; signature: string };
export type Audience = { teachers: number; students: number; parents: number; staff: number; total: number };
export type NtCtx = {
    staff: Staff; canApprove: boolean; meta: Meta | null;
    toast: (m: string, kind?: 'ok' | 'err') => void; refresh: () => void; version: number;
};
export const NtContext = createContext<NtCtx | null>(null);
export const useNt = () => { const c = useContext(NtContext); if (!c) throw new Error('NtContext'); return c; };

/* ---------------- nhãn / màu ---------------- */
export const STATUS: Record<string, { label: string; tone: string }> = {
    draft: { label: 'Bản nháp', tone: 'gray' }, pending: { label: 'Chờ duyệt', tone: 'amber' }, scheduled: { label: 'Hẹn giờ', tone: 'sky' },
    sent: { label: 'Đã gửi', tone: 'green' }, rejected: { label: 'Bị từ chối', tone: 'rose' }, archived: { label: 'Đã thu hồi', tone: 'slate' },
};
export const PRIORITY: Record<string, { label: string; tone: string }> = {
    normal: { label: 'Thường', tone: 'gray' }, high: { label: 'Quan trọng', tone: 'amber' }, urgent: { label: 'Khẩn', tone: 'rose' },
};
export const CAT_ICON: Record<string, string> = { general: 'bell', study: 'book', exam: 'doc', meeting: 'users', fee: 'coin', holiday: 'sun', discipline: 'shield', policy: 'scroll' };
export const CAT_TONE: Record<string, string> = { general: 'indigo', study: 'sky', exam: 'rose', meeting: 'violet', fee: 'amber', holiday: 'green', discipline: 'slate', policy: 'teal' };
export const HIST: Record<string, string> = {
    create: 'Tạo thông báo', edit: 'Chỉnh sửa', sent: 'Đã gửi', submit: 'Gửi chờ duyệt', schedule: 'Hẹn giờ gửi', approve: 'Duyệt', reject: 'Từ chối',
    unschedule: 'Hủy hẹn giờ', archive: 'Thu hồi', restore: 'Khôi phục', pin: 'Ghim', unpin: 'Bỏ ghim', remind: 'Nhắc lại',
};
export const TYPE_LABEL: Record<string, string> = { student: 'Học sinh', teacher: 'Giáo viên', parent: 'Phụ huynh', staff: 'Nhân viên' };

/* ---------------- thời gian ---------------- */
export const p2 = (n: number) => String(n).padStart(2, '0');
export const parseServer = (s?: string | null): Date | null => {
    if (!s) return null;
    const d = new Date(SERVER_UTC && !/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s.replace(' ', 'T') + 'Z' : s);
    return isNaN(d.getTime()) ? null : d;
};
export const hm = (d: Date) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
export const dmy = (d: Date) => `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
export const dt = (s?: string | null) => { const d = parseServer(s); return d ? `${hm(d)} ${dmy(d)}` : '—'; };
export const ago = (s?: string | null) => {
    const d = parseServer(s); if (!d) return '';
    const sec = Math.round((Date.now() - d.getTime()) / 1000);
    if (sec < 0) { const f = -sec; return f < 3600 ? `sau ${Math.max(1, Math.round(f / 60))} phút` : f < 86400 ? `sau ${Math.round(f / 3600)} giờ` : `sau ${Math.round(f / 86400)} ngày`; }
    if (sec < 45) return 'vừa xong';
    if (sec < 3600) return `${Math.round(sec / 60)} phút trước`;
    if (sec < 86400) return `${Math.round(sec / 3600)} giờ trước`;
    return `${Math.round(sec / 86400)} ngày trước`;
};
/** Date → giá trị cho <input type="datetime-local"> (giờ địa phương) */
export const toLocalInput = (s?: string | null) => { const d = parseServer(s); return d ? `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}` : ''; };
/** giá trị datetime-local → ISO UTC để gửi lên máy chủ */
export const fromLocalInput = (v: string) => { if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d.toISOString(); };
export const addDaysInput = (days: number) => { const d = new Date(Date.now() + days * 86400000); d.setSeconds(0, 0); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`; };
export const num = (n: number | null | undefined) => (n ?? 0).toLocaleString('vi-VN');
export const pct = (a: number | null | undefined, b: number | null | undefined) => (b && b > 0 ? Math.min(100, Math.round(((a ?? 0) / b) * 100)) : 0);
export const initials = (n: string) => n.trim().split(/\s+/).slice(-2).map((w) => w[0]?.toUpperCase() ?? '').join('') || 'BG';

/* ---------------- tải dữ liệu ---------------- */
export function useLoad<T>(fn: () => Promise<T>, deps: React.DependencyList = []) {
    const [data, setData] = useState<T | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const seq = useRef(0);
    const fnRef = useRef(fn); fnRef.current = fn;
    const { version } = useNt();
    const reload = useCallback(() => {
        const my = ++seq.current;
        setLoading(true);
        fnRef.current().then((d) => { if (my === seq.current) { setData(d); setErr(null); } })
            .catch((e: Error) => { if (my === seq.current) setErr(e.message); })
            .finally(() => { if (my === seq.current) setLoading(false); });
    }, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { reload(); }, [...deps, version]);
    return { data, err, loading, reload, setData };
}
export function useDebounced<T>(v: T, ms = 350) {
    const [x, setX] = useState(v);
    useEffect(() => { const t = setTimeout(() => setX(v), ms); return () => clearTimeout(t); }, [v, ms]);
    return x;
}

/* ---------------- biểu tượng ---------------- */
const ICONS: Record<string, string> = {
    bell: 'M6 9a6 6 0 0112 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 004 0',
    book: 'M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3zM5 17a3 3 0 013-3h11',
    doc: 'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5',
    users: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 6.5M18 14a6 6 0 013.5 6',
    coin: 'M12 3a9 9 0 100 18 9 9 0 000-18zM9.5 9.5C9.5 8.4 10.6 8 12 8s2.5.6 2.5 1.7c0 2.3-5 1.2-5 3.6 0 1.1 1.1 1.7 2.5 1.7s2.5-.5 2.5-1.6M12 6.5V8M12 16v1.5',
    sun: 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5',
    shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
    scroll: 'M8 4h10a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2v-2h4V6a2 2 0 00-2-2zM11 9h6M11 13h6',
    home: 'M3 12l9-8 9 8M5 10v10h14V10',
    pen: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
    list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
    check: 'M5 12l5 5L20 7',
    checks: 'M3 12l5 5L18 7M11 17l1.5 1.5L22 9',
    stats: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
    tpl: 'M4 4h16v6H4zM4 14h7v6H4zM15 14h5v6h-5z',
    cog: 'M12 8a4 4 0 100 8 4 4 0 000-8zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4',
    send: 'M21 3L10 14M21 3l-7 18-4-7-7-4z',
    clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2',
    pin: 'M9 4h6l-1 6 3 3v2H7v-2l3-3zM12 15v6',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z',
    copy: 'M9 9h11v11H9zM5 15V4h11',
    trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
    x: 'M6 6l12 12M18 6L6 18',
    plus: 'M12 5v14M5 12h14',
    alert: 'M12 4l9 16H3zM12 10v4M12 17v1',
    undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3',
    link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
    download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5',
    spark: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
    chevR: 'M9 6l6 6-6 6',
    mega: 'M4 10v4h3l7 4V6L7 10zM17 9a4 4 0 010 6',
    lock: 'M6 11h12v9H6zM8 11V8a4 4 0 018 0v3',
    edit: 'M4 20h4L19 9l-4-4L4 16z',
    archive: 'M4 5h16v4H4zM6 9v10h12V9M10 13h4',
};
export function Ico({ n, size = 18, className = '' }: { n: string; size?: number; className?: string }) {
    return <svg className={`nt-i ${className}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[n] || ICONS.bell} /></svg>;
}

/* ---------------- thành phần giao diện ---------------- */
export function Pill({ tone = 'gray', children, dot }: { tone?: string; children: React.ReactNode; dot?: boolean }) {
    return <span className={`nt-pill t-${tone}`}>{dot && <i />}{children}</span>;
}
export const StatusPill = ({ s }: { s: string }) => <Pill tone={STATUS[s]?.tone || 'gray'} dot>{STATUS[s]?.label || s}</Pill>;
export const PriorityPill = ({ p }: { p: string }) => (p === 'normal' ? null : <Pill tone={PRIORITY[p]?.tone || 'gray'}>{p === 'urgent' ? '⚡ ' : ''}{PRIORITY[p]?.label}</Pill>);

export function Card({ title, sub, right, children, className = '', pad = true }: { title?: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean }) {
    return (
        <section className={`nt-card ${className}`}>
            {(title || right) && <header><div><h3>{title}</h3>{sub && <p>{sub}</p>}</div>{right && <div className="r">{right}</div>}</header>}
            <div className={pad ? 'nt-card-b' : ''}>{children}</div>
        </section>
    );
}
export const Loading = ({ text = 'Đang tải…' }: { text?: string }) => <div className="nt-loading"><div className="nt-spin" />{text}</div>;
export const ErrorBox = ({ msg, retry }: { msg: string; retry?: () => void }) => (
    <div className="nt-err"><Ico n="alert" size={20} /><div><b>Không tải được dữ liệu</b><p>{msg}</p></div>{retry && <button className="nt-btn sm" onClick={retry}>Thử lại</button>}</div>
);
export const Empty = ({ icon = 'bell', title, text, action }: { icon?: string; title: string; text?: string; action?: React.ReactNode }) => (
    <div className="nt-empty"><div className="ic"><Ico n={icon} size={26} /></div><b>{title}</b>{text && <p>{text}</p>}{action}</div>
);

export function Btn({ children, tone = 'default', size, busy, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'default' | 'primary' | 'danger' | 'ghost' | 'success'; size?: 'sm'; busy?: boolean }) {
    return <button {...p} disabled={p.disabled || busy} className={`nt-btn ${tone} ${size || ''} ${p.className || ''}`}>{busy && <span className="nt-spin sm" />}{children}</button>;
}

export function Modal({ title, onClose, children, foot, wide }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode; foot?: React.ReactNode; wide?: boolean }) {
    useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
    return (
        <div className="nt-ov" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className={`nt-modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true">
                <header><h3>{title}</h3><button onClick={onClose} aria-label="Đóng"><Ico n="x" size={18} /></button></header>
                <div className="nt-modal-b">{children}</div>
                {foot && <footer>{foot}</footer>}
            </div>
        </div>
    );
}
export function Drawer({ title, sub, onClose, children, foot }: { title: React.ReactNode; sub?: React.ReactNode; onClose: () => void; children: React.ReactNode; foot?: React.ReactNode }) {
    useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
    return (
        <div className="nt-ov side" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <aside className="nt-drawer" role="dialog" aria-modal="true">
                <header><div><h3>{title}</h3>{sub && <p>{sub}</p>}</div><button onClick={onClose} aria-label="Đóng"><Ico n="x" size={18} /></button></header>
                <div className="nt-drawer-b">{children}</div>
                {foot && <footer>{foot}</footer>}
            </aside>
        </div>
    );
}

/** Hộp xác nhận, tùy chọn bắt nhập lý do */
export function Confirm({ title, text, okText = 'Xác nhận', tone = 'primary', noteLabel, noteRequired, onOk, onClose }: {
    title: string; text?: React.ReactNode; okText?: string; tone?: 'primary' | 'danger' | 'success'; noteLabel?: string; noteRequired?: boolean;
    onOk: (note: string) => Promise<void> | void; onClose: () => void;
}) {
    const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
    const go = async () => {
        if (noteRequired && note.trim().length < 3) { setErr('Vui lòng nhập nội dung (ít nhất 3 ký tự).'); return; }
        setBusy(true);
        try { await onOk(note.trim()); } catch (e) { setErr((e as Error).message); setBusy(false); }
    };
    return (
        <Modal title={title} onClose={onClose} foot={<><Btn onClick={onClose}>Hủy</Btn><Btn tone={tone} busy={busy} onClick={go}>{okText}</Btn></>}>
            {text && <div className="nt-confirm-t">{text}</div>}
            {noteLabel && <label className="nt-field"><span>{noteLabel}{noteRequired && <b className="req"> *</b>}</span><textarea rows={3} value={note} onChange={(e) => { setNote(e.target.value); setErr(''); }} /></label>}
            {err && <p className="nt-ferr">{err}</p>}
        </Modal>
    );
}

export function Pager({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (p: number) => void }) {
    return (
        <div className="nt-pager"><span>{num(total)} bản ghi</span>
            <div><button disabled={page <= 1} onClick={() => onPage(page - 1)}>‹ Trước</button><b>{page} / {pages}</b><button disabled={page >= pages} onClick={() => onPage(page + 1)}>Sau ›</button></div></div>
    );
}
export function Tabs<K extends string>({ value, onChange, items }: { value: K; onChange: (k: K) => void; items: { key: K; label: string; count?: number; tone?: string }[] }) {
    return (
        <div className="nt-tabs" role="tablist">
            {items.map((t) => (
                <button key={t.key} role="tab" aria-selected={value === t.key} className={value === t.key ? 'on' : ''} onClick={() => onChange(t.key)}>
                    {t.label}{t.count !== undefined && <em className={t.tone ? `t-${t.tone}` : ''}>{num(t.count)}</em>}
                </button>
            ))}
        </div>
    );
}
export function Seg({ value, onChange, items }: { value: string; onChange: (v: string) => void; items: [string, string][] }) {
    return <div className="nt-seg">{items.map(([k, l]) => <button key={k} type="button" className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>)}</div>;
}
export function Switch({ on, onChange, disabled, label, sub }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string; sub?: string }) {
    return (
        <button type="button" role="switch" aria-checked={on} disabled={disabled} className={`nt-switch${on ? ' on' : ''}`} onClick={() => onChange(!on)}>
            <span className="trk"><i /></span><span className="tx"><b>{label}</b>{sub && <small>{sub}</small>}</span>
        </button>
    );
}
export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
    return <label className={`nt-field${error ? ' bad' : ''}`}><span>{label}</span>{children}{hint && !error && <small>{hint}</small>}{error && <p className="nt-ferr">{error}</p>}</label>;
}
export const Avatar = ({ name, tone = 'indigo' }: { name: string; tone?: string }) => <span className={`nt-av t-${tone}`}>{initials(name)}</span>;

export function Bar({ value, tone = 'indigo', slim }: { value: number; tone?: string; slim?: boolean }) {
    return <div className={`nt-bar${slim ? ' slim' : ''}`}><i className={`t-${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}
export function ReadMeter({ n }: { n: Notice }) {
    if (n.status !== 'sent' && n.status !== 'archived') return <span className="nt-mute">—</span>;
    const p = pct(n.reads_count, n.recipients_total);
    return (
        <div className="nt-meter" title={`${num(n.reads_count)} / ${num(n.recipients_total)} đã đọc`}>
            <Bar value={p} tone={p >= 70 ? 'green' : p >= 40 ? 'amber' : 'rose'} slim /><span><b>{p}%</b> · {num(n.reads_count)}/{num(n.recipients_total)}</span>
        </div>
    );
}
export function Ring({ value, size = 92, label, tone = 'indigo' }: { value: number; size?: number; label?: string; tone?: string }) {
    const r = (size - 12) / 2, c = 2 * Math.PI * r;
    return (
        <div className="nt-ring" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle cx={size / 2} cy={size / 2} r={r} className="bg" />
                <circle cx={size / 2} cy={size / 2} r={r} className={`fg t-${tone}`} strokeDasharray={`${(c * Math.max(0, Math.min(100, value))) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
            </svg>
            <div><b>{Math.round(value)}%</b>{label && <small>{label}</small>}</div>
        </div>
    );
}

/* ---------------- biểu đồ ---------------- */
export const PALETTE = ['#6366f1', '#06b6d4', '#f43f5e', '#8b5cf6', '#f59e0b', '#10b981', '#64748b', '#14b8a6'];

export function ActivityChart({ data }: { data: { d: string; sent: number; reads: number }[] }) {
    const [hov, setHov] = useState<number | null>(null);
    const W = 720, H = 200, L = 34, R = 34, T = 14, B = 26;
    const mS = Math.max(...data.map((x) => x.sent), 1), mR = Math.max(...data.map((x) => x.reads), 5);
    const bw = (W - L - R) / Math.max(1, data.length);
    const x = (i: number) => L + i * bw + bw / 2;
    const yS = (v: number) => T + (H - T - B) * (1 - v / mS), yR = (v: number) => T + (H - T - B) * (1 - v / mR);
    const line = data.map((p, i) => `${x(i)},${yR(p.reads)}`).join(' ');
    const lab = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
    const h = hov !== null ? data[hov] : null;
    return (
        <div className="nt-chart">
            <svg viewBox={`0 0 ${W} ${H}`} onMouseLeave={() => setHov(null)}>
                {[0, 0.5, 1].map((f) => (<g key={f}><line x1={L} x2={W - R} y1={T + (H - T - B) * f} y2={T + (H - T - B) * f} className="grid" />
                    <text x={L - 6} y={T + (H - T - B) * f + 4} className="ax" textAnchor="end">{Math.round(mS * (1 - f))}</text>
                    <text x={W - R + 6} y={T + (H - T - B) * f + 4} className="ax r" textAnchor="start">{Math.round(mR * (1 - f))}</text></g>))}
                {data.map((p, i) => (
                    <g key={p.d} onMouseEnter={() => setHov(i)}>
                        <rect x={L + i * bw} y={T} width={bw} height={H - T - B} className="hit" />
                        <rect x={L + i * bw + bw * 0.2} width={bw * 0.6} y={yS(p.sent)} height={Math.max(0, H - B - yS(p.sent))} rx={4} className={`bar${hov === i ? ' on' : ''}`} />
                        {i % 2 === 0 && <text x={x(i)} y={H - 8} className="ax" textAnchor="middle">{lab(p.d)}</text>}
                    </g>
                ))}
                <polyline points={line} className="line" />
                {hov !== null && <circle cx={x(hov)} cy={yR(data[hov].reads)} r={4.5} className="dot" />}
            </svg>
            <div className="nt-chart-tip">
                {h ? <><b>{lab(h.d)}</b><span><i className="k bar" />{h.sent} thông báo gửi</span><span><i className="k line" />{h.reads} lượt đọc</span></>
                    : <><span><i className="k bar" />Số thông báo gửi (cột)</span><span><i className="k line" />Lượt đọc (đường)</span></>}
            </div>
        </div>
    );
}

export function Donut({ items, center }: { items: { label: string; n: number }[]; center?: string }) {
    const total = items.reduce((s, i) => s + i.n, 0) || 1;
    const r = 52, c = 2 * Math.PI * r; let off = 0;
    return (
        <div className="nt-donut">
            <svg width="148" height="148" viewBox="0 0 148 148">
                <circle cx="74" cy="74" r={r} className="bg" />
                {items.map((it, i) => { const len = (it.n / total) * c; const el = <circle key={it.label} cx="74" cy="74" r={r} stroke={PALETTE[i % PALETTE.length]} strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-off} transform="rotate(-90 74 74)" className="seg" />; off += len; return el; })}
            </svg>
            <div className="mid"><b>{total === 1 && !items.length ? 0 : items.reduce((s, i) => s + i.n, 0)}</b><small>{center || 'thông báo'}</small></div>
            <ul>{items.map((it, i) => <li key={it.label}><i style={{ background: PALETTE[i % PALETTE.length] }} /><span>{it.label}</span><b>{it.n}</b></li>)}</ul>
        </div>
    );
}

export function HourBars({ data }: { data: number[] }) {
    const max = Math.max(...data, 1);
    return (
        <div className="nt-hours">
            {data.map((v, h) => (
                <div key={h} title={`${h}h: ${v} lượt đọc`}><i style={{ height: `${Math.max(3, (v / max) * 100)}%` }} className={v === max && v > 0 ? 'peak' : ''} />{h % 3 === 0 && <small>{h}h</small>}</div>
            ))}
        </div>
    );
}

/* ---------------- dòng thông báo gọn (dùng ở nhiều trang) ---------------- */
export function NoticeLine({ n, onOpen, right }: { n: Notice; onOpen?: () => void; right?: React.ReactNode }) {
    return (
        <div className="nt-line" onClick={onOpen} role={onOpen ? 'button' : undefined}>
            <span className={`ic t-${CAT_TONE[n.category] || 'indigo'}`}><Ico n={CAT_ICON[n.category] || 'bell'} size={17} /></span>
            <div className="mid">
                <b>{n.pinned ? <Ico n="pin" size={13} className="pin" /> : null}{n.title}</b>
                <small>{n.code} · {n.audience_label} · {n.status === 'scheduled' ? `Gửi ${dt(n.scheduled_at)}` : n.status === 'sent' ? `Gửi ${ago(n.sent_at)}` : `${n.created_by_name}`}</small>
            </div>
            <div className="rt" onClick={(e) => e.stopPropagation()}>{right}</div>
        </div>
    );
}

export const copyText = async (s: string) => { try { await navigator.clipboard.writeText(s); return true; } catch { return false; } };