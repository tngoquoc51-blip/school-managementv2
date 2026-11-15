'use client';

import { ReactNode } from 'react';

export function Ring({ value, max, size = 120, stroke = 10, color = 'var(--brand)', track = 'rgba(255,255,255,.18)', children }: {
    value: number; max: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode;
}) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(1, max ? value / max : 0));
    return (
        <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
                <circle
                    cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
                    strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)' }}
                />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>{children}</div>
        </div>
    );
}

export function Donut({ segments, size = 150, stroke = 20, center }: {
    segments: { label: string; value: number; color: string }[]; size?: number; stroke?: number; center?: ReactNode;
}) {
    const total = segments.reduce((a, s) => a + s.value, 0);
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    let acc = 0;
    return (
        <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
                {total > 0 && segments.map((s) => {
                    const len = (s.value / total) * c;
                    const el = (
                        <circle
                            key={s.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={stroke}
                            strokeDasharray={`${Math.max(len - 2, 0)} ${c}`} strokeDashoffset={-acc}
                        />
                    );
                    acc += len;
                    return s.value > 0 ? el : null;
                })}
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>{center}</div>
        </div>
    );
}

export function TrendChart({ data }: { data: { week: string; plus: number; minus: number; net: number }[] }) {
    if (!data.length) return <div className="emu-empty">Chưa có dữ liệu theo tuần</div>;
    const W = 640, H = 230, L = 34, R = 10, T = 14, B = 26;
    const yMax = Math.max(1, ...data.map((d) => d.plus));
    const yMin = Math.min(-1, ...data.map((d) => d.minus));
    const sy = (H - T - B) / (yMax - yMin);
    const y = (v: number) => T + (yMax - v) * sy;
    const y0 = y(0);
    const bw = (W - L - R) / data.length;
    const ticks = [yMax, Math.round(yMax / 2), 0, Math.round(yMin / 2), yMin].filter((v, i, a) => a.indexOf(v) === i);
    const lbl = (w: string) => `${w.slice(8, 10)}/${w.slice(5, 7)}`;
    const line = data.map((d, i) => `${i ? 'L' : 'M'}${L + i * bw + bw / 2},${y(d.net)}`).join(' ');

    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="Biểu đồ điểm thi đua theo tuần">
            {ticks.map((t) => (
                <g key={t}>
                    <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t === 0 ? '0' : '3 4'} />
                    <text x={L - 6} y={y(t) + 3} textAnchor="end" className="emu-svg-text">{t}</text>
                </g>
            ))}
            {data.map((d, i) => {
                const x = L + i * bw + bw * 0.18;
                const w = bw * 0.64;
                return (
                    <g key={d.week}>
                        {d.plus > 0 && <rect x={x} y={y(d.plus)} width={w} height={y0 - y(d.plus)} rx={3} fill="var(--ok)" opacity={0.85} />}
                        {d.minus < 0 && <rect x={x} y={y0} width={w} height={y(d.minus) - y0} rx={3} fill="var(--danger)" opacity={0.85} />}
                        {(i % 2 === 0 || data.length < 8) && <text x={x + w / 2} y={H - 8} textAnchor="middle" className="emu-svg-text">{lbl(d.week)}</text>}
                    </g>
                );
            })}
            <path d={line} fill="none" stroke="var(--violet)" strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
            {data.map((d, i) => <circle key={d.week} cx={L + i * bw + bw / 2} cy={y(d.net)} r={3.2} fill="var(--panel)" stroke="var(--violet)" strokeWidth={2} />)}
        </svg>
    );
}