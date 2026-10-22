'use client';
import { useState } from 'react';
import Link from 'next/link';
import { qs } from '../_lib/api';
import { Card, ErrorBox, Loading, PageHead, Pill, fmt, useApi, useInitialParam } from '../_components/ui';

export default function Grades() {
    const [classId, setClassId, ready] = useInitialParam('class_id');
    const [sem, setSem] = useState(1);
    const { data, err, loading, reload } = useApi<any>(ready ? `grades${qs({ class_id: classId, semester: sem })}` : null);
    if (err) return <ErrorBox msg={err} retry={reload} />;
    if (!data) return <Loading />;
    const sty = (v: any, kind: string) => (kind === 'pass' || typeof v !== 'number' ? undefined : v < 5 ? { color: '#be123c', fontWeight: 700 } : v >= 8 ? { color: '#047857', fontWeight: 600 } : undefined);
    return (
        <>
            <PageHead title="Quản lý điểm" sub={`Năm học ${data.year} · Điểm trung bình môn (TBM) theo học kỳ`}
                      actions={<>
                          <select className="ac-sel" value={data.class_id} onChange={(e) => setClassId(e.target.value)} aria-label="Chọn lớp">{data.classes.map((c: any) => <option key={c.id} value={c.id}>Lớp {c.name}</option>)}</select>
                          <div className="ac-tabs" style={{ margin: 0 }}>{[1, 2].map((s) => <button key={s} className={`ac-tab ${sem === s ? 'on' : ''}`} onClick={() => setSem(s)}>Học kỳ {s}</button>)}</div>
                      </>} />
            <Card pad={false}>
                <div className="ac-tw" style={{ opacity: loading ? .5 : 1 }}><table className="ac-table" style={{ minWidth: 1100 }}>
                    <thead><tr><th>STT</th><th>Họ và tên</th>{data.subjects.map((s: any) => <th key={s.id} className="c" title={s.name}>{s.name}</th>)}<th className="c">TB</th><th>Học lực</th></tr></thead>
                    <tbody>
                    {data.students.map((s: any) => (
                        <tr key={s.code}><td>{s.no}</td><td style={{ whiteSpace: 'nowrap' }}><Link className="lk" href={`/academic/students/${s.code}`}>{s.full_name}</Link></td>
                            {data.subjects.map((sub: any) => { const v = s.scores[sub.id]; return <td key={sub.id} className="c" style={sty(v, sub.kind)}>{sub.kind === 'pass' ? (v ? <Pill tone={v === 'Đạt' ? 'ok' : 'err'}>{v}</Pill> : '—') : v === null || v === undefined ? '—' : fmt(v, 1)}</td>; })}
                            <td className="c"><b>{fmt(s.avg)}</b></td><td>{s.rank ? <Pill>{s.rank}</Pill> : '—'}</td></tr>
                    ))}
                    <tr style={{ background: '#f6f9fd' }}><td /><td><b>Trung bình môn</b></td>{data.subjects.map((s: any) => <td key={s.id} className="c"><b>{s.kind === 'pass' ? '' : fmt(s.avg, 2)}</b></td>)}<td /><td /></tr>
                    </tbody></table></div>
            </Card>
        </>
    );
}