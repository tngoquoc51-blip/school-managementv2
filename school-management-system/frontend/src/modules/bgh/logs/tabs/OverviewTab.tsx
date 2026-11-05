'use client';

import { useEffect } from 'react';
import s from '../logs.module.css';
import { logsApi } from '../api';
import { AreaChart, Bars, Donut, Heatmap, Legend } from '../components/Charts';
import { Icon } from '../components/Icons';
import { Card, Empty, ErrorBox, Kpi, ModTag, SevChip, Skeleton, StatusChip, Who, useAsync } from '../components/ui';
import { MODULES, ago, delta, fmtTime, moduleLabel, nf, roleLabel } from '../format';
import type { Overview } from '../types';
import type { TabProps } from './tabProps';

const SEV_COLOR = { info: '#60a5fa', notice: '#22d3ee', warning: '#fbbf24', critical: '#fb4f72' } as const;
const SEV_LABEL = { info: 'Thông tin', notice: 'Lưu ý', warning: 'Cảnh báo', critical: 'Nghiêm trọng' } as const;

export default function OverviewTab({ range, tick, openLog, goActivity, goTab, onBadges }: TabProps) {
    const { data, error, loading, run } = useAsync<Overview>();
    useEffect(() => { run(() => logsApi.overview(range), tick > 0); }, [range, tick, run]);
    useEffect(() => { if (data) onBadges({ alerts: data.kpi.open_alerts }); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

    if (error && !data) return <ErrorBox message={error} onRetry={() => run(() => logsApi.overview(range))} />;
    if (!data) return <div className={`${s.grid} ${s.g4}`}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={130} />)}</div>;

    const k = data.kpi, d = delta(k.total, k.prev_total);
    const sevMap = Object.fromEntries(data.by_severity.map((x) => [x.severity, x.c]));
    const bad = data.by_status.filter((x) => x.status !== 'success').reduce((a, b) => a + Number(b.c), 0);

    return (
        <div className={s.stack} style={{ opacity: loading ? 0.7 : 1, transition: '.2s' }}>
            <div className={`${s.grid} ${s.g4}`}>
                <Kpi icon="pulse" label="Tổng sự kiện" value={nf(k.total)} tone="#7b8bff"
                     foot={<><span className={d.up ? s.up : s.down}>{d.up ? '▲' : '▼'} {d.pct}%</span> so với kỳ trước</>} />
                <Kpi icon="shield" label="Thất bại / bị từ chối" value={nf(bad)} tone="#fbbf24"
                     foot={`${k.total ? Math.round((bad / k.total) * 100) : 0}% tổng sự kiện`} />
                <Kpi icon="alert" label="Cảnh báo & nghiêm trọng" value={nf(k.warnings + k.criticals)} tone="#fb4f72"
                     foot={<>{nf(k.criticals)} nghiêm trọng · {nf(k.warnings)} cảnh báo</>} />
                <Kpi icon="bell" label="Cảnh báo đang mở" value={nf(k.open_alerts)} tone="#22d3ee"
                     foot={<>{nf(k.actors)} người dùng · {nf(k.ips)} IP · {nf(k.active_sessions)} phiên</>} />
            </div>

            <div className={`${s.grid} ${s.g21}`}>
                <Card title="Hoạt động theo thời gian" sub={range === 'today' ? 'Theo giờ trong hôm nay' : 'Theo ngày'}
                      right={<Legend items={[{ label: 'Tổng', color: '#7b8bff' }, { label: 'Thất bại', color: '#fbbf24' }, { label: 'Rủi ro', color: '#fb4f72' }]} />}>
                    <AreaChart data={data.series} series={[
                        { key: 'total', label: 'Tổng sự kiện', color: '#7b8bff', fill: true },
                        { key: 'failed', label: 'Thất bại / từ chối', color: '#fbbf24' },
                        { key: 'risky', label: 'Cảnh báo & nghiêm trọng', color: '#fb4f72' },
                    ]} />
                </Card>
                <Card title="Cơ cấu mức độ" sub="Bấm để lọc nhật ký">
                    <div className={s.donutWrap}>
                        <Donut parts={(Object.keys(SEV_COLOR) as (keyof typeof SEV_COLOR)[]).map((x) => ({ label: SEV_LABEL[x], value: Number(sevMap[x] || 0), color: SEV_COLOR[x] }))}
                               center={{ top: nf(k.total), bottom: 'sự kiện' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 1, minWidth: 140 }}>
                            {(Object.keys(SEV_COLOR) as (keyof typeof SEV_COLOR)[]).map((x) => (
                                <button key={x} className={`${s.linkBtn} ${s.clickable}`} onClick={() => goActivity({ severity: x })} style={{ justifyContent: 'space-between', padding: '4px 8px' }}>
                                    <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: SEV_COLOR[x], marginRight: 8 }} />{SEV_LABEL[x]}</span>
                                    <b style={{ color: 'var(--text)' }}>{nf(sevMap[x] || 0)}</b>
                                </button>
                            ))}
                        </div>
                    </div>
                </Card>
            </div>

            <div className={`${s.grid} ${s.g2}`}>
                <Card title="Theo phân hệ" sub="Bấm một dòng để xem nhật ký của phân hệ đó">
                    {data.by_module.length ? <Bars onPick={(m) => goActivity({ module: m })}
                                                   rows={data.by_module.map((m) => ({ label: moduleLabel(m.module), key: m.module, value: Number(m.c), color: MODULES[m.module]?.color }))} />
                        : <Empty title="Chưa có dữ liệu" />}
                </Card>
                <Card title="Nhịp hoạt động" sub="Số sự kiện theo giờ trong ngày × thứ trong tuần">
                    <Heatmap cells={data.heatmap} />
                </Card>
            </div>

            <div className={`${s.grid} ${s.g2}`}>
                <Card title="Người dùng hoạt động nhiều nhất" right={<button className={`${s.btn} ${s.sm} ${s.ghost}`} onClick={() => goTab('activity')}>Xem tất cả</button>}>
                    {data.top_actors.length ? (
                        <div className={s.list}>
                            {data.top_actors.map((a) => (
                                <div key={a.actor_type + a.actor_id} className={`${s.li} ${s.clickable}`} onClick={() => goActivity({ actor_type: a.actor_type, actor_id: String(a.actor_id) })}>
                                    <div className={s.liBody}><Who name={a.actor_name} sub={roleLabel(a.actor_role)} /></div>
                                    {Number(a.failed) > 0 && <span className={`${s.chip} ${s.st_failed}`}>{a.failed} lỗi</span>}
                                    <b>{nf(a.c)}</b>
                                </div>
                            ))}
                        </div>
                    ) : <Empty title="Chưa có dữ liệu" />}
                </Card>
                <Card title="Địa chỉ IP nổi bật" sub="Sắp xếp theo số sự kiện">
                    {data.top_ips.length ? (
                        <div className={s.list}>
                            {data.top_ips.map((i) => (
                                <div key={i.ip} className={`${s.li} ${s.clickable}`} onClick={() => goActivity({ ip: i.ip })}>
                                    <div className={s.liBody}><span className={s.mono}>{i.ip}</span><div className={`${s.small} ${s.muted}`}>{i.actors} tài khoản</div></div>
                                    {Number(i.failed) > 0 && <span className={`${s.chip} ${s.st_failed}`}>{i.failed} lỗi</span>}
                                    <b>{nf(i.c)}</b>
                                </div>
                            ))}
                        </div>
                    ) : <Empty title="Chưa có dữ liệu" />}
                </Card>
            </div>

            <Card title="Sự kiện cần chú ý gần đây" sub="Mức cảnh báo và nghiêm trọng mới nhất">
                {data.latest_critical.length ? (
                    <div className={s.list}>
                        {data.latest_critical.map((m) => (
                            <div key={m.id} className={`${s.li} ${s.clickable}`} onClick={() => openLog(m.id)}>
                                <SevChip v={m.severity} />
                                <div className={s.liBody}>
                                    <div className={s.liTitle}>{m.summary}</div>
                                    <div className={`${s.small} ${s.muted}`}>{m.actor_name || 'Hệ thống'} · <ModTag m={m.module} /></div>
                                </div>
                                <StatusChip v={m.status} />
                                <span className={`${s.small} ${s.muted}`} title={fmtTime(m.occurred_at, true)}>{ago(m.occurred_at)}</span>
                            </div>
                        ))}
                    </div>
                ) : <Empty icon="shield" title="Không có sự kiện đáng chú ý" hint="Hệ thống đang hoạt động bình thường." />}
            </Card>
            <div className={`${s.small} ${s.faint}`} style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="clock" size={13} /> Dữ liệu tính từ {fmtTime(data.from, true)}</div>
        </div>
    );
}