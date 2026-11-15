'use client';

import { STATUS_COLOR, STATUS_ORDER, STATUS_TONE } from '../_lib/types';
import type { Filters, MiniPlan, Options, Stats } from '../_lib/types';
import { Bar, Icon, Pill, fmtDT, fmtDate, num, vndShort } from './ui';

interface Props {
    stats: Stats | null; loading: boolean; opts: Options; year: string; onYear: (y: string) => void;
    onOpen: (id: number) => void; onList: (patch: Partial<Filters>) => void;
}

function MiniList({ items, opts, late, onOpen, empty }: { items: MiniPlan[]; opts: Options; late?: boolean; onOpen: (id: number) => void; empty: string }) {
    if (!items.length) return <p className="pl-empty">{empty}</p>;
    return (
        <div className={`pl-mini${late ? ' late' : ''}`}>
            {items.map((p) => (
                <button key={p.id} onClick={() => onOpen(p.id)}>
                    <div className="r"><b>{p.title}</b><Pill tone={STATUS_TONE[p.status] ?? 'mut'}>{opts.statuses[p.status] ?? p.status}</Pill></div>
                    <div className="r"><small className="pl-mu">{p.code} · {p.owner_name || '—'} · hạn {fmtDate(p.end_date)}</small><small>{p.progress}%</small></div>
                    <Bar value={p.progress} tone={late ? 'err' : 'sky'} />
                </button>
            ))}
        </div>
    );
}

export default function Dashboard({ stats: s, loading, opts, year, onYear, onOpen, onList }: Props) {
    if (!s) return <div className="pl-loading"><i className="pl-spin" />Đang tải tổng quan…</div>;
    const total = Math.max(1, s.total);
    const maxM = Math.max(1, ...s.months.map((m) => m.count));
    const pct = Math.min(100, s.budget ? Math.round((s.spent / s.budget) * 100) : 0);
    const pending = s.by_status.pending ?? 0;

    return (
        <div className="pl-stack" style={{ opacity: loading ? 0.7 : 1 }}>
            <div className="pl-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="pl-mu">Số liệu theo</span>
                <select className="pl-in" style={{ width: 220 }} value={year} onChange={(e) => onYear(e.target.value)}>
                    <option value="">Tất cả năm học</option>{opts.school_years.map((y) => <option key={y} value={y}>Năm học {y}</option>)}
                </select>
            </div>

            <div className="pl-grid4">
                <div className="pl-kpi"><span>Tổng số kế hoạch</span><b>{num(s.total)}</b><small>{num(s.by_status.running ?? 0)} đang thực hiện</small></div>
                <div className="pl-kpi ok" style={{ gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
                    <div style={{ display: 'grid', gap: 3 }}><span>Tiến độ trung bình</span><b>{s.avg_progress}%</b><small>{num(s.by_status.completed ?? 0)} đã hoàn thành</small></div>
                    <div className="pl-ring" style={{ background: `conic-gradient(#10b981 ${s.avg_progress * 3.6}deg,#e2e8f0 0)` }}><b>{s.avg_progress}%</b></div>
                </div>
                <div className={`pl-kpi ${s.late.length ? 'err' : 'ok'} click`} onClick={() => onList({ view: 'late' })}><span>Trễ hạn</span><b>{s.late.length}</b><small>{s.late.length ? 'cần xử lý ngay →' : 'không có kế hoạch trễ'}</small></div>
                <div className={`pl-kpi ${pending ? 'warn' : ''} click`} onClick={() => onList({ view: 'pending' })}><span>Chờ phê duyệt</span><b>{pending}</b><small>{pending ? 'bấm để duyệt →' : 'không có hồ sơ chờ'}</small></div>
            </div>

            <div className="pl-grid4">
                <div className="pl-kpi vio"><span>Nhiệm vụ quá hạn</span><b>{s.tasks.overdue}</b><small>chưa hoàn thành</small></div>
                <div className="pl-kpi warn"><span>Đến hạn trong 7 ngày</span><b>{s.tasks.due_week}</b><small>nhiệm vụ</small></div>
                <div className="pl-kpi err"><span>Đang vướng mắc</span><b>{s.tasks.blocked}</b><small>nhiệm vụ bị chặn</small></div>
                <div className="pl-kpi ok"><span>Hoàn thành tháng này</span><b>{s.tasks.done_month}</b><small>nhiệm vụ</small></div>
            </div>

            <div className="pl-grid2">
                <section className="pl-card">
                    <header><h2>Tình trạng kế hoạch</h2><span className="pl-mu">{num(s.total)} kế hoạch</span></header>
                    <div className="pl-stbar">
                        {STATUS_ORDER.filter((k) => (s.by_status[k] ?? 0) > 0).map((k) => (
                            <i key={k} title={`${opts.statuses[k]}: ${s.by_status[k]}`} style={{ width: `${(s.by_status[k] / total) * 100}%`, background: STATUS_COLOR[k] }} onClick={() => onList({ status: k })} />
                        ))}
                    </div>
                    <div className="pl-legend">
                        {STATUS_ORDER.map((k) => <button key={k} onClick={() => onList({ status: k })}><i style={{ background: STATUS_COLOR[k] }} />{opts.statuses[k]} <b>{s.by_status[k] ?? 0}</b></button>)}
                    </div>
                    <h3 className="pl-h3">Kế hoạch đang hoạt động theo tháng</h3>
                    <div className="pl-months">
                        {s.months.map((m) => <div key={m.label + m.year}><b>{m.count || ''}</b><i style={{ height: `${(m.count / maxM) * 80 + 4}px` }} /><small>{m.label}</small></div>)}
                    </div>
                </section>
                <section className="pl-card">
                    <header><h2>Tiến độ theo lĩnh vực</h2></header>
                    <div className="pl-hb">
                        {s.by_category.length === 0 && <p className="pl-empty">Chưa có dữ liệu.</p>}
                        {s.by_category.map((c) => (
                            <div key={c.key}><p><b>{c.label}</b><span>{c.count} kế hoạch · {c.progress}%</span></p><Bar value={c.progress} tone={c.progress >= 70 ? 'ok' : c.progress >= 40 ? 'sky' : 'warn'} /></div>
                        ))}
                    </div>
                    <h3 className="pl-h3">Ngân sách</h3>
                    <p className="pl-row" style={{ justifyContent: 'space-between' }}><span>Đã chi <b>{vndShort(s.spent)}</b></span><span className="pl-mu">Dự toán {vndShort(s.budget)}</span></p>
                    <Bar value={pct} tone={pct > 100 ? 'err' : pct > 80 ? 'warn' : 'ok'} />
                </section>
            </div>

            <div className="pl-grid3">
                <section className="pl-card"><header><h2>Trễ hạn</h2><Pill tone={s.late.length ? 'err' : 'ok'}>{s.late.length}</Pill></header><MiniList items={s.late} opts={opts} late onOpen={onOpen} empty="Không có kế hoạch trễ hạn." /></section>
                <section className="pl-card"><header><h2>Sắp đến hạn (14 ngày)</h2><Pill tone="warn">{s.soon.length}</Pill></header><MiniList items={s.soon} opts={opts} onOpen={onOpen} empty="Không có kế hoạch sắp đến hạn." /></section>
                <section className="pl-card"><header><h2>Chờ phê duyệt</h2><Pill tone="warn">{s.pending.length}</Pill></header><MiniList items={s.pending} opts={opts} onOpen={onOpen} empty="Không có kế hoạch chờ duyệt." /></section>
            </div>

            <section className="pl-card">
                <header><h2>Hoạt động gần đây</h2></header>
                <ul className="pl-feed">
                    {s.recent.map((a) => (
                        <li key={a.id}>
                            <span className={`dot ${a.type}`}><Icon n={a.type === 'comment' ? 'comment' : a.type === 'approval' ? 'check' : a.type === 'link' ? 'link' : a.type === 'task' ? 'flag' : 'edit'} s={14} /></span>
                            <div><b>{a.plan_title}</b><span>{a.message}</span><small>{a.user_name ?? 'Hệ thống'} · {fmtDT(a.created_at)}</small></div>
                        </li>
                    ))}
                    {!s.recent.length && <li className="pl-empty">Chưa có hoạt động.</li>}
                </ul>
            </section>
        </div>
    );
}