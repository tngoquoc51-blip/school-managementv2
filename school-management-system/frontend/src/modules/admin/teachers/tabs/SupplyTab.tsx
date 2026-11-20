
'use client';
import type { Ctx } from '../TeachersPage';
import Icon from '../../subjects/ui/Icon';
import { tcls } from '../../subjects/theme';
import { Empty, ErrorBox, Kpi, Loading, useLoad } from '../../subjects/tabs/shared';
import { teacherApi } from '../api';

const ST = { short: ['Thiếu GV', 'bad'], ok: ['Cân đối', 'ok'], surplus: ['Dư GV', 'warn'], none: ['Chưa có tiết', ''] } as const;

export default function SupplyTab({ ctx }: { ctx: Ctx }) {
    const q = useLoad(() => teacherApi.supply(ctx.yearId), [ctx.yearId]);
    const p = useLoad(() => teacherApi.performance(ctx.yearId), [ctx.yearId]);
    if (q.loading && !q.data) return <Loading />;
    if (q.error || !q.data) return <ErrorBox msg={q.error} retry={q.reload} />;
    const rows = q.data.subjects;
    const short = rows.filter((r) => r.status === 'short');
    const needTotal = rows.reduce((a, r) => a + r.need_fte, 0);
    const have = rows.reduce((a, r) => a + r.teachers, 0);
    const max = Math.max(1, ...rows.map((r) => Math.max(r.need_fte, r.teachers)));
    const perf = (p.data?.teachers ?? []);

    return (
        <>
            <div className="sj-kpis">
                <Kpi icon="users" label="Giáo viên có chuyên môn chính" value={have} color="indigo" />
                <Kpi icon="gauge" label="Nhu cầu quy đổi (GV)" value={needTotal.toFixed(1)} sub={`Định mức ${q.data.quota} tiết/GV`} color="sky" />
                <Kpi icon="alert" label="Môn đang thiếu GV" value={short.length} sub={short.map((s) => s.name).join(', ') || 'Không có'} color={short.length ? 'amber' : 'emerald'} />
                <Kpi icon="layers" label="Môn có tiết dạy" value={rows.filter((r) => r.periods > 0).length} color="violet" />
            </div>

            <div className="sj-card sj-mt">
                <div className="sj-card-h"><div><h3>Cung – cầu giáo viên theo môn</h3><p>Nhu cầu = tổng tiết/tuần các lớp ÷ định mức. Cung = số GV đang công tác có môn chính đó.</p></div>
                    <button className="sj-btn" onClick={() => q.reload()}><Icon name="refresh" size={16} /> Tính lại</button></div>
                <div className="sj-tablewrap"><table className="sj-table">
                    <thead><tr><th>Môn học</th><th>Số lớp</th><th>Tiết/tuần</th><th style={{ width: '34%' }}>Cầu ↔ Cung</th><th>Chênh lệch</th><th>Đánh giá</th></tr></thead>
                    <tbody>{rows.map((r) => (
                        <tr key={r.id} className={tcls(r.color)}>
                            <td><span className="tc-sub">{r.name}</span></td><td>{r.classes}</td><td><b>{r.periods}</b></td>
                            <td><div className="tc-gap"><div className="tc-gap-bar" title={`Cầu ${r.need_fte} • Cung ${r.teachers}`}>
                                <i style={{ width: `${(r.need_fte / max) * 100}%`, background: 'color-mix(in srgb,var(--primary) 30%,transparent)' }} />
                                <i style={{ width: `${(r.teachers / max) * 100}%`, height: 4, top: 3, background: 'var(--primary)' }} /></div>
                                <small>{r.need_fte} ↔ {r.teachers}</small></div></td>
                            <td><b style={{ color: r.gap < 0 ? 'var(--bad)' : 'var(--ok)' }}>{r.gap > 0 ? '+' : ''}{r.gap}</b> <small className="sj-muted">({r.qualified} GV biết dạy)</small></td>
                            <td><span className={`sj-badge ${ST[r.status][1]}`}>{ST[r.status][0]}</span></td>
                        </tr>))}</tbody></table></div>
                {short.length > 0 && <div className="sj-hint warn sj-mt"><Icon name="alert" /><span>Môn <b>{short.map((s) => s.name).join(', ')}</b> thiếu giáo viên chính. Cân nhắc tuyển thêm, hoặc bổ sung chuyên môn phụ cho giáo viên ở tab Danh sách.</span></div>}
            </div>

            <div className="sj-card sj-mt">
                <div className="sj-card-h"><div><h3>Kết quả giảng dạy theo giáo viên</h3><p>Điểm TBM trung bình của học sinh các lớp được phân công (ngưỡng đạt {p.data?.pass_score ?? 5})</p></div></div>
                {p.loading && !p.data ? <Loading rows={1} /> : perf.length === 0 ? <Empty icon="chart" title="Chưa có dữ liệu điểm" /> : (
                    <div className="sj-tablewrap" style={{ maxHeight: 420 }}><table className="sj-table">
                        <thead><tr><th>#</th><th>Giáo viên</th><th>Số điểm</th><th>TBM</th><th>Tỉ lệ đạt</th></tr></thead>
                        <tbody>{perf.map((t, i) => (
                            <tr key={t.id}><td>{i + 1}</td><td><a style={{ cursor: 'pointer', color: 'var(--primary)', fontWeight: 600 }} onClick={() => ctx.openTeacher(t.id)}>{t.full_name}</a><br /><small className="sj-muted">{t.code}</small></td>
                                <td>{t.n}</td><td><b>{t.avg}</b></td>
                                <td><div className="sj-prog" style={{ minWidth: 120 }}><i style={{ width: `${t.pass_rate ?? 0}%` }} /></div><small>{t.pass_rate}%</small></td></tr>))}</tbody></table></div>)}
            </div>
        </>
    );
}