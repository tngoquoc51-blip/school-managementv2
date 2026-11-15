'use client';

import { useEffect } from 'react';
import s from '../../logs/logs.module.css';
import e from '../evaluations.module.css';
import { Bars, Donut, Legend } from '../../logs/components/Charts';
import { Icon } from '../../logs/components/Icons';
import { Card, Empty, ErrorBox, Kpi, Skeleton, useAsync } from '../../logs/components/ui';
import { fmtDate, nf } from '../../logs/format';
import { evApi } from '../api';
import { Avatar, Progress, RatingChip, Tone } from '../components/bits';
import { useEv } from '../components/ctx';
import { KIND, RATING, monthLabel, pct, score, today, weekdayOf } from '../format';
import type { Overview } from '../types';

export default function OverviewTab() {
    const ev = useEv();
    const st = useAsync<Overview>();
    useEffect(() => { st.run(() => evApi.overview({ year: ev.year, semester: ev.semester })); }, [ev.year, ev.semester, ev.tick]); // eslint-disable-line react-hooks/exhaustive-deps
    const d = st.data;
    if (st.error) return <ErrorBox message={st.error} onRetry={() => st.run(() => evApi.overview({ year: ev.year, semester: ev.semester }))} />;
    if (!d) return <div className={s.stack}><Skeleton h={120} /><div className={`${s.grid} ${s.g4}`}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={120} />)}</div><Skeleton h={260} /></div>;

    const k = d.kpi;
    const cover = pct(k.teachers_covered, k.teachers_total);
    const parts = (['excellent', 'good', 'pass', 'fail'] as const).map((r) => ({ label: RATING[r].label, value: d.ratings[r], color: RATING[r].color }));
    const totalRated = parts.reduce((a, b) => a + b.value, 0);
    const maxM = Math.max(1, ...d.monthly.map((m) => Number(m.c)));
    const semLabel = ev.semester === 3 ? 'Cả năm học' : `Học kỳ ${ev.semester}`;

    return (
        <div className={s.stack}>
            <div className={e.hero}>
                <div>
                    <h2>Dự giờ & Đánh giá giáo viên</h2>
                    <p>Năm học {ev.lk.year?.label} · {semLabel} · {k.teachers_total} giáo viên · yêu cầu tối thiểu {k.min_required} lượt dự giờ/GV</p>
                    <div className={e.flex} style={{ marginTop: 14 }}>
                        <button className={`${s.btn}`} style={{ background: '#fff', color: '#0369a1', border: 0 }} onClick={() => ev.newPlan()}><Icon name="clock" size={15} /> Lên lịch dự giờ</button>
                        <button className={`${s.btn}`} style={{ background: 'rgba(255,255,255,.18)', color: '#fff', borderColor: 'rgba(255,255,255,.4)' }} onClick={() => ev.newObs()}><Icon name="check" size={15} /> Dự giờ đột xuất</button>
                    </div>
                </div>
                <div className={e.heroStats}>
                    <div className={e.heroStat}><b>{k.plans_next7}</b><span>lịch trong 7 ngày tới</span></div>
                    <div className={e.heroStat}><b>{k.obs_avg !== null ? score(k.obs_avg) : '—'}</b><span>điểm TB toàn trường</span></div>
                    <div className={e.heroStat}><b>{cover}%</b><span>GV đã được dự giờ</span></div>
                </div>
            </div>

            <div className={`${s.grid} ${s.g4}`}>
                <Kpi icon="clock" label="Lịch chờ thực hiện" value={nf(k.plans_scheduled)} tone="#06b6d4" foot={k.plans_overdue ? <span className={s.up}>{k.plans_overdue} lịch quá hạn</span> : 'Không có lịch quá hạn'} />
                <Kpi icon="list" label="Phiếu đã nộp" value={nf(k.obs_total)} tone="#0284c7" foot={`${k.obs_drafts} bản nháp đang soạn`} />
                <Kpi icon="users" label="GV chưa đủ số lượt" value={nf(k.teachers_below_min)} tone="#d97706" foot={`/ ${k.teachers_total} giáo viên`} />
                <Kpi icon="bell" label="Cải tiến đang mở" value={nf(k.actions_open)} tone="#dc2650" foot={k.actions_overdue ? <span className={s.up}>{k.actions_overdue} việc quá hạn</span> : 'Đúng tiến độ'} />
            </div>

            <div className={`${s.grid} ${s.g21}`}>
                <Card title="Số phiếu & điểm trung bình theo tháng" sub="Cột: số phiếu dự giờ · Đường: điểm trung bình">
                    {d.monthly.length ? (
                        <svg className={s.chart} viewBox="0 0 640 220" role="img" aria-label="Phiếu dự giờ theo tháng">
                            {[0, 25, 50, 75, 100].map((g) => <g key={g}><line x1="36" x2="630" y1={190 - g * 1.6} y2={190 - g * 1.6} stroke="var(--line)" strokeDasharray={g ? '3 4' : ''} /><text className={s.axis} x="30" y={194 - g * 1.6} textAnchor="end">{g}</text></g>)}
                            {d.monthly.map((m, i) => {
                                const w = 594 / d.monthly.length, x = 36 + i * w, h = (Number(m.c) / maxM) * 120;
                                const ay = 190 - Number(m.a || 0) * 1.6;
                                return (
                                    <g key={m.m}>
                                        <rect x={x + w * 0.22} y={190 - h} width={w * 0.56} height={h} rx="7" fill="var(--accent)" opacity=".28"><title>{monthLabel(m.m)}: {m.c} phiếu</title></rect>
                                        <text className={s.axis} x={x + w / 2} y={186 - h} textAnchor="middle">{m.c}</text>
                                        <text className={s.axis} x={x + w / 2} y="208" textAnchor="middle">{monthLabel(m.m)}</text>
                                        {i > 0 && <line x1={36 + (i - 1) * w + w / 2} y1={190 - Number(d.monthly[i - 1].a || 0) * 1.6} x2={x + w / 2} y2={ay} stroke="var(--accent2)" strokeWidth="2.4" />}
                                        <circle cx={x + w / 2} cy={ay} r="4.5" fill="var(--accent2)" stroke="var(--panel)" strokeWidth="2"><title>Điểm TB {m.a}</title></circle>
                                    </g>
                                );
                            })}
                        </svg>
                    ) : <Empty title="Chưa có phiếu dự giờ nào" hint="Tạo lịch dự giờ rồi chấm phiếu để xem thống kê theo tháng." />}
                </Card>
                <Card title="Cơ cấu xếp loại" sub={`${totalRated} phiếu đã nộp`}>
                    <div className={s.donutWrap}>
                        <Donut parts={parts} center={{ top: totalRated ? String(totalRated) : '0', bottom: 'phiếu' }} />
                        <div style={{ flex: 1, minWidth: 140 }}>
                            <Legend items={parts.map((p) => ({ label: p.label, color: p.color, value: `${p.value} (${pct(p.value, totalRated)}%)` }))} />
                        </div>
                    </div>
                </Card>
            </div>

            <div className={`${s.grid} ${s.g2}`}>
                <Card title="Lịch dự giờ sắp tới" right={<button className={`${s.btn} ${s.sm}`} onClick={() => ev.goTab('plans')}>Xem tất cả</button>}>
                    {d.overdue.length > 0 && (
                        <div className={e.errLine} style={{ marginBottom: 10 }}>⚠ {k.plans_overdue} lịch đã quá ngày mà chưa có phiếu — {d.overdue.slice(0, 2).map((p) => p.teacher_name).join(', ')}{d.overdue.length > 2 ? '…' : ''}</div>
                    )}
                    {d.upcoming.length ? d.upcoming.map((p) => (
                        <div key={p.id} className={`${s.li} ${s.clickable}`} onClick={() => ev.goTab('plans')}>
                            <div className={e.mini} style={{ minWidth: 58, textAlign: 'center', padding: '6px 8px' }}><b style={{ fontSize: 16 }}>{p.plan_date.slice(8)}/{p.plan_date.slice(5, 7)}</b><span>{weekdayOf(p.plan_date)}</span></div>
                            <div className={s.liBody}><div className={s.liTitle}>{p.teacher_name}</div><div className={`${s.small} ${s.muted}`}>{p.subject_name || '—'}{p.class_name ? ` · Lớp ${p.class_name}` : ''}{p.period ? ` · Tiết ${p.period}` : ''} · {KIND[p.kind]}</div></div>
                            {p.plan_date === today() && <Tone tone="warn">Hôm nay</Tone>}
                        </div>
                    )) : <Empty icon="clock" title="Chưa có lịch dự giờ sắp tới" hint="Bấm “Lên lịch dự giờ” để thêm." />}
                </Card>
                <Card title="Cần theo dõi" sub="Phiếu xếp loại Đạt / Chưa đạt chưa có kế hoạch cải tiến">
                    {d.follow_up.length ? d.follow_up.map((p) => (
                        <div key={p.id} className={`${s.li} ${s.clickable}`} onClick={() => ev.openObs(p.id)}>
                            <div className={s.liBody}><div className={s.liTitle}>{p.teacher_name}</div><div className={`${s.small} ${s.muted}`}>{p.subject_name} · {fmtDate(p.observed_on)} · {p.code}</div></div>
                            <b>{score(p.total_score)}</b><RatingChip v={p.rating} />
                        </div>
                    )) : <Empty icon="check" title="Mọi phiếu thấp điểm đã có kế hoạch cải tiến" />}
                </Card>
            </div>

            <div className={`${s.grid} ${s.g3}`}>
                <Card title="Điểm trung bình theo tổ / môn">
                    {d.by_subject.length ? <Bars rows={d.by_subject.map((x) => ({ label: x.name || 'Khác', value: Number(x.a || 0), color: Number(x.a) >= Number(ev.settings.rating_good) ? '#059669' : Number(x.a) >= Number(ev.settings.rating_pass) ? '#d97706' : '#dc2650' }))} /> : <Empty title="Chưa có dữ liệu" />}
                </Card>
                <Card title="Giáo viên tiêu biểu" sub="Điểm TB cao nhất">
                    {d.top.length ? d.top.map((t, i) => <TeacherLine key={t.id} t={t} rank={i + 1} />) : <Empty title="Chưa có dữ liệu" />}
                </Card>
                <Card title="Cần hỗ trợ thêm" sub="Điểm TB thấp nhất">
                    {d.bottom.length ? d.bottom.map((t, i) => <TeacherLine key={t.id} t={t} rank={i + 1} warn />) : <Empty title="Chưa có dữ liệu" />}
                </Card>
            </div>

            <Card title="Tiến độ dự giờ toàn trường" sub={`Mỗi giáo viên cần tối thiểu ${k.min_required} lượt trong ${semLabel.toLowerCase()}`}>
                <div className={e.flex} style={{ gap: 20 }}>
                    <div className={e.grow}><Progress value={cover} /><div className={`${s.small} ${s.muted}`} style={{ marginTop: 6 }}>{k.teachers_covered}/{k.teachers_total} giáo viên đã được dự giờ ít nhất 1 lần · {k.teachers_below_min} giáo viên chưa đủ {k.min_required} lượt</div></div>
                    <button className={s.btn} onClick={() => ev.goTab('teachers')}>Xem danh sách giáo viên</button>
                </div>
            </Card>
        </div>
    );

    function TeacherLine({ t, rank, warn }: { t: Overview['top'][number]; rank: number; warn?: boolean }) {
        return (
            <div className={`${s.li} ${s.clickable}`} onClick={() => ev.openTeacher(t.id)}>
                <Avatar name={t.full_name} />
                <div className={s.liBody}><div className={s.liTitle}>{rank}. {t.full_name}</div><div className={`${s.small} ${s.muted}`}>{t.subject_name} · {t.c} phiếu</div></div>
                <b style={{ color: warn ? 'var(--warn)' : 'var(--ok)' }}>{score(t.a)}</b>
            </div>
        );
    }
}