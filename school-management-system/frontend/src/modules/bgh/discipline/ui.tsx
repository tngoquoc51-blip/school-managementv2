'use client';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RANK_TONE, SEVERITY, STATUS } from './constants';
import type { Rank, Status } from './types';

/* ------------------------------ icons ------------------------------ */
const P: Record<string, string> = {
    home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
    alert: 'M12 3l10 18H2L12 3zM12 10v5M12 18h.01',
    star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.2 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3z',
    scale: 'M12 3v18M5 7h14M5 7l-3 7a3 3 0 006 0L5 7zm14 0l-3 7a3 3 0 006 0l-3-7z',
    user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
    gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12l2-1-2-4-2 .5-1.5-1L15 4h-4l-.5 2.5-1.5 1L7 7 5 11l2 1v2l-2 1 2 4 2-.5 1.5 1L11 20h4l.5-2.5 1.5-1 2 .5 2-4-2-1v-2z',
    chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
    bell: 'M6 9a6 6 0 1112 0c0 6 2 7 2 7H4s2-1 2-7zM10 20a2 2 0 004 0',
    plus: 'M12 5v14M5 12h14', x: 'M6 6l12 12M18 6L6 18', check: 'M5 12l5 5 9-10',
    search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-5-5', back: 'M15 6l-6 6 6 6',
    download: 'M12 4v11m0 0l-4-4m4 4l4-4M4 20h16', inbox: 'M3 13l3-8h12l3 8v6H3v-6zm0 0h5l1 3h6l1-3h5',
    clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2', info: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v6M12 8h.01',
    ok: 'M12 21a9 9 0 100-18 9 9 0 000 18zM8 12l3 3 5-6', err: 'M12 21a9 9 0 100-18 9 9 0 000 18zM9 9l6 6M15 9l-6 6',
    file: 'M7 3h7l5 5v13H7V3zM14 3v5h5', edit: 'M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4', trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
    shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z', chat: 'M4 5h16v11H9l-5 4V5z',
};
export const Icon = ({ n, className = '' }: { n: keyof typeof P | string; className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={P[n] ?? P.info} />
    </svg>
);

/* Render ra <body> để modal/drawer/toast phủ toàn màn hình, không bị layout cha cắt. */
export function Portal({ children }: { children: ReactNode }) {
    const [ok, setOk] = useState(false);
    useEffect(() => setOk(true), []);
    return ok ? createPortal(<div className="dc-portal">{children}</div>, document.body) : null;
}

/* ------------------------- toast + confirm ------------------------- */
type ToastKind = 'success' | 'error' | 'warn' | 'info';
interface ToastItem { id: number; kind: ToastKind; title: string; text?: string; ms: number }
interface ConfirmOpts { title: string; text?: string; okLabel?: string; tone?: 'danger' | 'primary' | 'ok' }
interface Ctx {
    toast: (kind: ToastKind, title: string, text?: string) => void;
    confirm: (o: ConfirmOpts) => Promise<boolean>;
}
const UICtx = createContext<Ctx>({ toast: () => {}, confirm: async () => false });
export const useUI = () => useContext(UICtx);

export function UIProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<ToastItem[]>([]);
    const [dlg, setDlg] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
    const seq = useRef(0);

    const toast = useCallback((kind: ToastKind, title: string, text?: string) => {
        const id = ++seq.current;
        const ms = kind === 'error' ? 6500 : 4000;
        setItems((s) => [...s.slice(-3), { id, kind, title, text, ms }]);
        setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), ms);
    }, []);
    const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setDlg({ ...o, resolve })), []);
    const icon = { success: 'ok', error: 'err', warn: 'alert', info: 'info' } as const;

    return (
        <UICtx.Provider value={{ toast, confirm }}>
            {children}
            <Portal><div className="dc-toasts" role="status" aria-live="polite">
                {items.map((t) => (
                    <div key={t.id} className={`dc-toast ${t.kind}`}>
                        <Icon n={icon[t.kind]} className="i" />
                        <div><b>{t.title}</b>{t.text && <p>{t.text}</p>}</div>
                        <i className="bar" style={{ animationDuration: `${t.ms}ms` }} />
                    </div>
                ))}
            </div></Portal>
            {dlg && (
                <Modal title={dlg.title} onClose={() => { dlg.resolve(false); setDlg(null); }}
                       footer={<>
                           <button className="dc-btn" onClick={() => { dlg.resolve(false); setDlg(null); }}>Hủy</button>
                           <button className={`dc-btn ${dlg.tone ?? 'primary'}`} onClick={() => { dlg.resolve(true); setDlg(null); }}>{dlg.okLabel ?? 'Xác nhận'}</button>
                       </>}>
                    {dlg.text && <p>{dlg.text}</p>}
                </Modal>
            )}
        </UICtx.Provider>
    );
}

/* --------------------------- modal / drawer --------------------------- */
export function Modal({ title, children, footer, onClose, wide }: { title: string; children: ReactNode; footer?: ReactNode; onClose: () => void; wide?: boolean }) {
    useEffect(() => {
        const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', k);
        return () => window.removeEventListener('keydown', k);
    }, [onClose]);
    return (
        <Portal><div className="dc-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className={`dc-modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
                <div className="dc-modal-h"><h3>{title}</h3><button className="dc-x" onClick={onClose} aria-label="Đóng"><Icon n="x" /></button></div>
                <div className="dc-modal-b">{children}</div>
                {footer && <div className="dc-modal-f">{footer}</div>}
            </div>
        </div></Portal>
    );
}

export function Drawer({ title, sub, children, footer, onClose }: { title: string; sub?: ReactNode; children: ReactNode; footer?: ReactNode; onClose: () => void }) {
    useEffect(() => {
        const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', k);
        return () => window.removeEventListener('keydown', k);
    }, [onClose]);
    return (
        <Portal>
            <div className="dc-drawer-ov" onClick={onClose} />
            <aside className="dc-drawer" role="dialog" aria-modal="true">
                <div className="dc-modal-h"><div style={{ marginRight: 'auto' }}><h3>{title}</h3>{sub}</div><button className="dc-x" onClick={onClose} aria-label="Đóng"><Icon n="x" /></button></div>
                <div className="dc-drawer-b">{children}</div>
                {footer && <div className="dc-drawer-f">{footer}</div>}
            </aside>
        </Portal>
    );
}

/* ----------------------------- small bits ----------------------------- */
export const Badge = ({ tone, children }: { tone: string; children: ReactNode }) => <span className={`dc-badge ${tone}`}>{children}</span>;
export const StatusBadge = ({ s }: { s: Status }) => <Badge tone={STATUS[s].tone}>{STATUS[s].label}</Badge>;
export const RankBadge = ({ r }: { r: Rank }) => <Badge tone={RANK_TONE[r]}>{r}</Badge>;
export const Sev = ({ n }: { n: number }) => (
    <span className={`dc-sev s${n}`} title={SEVERITY[n]}><i /><i /><i /><i /></span>
);
export const Avatar = ({ name }: { name: string }) => <span className="dc-avatar">{name.trim().split(/\s+/).slice(-2).map((w) => w[0]).join('').toUpperCase()}</span>;

export const Empty = ({ icon = 'inbox', text }: { icon?: string; text: string }) => (
    <div className="dc-empty"><Icon n={icon} /><p>{text}</p></div>
);
export const Skel = ({ h = 16, w = '100%' }: { h?: number; w?: number | string }) => <div className="dc-skel" style={{ height: h, width: w }} />;
export const SkelRows = ({ n = 6 }: { n?: number }) => (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>{Array.from({ length: n }).map((_, i) => <Skel key={i} h={22} />)}</div>
);

export const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
    <div className="dc-field"><label>{label}</label>{children}{hint && <span className="hint">{hint}</span>}</div>
);

export function Pager({ page, last, total, onPage }: { page: number; last: number; total: number; onPage: (p: number) => void }) {
    return (
        <div className="dc-pager">
            <span>{total} kết quả · Trang {page}/{Math.max(1, last)}</span>
            <div>
                <button className="dc-btn sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Trước</button>
                <button className="dc-btn sm" disabled={page >= last} onClick={() => onPage(page + 1)}>Sau</button>
            </div>
        </div>
    );
}

/* ------------------------------- charts ------------------------------- */
export function HBars({ rows, color = 'var(--brand)' }: { rows: { label: string; value: number; color?: string }[]; color?: string }) {
    const max = Math.max(1, ...rows.map((r) => r.value));
    if (!rows.length) return <Empty text="Chưa có dữ liệu" />;
    return (
        <div className="dc-bars">
            {rows.map((r) => (
                <div className="dc-bar" key={r.label}>
                    <span title={r.label}>{r.label}</span>
                    <div className="t"><i style={{ width: `${(r.value / max) * 100}%`, background: r.color ?? color }} /></div>
                    <b>{r.value}</b>
                </div>
            ))}
        </div>
    );
}

export function TrendChart({ data }: { data: { date: string; count: number }[] }) {
    const W = 640, H = 170, pad = 24;
    const max = Math.max(3, ...data.map((d) => d.count));
    const bw = (W - pad * 2) / data.length;
    const [hover, setHover] = useState<number | null>(null);
    return (
        <div>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="Số vi phạm 30 ngày gần nhất">
                {[0, 0.5, 1].map((t) => (
                    <g key={t}>
                        <line x1={pad} x2={W - pad} y1={H - pad - (H - pad * 2) * t} y2={H - pad - (H - pad * 2) * t} stroke="#e6ebf1" />
                        <text x={0} y={H - pad - (H - pad * 2) * t + 4} fontSize="10" fill="#64748b">{Math.round(max * t)}</text>
                    </g>
                ))}
                {data.map((d, i) => {
                    const h = ((H - pad * 2) * d.count) / max;
                    return (
                        <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                            <rect x={pad + i * bw + 2} y={pad} width={bw - 4} height={H - pad * 2} fill="transparent" />
                            <rect x={pad + i * bw + 2} y={H - pad - h} width={bw - 4} height={Math.max(h, d.count ? 2 : 0)} rx="2" fill={hover === i ? '#085f6d' : '#0b7a8c'} />
                        </g>
                    );
                })}
                {[0, 7, 14, 21, 29].map((i) => (
                    <text key={i} x={pad + i * bw} y={H - 6} fontSize="10" fill="#64748b">{data[i].date.slice(8) + '/' + data[i].date.slice(5, 7)}</text>
                ))}
            </svg>
            <p style={{ fontSize: 12, color: 'var(--muted)', minHeight: 18 }}>
                {hover !== null ? `${data[hover].date.split('-').reverse().join('/')}: ${data[hover].count} vi phạm` : 'Rê chuột vào cột để xem chi tiết'}
            </p>
        </div>
    );
}

export function Donut({ parts, size = 150 }: { parts: { label: string; value: number; color: string }[]; size?: number }) {
    const total = parts.reduce((a, b) => a + b.value, 0);
    const r = size / 2 - 14, c = 2 * Math.PI * r;
    let acc = 0;
    return (
        <div className="dc-donut">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Phân bố">
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eaeff5" strokeWidth="18" />
                {total > 0 && parts.map((p) => {
                    const len = (p.value / total) * c;
                    const el = <circle key={p.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth="18"
                                       strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} transform={`rotate(-90 ${size / 2} ${size / 2})`} />;
                    acc += len; return el;
                })}
                <text x="50%" y="50%" textAnchor="middle" dy="0.1em" fontSize="22" fontWeight="700" fill="#15212e">{total}</text>
            </svg>
            <div className="dc-legend" style={{ flexDirection: 'column', gap: 8, marginTop: 0 }}>
                {parts.map((p) => <span key={p.label}><i style={{ background: p.color }} />{p.label}: <b>{p.value}</b></span>)}
            </div>
        </div>
    );
}

export function ScoreRing({ score, max, color, size = 120 }: { score: number; max: number; color: string; size?: number }) {
    const r = size / 2 - 9, c = 2 * Math.PI * r, pct = Math.max(0, Math.min(1, score / max));
    return (
        <div className="dc-ring" style={{ width: size, height: size }}>
            <svg width={size} height={size}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eaeff5" strokeWidth="10" />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
                        strokeDasharray={`${c * pct} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dasharray .6s ease' }} />
            </svg>
            <b>{score}</b>
        </div>
    );
}
export const rankColor = (r: Rank) => ({ 'Tốt': '#12935f', 'Khá': '#2a6fdb', 'Đạt': '#e0a100', 'Chưa đạt': '#c42b45' }[r]);