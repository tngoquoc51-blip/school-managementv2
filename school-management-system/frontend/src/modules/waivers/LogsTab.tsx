'use client';
import { useCallback, useEffect, useState } from 'react';
import { wApi, errMsg } from './api';
import { ACTION, fmtDateTime } from './format';
import type { Paged, LogRow } from './types';
import { Badge, Empty, Icon, Pager, Skeleton, useDebounced, useUI } from './ui';

const TONE: Record<string, string> = { create: 'info', approve: 'approved', reject: 'rejected', cancel: 'cancelled', revoke: 'rejected', recalc: 'pending' };

function summary(l: LogRow): string {
    const d = typeof l.detail === 'string' ? safe(l.detail) : l.detail || {};
    if (d.reason) return `Lý do: ${d.reason}`;
    if (d.note) return `Ghi chú: ${d.note}`;
    if (d.label) return `${d.label}${d.percent ? ` (${d.percent}%)` : ''}`;
    if (d.invoices !== undefined) return `${d.invoices} hóa đơn`;
    return '';
}
function safe(s: string) { try { return JSON.parse(s); } catch { return {}; } }

export default function LogsTab({ tick }: { tick: number }) {
    const { toast } = useUI();
    const [q, setQ] = useState(''); const dq = useDebounced(q);
    const [action, setAction] = useState('');
    const [page, setPage] = useState(1);
    const [data, setData] = useState<Paged<LogRow> | null>(null);

    const load = useCallback(() => {
        setData(null);
        wApi.logs({ q: dq, action, page, per_page: 20 }).then(setData).catch((e) => toast('error', 'Không tải được nhật ký', errMsg(e)));
    }, [dq, action, page, toast]);
    useEffect(() => { load(); }, [load, tick]);
    useEffect(() => setPage(1), [dq, action]);

    return (
        <>
            <div className="wv-bar">
                <div className="wv-search"><Icon n="search" /><input className="wv-input" placeholder="Tìm theo học sinh hoặc người thao tác…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
                <select className="wv-sel" value={action} onChange={(e) => setAction(e.target.value)}>
                    <option value="">Mọi thao tác</option>{Object.entries(ACTION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
            </div>
            <div className="wv-tw">
                {!data ? <Skeleton rows={8} /> : data.items.length === 0 ? <Empty icon="shield" title="Chưa có nhật ký" hint="Mọi thao tác lập, duyệt, thu hồi đều được ghi lại tại đây." /> : (
                    <table className="wv-t">
                        <thead><tr><th>Thời gian</th><th>Thao tác</th><th>Học sinh</th><th>Chi tiết</th><th>Người thực hiện</th></tr></thead>
                        <tbody>{data.items.map((l) => (
                            <tr key={l.id}>
                                <td className="wv-sub" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(l.created_at)}</td>
                                <td><Badge s={TONE[l.action.split('.')[0]] || 'info'} label={ACTION[l.action] || l.action} /></td>
                                <td>{l.student_name ? <><b>{l.student_name}</b><div className="wv-sub">{l.student_code}</div></> : '—'}</td>
                                <td className="wv-sub">{summary(l) || '—'}</td>
                                <td>{l.actor || '—'}</td>
                            </tr>))}</tbody>
                    </table>)}
            </div>
            {data && data.items.length > 0 && <Pager page={data.meta.page} last={data.meta.last_page} total={data.meta.total} onPage={setPage} />}
        </>
    );
}