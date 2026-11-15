'use client';

import { useState } from 'react';
import { PRIORITY_TONE, STATUS_COLOR, STATUS_ORDER } from '../_lib/types';
import type { Options, Plan } from '../_lib/types';
import { Bar, Pill, fmtDate } from './ui';

interface Props { rows: Plan[]; loading: boolean; opts: Options; onOpen: (id: number) => void; onMove: (p: Plan, to: string) => void }
const MAIN = ['draft', 'pending', 'approved', 'running', 'paused', 'completed'];

export default function PlanBoard({ rows, loading, opts, onOpen, onMove }: Props) {
    const [drag, setDrag] = useState<number | null>(null);
    const [over, setOver] = useState('');
    const cols = STATUS_ORDER.filter((s) => MAIN.includes(s) || rows.some((r) => r.status === s));

    const drop = (to: string) => {
        const p = rows.find((r) => r.id === drag);
        setDrag(null); setOver('');
        if (!p || p.status === to) return;
        if (to === 'rejected') return onOpen(p.id);   // cần nhập lý do → mở chi tiết
        onMove(p, to);
    };

    return (
        <div className="pl-stack" style={{ opacity: loading ? 0.7 : 1 }}>
            <p className="pl-note">Kéo thả thẻ sang cột khác để đổi trạng thái (chỉ các bước hợp lệ mới được chấp nhận, ví dụ Nháp → Chờ phê duyệt → Đã phê duyệt → Đang thực hiện).</p>
            <div className="pl-board">
                {cols.map((s) => {
                    const list = rows.filter((r) => r.status === s);
                    return (
                        <div key={s} className={`pl-col${over === s ? ' over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(s); }} onDragLeave={() => setOver('')} onDrop={() => drop(s)}>
                            <h3><span><i style={{ background: STATUS_COLOR[s] }} />{opts.statuses[s]}</span><em>{list.length}</em></h3>
                            {list.map((p) => (
                                <article key={p.id} className={`pl-pc${drag === p.id ? ' drag' : ''}`} draggable onDragStart={() => setDrag(p.id)} onDragEnd={() => { setDrag(null); setOver(''); }} onClick={() => onOpen(p.id)}>
                                    <div className="r"><small className="pl-mu">{p.code}</small><Pill tone={PRIORITY_TONE[p.priority] ?? 'mut'}>{opts.priorities[p.priority]}</Pill></div>
                                    <b>{p.title}</b>
                                    <Bar value={p.progress} tone={p.is_late ? 'err' : 'sky'} />
                                    <div className="r"><small className="pl-mu">{p.owner_name || '—'}</small><small className={p.is_late ? 'pl-err' : 'pl-mu'} style={p.is_late ? { color: '#dc2626', fontWeight: 700 } : undefined}>{p.is_late ? 'Trễ hạn' : fmtDate(p.end_date)}</small></div>
                                </article>
                            ))}
                            {!list.length && <p className="pl-empty" style={{ padding: 14 }}>Kéo thả vào đây</p>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}