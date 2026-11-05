'use client';

import { useState } from 'react';
import { Card, Empty, ErrorBox, HBars, Loading, Pill, Tabs, TrafficChart, dt, num, useLoad } from '../_hl';

const RANGE = [{ key: '1', label: '1 giờ' }, { key: '6', label: '6 giờ' }, { key: '24', label: '24 giờ' }, { key: '72', label: '3 ngày' }, { key: '168', label: '7 ngày' }];

export default function Performance() {
    const [h, setH] = useState('24');
    const { data, err, loading, reload } = useLoad<any>(`performance?hours=${h}`, 60);
    const [sort, setSort] = useState<'n' | 'avg_ms' | 'p95' | 'e5'>('n');

    return (
        <div className="hl-stack">
            <div className="hl-bar"><Tabs value={h} onChange={setH} items={RANGE} /><small className="hl-hint">Tự làm mới mỗi 60 giây</small></div>
            {loading && !data ? <Loading rows={5} /> : err && !data ? <ErrorBox msg={err} retry={reload} /> : !data!.totals.requests ? (
                <Card><Empty icon="∅" title="Chưa có số liệu trong khoảng này" text="Cần bật middleware RequestMonitor (xem HUONG-DAN-GIAM-SAT.md), sau đó dùng hệ thống để có số liệu." /></Card>
            ) : (() => {
                const d = data!, t = d.totals;
                const routes = [...d.routes].sort((a: any, b: any) => (b[sort] ?? 0) - (a[sort] ?? 0));
                const slowTone = (ms: number) => (ms >= d.slow_ms ? 'red' : ms >= d.slow_ms / 2 ? 'amber' : 'green');
                const dist = d.status_dist as { cls: string; n: number }[];
                return (
                    <>
                        <div className="hl-kpis six">
                            <div className="hl-kpi t-blue"><span>Tổng request</span><b>{num(t.requests)}</b><small>{t.rpm} / phút</small></div>
                            <div className="hl-kpi t-teal"><span>Thời gian TB</span><b>{t.avg_ms} ms</b><small>Chậm nhất {num(t.max_ms)} ms</small></div>
                            <div className={`hl-kpi t-${t.p95_ms > 1500 ? 'amber' : 'indigo'}`}><span>P95</span><b>{t.p95_ms} ms</b><small>95% request nhanh hơn mức này</small></div>
                            <div className={`hl-kpi t-${t.error_rate > 1 ? 'red' : 'green'}`}><span>Lỗi máy chủ 5xx</span><b>{num(t.e5)}</b><small>{t.error_rate}% tổng request</small></div>
                            <div className="hl-kpi t-slate"><span>Lỗi phía người dùng 4xx</span><b>{num(t.e4)}</b><small>401, 403, 404, 422…</small></div>
                            <div className={`hl-kpi t-${t.slow ? 'amber' : 'green'}`}><span>Request chậm</span><b>{num(t.slow)}</b><small>≥ {d.slow_ms} ms</small></div>
                        </div>

                        <Card title="Lưu lượng theo thời gian" sub="Cột: số request · Đường: thời gian TB (ms)">
                            <TrafficChart data={d.series} unit={Number(h) > 24 ? 'ngày' : 'giờ'} />
                        </Card>

                        <div className="hl-grid2 even">
                            <Card title="Phân bố mã trạng thái">
                                <HBars items={dist.map((x) => ({ label: `${x.cls} ${x.cls === '2xx' ? 'Thành công' : x.cls === '3xx' ? 'Chuyển hướng' : x.cls === '4xx' ? 'Lỗi người dùng' : 'Lỗi máy chủ'}`, value: Number(x.n), tone: x.cls === '2xx' ? 'green' : x.cls === '3xx' ? 'blue' : x.cls === '4xx' ? 'amber' : 'red' }))} />
                            </Card>
                            <Card title="Phân bố thời gian phản hồi">
                                <HBars items={d.latency.map((x: any, i: number) => ({ label: x.label, value: x.n, tone: ['green', 'teal', 'amber', 'red'][i] }))} />
                            </Card>
                        </div>

                        <Card title="Hiệu năng theo endpoint" sub="30 endpoint nhiều request nhất" right={
                            <select className="hl-in" value={sort} onChange={(e) => setSort(e.target.value as any)}><option value="n">Nhiều request nhất</option><option value="avg_ms">Chậm nhất (TB)</option><option value="p95">Chậm nhất (P95)</option><option value="e5">Nhiều lỗi 5xx nhất</option></select>} flush>
                            <div className="hl-tw"><table className="hl-table">
                                <thead><tr><th>Endpoint</th><th className="r">Request</th><th className="r">TB</th><th className="r">P95</th><th className="r">Max</th><th className="r">4xx</th><th className="r">5xx</th></tr></thead>
                                <tbody>{routes.map((r: any, i: number) => (
                                    <tr key={i}><td><Pill tone={r.method === 'GET' ? 'blue' : r.method === 'DELETE' ? 'red' : 'violet'}>{r.method}</Pill> <span className="mono">/{r.route}</span></td>
                                        <td className="r">{num(r.n)}</td><td className="r"><Pill tone={slowTone(r.avg_ms)}>{r.avg_ms} ms</Pill></td>
                                        <td className="r">{r.p95 != null ? `${r.p95} ms` : '—'}</td><td className="r">{num(r.max_ms)} ms</td>
                                        <td className="r">{r.e4 || '—'}</td><td className="r">{r.e5 ? <b className="bad">{r.e5}</b> : '—'}</td></tr>))}</tbody>
                            </table></div>
                        </Card>

                        <Card title="10 request chậm nhất" flush>
                            <div className="hl-tw"><table className="hl-table">
                                <thead><tr><th>Thời gian</th><th>Endpoint</th><th className="r">Mã</th><th className="r">Mất</th><th>IP</th></tr></thead>
                                <tbody>{d.slowest.map((r: any, i: number) => (
                                    <tr key={i}><td>{dt(r.created_at)}</td><td><span className="mono">{r.method} /{r.route}</span></td><td className="r"><Pill tone={r.status >= 500 ? 'red' : r.status >= 400 ? 'amber' : 'green'}>{r.status}</Pill></td><td className="r"><b>{num(r.ms)} ms</b></td><td className="mono">{r.ip || '—'}</td></tr>))}</tbody>
                            </table></div>
                        </Card>
                    </>
                );
            })()}
        </div>
    );
}