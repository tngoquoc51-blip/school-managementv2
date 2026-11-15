'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

/* ---------- Helpers ---------- */
export const num = (v: any) => Number(v) || 0;
export const fmt = (v: any, d = 1) =>
    num(v).toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d });
export const sgn = (v: any) => {
    const n = num(v);
    return (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n), Number.isInteger(n) ? 0 : 1);
};
const parse = (s: string) => new Date(s.length <= 10 ? s + 'T00:00:00' : s.replace(' ', 'T'));
export const fdt = (s?: string | null) => {
    if (!s) return '—';
    const d = parse(s);
    return isNaN(+d) ? s : d.toLocaleDateString('vi-VN');
};
export const ftime = (s?: string | null) => {
    if (!s) return '';
    const d = parse(s);
    return isNaN(+d) ? s : d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};
export const todayStr = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export const CAT_COLOR: Record<string, string> = {
    nenep: '#2F6A9E', hoctap: '#6A4FB3', vesinh: '#1E8F7A', laodong: '#B7791F', phongtrao: '#C2410C', khac: '#6B7A7C',
};
export const KIND: Record<string, { label: string; tone: string }> = {
    khen_thuong: { label: 'Khen thưởng', tone: 'good' },
    nhac_nho: { label: 'Nhắc nhở', tone: 'warn' },
    ky_luat: { label: 'Kỷ luật', tone: 'bad' },
};
export const STATUS: Record<string, { label: string; tone: string }> = {
    pending: { label: 'Chờ duyệt', tone: 'warn' },
    approved: { label: 'Đã duyệt', tone: 'good' },
    rejected: { label: 'Từ chối', tone: 'bad' },
};

/* ---------- Icon ---------- */
const P: Record<string, string> = {
    star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3z',
    print: 'M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v7H6z',
    home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
    trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3',
    edit: 'M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4',
    award: 'M12 15a6 6 0 100-12 6 6 0 000 12zM8.5 14L7 22l5-3 5 3-1.5-8',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    log: 'M12 8v4l3 2M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5',
    plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', x: 'M6 6l12 12M18 6L6 18', check: 'M5 13l4 4L19 7',
    search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3', back: 'M15 6l-6 6 6 6',
    alert: 'M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
    info: 'M12 16v-4M12 8h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    up: 'M6 15l6-6 6 6', down: 'M6 9l6 6 6-6',
    user: 'M20 21a8 8 0 10-16 0M12 11a4 4 0 100-8 4 4 0 000 8z',
    users: 'M17 20v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M10 11a4 4 0 100-8 4 4 0 000 8zM21 20v-1a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8',
    ext: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6', refresh: 'M20 11a8 8 0 10-2.3 6M20 4v7h-7',
    flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
};
export function Icon({ n, s = 18 }: { n: string; s?: number }) {
    return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={P[n] || ''} />
        </svg>
    );
}

/* ---------- Small components ---------- */
export const Skeleton = ({ h = 110 }: { h?: number }) => <div className="rw-skel" style={{ height: h }} />;

export const Empty = ({ icon = 'info', text }: { icon?: string; text: string }) => (
    <div className="rw-empty"><Icon n={icon} s={28} /><p>{text}</p></div>
);

export function Delta({ v }: { v?: number | null }) {
    if (v == null) return <span className="dl flat">—</span>;
    if (v === 0) return <span className="dl flat">=</span>;
    return <span className={`dl ${v > 0 ? 'up' : 'dn'}`}><Icon n={v > 0 ? 'up' : 'down'} s={13} />{Math.abs(v)}</span>;
}

export function Spark({ data, w = 260, h = 64 }: { data: number[]; w?: number; h?: number }) {
    if (data.length < 2) return null;
    const mn = Math.min(...data), mx = Math.max(...data), r = mx - mn || 1, p = 6;
    const pts = data.map((v, i) => [p + (i * (w - 2 * p)) / (data.length - 1), p + (h - 2 * p) * (1 - (v - mn) / r)]);
    const last = pts[pts.length - 1];
    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="spark" role="img" aria-label="Xu hướng điểm theo tuần">
            <polyline points={pts.map((q) => q.join(',')).join(' ')} fill="none" stroke="var(--teal)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={last[0]} cy={last[1]} r="4" fill="var(--brass)" />
        </svg>
    );
}

/* ---------- Modal / Drawer ---------- */
export function Modal({ title, onClose, children, footer, small, drawer }: {
    title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; small?: boolean; drawer?: boolean;
}) {
    useEffect(() => {
        const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        document.addEventListener('keydown', h);
        return () => document.removeEventListener('keydown', h);
    }, [onClose]);

    return (
        <div className="rw-ov" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className={`rw-modal${small ? ' sm' : ''}${drawer ? ' drawer' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
                <header><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="Đóng"><Icon n="x" /></button></header>
                <div className="body">{children}</div>
                {footer && <footer>{footer}</footer>}
            </div>
        </div>
    );
}

/* ---------- Toast + Confirm ---------- */
type TT = 'success' | 'error' | 'info' | 'warn';
interface Ctx {
    toast: (t: TT, title: string, msg?: string) => void;
    confirm: (o: { title: string; msg: string; ok?: string; danger?: boolean }) => Promise<boolean>;
}
const UICtx = createContext<Ctx>({ toast: () => {}, confirm: async () => false });
export const useUI = () => useContext(UICtx);
const TICON: Record<TT, string> = { success: 'check', error: 'x', warn: 'alert', info: 'info' };

export function UIProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<{ id: number; type: TT; title: string; msg?: string }[]>([]);
    const [cf, setCf] = useState<any>(null);

    const drop = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));
    const toast = useCallback((type: TT, title: string, msg?: string) => {
        const id = Date.now() + Math.random();
        setToasts((t) => [...t.slice(-3), { id, type, title, msg }]);
        setTimeout(() => drop(id), 4800);
    }, []);
    const confirm = useCallback(
        (o: any) => new Promise<boolean>((res) => setCf({ ...o, res })), []);
    const done = (v: boolean) => { cf?.res(v); setCf(null); };

    return (
        <UICtx.Provider value={{ toast, confirm }}>
            {children}
            <div className="rw-toasts" role="status" aria-live="polite">
                {toasts.map((t) => (
                    <div key={t.id} className={`rw-toast ${t.type}`}>
                        <span className="ic"><Icon n={TICON[t.type]} s={16} /></span>
                        <div><b>{t.title}</b>{t.msg && <p>{t.msg}</p>}</div>
                        <button onClick={() => drop(t.id)} aria-label="Đóng"><Icon n="x" s={14} /></button>
                        <i className="bar" />
                    </div>
                ))}
            </div>
            {cf && (
                <Modal title={cf.title} small onClose={() => done(false)}
                       footer={<>
                           <button className="btn ghost" onClick={() => done(false)}>Hủy</button>
                           <button className={`btn ${cf.danger ? 'danger' : 'primary'}`} onClick={() => done(true)}>{cf.ok || 'Xác nhận'}</button>
                       </>}>
                    <p className="muted">{cf.msg}</p>
                </Modal>
            )}
        </UICtx.Provider>
    );
}