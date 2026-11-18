'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

/* ---------- Thông báo (toast) ---------- */
type ToastKind = 'success' | 'error' | 'warn' | 'info';
interface ToastItem { id: number; kind: ToastKind; title: string; text?: string }
const ToastCtx = createContext<(kind: ToastKind, title: string, text?: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<ToastItem[]>([]);
    const push = useCallback((kind: ToastKind, title: string, text?: string) => {
        const id = Date.now() + Math.random();
        setItems((s) => [...s.slice(-3), { id, kind, title, text }]);
        setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), kind === 'error' ? 6500 : 3800);
    }, []);
    const icon = { success: '✓', error: '!', warn: '⚠', info: 'i' };
    return (
        <ToastCtx.Provider value={push}>
            {children}
            <div className="acs-toasts" role="status" aria-live="polite">
                {items.map((t) => (
                    <div key={t.id} className={`acs-toast ${t.kind}`}>
                        <strong>{icon[t.kind]}</strong>
                        <div><b>{t.title}</b>{t.text && <span>{t.text}</span>}</div>
                    </div>
                ))}
            </div>
        </ToastCtx.Provider>
    );
}

/* ---------- Ô nhập ---------- */
export function Field({ label, error, hint, span, children }: {
    label: string; error?: string; hint?: string; span?: boolean; children: ReactNode;
}) {
    return (
        <div className={`acs-f${error ? ' err' : ''}${span ? ' acs-span' : ''}`}>
            <label>{label}</label>
            {children}
            {error ? <div className="msg">{error}</div> : hint ? <div className="hint">{hint}</div> : null}
        </div>
    );
}

export function Switch({ checked, onChange, title, desc }: {
    checked: boolean; onChange: (v: boolean) => void; title: string; desc?: string;
}) {
    return (
        <label className="acs-sw">
            <div><b>{title}</b>{desc && <small>{desc}</small>}</div>
            <span className="acs-switch">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span />
      </span>
        </label>
    );
}

export function Card({ title, desc, children, footer }: {
    title: string; desc?: string; children: ReactNode; footer?: ReactNode;
}) {
    return (
        <section className="acs-card">
            <header><div><h2>{title}</h2>{desc && <p>{desc}</p>}</div></header>
            {children}
            {footer}
        </section>
    );
}

export function Modal({ title, onClose, children, footer }: {
    title: string; onClose: () => void; children: ReactNode; footer?: ReactNode;
}) {
    useEffect(() => {
        const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [onClose]);
    return (
        <div className="acs-modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className="acs-dialog" role="dialog" aria-modal="true">
                <header><h3>{title}</h3><button className="acs-x" onClick={onClose} aria-label="Đóng">×</button></header>
                <div className="acs-pad">{children}</div>
                {footer && <div className="acs-foot">{footer}</div>}
            </div>
        </div>
    );
}

export function Confirm({ title, text, okText = 'Xác nhận', danger, busy, onOk, onCancel }: {
    title: string; text: string; okText?: string; danger?: boolean; busy?: boolean; onOk: () => void; onCancel: () => void;
}) {
    return (
        <Modal title={title} onClose={onCancel} footer={
            <>
                <button className="acs-btn ghost" onClick={onCancel}>Hủy</button>
                <button className={`acs-btn${danger ? ' danger' : ''}`} disabled={busy} onClick={onOk}>{busy ? 'Đang xử lý…' : okText}</button>
            </>
        }>
            <p style={{ margin: 0, lineHeight: 1.6 }}>{text}</p>
        </Modal>
    );
}

export function Skeleton({ rows = 5 }: { rows?: number }) {
    return <div>{Array.from({ length: rows }).map((_, i) => <div key={i} className="acs-skel" style={{ width: `${70 + ((i * 13) % 28)}%` }} />)}</div>;
}

/* ---------- Tiện ích ---------- */
export const money = (n: number | string) => new Intl.NumberFormat('vi-VN').format(Number(n || 0)) + 'đ';
export const dt = (s?: string | null) => {
    if (!s) return '—';
    const d = new Date(s.replace(' ', 'T'));
    return isNaN(+d) ? s : d.toLocaleString('vi-VN', { hour12: false });
};
export const CATEGORY: Record<string, string> = {
    tuition: 'Học phí', insurance: 'Bảo hiểm', fund: 'Quỹ', service: 'Dịch vụ', uniform: 'Đồng phục', other: 'Khác',
};