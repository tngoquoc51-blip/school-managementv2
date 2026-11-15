'use client';

import { useEffect, useState } from 'react';
import { errMsg, rewardsApi } from '@/modules/bgh/rewards/rewardsService';
import type { OverviewData, ViewProps, WeekPoint } from '@/modules/bgh/rewards/types';
import { CAT_COLOR, Delta, Empty, fmt, ftime, Icon, Skeleton, sgn } from '../ui';

function Trend({ d }: { d: WeekPoint[] }) {
    const W = 640, H = 240, pl = 12, pr = 12, pt = 16, pb = 40;
    const n = d.length, iw = W - pl - pr, ih = H - pt - pb, zero = pt + ih * 0.62;
    const mx = Math.max(1, ...d.map((x) => Math.max(x.plus, Math.abs(x.minus))));
    const bw = Math.min(34, (iw / n) * 0.5);
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Điểm cộng và trừ theo tuần">
            <line x1={pl} x2={W - pr} y1={zero} y2={zero} className="axis" />
            {d.map((x, i) => {
                const cx = pl + (iw / n) * (i + 0.5);
                const hp = (x.plus / mx) * (zero - pt);
                const hm = (Math.abs(x.minus) / mx) * (pt + ih - zero);
                return (
                    <g key={i}>
                        <rect x={cx - bw / 2} y={zero - hp} width={bw} height={hp} rx={3} className="bar-p"><title>{`${x.label}: ${sgn(x.plus)} điểm cộng`}</title></rect>
                        <rect x={cx - bw / 2} y={zero} width={bw} height={hm} rx={3} className="bar-m"><title>{`${x.label}: ${sgn(x.minus)} điểm trừ`}</title></rect>
                        <text x={cx} y={H - pb + 16} textAnchor="middle" className="tx">{x.label}</text>
                        <text x={cx} y={H - pb + 31} textAnchor="middle" className="tx2">{fmt(x.avg)}</text>
                    </g>
                );
            })}
        </svg>
    );
}

function Kpi({ label, value, delta, invert, note, onClick, accent }: {
    label: string; value: string; delta?: number; invert?: boolean; note?: string; onClick?: () => void; accent?: boolean;
}) {
    const good = delta ? (invert ? delta < 0 : delta > 0) : false;
    const bad = delta ? (invert ? delta > 0 : delta < 0) : false;
    const Tag: any = onClick ? 'button' : 'div';
    return (
        <Tag className={`kpi${onClick ? ' click' : ''}${accent ? ' accent' : ''}`} onClick={onClick}>
            <div className="lbl">{label}</div>
            <div className="val">{value}</div>
            <div className="sub">
                {delta !== undefined && delta !== 0 && (
                    <span className={`dl ${good ? 'up' : bad ? 'dn' : 'flat'}`}><Icon n={delta > 0 ? 'up' : 'down'} s={13} />{fmt(Math.abs(delta))}</span>
                )}
                <span>{note}</span>
            </div>
        </Tag>
    );
}

export default function Overview({ meta, yearId, date, rev, openClass, openScore, go }: ViewProps) {
    const [d, setD] = useState<OverviewData | null>(null);
    const [err, setErr] = useState('');

    useEffect(() => {
        setD(null); setErr('');
        rewardsApi.overview(yearId, date).then(setD).catch((e) => setErr(errMsg(e)));
    }, [yearId, date, rev]);

    if (err) return <div className="rw-err"><Icon n="alert" />{err}</div>;
    if (!d) return <div className="rw-grid4"><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div>;

    const k = d.kpi;
    const maxC = Math.max(1, ...d.categories.map((c) => Math.max(c.plus, Math.abs(c.minus))));

    return (
        <div className="rw-stack">
            <div className="row">
                <div><b style={{ fontSize: 15 }}>{d.range.label}</b><div className="hint">Điểm gốc mỗi lớp: 100 điểm / tuần</div></div>
                <span className="spacer" />
                <button className="btn brass" onClick={() => openScore()}><Icon n="edit" s={16} />Chấm điểm nhanh</button>
            </div>

            <section className="rw-grid4">
                <Kpi label="Điểm trung bình toàn trường" value={fmt(k.avg)} delta={k.avg - k.prev.avg} note="so với tuần trước" accent />
                <Kpi label="Tổng điểm cộng" value={sgn(k.plus)} delta={k.plus - k.prev.plus} note={`${k.records} lượt ghi nhận`} />
                <Kpi label="Tổng điểm trừ" value={sgn(k.minus)} delta={k.minus - k.prev.minus} invert note="so với tuần trước" />
                <Kpi label="Lượt chấm trong tuần" value={String(k.records)} note="điểm cộng và trừ đã ghi nhận" onClick={() => go('scoring')} />
            </section>

            <section className="rw-cols">
                <div className="panel">
                    <div className="ph"><h3>Diễn biến 8 tuần gần nhất</h3><span className="spacer" />
                        <div className="legend"><span><i style={{ background: 'var(--good)' }} />Điểm cộng</span><span><i style={{ background: 'var(--bad)' }} />Điểm trừ</span></div>
                    </div>
                    <div className="pb">
                        {d.trend.every((t) => !t.plus && !t.minus) ? <Empty icon="list" text="Chưa có dữ liệu chấm điểm trong các tuần này." /> : <Trend d={d.trend} />}
                        <p className="hint">Số nhỏ dưới mỗi tuần là điểm trung bình toàn trường.</p>
                    </div>
                </div>

                <div className="panel">
                    <div className="ph"><h3>Dẫn đầu tuần này</h3><span className="spacer" /><button className="btn ghost sm" onClick={() => go('ranking')}>Xem tất cả</button></div>
                    <div className="pb">
                        {!d.top.length ? <Empty icon="trophy" text="Tuần này chưa có dữ liệu để xếp hạng." /> : d.top.map((i) => (
                            <button key={i.id} className="li" onClick={() => openClass(i.id)}>
                                <span className={`rank-no r${i.rank <= 3 ? i.rank : ''}`}>{i.rank}</span>
                                <span><div className="nm">Lớp {i.name}</div><div className="sb">{i.homeroom || 'Chưa có GVCN'}</div></span>
                                <span className="val">{fmt(i.score)}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <section className="rw-cols3">
                <div className="panel">
                    <div className="ph"><h3>Cần quan tâm</h3></div>
                    <div className="pb">
                        {!d.bottom.length ? <Empty text="Chưa có dữ liệu." /> : d.bottom.map((i) => (
                            <button key={i.id} className="li" onClick={() => openClass(i.id)}>
                                <span className="rank-no">{i.rank}</span>
                                <span><div className="nm">Lớp {i.name}</div><div className="sb">Trừ {sgn(i.minus)} điểm</div></span>
                                <span className="val bad-t">{fmt(i.score)}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="panel">
                    <div className="ph"><h3>Điểm theo mảng thi đua</h3></div>
                    <div className="pb">
                        {!d.categories.length ? <Empty text="Chưa có dữ liệu học kỳ." /> : d.categories.map((c) => (
                            <div className="cb" key={c.category}>
                                <span style={{ fontWeight: 600, color: CAT_COLOR[c.category] }}>{meta.categories[c.category] || c.category}</span>
                                <div className="tr">
                                    <i style={{ width: `${(c.plus / maxC) * 100}%`, background: 'var(--good)' }} />
                                    <i style={{ width: `${(Math.abs(c.minus) / maxC) * 100}%`, background: 'var(--bad)' }} />
                                    <small>{sgn(c.plus)} / {sgn(c.minus)}</small>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="panel">
                    <div className="ph"><h3>Dẫn đầu từng khối</h3></div>
                    <div className="pb">
                        {!d.by_grade.length ? <Empty text="Chưa có dữ liệu." /> : d.by_grade.map((i) => (
                            <button key={i.id} className="li" onClick={() => openClass(i.id)}>
                                <span className="badge info">Khối {i.grade}</span>
                                <span className="nm">Lớp {i.name}</span>
                                <span className="val brass-t">{fmt(i.score)}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <div className="panel">
                <div className="ph"><h3>Hoạt động gần đây</h3><span className="spacer" /><button className="btn ghost sm" onClick={() => go('logs')}>Toàn bộ nhật ký</button></div>
                <div className="pb">
                    {!d.recent.length ? <Empty text="Chưa có hoạt động." /> : d.recent.map((l) => (
                        <div className="tl-i" key={l.id}>
                            <span className={`dot ${l.action}`}><Icon n={l.action === 'award' || l.action === 'approve' ? 'award' : l.action === 'delete' || l.action === 'reject' ? 'trash' : 'edit'} s={15} /></span>
                            <div><p>{l.description}</p><small>{l.user_name} · {ftime(l.created_at)}</small></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}