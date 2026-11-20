'use client';

import type { CSSProperties } from 'react';
import type { Meta, TestStatus } from '../types';

export const STATUS_CLASS: Record<TestStatus, string> = { draft: '', scheduled: 'info', grading: 'gold', done: 'ok' };

export function StatusBadge({ meta, status }: { meta: Meta; status: TestStatus }) {
    return <span className={`emu-badge ${STATUS_CLASS[status]}`}>{meta.statuses[status] ?? status}</span>;
}

export const kindLabel = (meta: Meta, kind: string) => meta.kinds.find((k) => k.key === kind)?.label ?? kind;

/** Màu theo điểm hệ 10 */
export function scoreColor(v: number | null | undefined): string {
    if (v === null || v === undefined) return 'var(--ink-3)';
    return v >= 8 ? 'var(--ok)' : v >= 6.5 ? 'var(--info)' : v >= 5 ? 'var(--gold)' : 'var(--danger)';
}

export function heatStyle(v: number | null): CSSProperties {
    if (v === null) return { background: 'var(--panel-2)', color: 'var(--ink-3)' };
    const c = v >= 8 ? '14,159,110' : v >= 6.5 ? '59,130,246' : v >= 5 ? '245,158,11' : '239,68,68';

    return { background: `rgba(${c}, .16)`, color: scoreColor(v) };
}

export const DIFF_LABEL = { easy: 'Dễ', medium: 'Trung bình', hard: 'Khó' } as const;
export const DIFF_CLASS = { easy: 'ok', medium: 'gold', hard: 'bad' } as const;
export const QKIND_LABEL = { mcq: 'Trắc nghiệm', essay: 'Tự luận', truefalse: 'Đúng / Sai' } as const;

export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];