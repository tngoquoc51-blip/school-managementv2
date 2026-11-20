'use client';

import { ChangeEvent, ReactNode, useEffect } from 'react';
import { FIN_LABEL, INV_LABEL, NOTE_STATUS_LABEL, PAY_LABEL, num } from './format';

/* ---------- Icon (SVG nội tuyến, không cần thư viện) ---------- */
const P: Record<string, string> = {
    wallet: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3M3 7h15a2 2 0 0 1 2 2v2m0 0h-4a2 2 0 0 0 0 4h4v-4z',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
    bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
    alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
    check: 'M20 6 9 17l-5-5',
    clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
    refresh: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5',
    plus: 'M12 5v14M5 12h14',
    print: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
    send: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
    note: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5',
    gift: 'M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z',
    chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    home: 'M3 10.5 12 3l9 7.5V21H3zM9 21v-6h6v6',
    moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
    sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
    menu: 'M3 6h18M3 12h18M3 18h18',
    logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
    edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
    trash: 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
    x: 'M18 6 6 18M6 6l12 12',
    file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
    trend: 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
    arrow: 'M5 12h14M12 5l7 7-7 7',
    back: 'M19 12H5M12 19l-7-7 7-7',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
};
export function Icon({ name, size = 18 }: { name: string; size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={P[name] || P.file} />
        </svg>
    );
}

/* ---------- Chips ---------- */
export function FinChip({ s, days }: { s: 'paid' | 'debt' | 'overdue' | 'none'; days?: number }) {
    return <span className={`fx-chip ${s}`}>{FIN_LABEL[s]}{s === 'overdue' && days ? ` ${days} ngày` : ''}</span>;
}
export const InvChip = ({ s }: { s: keyof typeof INV_LABEL }) => <span className={`fx-chip ${s}`}>{INV_LABEL[s]}</span>;
export const PayChip = ({ s }: { s: string }) => <span className={`fx-chip ${s}`}>{PAY_LABEL[s] || s}</span>;
export const StChip = ({ s }: { s: string }) => <span className={`fx-chip ${s}`}>{NOTE_STATUS_LABEL[s] || s}</span>;

export function Bar({ pct }: { pct: number }) {
    const p = Math.max(0, Math.min(100, pct));
    return <div className="fx-bar" title={`${p}%`}><i className={p >= 80 ? '' : p >= 40 ? 'mid' : 'low'} style={{ width: `${p}%` }} /></div>;
}
export function Ring({ pct, color }: { pct: number; color?: string }) {
    return <div className="fx-ring" style={{ ['--p' as string]: Math.min(100, pct), ['--c' as string]: color }}><div>{Math.round(pct)}%</div></div>;
}

export function Empty({ icon = 'file', title, text, action }: { icon?: string; title: string; text?: string; action?: ReactNode }) {
    return (
        <div className="fx-empty">
            <Icon name={icon} size={40} />
            <div className="fx-strong" style={{ color: 'var(--text)' }}>{title}</div>
            {text && <div>{text}</div>}
            {action && <div style={{ marginTop: 12 }}>{action}</div>}
        </div>
    );
}
export function Skeleton({ h = 18, w = '100%', style }: { h?: number; w?: number | string; style?: React.CSSProperties }) {
    return <div className="fx-skel" style={{ height: h, width: w, ...style }} />;
}
export const Spinner = () => <span className="fx-spin" />;

/* ---------- Modal / Drawer ---------- */
export function Modal({ title, onClose, children, footer, size, drawer }: {
    title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: 'lg' | 'xl'; drawer?: boolean;
}) {
    useEffect(() => {
        const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        document.addEventListener('keydown', h);
        return () => document.removeEventListener('keydown', h);
    }, [onClose]);
    return (
        <div className={`fx-ov ${drawer ? 'drawer' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className={`fx-modal ${size || ''}`} role="dialog" aria-modal="true">
                <div className="fx-mh"><h3>{title}</h3><button className="fx-iconbtn fx-print-hide" onClick={onClose} aria-label="Đóng"><Icon name="x" /></button></div>
                <div className="fx-mb">{children}</div>
                {footer && <div className="fx-mf fx-print-hide">{footer}</div>}
            </div>
        </div>
    );
}

/* ---------- Form ---------- */
export function Field({ label, error, children, hint }: { label: string; error?: string; hint?: string; children: ReactNode }) {
    return (
        <div className="fx-field"><label>{label}</label>{children}{hint && <span className="fx-muted fx-small">{hint}</span>}{error && <span className="err">{error}</span>}</div>
    );
}
/** Ô nhập tiền, tự thêm dấu chấm ngăn cách hàng nghìn. */
export function MoneyInput({ value, onChange, placeholder, autoFocus }: { value: number | ''; onChange: (v: number | '') => void; placeholder?: string; autoFocus?: boolean }) {
    const on = (e: ChangeEvent<HTMLInputElement>) => {
        const d = e.target.value.replace(/\D/g, '');
        onChange(d === '' ? '' : Math.min(Number(d), 2000000000));
    };
    return <input className="fx-in fx-num" inputMode="numeric" autoFocus={autoFocus} placeholder={placeholder || '0'} value={value === '' ? '' : num(value)} onChange={on} />;
}