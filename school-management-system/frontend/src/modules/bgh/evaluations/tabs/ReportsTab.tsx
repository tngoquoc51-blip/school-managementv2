'use client';

import { useEffect } from 'react';
import s from '../../logs/logs.module.css';
import e from '../evaluations.module.css';
import { Icon } from '../../logs/components/Icons';
import { Card, Empty, ErrorBox, Skeleton, useAsync, useToast } from '../../logs/components/ui';
import { errorMessage, evApi } from '../api';
import { useEv } from '../components/ctx';
import { KIND, RATING, pct, score } from '../format';
import type { Report } from '../types';

export default function ReportsTab() {
    const ev = useEv(); const toast = useToast();
    const st = useAsync<Report>();
    useEffect(() => { st.run(() => evApi.report({ year: ev.year, semester: ev.semester })); }, [ev.year, ev.semester, ev.tick]); // eslint-disable-line react-hooks/exhaustive-deps
    const d = st.data;
    if (st.error) return <ErrorBox message={st.error} onRetry={() => st.run(() => evApi.report({ year: ev.year, semester: ev.semester }))} />;
    if (!d) return <div className={s.stack}><Skeleton h={260} /><Skeleton h={260} /></div>;
    const exp = async () => { try { await evApi.exportObservations({ year: ev.year, semester: ev.semester }); toast('ok', 'Đã xuất dữ liệu (CSV)'); } catch (x) { toast('err', errorMessage(x)); } };
    return (
        <div className={s.stack}>
            <div className={e.flex}>
                <h3 style={{ margin: 0 }}>Báo cáo dự giờ — {ev.semester === 3 ? 'Cả năm học' : 'Học kỳ ' + ev.semester}</h3>
                <span className={e.right} />
                <button className={s.btn} onClick={() => window.print()}><Icon name="list" size={15} /> In báo cáo</button>
                <button className={s.btn} onClick={exp}><Icon name="download" size={15} /> Xuất CSV</button>
            </div>
            <Card title="Kết quả theo tổ chuyên môn" sub="Số phiếu, điểm trung bình và cơ cấu xếp loại">
                {d.by_dept.length ? (
                    <div className={s.tableWrap}>
                        <table className={s.table} style={{ minWidth: 760 }}>
                            <thead><tr><th>Tổ / môn</th><th>GV được dự / tổng</th><th>Số phiếu</th><th>Điểm TB</th><th>Cơ cấu xếp loại</th></tr></thead>
                            <tbody>{d.by_dept.map((r) => {
                                const n = Number(r.c); const parts = [['excellent', Number(r.excellent)], ['good', Number(r.good)], ['pass', Number(r.pass_)], ['fail', Number(r.fail_)]] as const;
                                return (
                                    <tr key={r.id ?? 'x'} style={{ cursor: 'default' }}>
                                        <td><b>{r.name || 'Khác'}</b></td><td>{r.teachers} / {r.teacher_total}</td><td>{n}</td><td><b>{score(r.a)}</b></td>
                                        <td style={{ minWidth: 260 }}>
                                            <div style={{ display: 'flex', height: 12, borderRadius: 8, overflow: 'hidden', background: 'var(--panel2)' }}>
                                                {parts.map(([k, v]) => v > 0 && <div key={k} style={{ width: pct(v, n) + '%', background: RATING[k].color }} title={`${RATING[k].label}: ${v}`} />)}
                                            </div>
                                            <div className={e.tdSub}>{parts.map(([k, v]) => `${RATING[k].label} ${v}`).join(' · ')}</div>
                                        </td>
                                    </tr>
                                );
                            })}</tbody>
                        </table>
                    </div>
                ) : <Empty title="Chưa có dữ liệu trong kỳ này" />}
            </Card>
            <div className={`${s.grid} ${s.g2}`}>
                <Card title="Tiêu chí còn yếu nhất" sub="Tỷ lệ điểm đạt trung bình thấp nhất — gợi ý nội dung bồi dưỡng">
                    {d.weakest_criteria.length ? d.weakest_criteria.map((c) => (
                        <div key={c.id} className={e.pbar} style={{ gridTemplateColumns: '1fr 120px 52px' }}>
                            <div><div style={{ fontWeight: 600 }}>{c.name}</div><div className={e.tdSub}>{c.group_name} · {c.n} lượt chấm</div></div>
                            <div className={s.barTrack}><div className={s.barFill} style={{ width: c.pct + '%', ['--bc' as any]: Number(c.pct) < 60 ? 'var(--crit)' : Number(c.pct) < 75 ? 'var(--warn)' : 'var(--ok)' }} /></div><b>{c.pct}%</b>
                        </div>
                    )) : <Empty title="Chưa có dữ liệu" />}
                </Card>
                <div className={s.stack}>
                    <Card title="Theo hình thức dự giờ">
                        {d.kinds.length ? d.kinds.map((k) => <div key={k.kind} className={s.li}><div className={s.liBody}><b>{KIND[k.kind]}</b></div><span className={s.muted}>{k.c} phiếu</span><b>{score(k.a)}</b></div>) : <Empty title="Chưa có dữ liệu" />}
                    </Card>
                    <Card title="Người dự giờ">
                        {d.observers.length ? d.observers.map((k) => <div key={k.name} className={s.li}><div className={s.liBody}><b>{k.name}</b></div><span className={s.muted}>{k.c} phiếu</span><b>{score(k.a)}</b></div>) : <Empty title="Chưa có dữ liệu" />}
                    </Card>
                </div>
            </div>
        </div>
    );
}