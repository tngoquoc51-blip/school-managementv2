'use client';

import { useCallback, useEffect, useState } from 'react';
import DiffView from '../DiffView';
import Icon from '../Icon';
import { logsApi } from '../logsApi';
import { Chip, Empty, ErrorState, Pager, Skeleton } from '../ui';
import type { AuditData, EventFilters } from '../types';
import { RANGES, actionLabel, actorLabel, fmtFull } from '../utils';

export default function AuditTab({ refreshKey, onOpenEvent }: { refreshKey: number; onOpenEvent: (id: number) => void }) {
    const [range, setRange] = useState<EventFilters['range']>('30d');
    const [q, setQ] = useState('');
    const [qDeb, setQDeb] = useState('');
    const [table, setTable] = useState('');
    const [page, setPage] = useState(1);
    const [data, setData] = useState<AuditData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => { const t = window.setTimeout(() => { setQDeb(q); setPage(1); }, 350); return () => window.clearTimeout(t); }, [q]);

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try { setData(await logsApi.audit({ range, q: qDeb, subject_type: table, page, per_page: 10 })); }
        catch (e) { setError((e as Error).message); } finally { setLoading(false); }
    }, [range, qDeb, table, page]);
    useEffect(() => { load(); }, [load, refreshKey]);

    return (
        <div className="lg-audit">
            <aside className="lg-audit__side" aria-label="Bảng dữ liệu">
                <h3>Bảng bị tác động</h3>
                <button type="button" className={`lg-facet${table === '' ? ' is-on' : ''}`} onClick={() => { setTable(''); setPage(1); }}><span>Tất cả</span><b>{data ? data.tables.reduce((a, t) => a + t.count, 0) : '…'}</b></button>
                {data?.tables.map((t) => <button key={t.table} type="button" className={`lg-facet${table === t.table ? ' is-on' : ''}`} onClick={() => { setTable(t.table); setPage(1); }}><code>{t.table}</code><b>{t.count}</b></button>)}
                {data && data.tables.length === 0 && <p className="lg-hint">Chưa có thay đổi dữ liệu nào được ghi lại.</p>}
            </aside>

            <div className="lg-stack">
                <div className="lg-filterbar">
                    <div className="lg-search"><Icon name="search" size={16} /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo mô tả, người sửa, mã bản ghi…" aria-label="Tìm trong kiểm toán" /></div>
                    <select className="lg-select" value={range} onChange={(e) => { setRange(e.target.value as EventFilters['range']); setPage(1); }} aria-label="Khoảng thời gian">{RANGES.filter((r) => r.key !== '1h').map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</select>
                </div>

                {error && !data ? <ErrorState message={error} onRetry={load} /> : loading && !data ? (
                    <div className="lg-stack">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} h={130} r={14} />)}</div>
                ) : data && data.items.length === 0 ? (
                    <Empty icon="diff" title="Chưa có thay đổi dữ liệu" text="Khi code gọi AuditLogger::data(...) (kèm giá trị trước/sau), mỗi lần sửa dữ liệu sẽ hiện ở đây dạng so sánh." />
                ) : (
                    <div className={`lg-stack${loading ? ' is-loading' : ''}`}>
                        {data?.items.map((e) => (
                            <article key={e.id} className="lg-change">
                                <header>
                                    <div><Chip tone="violet">{actionLabel(e.action)}</Chip> <code>{e.subject.type}{e.subject.id ? ` #${e.subject.id}` : ''}</code></div>
                                    <button type="button" className="lg-link" onClick={() => onOpenEvent(e.id)}>Chi tiết</button>
                                </header>
                                <p>{e.summary}</p>
                                <small className="lg-muted"><Icon name="user" size={13} /> {actorLabel(e.actor)} · <Icon name="clock" size={13} /> {fmtFull(e.occurred_at)}{e.ip_address ? ` · ${e.ip_address}` : ''}</small>
                                <DiffView rows={e.changes} compact />
                            </article>
                        ))}
                    </div>
                )}
                {data && <Pager meta={data.meta} busy={loading} onPage={setPage} />}
            </div>
        </div>
    );
}