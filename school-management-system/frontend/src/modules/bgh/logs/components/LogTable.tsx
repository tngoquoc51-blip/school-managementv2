'use client';

import s from '../logs.module.css';
import { fmtTime, roleLabel } from '../format';
import type { Filters, LogRow } from '../types';
import { Empty, ModTag, SevChip, StatusChip, Who } from './ui';

const COLS: { key: string; label: string; sort?: string }[] = [
    { key: 'time', label: 'Thời gian', sort: 'occurred_at' },
    { key: 'actor', label: 'Người thực hiện', sort: 'actor_name' },
    { key: 'module', label: 'Phân hệ', sort: 'module' },
    { key: 'action', label: 'Hành động', sort: 'action' },
    { key: 'summary', label: 'Mô tả' },
    { key: 'sev', label: 'Mức độ', sort: 'severity' },
    { key: 'status', label: 'Trạng thái', sort: 'status' },
    { key: 'ip', label: 'IP' },
];

export default function LogTable({ rows, filters, onSort, onOpen, compact }: {
    rows: LogRow[]; filters?: Filters; onSort?: (col: string) => void; onOpen: (id: number) => void; compact?: boolean;
}) {
    if (!rows.length) return <div className={s.tableWrap}><Empty icon="search" title="Không có bản ghi phù hợp" hint="Thử bỏ bớt bộ lọc hoặc mở rộng khoảng thời gian." /></div>;
    const cols = compact ? COLS.filter((c) => !['ip', 'module'].includes(c.key)) : COLS;
    const sort = filters?.sort || 'occurred_at', dir = filters?.dir || 'desc';

    return (
        <div className={s.tableWrap}>
            <table className={s.table}>
                <thead>
                <tr>{cols.map((c) => (
                    <th key={c.key} className={c.sort && onSort ? s.sortable : ''} onClick={() => c.sort && onSort?.(c.sort)}>
                        {c.label}{c.sort === sort ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>))}</tr>
                </thead>
                <tbody>
                {rows.map((r) => (
                    <tr key={r.id} className={r.severity === 'critical' ? s.sevCritical : r.severity === 'warning' ? s.sevWarning : ''}
                        onClick={() => onOpen(r.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen(r.id)}>
                        <td className={`${s.mono} ${s.muted}`} style={{ whiteSpace: 'nowrap' }}>{fmtTime(r.occurred_at)}</td>
                        <td><Who name={r.actor_name} sub={roleLabel(r.actor_role)} /></td>
                        {!compact && <td><ModTag m={r.module} /></td>}
                        <td className={s.mono}>{r.action}</td>
                        <td><div className={s.ellipsis}>{r.summary}</div>{r.entity_label && <div className={`${s.small} ${s.faint} ${s.ellipsis}`}>{r.entity_label}</div>}</td>
                        <td><SevChip v={r.severity} /></td>
                        <td><StatusChip v={r.status} /></td>
                        {!compact && <td className={`${s.mono} ${s.muted}`}>{r.ip || '—'}</td>}
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
}