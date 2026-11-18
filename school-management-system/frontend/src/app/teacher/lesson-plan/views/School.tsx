'use client';

import { useEffect, useState } from 'react';
import { errMsg, logApi } from '@/modules/teacher/lessonlog/service';
import type { SchoolData, ViewProps } from '@/modules/teacher/lessonlog/types';
import { barTone } from '@/modules/teacher/lessonlog/util';
import { Icon, Skeleton } from '@/app/bgh/rewards/ui';
import { Bar, Kpi, ReviewChip } from '../parts';

/** Ban Giám hiệu: tiến độ ghi sổ đầu bài của toàn bộ các lớp trong tuần */
export default function School({ meta, date, rev, setClass, go }: ViewProps) {
    const [d, setD] = useState<SchoolData | null>(null);
    const [err, setErr] = useState('');
    useEffect(() => {
        setD(null); setErr('');
        logApi.school(date, meta.year.id).then(setD).catch((e) => setErr(errMsg(e)));
    }, [date, rev, meta.year.id]);

    if (err) return <div className="rw-err"><Icon n="alert" />{err}</div>;
    if (!d) return <Skeleton h={380} />;
    const s = d.summary;

    return (
        <div className="rw-stack">
            <div className="row"><b style={{ fontSize: 15 }}>{d.week.label}</b></div>
            <section className="rw-grid4">
                <Kpi label="Hoàn thành sổ trung bình" value={s.avg_rate != null ? `${s.avg_rate}%` : '—'} note={`${s.classes} lớp`} accent />
                <Kpi label="Đã ký sổ tuần" value={`${s.signed}/${s.classes}`} note="giáo viên chủ nhiệm đã ký" />
                <Kpi label="Chờ Ban Giám hiệu duyệt" value={s.pending} tone={s.pending ? 'bad' : 'good'} note="sổ tuần đã ký" />
                <Kpi label="Đã duyệt" value={s.approved} tone="good" note="sổ tuần" />
            </section>
            <div className="panel" style={{ overflow: 'auto' }}>
                <table className="tbl">
                    <thead><tr><th>Lớp</th><th>Giáo viên chủ nhiệm</th><th style={{ minWidth: 170 }}>Đã ký sổ</th><th className="num">Vắng KP</th><th className="num">Vắng CP</th><th className="num">Khen</th><th className="num">Vi phạm</th><th>Sổ tuần</th><th /></tr></thead>
                    <tbody>
                    {d.data.map((c) => (
                        <tr key={c.id}>
                            <td><b>Lớp {c.name}</b></td><td>{c.homeroom_name || '—'}</td>
                            <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Bar pct={c.rate} tone={barTone(c.rate)} /><span style={{ whiteSpace: 'nowrap' }}>{c.filled}/{c.total}</span></div></td>
                            <td className="num">{c.unexcused || '—'}</td><td className="num">{c.excused || '—'}</td><td className="num">{c.praise || '—'}</td><td className="num">{c.violation || '—'}</td>
                            <td><ReviewChip status={c.status} /></td>
                            <td style={{ textAlign: 'right' }}><button className="btn ghost sm" onClick={() => { setClass(c.id); go(c.status === 'signed' ? 'reviews' : 'week'); }}>{c.status === 'signed' ? 'Duyệt' : 'Xem sổ'}</button></td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}