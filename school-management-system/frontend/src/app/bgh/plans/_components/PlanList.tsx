'use client';

import { PRIORITY_TONE, STATUS_TONE } from '../_lib/types';
import type { Filters, Options, Plan, Summary } from '../_lib/types';
import { Bar, Pill, fmtDate, num, vndShort } from './ui';

interface Props {
    rows: Plan[]; meta: { current_page: number; last_page: number; total: number; summary: Summary } | null; f: Filters;
    setF: (fn: (x: Filters) => Filters) => void; loading: boolean; opts: Options; onOpen: (id: number) => void;
}

export default function PlanList({ rows, meta, f, setF, loading, opts, onOpen }: Props) {
    const sort = (k: string) => setF((x) => ({ ...x, sort: k, dir: x.sort === k && x.dir === 'asc' ? 'desc' : 'asc', page: 1 }));
    const arrow = (k: string) => (f.sort === k ? (f.dir === 'asc' ? ' ↑' : ' ↓') : '');

    return (
        <div className="pl-stack" style={{ opacity: loading ? 0.7 : 1 }}>
            {meta && (
                <div className="pl-grid4">
                    <div className="pl-kpi"><span>Kết quả lọc</span><b>{num(meta.summary.total)}</b><small>kế hoạch</small></div>
                    <div className="pl-kpi ok"><span>Tiến độ trung bình</span><b>{meta.summary.avg_progress}%</b></div>
                    <div className={`pl-kpi ${meta.summary.late ? 'err' : 'ok'}`}><span>Trễ hạn</span><b>{meta.summary.late}</b></div>
                    <div className="pl-kpi vio"><span>Ngân sách</span><b style={{ fontSize: '1.4em' }}>{vndShort(meta.summary.spent)}</b><small>/ {vndShort(meta.summary.budget)} dự toán</small></div>
                </div>
            )}
            <div className="pl-tw">
                <table className="pl-table">
                    <thead>
                    <tr>
                        <th onClick={() => sort('title')}>Kế hoạch{arrow('title')}</th><th>Phụ trách</th><th onClick={() => sort('start_date')}>Thời gian{arrow('start_date')}</th>
                        <th onClick={() => sort('progress')} style={{ minWidth: 150 }}>Tiến độ{arrow('progress')}</th><th>Trạng thái</th><th onClick={() => sort('priority')}>Ưu tiên{arrow('priority')}</th><th onClick={() => sort('end_date')}>Hạn{arrow('end_date')}</th>
                    </tr>
                    </thead>
                    <tbody>
                    {rows.map((p) => (
                        <tr key={p.id} onClick={() => onOpen(p.id)}>
                            <td><div className="pl-t"><b>{p.title}</b><small>{p.code} · {opts.levels[p.level]} · {opts.categories[p.category]}{p.children_count ? ` · ${p.children_count} kế hoạch con` : ''}</small></div></td>
                            <td><div className="pl-t"><span>{p.owner_name || '—'}</span><small>{p.department || ''}</small></div></td>
                            <td>{fmtDate(p.start_date)} → {fmtDate(p.end_date)}</td>
                            <td><div className="pl-t"><Bar value={p.progress} tone={p.is_late ? 'err' : p.progress >= 100 ? 'ok' : 'sky'} /><small>{p.progress}%{p.tasks_total ? ` · ${p.tasks_done}/${p.tasks_total} nhiệm vụ` : ''}</small></div></td>
                            <td><Pill tone={STATUS_TONE[p.status] ?? 'mut'}>{opts.statuses[p.status] ?? p.status}</Pill></td>
                            <td><Pill tone={PRIORITY_TONE[p.priority] ?? 'mut'}>{opts.priorities[p.priority]}</Pill></td>
                            <td>{p.is_late ? <Pill tone="err">Trễ {Math.abs(p.days_left ?? 0)} ngày</Pill> : p.days_left !== null && p.days_left >= 0 && p.days_left <= 14 && !['completed', 'cancelled', 'draft', 'rejected'].includes(p.status) ? <Pill tone="warn">Còn {p.days_left} ngày</Pill> : <span className="pl-mu">{fmtDate(p.end_date)}</span>}</td>
                        </tr>
                    ))}
                    {!rows.length && !loading && <tr><td colSpan={7} className="pl-empty">Không có kế hoạch phù hợp. Bấm “Kế hoạch mới” hoặc “Tạo từ mẫu” để bắt đầu.</td></tr>}
                    </tbody>
                </table>
            </div>
            {meta && meta.last_page > 1 && (
                <div className="pl-pager">
                    <button className="pl-btn ghost sm" disabled={f.page <= 1} onClick={() => setF((x) => ({ ...x, page: x.page - 1 }))}>‹ Trước</button>
                    <span>Trang {meta.current_page} / {meta.last_page} · {num(meta.total)} kế hoạch</span>
                    <button className="pl-btn ghost sm" disabled={f.page >= meta.last_page} onClick={() => setF((x) => ({ ...x, page: x.page + 1 }))}>Sau ›</button>
                </div>
            )}
        </div>
    );
}