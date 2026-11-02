'use client';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { api } from '../_lib/api';
import './website.css';

/* Các mảnh dùng chung cho 3 trang quản lý website. Chỉ phụ thuộc _lib/api. */

export function useList<T = any>(path: string) {
    const [data, setData] = useState<T | null>(null);
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(true);
    const [tick, setTick] = useState(0);
    useEffect(() => {
        let live = true; setLoading(true); setErr('');
        api<T>(path).then((d) => live && setData(d)).catch((e) => live && setErr(e.message)).finally(() => live && setLoading(false));
        return () => { live = false; };
    }, [path, tick]);
    return { data, err, loading, reload: useCallback(() => setTick((t) => t + 1), []) };
}

export function useToast() {
    const [t, set] = useState<{ ok: boolean; msg: string } | null>(null);
    useEffect(() => { if (!t) return; const id = setTimeout(() => set(null), 4500); return () => clearTimeout(id); }, [t]);
    const node = t ? <div className={`wm-toast ${t.ok ? 'ok' : 'err'}`} role="status">{t.msg}<button onClick={() => set(null)} aria-label="Đóng">×</button></div> : null;
    return { node, ok: (msg: string) => set({ ok: true, msg }), fail: (msg: string) => set({ ok: false, msg }) };
}

export function Modal({ title, onClose, children, foot }: { title: string; onClose: () => void; children: ReactNode; foot?: ReactNode }) {
    useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
    return (
        <div className="wm-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className="wm-modal" role="dialog" aria-modal="true" aria-label={title}>
                <header><h3>{title}</h3><button onClick={onClose} aria-label="Đóng">×</button></header>
                <div className="wm-mb">{children}</div>
                {foot && <footer>{foot}</footer>}
            </div>
        </div>
    );
}

export function Field({ label, req, err, hint, children }: { label: string; req?: boolean; err?: string; hint?: string; children: ReactNode }) {
    return <div className={`wm-f ${err ? 'bad' : ''}`}><label>{label}{req && <i> *</i>}</label>{children}{err ? <small className="er">{err}</small> : hint ? <small>{hint}</small> : null}</div>;
}

export function Pager({ page, pages, total, unit, onChange }: { page: number; pages: number; total: number; unit: string; onChange: (p: number) => void }) {
    return (
        <div className="wm-foot">
            <span>Tổng <b>{total}</b> {unit}</span>
            {pages > 1 && <div className="wm-pager">
                <button className="wm-btn ghost sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>‹ Trước</button>
                <span>Trang <b>{page}</b> / {pages}</span>
                <button className="wm-btn ghost sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Sau ›</button>
            </div>}
        </div>
    );
}

export const dt = (s: string | null | undefined) => { if (!s) return ''; const d = new Date(s.replace(' ', 'T')); return isNaN(+d) ? s : d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
export const dd = (s: string | null | undefined) => (s ? s.slice(0, 10).split('-').reverse().join('/') : '');

export function useDebounced(v: string, ms = 350) {
    const [d, setD] = useState(v);
    useEffect(() => { const id = setTimeout(() => setD(v), ms); return () => clearTimeout(id); }, [v, ms]);
    return d;
}

/** Xuất CSV có BOM để Excel đọc đúng tiếng Việt. */
export function downloadCsv(name: string, head: string[], rows: (string | number | null)[][]) {
    const esc = (x: string | number | null) => `"${String(x ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
    const text = '﻿' + [head, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

/** Ngăn chi tiết trượt từ bên phải. Esc hoặc bấm nền để đóng. */
export function Drawer({ title, sub, onClose, children, foot }: { title: string; sub?: string; onClose: () => void; children: ReactNode; foot?: ReactNode }) {
    useEffect(() => {
        const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', k);
        const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
        return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev; };
    }, [onClose]);
    return (
        <div className="wm-bg wm-bg-r" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <aside className="wm-drawer" role="dialog" aria-modal="true" aria-label={title}>
                <header><div><h3>{title}</h3>{sub && <p>{sub}</p>}</div><button onClick={onClose} aria-label="Đóng">×</button></header>
                <div className="wm-drawer-b">{children}</div>
                {foot && <footer>{foot}</footer>}
            </aside>
        </div>
    );
}