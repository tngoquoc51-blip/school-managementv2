'use client';
import { useState } from 'react';
import { Card, ErrorBox, Loading, PageHead, Pill, useApi } from '../_components/ui';

const ST: Record<string, [string, string]> = { done: ['Đã thi', 'mut'], today: ['Hôm nay', 'warn'], upcoming: ['Sắp tới', 'pri'] };
const dmy = (d: string) => d.split('-').reverse().join('/');

export default function Exams() {
    const { data, err, loading, reload } = useApi<any>('exams');
    const [pi, setPi] = useState(0);
    const [gi, setGi] = useState(0);
    if (loading) return <Loading />;
    if (err || !data) return <ErrorBox msg={err} retry={reload} />;
    const p = data.periods[pi];
    if (!p) return <><PageHead title="Lịch thi" sub={`Năm học ${data.year}`} /><Card><p style={{ color: '#5b6f85' }}>Chưa có kỳ thi nào.</p></Card></>;
    const g = p.grades[gi] ?? p.grades[0];
    return (
        <>
            <PageHead title="Lịch thi" sub={`Năm học ${data.year} · Hôm nay ${dmy(data.today)}`} />
            <div className="ac-tabs">{data.periods.map((x: any, i: number) => <button key={x.id} className={`ac-tab ${i === pi ? 'on' : ''}`} onClick={() => { setPi(i); setGi(0); }}>{x.name}</button>)}</div>
            <p style={{ color: '#5b6f85', marginBottom: 12 }}>Học kỳ {p.semester} · {dmy(p.start_date.slice(0, 10))} – {dmy(p.end_date.slice(0, 10))}</p>
            <div className="ac-tabs">{p.grades.map((x: any, i: number) => <button key={x.grade} className={`ac-tab ${i === gi ? 'on' : ''}`} onClick={() => setGi(i)}>Khối {x.grade}</button>)}</div>
            <Card pad={false}>
                <div className="ac-tw"><table className="ac-table"><thead><tr><th>Ngày thi</th><th>Môn</th><th>Giờ</th><th className="n">Thời lượng</th><th>Hình thức</th><th>Trạng thái</th></tr></thead><tbody>
                {g.items.map((e: any, i: number) => <tr key={i}><td><b>{e.weekday_label}</b><span className="ac-sub">{dmy(e.date)}</span></td><td>{e.subject}</td><td>{e.start} – {e.end}</td><td className="n">{e.duration} phút</td><td>{e.format}</td><td><Pill tone={ST[e.status][1]}>{ST[e.status][0]}</Pill></td></tr>)}
                </tbody></table></div>
            </Card>
        </>
    );
}