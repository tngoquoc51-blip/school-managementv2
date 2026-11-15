'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { hueOf } from '@/lib/bgh-academic';

/* ---------------- Biểu tượng (SVG nội tuyến, không cần thư viện) ---------------- */
const PATHS: Record<string, string> = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  exam: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 14l2 2 4-4"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  alert: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  grad: '<path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  star: '<path d="M12 2l3 7 7 .6-5.3 4.7 1.6 7.2L12 17.8 5.7 21.5l1.6-7.2L2 9.6 9 9z"/>',
  layers: '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>',
  arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  panel: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.5 13.5L17 22l-5-3-5 3 1.5-8.5"/>',
};
export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" dangerouslySetInnerHTML={{ __html: PATHS[name] || PATHS.info }} />
  );
}

/* ---------------- Thông báo nổi (toast) ---------------- */
type ToastKind = 'success' | 'error' | 'info' | 'warn';
interface ToastItem { id: number; kind: ToastKind; title: string; text?: string }
interface ToastApi { success: (t: string, d?: string) => void; error: (t: string, d?: string) => void; info: (t: string, d?: string) => void; warn: (t: string, d?: string) => void }
const ToastCtx = createContext<ToastApi>({ success() {}, error() {}, info() {}, warn() {} });
export const useToast = () => useContext(ToastCtx);
const TOAST_STYLE: Record<ToastKind, { tone: string; icon: string; color: string }> = {
  success: { tone: 'tone-ok', icon: 'check', color: 'var(--ok)' },
  error: { tone: 'tone-bad', icon: 'alert', color: 'var(--bad)' },
  warn: { tone: 'tone-warn', icon: 'alert', color: 'var(--warn)' },
  info: { tone: 'tone-info', icon: 'info', color: 'var(--info)' },
};
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((kind: ToastKind, title: string, text?: string) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s.slice(-3), { id, kind, title, text }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 4500);
  }, []);
  const api: ToastApi = {
    success: (t, d) => push('success', t, d), error: (t, d) => push('error', t, d),
    info: (t, d) => push('info', t, d), warn: (t, d) => push('warn', t, d),
  };
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="ac-toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div className="ac-toast" key={t.id}>
            <div className={`ic ${TOAST_STYLE[t.kind].tone}`}><Icon name={TOAST_STYLE[t.kind].icon} /></div>
            <div style={{ flex: 1 }}>
              <div className="ac-b">{t.title}</div>
              {t.text && <div className="ac-small ac-muted">{t.text}</div>}
            </div>
            <i className="pg" style={{ background: TOAST_STYLE[t.kind].color }} />
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------------- Khối giao diện dùng chung ---------------- */
export function PageHeader({ title, desc, children }: { title: string; desc?: string; children?: ReactNode }) {
  return (
    <div className="ac-head">
      <div><h2>{title}</h2>{desc && <p>{desc}</p>}</div>
      <div className="ac-right ac-row ac-wrap">{children}</div>
    </div>
  );
}
export function Card({ title, extra, children, flush }: { title?: string; extra?: ReactNode; children: ReactNode; flush?: boolean }) {
  return (
    <section className="ac-card">
      {title && <div className="ac-card-h"><h3>{title}</h3><div className="ac-right">{extra}</div></div>}
      <div className={flush ? '' : 'ac-card-b'}>{children}</div>
    </section>
  );
}
export function Kpi({ label, value, sub, tone = 'primary', icon, onClick }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string; icon: string; onClick?: () => void }) {
  return (
    <div className="ac-card ac-kpi" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <div className={`ic tone-${tone}`}><Icon name={icon} size={22} /></div>
      <div><div className="v ac-num">{value}</div><div className="l">{label}</div>{sub && <div className="s">{sub}</div>}</div>
    </div>
  );
}
export function Badge({ tone = 'muted', children }: { tone?: string; children: ReactNode }) {
  return <span className={`ac-badge tone-${tone}`}>{children}</span>;
}
export function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: { value: T; label: string; count?: number }[]; onChange: (v: T) => void }) {
  return (
    <div className="ac-seg" role="tablist">
      {options.map((o) => (
        <button key={String(o.value)} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)} role="tab" aria-selected={o.value === value}>
          {o.label}{o.count ? <span className="n">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const parts = name.trim().split(/\s+/);
  const ini = ((parts[parts.length - 2]?.[0] || '') + (parts[parts.length - 1]?.[0] || '')).toUpperCase() || '?';
  const h = 190 + (hueOf(name) % 70); // tông xanh dương – cyan, đồng bộ với giao diện BGH
  return <div className="ac-avatar" style={{ width: size, height: size, color: '#fff', background: `linear-gradient(135deg,hsl(${h} 70% 55%),hsl(${(h + 40) % 360} 70% 45%))` }}>{ini}</div>;
}
export function Empty({ title, hint, icon = 'info' }: { title: string; hint?: string; icon?: string }) {
  return <div className="ac-empty"><div className="ac-kpi" style={{ padding: 0, boxShadow: 'none', border: 0, background: 'none' }}><div className="ic tone-muted"><Icon name={icon} size={24} /></div></div><b>{title}</b>{hint && <span>{hint}</span>}</div>;
}
export function Skeleton({ h = 120, n = 1 }: { h?: number; n?: number }) {
  return <div className="ac-grid">{Array.from({ length: n }).map((_, i) => <div key={i} className="ac-skel" style={{ height: h }} />)}</div>;
}
export function ErrorBox({ error, onRetry }: { error: any; onRetry?: () => void }) {
  const status = error?.response?.status;
  const msg = status === 403 ? 'Tài khoản của bạn chưa được cấp quyền Ban Giám hiệu.' : status === 401 ? 'Phiên đăng nhập đã hết hạn.' : error?.response?.data?.message || error?.message || 'Không tải được dữ liệu.';
  return (
    <div className="ac-alert tone-bad"><Icon name="alert" /><div style={{ flex: 1 }}><b>Không tải được dữ liệu</b><div>{msg}</div></div>
      {onRetry && <button className="ac-btn sm" onClick={onRetry}><Icon name="refresh" size={14} /> Thử lại</button>}</div>
  );
}

/* ---------------- Modal & Drawer ---------------- */
function useEsc(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
}
export function Modal({ open, onClose, title, children, footer, width }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEsc(open, onClose);
  if (!open) return null;
  return (
    <div className="ac-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ac-modal" style={width ? { width: `min(${width}px,94vw)` } : undefined} role="dialog" aria-modal="true" aria-label={title}>
        <div className="ac-modal-h"><h3>{title}</h3><button className="ac-iconbtn ac-right" onClick={onClose} aria-label="Đóng"><Icon name="x" /></button></div>
        <div className="ac-modal-b">{children}</div>
        {footer && <div className="ac-modal-f">{footer}</div>}
      </div>
    </div>
  );
}
export function Drawer({ open, onClose, title, subtitle, children }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode }) {
  useEsc(open, onClose);
  if (!open) return null;
  return (
    <div className="ac-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="ac-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="ac-modal-h"><div><h3>{title}</h3>{subtitle && <div className="ac-small ac-muted">{subtitle}</div>}</div>
          <button className="ac-iconbtn ac-right" onClick={onClose} aria-label="Đóng"><Icon name="x" /></button></div>
        <div className="ac-modal-b">{children}</div>
      </aside>
    </div>
  );
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="ac-field"><label>{label}</label>{children}</div>;
}

/* ---------------- Biểu đồ nhẹ bằng SVG/CSS ---------------- */
export function Donut({ data, size = 170, center, sub }: { data: { label: string; value: number; color: string }[]; size?: number; center?: ReactNode; sub?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = 15.9155; let acc = 0;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg viewBox="0 0 42 42" width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="21" cy="21" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="5" />
        {data.map((d) => {
          const len = (d.value / total) * 100; const off = 100 - acc; acc += len;
          return <circle key={d.label} cx="21" cy="21" r={r} fill="none" stroke={d.color} strokeWidth="5" strokeDasharray={`${Math.max(len - 0.6, 0)} ${100 - Math.max(len - 0.6, 0)}`} strokeDashoffset={off} />;
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div><div style={{ fontSize: 24, fontWeight: 800 }}>{center}</div>{sub && <div className="ac-small ac-muted">{sub}</div>}</div>
      </div>
    </div>
  );
}
export function HBar({ label, value, max, color = 'var(--primary)', text }: { label: string; value: number; max: number; color?: string; text?: string }) {
  return (
    <div className="ac-hbar">
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <div className="ac-bar"><i style={{ width: `${Math.min(100, (value / (max || 1)) * 100)}%`, background: color }} /></div>
      <b className="ac-num" style={{ textAlign: 'right' }}>{text ?? value}</b>
    </div>
  );
}
export function StackBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return <div className="ac-stack" title={parts.map((p) => `${p.label}: ${p.value}`).join(' · ')}>{parts.map((p) => <i key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />)}</div>;
}
export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return <div className="ac-legend">{items.map((i) => <span key={i.label}><i style={{ background: i.color }} />{i.label}</span>)}</div>;
}
