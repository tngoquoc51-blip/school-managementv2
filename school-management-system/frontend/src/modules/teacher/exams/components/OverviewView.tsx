'use client';

import { useEffect, useState } from 'react';
import { Donut } from '@/modules/homeroom/awards/components/Charts';
import { useToast } from '@/modules/homeroom/awards/components/Toast';
import { Empty, PageSkeleton } from '@/modules/homeroom/awards/components/ui';
import { cx, fmtDate, relTime } from '@/modules/homeroom/awards/utils';
import { errMsg, examApi } from '../examsService';
import type { Ctx, Overview } from '../types';
import { StatusBadge, kindLabel, scoreColor } from './shared';
import X, { XName } from './xicons';

const ACT_ICON = (a: string): { icon: XName; color: string } =>
    a.startsWith('score.sync') ? { icon: 'sync', color: 'var(--info)' } : a.startsWith('score') ? { icon: 'check', color: 'var(--ok)' }
        : a.startsWith('paper') ? { icon: 'file', color: 'var(--violet)' } : a.startsWith('question') ? { icon: 'database', color: 'var(--gold)' } : { icon: 'clipboard', color: 'var(--brand)' };

export default function OverviewView({ ctx }: { ctx: Ctx }) {
    const { meta, semester, tick, goto, openSheet, newTest } = ctx;
    const toast = useToast();
    const [o, setO] = useState<Overview | null>(null);

    useEffect(() => {
        examApi.overview(semester).then(setO).catch((e) => toast.error('Không tải được tổng quan', errMsg(e)));
    }, [semester, tick, toast]);

    if (!o) return <PageSkeleton />;
    const nextOfficial = o.upcoming_official[0] ?? null;
    const days = nextOfficial ? Math.ceil((new Date(nextOfficial.date + 'T00:00:00').getTime() - new Date(meta.today + 'T00:00:00').getTime()) / 86400000) : null;
    const totalScores = o.bands.reduce((a, b) => a + (b.count ?? 0), 0);
    const maxAvg = 10;

    return (
        <div className="emu-page">
            <section className="emu-hero">
                <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
                    <div className="emu-badge" style={{ marginBottom: 10 }}><X name="calendar" size={13} /> Năm học {meta.school_year.label}</div>
                    <h2>Xin chào, {meta.teacher.full_name}</h2>
                    <p>Môn chính: {meta.teacher.main_subject ?? '—'} · Dạy {meta.assignments.length} lớp–môn · {o.counts.total} bài kiểm tra</p>
                    <div className="emu-row emu-wrap" style={{ marginTop: 14 }}>
                        {nextOfficial && days !== null && <span className="emu-badge"><X name="clock" size={13} /> {days === 0 ? 'Hôm nay' : `Còn ${days} ngày`}: {nextOfficial.subject_name} lớp {nextOfficial.class_name}</span>}
                        {o.need_grading.length > 0 && <span className="emu-badge"><X name="alert" size={13} /> {o.need_grading.length} bài cần chấm</span>}
                    </div>
                </div>
                <div className="emu-col" style={{ position: 'relative', zIndex: 1 }}>
                    <button className="emu-btn gold" onClick={() => newTest()}><X name="plus" /> Tạo bài kiểm tra</button>
                    <button className="emu-btn" onClick={() => goto('papers')}><X name="zap" /> Tạo đề nhanh</button>
                </div>
            </section>


            <div className="ex-tiles">
                {([
                    { key: 'calendar', title: 'Lịch kiểm tra', desc: 'Lịch tháng: nhà trường và bài của bạn', icon: 'calendar', color: 'var(--violet)', bg: 'var(--violet-soft)' },
                    { key: 'tests', title: 'Bài kiểm tra & Nhập điểm', desc: 'Tạo bài, nhập điểm, ghi vào sổ điểm', icon: 'clipboard', color: 'var(--gold)', bg: 'var(--gold-soft)' },
                    { key: 'analytics', title: 'Phân tích kết quả', desc: 'Phân bố điểm, xu hướng, ma trận cả lớp', icon: 'chart', color: 'var(--info)', bg: 'var(--info-soft)' },
                    { key: 'bank', title: 'Ngân hàng câu hỏi', desc: 'Soạn câu hỏi theo môn, khối, độ khó', icon: 'database', color: 'var(--ok)', bg: 'var(--ok-soft)' },
                    { key: 'papers', title: 'Tạo đề & In đề', desc: 'Tự chọn câu theo ma trận, in đề', icon: 'file', color: 'var(--danger)', bg: 'var(--danger-soft)' },
                ] as const).map((t) => (
                    <button key={t.key} className="ex-tile" onClick={() => goto(t.key)}>
                        <div className="ic" style={{ background: t.bg, color: t.color }}><X name={t.icon} size={22} /></div>
                        <div style={{ flex: 1, minWidth: 0 }}><b>{t.title}</b><span>{t.desc}</span></div>
                        <X name="right" size={16} />
                    </button>
                ))}
                <button className="ex-tile" onClick={() => newTest()}>
                    <div className="ic" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}><X name="plus" size={22} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}><b>Tạo bài kiểm tra mới</b><span>15 phút, 1 tiết, giữa kỳ, cuối kỳ</span></div>
                    <X name="right" size={16} />
                </button>
            </div>

            <div className="emu-grid emu-g4">
                {[
                    { label: 'Đã lên lịch', v: o.counts.scheduled + o.counts.draft, icon: 'calendar' as XName, bg: 'var(--info-soft)', fg: 'var(--info)', go: 'tests' as const },
                    { label: 'Đang chấm', v: o.counts.grading, icon: 'edit' as XName, bg: 'var(--gold-soft)', fg: 'var(--gold)', go: 'tests' as const },
                    { label: 'Đã hoàn tất', v: o.counts.done, icon: 'check' as XName, bg: 'var(--ok-soft)', fg: 'var(--ok)', go: 'analytics' as const },
                    { label: `Câu hỏi · ${o.papers} đề`, v: o.questions, icon: 'database' as XName, bg: 'var(--violet-soft)', fg: 'var(--violet)', go: 'bank' as const },
                ].map((k) => (
                    <div key={k.label} className="emu-card emu-kpi" style={{ cursor: 'pointer' }} onClick={() => goto(k.go)}>
                        <div className="emu-kpi-ic" style={{ background: k.bg, color: k.fg }}><X name={k.icon} size={22} /></div>
                        <div><b>{k.v}</b><span>{k.label}</span></div>
                    </div>
                ))}
            </div>

            <div className="emu-grid emu-g-21">
                <div className="emu-card">
                    <div className="emu-card-h"><h3>Cần chấm điểm</h3><span className="emu-sub">bài đã đến hạn nhưng chưa hoàn tất</span></div>
                    <div className="emu-card-b emu-col">
                        {o.need_grading.length === 0 && <Empty icon="check" title="Bạn đã chấm xong hết" text="Không có bài nào đang chờ chấm." />}
                        {o.need_grading.map((t) => (
                            <div key={t.id} className="emu-srow" onClick={() => openSheet(t.id)}>
                                <div className="emu-kpi-ic" style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--gold-soft)', color: 'var(--gold)' }}><X name="edit" size={17} /></div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="emu-strong emu-clip">{t.title} · {t.subject_name} lớp {t.class_name}</div>
                                    <div className="emu-muted" style={{ fontSize: 12 }}>{fmtDate(t.test_date)} · đã nhập {t.scored + t.absent}/{t.student_count} học sinh</div>
                                </div>
                                <StatusBadge meta={meta} status={t.status} />
                                <button className="emu-btn primary sm">Nhập điểm</button>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="emu-card">
                    <div className="emu-card-h"><h3>Phân bố điểm</h3></div>
                    <div className="emu-card-b emu-row" style={{ gap: 16 }}>
                        <Donut size={130} stroke={18} segments={o.bands.map((b) => ({ label: b.label, value: b.count ?? 0, color: b.color }))}
                               center={<div><b style={{ fontSize: 22 }}>{totalScores}</b><div className="emu-muted" style={{ fontSize: 10.5 }}>bài làm</div></div>} />
                        <div className="emu-legend">{o.bands.map((b) => <div key={b.key} style={{ fontSize: 12 }}><i className="emu-dot" style={{ background: b.color }} />{b.label.split(' (')[0]}<b>{b.count}</b></div>)}</div>
                    </div>
                </div>
            </div>

            <div className="emu-grid emu-g2">
                <div className="emu-card">
                    <div className="emu-card-h"><h3>Điểm trung bình theo lớp</h3><span className="emu-sub">hệ 10 · tỉ lệ đạt (≥ 5)</span></div>
                    <div className="emu-card-b emu-col" style={{ gap: 14 }}>
                        {o.class_avgs.length === 0 && <Empty icon="chart" title="Chưa có điểm" text="Nhập điểm một bài kiểm tra để xem thống kê." />}
                        {o.class_avgs.map((c) => (
                            <div key={`${c.class_id}-${c.subject_id}`}>
                                <div className="emu-row"><b>{c.subject_name} · {c.class_name}</b><span className="emu-spacer" /><span className="emu-muted" style={{ fontSize: 12 }}>đạt {c.pass_rate ?? '—'}%</span><b className="emu-num" style={{ color: scoreColor(c.avg), width: 44, textAlign: 'right' }}>{c.avg}</b></div>
                                <div className="emu-bar" style={{ marginTop: 6 }}><i style={{ width: `${(c.avg / maxAvg) * 100}%`, background: scoreColor(c.avg) }} /></div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="emu-card">
                    <div className="emu-card-h"><h3>Lịch kiểm tra sắp tới</h3><span className="emu-spacer" /><button className="emu-btn ghost sm" onClick={() => goto('calendar')}>Xem lịch <X name="right" size={14} /></button></div>
                    <div className="emu-card-b emu-col">
                        {o.upcoming_official.length + o.upcoming_tests.length === 0 && <Empty icon="calendar" title="Chưa có lịch sắp tới" text="Lịch chính thức do nhà trường lập sẽ hiện ở đây." />}
                        {o.upcoming_official.map((e) => (
                            <div key={e.key} className="emu-row"><div className="emu-kpi-ic" style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--violet-soft)', color: 'var(--violet)' }}><X name="flag" size={16} /></div>
                                <div style={{ flex: 1, minWidth: 0 }}><div className="emu-clip"><b>{e.subject_name}</b> · lớp {e.class_name}</div><div className="emu-muted" style={{ fontSize: 12 }}>{e.title} · {fmtDate(e.date)} {e.start_time} · {e.duration_minutes}′ · {e.sub}</div></div></div>
                        ))}
                        {o.upcoming_tests.map((t) => (
                            <div key={t.id} className="emu-row" style={{ cursor: 'pointer' }} onClick={() => openSheet(t.id)}><div className="emu-kpi-ic" style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--brand-soft)', color: 'var(--brand)' }}><X name="clipboard" size={16} /></div>
                                <div style={{ flex: 1, minWidth: 0 }}><div className="emu-clip"><b>{t.title}</b> · lớp {t.class_name}</div><div className="emu-muted" style={{ fontSize: 12 }}>{kindLabel(meta, t.kind)} · {fmtDate(t.test_date)} {t.start_time ?? ''}</div></div></div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="emu-card">
                <div className="emu-card-h"><h3>Hoạt động gần đây</h3></div>
                <div className="emu-card-b">
                    {o.activity.length === 0 && <Empty icon="history" title="Chưa có hoạt động" />}
                    <div className="emu-tl">
                        {o.activity.map((a) => { const s = ACT_ICON(a.action); return (
                            <div key={a.id} className="emu-tl-item"><div className="emu-tl-dot" style={{ color: s.color, borderColor: s.color }}><X name={s.icon} size={11} /></div>
                                <div>{a.summary}</div><div className="emu-muted" style={{ fontSize: 12 }}>{relTime(a.created_at)}</div></div>
                        ); })}
                    </div>
                </div>
            </div>
        </div>
    );
}