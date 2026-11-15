'use client';

import { useEffect, useMemo } from 'react';
import s from '../../logs/logs.module.css';
import e from '../evaluations.module.css';
import { Icon } from '../../logs/components/Icons';
import { Empty, ErrorBox, Skeleton, useAsync } from '../../logs/components/ui';
import { fmtDate } from '../../logs/format';
import { evApi } from '../api';
import { ACT_STATUS, KIND, OBS_STATUS, PERIODIC_STATUS, PRIORITY, score } from '../format';
import type { TeacherProfile } from '../types';
import { Avatar, RatingChip, Tone } from './bits';
import { useEv } from './ctx';

/** Hồ sơ 360° của giáo viên: điểm theo nhóm tiêu chí, xu hướng, lịch dự giờ, cải tiến, đánh giá định kỳ. */
export default function TeacherDrawer({ id, onClose }: { id: number; onClose: () => void }) {
    const ev = useEv();
    const st = useAsync<TeacherProfile>();
    useEffect(() => { st.run(() => evApi.teacher(id)); }, [id, ev.tick]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { const h = (x: KeyboardEvent) => x.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
    const p = st.data;
    const valid = useMemo(() => (p?.observations ?? []).filter((o) => o.status !== 'draft' && o.total_score !== null).slice().reverse(), [p]);
    const avg = valid.length ? valid.reduce((a, b) => a + Number(b.total_score), 0) / valid.length : null;

    return (
        <>
            <div className={s.overlay} onClick={onClose} style={{ zIndex: 60 }} />
            <aside className={e.wide} style={{ zIndex: 62, width: 'min(900px,100vw)' }} role="dialog" aria-modal="true" aria-label="Hồ sơ giáo viên">
                <div className={e.wideHead}>
                    {p?.teacher ? (
                        <>
                            <Avatar name={p.teacher.full_name} big />
                            <div className={e.grow}>
                                <h2 style={{ margin: 0, fontSize: 20 }}>{p.teacher.full_name}</h2>
                                <div className={`${s.small} ${s.muted}`}>{p.teacher.code} · {p.teacher.subject_name} · {p.teacher.gender === 'M' || p.teacher.gender === 'Nam' ? 'Nam' : 'Nữ'}</div>
                                <div className={e.chipPick} style={{ marginTop: 6 }}>{p.classes.slice(0, 8).map((c, i) => <Tone key={i} tone="muted">{c.class_name} · {c.subject_name}</Tone>)}</div>
                            </div>
                        </>
                    ) : <div className={e.grow}><Skeleton h={54} /></div>}
                    <button className={s.iconBtn} onClick={onClose} aria-label="Đóng"><Icon name="x" /></button>
                </div>
                <div className={e.wideBody}>
                    {st.error && <ErrorBox message={st.error} onRetry={() => st.run(() => evApi.teacher(id))} />}
                    {!p && !st.error && <><Skeleton h={120} /><Skeleton h={260} /></>}
                    {p?.teacher && (
                        <>
                            <div className={e.miniGrid}>
                                <div className={e.mini}><b>{valid.length}</b><span>Phiếu đã nộp</span></div>
                                <div className={e.mini}><b>{avg === null ? '—' : avg.toFixed(1)}</b><span>Điểm TB dự giờ</span></div>
                                <div className={e.mini}><b>{p.plans.length}</b><span>Lịch sắp tới</span></div>
                                <div className={e.mini}><b>{p.actions.filter((a) => ['open', 'in_progress'].includes(a.status)).length}</b><span>Cải tiến đang mở</span></div>
                            </div>
                            <div className={e.flex}>
                                <button className={`${s.btn} ${s.primary}`} onClick={() => ev.newPlan({ teacher_id: id })}><Icon name="clock" size={15} /> Lên lịch dự giờ</button>
                                <button className={s.btn} onClick={() => ev.newObs({ teacher_id: id })}><Icon name="check" size={15} /> Dự giờ đột xuất</button>
                                <button className={s.btn} onClick={() => ev.newAction({ teacher_id: id })}><Icon name="bell" size={15} /> Giao cải tiến</button>
                            </div>

                            <div className={`${s.grid} ${s.g2}`}>
                                <section className={e.sec}>
                                    <h4 className={e.secTitle}>Điểm theo nhóm tiêu chí</h4>
                                    {p.groups.length >= 3 ? <Radar data={p.groups.map((g) => ({ label: g.group_name, v: Number(g.pct) }))} /> : p.groups.length ? p.groups.map((g) => <div key={g.group_name} className={e.pbar}><span>{g.group_name}</span><div className={s.barTrack}><div className={s.barFill} style={{ width: g.pct + '%' }} /></div><b>{g.pct}%</b></div>) : <Empty title="Chưa có dữ liệu" hint="Cần ít nhất 1 phiếu dự giờ đã nộp." />}
                                </section>
                                <section className={e.sec}>
                                    <h4 className={e.secTitle}>Xu hướng điểm dự giờ</h4>
                                    {valid.length >= 2 ? <Trend pts={valid.map((o) => ({ x: o.observed_on, y: Number(o.total_score) }))} /> : <Empty title="Cần ít nhất 2 phiếu để vẽ xu hướng" />}
                                </section>
                            </div>

                            <section className={e.sec}>
                                <h4 className={e.secTitle}>Các phiếu dự giờ</h4>
                                {p.observations.length ? (
                                    <table className={e.tbl}>
                                        <thead><tr><th>Mã</th><th>Ngày</th><th>Hình thức</th><th>Bài dạy</th><th>Điểm</th><th>Xếp loại</th><th>Trạng thái</th></tr></thead>
                                        <tbody>{p.observations.map((o) => (
                                            <tr key={o.id} className={e.click} onClick={() => ev.openObs(o.id)}>
                                                <td className={s.mono}>{o.code}</td><td>{fmtDate(o.observed_on)}</td><td>{KIND[o.kind]}</td><td>{o.topic || '—'}</td><td><b>{score(o.total_score)}</b></td><td><RatingChip v={o.rating} /></td>
                                                <td><Tone tone={OBS_STATUS[o.status].tone}>{OBS_STATUS[o.status].label}</Tone></td>
                                            </tr>))}</tbody>
                                    </table>
                                ) : <Empty title="Chưa có phiếu dự giờ" />}
                            </section>

                            <div className={`${s.grid} ${s.g2}`}>
                                <section className={e.sec}>
                                    <h4 className={e.secTitle}>Kế hoạch cải tiến</h4>
                                    {p.actions.length ? p.actions.map((a) => (
                                        <div key={a.id} className={s.li}><div className={s.liBody}><div className={s.liTitle}>{a.title}</div><div className={`${s.small} ${s.muted}`}>Hạn {fmtDate(a.due_date)}</div></div>
                                            <Tone tone={PRIORITY[a.priority].tone}>{PRIORITY[a.priority].label}</Tone><Tone tone={ACT_STATUS[a.status].tone}>{ACT_STATUS[a.status].label}</Tone></div>
                                    )) : <div className={s.muted}>Chưa có.</div>}
                                </section>
                                <section className={e.sec}>
                                    <h4 className={e.secTitle}>Đánh giá định kỳ</h4>
                                    {p.periodic.length ? p.periodic.map((r, i) => (
                                        <div key={i} className={s.li}><div className={s.liBody}><div className={s.liTitle}>{r.semester === 3 ? 'Cả năm' : 'Học kỳ ' + r.semester}</div><div className={`${s.small} ${s.muted}`}>Tổng {score(r.total_score)} điểm</div></div>
                                            <RatingChip v={r.rating} /><Tone tone={PERIODIC_STATUS[r.status].tone}>{PERIODIC_STATUS[r.status].label}</Tone></div>
                                    )) : <div className={s.muted}>Chưa có.</div>}
                                </section>
                            </div>
                        </>
                    )}
                </div>
            </aside>
        </>
    );
}

function Radar({ data }: { data: { label: string; v: number }[] }) {
    const n = data.length, R = 78, cx = 190, cy = 118;
    const pt = (i: number, r: number) => { const a = (Math.PI * 2 * i) / n - Math.PI / 2; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
    const poly = data.map((d, i) => pt(i, (R * d.v) / 100).join(',')).join(' ');
    return (
        <svg className={e.radar} viewBox="0 0 380 236" role="img" aria-label="Biểu đồ radar theo nhóm tiêu chí">
            {[25, 50, 75, 100].map((g) => <polygon key={g} points={data.map((_, i) => pt(i, (R * g) / 100).join(',')).join(' ')} fill="none" stroke="var(--line)" />)}
            {data.map((_, i) => <line key={i} x1={cx} y1={cy} x2={pt(i, R)[0]} y2={pt(i, R)[1]} stroke="var(--line)" />)}
            <polygon points={poly} fill="var(--accent)" fillOpacity=".22" stroke="var(--accent)" strokeWidth="2" />
            {data.map((d, i) => { const [x, y] = pt(i, R + 14); return <text key={i} x={x} y={y + 3} textAnchor={x < cx - 5 ? 'end' : x > cx + 5 ? 'start' : 'middle'} className={s.axis}>{d.label.replace(/^\d+\.\s*/, '').slice(0, 18)} {Math.round(d.v)}%</text>; })}
        </svg>
    );
}
function Trend({ pts }: { pts: { x: string; y: number }[] }) {
    const W = 380, H = 190, L = 30, B = 24, T = 12, R = 10;
    const X = (i: number) => L + (i * (W - L - R)) / (pts.length - 1), Y = (v: number) => T + (1 - v / 100) * (H - T - B);
    return (
        <svg className={s.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Xu hướng điểm">
            {[0, 50, 100].map((g) => <g key={g}><line x1={L} x2={W - R} y1={Y(g)} y2={Y(g)} stroke="var(--line)" strokeDasharray="3 4" /><text className={s.axis} x={L - 6} y={Y(g) + 3} textAnchor="end">{g}</text></g>)}
            <path d={pts.map((p, i) => `${i ? 'L' : 'M'}${X(i)},${Y(p.y)}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinejoin="round" />
            {pts.map((p, i) => <g key={i}><circle cx={X(i)} cy={Y(p.y)} r="4.5" fill="var(--accent)" stroke="var(--panel)" strokeWidth="2"><title>{fmtDate(p.x)}: {p.y}</title></circle>{(i === 0 || i === pts.length - 1 || pts.length <= 6) && <text className={s.axis} x={X(i)} y={H - 6} textAnchor="middle">{p.x.slice(8)}/{p.x.slice(5, 7)}</text>}</g>)}
        </svg>
    );
}