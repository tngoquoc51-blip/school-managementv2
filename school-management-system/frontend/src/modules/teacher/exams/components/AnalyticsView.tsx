'use client';

import { useEffect, useState } from 'react';
import { Donut } from '@/modules/homeroom/awards/components/Charts';
import { useToast } from '@/modules/homeroom/awards/components/Toast';
import { Empty, Skel } from '@/modules/homeroom/awards/components/ui';
import { downloadCsv, fmtDate } from '@/modules/homeroom/awards/utils';
import { errMsg, examApi } from '../examsService';
import type { Analytics, Ctx, Matrix } from '../types';
import { heatStyle, scoreColor } from './shared';
import { Histogram, LineTrend } from './xcharts';
import X from './xicons';

export default function AnalyticsView({ ctx, focus }: { ctx: Ctx; focus: { class_id: number; subject_id: number; test_id: number } | null }) {
    const { meta, semester, tick } = ctx;
    const toast = useToast();
    const [asg, setAsg] = useState(() => (focus ? `${focus.class_id}:${focus.subject_id}` : meta.assignments[0] ? `${meta.assignments[0].class_id}:${meta.assignments[0].subject_id}` : ''));
    const [m, setM] = useState<Matrix | null>(null);
    const [testId, setTestId] = useState<number | null>(focus?.test_id ?? null);
    const [a, setA] = useState<Analytics | null>(null);

    useEffect(() => { if (focus) { setAsg(`${focus.class_id}:${focus.subject_id}`); setTestId(focus.test_id); } }, [focus]);

    useEffect(() => {
        if (!asg) return;
        const [c, s] = asg.split(':').map(Number);
        setM(null);
        examApi.matrix(c, s, semester).then((x) => { setM(x); setTestId((cur) => (cur && x.tests.some((t) => t.id === cur) ? cur : x.tests[x.tests.length - 1]?.id ?? null)); })
            .catch((e) => toast.error('Không tải được ma trận điểm', errMsg(e)));
    }, [asg, semester, tick, toast]);

    useEffect(() => {
        if (!testId) { setA(null); return; }
        examApi.analytics(testId).then(setA).catch((e) => toast.error('Không tải được phân tích', errMsg(e)));
    }, [testId, tick, toast]);

    const exportMatrix = () => {
        if (!m) return;
        downloadCsv('ma-tran-diem.csv', [['Mã HS', 'Họ tên', ...m.tests.map((t) => t.title), 'ĐTB'], ...m.students.map((s) => [s.code, s.full_name, ...s.cells.map((c) => (c.absent ? 'V' : c.v)), s.avg])]);
    };

    if (meta.assignments.length === 0) return <div className="emu-page"><div className="emu-card"><Empty icon="chart" title="Chưa có phân công giảng dạy" /></div></div>;

    return (
        <div className="emu-page">
            <div className="emu-row emu-wrap">
                <select className="emu-select" style={{ width: 260 }} value={asg} onChange={(e) => setAsg(e.target.value)}>
                    {meta.assignments.map((x) => <option key={x.cs_id} value={`${x.class_id}:${x.subject_id}`}>Lớp {x.class_name} — {x.subject_name}</option>)}
                </select>
                {m && m.tests.length > 0 && (
                    <select className="emu-select" style={{ width: 280 }} value={testId ?? ''} onChange={(e) => setTestId(Number(e.target.value))}>
                        {m.tests.map((t) => <option key={t.id} value={t.id}>{t.title} · {fmtDate(t.test_date)}</option>)}
                    </select>
                )}
                <span className="emu-spacer" />
                <button className="emu-btn" onClick={exportMatrix} disabled={!m}><X name="download" size={15} /> Xuất ma trận điểm</button>
            </div>

            {!m && <Skel h={320} />}
            {m && m.tests.length === 0 && <div className="emu-card"><Empty icon="chart" title="Chưa có bài nào để phân tích" text="Nhập điểm ít nhất một bài kiểm tra của lớp này." /></div>}

            {a && (
                <>
                    <div className="emu-grid emu-g4">
                        {[
                            ['Điểm trung bình', a.avg ?? '—', scoreColor(a.avg)], ['Trung vị · Độ lệch chuẩn', `${a.median ?? '—'} · ${a.std ?? '—'}`, 'var(--ink)'],
                            ['Cao nhất · Thấp nhất', `${a.max ?? '—'} · ${a.min ?? '—'}`, 'var(--ink)'], ['Tỉ lệ đạt (≥ 5)', a.pass_rate !== null ? `${a.pass_rate}%` : '—', 'var(--brand)'],
                        ].map(([k, v, c]) => <div key={String(k)} className="emu-card emu-kpi"><div><b style={{ color: String(c) }}>{v}</b><span>{k}</span></div></div>)}
                    </div>
                    <div className="emu-grid emu-g-21">
                        <div className="emu-card"><div className="emu-card-h"><h3>Phân bố điểm — {a.test.title}</h3><span className="emu-sub">{a.count} bài làm · {a.absent} vắng · {a.ungraded} chưa nhập</span></div><div className="emu-card-b"><Histogram bins={a.histogram} height={190} /></div></div>
                        <div className="emu-card"><div className="emu-card-h"><h3>Xếp loại điểm</h3></div>
                            <div className="emu-card-b emu-row" style={{ gap: 14 }}>
                                <Donut size={120} stroke={16} segments={a.bands.map((b) => ({ label: b.label, value: b.count ?? 0, color: b.color }))} center={<b style={{ fontSize: 20 }}>{a.count}</b>} />
                                <div className="emu-legend">{a.bands.map((b) => <div key={b.key} style={{ fontSize: 12 }}><i className="emu-dot" style={{ background: b.color }} />{b.label.split(' (')[0]}<b>{b.count}</b></div>)}</div>
                            </div>
                        </div>
                    </div>
                    <div className="emu-grid emu-g3">
                        <div className="emu-card"><div className="emu-card-h"><h3>Xu hướng điểm TB</h3></div><div className="emu-card-b"><LineTrend points={a.trend.map((t) => ({ label: fmtDate(t.test_date).slice(0, 5), value: t.avg }))} /></div></div>
                        <div className="emu-card"><div className="emu-card-h"><h3>Điểm cao nhất</h3></div><div className="emu-card-b emu-col" style={{ gap: 8 }}>{a.top.map((s, i) => <div key={s.student_id} className="emu-row"><span className="emu-muted" style={{ width: 18 }}>{i + 1}</span><span className="emu-clip" style={{ flex: 1 }}>{s.full_name}</span><b style={{ color: 'var(--ok)' }}>{s.score10}</b></div>)}</div></div>
                        <div className="emu-card"><div className="emu-card-h"><h3>Cần hỗ trợ</h3><span className="emu-sub">{a.below5} học sinh dưới 5</span></div><div className="emu-card-b emu-col" style={{ gap: 8 }}>{a.bottom.map((s, i) => <div key={s.student_id} className="emu-row"><span className="emu-muted" style={{ width: 18 }}>{i + 1}</span><span className="emu-clip" style={{ flex: 1 }}>{s.full_name}</span><b style={{ color: scoreColor(s.score10) }}>{s.score10}</b></div>)}</div></div>
                    </div>
                </>
            )}

            {m && m.tests.length > 0 && (
                <div className="emu-card">
                    <div className="emu-card-h"><h3>Ma trận điểm cả lớp</h3><span className="emu-sub">màu theo mức điểm · hệ 10</span></div>
                    <div className="emu-tw" style={{ marginTop: 12 }}>
                        <table className="emu-table">
                            <thead><tr><th>Học sinh</th>{m.tests.map((t) => <th key={t.id} className="c" title={t.title}>{t.title.length > 16 ? t.title.slice(0, 15) + '…' : t.title}</th>)}<th className="c">ĐTB</th></tr></thead>
                            <tbody>
                            {m.students.map((s) => (
                                <tr key={s.student_id}>
                                    <td><b>{s.full_name}</b><div className="emu-muted" style={{ fontSize: 11.5 }}>{s.code}</div></td>
                                    {s.cells.map((c, i) => <td key={i} className="c"><span className="ex-heat" style={heatStyle(c.v)}>{c.absent ? 'V' : c.v ?? '—'}</span></td>)}
                                    <td className="c"><span className="ex-heat" style={heatStyle(s.avg)}>{s.avg ?? '—'}</span></td>
                                </tr>
                            ))}
                            <tr><td className="emu-strong">Trung bình lớp</td>{m.column_avg.map((v, i) => <td key={i} className="c"><b style={{ color: scoreColor(v) }}>{v ?? '—'}</b></td>)}<td /></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}