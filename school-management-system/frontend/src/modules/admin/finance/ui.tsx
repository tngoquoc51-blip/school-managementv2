'use client';

import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import s from './finance.module.css';

/* ---------- Icon (SVG nội tuyến, không cần thư viện) ---------- */
const P: Record<string, string> = {
    home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
    book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M9 7h6',
    award: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 14l-1.5 7 5-3 5 3-1.5-7',
    mail: 'M3 6h18v12H3zM3 7l9 7 9-7',
    shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4',
    cog: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.7-1L14.5 3h-4l-.4 2.1a7 7 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 1.7 1l.4 2.1h4l.4-2.1a7 7 0 0 0 1.7-1l2.3 1 2-3.4-2-1.5c.1-.3.1-.7.1-1z',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
    camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
    plus: 'M12 5v14M5 12h14', edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4', trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
    lock: 'M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5z', check: 'M5 12l5 5L20 7', x: 'M6 6l12 12M18 6L6 18',
    phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
    calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4', users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20a7 7 0 0 1 14 0M17 4a3.5 3.5 0 0 1 0 7M22 20a6 6 0 0 0-4-5.6',
    pen: 'M4 20l1-4L17 4l3 3L8 19zM14 7l3 3', grade: 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3', logout: 'M10 4H5v16h5M15 8l4 4-4 4M19 12H9',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', device: 'M3 5h18v11H3zM8 20h8M12 16v4',
    list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01', send: 'M3 11l18-8-8 18-2-8z',
    money: 'M12 2v20M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.6 7 6.5 9 9.5 12 10.5s5 1.5 5 3.5-2.2 3.5-5 3.5-5-1.1-5-3',
    chart: 'M4 20V10M10 20V4M16 20v-8M22 20H2', receipt: 'M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6',
    wallet: 'M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7l12-3v3M16 14h2',
    alert: 'M12 3l10 18H2zM12 10v5M12 18h.01', download: 'M12 3v12M7 10l5 5 5-5M4 20h16', search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5',
    refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7', bank: 'M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18',
    percent: 'M19 5L5 19M7.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM16.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
    chat: 'M4 5h16v11H9l-5 4z', lockc: 'M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5z',
};
export function Icon({ n, size = 18 }: { n: string; size?: number }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={P[n] || P.list} /></svg>;
}

/* ---------- Data hook ---------- */
export function useFetch<T>(fn: () => Promise<T>, deps: unknown[] = []) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const fnRef = useRef(fn); fnRef.current = fn;
    const reqRef = useRef(0);
    const reload = useCallback(async () => {
        const id = ++reqRef.current; // bỏ qua kết quả của yêu cầu cũ
        setLoading(true); setError(null);
        try { const d = await fnRef.current(); if (id === reqRef.current) setData(d); }
        catch (e: any) { if (id === reqRef.current) setError(e?.response?.status === 403 ? 'Bạn không có quyền truy cập chức năng này.' : e?.response?.data?.message || 'Không tải được dữ liệu.'); }
        finally { if (id === reqRef.current) setLoading(false); }
    }, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { reload(); }, deps);
    return { data, setData, loading, error, reload };
}

/* ---------- UI nhỏ ---------- */
export const Skeleton = ({ h = 120, n = 1 }: { h?: number; n?: number }) => <>{Array.from({ length: n }, (_, i) => <div key={i} className={s.skel} style={{ height: h, marginBottom: 12 }} />)}</>;

export function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
    return <div className={`${s.card} ${s.empty}`}><div className={s.big}>⚠️</div><p>{message}</p><button className={s.btn} onClick={onRetry}>Thử lại</button></div>;
}

export const Empty = ({ icon = '📭', text, action }: { icon?: string; text: string; action?: ReactNode }) => <div className={s.empty}><div className={s.big}>{icon}</div><p>{text}</p>{action}</div>;

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
    useEffect(() => { const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
    return (
        <div className={s.back} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className={`${s.modal} ${wide ? s.modalWide : ''}`} role="dialog" aria-modal="true" aria-label={title}>
                <div className={s.modalHead}><h3>{title}</h3><button className={s.x} onClick={onClose} aria-label="Đóng">×</button></div>
                {children}
            </div>
        </div>
    );
}

export function Field({ label, required, error, hint, children }: { label: string; required?: boolean; error?: string; hint?: string; children: ReactNode }) {
    return <div className={s.field}><label className={s.label}>{label}{required && <span className={s.req}> *</span>}</label>{children}{error ? <div className={s.err}>{error}</div> : hint ? <div className={s.hint}>{hint}</div> : null}</div>;
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
    return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`${s.switch} ${on ? s.switchOn : ''}`} onClick={() => onChange(!on)} />;
}

export const Spin = () => <span className={s.spin} />;

/* ---------- Helpers ---------- */
export const fmtDate = (v?: string | null) => (v ? new Date(v.length === 10 ? v + 'T00:00:00' : v.replace(' ', 'T')).toLocaleDateString('vi-VN') : '—');
export const fmtDateTime = (v?: string | null) => (v ? new Date(v.replace(' ', 'T')).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
export function ago(v?: string | null) {
    if (!v) return 'Chưa rõ';
    const sec = Math.max(1, (Date.now() - new Date(v.replace(' ', 'T')).getTime()) / 1000);
    if (sec < 60) return 'Vừa xong'; if (sec < 3600) return `${Math.floor(sec / 60)} phút trước`;
    if (sec < 86400) return `${Math.floor(sec / 3600)} giờ trước`; if (sec < 2592000) return `${Math.floor(sec / 86400)} ngày trước`;
    return fmtDate(v);
}
export const initials = (n?: string) => (n || '?').trim().split(/\s+/).slice(-2).map((w) => w[0]).join('').toUpperCase();
export const GENDER: Record<string, string> = { male: 'Nam', female: 'Nữ', other: 'Khác' };
const COLORS = ['#0891b2', '#0d9488', '#2563eb', '#d97706', '#0369a1', '#059669', '#7c3aed', '#e11d48', '#0e7490'];
export const colorOf = (t: string) => COLORS[[...t].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];


/* ---------- Tiền tệ & hiển thị ---------- */
export const vnd = (n: number | string | null | undefined) => (Number(n) || 0).toLocaleString('vi-VN') + ' ₫';
export function short(n: number) {
    const a = Math.abs(n);
    if (a >= 1e9) return (n / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' tỷ';
    if (a >= 1e6) return (n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' tr';
    if (a >= 1e3) return (n / 1e3).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + 'K';
    return String(n);
}
export const METHOD: Record<string, string> = { cash: 'Tiền mặt', bank_transfer: 'Chuyển khoản', card: 'Thẻ', ewallet: 'Ví điện tử' };
export const METHOD_COLOR: Record<string, string> = { cash: '#14b8a6', bank_transfer: '#0369a1', card: '#f59e0b', ewallet: '#8b5cf6' };
export const payBadge = (st: string): [string, string] => {
    const m: Record<string, [string, string]> = { paid: ['Đã thu đủ', s.bOk], partial: ['Thu một phần', s.bWarn], unpaid: ['Chưa thu', s.bBad], cancelled: ['Đã hủy', s.bMute] };
    return m[st] || [st, s.bMute];
};
export const overdueBadge = (d: number) => (d <= 0 ? null : <span className={`${s.badge} ${d >= 90 ? s.bBad : s.bWarn}`}>Quá hạn {d} ngày</span>);

export function Pager({ page, last, total, onPage, busy }: { page: number; last: number; total: number; onPage: (p: number) => void; busy?: boolean }) {
    if (last <= 1) return <div className={s.pager}><span className={s.cardSub}>{total} bản ghi</span></div>;
    return (
        <div className={s.pager}>
            <button className={s.btn} disabled={page <= 1 || busy} onClick={() => onPage(page - 1)}>← Trước</button>
            <span className={s.cardSub}>Trang {page}/{last} • {total} bản ghi</span>
            <button className={s.btn} disabled={page >= last || busy} onClick={() => onPage(page + 1)}>Sau →</button>
        </div>
    );
}

export const fp = (f: { year_id: number; period_id: number; grade: number }, extra: Record<string, string | number | undefined> = {}) =>
    ({ year_id: f.year_id, period_id: f.period_id || undefined, grade: f.grade || undefined, ...extra });

export function useDebounced<T>(value: T, ms = 400) {
    const [v, setV] = useState(value);
    useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
    return v;
}