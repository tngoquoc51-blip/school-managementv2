'use client';

/** Biểu đồ cột phân bố điểm 0–10 (10 khoảng) */
export function Histogram({ bins, height = 170 }: { bins: number[]; height?: number }) {
    const max = Math.max(1, ...bins);
    const W = 420, H = height, L = 26, B = 22, T = 12;
    const bw = (W - L - 6) / bins.length;
    const color = (i: number) => (i >= 8 ? '#0E9F6E' : i >= 6 ? '#3B82F6' : i >= 5 ? '#F59E0B' : i >= 3 ? '#F97316' : '#EF4444');
    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="Phân bố điểm">
            {[0, 0.5, 1].map((p) => (
                <g key={p}>
                    <line x1={L} x2={W - 6} y1={T + (H - T - B) * (1 - p)} y2={T + (H - T - B) * (1 - p)} stroke="var(--line)" strokeDasharray={p ? '3 4' : '0'} />
                    <text x={L - 5} y={T + (H - T - B) * (1 - p) + 3} textAnchor="end" className="emu-svg-text">{Math.round(max * p)}</text>
                </g>
            ))}
            {bins.map((n, i) => {
                const h = ((H - T - B) * n) / max;
                const x = L + i * bw + bw * 0.14;
                return (
                    <g key={i}>
                        <rect x={x} y={H - B - h} width={bw * 0.72} height={Math.max(h, n ? 2 : 0)} rx={4} fill={color(i)} opacity={0.9} />
                        {n > 0 && <text x={x + bw * 0.36} y={H - B - h - 4} textAnchor="middle" className="emu-svg-text" style={{ fontWeight: 700 }}>{n}</text>}
                        <text x={x + bw * 0.36} y={H - 7} textAnchor="middle" className="emu-svg-text">{i}–{i + 1}</text>
                    </g>
                );
            })}
        </svg>
    );
}

/** Đường xu hướng điểm trung bình theo các bài kiểm tra */
export function LineTrend({ points }: { points: { label: string; value: number | null }[] }) {
    const pts = points.map((p, i) => ({ ...p, i })).filter((p) => p.value !== null) as { label: string; value: number; i: number }[];
    if (pts.length === 0) return <div className="emu-empty">Chưa có dữ liệu</div>;
    const W = 520, H = 190, L = 28, R = 12, T = 14, B = 30;
    const x = (i: number) => (points.length === 1 ? (W + L) / 2 : L + (i * (W - L - R)) / (points.length - 1));
    const y = (v: number) => T + (H - T - B) * (1 - v / 10);
    const d = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i)},${y(p.value)}`).join(' ');
    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="Xu hướng điểm trung bình">
            {[0, 5, 10].map((t) => (
                <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t === 5 ? '0' : '3 4'} /><text x={L - 6} y={y(t) + 3} textAnchor="end" className="emu-svg-text">{t}</text></g>
            ))}
            <path d={`${d} L${x(pts[pts.length - 1].i)},${y(0)} L${x(pts[0].i)},${y(0)} Z`} fill="var(--brand)" opacity={0.08} />
            <path d={d} fill="none" stroke="var(--brand)" strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
            {pts.map((p) => (
                <g key={p.i}>
                    <circle cx={x(p.i)} cy={y(p.value)} r={4.2} fill="var(--panel)" stroke="var(--brand)" strokeWidth={2.2} />
                    <text x={x(p.i)} y={y(p.value) - 9} textAnchor="middle" className="emu-svg-text" style={{ fontWeight: 700 }}>{p.value}</text>
                    <text x={x(p.i)} y={H - 10} textAnchor="middle" className="emu-svg-text">{p.label}</text>
                </g>
            ))}
        </svg>
    );
}