'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';

/* ---------- Icon (SVG nội tuyến, không cần thư viện) ---------- */
const P: Record<string, string> = {
    dashboard: 'M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z',
    school: 'M12 3 2 8l10 5 8-4v6h2V8zM6 12.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-3.5l-6 3z',
    palette: 'M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.3-.5-.8-.5-1.2 0-1.1.9-2 2-2h2.4c2 0 3.6-1.6 3.6-3.6C21 7 17 3 12 3zM7.5 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z',
    calendar: 'M7 2v3M17 2v3M3 9h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    award: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.2 13.9 7 22l5-3 5 3-1.2-8.1',
    shield: 'M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5zM9 12l2 2 4-4',
    monitor: 'M3 4h18v12H3zM8 20h8M12 16v4',
    file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
    mail: 'M3 5h18v14H3zM3 6l9 7 9-7',
    bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
    database: 'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6',
    wrench: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z',
    phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
    globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z',
    image: 'M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 16l-5-5-8 9',
    key: 'M15 7a4 4 0 1 1-3.9 4.9L3 20v-3l2-2 2 1 1-2 3-3A4 4 0 0 1 15 7zM16.5 8.5h.01',
    lock: 'M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5zM12 15v3',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
    send: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
    clipboard: 'M9 4h6v3H9zM7 5H5v16h14V5h-2M8.5 12l2 2 4-4',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3',
    check: 'M5 12l5 5 9-10',
    x: 'M6 6l12 12M18 6 6 18',
    plus: 'M12 5v14M5 12h14',
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
    download: 'M12 3v12M7 10l5 5 5-5M4 21h16',
    refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
    alert: 'M12 3 2 20h20zM12 10v4M12 17h.01',
    info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    moon: 'M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z',
    sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
    star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
    undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
    power: 'M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0',
};
export function Icon({ name, size = 18 }: { name: string; size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={P[name] || P.info} />
        </svg>
    );
}
export const Spin = () => <span className="st-spin" />;

/* ---------- Toast ---------- */
type Kind = 'ok' | 'err' | 'info' | 'warn';
interface T { id: number; kind: Kind; title: string; text?: string }
const ToastCtx = createContext<(kind: Kind, title: string, text?: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<T[]>([]);
    const push = useCallback((kind: Kind, title: string, text?: string) => {
        const id = Date.now() + Math.random();
        setItems((s) => [...s.slice(-3), { id, kind, title, text }]);
        setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), kind === 'err' ? 6500 : 3800);
    }, []);
    const icon: Record<Kind, string> = { ok: 'check', err: 'alert', info: 'info', warn: 'alert' };
    const color: Record<Kind, string> = { ok: 'var(--st-ok)', err: 'var(--st-bad)', info: 'var(--st-info)', warn: 'var(--st-warn)' };
    return (
        <ToastCtx.Provider value={push}>
            {children}
            <div className="st-toasts" role="status" aria-live="polite">
                {items.map((t) => (
                    <div key={t.id} className={`st-toast ${t.kind}`}>
                        <span style={{ color: color[t.kind] }}><Icon name={icon[t.kind]} size={20} /></span>
                        <div><b>{t.title}</b>{t.text && <span>{t.text}</span>}</div>
                    </div>
                ))}
            </div>
        </ToastCtx.Provider>
    );
}

/* ---------- Modal / Drawer ---------- */
export function Modal({ title, onClose, children, footer, right }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; right?: boolean }) {
    useEffect(() => {
        const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [onClose]);
    return (
        <div className={`st-ov ${right ? 'right' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className="st-modal" role="dialog" aria-modal="true" aria-label={title}>
                <header><h3>{title}</h3><button className="st-btn ghost sm" onClick={onClose} aria-label="Đóng"><Icon name="x" /></button></header>
                <div className="mb">{children}</div>
                {footer && <footer>{footer}</footer>}
            </div>
        </div>
    );
}

/* ---------- Confirm (promise) ---------- */
interface CO { title: string; text?: ReactNode; okText?: string; danger?: boolean; typeToConfirm?: string }
const ConfirmCtx = createContext<(o: CO) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
    const [o, setO] = useState<CO | null>(null);
    const [typed, setTyped] = useState('');
    const res = useRef<(v: boolean) => void>(() => {});
    const ask = useCallback((opt: CO) => new Promise<boolean>((r) => { res.current = r; setTyped(''); setO(opt); }), []);
    const done = (v: boolean) => { res.current(v); setO(null); };
    return (
        <ConfirmCtx.Provider value={ask}>
            {children}
            {o && (
                <Modal title={o.title} onClose={() => done(false)} footer={<>
                    <button className="st-btn" onClick={() => done(false)}>Hủy</button>
                    <button className={`st-btn ${o.danger ? 'dng solid' : 'pri'}`} disabled={!!o.typeToConfirm && typed !== o.typeToConfirm} onClick={() => done(true)}>{o.okText || 'Xác nhận'}</button>
                </>}>
                    {o.text && <div style={{ color: 'var(--st-muted)' }}>{o.text}</div>}
                    {o.typeToConfirm && (
                        <div className="st-field">
                            <label className="lb">Gõ <code>{o.typeToConfirm}</code> để xác nhận</label>
                            <input className="st-in" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} />
                        </div>
                    )}
                </Modal>
            )}
        </ConfirmCtx.Provider>
    );
}

/* ---------- Thành phần nhỏ ---------- */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
    return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`st-sw ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />;
}
export function Badge({ kind = '', children }: { kind?: '' | 'ok' | 'warn' | 'bad' | 'info' | 'pri'; children: ReactNode }) {
    return <span className={`st-badge ${kind}`}>{children}</span>;
}
export function Field({ label, hint, error, children, wide }: { label: string; hint?: string; error?: string; children: ReactNode; wide?: boolean }) {
    return (
        <div className={`st-field ${wide ? 'wide' : ''}`}>
            <label className="lb">{label}</label>
            {children}
            {error ? <div className="err">{error}</div> : hint ? <div className="hint">{hint}</div> : null}
        </div>
    );
}
export function Card({ icon, title, desc, actions, children, flush }: { icon?: string; title?: string; desc?: string; actions?: ReactNode; children: ReactNode; flush?: boolean }) {
    return (
        <section className="st-card">
            {title && (
                <header>
                    {icon && <span className="ic"><Icon name={icon} /></span>}
                    <div className="grow"><h3>{title}</h3>{desc && <p>{desc}</p>}</div>
                    {actions}
                </header>
            )}
            {flush ? children : <div className="pad">{children}</div>}
        </section>
    );
}
export function Skeleton({ rows = 4 }: { rows?: number }) {
    return <div style={{ display: 'grid', gap: 12 }}>{Array.from({ length: rows }).map((_, i) => <div key={i} className="st-skel" style={{ height: i === 0 ? 120 : 64 }} />)}</div>;
}
export function Empty({ icon = 'file', text }: { icon?: string; text: string }) {
    return <div className="st-empty"><div style={{ opacity: .5, marginBottom: 8 }}><Icon name={icon} size={34} /></div>{text}</div>;
}
export function Btn({ busy, icon, children, kind = '', ...p }: any) {
    return <button {...p} disabled={busy || p.disabled} className={`st-btn ${kind} ${p.className || ''}`}>{busy ? <Spin /> : icon ? <Icon name={icon} size={16} /> : null}{children}</button>;
}