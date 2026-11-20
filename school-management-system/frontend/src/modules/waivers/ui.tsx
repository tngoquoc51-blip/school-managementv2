'use client';
import React, { ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { STATUS, initials } from './format';

/* ---------------------------------------------------------------- Icon */
const P: Record<string, string> = {
    plus: 'M12 5v14M5 12h14', search: 'M21 21l-4.3-4.3M10.5 18a7.5 7.5 0 110-15 7.5 7.5 0 010 15z', check: 'M5 13l4 4L19 7',
    x: 'M6 6l12 12M18 6L6 18', clock: 'M12 7v5l3 2M12 21a9 9 0 110-18 9 9 0 010 18z',
    percent: 'M19 5L5 19M7.5 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM16.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
    users: 'M17 20v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M10 11a4 4 0 100-8 4 4 0 000 8zM21 20v-1a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8',
    download: 'M12 3v12m0 0l-4-4m4 4l4-4M4 21h16', undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3', edit: 'M4 20h4L19 9l-4-4L4 16v4z',
    file: 'M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5zM14 3v5h5',
    shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z', refresh: 'M20 11a8 8 0 10-2.3 5.7M20 4v7h-7',
    alert: 'M12 9v4m0 4h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
    info: 'M12 16v-4m0-4h.01M12 21a9 9 0 110-18 9 9 0 010 18z', wallet: 'M3 7a2 2 0 012-2h14v4M3 7v10a2 2 0 002 2h16v-4M3 7h16a2 2 0 012 2v2h-4a2 2 0 000 4h4',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01', grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    tag: 'M20 12l-8 8-9-9V3h8l9 9zM7.5 7.5h.01', left: 'M15 6l-6 6 6 6', right: 'M9 6l6 6-6 6', gift: 'M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 110-5C11 2 12 7 12 7zm0 0h4.5a2.5 2.5 0 100-5C13 2 12 7 12 7z',
};
export const Icon = ({ n, size = 16 }: { n: string; size?: number }) => (
    <svg className="wv-ico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={P[n] || P.info} />
    </svg>
);

/* ---------------------------------------------------------------- Toast + Confirm */
type ToastKind = 'success' | 'error' | 'warning' | 'info';
interface Toast { id: number; kind: ToastKind; title: string; msg?: string }
interface ConfirmOpts { title: string; message?: string; okText?: string; danger?: boolean; reason?: { label: string; required?: boolean; placeholder?: string } }

interface Ctx {
    toast: (kind: ToastKind, title: string, msg?: string) => void;
    confirm: (o: ConfirmOpts) => Promise<{ ok: boolean; text: string }>;
}
const UICtx = createContext<Ctx>({ toast: () => {}, confirm: async () => ({ ok: false, text: '' }) });
export const useUI = () => useContext(UICtx);

export function UIProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [dlg, setDlg] = useState<(ConfirmOpts & { resolve: (v: { ok: boolean; text: string }) => void }) | null>(null);
    const [text, setText] = useState('');
    const seq = useRef(0);

    const toast = useCallback((kind: ToastKind, title: string, msg?: string) => {
        const id = ++seq.current;
        setToasts((t) => [...t.slice(-3), { id, kind, title, msg }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
    }, []);

    const confirm = useCallback((o: ConfirmOpts) => new Promise<{ ok: boolean; text: string }>((resolve) => { setText(''); setDlg({ ...o, resolve }); }), []);
    const close = (ok: boolean) => { dlg?.resolve({ ok, text: text.trim() }); setDlg(null); };
    const blocked = !!dlg?.reason?.required && text.trim().length < 3;
    const color = { success: 'check', error: 'alert', warning: 'alert', info: 'info' } as const;

    return (
        <UICtx.Provider value={{ toast, confirm }}>
            {children}
            <div className="wv-toasts" role="status" aria-live="polite">
                {toasts.map((t) => (
                    <div key={t.id} className={`wv-toast ${t.kind}`}>
                        <span className={`wv-stat`}><span className={`ic c-${t.kind === 'success' ? 'ok' : t.kind === 'error' ? 'bad' : t.kind === 'warning' ? 'warn' : 'info'}`} style={{ width: 34, height: 34, borderRadius: 10 }}><Icon n={color[t.kind]} /></span></span>
                        <div><b>{t.title}</b>{t.msg && <span>{t.msg}</span>}</div>
                        <em />
                    </div>
                ))}
            </div>
            {dlg && (
                <>
                    <div className="wv-ov" onClick={() => close(false)} />
                    <div className="wv-modal" role="dialog" aria-modal="true">
                        <h3>{dlg.title}</h3>
                        {dlg.message && <p className="wv-msg">{dlg.message}</p>}
                        {dlg.reason && (
                            <div className="wv-f">
                                <label>{dlg.reason.label}{dlg.reason.required && ' *'}</label>
                                <textarea className="wv-area" rows={3} autoFocus value={text} placeholder={dlg.reason.placeholder} onChange={(e) => setText(e.target.value)} />
                            </div>
                        )}
                        <div className="acts">
                            <button className="wv-btn" onClick={() => close(false)}>Hủy bỏ</button>
                            <button className={`wv-btn ${dlg.danger ? 'bad' : 'pri'}`} disabled={blocked} onClick={() => close(true)}>{dlg.okText || 'Xác nhận'}</button>
                        </div>
                    </div>
                </>
            )}
        </UICtx.Provider>
    );
}

/* ---------------------------------------------------------------- Drawer */
export function Drawer({ title, onClose, children, footer }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
    useEffect(() => {
        const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', k);
        return () => window.removeEventListener('keydown', k);
    }, [onClose]);
    return (
        <>
            <div className="wv-ov" onClick={onClose} />
            <aside className="wv-drawer" role="dialog" aria-modal="true">
                <div className="wv-dh"><h2>{title}</h2><button className="wv-x" onClick={onClose} aria-label="Đóng"><Icon n="x" /></button></div>
                <div className="wv-db">{children}</div>
                {footer && <div className="wv-df">{footer}</div>}
            </aside>
        </>
    );
}

export function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
    useEffect(() => {
        const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', k);
        return () => window.removeEventListener('keydown', k);
    }, [onClose]);
    return (<><div className="wv-ov" onClick={onClose} /><div className="wv-modal" role="dialog" aria-modal="true">{children}</div></>);
}

/* ---------------------------------------------------------------- Small parts */
export const Badge = ({ s, label }: { s: string; label?: string }) => (
    <span className={`wv-badge b-${s}`}><i />{label || STATUS[s] || s}</span>
);

export const Pct = ({ v }: { v: number }) => <span className={`wv-pct ${v >= 100 ? 'full' : ''}`}>{v}%</span>;

export const Avatar = ({ name }: { name: string }) => <span className="wv-av">{initials(name)}</span>;

export const Empty = ({ icon = 'file', title, hint, action }: { icon?: string; title: string; hint?: string; action?: ReactNode }) => (
    <div className="wv-empty"><div className="ic"><Icon n={icon} size={26} /></div><b>{title}</b>{hint && <span>{hint}</span>}{action}</div>
);

export const Skeleton = ({ rows = 6 }: { rows?: number }) => (
    <div style={{ display: 'grid', gap: 14, padding: 18 }}>{Array.from({ length: rows }).map((_, i) => <div key={i} className="wv-sk" style={{ width: `${95 - (i % 3) * 12}%` }} />)}</div>
);

export function Pager({ page, last, total, onPage }: { page: number; last: number; total: number; onPage: (p: number) => void }) {
    return (
        <div className="wv-pager">
            <span>Tổng <b>{total.toLocaleString('vi-VN')}</b> bản ghi · Trang {page}/{last || 1}</span>
            <div>
                <button className="wv-btn sm" disabled={page <= 1} onClick={() => onPage(page - 1)}><Icon n="left" /> Trước</button>
                <button className="wv-btn sm" disabled={page >= last} onClick={() => onPage(page + 1)}>Sau <Icon n="right" /></button>
            </div>
        </div>
    );
}

export function useDebounced<T>(value: T, ms = 300): T {
    const [v, setV] = useState(value);
    useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
    return v;
}