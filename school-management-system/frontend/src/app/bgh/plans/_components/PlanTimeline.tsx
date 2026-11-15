'use client';

import { STATUS_COLOR } from '../_lib/types';
import type { Options, Plan } from '../_lib/types';
import { fmtDate } from './ui';

interface Props { rows: Plan[]; loading: boolean; opts: Options; year: string; onOpen: (id: number) => void }

export default function PlanTimeline({ rows, loading, opts, year, onOpen }: Props) {
    const y0 = parseInt(year.slice(0, 4), 10) || new Date().getFullYear();
    // 12 cột đều nhau: T8 năm y0 → T7 năm y0+1
    const pos = (iso: string) => {
        const d = new Date(iso.slice(0, 10) + 'T00:00:00');
        const idx = (d.getFullYear() - y0) * 12 + d.getMonth() - 7;
        const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        return Math.max(0, Math.min(12, idx + (d.getDate() - 1) / dim)) / 12 * 100;
    };
    const months = Array.from({ length: 12 }, (_, i) => ((7 + i) % 12) + 1);
    const items = rows.filter((r) => r.start_date && r.end_date && !['cancelled', 'rejected'].includes(r.status))
        .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));
    const today = new Date();
    const tPos = pos(today.toISOString());
    const inRange = today >= new Date(y0, 7, 1) && today <= new Date(y0 + 1, 7, 1);

    return (
        <div className="pl-stack" style={{ opacity: loading ? 0.7 : 1 }}>
            <p className="pl-note">Dòng thời gian năm học <b>{y0}–{y0 + 1}</b>. Thanh màu theo trạng thái, phần sáng là tiến độ đã hoàn thành. Bấm vào thanh để mở chi tiết.</p>
            <div className="pl-g">
                <div className="pl-g-head">
                    <div><b>Kế hoạch</b></div>
                    <div className="pl-g-months">{months.map((m) => <span key={m}>T{m}</span>)}</div>
                </div>
                {items.map((p) => {
                    const l = pos(p.start_date as string), r = pos(p.end_date as string);
                    const w = Math.max(1.2, r - l);
                    return (
                        <div key={p.id} className="pl-g-row">
                            <div><div className="pl-t"><b>{p.title}</b><small>{p.code} · {p.owner_name || '—'}</small></div></div>
                            <div className="pl-g-track">
                                {inRange && <i className="pl-g-today" style={{ left: `${tPos}%` }} />}
                                <div className="pl-g-bar" onClick={() => onOpen(p.id)} style={{ left: `${l}%`, width: `${w}%`, background: p.is_late ? '#dc2626' : STATUS_COLOR[p.status] }}
                                     title={`${p.title}\n${fmtDate(p.start_date)} → ${fmtDate(p.end_date)} · ${p.progress}% · ${opts.statuses[p.status]}`}>
                                    <u style={{ width: `${100 - p.progress}%`, left: `${p.progress}%`, right: 0, background: 'rgba(8,47,73,.18)' }} />
                                    <span>{p.progress}%</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
                {!items.length && <p className="pl-empty">Không có kế hoạch có đủ ngày bắt đầu / kết thúc trong năm học này.</p>}
            </div>
        </div>
    );
}