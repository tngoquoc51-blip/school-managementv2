'use client';
import { useState } from 'react';
import { qs } from '../_lib/api';
import { Card, ErrorBox, Loading, PageHead, useApi, useInitialParam } from '../_components/ui';

export default function Timetable() {
    const [classId, setClassId, ready] = useInitialParam('class_id');
    const [teacherId, setTeacherId] = useState('');
    const [mode, setMode] = useState<'class' | 'teacher'>('class');
    const { data, err, loading, reload } = useApi<any>(ready ? `timetable${qs(mode === 'teacher' && teacherId ? { teacher_id: teacherId } : { class_id: classId })}` : null);
    if (err) return <ErrorBox msg={err} retry={reload} />;
    if (!data) return <Loading />;
    const cell = (w: number, p: number) => data.cells.find((c: any) => c.weekday === w && c.period === p);
    return (
        <>
            <PageHead title="Thời khóa biểu" sub={`Năm học ${data.year} · ${data.mode === 'teacher' ? 'Giáo viên' : 'Lớp'} ${data.title} · ${data.total} tiết/tuần`}
                      actions={<>
                          <div className="ac-tabs" style={{ margin: 0 }}>
                              <button className={`ac-tab ${mode === 'class' ? 'on' : ''}`} onClick={() => setMode('class')}>Theo lớp</button>
                              <button className={`ac-tab ${mode === 'teacher' ? 'on' : ''}`} onClick={() => { setMode('teacher'); if (!teacherId) setTeacherId(String(data.teachers[0]?.id ?? '')); }}>Theo giáo viên</button>
                          </div>
                          {mode === 'class'
                              ? <select className="ac-sel" value={data.class_id ?? ''} onChange={(e) => setClassId(e.target.value)} aria-label="Chọn lớp">{data.classes.map((c: any) => <option key={c.id} value={c.id}>Lớp {c.name}</option>)}</select>
                              : <select className="ac-sel" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} aria-label="Chọn giáo viên">{data.teachers.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>}
                      </>} />
            <Card pad={false}>
                <div className="ac-tw" style={{ opacity: loading ? .5 : 1 }}><table className="ac-table ac-tt"><thead><tr><th>Tiết</th>{data.weekdays.map((w: any) => <th key={w.weekday}>{w.label}</th>)}</tr></thead><tbody>
                {data.periods.map((p: any) => (
                    <tr key={p.period}>
                        <td><b>Tiết {p.period}</b><span className="ac-sub">{p.start}–{p.end}</span></td>
                        {data.weekdays.map((w: any) => { const c = cell(w.weekday, p.period); return <td key={w.weekday} className={c ? 'has' : ''}>{c ? <><b>{c.subject}</b><small>{data.mode === 'teacher' ? `Lớp ${c.class}` : c.teacher}</small></> : <span style={{ color: '#b6c4d4' }}>—</span>}</td>; })}
                    </tr>
                ))}
                </tbody></table></div>
            </Card>
        </>
    );
}