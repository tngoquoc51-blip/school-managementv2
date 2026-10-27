'use client';
import { ReactNode, createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, Staff } from '../_lib/api';

/* ---------- phiên đăng nhập (cấp bởi layout) ---------- */
export const StaffCtx = createContext<{ staff: Staff | null; logout: () => void }>({ staff: null, logout: () => {} });
export const useStaff = () => useContext(StaffCtx);

/* ---------- tải dữ liệu ---------- */
export function useApi<T = any>(path: string | null) {
    const [data, setData] = useState<T | null>(null);
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(true);
    const [tick, setTick] = useState(0);
    useEffect(() => {
        if (path === null) return;
        let live = true;
        setLoading(true); setErr('');
        api<T>(path).then((d) => live && setData(d)).catch((e) => live && setErr(e.message)).finally(() => live && setLoading(false));
        return () => { live = false; };
    }, [path, tick]);
    const reload = useCallback(() => setTick((t) => t + 1), []);
    return { data, err, loading, reload };
}

/* ---------- thông báo ---------- */
export function useToast() {
    const [t, setT] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
    useEffect(() => { if (!t) return; const id = setTimeout(() => setT(null), 5000); return () => clearTimeout(id); }, [t]);
    return { t, ok: (msg: string) => setT({ kind: 'ok', msg }), fail: (msg: string) => setT({ kind: 'err', msg }), clear: () => setT(null) };
}
export function Toast({ t, clear }: { t: { kind: 'ok' | 'err'; msg: string } | null; clear: () => void }) {
    if (!t) return null;
    return <div className={`pd-toast ${t.kind}`} role="status" onClick={clear}>{t.msg}</div>;
}

/* ---------- thành phần nhỏ ---------- */
export const Chip = ({ tone = 'mut', children }: { tone?: string; children: ReactNode }) => <span className={`pd-chip ${tone}`}>{children}</span>;

export function Loading({ text = 'Đang tải dữ liệu…' }: { text?: string }) {
    return <div className="pd-loading"><i className="pd-spin" />{text}</div>;
}
export function ErrorBox({ msg, retry }: { msg: string; retry?: () => void }) {
    return <div className="pd-error" role="alert"><b>Không tải được dữ liệu</b><span>{msg}</span>{retry && <button className="pd-btn ghost sm" onClick={retry}>Thử lại</button>}</div>;
}
export const Empty = ({ text, children }: { text: string; children?: ReactNode }) => <div className="pd-empty"><p>{text}</p>{children}</div>;

export function Stat({ label, value, hint, tone = 'pri', icon }: { label: string; value: ReactNode; hint?: ReactNode; tone?: string; icon?: ReactNode }) {
    return (
        <div className={`pd-stat ${tone}`}>
            {icon && <i className="pd-stat-i" aria-hidden>{icon}</i>}
            <div><span>{label}</span><b>{value}</b>{hint && <em>{hint}</em>}</div>
        </div>
    );
}

export function Progress({ paid, pending = 0, total, tall = false }: { paid: number; pending?: number; total: number; tall?: boolean }) {
    const p = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
    const q = total > 0 ? Math.min(100 - p, (pending / total) * 100) : 0;
    return (
        <div className={`pd-prog ${tall ? 'tall' : ''}`} role="progressbar" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100}>
            <i className="ok" style={{ width: `${p}%` }} /><i className="pend" style={{ width: `${q}%` }} />
        </div>
    );
}

export function Card({ title, right, children, pad = true, className = '' }: { title?: ReactNode; right?: ReactNode; children: ReactNode; pad?: boolean; className?: string }) {
    return (
        <section className={`pd-card ${className}`}>
            {(title || right) && <header className="pd-card-h"><h2>{title}</h2>{right}</header>}
            <div className={pad ? 'pd-card-b' : ''}>{children}</div>
        </section>
    );
}

export function Modal({ title, onClose, children, foot, wide = false }: { title: string; onClose: () => void; children: ReactNode; foot?: ReactNode; wide?: boolean }) {
    useEffect(() => {
        const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', k);
        return () => window.removeEventListener('keydown', k);
    }, [onClose]);
    return (
        <div className="pd-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className={`pd-modal-box ${wide ? 'wide' : ''}`}>
                <header><h3>{title}</h3><button className="pd-x" onClick={onClose} aria-label="Đóng">×</button></header>
                <div className="pd-modal-b">{children}</div>
                {foot && <footer>{foot}</footer>}
            </div>
        </div>
    );
}

export function Pager({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
    if (pages <= 1) return null;
    const nums: (number | '…')[] = [];
    for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i); else if (nums[nums.length - 1] !== '…') nums.push('…');
    return (
        <nav className="pd-pager" aria-label="Phân trang">
            <button disabled={page <= 1} onClick={() => onChange(page - 1)}>‹ Trước</button>
            {nums.map((n, i) => n === '…' ? <span key={`e${i}`}>…</span> : <button key={n} className={n === page ? 'on' : ''} onClick={() => onChange(n)}>{n}</button>)}
            <button disabled={page >= pages} onClick={() => onChange(page + 1)}>Sau ›</button>
        </nav>
    );
}

export function Field({ label, error, hint, children, htmlFor }: { label: string; error?: string; hint?: string; children: ReactNode; htmlFor?: string }) {
    return (
        <div className={`pd-field ${error ? 'bad' : ''}`}>
            <label htmlFor={htmlFor}>{label}</label>
            {children}
            {error ? <span className="er">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
        </div>
    );
}

/* Biểu tượng nhỏ dùng trong thẻ thống kê */
export const Ico = ({ d, s = 20 }: { d: string; s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
);
export const ICON = {
    cash: 'M3 7h18v10H3zM12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM6 10v.01M18 14v.01',
    clock: 'M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    check: 'M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    alert: 'M12 3l10 18H2L12 3zM12 10v4M12 17.5v.01',
    doc: 'M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6',
    users: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M22 21v-2a4 4 0 00-3-3.9',
    percent: 'M19 5L5 19M7 7.5a1.5 1.5 0 100-.01M17 16.5a1.5 1.5 0 100-.01',
    hourglass: 'M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9',
};