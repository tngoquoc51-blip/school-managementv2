'use client';

import type { Ctx, StudentRow } from '../types';
import { fmtDate, semLabel, signed } from '../utils';
import Icon from './icons';
import { Donut, Ring, TrendChart } from './Charts';
import { Avatar, CatIcon, Empty, PageSkeleton, Points } from './ui';

export default function OverviewTab({ ctx }: { ctx: Ctx }) {
    const { meta, overview: o, scope, openStudent, goto } = ctx;
    if (!o) return <PageSkeleton />;

    const t = o.totals;
    const maxCat = Math.max(1, ...o.categories.map((c) => Math.max(c.plus, -c.minus)));
    const maxCrit = Math.max(1, ...o.top_criteria.map((c) => c.count));
    const bestTier = [...o.tiers].sort((a, b) => b.count - a.count)[0];

    const StudentLine = ({ s, i, warn }: { s: StudentRow; i: number; warn?: boolean }) => (
        <div className="emu-srow" onClick={() => openStudent(s.id)}>
            <span className="emu-muted emu-num" style={{ width: 18, fontWeight: 700 }}>{i + 1}</span>
            <Avatar name={s.full_name} size="sm" />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div className="emu-strong emu-clip">{s.full_name}</div>
                <div className="emu-muted" style={{ fontSize: 11.5 }}>{s.code} · ĐTB {s.gpa ?? '—'} · HK {s.conduct ?? '—'}</div>
            </div>
            <span className={`emu-badge ${warn ? 'minus' : 'plus'}`}>{s.score} đ</span>
        </div>
    );

    return (
        <div className="emu-page">
            <section className="emu-hero">
                <Ring value={o.class_avg} max={140} size={132} stroke={11} color="#ffd56a">
                    <div><div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{o.class_avg}</div><div style={{ fontSize: 11, opacity: .8 }}>ĐIỂM TB LỚP</div></div>
                </Ring>
                <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
                    <div className="emu-badge" style={{ marginBottom: 10 }}><Icon name="calendar" size={13} /> {semLabel(scope.semester)} · {meta.school_year.label}</div>
                    <h2>Lớp {meta.class.name} · {t.students} học sinh</h2>
                    <p>GVCN {meta.class.homeroom_teacher ?? '—'} · Điểm gốc {meta.base_score}, cộng/trừ theo tiêu chí thi đua</p>
                    <div className="emu-row emu-wrap" style={{ marginTop: 14 }}>
                        {o.class_rank.school && <span className="emu-badge"><Icon name="trophy" size={13} /> Hạng {o.class_rank.school}/{o.class_rank.school_total} toàn trường</span>}
                        {o.class_rank.grade && <span className="emu-badge"><Icon name="award" size={13} /> Hạng {o.class_rank.grade}/{o.class_rank.grade_total} khối {meta.class.grade}</span>}
                        {bestTier && bestTier.count > 0 && <span className="emu-badge"><Icon name="users" size={13} /> Nhiều nhất: {bestTier.label} ({bestTier.count})</span>}
                    </div>
                </div>
                <div className="emu-col" style={{ position: 'relative', zIndex: 1 }}>
                    <button className="emu-btn gold" onClick={() => goto('scoring')}><Icon name="plus" /> Chấm điểm nhanh</button>
                    <button className="emu-btn" onClick={() => goto('awards')}><Icon name="trophy" /> Xét khen thưởng</button>
                </div>
            </section>

            <div className="emu-grid emu-g4">
                <div className="emu-card emu-kpi"><div className="emu-kpi-ic" style={{ background: 'var(--ok-soft)', color: 'var(--ok)' }}><Icon name="trend" size={22} /></div><div><b className="emu-pos">+{t.plus_points}</b><span>Tổng điểm cộng</span></div></div>
                <div className="emu-card emu-kpi"><div className="emu-kpi-ic" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}><Icon name="alert" size={22} /></div><div><b className="emu-neg">{t.minus_points}</b><span>Tổng điểm trừ</span></div></div>
                <div className="emu-card emu-kpi"><div className="emu-kpi-ic" style={{ background: 'var(--info-soft)', color: 'var(--info)' }}><Icon name="list" size={22} /></div><div><b>{t.records}</b><span>Lượt ghi nhận · ròng {signed(t.net_points)}</span></div></div>
                <div className="emu-card emu-kpi" style={{ cursor: 'pointer' }} onClick={() => goto('awards')}>
                    <div className="emu-kpi-ic" style={{ background: 'var(--gold-soft)', color: 'var(--gold)' }}><Icon name="trophy" size={22} /></div>
                    <div><b>{t.submitted}<span style={{ fontSize: 14, color: 'var(--ink-3)' }}> chờ duyệt</span></b><span>{t.draft} nháp · {t.approved} đã duyệt</span></div>
                </div>
            </div>

            <div className="emu-grid emu-g-12">
                <div className="emu-card">
                    <div className="emu-card-h"><h3>Phân bố xếp loại thi đua</h3></div>
                    <div className="emu-card-b emu-row" style={{ gap: 20 }}>
                        <Donut
                            segments={o.tiers.map((x) => ({ label: x.label, value: x.count, color: x.color }))}
                            center={<div><b style={{ fontSize: 24 }}>{t.students}</b><div className="emu-muted" style={{ fontSize: 11 }}>học sinh</div></div>}
                        />
                        <div className="emu-legend">
                            {o.tiers.map((x) => (
                                <div key={x.key}><i className="emu-dot" style={{ background: x.color }} />{x.label}<b className="emu-num">{x.count}</b></div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="emu-card">
                    <div className="emu-card-h"><h3>Diễn biến theo tuần</h3><span className="emu-sub">Cột xanh: cộng · cột đỏ: trừ · đường tím: ròng</span></div>
                    <div className="emu-card-b"><TrendChart data={o.trend} /></div>
                </div>
            </div>

            <div className="emu-grid emu-g2">
                <div className="emu-card">
                    <div className="emu-card-h"><h3>Điểm theo nhóm tiêu chí</h3></div>
                    <div className="emu-card-b emu-col" style={{ gap: 14 }}>
                        {o.categories.map((c) => (
                            <div key={c.key} className="emu-row">
                                <CatIcon cat={c.key} size={34} />
                                <div style={{ flex: 1 }}>
                                    <div className="emu-row"><span className="emu-strong">{c.label}</span><span className="emu-spacer" /><span className="emu-pos emu-num">+{c.plus}</span><span className="emu-neg emu-num">{c.minus}</span></div>
                                    <div className="emu-row" style={{ gap: 4, marginTop: 5 }}>
                                        <div className="emu-bar" style={{ flex: 1 }}><i style={{ width: `${(c.plus / maxCat) * 100}%`, background: 'var(--ok)' }} /></div>
                                        <div className="emu-bar" style={{ flex: 1 }}><i style={{ width: `${(-c.minus / maxCat) * 100}%`, background: 'var(--danger)' }} /></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="emu-card">
                    <div className="emu-card-h"><h3>Tiêu chí được ghi nhận nhiều nhất</h3></div>
                    <div className="emu-card-b emu-col" style={{ gap: 12 }}>
                        {o.top_criteria.length === 0 && <Empty icon="list" title="Chưa có ghi nhận" text="Hãy bắt đầu chấm điểm thi đua cho lớp." />}
                        {o.top_criteria.map((c) => (
                            <div key={c.id}>
                                <div className="emu-row"><span className="emu-clip" style={{ flex: 1 }}>{c.name}</span><Points value={c.points} /><b className="emu-num" style={{ width: 34, textAlign: 'right' }}>×{c.count}</b></div>
                                <div className="emu-bar" style={{ marginTop: 6 }}><i style={{ width: `${(c.count / maxCrit) * 100}%`, background: c.points > 0 ? 'var(--ok)' : 'var(--danger)' }} /></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="emu-grid emu-g3">
                <div className="emu-card">
                    <div className="emu-card-h"><h3>Dẫn đầu lớp</h3><span className="emu-spacer" /><button className="emu-btn ghost sm" onClick={() => goto('ranking')}>Xem tất cả <Icon name="right" size={14} /></button></div>
                    <div className="emu-card-b">{o.top_students.map((s, i) => <StudentLine key={s.id} s={s} i={i} />)}</div>
                </div>
                <div className="emu-card">
                    <div className="emu-card-h"><h3>Cần quan tâm</h3><span className="emu-sub">điểm thấp nhất</span></div>
                    <div className="emu-card-b">{o.attention.map((s, i) => <StudentLine key={s.id} s={s} i={i} warn />)}</div>
                </div>
                <div className="emu-card">
                    <div className="emu-card-h"><h3>Ghi nhận gần đây</h3></div>
                    <div className="emu-card-b emu-col" style={{ gap: 12 }}>
                        {o.recent.length === 0 && <Empty icon="history" title="Chưa có hoạt động" />}
                        {o.recent.map((r) => (
                            <div key={r.id} className="emu-row" style={{ alignItems: 'flex-start' }}>
                                <CatIcon cat={r.category} size={30} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="emu-clip"><b>{r.student_name}</b></div>
                                    <div className="emu-muted emu-clip" style={{ fontSize: 12 }}>{r.criterion_name} · {fmtDate(r.record_date)}</div>
                                </div>
                                <Points value={r.points} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}