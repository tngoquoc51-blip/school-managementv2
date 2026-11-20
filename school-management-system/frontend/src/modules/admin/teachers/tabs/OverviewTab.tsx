'use client';
import { useEffect } from 'react';
import type { Ctx } from '../TeachersPage';
import { teacherApi } from '../api';
import { Donut, HBars, Ring, Columns } from '../../subjects/ui/Charts';
import Icon from '../../subjects/ui/Icon';
import { fmtDate } from '../../subjects/theme';
import { ErrorBox, Kpi, Loading, useLoad } from '../../subjects/tabs/shared';
import { fmtD } from './bits';

const PAL = ['#0369a1', '#22b8e6', '#14b8a6', '#f59e0b', '#6366f1', '#10b981', '#94a3b8'];

export default function OverviewTab({ ctx }: { ctx: Ctx }) {
    const o = useLoad(() => teacherApi.overview(ctx.yearId), [ctx.yearId]);
    const h = useLoad(() => teacherApi.integrity(ctx.yearId), [ctx.yearId]);
    useEffect(() => { if (h.data) ctx.setHealth(h.data.health); }, [h.data]); // eslint-disable-line react-hooks/exhaustive-deps
    if (o.loading && !o.data) return <Loading />;
    if (o.error || !o.data) return <ErrorBox msg={o.error} retry={o.reload} />;
    const d = o.data;
    const M = ctx.meta;
    const hr = d.classes - d.homeroom;

    return (
        <>
            <div className="sj-kpis">
                <Kpi icon="users" label="Tổng giáo viên" value={d.total} sub={`${d.active} đang công tác`} color="indigo" />
                <Kpi icon="star" label="Chủ nhiệm lớp" value={`${d.homeroom}/${d.classes}`} sub={hr ? `Còn ${hr} lớp chưa có GVCN` : 'Đủ GVCN'} color={hr ? 'amber' : 'emerald'} />
                <Kpi icon="gauge" label="Tiết dạy trung bình" value={d.workload.avg} sub={`${d.workload.over} quá tải • ${d.workload.under} thiếu tải`} color="sky" />
                <Kpi icon="clock" label="Nghỉ phép" value={d.on_leave_today} sub={`${d.pending_leaves} đơn chờ duyệt`} color={d.pending_leaves ? 'amber' : 'violet'} />
            </div>

            <div className="sj-grid sj-g-main">
                <div className="sj-grid">
                    <div className="sj-card">
                        <div className="sj-card-h"><div><h3>Giáo viên theo môn chính</h3><p>Phân bổ đội ngũ theo chuyên môn</p></div>
                            <button className="sj-btn sm" onClick={() => ctx.go('supply')}>Cung – cầu <Icon name="right" size={14} /></button></div>
                        <div className="sj-flex">
                            <Donut size={176} center={{ big: String(d.total), small: 'giáo viên' }} data={d.by_subject.map((s, i) => ({ label: s.name ?? 'Chưa có', value: s.n, color: PAL[i % PAL.length] }))} />
                            <div className="sj-legend">{d.by_subject.map((s, i) => <div key={s.name ?? i}><i style={{ background: PAL[i % PAL.length] }} />{s.name ?? 'Chưa có chuyên môn'}<b>{s.n} GV</b></div>)}</div>
                        </div>
                    </div>
                    <div className="sj-grid sj-g2">
                        <div className="sj-card"><div className="sj-card-h"><h3>Trình độ</h3></div>
                            <HBars rows={Object.entries(d.by_degree).map(([k, n]) => ({ label: M.degrees[k as keyof typeof M.degrees] ?? k, value: n, color: '#0369a1' }))} /></div>
                        <div className="sj-card"><div className="sj-card-h"><h3>Hợp đồng</h3></div>
                            <HBars rows={Object.entries(d.by_contract).map(([k, n]) => ({ label: M.contracts[k as keyof typeof M.contracts] ?? k, value: n, color: '#14b8a6' }))} /></div>
                    </div>
                    <div className="sj-card"><div className="sj-card-h"><div><h3>Cơ cấu độ tuổi</h3><p>Chỉ tính giáo viên đã có ngày sinh</p></div></div>
                        <Columns labels={Object.keys(d.age_buckets)} values={Object.values(d.age_buckets)} colors={['#22b8e6', '#0369a1', '#0a4f7a', '#f59e0b']} /></div>
                    <div className="sj-card">
                        <div className="sj-card-h"><div><h3>Tải dạy cao nhất</h3><p>Định mức {d.workload.quota} tiết/tuần (GVCN giảm {M.reduction})</p></div><button className="sj-btn sm" onClick={() => ctx.go('workload')}>Cân bằng tải</button></div>
                        <HBars max={Math.max(24, ...d.top_load.map((t) => t.periods))} rows={d.top_load.map((t) => ({ label: t.full_name, value: t.periods, color: t.status === 'over' ? '#dc2626' : '#0369a1', sub: `/${t.quota}` }))} />
                    </div>
                </div>

                <div className="sj-grid" style={{ alignContent: 'start' }}>
                    <div className="sj-card">
                        <div className="sj-card-h"><h3>Sức khỏe dữ liệu</h3><button className="sj-btn sm" onClick={() => ctx.go('integrity')}>Chi tiết</button></div>
                        <div className="sj-flex" style={{ justifyContent: 'center' }}>
                            <Ring value={h.data?.health ?? 0} label="/100" color={(h.data?.health ?? 0) >= 85 ? 'var(--ok)' : (h.data?.health ?? 0) >= 60 ? 'var(--warn)' : 'var(--bad)'} />
                            <div className="sj-legend" style={{ minWidth: 130 }}><div>Vấn đề cần xử lý<b>{h.data?.total ?? '…'}</b></div><div>Nam / Nữ<b>{d.by_gender['Nam'] ?? 0} / {d.by_gender['Nữ'] ?? 0}</b></div></div>
                        </div>
                    </div>
                    <div className="sj-card">
                        <div className="sj-card-h"><h3>Thao tác nhanh</h3></div>
                        <div className="sj-grid" style={{ gap: 8 }}>
                            <button className="sj-btn" onClick={ctx.openCreate}><Icon name="plus" size={16} /> Thêm giáo viên mới</button>
                            <button className="sj-btn" onClick={() => ctx.go('homeroom')}><Icon name="star" size={16} /> Phân công chủ nhiệm</button>
                            <button className="sj-btn" onClick={() => ctx.go('leaves')}><Icon name="link" size={16} /> Duyệt đơn nghỉ & dạy thay {d.pending_leaves > 0 && <span className="sj-pill">{d.pending_leaves}</span>}</button>
                            <button className="sj-btn" onClick={() => ctx.go('schedule')}><Icon name="clock" size={16} /> Xem lịch dạy giáo viên</button>
                        </div>
                    </div>
                    <div className="sj-card">
                        <div className="sj-card-h"><h3>Chứng chỉ sắp hết hạn</h3></div>
                        {d.upcoming_certs.length === 0 ? <p className="sj-muted">Không có chứng chỉ nào sắp hết hạn.</p> :
                            d.upcoming_certs.map((c) => <div key={c.id} className="tc-cert soon"><span><b>{c.full_name}</b><br /><small>{c.name}</small></span><button className="sj-btn sm" onClick={() => ctx.openTeacher(c.teacher_id)}>{fmtD(c.expires_at)}</button></div>)}
                    </div>
                    <div className="sj-card">
                        <div className="sj-card-h"><h3>Hoạt động gần đây</h3><button className="sj-btn sm" onClick={() => ctx.go('audit')}>Tất cả</button></div>
                        {d.recent.length === 0 ? <p className="sj-muted">Chưa có thay đổi nào.</p> : <div className="sj-tl">{d.recent.map((r) => <div key={r.id} className={`sj-tl-i ${r.action}`}><p>{r.summary}</p><small>{r.actor || 'hệ thống'} • {fmtDate(r.created_at)}</small></div>)}</div>}
                    </div>
                </div>
            </div>
        </>
    );
}