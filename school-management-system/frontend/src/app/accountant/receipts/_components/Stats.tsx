'use client';
import { useMemo, useState } from 'react';
import { changePct, fmtDate, Group, qs, StatsRes, vnd, vndShort } from '../_lib/rc';
import { Card, Empty, ErrorBox, Ico, ICON, Loading, Progress, Stat, useApi } from '../../periods/_components/ui';

const RANGES: [number, string][] = [[7, '7 ngày'], [30, '30 ngày'], [90, '90 ngày'], [180, '6 tháng'], [365, '12 tháng']];

function Bars({ rows, total }: { rows: Group[]; total: number }) {
    if (rows.length === 0) return <Empty text="Chưa có số liệu trong khoảng thời gian này." />;
    return (
        <ul className="pd-bars">
            {rows.map((r) => (
                <li key={r.key}><span title={r.label}>{r.label}</span><div><i style={{ width: `${total ? (r.amount / total) * 100 : 0}%` }} /></div><b>{vnd(r.amount)}</b><em>{r.count.toLocaleString('vi-VN')} phiếu · {total ? Math.round((r.amount / total) * 100) : 0}%</em></li>
            ))}
        </ul>
    );
}

/** Thống kê thu theo ngày, hình thức, khối, đợt thu, người thu. */
export function Stats({ refreshKey }: { refreshKey: number }) {
    const [days, setDays] = useState(30);
    const res = useApi<StatsRes>(`receipts/stats${qs({ days, k: refreshKey })}`);
    const s = res.data;
    // Khoảng dài thì gộp theo tuần cho dễ đọc
    const bars = useMemo(() => {
        if (!s) return [];
        const step = s.days > 90 ? 7 : 1;
        const out: { label: string; title: string; amount: number }[] = [];
        for (let i = 0; i < s.series.length; i += step) {
            const chunk = s.series.slice(i, i + step);
            const amount = chunk.reduce((a, c) => a + c.amount, 0);
            const first = chunk[0].date; const last = chunk[chunk.length - 1].date;
            out.push({ label: step === 1 ? first.slice(8) : first.slice(8, 10) + '/' + first.slice(5, 7), title: `${step === 1 ? fmtDate(first) : `${fmtDate(first)} – ${fmtDate(last)}`}: ${vnd(amount)}`, amount });
        }
        return out;
    }, [s]);
    const maxBar = Math.max(1, ...bars.map((b) => b.amount));
    const cmp = s ? changePct(s.month.this.amount, s.month.last_same.amount) : null;

    return (
        <>
            <div className="pd-toolbar">
                <div className="pd-tabs" role="group" aria-label="Khoảng thời gian">
                    {RANGES.map(([d, l]) => <button key={d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>{l}</button>)}
                </div>
                {s && <span className="pd-muted">Từ {fmtDate(s.from)} đến {fmtDate(s.to)} · chỉ tính phiếu còn hiệu lực</span>}
            </div>
            {res.loading && !s && <Loading />}
            {res.err && <ErrorBox msg={res.err} retry={res.reload} />}
            {s && (
                <>
                    <div className="pd-stats">
                        <Stat label="Tổng thu" value={vndShort(s.total)} hint={`${s.count.toLocaleString('vi-VN')} phiếu · ${vnd(s.total)}`} tone="ok" icon={<Ico d={ICON.cash} />} />
                        <Stat label="Trung bình mỗi ngày" value={vndShort(s.avg_day)} hint={`${s.days} ngày`} tone="info" icon={<Ico d={ICON.clock} />} />
                        <Stat label="Ngày thu cao nhất" value={s.best_day ? vndShort(s.best_day.amount) : '—'} hint={s.best_day ? `${fmtDate(s.best_day.date)} · ${s.best_day.count} phiếu` : 'Chưa có'} tone="warn" icon={<Ico d={ICON.check} />} />
                        <Stat label="Tháng này so với cùng kỳ tháng trước" value={cmp === null ? '—' : `${cmp >= 0 ? '+' : '−'}${Math.abs(cmp).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`}
                              hint={`${vndShort(s.month.this.amount)} so với ${vndShort(s.month.last_same.amount)} (cả tháng trước: ${vndShort(s.month.last.amount)})`} tone={cmp === null ? 'mut' : cmp >= 0 ? 'ok' : 'err'} icon={<Ico d={ICON.percent} />} />
                    </div>

                    <Card title={s.days > 90 ? 'Số tiền thu theo tuần' : 'Số tiền thu theo ngày'}>
                        {s.total === 0 ? <Empty text="Chưa có khoản thu nào trong khoảng thời gian này." /> : (
                            <div className="rc-chart" role="img" aria-label="Biểu đồ số tiền thu">
                                {bars.map((b, i) => (
                                    <div key={i} className="rc-bar" title={b.title}>
                                        <i style={{ height: `${Math.max(2, (b.amount / maxBar) * 100)}%`, opacity: b.amount ? 1 : 0.25 }} />
                                        <span>{bars.length <= 31 || i % Math.ceil(bars.length / 24) === 0 ? b.label : ''}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    <div className="pd-cols">
                        <Card title="Theo hình thức thanh toán"><Bars rows={s.by_method} total={s.total} /></Card>
                        <Card title="Theo khối"><Bars rows={s.by_grade} total={s.total} /></Card>
                        <Card title="Theo đợt thu" pad={false} className="wide">
                            {s.by_period.length === 0 ? <Empty text="Chưa có số liệu." /> : (
                                <div className="pd-tw"><table className="pd-table" style={{ minWidth: 0 }}>
                                    <thead><tr><th>Đợt thu</th><th className="n">Số phiếu</th><th className="n">Số tiền</th><th style={{ width: '30%' }}>Tỷ trọng</th></tr></thead>
                                    <tbody>{s.by_period.map((p) => <tr key={p.key}><td><b>{p.label}</b>{p.code && <small>{p.code}</small>}</td><td className="n">{p.count.toLocaleString('vi-VN')}</td><td className="n"><b>{vnd(p.amount)}</b></td><td><Progress paid={p.amount} total={Math.max(s.total, 1)} /></td></tr>)}</tbody>
                                </table></div>
                            )}
                        </Card>
                        <Card title="Theo người thu"><Bars rows={s.by_cashier} total={s.total} /></Card>
                        <Card title="Đối soát và phiếu hủy">
                            <ul className="pd-bars plain">
                                <li><span>Chuyển khoản, POS, ví điện tử</span><b>{vnd(s.recon.amount)}</b></li>
                                <li><span>Đã đối soát với sao kê</span><b className="ok">{vnd(s.recon.done_amount)} ({s.recon.done_count}/{s.recon.count} phiếu)</b></li>
                                <li><span>Chưa đối soát</span><b className={s.recon.count - s.recon.done_count ? 'warn' : ''}>{vnd(s.recon.amount - s.recon.done_amount)} ({s.recon.count - s.recon.done_count} phiếu)</b></li>
                                <li><span>Phiếu đã hủy trong kỳ</span><b className={s.voided.count ? 'bad' : ''}>{s.voided.count} phiếu · {vnd(s.voided.amount)}</b></li>
                            </ul>
                            <Progress paid={s.recon.done_amount} total={Math.max(s.recon.amount, 1)} />
                        </Card>
                    </div>
                </>
            )}
        </>
    );
}