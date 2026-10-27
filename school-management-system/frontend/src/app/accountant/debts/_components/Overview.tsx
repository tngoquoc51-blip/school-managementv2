'use client';
import { useState } from 'react';
import { BUCKET_COLOR, BUCKET_SHORT, BUCKET_TONE, DMeta, Group, OverviewRes, qs, vnd, vndShort } from '../_lib/db';
import { Card, Chip, Empty, ErrorBox, Loading, Progress, useApi } from '../../periods/_components/ui';
import type { Preset } from './List';

type Props = { meta: DMeta; refreshKey: number; onOpen: (id: number) => void; onGo: (p: Preset) => void };

function GroupTable({ rows, first, onPick, limit }: { rows: Group[]; first: string; onPick?: (g: Group) => void; limit?: number }) {
    const [all, setAll] = useState(false);
    const show = limit && !all ? rows.slice(0, limit) : rows;
    if (rows.length === 0) return <Empty text="Chưa có số liệu." />;
    return (
        <>
            <div className="pd-tw"><table className="pd-table" style={{ minWidth: 0 }}>
                <thead><tr><th>{first}</th><th className="n">Còn nợ</th><th className="n">Quá hạn</th><th className="n">HS nợ</th><th style={{ width: '24%' }}>Đã thu</th></tr></thead>
                <tbody>{show.map((g) => (
                    <tr key={g.key}>
                        <td>{onPick ? <button className="cl-link" onClick={() => onPick(g)}><b>{g.label}</b></button> : <b>{g.label}</b>}</td>
                        <td className="n"><b className={g.balance > 0 ? 'bad' : ''}>{vnd(g.balance)}</b></td>
                        <td className="n">{vnd(g.overdue)}</td>
                        <td className="n">{g.debtors}/{g.students}</td>
                        <td><Progress paid={g.paid} total={Math.max(g.billed, 1)} /><small className="pd-muted">{g.paid_pct}%</small></td>
                    </tr>))}</tbody>
            </table></div>
            {limit && rows.length > limit && <div className="dbt-more"><button className="pd-btn ghost sm" onClick={() => setAll((v) => !v)}>{all ? 'Thu gọn' : `Xem tất cả ${rows.length}`}</button></div>}
        </>
    );
}

/** Tổng quan công nợ: tuổi nợ, theo khối, lớp, đợt thu và các em nợ nhiều nhất. */
export function Overview({ meta, refreshKey, onOpen, onGo }: Props) {
    const [yearId, setYearId] = useState('');
    const res = useApi<OverviewRes>(`debts/overview${qs({ year_id: yearId, k: refreshKey })}`);
    const o = res.data;
    const totalAging = o ? o.aging.reduce((s, a) => s + a.amount, 0) : 0;

    return (
        <>
            <div className="pd-toolbar">
                <label className="dbt-sel">Năm học của hóa đơn
                    <select className="pd-in" value={yearId} onChange={(e) => setYearId(e.target.value)}><option value="">Tất cả năm học</option>{meta.years.map((y) => <option key={y.id} value={y.id}>{y.label}{y.is_current ? ' (hiện tại)' : ''}</option>)}</select>
                </label>
                {o && <span className="pd-muted">{o.total.students.toLocaleString('vi-VN')} học sinh có hóa đơn · tỷ lệ đã thu <b>{o.total.collect_pct.toLocaleString('vi-VN')}%</b></span>}
            </div>
            {res.loading && !o && <Loading />}
            {res.err && <ErrorBox msg={res.err} retry={res.reload} />}
            {o && (
                <>
                    <Card title="Tuổi nợ" right={<span className="pd-muted">Bấm vào một nhóm để xem danh sách học sinh</span>}>
                        {totalAging === 0 ? <Empty text="Không có công nợ. Mọi hóa đơn đã đóng đủ." /> : (
                            <>
                                <div className="dbt-aging" role="img" aria-label="Biểu đồ tuổi nợ">
                                    {o.aging.filter((a) => a.amount > 0).map((a) => <button key={a.key} title={`${BUCKET_SHORT[a.key]}: ${vnd(a.amount)}`} style={{ flexGrow: a.amount, background: BUCKET_COLOR[a.key] }} onClick={() => onGo({ bucket: a.key })} aria-label={`${a.label}: ${vnd(a.amount)}`} />)}
                                </div>
                                <ul className="dbt-legend">
                                    {o.aging.map((a) => (
                                        <li key={a.key}><button onClick={() => onGo({ bucket: a.key })} disabled={a.amount === 0}>
                                            <i style={{ background: BUCKET_COLOR[a.key] }} /><span>{a.label}</span><b>{vnd(a.amount)}</b>
                                            <em>{a.invoices.toLocaleString('vi-VN')} hóa đơn · {totalAging ? Math.round((a.amount / totalAging) * 100) : 0}%</em>
                                        </button></li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </Card>

                    <div className="pd-cols">
                        <Card title="Theo khối"><GroupTable rows={o.by_grade} first="Khối" onPick={(g) => onGo({ grade: g.key })} /></Card>
                        <Card title="Em nợ nhiều nhất" pad={false}>
                            {o.top.length === 0 ? <Empty text="Không có học sinh còn nợ." /> : (
                                <ul className="dbt-top">
                                    {o.top.map((s, i) => (
                                        <li key={s.id}><span className="dbt-rank">{i + 1}</span>
                                            <button className="cl-link" onClick={() => onOpen(s.id)}><b>{s.name}</b><small>{s.code} · {s.class || '—'}</small></button>
                                            <div><b className="bad">{vnd(s.balance)}</b>{s.max_days > 0 ? <Chip tone={BUCKET_TONE[s.bucket]}>quá {s.max_days} ngày</Chip> : <Chip tone="info">chưa đến hạn</Chip>}</div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Card>
                        <Card title="Theo lớp (năm học hiện tại)" pad={false} className="wide"><GroupTable rows={o.by_class} first="Lớp" limit={10} onPick={(g) => onGo({ class_id: g.key })} /></Card>
                        <Card title="Theo đợt thu" pad={false} className="wide">
                            {o.by_period.length === 0 ? <Empty text="Chưa có số liệu." /> : (
                                <div className="pd-tw"><table className="pd-table" style={{ minWidth: 0 }}>
                                    <thead><tr><th>Đợt thu</th><th className="n">Phải thu</th><th className="n">Đã thu</th><th className="n">Còn nợ</th><th className="n">HS nợ</th><th style={{ width: '22%' }}>Tỷ lệ đã thu</th></tr></thead>
                                    <tbody>{o.by_period.map((p) => (
                                        <tr key={p.key}><td><b>{p.label}</b><small>{p.year}</small></td><td className="n">{vndShort(p.billed)}</td><td className="n">{vndShort(p.paid)}</td>
                                            <td className="n"><b className={p.balance > 0 ? 'bad' : 'ok'}>{vnd(p.balance)}</b></td><td className="n">{p.debtors}</td>
                                            <td><Progress paid={p.paid} total={Math.max(p.billed, 1)} /><small className="pd-muted">{p.paid_pct}%</small></td></tr>))}</tbody>
                                </table></div>
                            )}
                        </Card>
                    </div>
                </>
            )}
        </>
    );
}