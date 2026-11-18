'use client';

import { short } from './ui';

function niceMax(v: number) {
    const p = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1))));
    const n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/** Biểu đồ cột (SVG thuần, không cần thư viện) */
export function BarChart({ data, height = 240 }: { data: { label: string; value: number }[]; height?: number }) {
    const W = 700, H = height, padL = 56, padB = 28, padT = 18;
    const nice = niceMax(Math.max(1, ...data.map((d) => d.value)));
    const bw = data.length ? (W - padL - 8) / data.length : 0;
    const innerH = H - padT - padB;
    return (
        <div className="chartBoxWrap" style={{ width: '100%' }}>
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Biểu đồ thu theo tháng" style={{ display: 'block', width: '100%', height: 'auto' }}>
                <defs><linearGradient id="fbar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c4dd" /><stop offset="100%" stopColor="#0369a1" /></linearGradient></defs>
                {[0, 1, 2, 3, 4].map((i) => {
                    const y = H - padB - (innerH * i) / 4;
                    return (<g key={i}><line x1={padL} x2={W - 8} y1={y} y2={y} stroke="#d9e6f0" strokeDasharray={i ? '4 4' : undefined} /><text x={padL - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#6a8299">{short((nice * i) / 4)}</text></g>);
                })}
                {data.map((d, i) => {
                    const h = (innerH * d.value) / nice, x = padL + i * bw + bw * 0.16, w = bw * 0.68, y = H - padB - h;
                    return (
                        <g key={d.label}>
                            <rect x={x} y={y} width={w} height={Math.max(h, 0)} rx={6} fill="url(#fbar)"><title>{`${d.label}: ${d.value.toLocaleString('vi-VN')} ₫`}</title></rect>
                            {bw > 38 && d.value > 0 && <text x={x + w / 2} y={y - 6} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#0369a1">{short(d.value)}</text>}
                            <text x={x + w / 2} y={H - 9} textAnchor="middle" fontSize="11" fill="#6a8299">{d.label}</text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

/** Biểu đồ tròn dạng vòng */
export function Donut({ parts, size = 168, center }: { parts: { label: string; value: number; color: string }[]; size?: number; center?: string }) {
    const total = parts.reduce((a, p) => a + p.value, 0) || 1;
    const r = size / 2 - 16, c = 2 * Math.PI * r;
    let off = 0;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Biểu đồ cơ cấu" style={{ flex: 'none' }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e1ecf5" strokeWidth="20" />
            {parts.map((p) => {
                const len = (c * p.value) / total;
                const el = <circle key={p.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth="20" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-off} transform={`rotate(-90 ${size / 2} ${size / 2})`}><title>{`${p.label}: ${p.value.toLocaleString('vi-VN')} ₫`}</title></circle>;
                off += len;
                return el;
            })}
            {center && <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fontSize="15" fontWeight="800" fill="#0b2540">{center}</text>}
        </svg>
    );
}