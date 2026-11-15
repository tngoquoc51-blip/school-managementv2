'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import s from '../categories.module.css';
import { catalogService, getErrorMessage } from '../catalogApi';
import { useFeedback } from '../components/Feedback';
import Icon from '../components/Icon';
import { Badge, EmptyState, ErrorState, Pagination, SkeletonRows, formatDateTime, timeAgo } from '../components/ui';
import { ACTION_LABELS, ENTITY_LABELS, FIELD_LABELS } from '../constants';
import { useDebounce } from '../hooks/useDebounce';
import type { AuditLog, Meta } from '../types';

const fmt = (v: unknown): string => {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'boolean') return v ? 'Có' : 'Không';
    if (Array.isArray(v)) return v.join(', ') || '—';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
};

function Diff({ log }: { log: AuditLog }) {
    const before = log.before ?? {};
    const after = log.after ?? {};
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).filter((k) => k !== 'items');

    if (log.action === 'import') {
        return <p className={s.muted}>Thêm {fmt(after.created)} · cập nhật {fmt(after.updated)} · bỏ qua {fmt(after.skipped)} · dòng lỗi {fmt(after.errors)}</p>;
    }
    if (keys.length === 0) return <p className={s.muted}>Không có chi tiết.</p>;

    const snapshot = log.action === 'delete' ? before : log.action === 'create' ? after : null;
    if (snapshot) {
        return (
            <dl className={s.snapshot}>
                {keys.filter((k) => !['id', 'is_system'].includes(k) && fmt(snapshot[k]) !== '—').map((k) => (
                    <div key={k}><dt>{FIELD_LABELS[k] ?? k}</dt><dd>{fmt(snapshot[k])}</dd></div>
                ))}
                {log.action === 'delete' && Array.isArray(before.items) && <div><dt>Mục bên trong</dt><dd>{before.items.length}</dd></div>}
            </dl>
        );
    }
    return (
        <table className={s.diff}>
            <thead><tr><th>Trường</th><th>Trước</th><th>Sau</th></tr></thead>
            <tbody>
            {keys.map((k) => (
                <tr key={k}><td>{FIELD_LABELS[k] ?? k}</td><td className={s.diffOld}>{fmt(before[k])}</td><td className={s.diffNew}>{fmt(after[k])}</td></tr>
            ))}
            </tbody>
        </table>
    );
}

export default function AuditTab({ onMutated, refreshToken }: { onMutated: () => void; refreshToken: number }) {
    const fb = useFeedback();
    const [entity, setEntity] = useState('');
    const [action, setAction] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const search = useDebounce(searchInput);
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(15);

    const [items, setItems] = useState<AuditLog[]>([]);
    const [meta, setMeta] = useState<Meta>({ current_page: 1, last_page: 1, per_page: 15, total: 0, from: null, to: null });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [open, setOpen] = useState<number | null>(null);
    const [restoring, setRestoring] = useState<number | null>(null);

    useEffect(() => setPage(1), [entity, action, search, from, to, perPage]);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await catalogService.auditLogs({ entity, action, search, from, to, page, per_page: perPage });
            setItems(res.items);
            setMeta(res.meta);
        } catch (e) {
            setError(getErrorMessage(e));
        } finally {
            setLoading(false);
        }
    }, [entity, action, search, from, to, page, perPage]);

    useEffect(() => { void load(); }, [load, refreshToken]);

    const restore = async (log: AuditLog) => {
        const ok = await fb.confirm({
            title: 'Khôi phục bản ghi đã xóa?',
            message: `“${log.entity_label}” sẽ được tạo lại với đúng dữ liệu trước khi xóa.`,
            confirmLabel: 'Khôi phục',
        });
        if (!ok) return;
        setRestoring(log.id);
        try {
            const res = await catalogService.restore(log.id);
            fb.success('Đã khôi phục', res.label);
            onMutated();
            await load();
        } catch (e) {
            fb.error('Không khôi phục được', getErrorMessage(e));
        } finally {
            setRestoring(null);
        }
    };

    const hasFilter = Boolean(entity || action || searchInput || from || to);
    const clear = () => { setEntity(''); setAction(''); setSearchInput(''); setFrom(''); setTo(''); };

    return (
        <section className={s.panel}>
            <div className={s.toolbar}>
                <label className={s.search}>
                    <Icon name="search" size={16} />
                    <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Tìm theo tên mục, người thực hiện…" aria-label="Tìm nhật ký" />
                </label>
                <select className={s.select} value={entity} onChange={(e) => setEntity(e.target.value)} aria-label="Loại dữ liệu">
                    <option value="">Loại: tất cả</option>
                    {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select className={s.select} value={action} onChange={(e) => setAction(e.target.value)} aria-label="Hành động">
                    <option value="">Hành động: tất cả</option>
                    {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <input type="date" className={s.select} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="Từ ngày" />
                <input type="date" className={s.select} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="Đến ngày" />
                {hasFilter && <button className={s.linkBtn} onClick={clear}>Xóa bộ lọc</button>}
                <div className={s.toolbarSpacer} />
                <button className={s.btnSoft} onClick={() => void load()}><Icon name="refresh" size={16} /> Làm mới</button>
            </div>

            <div className={s.tableWrap}>
                <table className={s.table}>
                    <thead>
                    <tr><th style={{ width: 170 }}>Thời gian</th><th style={{ width: 130 }}>Hành động</th><th>Đối tượng</th><th style={{ width: 200 }}>Người thực hiện</th><th style={{ width: 150 }} /></tr>
                    </thead>
                    <tbody>
                    {loading && items.length === 0 && <SkeletonRows cols={5} />}
                    {error && <tr><td colSpan={5}><ErrorState message={error} onRetry={() => void load()} /></td></tr>}
                    {!loading && !error && items.length === 0 && (
                        <tr><td colSpan={5}><EmptyState icon="history" title={hasFilter ? 'Không có bản ghi phù hợp' : 'Chưa có thay đổi nào'} hint="Mọi thao tác thêm, sửa, xóa danh mục sẽ được ghi lại tại đây." /></td></tr>
                    )}
                    {!error && items.map((log) => {
                        const meta = ACTION_LABELS[log.action] ?? { label: log.action, tone: 'neutral' as never };
                        const expanded = open === log.id;
                        return (
                            <Fragment key={log.id}>
                                <tr className={`${s.rowClickable} ${loading ? s.rowLoading : ''}`} onClick={() => setOpen(expanded ? null : log.id)}>
                                    <td><div className={s.cellMain}><div><strong>{timeAgo(log.created_at)}</strong><small>{formatDateTime(log.created_at)}</small></div></div></td>
                                    <td><Badge tone={meta.tone} dot>{meta.label}</Badge></td>
                                    <td><div className={s.cellMain}><div><strong>{log.entity_label || `#${log.entity_id}`}</strong><small>{ENTITY_LABELS[log.entity] ?? log.entity}</small></div></div></td>
                                    <td>{log.user_name || <span className={s.muted}>Hệ thống</span>}{log.ip && <small className={s.block}>{log.ip}</small>}</td>
                                    <td className={s.colActions} onClick={(e) => e.stopPropagation()}>
                                        {log.can_restore && (
                                            <button className={s.btnSoft} onClick={() => restore(log)} disabled={restoring === log.id}>
                                                {restoring === log.id ? <span className={s.spinner} /> : <Icon name="restore" size={15} />} Khôi phục
                                            </button>
                                        )}
                                        {log.action === 'delete' && log.restored_at && <Badge tone="violet">Đã khôi phục</Badge>}
                                        <button className={s.iconBtn} onClick={() => setOpen(expanded ? null : log.id)} aria-label="Xem chi tiết" aria-expanded={expanded}>
                                            <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={16} />
                                        </button>
                                    </td>
                                </tr>
                                {expanded && (
                                    <tr className={s.detailRow}><td colSpan={5}><Diff log={log} /></td></tr>
                                )}
                            </Fragment>
                        );
                    })}
                    </tbody>
                </table>
            </div>

            {!error && <Pagination meta={meta} onPage={setPage} onPerPage={setPerPage} />}
        </section>
    );
}