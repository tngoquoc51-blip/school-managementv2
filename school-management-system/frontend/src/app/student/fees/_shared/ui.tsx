'use client';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { feeApi, STATUS } from './api';

export function useFee<T = any>(path: string | null) {
    const [data, setData] = useState<T | null>(null);
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(true);
    const [tick, setTick] = useState(0);
    useEffect(() => {
        if (path === null) return;
        let live = true; setLoading(true); setErr('');
        feeApi<T>(path).then((d) => live && setData(d)).catch((e) => live && setErr(e.message)).finally(() => live && setLoading(false));
        return () => { live = false; };
    }, [path, tick]);
    return { data, err, loading, reload: useCallback(() => setTick((t) => t + 1), []) };
}

export function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
    return (
        <nav className="fe-crumbs" aria-label="Điều hướng">
            {items.map((c, i) => (
                <span key={i}>{c.href ? <Link href={c.href}>{c.label}</Link> : <b>{c.label}</b>}{i < items.length - 1 && <i>/</i>}</span>
            ))}
        </nav>
    );
}

export function Pill({ status, overdue }: { status: string; overdue?: boolean }) {
    if (overdue && status !== 'paid') return <span className="fe-pill err">Quá hạn</span>;
    const s = STATUS[status] || { label: status, tone: 'mut' };
    return <span className={`fe-pill ${s.tone}`}>{s.label}</span>;
}

export function Loading({ text = 'Đang tải dữ liệu học phí…' }: { text?: string }) {
    return <div className="fe-loading"><i className="fe-spin" />{text}</div>;
}
export function ErrorBox({ msg, retry }: { msg: string; retry?: () => void }) {
    return <div className="fe-error" role="alert"><span>{msg}</span>{retry && <button className="fe-btn sm" onClick={retry}>Thử lại</button>}</div>;
}
export function Empty({ title, text }: { title: string; text?: string }) {
    return <div className="fe-empty"><b>{title}</b>{text && <p>{text}</p>}</div>;
}

export function Modal({ title, onClose, children, foot }: { title: string; onClose: () => void; children: ReactNode; foot?: ReactNode }) {
    useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
    return (
        <div className="fe-modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className="fe-modal" role="dialog" aria-modal="true" aria-label={title}>
                <header><h3>{title}</h3><button onClick={onClose} aria-label="Đóng">×</button></header>
                <div className="fe-modal-b">{children}</div>
                {foot && <footer>{foot}</footer>}
            </div>
        </div>
    );
}

export function useToast() {
    const [t, set] = useState<{ ok: boolean; msg: string } | null>(null);
    useEffect(() => { if (!t) return; const id = setTimeout(() => set(null), 4500); return () => clearTimeout(id); }, [t]);
    return {
        ok: (msg: string) => set({ ok: true, msg }), fail: (msg: string) => set({ ok: false, msg }),
        node: t ? <div className={`fe-toast ${t.ok ? 'ok' : 'err'}`} role="status">{t.msg}<button onClick={() => set(null)} aria-label="Đóng">×</button></div> : null,
    };
}

export function Copy({ text, label }: { text: string; label?: string }) {
    const [done, setDone] = useState(false);
    return (
        <button type="button" className="fe-copy" onClick={async () => { try { await navigator.clipboard.writeText(text); } catch { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); } setDone(true); setTimeout(() => setDone(false), 1600); }}>
            {done ? 'Đã chép' : label || 'Sao chép'}
        </button>
    );
}