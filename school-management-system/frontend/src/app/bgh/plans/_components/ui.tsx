'use client';

import { ReactNode, useEffect } from 'react';

const P: Record<string, string> = {
    upload: 'M12 16V4M7 9l5-5 5 5M5 20h14',
    download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    alert: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7.5v5.5M12 16.5v.01',
    info: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5M12 7.5v.01',
    x: 'M6 6l12 12M18 6L6 18',
    undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3',
    file: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 13h6M9 17h6',
    table: 'M3 5h18v14H3zM3 10h18M9 5v14M15 5v14',
    shield: 'M12 3l7 3v6c0 4.4-3 8-7 9-4-1-7-4.6-7-9V6l7-3zM9 12l2 2 4-4',
    history: 'M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.8L3 8M3 3v5h5M12 7v5l3 2',
    bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
    student: 'M12 3l10 5-10 5L2 8l10-5zM6 12.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-3.5',
    layers: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    teacher: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M16 11l2 2 4-4',
    book: 'M12 7v14M3 4h5a4 4 0 014 4 4 4 0 014-4h5v14h-6a3 3 0 00-3 3 3 3 0 00-3-3H3z',
    door: 'M18 20V6a2 2 0 00-2-2H8a2 2 0 00-2 2v14M2 20h20M14 12v.01',
    calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
    folder: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z',
    eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
    clip: 'M9 3h6v3H9zM15 4.5h3a1 1 0 011 1V21a1 1 0 01-1 1H6a1 1 0 01-1-1V5.5a1 1 0 011-1h3M9 14l2 2 4-4',
    save: 'M5 3h11l3 3v15H5zM8 3v5h7V3M8 21v-7h8v7',
    trash: 'M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M6 6l1 14a1 1 0 001 1h8a1 1 0 001-1l1-14',
    plus: 'M12 5v14M5 12h14',
    edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    kanban: 'M4 4h5v14H4zM10 4h5v9h-5zM16 4h5v6h-5z',
    gantt: 'M3 6h10M7 12h12M5 18h8',
    flag: 'M4 22V4M4 4h12l-2 4 2 4H4',
    link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3A4 4 0 0011 18.7l1-1',
    comment: 'M21 15a4 4 0 01-4 4H7l-4 3V7a4 4 0 014-4h10a4 4 0 014 4z',
    copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
    send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
    play: 'M6 4l14 8-14 8z',
    pause: 'M7 4h4v16H7zM13 4h4v16h-4z',
    clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
    money: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v10M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 1-3 2.5 1.3 2.5 3 2.5 3 1 3 2.5-1.3 2.5-3 2.5',
    target: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8zM12 12h.01',
    layers2: 'M12 2L2 7l10 5 10-5zM2 12l10 5 10-5',
    arrowR: 'M5 12h14M13 6l6 6-6 6',
    arrowL: 'M19 12H5m6-6l-6 6 6 6',
};

export const Icon = ({ n, s = 18 }: { n: string; s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={P[n] ?? P.info} />
    </svg>
);

export function Stepper({ steps, current, onGo }: { steps: string[]; current: number; onGo?: (n: number) => void }) {
    return (
        <ol className="pl-stepper">
            {steps.map((s, i) => {
                const n = i + 1;
                const st = n < current ? 'done' : n === current ? 'cur' : 'todo';
                return (
                    <li key={s} className={st}>
                        <button type="button" disabled={!onGo || n >= current} onClick={() => onGo?.(n)}>
                            <span>{st === 'done' ? <Icon n="check" s={14} /> : n}</span>
                            <em>{s}</em>
                        </button>
                    </li>
                );
            })}
        </ol>
    );
}

export function Bar({ value, tone = 'sky', label }: { value: number; tone?: 'sky' | 'ok' | 'warn' | 'err'; label?: string }) {
    const v = Math.max(0, Math.min(100, value));
    return (
        <div className="pl-bar" role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
            <i className={tone} style={{ width: `${v}%` }} />
            {label && <span>{label}</span>}
        </div>
    );
}

export const Pill = ({ tone, children }: { tone: 'ok' | 'warn' | 'err' | 'mut' | 'pri' | 'vio' | 'sky'; children: ReactNode }) => (
    <span className={`pl-pill ${tone}`}>{children}</span>
);

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div className="pl-modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className={`pl-modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
                <header><h3>{title}</h3><button onClick={onClose} aria-label="Đóng"><Icon n="x" s={16} /></button></header>
                <div className="pl-modal-b">{children}</div>
                {footer && <footer>{footer}</footer>}
            </div>
        </div>
    );
}

export const fmtDT = (s?: string | null) => (s ? new Date(s.replace(' ', 'T')).toLocaleString('vi-VN', { hour12: false }) : '—');
export const num = (n: number | null | undefined) => (n ?? 0).toLocaleString('vi-VN');

export const fmtDate = (s?: string | null) => {
    if (!s) return '—';
    const [y, m, d] = s.slice(0, 10).split('-');
    return y && m && d ? `${d}/${m}/${y}` : s;
};
export const vnd = (n: number | null | undefined) => (n == null ? '—' : `${Math.round(n).toLocaleString('vi-VN')} đ`);
export const vndShort = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)} tỷ` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} triệu` : `${n.toLocaleString('vi-VN')} đ`);