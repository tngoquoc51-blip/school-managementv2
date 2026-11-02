'use client';

import { useCallback, useEffect, useState } from 'react';
import { Donut, Heatmap, HBars, HealthRing, StackedBars } from '../charts';
import Icon from '../Icon';
import { logsApi } from '../logsApi';
import { Chip, Delta, Empty, ErrorState, LevelBadge, Panel, Segmented, Skeleton } from '../ui';
import type { EventFilters, Overview } from '../types';
import { ACTOR_TYPE, CATEGORY_LABEL, actionLabel, fmtMs, fmtNum, relativeBucketLabel, timeAgo, fmtFull } from '../utils';

interface Props {
    refreshKey: number;
    onOpenEvent: (id: number) => void;
    onGoEvents: (patch: Partial<EventFilters>) => void;
    onGoTab: (t: 'security' | 'alerts' | 'storage') => void;
    onLoaded?: (o: Overview) => void;
}

const CAT_COLORS = ['var(--brand)', 'var(--lv-info)', 'var(--lv-notice)', 'var(--lv-warning)', 'var(--lv-error)', 'var(--teal)', 'var(--lv-critical)', 'var(--lv-debug)', '#8d6e63'];

export default function OverviewTab({ refreshKey, onOpenEvent, onGoEvents, onGoTab, onLoaded }: Props) {
    const [range, setRange] = useState<'24h' | '7d' | '30d'>('24h');
    const [data, setData] = useState<Overview | null>(null);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setError('');
        try {
            const o = await logsApi.overview(range);
            setData(o);
            onLoaded?.(o);
        } catch (e) {
            setError((e as Error).message);
        }
    }, [range, onLoaded]);

    useEffect(() => { load(); }, [load, refreshKey]);
    useEffect(() => {
        const t = window.setInterval(load, 60000);
        return () => window.clearInterval(t);
    }, [load]);

    if (error && !data) return <ErrorState message={error} onRetry={load} />;
    if (!data) {
        return (
            <div className="lg-stack">
                <div className="lg-kpis">{Array.from({ length: 6 }, (_, i) => <div key={i} className="lg-kpi"><Skeleton h={14} w="60%" /><Skeleton h={30} w="50%" /></div>)}</div>
                <Panel><Skeleton h={220} /></Panel>
            </div>
        );
    }

    const k = data.kpis;
    const rangeLabel = range === '24h' ? '24 giờ' : range === '7d' ? '7 ngày' : '30 ngày';
    const kpiList: { key: keyof typeof k; label: string; tone: string; icon: string; goodDown?: boolean; patch?: Partial<EventFilters> }[] = [
        { key: 'total', label: 'Tổng sự kiện', tone: 'brand', icon: 'activity', patch: {} },
        { key: 'errors', label: 'Lỗi', tone: 'error', icon: 'alert', goodDown: true, patch: { level: ['error', 'critical'] } },
        { key: 'warnings', label: 'Cảnh báo', tone: 'warning', icon: 'flag', goodDown: true, patch: { level: ['warning'] } },
        { key: 'failed_logins', label: 'Đăng nhập sai', tone: 'coral', icon: 'lock', goodDown: true, patch: { action: 'auth.login_failed' } },
        { key: 'actors', label: 'Người hoạt động', tone: 'teal', icon: 'user' },
        { key: 'ips', label: 'Địa chỉ IP', tone: 'violet', icon: 'globe' },
    ];

    return (
        <div className="lg-stack">
            <div className="lg-toolbar">
                <Segmented label="Khoảng thời gian" value={range} onChange={setRange} options={[{ key: '24h', label: '24 giờ' }, { key: '7d', label: '7 ngày' }, { key: '30d', label: '30 ngày' }]} />
                <span className="lg-muted lg-small"><Icon name="clock" size={14} /> Cập nhật {timeAgo(data.generated_at)} · tự làm mới mỗi phút</span>
            </div>

            <section className="lg-kpis" aria-label="Chỉ số chính">
                {kpiList.map((c) => (
                    <button key={c.key} type="button" className={`lg-kpi lg-kpi--${c.tone}`} onClick={() => onGoEvents({ range, ...c.patch })} title="Xem các sự kiện này">
                        <span className="lg-kpi__icon"><Icon name={c.icon} size={18} /></span>
                        <span className="lg-kpi__label">{c.label}</span>
                        <strong>{fmtNum(k[c.key].value)}</strong>
                        <span className="lg-kpi__foot"><Delta value={k[c.key].delta} goodWhenDown={c.goodDown} /> <small>so với {rangeLabel} trước</small></span>
                    </button>
                ))}
            </section>

            <div className="lg-grid lg-grid--main">
                <Panel title="Lưu lượng sự kiện" desc={`Số sự kiện theo ${range === '24h' ? 'giờ' : range === '7d' ? '6 giờ' : 'ngày'}, chia theo mức độ.`}
                       actions={<div className="lg-legend"><span><i className="lg-dot-ok" />Bình thường</span><span><i className="lg-dot-warning" />Cảnh báo</span><span><i className="lg-dot-error" />Lỗi</span></div>}>
                    {data.series.length ? <StackedBars data={data.series} labelFn={(t) => relativeBucketLabel(t, range)} /> : <Empty icon="activity" title="Chưa có dữ liệu" />}
                </Panel>

                <Panel title="Sức khỏe hệ thống" desc={`Tính từ dữ liệu ${rangeLabel} qua.`}>
                    <div className="lg-health">
                        <HealthRing score={data.health.score} grade={data.health.grade} />
                        {data.health.parts.length === 0 ? (
                            <p className="lg-ok-note"><Icon name="check" size={16} /> Không phát hiện vấn đề nào.</p>
                        ) : (
                            <ul className="lg-health__parts">
                                {data.health.parts.map((p) => <li key={p.key}><span><b>−{p.penalty}</b> {p.label}</span><small>{p.detail}</small></li>)}
                            </ul>
                        )}
                    </div>
                </Panel>
            </div>

            {data.anomalies.length > 0 && (
                <section className="lg-anomalies" aria-label="Phát hiện bất thường">
                    {data.anomalies.map((a) => (
                        <button key={a.scope} type="button" className="lg-anomaly" onClick={() => onGoEvents({ range: '1h', category: a.scope in CATEGORY_LABEL ? [a.scope] : [], level: a.scope === 'errors' ? ['error', 'critical'] : [] })}>
                            <span className="lg-anomaly__icon"><Icon name="zap" size={18} /></span>
                            <span><strong>Bất thường: {a.label}</strong><small>{a.current} sự kiện trong giờ này, thường chỉ ~{a.baseline} (cao gấp {a.baseline > 0 ? (a.current / a.baseline).toFixed(1) : '∞'} lần · z={a.z})</small></span>
                            <Icon name="chevR" size={16} />
                        </button>
                    ))}
                </section>
            )}

            {(data.open_incidents.critical + data.open_incidents.error + data.open_incidents.warning) > 0 && (
                <button type="button" className="lg-banner lg-banner--warn" onClick={() => onGoTab('alerts')}>
                    <Icon name="bell" size={18} />
                    <span><strong>{data.open_incidents.critical + data.open_incidents.error + data.open_incidents.warning} sự cố đang mở</strong> — {data.open_incidents.critical} nghiêm trọng · {data.open_incidents.error} lỗi · {data.open_incidents.warning} cảnh báo</span>
                    <span className="lg-link">Xử lý ngay</span>
                </button>
            )}

            <div className="lg-grid lg-grid--two">
                <Panel title="Nhịp hoạt động theo giờ" desc="30 ngày gần nhất — thấy ngay giờ cao điểm và hoạt động bất thường ngoài giờ.">
                    <Heatmap matrix={data.heatmap} />
                </Panel>
                <Panel title="Theo nhóm sự kiện">
                    {data.by_category.length === 0 ? <Empty icon="activity" title="Chưa có dữ liệu" /> : (
                        <div className="lg-split">
                            <Donut slices={data.by_category.map((c, i) => ({ label: c.label, value: c.count, color: CAT_COLORS[i % CAT_COLORS.length] }))} />
                            <ul className="lg-legend-list">
                                {data.by_category.map((c, i) => (
                                    <li key={c.key}>
                                        <button type="button" onClick={() => onGoEvents({ range, category: [c.key] })}>
                                            <i style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} /><span>{c.label}</span><b>{fmtNum(c.count)}</b>{c.issues > 0 && <em title="Cảnh báo + lỗi">{c.issues} ⚠</em>}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </Panel>
            </div>

            <div className="lg-grid lg-grid--three">
                <Panel title="Người hoạt động nhiều nhất">
                    {data.top_actors.length === 0 ? <Empty icon="user" title="Chưa có dữ liệu" /> : (
                        <HBars rows={data.top_actors.map((a) => ({ label: `${a.name ?? `#${a.id}`} · ${ACTOR_TYPE[a.type ?? ''] ?? a.type ?? '?'}`, value: a.count, extra: a.issues ? ` (${a.issues} ⚠)` : '' }))} />
                    )}
                </Panel>
                <Panel title="Địa chỉ IP nổi bật" actions={<button type="button" className="lg-link" onClick={() => onGoTab('security')}>Bảo mật</button>}>
                    {data.top_ips.length === 0 ? <Empty icon="globe" title="Chưa có dữ liệu" /> : (
                        <ul className="lg-iplist">
                            {data.top_ips.map((i) => (
                                <li key={i.ip}><button type="button" onClick={() => onGoEvents({ range, ip: i.ip })}><code>{i.ip}</code><span>{fmtNum(i.count)}</span>{i.failed > 0 && <Chip tone="coral">{i.failed} sai</Chip>}</button></li>
                            ))}
                        </ul>
                    )}
                </Panel>
                <Panel title="Nguồn dữ liệu & hiệu năng">
                    <ul className="lg-sources">
                        {data.sources.map((s) => <li key={s.source}><code>{s.source}</code><span>{fmtNum(s.count)}</span><small>{timeAgo(s.last_at)}</small></li>)}
                    </ul>
                    {data.api ? (
                        <div className="lg-api"><div><small>Yêu cầu có đo</small><b>{fmtNum(data.api.count)}</b></div><div><small>Trung bình</small><b>{fmtMs(data.api.avg_ms)}</b></div><div><small>P95</small><b>{fmtMs(data.api.p95_ms)}</b></div></div>
                    ) : <p className="lg-hint">Bật middleware <code>AuditApiRequests</code> để đo thời gian xử lý API.</p>}
                </Panel>
            </div>

            <Panel title="Sự kiện nghiêm trọng gần đây" desc="Mức Lỗi trở lên." actions={<button type="button" className="lg-link" onClick={() => onGoEvents({ range: 'all', level: ['error', 'critical'] })}>Xem tất cả</button>}>
                {data.recent_severe.length === 0 ? <Empty icon="check" title="Không có sự kiện nghiêm trọng" text="Hệ thống đang hoạt động ổn định." /> : (
                    <ul className="lg-feed">
                        {data.recent_severe.map((e) => (
                            <li key={e.id}><button type="button" onClick={() => onOpenEvent(e.id)}>
                                <LevelBadge level={e.level} compact /><span><strong>{actionLabel(e.action)}</strong><small>{e.summary}</small></span><time>{fmtFull(e.occurred_at)}</time>
                            </button></li>
                        ))}
                    </ul>
                )}
            </Panel>
        </div>
    );
}