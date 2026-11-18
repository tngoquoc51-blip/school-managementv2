'use client';

import { useEffect, useState } from 'react';
import { errMsg, logApi } from '@/modules/teacher/lessonlog/service';
import type { AttendanceData, ViewProps } from '@/modules/teacher/lessonlog/types';
import { ATT, addDays, dm, dmy, mondayOf, monthRange } from '@/modules/teacher/lessonlog/util';
import { Empty, Icon, Modal, Skeleton } from '@/app/bgh/rewards/ui';
import { Kpi } from '../parts';

type Range = 'week' | 'month' | 'year';

/** Chuyên cần: số liệu từ điểm danh từng tiết của giáo viên bộ môn */
export default function Attendance({ meta, classId, date, rev }: ViewProps) {
    const [range, setRange] = useState<Range>('week');
    const [d, setD] = useState<AttendanceData | null>(null);
    const [err, setErr] = useState('');
    const [stu, setStu] = useState<{ id: number; name: string } | null>(null);
    const [rows, setRows] = useState<{ att_date: string; period: number; status: string; note: string | null; subject_name: string | null }[] | null>(null);

    const [from, to]: [string, string] = range === 'week' ? [mondayOf(date), addDays(mondayOf(date), 5)] : range === 'month' ? monthRange(date) : [meta.year.start_date, meta.year.end_date];

    useEffect(() => {
        setD(null); setErr('');
        logApi.attendance(classId, from, to).then(setD).catch((e) => setErr(errMsg(e)));
    }, [classId, from, to, rev]);

    const open = (id: number, name: string) => {
        setStu({ id, name }); setRows(null);
        logApi.studentAtt(classId, id, from, to).then((r) => setRows(r.data)).catch(() => setRows([]));
    };

    if (err) return <div className="rw-err"><Icon n="alert" />{err}</div>;
    if (!d) return <Skeleton h={340} />;

    const s = d.summary;
    const days = d.daily.slice(-40);
    const mx = Math.max(1, ...days.map((x) => Number(x.late) + Number(x.excused) + Number(x.unexcused)));

    return (
        <div className="rw-stack">
            <div className="row">
                <div className="seg">
                    {([['week', 'Tuần'], ['month', 'Tháng'], ['year', 'Cả năm học']] as [Range, string][]).map(([k, l]) => <button key={k} className={range === k ? 'on' : ''} onClick={() => setRange(k)}>{l}</button>)}
                </div>
                <span className="muted">{dmy(from)} – {dmy(to)}</span>
            </div>

            <section className="rw-grid4">
                <Kpi label="Tỷ lệ chuyên cần" value={s.rate != null ? `${s.rate}%` : '—'} note={`${s.present}/${s.total} lượt điểm danh`} accent tone={s.rate != null && s.rate < 90 ? 'bad' : 'good'} />
                <Kpi label="Vắng không phép" value={s.unexcused} tone={s.unexcused ? 'bad' : undefined} note="lượt theo tiết" />
                <Kpi label="Vắng có phép" value={s.excused} note="lượt theo tiết" />
                <Kpi label="Đi muộn" value={s.late} note="lượt theo tiết" />
            </section>

            <div className="panel">
                <div className="ph"><h3>Vắng theo ngày</h3><span className="spacer" />
                    <span className="ll-st bad">Không phép</span><span className="ll-st info">Có phép</span><span className="ll-st warn">Muộn</span></div>
                <div className="pb">
                    {!days.length ? <Empty icon="info" text="Chưa có dữ liệu điểm danh trong khoảng này." /> : (
                        <div className="ll-stack">
                            {days.map((x) => (
                                <div className="c" key={x.d} title={`${dmy(x.d)}: KP ${x.unexcused}, CP ${x.excused}, muộn ${x.late}`}>
                                    <div className="st">
                                        <i className="u" style={{ height: `${Number(x.unexcused) / mx * 100}%` }} /><i className="e" style={{ height: `${Number(x.excused) / mx * 100}%` }} /><i className="l" style={{ height: `${Number(x.late) / mx * 100}%` }} />
                                    </div>
                                    <span className="lb">{dm(x.d)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="panel" style={{ overflow: 'auto' }}>
                <div className="ph"><h3>Học sinh vắng, đi muộn</h3><span className="spacer" /><span className="muted">{d.students.length} học sinh</span></div>
                {!d.students.length ? <Empty icon="check" text="Không có học sinh nào vắng hoặc đi muộn." /> : (
                    <table className="tbl">
                        <thead><tr><th>Học sinh</th><th className="num">Không phép</th><th className="num">Có phép</th><th className="num">Muộn</th><th /></tr></thead>
                        <tbody>
                        {d.students.map((x) => (
                            <tr key={x.id}>
                                <td><b>{x.full_name}</b><div className="hint">{x.code}</div></td>
                                <td className="num">{Number(x.unexcused) > 0 ? <span className="badge bad">{x.unexcused}</span> : '—'}</td>
                                <td className="num">{Number(x.excused) > 0 ? <span className="badge info">{x.excused}</span> : '—'}</td>
                                <td className="num">{Number(x.late) > 0 ? <span className="badge warn">{x.late}</span> : '—'}</td>
                                <td style={{ textAlign: 'right' }}><button className="btn ghost sm" onClick={() => open(x.id, x.full_name)}>Chi tiết</button></td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                )}
            </div>

            {stu && (
                <Modal title={`Chi tiết vắng – ${stu.name}`} drawer onClose={() => setStu(null)} footer={<button className="btn ghost" onClick={() => setStu(null)}>Đóng</button>}>
                    {!rows ? <Skeleton h={180} /> : !rows.length ? <Empty icon="check" text="Không có lượt vắng nào." /> : (
                        <table className="tbl">
                            <thead><tr><th>Ngày</th><th>Tiết</th><th>Môn</th><th>Tình trạng</th></tr></thead>
                            <tbody>{rows.map((r, i) => <tr key={i}><td>{dm(r.att_date)}</td><td>{r.period}</td><td>{r.subject_name || '—'}</td><td><span className={`ll-st ${ATT[r.status]?.tone || ''}`}>{ATT[r.status]?.l || r.status}</span></td></tr>)}</tbody>
                        </table>
                    )}
                </Modal>
            )}
        </div>
    );
}