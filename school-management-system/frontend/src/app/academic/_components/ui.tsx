'use client';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { api } from '../_lib/api';

/* Tải dữ liệu từ API với trạng thái loading/error */
export function useApi<T = any>(path: string | null) {
    const [data, setData] = useState<T | null>(null);
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(true);
    const [tick, setTick] = useState(0);
    useEffect(() => {
        if (path === null) return;
        let live = true; setLoading(true); setErr('');
        api<T>(path).then((d) => live && setData(d)).catch((e) => live && setErr(e.message)).finally(() => live && setLoading(false));
        return () => { live = false; };
    }, [path, tick]);
    const reload = useCallback(() => setTick((t) => t + 1), []);
    return { data, err, loading, reload };
}

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
    return (
        <div className="ac-head">
            <div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>
            {actions && <div className="ac-head-act">{actions}</div>}
        </div>
    );
}

export function Card({ title, right, children, pad = true }: { title?: string; right?: ReactNode; children: ReactNode; pad?: boolean }) {
    return (
        <section className="ac-card">
            {(title || right) && <header className="ac-card-h"><h2>{title}</h2>{right}</header>}
            <div className={pad ? 'ac-card-b' : ''}>{children}</div>
        </section>
    );
}

export function Stat({ label, value, hint, tone = 'pri' }: { label: string; value: ReactNode; hint?: string; tone?: 'pri' | 'ok' | 'warn' | 'err' }) {
    return (
        <div className={`ac-stat ${tone}`}>
            <span>{label}</span><b>{value}</b>{hint && <em>{hint}</em>}
        </div>
    );
}

export function Loading({ text = 'Đang tải dữ liệu…' }: { text?: string }) {
    return <div className="ac-loading"><i className="ac-spin" />{text}</div>;
}
export function ErrorBox({ msg, retry }: { msg: string; retry?: () => void }) {
    return <div className="ac-error">{msg}{retry && <button className="ac-btn sm" onClick={retry}>Thử lại</button>}</div>;
}
export function Empty({ text }: { text: string }) { return <div className="ac-empty">{text}</div>; }

const RANK_CLS: Record<string, string> = { 'Giỏi': 'ok', 'Khá': 'pri', 'Trung bình': 'warn', 'Yếu': 'err', 'Kém': 'err', 'Tốt': 'ok', 'Đạt': 'warn', 'Chưa đạt': 'err' };
export function Pill({ children, tone }: { children: ReactNode; tone?: string }) {
    const t = tone || (typeof children === 'string' ? RANK_CLS[children] : '') || 'mut';
    return <span className={`ac-pill ${t}`}>{children}</span>;
}

export function Pager({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
    if (pages <= 1) return null;
    return (
        <div className="ac-pager">
            <button className="ac-btn sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>‹ Trước</button>
            <span>Trang <b>{page}</b> / {pages}</span>
            <button className="ac-btn sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Sau ›</button>
        </div>
    );
}

export function Toast({ t, clear }: { t: { ok: boolean; msg: string } | null; clear: () => void }) {
    useEffect(() => { if (!t) return; const id = setTimeout(clear, 4500); return () => clearTimeout(id); }, [t, clear]);
    if (!t) return null;
    return <div className={`ac-toast ${t.ok ? 'ok' : 'err'}`} role="status">{t.msg}<button onClick={clear} aria-label="Đóng">×</button></div>;
}
export function useToast() {
    const [t, set] = useState<{ ok: boolean; msg: string } | null>(null);
    const clear = useCallback(() => set(null), []);
    return { t, clear, ok: (msg: string) => set({ ok: true, msg }), fail: (msg: string) => set({ ok: false, msg }) };
}

export function Modal({ title, onClose, children, foot }: { title: string; onClose: () => void; children: ReactNode; foot?: ReactNode }) {
    useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
    return (
        <div className="ac-modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className="ac-modal" role="dialog" aria-modal="true" aria-label={title}>
                <header><h3>{title}</h3><button onClick={onClose} aria-label="Đóng">×</button></header>
                <div className="ac-modal-b">{children}</div>
                {foot && <footer>{foot}</footer>}
            </div>
        </div>
    );
}

/* Biểu đồ cột ngang đơn giản (không cần thư viện) */
export function Bars({ items, max }: { items: { label: string; value: number; tone?: string }[]; max?: number }) {
    const m = max ?? Math.max(1, ...items.map((i) => i.value));
    return (
        <div className="ac-bars">
            {items.map((i) => (
                <div key={i.label} className="ac-bar">
                    <span>{i.label}</span>
                    <div><i className={i.tone || 'pri'} style={{ width: `${(i.value / m) * 100}%` }} /></div>
                    <b>{i.value}</b>
                </div>
            ))}
        </div>
    );
}

export const fmt = (n: number | null | undefined, d = 2) => (n === null || n === undefined ? '—' : n.toFixed(d));
export const fmtDT = (s: string | null) => { if (!s) return ''; const d = new Date(s.replace(' ', 'T')); return isNaN(+d) ? s : d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };

/* Đọc tham số từ URL (?class_id=…) mà không dùng useSearchParams */
export function useInitialParam(name: string) {
    const [v, setV] = useState('');
    const [ready, setReady] = useState(false);
    useEffect(() => { try { setV(new URLSearchParams(window.location.search).get(name) || ''); } catch {} setReady(true); }, [name]);
    return [v, setV, ready] as const;
}