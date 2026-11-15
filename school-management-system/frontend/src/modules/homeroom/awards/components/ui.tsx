'use client';

import { ReactNode } from 'react';
import Icon, { IconName } from './icons';
import { avatarStyle, cx, initials, signed } from '../utils';
import type { Tier } from '../types';

export function Avatar({ name, size }: { name: string; size?: 'sm' | 'lg' }) {
    return <div className={cx('emu-avatar', size)} style={avatarStyle(name)}>{initials(name)}</div>;
}

export function TierBadge({ tiers, tier, label }: { tiers: Tier[]; tier: string; label: string }) {
    const color = tiers.find((t) => t.key === tier)?.color ?? 'var(--ink-3)';
    return (
        <span className="emu-badge" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)`, borderColor: 'transparent' }}>
            <i className="emu-dot" style={{ background: color }} />{label}
        </span>
    );
}

export function Points({ value }: { value: number }) {
    return <span className={cx('emu-badge', value > 0 ? 'plus' : 'minus')}>{signed(value)}</span>;
}

export const CATEGORY_ICON: Record<string, { icon: IconName; color: string; bg: string }> = {
    discipline: { icon: 'shield', color: 'var(--info)', bg: 'var(--info-soft)' },
    study: { icon: 'book', color: 'var(--violet)', bg: 'var(--violet-soft)' },
    movement: { icon: 'flag', color: 'var(--gold)', bg: 'var(--gold-soft)' },
    hygiene: { icon: 'leaf', color: 'var(--ok)', bg: 'var(--ok-soft)' },
    attendance: { icon: 'userCheck', color: 'var(--brand)', bg: 'var(--brand-soft)' },
};

export function CatIcon({ cat, size = 34 }: { cat: string; size?: number }) {
    const c = CATEGORY_ICON[cat] ?? CATEGORY_ICON.discipline;
    return (
        <div style={{ width: size, height: size, borderRadius: size * 0.3, display: 'grid', placeItems: 'center', background: c.bg, color: c.color, flex: 'none' }}>
            <Icon name={c.icon} size={size * 0.5} />
        </div>
    );
}

export function Empty({ icon = 'sparkles', title, text, action }: { icon?: IconName; title: string; text?: string; action?: ReactNode }) {
    return (
        <div className="emu-empty">
            <div className="emu-empty-ic"><Icon name={icon} size={24} /></div>
            <b>{title}</b>
            {text && <div>{text}</div>}
            {action && <div style={{ marginTop: 14 }}>{action}</div>}
        </div>
    );
}

export function Skel({ h = 16, w = '100%', mb = 0 }: { h?: number; w?: number | string; mb?: number }) {
    return <div className="emu-skel" style={{ height: h, width: w, marginBottom: mb }} />;
}

export function PageSkeleton() {
    return (
        <div className="emu-page">
            <Skel h={150} />
            <div className="emu-grid emu-g4"><Skel h={84} /><Skel h={84} /><Skel h={84} /><Skel h={84} /></div>
            <div className="emu-grid emu-g2"><Skel h={260} /><Skel h={260} /></div>
        </div>
    );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
    return (
        <div className="emu-field">
            <label>{label}</label>
            {children}
            {hint && <span className="emu-muted" style={{ fontSize: 11.5 }}>{hint}</span>}
        </div>
    );
}