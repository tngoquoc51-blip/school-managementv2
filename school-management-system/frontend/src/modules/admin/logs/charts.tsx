'use client';

import { useState } from 'react';
import { fmtNum } from './utils';

/* ----------------------------- cột chồng ----------------------------- */
export function StackedBars({ data, labelFn, height = 190 }: {
    data: { t: string; ok: number; warning: number; error: number }[]; labelFn: (iso: string) => string; height?: number;
}) {
    const [hover, setHover] = useState<number | null>(null);
    const totals = data.map((d) => d.ok + d.warning + d.error);
    const max = Math.max(1, ...totals);
    const step = Math.max(1, Math.ceil(data.length / 8));
    const h = hover !== null ? data[hover] : null;

    return (
        <div className="lg-chart" style={{ height: height + 28 }}>
            <div className="lg-chart__grid" style={{ height }} aria-hidden="true">
                {[1, 0.5, 0].map((g) => <div key={g}><span>{fmtNum(Math.round(max * g))}</span></div>)}
            </div>
            <div className="lg-bars" style={{ height }} role="img" aria-label={`Biểu đồ số sự kiện theo thời gian, tổng ${fmtNum(totals.reduce((a, b) => a + b, 0))}`} onMouseLeave={() => setHover(null)}>
                {data.map((d, i) => {
                    const tot = totals[i];
                    return (
                        <div key={d.t} className={`lg-bars__col${hover === i ? ' is-hover' : ''}`} onMouseEnter={() => setHover(i)}>
                            <div className="lg-bars__stack" style={{ height: `${(tot / max) * 100}%` }}>
                                {d.error > 0 && <span className="lg-seg-error" style={{ flexGrow: d.error }} />}
                                {d.warning > 0 && <span className="lg-seg-warning" style={{ flexGrow: d.warning }} />}
                                {d.ok > 0 && <span className="lg-seg-ok" style={{ flexGrow: d.ok }} />}
                            </div>
                            <small>{i % step === 0 ? labelFn(d.t) : ''}</small>
                        </div>
                    );
                })}
            </div>
            {h && (
                <div className="lg-tip" style={{ left: `calc(38px + (100% - 38px) * ${((hover ?? 0) + 0.5) / data.length})` }}>
                    <strong>{labelFn(h.t)}</strong>
                    <span><i className="lg-dot-ok" /> Bình thường <b>{fmtNum(h.ok)}</b></span>
                    <span><i className="lg-dot-warning" /> Cảnh báo <b>{fmtNum(h.warning)}</b></span>
                    <span><i className="lg-dot-error" /> Lỗi <b>{fmtNum(h.error)}</b></span>
                </div>
            )}
        </div>
    );
}

/* ----------------------------- cột đơn ----------------------------- */
export function MiniBars({ data, labelFn, tone = 'coral', height = 110 }: { data: { t: string; count: number }[]; labelFn: (iso: string) => string; tone?: 'coral' | 'brand'; height?: number }) {
    const max = Math.max(1, ...data.map((d) => d.count));
    const step = Math.max(1, Math.ceil(data.length / 8));
    return (
        <div className="lg-bars lg-bars--mini" style={{ height: height + 22 }} role="img" aria-label="Biểu đồ cột">
            {data.map((d, i) => (
                <div key={d.t} className="lg-bars__col" title={`${labelFn(d.t)}: ${d.count}`}>
                    <div className="lg-bars__stack lg-bars__stack--single" style={{ height: `${(d.count / max) * (height) }px` }}>
                        {d.count > 0 && <span className={tone === 'coral' ? 'lg-seg-error' : 'lg-seg-ok'} style={{ flexGrow: 1 }} />}
                    </div>
                    <small>{i % step === 0 ? labelFn(d.t) : ''}</small>
                </div>
            ))}
        </div>
    );
}

/* ----------------------------- vòng tròn ----------------------------- */
export function Donut({ slices, size = 150, center }: { slices: { label: string; value: number; color: string }[]; size?: number; center?: string }) {
    const total = slices.reduce((a, s) => a + s.value, 0);
    const r = 52;
    const C = 2 * Math.PI * r;
    let offset = 0;
    return (
        <svg viewBox="0 0 140 140" width={size} height={size} role="img" aria-label={`Biểu đồ tròn, tổng ${fmtNum(total)}`} className="lg-donut">
            <circle cx="70" cy="70" r={r} fill="none" stroke="var(--line)" strokeWidth="16" />
            {total > 0 && slices.filter((s) => s.value > 0).map((s) => {
                const len = (s.value / total) * C;
                const el = <circle key={s.label} cx="70" cy="70" r={r} fill="none" stroke={s.color} strokeWidth="16" strokeDasharray={`${Math.max(0, len - 1.5)} ${C}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)"><title>{`${s.label}: ${fmtNum(s.value)}`}</title></circle>;
                offset += len;
                return el;
            })}
            <text x="70" y="68" textAnchor="middle" className="lg-donut__num">{center ?? fmtNum(total)}</text>
            <text x="70" y="86" textAnchor="middle" className="lg-donut__sub">sự kiện</text>
        </svg>
    );
}

/* ----------------------------- bản đồ nhiệt ----------------------------- */
const DAYS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'];
const DAY_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function Heatmap({ matrix }: { matrix: number[][] }) {
    const max = Math.max(1, ...matrix.flat());
    return (
        <div className="lg-heat" role="img" aria-label="Bản đồ nhiệt số sự kiện theo giờ trong tuần">
            <div className="lg-heat__hours" aria-hidden="true">
                <span />
                {Array.from({ length: 24 }, (_, h) => <span key={h}>{h % 3 === 0 ? h : ''}</span>)}
            </div>
            {matrix.map((row, d) => (
                <div key={d} className="lg-heat__row">
                    <span className="lg-heat__day">{DAY_SHORT[d]}</span>
                    {row.map((v, h) => (
                        <span key={h} className="lg-heat__cell" title={`${DAYS[d]}, ${h}:00 – ${h}:59 · ${fmtNum(v)} sự kiện`}>
                            <i style={{ opacity: v === 0 ? 0 : 0.14 + 0.86 * Math.sqrt(v / max) }} />
                        </span>
                    ))}
                </div>
            ))}
            <div className="lg-heat__legend" aria-hidden="true"><span>Ít</span><i /><i /><i /><i /><i /><span>Nhiều</span></div>
        </div>
    );
}

/* ----------------------------- điểm sức khỏe ----------------------------- */
export function HealthRing({ score, grade }: { score: number; grade: string }) {
    const r = 54;
    const C = 2 * Math.PI * r;
    const tone = score >= 90 ? 'good' : score >= 75 ? 'ok' : score >= 60 ? 'warn' : 'bad';
    return (
        <svg viewBox="0 0 140 140" width="150" height="150" role="img" aria-label={`Điểm sức khỏe ${score} trên 100, hạng ${grade}`} className={`lg-ring lg-ring--${tone}`}>
            <circle cx="70" cy="70" r={r} fill="none" stroke="var(--line)" strokeWidth="11" />
            <circle cx="70" cy="70" r={r} fill="none" strokeWidth="11" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - score / 100)} transform="rotate(-90 70 70)" className="lg-ring__val" />
            <text x="70" y="72" textAnchor="middle" className="lg-ring__num">{score}</text>
            <text x="70" y="92" textAnchor="middle" className="lg-ring__sub">Hạng {grade}</text>
        </svg>
    );
}

/* ----------------------------- thanh ngang ----------------------------- */
export function HBars({ rows, color = 'var(--brand)' }: { rows: { label: string; value: number; extra?: string }[]; color?: string }) {
    const max = Math.max(1, ...rows.map((r) => r.value));
    return (
        <ul className="lg-hbars">
            {rows.map((r) => (
                <li key={r.label}>
                    <div><span>{r.label}</span><b>{fmtNum(r.value)}{r.extra ? <em>{r.extra}</em> : null}</b></div>
                    <span className="lg-hbars__track"><i style={{ width: `${(r.value / max) * 100}%`, background: color }} /></span>
                </li>
            ))}
        </ul>
    );
}