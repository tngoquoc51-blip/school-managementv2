'use client';

import type { ReactNode } from 'react';
import type { Review } from '@/modules/teacher/lessonlog/types';
import { REVIEW } from '@/modules/teacher/lessonlog/util';

export function Kpi({ label, value, note, onClick, accent, tone }: { label: string; value: ReactNode; note?: ReactNode; onClick?: () => void; accent?: boolean; tone?: string }) {
    const Tag: any = onClick ? 'button' : 'div';
    return (
        <Tag className={`kpi${onClick ? ' click' : ''}${accent ? ' accent' : ''}`} onClick={onClick}>
            <div className="lbl">{label}</div>
            <div className="val" style={tone === 'bad' ? { color: 'var(--bad)' } : tone === 'good' ? { color: 'var(--good)' } : undefined}>{value}</div>
            {note !== undefined && <div className="sub">{note}</div>}
        </Tag>
    );
}

export function ReviewChip({ status }: { status: Review['status'] }) {
    const r = REVIEW[status];
    return <span className={`ll-st ${r.tone}`}>{r.l}</span>;
}

export function Bar({ pct, tone = '' }: { pct: number | null | undefined; tone?: string }) {
    return <div className={`ll-bar ${tone}`}><i style={{ width: `${Math.max(0, Math.min(100, pct ?? 0))}%` }} /></div>;
}