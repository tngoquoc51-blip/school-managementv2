'use client';
// Thư viện dùng chung cho module Chuyên cần của Ban Giám hiệu (/bgh/attendance)
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
    if (res.status === 401) { clearSession(); if (typeof window !== 'undefined') window.dispatchEvent(new Event('ca-auth')); }
    if (!res.ok) throw new ApiError(json?.message || 'Có lỗi xảy ra, vui lòng thử lại.', res.status, json?.errors);
    return (json ?? {}) as R<T>;
}
export const ca = <T = any>(path: string, o: { method?: string; body?: unknown } = {}) => call<T>(`${BASE}/gv/ca/${path}`.replace(/\/$/, ''), o.method || 'GET', o.body);

export async function downloadFile(path: string, filename: string) {
    const res = await raw(`${BASE}/gv/ca/${path}`, 'GET');
    if (!res.ok) throw new ApiError('Không xuất được tệp.', res.status);
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
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
export type StatusKey = 'present' | 'late' | 'excused' | 'unexcused';
export type Counts = { total: number; present: number; late: number; excused: number; unexcused: number; absent: number; rate: number };
export type ClassInfo = { id: number; grade: number; name: string; students: number };
export type Settings = { alert_absent: string; alert_streak: string; alert_late: string; good_rate: string; warn_rate: string; lock_days: string; late_counts_present: string };
export type Meta = { year_id: number; year_name: string; today: string; classes: ClassInfo[]; settings: Settings; statuses: Record<string, string>; kinds: Record<string, string> };
export type CaCtx = {
    staff: Staff; canApprove: boolean; meta: Meta | null;
    toast: (m: string, kind?: 'ok' | 'err') => void; refresh: () => void; version: number;
};
export const CaContext = createContext<CaCtx | null>(null);
export const useCa = () => { const c = useContext(CaContext); if (!c) throw new Error('CaContext'); return c; };

/* ---------------- nhãn / màu ---------------- */
export const ST: Record<StatusKey, { label: string; short: string; tone: string; color: string; icon: string }> = {
    present: { label: 'Có mặt', short: 'CM', tone: 'green', color: '#10b981', icon: 'check' },
    late: { label: 'Đi muộn', short: 'M', tone: 'amber', color: '#f59e0b', icon: 'clock' },
    excused: { label: 'Vắng có phép', short: 'P', tone: 'sky', color: '#0ea5e9', icon: 'doc' },
    unexcused: { label: 'Vắng không phép', short: 'K', tone: 'rose', color: '#f43f5e', icon: 'x' },
};
export const ST_KEYS: StatusKey[] = ['present', 'late', 'excused', 'unexcused'];
export const LEAVE_ST: Record<string, { label: string; tone: string }> = {
    pending: { label: 'Chờ duyệt', tone: 'amber' }, approved: { label: 'Đã duyệt', tone: 'green' }, rejected: { label: 'Từ chối', tone: 'rose' }, cancelled: { label: 'Đã hủy', tone: 'slate' },
};
export const CASE_ST: Record<string, { label: string; tone: string }> = {
    open: { label: 'Đang theo dõi', tone: 'rose' }, contacted: { label: 'Đã liên hệ phụ huynh', tone: 'amber' }, resolved: { label: 'Đã xử lý', tone: 'green' },
};

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
    const { version } = useCa();
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
    cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
    user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
    phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2',
    flag: 'M5 21V4h11l-2 4 2 4H5',
    save: 'M5 4h12l3 3v13H5zM8 4v5h7M8 20v-6h8v6',
    refresh: 'M20 12a8 8 0 11-2.3-5.7M20 4v5h-5',
    print: 'M7 8V3h10v5M7 17H4v-7h16v7h-3M7 14h10v7H7z',
    trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
    school: 'M3 10l9-6 9 6-9 6zM6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5',
};
export function Ico({ n, size = 18, className = '' }: { n: string; size?: number; className?: string }) {
    return <svg className={`ca-i ${className}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[n] || ICONS.bell} /></svg>;
}

/* ---------------- thành phần giao diện ---------------- */
export function Pill({ tone = 'gray', children, dot }: { tone?: string; children: React.ReactNode; dot?: boolean }) {
    return <span className={`ca-pill t-${tone}`}>{dot && <i />}{children}</span>;
}
export function Card({ title, sub, right, children, className = '', pad = true }: { title?: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean }) {
    return (
        <section className={`ca-card ${className}`}>
            {(title || right) && <header><div><h3>{title}</h3>{sub && <p>{sub}</p>}</div>{right && <div className="r">{right}</div>}</header>}
            <div className={pad ? 'ca-card-b' : ''}>{children}</div>
        </section>
    );
}
export const Loading = ({ text = 'Đang tải…' }: { text?: string }) => <div className="ca-loading"><div className="ca-spin" />{text}</div>;
export const ErrorBox = ({ msg, retry }: { msg: string; retry?: () => void }) => (
    <div className="ca-err"><Ico n="alert" size={20} /><div><b>Không tải được dữ liệu</b><p>{msg}</p></div>{retry && <button className="ca-btn sm" onClick={retry}>Thử lại</button>}</div>
);
export const Empty = ({ icon = 'bell', title, text, action }: { icon?: string; title: string; text?: string; action?: React.ReactNode }) => (
    <div className="ca-empty"><div className="ic"><Ico n={icon} size={26} /></div><b>{title}</b>{text && <p>{text}</p>}{action}</div>
);

export function Btn({ children, tone = 'default', size, busy, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'default' | 'primary' | 'danger' | 'ghost' | 'success'; size?: 'sm'; busy?: boolean }) {
    return <button {...p} disabled={p.disabled || busy} className={`ca-btn ${tone} ${size || ''} ${p.className || ''}`}>{busy && <span className="ca-spin sm" />}{children}</button>;
}

export function Modal({ title, onClose, children, foot, wide }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode; foot?: React.ReactNode; wide?: boolean }) {
    useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
    return (
        <div className="ca-ov" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className={`ca-modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true">
                <header><h3>{title}</h3><button onClick={onClose} aria-label="Đóng"><Ico n="x" size={18} /></button></header>
                <div className="ca-modal-b">{children}</div>
                {foot && <footer>{foot}</footer>}
            </div>
        </div>
    );
}
export function Drawer({ title, sub, onClose, children, foot }: { title: React.ReactNode; sub?: React.ReactNode; onClose: () => void; children: React.ReactNode; foot?: React.ReactNode }) {
    useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
    return (
        <div className="ca-ov side" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <aside className="ca-drawer" role="dialog" aria-modal="true">
                <header><div><h3>{title}</h3>{sub && <p>{sub}</p>}</div><button onClick={onClose} aria-label="Đóng"><Ico n="x" size={18} /></button></header>
                <div className="ca-drawer-b">{children}</div>
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
            {text && <div className="ca-confirm-t">{text}</div>}
            {noteLabel && <label className="ca-field"><span>{noteLabel}{noteRequired && <b className="req"> *</b>}</span><textarea rows={3} value={note} onChange={(e) => { setNote(e.target.value); setErr(''); }} /></label>}
            {err && <p className="ca-ferr">{err}</p>}
        </Modal>
    );
}

export function Pager({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (p: number) => void }) {
    return (
        <div className="ca-pager"><span>{num(total)} bản ghi</span>
            <div><button disabled={page <= 1} onClick={() => onPage(page - 1)}>‹ Trước</button><b>{page} / {pages}</b><button disabled={page >= pages} onClick={() => onPage(page + 1)}>Sau ›</button></div></div>
    );
}
export function Tabs<K extends string>({ value, onChange, items }: { value: K; onChange: (k: K) => void; items: { key: K; label: string; count?: number; tone?: string }[] }) {
    return (
        <div className="ca-tabs" role="tablist">
            {items.map((t) => (
                <button key={t.key} role="tab" aria-selected={value === t.key} className={value === t.key ? 'on' : ''} onClick={() => onChange(t.key)}>
                    {t.label}{t.count !== undefined && <em className={t.tone ? `t-${t.tone}` : ''}>{num(t.count)}</em>}
                </button>
            ))}
        </div>
    );
}
export function Seg({ value, onChange, items }: { value: string; onChange: (v: string) => void; items: [string, string][] }) {
    return <div className="ca-seg">{items.map(([k, l]) => <button key={k} type="button" className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>)}</div>;
}
export function Switch({ on, onChange, disabled, label, sub }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string; sub?: string }) {
    return (
        <button type="button" role="switch" aria-checked={on} disabled={disabled} className={`ca-switch${on ? ' on' : ''}`} onClick={() => onChange(!on)}>
            <span className="trk"><i /></span><span className="tx"><b>{label}</b>{sub && <small>{sub}</small>}</span>
        </button>
    );
}
export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
    return <label className={`ca-field${error ? ' bad' : ''}`}><span>{label}</span>{children}{hint && !error && <small>{hint}</small>}{error && <p className="ca-ferr">{error}</p>}</label>;
}
export const Avatar = ({ name, tone = 'indigo' }: { name: string; tone?: string }) => <span className={`ca-av t-${tone}`}>{initials(name)}</span>;

export function Bar({ value, tone = 'indigo', slim }: { value: number; tone?: string; slim?: boolean }) {
    return <div className={`ca-bar${slim ? ' slim' : ''}`}><i className={`t-${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}
export function Ring({ value, size = 92, label, tone = 'indigo' }: { value: number; size?: number; label?: string; tone?: string }) {
    const r = (size - 12) / 2, c = 2 * Math.PI * r;
    return (
        <div className="ca-ring" style={{ width: size, height: size }}>
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

export function Donut({ items, center }: { items: { label: string; n: number }[]; center?: string }) {
    const total = items.reduce((s, i) => s + i.n, 0) || 1;
    const r = 52, c = 2 * Math.PI * r; let off = 0;
    return (
        <div className="ca-donut">
            <svg width="148" height="148" viewBox="0 0 148 148">
                <circle cx="74" cy="74" r={r} className="bg" />
                {items.map((it, i) => { const len = (it.n / total) * c; const el = <circle key={it.label} cx="74" cy="74" r={r} stroke={PALETTE[i % PALETTE.length]} strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-off} transform="rotate(-90 74 74)" className="seg" />; off += len; return el; })}
            </svg>
            <div className="mid"><b>{total === 1 && !items.length ? 0 : items.reduce((s, i) => s + i.n, 0)}</b><small>{center || 'thông báo'}</small></div>
            <ul>{items.map((it, i) => <li key={it.label}><i style={{ background: PALETTE[i % PALETTE.length] }} /><span>{it.label}</span><b>{it.n}</b></li>)}</ul>
        </div>
    );
}

export const copyText = async (s: string) => { try { await navigator.clipboard.writeText(s); return true; } catch { return false; } };

/* =====================================================================
   Phần riêng của Chuyên cần
   ===================================================================== */

/* ---------------- ngày (chuỗi YYYY-MM-DD theo giờ Việt Nam, không qua múi giờ) ---------------- */
export const ymd = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const parseYmd = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
export const todayStr = () => ymd(new Date());
export const addDays = (s: string, n: number) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
export const fmtD = (s?: string | null) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—');
export const fmtS = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
export const weekday = (s: string) => WD[parseYmd(s).getDay()];
export const longDate = (s: string) => `${weekday(s) === 'CN' ? 'Chủ nhật' : 'Thứ ' + weekday(s).slice(1)}, ${fmtD(s)}`;
export const monthStart = (s: string) => `${s.slice(0, 7)}-01`;
export const monthLabel = (m: string) => `Tháng ${Number(m.slice(5, 7))}/${m.slice(0, 4)}`;

/* ---------------- tông màu theo tỉ lệ chuyên cần ---------------- */
export const rateTone = (rate: number, good: number, warn: number, total = 1) => (total <= 0 ? 'gray' : rate >= good ? 'green' : rate >= warn ? 'amber' : 'rose');
export function RatePill({ c, good, warn }: { c: Pick<Counts, 'rate' | 'total'>; good: number; warn: number }) {
    if (c.total <= 0) return <span className="ca-mute">—</span>;
    return <Pill tone={rateTone(c.rate, good, warn)}>{c.rate.toFixed(1)}%</Pill>;
}
export function StatusBadge({ s }: { s: string | null | undefined }) {
    if (!s || !(s in ST)) return <Pill tone="gray">Chưa điểm danh</Pill>;
    const x = ST[s as StatusKey];
    return <Pill tone={x.tone} dot>{x.label}</Pill>;
}

/** Thanh chia màu: có mặt / muộn / vắng có phép / vắng không phép */
export function StackBar({ c, tall }: { c: Pick<Counts, 'total' | 'present' | 'late' | 'excused' | 'unexcused'>; tall?: boolean }) {
    const t = c.total || 1;
    return (
        <div className={`ca-stack${tall ? ' tall' : ''}`} title={ST_KEYS.map((k) => `${ST[k].label}: ${c[k]}`).join(' · ')}>
            {c.total <= 0 ? <i className="none" style={{ width: '100%' }} /> : ST_KEYS.map((k) => (c[k] > 0 ? <i key={k} style={{ width: `${(c[k] / t) * 100}%`, background: ST[k].color }} /> : null))}
        </div>
    );
}
export function Legend() {
    return <div className="ca-legend">{ST_KEYS.map((k) => <span key={k}><i style={{ background: ST[k].color }} />{ST[k].label}</span>)}</div>;
}

/* ---------------- chọn khoảng ngày ---------------- */
export type Range = { from: string; to: string };
export function presetRange(key: string): Range {
    const t = todayStr();
    if (key === 'today') return { from: t, to: t };
    if (key === 'week') { const d = parseYmd(t); const back = (d.getDay() + 6) % 7; return { from: addDays(t, -back), to: t }; }
    if (key === 'last30') return { from: addDays(t, -29), to: t };
    if (key === 'term') { const d = parseYmd(t); const y = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; return { from: `${y}-09-05`, to: t }; }
    return { from: monthStart(t), to: t };
}
export function RangeBar({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
    const keys: [string, string][] = [['today', 'Hôm nay'], ['week', 'Tuần này'], ['month', 'Tháng này'], ['last30', '30 ngày'], ['term', 'Cả năm học']];
    const cur = keys.find(([k]) => { const p = presetRange(k); return p.from === value.from && p.to === value.to; })?.[0] ?? '';
    return (
        <div className="ca-range">
            <div className="ca-seg">{keys.map(([k, l]) => <button key={k} type="button" className={cur === k ? 'on' : ''} onClick={() => onChange(presetRange(k))}>{l}</button>)}</div>
            <div className="ca-dates">
                <input type="date" value={value.from} max={value.to} onChange={(e) => e.target.value && onChange({ from: e.target.value, to: value.to })} aria-label="Từ ngày" />
                <span>→</span>
                <input type="date" value={value.to} min={value.from} max={todayStr()} onChange={(e) => e.target.value && onChange({ from: value.from, to: e.target.value })} aria-label="Đến ngày" />
            </div>
        </div>
    );
}

/* ---------------- biểu đồ ---------------- */
export type DayPoint = { d: string; total: number; present: number; late: number; absent: number; rate: number | null };

/** Đường tỉ lệ chuyên cần theo ngày + hai vạch ngưỡng */
export function TrendChart({ data, good, warn }: { data: DayPoint[]; good: number; warn: number }) {
    const [hov, setHov] = useState<number | null>(null);
    const W = 720, H = 210, L = 38, R = 14, T = 14, B = 28;
    const vals = data.map((p) => p.rate).filter((v): v is number => v !== null);
    const lo = Math.max(0, Math.floor(Math.min(...(vals.length ? vals : [60]), warn - 5) / 5) * 5);
    const y = (v: number) => T + (H - T - B) * (1 - (v - lo) / (100 - lo));
    const bw = (W - L - R) / Math.max(1, data.length);
    const x = (i: number) => L + i * bw + bw / 2;
    let path = ''; let pen = false;
    data.forEach((p, i) => { if (p.rate === null) { pen = false; return; } path += `${pen ? 'L' : 'M'}${x(i)},${y(p.rate)} `; pen = true; });
    const h = hov !== null ? data[hov] : null;
    const ticks = [lo, Math.round((lo + 100) / 2), 100];
    return (
        <div className="ca-chart">
            <svg viewBox={`0 0 ${W} ${H}`} onMouseLeave={() => setHov(null)}>
                {ticks.map((t) => (<g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" /><text x={L - 6} y={y(t) + 4} className="ax" textAnchor="end">{t}%</text></g>))}
                <line x1={L} x2={W - R} y1={y(good)} y2={y(good)} className="thr g" /><line x1={L} x2={W - R} y1={y(warn)} y2={y(warn)} className="thr w" />
                {data.map((p, i) => (
                    <g key={p.d} onMouseEnter={() => setHov(i)}>
                        <rect x={L + i * bw} y={T} width={bw} height={H - T - B} className="hit" />
                        {p.rate !== null && p.absent > 0 && <rect x={x(i) - bw * 0.2} width={bw * 0.4} y={H - B - Math.min(28, p.absent * 3)} height={Math.min(28, p.absent * 3)} rx={3} className="abs" />}
                        {(i % 2 === 0 || data.length <= 8) && <text x={x(i)} y={H - 9} className="ax" textAnchor="middle">{fmtS(p.d)}</text>}
                    </g>
                ))}
                <path d={path} className="line" />
                {data.map((p, i) => p.rate !== null && <circle key={p.d} cx={x(i)} cy={y(p.rate)} r={hov === i ? 5 : 3} className={`dot${hov === i ? ' on' : ''}`} />)}
            </svg>
            <div className="ca-chart-tip">
                {h ? <><b>{weekday(h.d)} {fmtD(h.d)}</b>{h.rate === null ? <span>Chưa có điểm danh</span> : <><span>Tỉ lệ <b>{h.rate}%</b></span><span>{h.present} có mặt</span><span>{h.late} muộn</span><span>{h.absent} vắng</span></>}</>
                    : <><span><i className="k line" />Tỉ lệ chuyên cần</span><span><i className="k abs" />Số vắng (cột nhỏ)</span><span><i className="k g" />Mức tốt {good}%</span><span><i className="k w" />Cần chú ý {warn}%</span></>}
            </div>
        </div>
    );
}

/** Lịch tháng tô màu theo trạng thái chuyên cần của một học sinh */
export function MonthCalendar({ records, month, onMonth }: { records: { date: string; status: string; note?: string | null }[]; month: string; onMonth: (m: string) => void }) {
    const map = new Map(records.map((r) => [r.date, r]));
    const first = parseYmd(`${month}-01`);
    const lead = (first.getDay() + 6) % 7;
    const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const shift = (n: number) => { const d = new Date(first.getFullYear(), first.getMonth() + n, 1); onMonth(`${d.getFullYear()}-${p2(d.getMonth() + 1)}`); };
    const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
    return (
        <div className="ca-cal">
            <header><button type="button" onClick={() => shift(-1)} aria-label="Tháng trước">‹</button><b>{monthLabel(month)}</b><button type="button" onClick={() => shift(1)} aria-label="Tháng sau">›</button></header>
            <div className="g">{['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((w) => <small key={w}>{w}</small>)}
                {cells.map((c, i) => {
                    if (c === null) return <span key={`e${i}`} />;
                    const ds = `${month}-${p2(c)}`; const r = map.get(ds); const st = r && r.status in ST ? ST[r.status as StatusKey] : null;
                    return <span key={ds} className={`d${st ? ' has' : ''}${weekday(ds) === 'CN' ? ' sun' : ''}`} style={st ? { background: st.color, color: '#fff' } : undefined} title={st ? `${fmtD(ds)} · ${st.label}${r?.note ? ' · ' + r.note : ''}` : fmtD(ds)}>{c}</span>;
                })}
            </div>
        </div>
    );
}

export const csvName = (s: string) => s.replace(/[^a-z0-9-]/gi, '');