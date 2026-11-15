'use client';

import { ReactNode, useEffect, useState } from 'react';
import s from '../../logs/logs.module.css';
import e from '../evaluations.module.css';
import { Icon } from '../../logs/components/Icons';
import { initials } from '../../logs/format';
import { RATING } from '../format';
import type { Rating } from '../types';

export const Tone = ({ tone, children }: { tone: string; children: ReactNode }) => <span className={`${s.chip} ${e['c_' + tone]}`}>{children}</span>;
export const RatingChip = ({ v }: { v: Rating | null | undefined }) => (v ? <Tone tone={RATING[v].tone}>{RATING[v].label}</Tone> : <span className={s.faint}>—</span>);
export const Avatar = ({ name, big }: { name?: string | null; big?: boolean }) => <div className={big ? e.avatarLg : e.avatarSm}>{initials(name)}</div>;

export function Ring({ value, rating, size = 92 }: { value: number | null; rating?: Rating | null; size?: number }) {
    const r = 15.9155, pct = Math.max(0, Math.min(100, value ?? 0));
    const color = rating ? RATING[rating].color : 'var(--faint)';
    return (
        <div className={e.ring} style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox="0 0 36 36">
                <circle cx="18" cy="18" r={r} fill="none" stroke="var(--panel2)" strokeWidth="3.6" />
                <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3.6" strokeLinecap="round" strokeDasharray={`${pct} ${100 - pct}`} style={{ transition: 'stroke-dasharray .5s' }} />
            </svg>
            <div className={e.ringNum}><b style={{ fontSize: size > 80 ? 22 : 16 }}>{value === null ? '—' : Number(value).toFixed(1).replace(/\.0$/, '')}</b><span>/ 100</span></div>
        </div>
    );
}

export function Dialog({ title, width = 620, onClose, children, footer, busy }: { title: string; width?: number; onClose: () => void; children: ReactNode; footer?: ReactNode; busy?: boolean }) {
    useEffect(() => {
        const h = (ev: KeyboardEvent) => { if (ev.key === 'Escape' && !busy) onClose(); };
        window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
    }, [onClose, busy]);
    return (
        <>
            <div className={s.overlay} onClick={() => !busy && onClose()} style={{ zIndex: 70 }} />
            <div className={e.dlg} style={{ ['--w' as any]: width + 'px' }} role="dialog" aria-modal="true" aria-label={title}>
                <div className={e.dlgHead}><h3>{title}</h3><button className={s.iconBtn} onClick={onClose} aria-label="Đóng"><Icon name="x" /></button></div>
                <div className={e.dlgBody}>{children}</div>
                {footer && <div className={e.dlgFoot}>{footer}</div>}
            </div>
        </>
    );
}

export function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: ReactNode }) {
    return (
        <div>
            <label className={`${e.lbl} ${required ? e.req : ''}`}>{label}</label>
            {children}
            {hint && <div className={e.hint}>{hint}</div>}
        </div>
    );
}

export function Progress({ value }: { value: number }) {
    return <div className={e.progressWrap}><div className={e.progressFill} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

export function StatTabs({ items, value, onChange }: { items: [string, string, number | undefined][]; value: string; onChange: (v: string) => void }) {
    return (
        <div className={e.statTabs}>
            {items.map(([k, l, n]) => <button key={k} className={`${e.statTab} ${value === k ? e.on : ''}`} onClick={() => onChange(k)}>{l}<b>{n ?? 0}</b></button>)}
        </div>
    );
}

export function useDebounced<T>(v: T, ms = 350) {
    const [d, setD] = useState(v);
    useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
    return d;
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
    return (
        <div className={s.search}><Icon name="search" size={16} /><input className={s.field} value={value} onChange={(x) => onChange(x.target.value)} placeholder={placeholder} /></div>
    );
}