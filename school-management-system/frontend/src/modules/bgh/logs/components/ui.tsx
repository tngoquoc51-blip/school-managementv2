'use client';

import { createContext, ReactNode, useCallback, useContext, useRef, useState } from 'react';
import s from '../logs.module.css';
import { Icon } from './Icons';
import { MODULES, SEVERITY, STATUS, initials, moduleLabel } from '../format';
import type { Severity, Status } from '../types';

export const SevChip = ({ v }: { v: Severity }) => <span className={`${s.chip} ${s['sev_' + v]}`}>{SEVERITY[v]?.label || v}</span>;
export const StatusChip = ({ v }: { v: Status }) => <span className={`${s.chip} ${s['st_' + v]}`}>{STATUS[v] || v}</span>;
export const AlertStatusChip = ({ v }: { v: 'open' | 'ack' | 'resolved' }) => (
    <span className={`${s.chip} ${s['st_' + v]}`}>{v === 'open' ? 'Mới' : v === 'ack' ? 'Đã tiếp nhận' : 'Đã xử lý'}</span>
);

export const ModTag = ({ m }: { m: string }) => (
    <span className={s.modTag}><i className={s.modDot} style={{ ['--mc' as any]: MODULES[m]?.color || '#94a3b8' }} />{moduleLabel(m)}</span>
);

export const Who = ({ name, sub }: { name?: string | null; sub?: string | null }) => (
    <div className={s.who}>
        <div className={s.avatar}>{initials(name)}</div>
        <div style={{ minWidth: 0 }}>
            <div className={s.ellipsis} style={{ fontWeight: 600, maxWidth: 190 }}>{name || 'Hệ thống'}</div>
            {sub && <div className={`${s.small} ${s.muted}`}>{sub}</div>}
        </div>
    </div>
);

export function Card({ title, sub, right, children, className = '' }: { title?: string; sub?: string; right?: ReactNode; children: ReactNode; className?: string }) {
    return (
        <section className={`${s.card} ${className}`}>
            {(title || right) && (
                <div className={s.cardHead}>
                    <div><h3 className={s.cardTitle}>{title}</h3>{sub && <div className={s.cardSub}>{sub}</div>}</div>
                    <div className={s.spacer} />{right}
                </div>
            )}
            {children}
        </section>
    );
}

export function Kpi({ icon, label, value, foot, tone }: { icon: string; label: string; value: ReactNode; foot?: ReactNode; tone?: string }) {
    return (
        <div className={`${s.card} ${s.kpi}`} style={{ ['--tone' as any]: tone }}>
            <div className={s.kpiIcon}><Icon name={icon} /></div>
            <div className={s.kpiLabel}>{label}</div>
            <div className={s.kpiValue}>{value}</div>
            {foot && <div className={s.kpiFoot}>{foot}</div>}
        </div>
    );
}

export function Empty({ icon = 'list', title, hint }: { icon?: string; title: string; hint?: string }) {
    return (
        <div className={s.empty}>
            <div className={s.emptyIcon}><Icon name={icon} size={24} /></div>
            <div style={{ fontWeight: 700, color: 'var(--text)' }}>{title}</div>
            {hint && <div className={s.small} style={{ marginTop: 4 }}>{hint}</div>}
        </div>
    );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
    return (
        <div className={s.errorBox}>
            <Icon name="alert" size={22} />
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>Không tải được dữ liệu</div>
                <div className={s.small}>{message}</div>
            </div>
            {onRetry && <button className={s.btn} onClick={onRetry}><Icon name="refresh" size={15} /> Thử lại</button>}
        </div>
    );
}

export const Skeleton = ({ h = 120 }: { h?: number }) => <div className={s.skeleton} style={{ height: h }} />;

export function Pager({ page, last, total, per, onPage }: { page: number; last: number; total: number; per: number; onPage: (p: number) => void }) {
    const from = total ? (page - 1) * per + 1 : 0;
    const to = Math.min(total, page * per);
    return (
        <div className={s.pager}>
            <span className={`${s.small} ${s.muted}`}>{from}–{to} / {total.toLocaleString('vi-VN')} bản ghi</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className={`${s.btn} ${s.sm}`} disabled={page <= 1} onClick={() => onPage(1)}>«</button>
                <button className={`${s.btn} ${s.sm}`} disabled={page <= 1} onClick={() => onPage(page - 1)}>Trước</button>
                <span className={s.small}>Trang {page}/{last}</span>
                <button className={`${s.btn} ${s.sm}`} disabled={page >= last} onClick={() => onPage(page + 1)}>Sau</button>
                <button className={`${s.btn} ${s.sm}`} disabled={page >= last} onClick={() => onPage(last)}>»</button>
            </div>
        </div>
    );
}

/* ---------------- Toast ---------------- */
type T = { id: number; kind: 'ok' | 'err'; text: string };
const ToastCtx = createContext<(kind: 'ok' | 'err', text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [list, setList] = useState<T[]>([]);
    const id = useRef(0);
    const push = useCallback((kind: 'ok' | 'err', text: string) => {
        const n = ++id.current;
        setList((l) => [...l, { id: n, kind, text }]);
        setTimeout(() => setList((l) => l.filter((x) => x.id !== n)), 4200);
    }, []);
    return (
        <ToastCtx.Provider value={push}>
            {children}
            <div className={s.toasts} role="status" aria-live="polite">
                {list.map((t) => (
                    <div key={t.id} className={`${s.toast} ${s[t.kind]}`}>
                        <Icon name={t.kind === 'ok' ? 'check' : 'alert'} size={18} /><span>{t.text}</span>
                    </div>
                ))}
            </div>
        </ToastCtx.Provider>
    );
}

/* ---------------- Confirm modal ---------------- */
export function Confirm({ title, body, danger, confirmText = 'Xác nhận', input, onCancel, onOk }: {
    title: string; body: ReactNode; danger?: boolean; confirmText?: string;
    input?: { label: string; required?: boolean; match?: string };
    onCancel: () => void; onOk: (text: string) => void;
}) {
    const [text, setText] = useState('');
    const ok = !input || (input.match ? text === input.match : input.required ? text.trim().length > 0 : true);
    return (
        <>
            <div className={s.overlay} onClick={onCancel} />
            <div className={s.modal} role="dialog" aria-modal="true">
                <h3 style={{ margin: '0 0 8px', fontSize: 17 }}>{title}</h3>
                <div className={s.muted}>{body}</div>
                {input && (
                    <div style={{ marginTop: 14 }}>
                        <div className={`${s.small} ${s.muted}`} style={{ marginBottom: 6 }}>{input.label}</div>
                        <input className={s.field} style={{ width: '100%' }} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
                    </div>
                )}
                <div className={s.modalActions}>
                    <button className={s.btn} onClick={onCancel}>Huỷ</button>
                    <button className={`${s.btn} ${danger ? s.danger : s.primary}`} disabled={!ok} onClick={() => onOk(text)}>{confirmText}</button>
                </div>
            </div>
        </>
    );
}

/* --------------- hook tải dữ liệu --------------- */
export function useAsync<T>() {
    const [data, setData] = useState<T | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const seq = useRef(0);
    const run = useCallback(async (fn: () => Promise<T>, silent = false) => {
        const n = ++seq.current;
        if (!silent) setLoading(true);
        try {
            const r = await fn();
            if (n === seq.current) { setData(r); setError(''); }
        } catch (e: any) {
            const st = e?.response?.status ? ` [HTTP ${e.response.status}]` : '';
            if (n === seq.current) setError((e?.response?.data?.message || (e?.message === 'Network Error' ? 'Không kết nối được máy chủ API (kiểm tra backend đang chạy và NEXT_PUBLIC_API_URL).' : e?.message) || 'Lỗi không xác định') + st);
        } finally {
            if (n === seq.current) setLoading(false);
        }
    }, []);
    return { data, error, loading, run, setData };
}