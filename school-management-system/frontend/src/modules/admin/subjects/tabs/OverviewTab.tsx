'use client';
import type { Ctx } from '../SubjectsPage';
import { subjectApi } from '../api';
import { Donut, HBars, Ring } from '../ui/Charts';
import Icon from '../ui/Icon';
import { TONE_NAMES, fmtDate, tone } from '../theme';
import { ErrorBox, Kpi, Loading, useLoad } from './shared';
import { useEffect } from 'react';

const PALETTE = ['#0369a1', '#22b8e6', '#14b8a6', '#f59e0b', '#ef4444', '#6366f1', '#10b981', '#94a3b8'];

export default function OverviewTab({ ctx }: { ctx: Ctx }) {
    const o = useLoad(() => subjectApi.overview(ctx.yearId), [ctx.yearId]);
    const h = useLoad(() => subjectApi.integrity(ctx.yearId), [ctx.yearId]);
    useEffect(() => { if (h.data) ctx.setHealth(h.data.health); }, [h.data]); // eslint-disable-line react-hooks/exhaustive-deps

    if (o.loading && !o.data) return <Loading />;
    if (o.error || !o.data) return <ErrorBox msg={o.error} retry={o.reload} />;
    const t = o.data.totals;
    const missing = Math.max(0, t.expected - t.assigned);
    const cat = o.data.by_category;

    return (
        <>
            <div className="sj-kpis">
                <Kpi icon="book" label="Tổng số môn" value={t.subjects} sub={`${t.active} đang dạy • ${t.inactive} ngừng`} color="indigo" />
                <Kpi icon="clock" label="Tiết / tuần (toàn môn)" value={t.periods_per_week} sub={`${t.score} môn tính điểm • ${t.pass} môn đánh giá`} color="sky" />
                <Kpi icon="layers" label="Tổ bộ môn" value={t.groups} sub={`${t.teachers} giáo viên`} color="violet" />
                <Kpi icon="link" label="Mục phân công" value={`${t.assigned}/${t.expected}`} sub={missing ? `Còn thiếu ${missing}` : 'Đã đủ'} color={missing ? 'amber' : 'emerald'} />
            </div>

            <div className="sj-grid sj-g-main">
                <div className="sj-grid">
                    <div className="sj-card">
                        <div className="sj-card-h"><div><h3>Phân bổ môn theo tổ bộ môn</h3><p>Số môn và tổng tiết/tuần mỗi tổ</p></div>
                            <button className="sj-btn sm" onClick={() => ctx.go('groups')}>Quản lý tổ <Icon name="right" size={14} /></button></div>
                        <div className="sj-flex">
                            <Donut size={176} center={{ big: String(t.subjects), small: 'môn học' }} data={o.data.by_group.map((g, i) => ({ label: g.name, value: g.total, color: PALETTE[i % PALETTE.length] }))} />
                            <div className="sj-legend">
                                {o.data.by_group.map((g, i) => <div key={g.name}><i style={{ background: PALETTE[i % PALETTE.length] }} />{g.name}<b>{g.total} môn • {g.periods} tiết</b></div>)}
                            </div>
                        </div>
                    </div>
                    <div className="sj-card">
                        <div className="sj-card-h"><div><h3>Môn được giảng dạy nhiều lớp nhất</h3><p>Năm học đang chọn</p></div></div>
                        <HBars rows={o.data.top_subjects.map((s) => ({ label: s.name, value: s.n, color: tone(TONE_NAMES.includes(s.color) ? s.color : 'indigo') }))} />
                    </div>
                </div>

                <div className="sj-grid" style={{ alignContent: 'start' }}>
                    <div className="sj-card">
                        <div className="sj-card-h"><h3>Sức khỏe dữ liệu</h3><button className="sj-btn sm" onClick={() => ctx.go('integrity')}>Chi tiết</button></div>
                        <div className="sj-flex" style={{ justifyContent: 'center' }}>
                            <Ring value={h.data?.health ?? 0} label="/100" color={(h.data?.health ?? 0) >= 85 ? 'var(--ok)' : (h.data?.health ?? 0) >= 60 ? 'var(--warn)' : 'var(--bad)'} />
                            <div className="sj-legend" style={{ minWidth: 130 }}>
                                <div>Phủ phân công<b>{t.coverage}%</b></div>
                                <div>Vấn đề cần xử lý<b>{h.data?.total ?? '…'}</b></div>
                                <div>Bắt buộc / tự chọn<b>{cat.required} / {cat.elective + cat.topic}</b></div>
                            </div>
                        </div>
                    </div>
                    <div className="sj-card">
                        <div className="sj-card-h"><h3>Thao tác nhanh</h3></div>
                        <div className="sj-grid" style={{ gap: 8 }}>
                            <button className="sj-btn" onClick={ctx.openCreate}><Icon name="plus" size={16} /> Thêm môn học mới</button>
                            <button className="sj-btn" onClick={() => ctx.go('assign')}><Icon name="wand" size={16} /> Tự động phân công giáo viên</button>
                            <button className="sj-btn" onClick={() => ctx.go('curriculum')}><Icon name="sliders" size={16} /> Cấu hình hệ số điểm theo khối</button>
                            <button className="sj-btn" onClick={() => ctx.go('analytics')}><Icon name="chart" size={16} /> Xem thống kê điểm theo môn</button>
                        </div>
                    </div>
                    <div className="sj-card">
                        <div className="sj-card-h"><h3>Hoạt động gần đây</h3><button className="sj-btn sm" onClick={() => ctx.go('audit')}>Tất cả</button></div>
                        {o.data.recent.length === 0 ? <p className="sj-muted">Chưa có thay đổi nào được ghi nhận.</p> : (
                            <div className="sj-tl">
                                {o.data.recent.map((r) => (
                                    <div key={r.id} className={`sj-tl-i ${r.action}`}><p>{r.summary}</p><small>{r.actor || 'hệ thống'} • {fmtDate(r.created_at)}</small></div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}