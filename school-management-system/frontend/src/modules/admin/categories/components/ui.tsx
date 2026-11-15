'use client';

import { ReactNode, useEffect } from 'react';
import s from '../categories.module.css';
import Icon from './Icon';
import type { Meta } from '../types';

export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            className={`${s.switch} ${checked ? s.switchOn : ''}`}
            onClick={() => onChange(!checked)}
        >
            <span />
        </button>
    );
}

export function Badge({ tone = 'neutral', children, dot }: { tone?: 'neutral' | 'success' | 'info' | 'warning' | 'danger' | 'violet'; children: ReactNode; dot?: boolean }) {
    return (
        <span className={`${s.badge} ${s['badge_' + tone]}`}>
      {dot && <i />}
            {children}
    </span>
    );
}

export function ColorDot({ color, size = 10 }: { color?: string | null; size?: number }) {
    return <span className={s.colorDot} style={{ width: size, height: size, background: color || 'var(--muted-2)' }} />;
}

export function Drawer({ open, title, subtitle, onClose, children, footer }: { open: boolean; title: string; subtitle?: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [open, onClose]);

    if (!open) return null;
    return (
        <div className={s.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <aside className={s.drawer} role="dialog" aria-modal="true" aria-label={title}>
                <header className={s.drawerHead}>
                    <div>
                        <h3>{title}</h3>
                        {subtitle && <p>{subtitle}</p>}
                    </div>
                    <button className={s.iconBtn} onClick={onClose} aria-label="Đóng"><Icon name="x" /></button>
                </header>
                <div className={s.drawerBody}>{children}</div>
                {footer && <footer className={s.drawerFoot}>{footer}</footer>}
            </aside>
        </div>
    );
}

export function Modal({ open, title, onClose, children, wide }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);
    if (!open) return null;
    return (
        <div className={s.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className={`${s.modal} ${wide ? s.modalWide : ''}`} role="dialog" aria-modal="true" aria-label={title}>
                <header className={s.drawerHead}>
                    <h3>{title}</h3>
                    <button className={s.iconBtn} onClick={onClose} aria-label="Đóng"><Icon name="x" /></button>
                </header>
                <div className={s.modalBody}>{children}</div>
            </div>
        </div>
    );
}

export function EmptyState({ icon = 'search', title, hint, action }: { icon?: string; title: string; hint?: string; action?: ReactNode }) {
    return (
        <div className={s.empty}>
            <span><Icon name={icon} size={26} /></span>
            <h4>{title}</h4>
            {hint && <p>{hint}</p>}
            {action}
        </div>
    );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div className={`${s.empty} ${s.emptyError}`}>
            <span><Icon name="alert" size={26} /></span>
            <h4>Không tải được dữ liệu</h4>
            <p>{message}</p>
            <button className={s.btnPrimary} onClick={onRetry}><Icon name="refresh" size={16} /> Thử lại</button>
        </div>
    );
}

export function SkeletonRows({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
    return (
        <>
            {Array.from({ length: rows }).map((_, r) => (
                <tr key={r} className={s.skelRow}>
                    {Array.from({ length: cols }).map((__, c) => (
                        <td key={c}><span className={s.skel} style={{ width: `${45 + ((r * 7 + c * 13) % 45)}%` }} /></td>
                    ))}
                </tr>
            ))}
        </>
    );
}

export function Pagination({ meta, onPage, onPerPage }: { meta: Meta; onPage: (p: number) => void; onPerPage: (n: number) => void }) {
    const { current_page: cur, last_page: last } = meta;
    const pages: (number | '…')[] = [];
    for (let p = 1; p <= last; p++) {
        if (p === 1 || p === last || Math.abs(p - cur) <= 1) pages.push(p);
        else if (pages[pages.length - 1] !== '…') pages.push('…');
    }
    return (
        <div className={s.pager}>
      <span className={s.pagerInfo}>
        {meta.total === 0 ? 'Không có bản ghi' : <>Hiển thị <b>{meta.from}–{meta.to}</b> / <b>{meta.total}</b></>}
      </span>
            <div className={s.pagerCtrl}>
                <select value={meta.per_page} onChange={(e) => onPerPage(Number(e.target.value))} aria-label="Số dòng mỗi trang">
                    {[10, 15, 25, 50, 100].map((n) => <option key={n} value={n}>{n} / trang</option>)}
                </select>
                <button disabled={cur <= 1} onClick={() => onPage(cur - 1)} aria-label="Trang trước"><Icon name="chevronLeft" size={16} /></button>
                {pages.map((p, i) =>
                    p === '…' ? <span key={`e${i}`} className={s.pagerGap}>…</span> : (
                        <button key={p} className={p === cur ? s.pagerOn : ''} onClick={() => onPage(p)}>{p}</button>
                    )
                )}
                <button disabled={cur >= last} onClick={() => onPage(cur + 1)} aria-label="Trang sau"><Icon name="chevronRight" size={16} /></button>
            </div>
        </div>
    );
}

/** "3 phút trước", "hôm qua"... — cho nhật ký & hoạt động gần đây. */
export function timeAgo(iso: string | null | undefined): string {
    if (!iso) return '—';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 45) return 'vừa xong';
    if (diff < 3600) return `${Math.round(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.round(diff / 3600)} giờ trước`;
    if (diff < 86400 * 7) return `${Math.round(diff / 86400)} ngày trước`;
    return new Date(iso).toLocaleDateString('vi-VN');
}

export function formatDateTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
}