'use client';
import { useState } from 'react';
import Link from 'next/link';
import { qs } from '../_lib/api';
import { Card, ErrorBox, Loading, PageHead, Pill, fmt, useApi } from '../_components/ui';

const TONE: Record<string, string> = { pass: 'ok', review: 'warn', retain: 'err', unknown: 'mut' };

export default function Promotion() {
    const [cid, setCid] = useState('');
    const { data, err, loading, reload } = useApi<any>(`promotion${qs({ class_id: cid })}`);
    if (err) return <ErrorBox msg={err} retry={reload} />;
    if (!data) return <Loading />;
    const tot = data.classes.reduce((a: any, c: any) => ({ pass: a.pass + c.pass, review: a.review + c.review, retain: a.retain + c.retain }), { pass: 0, review: 0, retain: 0 });
    return (
        <>
            <PageHead title="Xét lên lớp" sub={`Năm học ${data.year} · ${data.rule}`}
                      actions={cid ? <button className="ac-btn ghost" onClick={() => setCid('')}>← Tất cả các lớp</button> : undefined} />
            {!cid ? (
                <>
                    <div className="ac-grid ac-g3" style={{ marginBottom: 18 }}>
                        <div className="ac-stat ok"><span>Đủ điều kiện</span><b>{tot.pass}</b></div>
                        <div className="ac-stat warn"><span>Cần xem xét</span><b>{tot.review}</b></div>
                        <div className="ac-stat err"><span>Ở lại lớp</span><b>{tot.retain}</b></div>
                    </div>
                    <Card pad={false}><div className="ac-tw"><table className="ac-table"><thead><tr><th>Lớp</th><th className="n">Sĩ số</th><th className="n">Đủ điều kiện</th><th className="n">Cần xem xét</th><th className="n">Ở lại lớp</th><th /></tr></thead><tbody>
                    {data.classes.map((c: any) => <tr key={c.id}><td><b>{c.name}</b></td><td className="n">{c.total}</td><td className="n">{c.pass}</td><td className="n">{c.review ? <Pill tone="warn">{c.review}</Pill> : 0}</td><td className="n">{c.retain ? <Pill tone="err">{c.retain}</Pill> : 0}</td><td className="n"><button className="ac-btn ghost sm" onClick={() => setCid(String(c.id))}>Xem danh sách</button></td></tr>)}
                    </tbody></table></div></Card>
                </>
            ) : (
                <Card title={`Lớp ${data.classes.find((c: any) => String(c.id) === cid)?.name ?? ''}`} pad={false}>
                    <div className="ac-tw" style={{ opacity: loading ? .5 : 1 }}><table className="ac-table"><thead><tr><th>STT</th><th>Họ và tên</th><th className="n">Điểm TB</th><th>Học lực</th><th>Hạnh kiểm</th><th>Kết quả</th></tr></thead><tbody>
                    {data.students.map((s: any) => <tr key={s.code}><td>{s.no}</td><td><Link className="lk" href={`/academic/students/${s.code}`}>{s.full_name}</Link></td><td className="n"><b>{fmt(s.avg)}</b></td><td>{s.rank ? <Pill>{s.rank}</Pill> : '—'}</td><td>{s.conduct ? <Pill>{s.conduct}</Pill> : '—'}</td><td><Pill tone={TONE[s.result]}>{s.result_label}</Pill></td></tr>)}
                    </tbody></table></div>
                </Card>
            )}
        </>
    );
}