'use client';

import { useId, useState } from 'react';
import s from '../logs.module.css';
import { nf } from '../format';

/* ------------------------- Area / line chart nhiều chuỗi ------------------------- */
export interface Serie { key: string; label: string; color: string; fill?: boolean }

export function AreaChart({ data, series, height = 240 }: { data: Record<string, any>[]; series: Serie[]; height?: number }) {
    const uid = useId().replace(/:/g, '');
    const [hover, setHover] = useState<number | null>(null);
    const W = 760, H = height, L = 38, R = 12, T = 14, B = 26;
    const max = Math.max(4, ...data.flatMap((d) => series.map((x) => Number(d[x.key]) || 0)));
    const nice = Math.ceil(max / 4) * 4;
    const x = (i: number) => L + (data.length <= 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (data.length - 1));
    const y = (v: number) => T + (1 - v / nice) * (H - T - B);

    const path = (k: string) => data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(Number(d[k]) || 0).toFixed(1)}`).join(' ');
    const step = Math.max(1, Math.ceil(data.length / 8));

    return (
        <div style={{ position: 'relative' }}>
            <svg className={s.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Biểu đồ hoạt động theo thời gian"
                 onMouseLeave={() => setHover(null)}
                 onMouseMove={(e) => {
                     const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
                     const px = ((e.clientX - r.left) / r.width) * W;
                     const i = Math.round(((px - L) / (W - L - R)) * (data.length - 1));
                     setHover(Math.min(data.length - 1, Math.max(0, i)));
                 }}>
                <defs>
                    {series.map((x2) => (
                        <linearGradient key={x2.key} id={`${uid}${x2.key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={x2.color} stopOpacity=".38" /><stop offset="100%" stopColor={x2.color} stopOpacity="0" />
                        </linearGradient>
                    ))}
                </defs>
                {[0, 1, 2, 3, 4].map((g) => {
                    const v = (nice / 4) * g;
                    return (<g key={g}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray={g ? '3 4' : ''} />
                        <text className={s.axis} x={L - 8} y={y(v) + 3} textAnchor="end">{nf(v)}</text></g>);
                })}
                {data.map((d, i) => i % step === 0 && <text key={i} className={s.axis} x={x(i)} y={H - 8} textAnchor="middle">{d.label}</text>)}
                {series.filter((x2) => x2.fill).map((x2) => (
                    <path key={'f' + x2.key} d={`${path(x2.key)} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#${uid}${x2.key})`} />
                ))}
                {series.map((x2) => <path key={x2.key} d={path(x2.key)} fill="none" stroke={x2.color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />)}
                {hover !== null && (
                    <g>
                        <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--line2)" />
                        {series.map((x2) => <circle key={x2.key} cx={x(hover)} cy={y(Number(data[hover][x2.key]) || 0)} r="4" fill={x2.color} stroke="var(--panel)" strokeWidth="2" />)}
                    </g>
                )}
            </svg>
            {hover !== null && (
                <div style={{
                    position: 'absolute', top: 6, left: `${Math.min(78, Math.max(2, (x(hover) / W) * 100 + 2))}%`, pointerEvents: 'none',
                    background: 'var(--panel2)', border: '1px solid var(--line2)', borderRadius: 10, padding: '8px 12px', fontSize: 12.5, boxShadow: 'var(--shadow)', zIndex: 2,
                }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{data[hover].label}</div>
                    {series.map((x2) => (
                        <div key={x2.key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <i style={{ width: 8, height: 8, borderRadius: 2, background: x2.color }} />{x2.label}: <b>{nf(data[hover][x2.key])}</b>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function Legend({ items }: { items: { label: string; color: string; value?: string | number }[] }) {
    return (
        <div className={s.legend}>
            {items.map((i) => <span key={i.label}><i style={{ background: i.color }} />{i.label}{i.value !== undefined && <b style={{ color: 'var(--text)', marginLeft: 5 }}>{i.value}</b>}</span>)}
        </div>
    );
}

/* -------------------------------- Donut -------------------------------- */
export function Donut({ parts, size = 170, center }: { parts: { label: string; value: number; color: string }[]; size?: number; center?: { top: string; bottom: string } }) {
    const total = parts.reduce((a, b) => a + b.value, 0);
    const r = 15.9155; let acc = 0;
    return (
        <svg width={size} height={size} viewBox="0 0 42 42" role="img" aria-label="Biểu đồ tròn">
            <circle cx="21" cy="21" r={r} fill="none" stroke="var(--panel2)" strokeWidth="5" />
            {total > 0 && parts.filter((p) => p.value > 0).map((p) => {
                const pct = (p.value / total) * 100;
                const el = <circle key={p.label} cx="21" cy="21" r={r} fill="none" stroke={p.color} strokeWidth="5" strokeDasharray={`${Math.max(0, pct - 0.6)} ${100 - Math.max(0, pct - 0.6)}`}
                                   strokeDashoffset={25 - acc} />;
                acc += pct; return el;
            })}
            {center && (<><text x="21" y="21.5" textAnchor="middle" fontSize="6.4" fontWeight="800" fill="var(--text)">{center.top}</text>
                <text x="21" y="26.5" textAnchor="middle" fontSize="2.8" fill="var(--muted)">{center.bottom}</text></>)}
        </svg>
    );
}

/* ----------------------------- Thanh ngang ----------------------------- */
export function Bars({ rows, onPick }: { rows: { label: string; value: number; color?: string; key?: string }[]; onPick?: (key: string) => void }) {
    const max = Math.max(1, ...rows.map((r) => r.value));
    return (
        <div className={s.bars}>
            {rows.map((r) => (
                <div key={r.label} className={`${s.barRow} ${onPick ? s.clickable : ''}`} onClick={() => onPick?.(r.key || r.label)}>
                    <span className={s.ellipsis} style={{ maxWidth: 110 }}>{r.label}</span>
                    <div className={s.barTrack}><div className={s.barFill} style={{ width: `${(r.value / max) * 100}%`, ['--bc' as any]: r.color }} /></div>
                    <b style={{ textAlign: 'right' }}>{nf(r.value)}</b>
                </div>
            ))}
        </div>
    );
}

/* ------------------------ Heatmap giờ × thứ trong tuần ------------------------ */
const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
export function Heatmap({ cells }: { cells: { dow: number; hr: number; c: number }[] }) {
    const map = new Map(cells.map((c) => [`${c.dow}-${c.hr}`, c.c]));
    const max = Math.max(1, ...cells.map((c) => c.c));
    const order = [2, 3, 4, 5, 6, 7, 1]; // MySQL DAYOFWEEK: 1=CN … 7=T7 → hiển thị T2..CN
    return (
        <div>
            <div className={s.heat}>
                <span />
                {Array.from({ length: 24 }, (_, h) => <span key={h} style={{ textAlign: 'center' }}>{h % 3 === 0 ? h : ''}</span>)}
                {order.map((d) => (
                    <FragmentRow key={d} label={DOW[d - 1]} cells={Array.from({ length: 24 }, (_, h) => ({ h, c: map.get(`${d}-${h}`) || 0 }))} max={max} />
                ))}
            </div>
        </div>
    );
}

function FragmentRow({ label, cells, max }: { label: string; cells: { h: number; c: number }[]; max: number }) {
    return (
        <>
            <span className={s.heatLbl}>{label}</span>
            {cells.map((x) => (
                <span key={x.h} className={s.heatCell} title={`${label} ${x.h}:00 — ${x.c} sự kiện`}
                      style={{ opacity: x.c ? 0.18 + 0.82 * (x.c / max) : 0.07 }} />
            ))}
        </>
    );
}