'use client';
import { useState } from 'react';
import type { Ctx } from '../SubjectsPage';
import { subjectApi } from '../api';
import { Columns, HBars } from '../ui/Charts';
import { tcls, tone } from '../theme';
import { Empty, ErrorBox, Kpi, Loading, useLoad } from './shared';

const BC = ['#dc2626', '#f59e0b', '#22b8e6', '#0369a1', '#059669'];

export default function AnalyticsTab({ ctx }: { ctx: Ctx }) {
    const [sem, setSem] = useState<number | undefined>(undefined);
    const q = useLoad(() => subjectApi.analytics(ctx.yearId, sem), [ctx.yearId, sem]);
    const [pick, setPick] = useState<number | null>(null);

    if (q.loading && !q.data) return <Loading />;
    if (q.error || !q.data) return <ErrorBox msg={q.error} retry={q.reload} />;
    const all = q.data.subjects;
    const scored = all.filter((s) => s.avg !== null);
    if (scored.length === 0 && !all.some((s) => s.pass_rate !== null)) return <div className="sj-card"><Empty icon="chart" title="Chưa có dữ liệu điểm" ><p>Năm học này chưa có điểm được nhập.</p></Empty></div>;

    const best = [...scored].sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))[0];
    const worst = [...scored].sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0))[0];
    const n = scored.reduce((a, b) => a + b.n, 0);
    const avg = n ? scored.reduce((a, b) => a + (b.avg ?? 0) * b.n, 0) / n : 0;
    const sel = all.find((s) => s.id === pick) ?? best;

    return (
        <>
            <div className="sj-bar"><div className="sj-seg">{[undefined, 1, 2].map((s) => <button key={s ?? 'a'} className={sem === s ? 'on' : ''} onClick={() => setSem(s)}>{s ? `Học kỳ ${s}` : 'Cả năm'}</button>)}</div>
                <span className="sj-muted">Điểm đạt ≥ {q.data.pass_score}</span></div>
            <div className="sj-kpis">
                <Kpi icon="chart" label="ĐTB toàn trường" value={avg.toFixed(2)} sub={`${n.toLocaleString('vi-VN')} lượt điểm`} color="indigo" />
                <Kpi icon="star" label="Môn cao nhất" value={best?.name ?? '—'} sub={best ? `ĐTB ${best.avg}` : undefined} color="emerald" />
                <Kpi icon="down" label="Môn thấp nhất" value={worst?.name ?? '—'} sub={worst ? `ĐTB ${worst.avg}` : undefined} color="rose" />
                <Kpi icon="book" label="Môn có điểm" value={scored.length} sub={`${all.length - scored.length} môn đánh giá/nhận xét`} color="sky" />
            </div>
            <div className="sj-grid sj-g-main">
                <div className="sj-card">
                    <div className="sj-card-h"><h3>Điểm trung bình theo môn</h3></div>
                    <HBars max={10} fmt={(v) => v.toFixed(2)} rows={[...scored].sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0)).map((s) => ({ label: s.name, value: s.avg ?? 0, color: tone(s.color) }))} />
                </div>
                <div className={`sj-card ${tcls(sel?.color)}`}>
                    <div className="sj-card-h"><div><h3>Phổ điểm: {sel?.name}</h3><p>Chọn một môn trong bảng bên dưới</p></div></div>
                    {sel && sel.n > 0 ? <Columns labels={q.data.buckets} values={sel.dist} colors={BC} height={170} /> : <p className="sj-muted">Môn này không dùng thang điểm.</p>}
                </div>
            </div>
            <div className="sj-tablewrap sj-mt">
                <table className="sj-table" style={{ minWidth: 760 }}>
                    <thead><tr><th>Môn học</th><th>Lượt điểm</th><th>ĐTB</th><th>Khối 10</th><th>Khối 11</th><th>Khối 12</th><th>Tỷ lệ đạt</th><th>Phổ điểm</th></tr></thead>
                    <tbody>{all.map((s) => {
                        const tot = s.dist.reduce((a, b) => a + b, 0) || 1;
                        return (
                            <tr key={s.id} className={tcls(s.color)} style={{ cursor: 'pointer', background: sel?.id === s.id ? 'var(--primary-soft)' : undefined }} onClick={() => setPick(s.id)}>
                                <td><span className="sj-tag"><i className="sj-dot" /> {s.name}</span></td><td>{s.n || '—'}</td><td><b>{s.avg ?? '—'}</b></td>
                                {[10, 11, 12].map((g) => <td key={g}>{s.by_grade[g] ?? '—'}</td>)}
                                <td>{s.pass_rate !== null ? <span className={`sj-badge ${s.pass_rate >= 90 ? 'ok' : s.pass_rate >= 70 ? 'warn' : 'bad'}`}>{s.pass_rate}%</span> : '—'}</td>
                                <td>{s.n ? <div className="sj-stack">{s.dist.map((v, i) => <i key={i} style={{ width: `${(v / tot) * 100}%`, background: BC[i] }} title={`${q.data!.buckets[i]}: ${v}`} />)}</div> : <span className="sj-muted">Nhận xét</span>}</td>
                            </tr>);
                    })}</tbody>
                </table>
            </div>
        </>
    );
}