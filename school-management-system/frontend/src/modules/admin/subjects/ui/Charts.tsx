

import { tone } from '../theme';

export function Donut({ data, size = 168, center }: { data: { label: string; value: number; color: string }[]; size?: number; center?: { big: string; small: string } }) {
    const total = data.reduce((a, b) => a + b.value, 0) || 1;
    const r = size / 2 - 14, c = 2 * Math.PI * r;
    let off = 0;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Biểu đồ tròn">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth="16" />
            {data.map((d, i) => {
                const len = (d.value / total) * c;
                const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color} strokeWidth="16" strokeDasharray={`${Math.max(len - 2, 0)} ${c}`} strokeDashoffset={-off} transform={`rotate(-90 ${size / 2} ${size / 2})`} strokeLinecap="butt"><title>{`${d.label}: ${d.value}`}</title></circle>;
                off += len;
                return el;
            })}
            {center && (<g textAnchor="middle"><text x={size / 2} y={size / 2 + 2} className="sj-svg-big">{center.big}</text><text x={size / 2} y={size / 2 + 20} className="sj-svg-small">{center.small}</text></g>)}
        </svg>
    );
}

export function Ring({ value, size = 120, label, color = 'var(--primary)' }: { value: number; size?: number; label?: string; color?: string }) {
    const r = size / 2 - 10, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, value));
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${v}%`}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth="10" />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dasharray .6s ease' }} />
            <text x={size / 2} y={size / 2 + 4} textAnchor="middle" className="sj-svg-big">{Math.round(v)}{label ? '' : '%'}</text>
            {label && <text x={size / 2} y={size / 2 + 22} textAnchor="middle" className="sj-svg-small">{label}</text>}
        </svg>
    );
}

export function HBars({ rows, max, fmt = (n: number) => String(n) }: { rows: { label: string; value: number; color: string; sub?: string }[]; max?: number; fmt?: (n: number) => string }) {
    const m = max ?? Math.max(1, ...rows.map((r) => r.value));
    return (
        <div className="sj-hbars">
            {rows.map((r) => (
                <div className="sj-hbar" key={r.label}>
                    <span className="sj-hbar-l" title={r.label}>{r.label}</span>
                    <div className="sj-hbar-t"><i style={{ width: `${(r.value / m) * 100}%`, background: r.color }} /></div>
                    <b>{fmt(r.value)}</b>
                </div>
            ))}
        </div>
    );
}

export function Columns({ labels, values, colors, height = 120 }: { labels: string[]; values: number[]; colors?: string[]; height?: number }) {
    const m = Math.max(1, ...values);
    return (
        <div className="sj-cols" style={{ height }}>
            {values.map((v, i) => (
                <div className="sj-col" key={i} title={`${labels[i]}: ${v}`}>
                    <span>{v}</span>
                    <i style={{ height: `${Math.max((v / m) * (height - 40), v ? 4 : 1)}px`, background: colors?.[i] ?? 'var(--primary)' }} />
                    <em>{labels[i]}</em>
                </div>
            ))}
        </div>
    );
}

export { tone };