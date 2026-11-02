'use client';

import { ReactNode, useEffect, useRef } from 'react';
import Icon from './Icon';
import type { Level } from './types';
import { LEVEL_LABEL } from './utils';

export function Panel({ title, desc, actions, children, flush }: { title?: string; desc?: string; actions?: ReactNode; children: ReactNode; flush?: boolean }) {
    return (
        <section className="lg-panel">
            {(title || actions) && (
                <header className="lg-panel__head">
                    <div>{title && <h2>{title}</h2>}{desc && <p>{desc}</p>}</div>
                    {actions && <div className="lg-panel__actions">{actions}</div>}
                </header>
            )}
            <div className={flush ? 'lg-panel__body lg-panel__body--flush' : 'lg-panel__body'}>{children}</div>
        </section>
    );
}

export function LevelBadge({ level, compact }: { level: Level; compact?: boolean }) {
    return <span className={`lg-lv lg-lv--${level}${compact ? ' lg-lv--compact' : ''}`}><i />{LEVEL_LABEL[level] ?? level}</span>;
}

export function Chip({ tone = 'neutral', children }: { tone?: 'neutral' | 'brand' | 'teal' | 'amber' | 'coral' | 'violet'; children: ReactNode }) {
    return <span className={`lg-chip lg-chip--${tone}`}>{children}</span>;
}

export function Skeleton({ h = 16, w = '100%', r = 8 }: { h?: number; w?: number | string; r?: number }) {
    return <span className="lg-skel" style={{ height: h, width: w, borderRadius: r }} aria-hidden="true" />;
}

export function Empty({ icon, title, text, action }: { icon: string; title: string; text?: string; action?: ReactNode }) {
    return (
        <div className="lg-empty">
            <span><Icon name={icon} size={24} /></span>
            <strong>{title}</strong>
            {text && <p>{text}</p>}
            {action}
        </div>
    );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div className="lg-empty lg-empty--error" role="alert">
            <span><Icon name="alert" size={24} /></span>
            <strong>Không tải được dữ liệu</strong>
            <p>{message}</p>
            <button type="button" className="lg-btn lg-btn--primary" onClick={onRetry}><Icon name="refresh" size={16} /> Thử lại</button>
        </div>
    );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { key: T; label: string }[]; label: string }) {
    return (
        <div className="lg-seg" role="radiogroup" aria-label={label}>
            {options.map((o) => (
                <button key={o.key} type="button" role="radio" aria-checked={value === o.key} className={value === o.key ? 'is-active' : ''} onClick={() => onChange(o.key)}>{o.label}</button>
            ))}
        </div>
    );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
    return (
        <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={`lg-switch${checked ? ' is-on' : ''}`} onClick={() => onChange(!checked)}><span /></button>
    );
}

export function Delta({ value, goodWhenDown }: { value: number | null; goodWhenDown?: boolean }) {
    if (value === null) return <span className="lg-delta lg-delta--flat">mới</span>;
    if (value === 0) return <span className="lg-delta lg-delta--flat">0%</span>;
    const up = value > 0;
    const good = goodWhenDown ? !up : up;
    return <span className={`lg-delta ${good ? 'lg-delta--good' : 'lg-delta--bad'}`}><Icon name={up ? 'up' : 'down'} size={13} />{Math.abs(value)}%</span>;
}

export function Modal({ open, title, onClose, children, footer, wide }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const prev = document.activeElement as HTMLElement | null;
        ref.current?.focus();
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => { window.removeEventListener('keydown', onKey); prev?.focus?.(); };
    }, [open, onClose]);
    if (!open) return null;
    return (
        <div className="lg-modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div ref={ref} tabIndex={-1} className={`lg-dialog${wide ? ' lg-dialog--wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
                <header><h3>{title}</h3><button type="button" className="lg-iconbtn" onClick={onClose} aria-label="Đóng"><Icon name="x" size={18} /></button></header>
                <div className="lg-dialog__body">{children}</div>
                {footer && <footer>{footer}</footer>}
            </div>
        </div>
    );
}

export function ConfirmDialog({ open, title, message, confirmLabel, tone = 'danger', loading, onConfirm, onCancel, children, disabled }: {
    open: boolean; title: string; message: string; confirmLabel: string; tone?: 'danger' | 'brand'; loading?: boolean;
    onConfirm: () => void; onCancel: () => void; children?: ReactNode; disabled?: boolean;
}) {
    return (
        <Modal open={open} title={title} onClose={() => !loading && onCancel()} footer={
            <>
                <button type="button" className="lg-btn lg-btn--ghost" onClick={onCancel} disabled={loading}>Hủy</button>
                <button type="button" className={`lg-btn ${tone === 'danger' ? 'lg-btn--danger' : 'lg-btn--primary'}`} onClick={onConfirm} disabled={loading || disabled}>
                    {loading && <span className="lg-spinner" aria-hidden="true" />}{confirmLabel}
                </button>
            </>
        }>
            <p className="lg-confirm__msg">{message}</p>
            {children}
        </Modal>
    );
}

export function Pager({ meta, onPage, onPerPage, busy, sizes = [25, 50, 100] }: {
    meta: { total: number; current_page: number; per_page: number; last_page: number }; onPage: (p: number) => void; onPerPage?: (n: number) => void; busy?: boolean; sizes?: number[];
}) {
    if (meta.total === 0) return null;
    const from = (meta.current_page - 1) * meta.per_page + 1;
    const to = Math.min(meta.current_page * meta.per_page, meta.total);
    return (
        <div className="lg-pager">
            <span>{from.toLocaleString('vi-VN')}–{to.toLocaleString('vi-VN')} / {meta.total.toLocaleString('vi-VN')}</span>
            <div>
                {onPerPage && (
                    <select value={meta.per_page} onChange={(e) => onPerPage(Number(e.target.value))} aria-label="Số dòng mỗi trang">
                        {sizes.map((n) => <option key={n} value={n}>{n} dòng</option>)}
                    </select>
                )}
                <button type="button" className="lg-btn lg-btn--ghost lg-btn--icon" disabled={meta.current_page <= 1 || busy} onClick={() => onPage(meta.current_page - 1)} aria-label="Trang trước"><Icon name="chevL" size={16} /></button>
                <span className="lg-pager__page">{meta.current_page}/{meta.last_page}</span>
                <button type="button" className="lg-btn lg-btn--ghost lg-btn--icon" disabled={meta.current_page >= meta.last_page || busy} onClick={() => onPage(meta.current_page + 1)} aria-label="Trang sau"><Icon name="chevR" size={16} /></button>
            </div>
        </div>
    );
}