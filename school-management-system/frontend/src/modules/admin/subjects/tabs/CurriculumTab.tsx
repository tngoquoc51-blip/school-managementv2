'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Ctx } from '../SubjectsPage';
import Icon from '../ui/Icon';
import { useToast } from '../ui/Toast';
import { errMsg, subjectApi } from '../api';
import { tcls } from '../theme';
import type { Curriculum } from '../types';
import { ErrorBox, Loading, Stepper, Switch, useLoad } from './shared';

export default function CurriculumTab({ ctx }: { ctx: Ctx }) {
    const toast = useToast();
    const q = useLoad(() => subjectApi.curriculum(), []);
    const subs = useLoad(() => subjectApi.list({ per_page: 100, sort: 'sort_order' }), []);
    const [sid, setSid] = useState<number | null>(null);
    const [rows, setRows] = useState<Curriculum[]>([]);
    const [busy, setBusy] = useState(false);
    const [dirty, setDirty] = useState(false);

    useEffect(() => { if (sid === null && subs.data?.items[0]) setSid(subs.data.items[0].id); }, [subs.data, sid]);
    useEffect(() => { if (sid !== null && q.data) { setRows(q.data.filter((r) => r.subject_id === sid).map((r) => ({ ...r }))); setDirty(false); } }, [sid, q.data]);

    const totals = useMemo(() => {
        const t: Record<number, number> = { 10: 0, 11: 0, 12: 0 };
        (q.data ?? []).forEach((r) => { t[r.grade] = (t[r.grade] ?? 0) + r.periods_per_week; });
        return t;
    }, [q.data]);

    if ((q.loading && !q.data) || (subs.loading && !subs.data)) return <Loading />;
    if (q.error || !q.data) return <ErrorBox msg={q.error} retry={q.reload} />;
    const subject = subs.data?.items.find((s) => s.id === sid);
    const upd = (grade: number, patch: Partial<Curriculum>) => { setRows((r) => r.map((x) => (x.grade === grade ? { ...x, ...patch } : x))); setDirty(true); };

    const save = async () => {
        if (sid === null) return;
        setBusy(true);
        try { await subjectApi.saveCurriculum(sid, rows.map((r) => ({ ...r, is_required: !!r.is_required }))); toast.success('Đã lưu chương trình', `${subject?.name}: hệ số điểm & số tiết cập nhật cho ${rows.length} khối.`); setDirty(false); q.reload(true); }
        catch (e) { toast.error('Không lưu được', errMsg(e)); } finally { setBusy(false); }
    };

    return (
        <div className="sj-grid" style={{ gridTemplateColumns: 'minmax(220px,300px) minmax(0,1fr)', alignItems: 'start' }}>
            <div className="sj-card" style={{ padding: 10, maxHeight: 'calc(100vh - 260px)', overflow: 'auto' }}>
                {subs.data?.items.map((s) => (
                    <button key={s.id} className={`sj-btn ghost ${tcls(s.color)}`} style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 4, borderColor: sid === s.id ? 'var(--t)' : 'transparent', background: sid === s.id ? 'color-mix(in srgb,var(--t) 10%,var(--card))' : undefined }}
                            onClick={() => { if (dirty && !window.confirm('Bạn có thay đổi chưa lưu. Chuyển môn khác?')) return; setSid(s.id); }}>
                        <span className="sj-dot" /> {s.name} <span className="sj-muted" style={{ marginLeft: 'auto' }}>{s.code}</span></button>))}
            </div>

            <div className="sj-grid">
                {subject && (
                    <div className={`sj-card ${tcls(subject.color)}`}>
                        <div className="sj-card-h"><div><h3>{subject.name} — chương trình theo khối</h3><p>Hệ số điểm áp dụng khi tính ĐTB môn: <b>ĐTB = (Σ TX×{rows[0]?.w_tx ?? 1} + GK×{rows[0]?.w_gk ?? 2} + CK×{rows[0]?.w_ck ?? 3}) ÷ tổng hệ số</b></p></div>
                            <span className="sj-tag">{subject.kind === 'pass' ? 'Đánh giá Đạt/Chưa đạt' : 'Tính điểm'}</span></div>
                        {rows.length === 0 ? <p className="sj-muted">Môn chưa áp dụng cho khối nào — vào Sửa môn học để chọn khối.</p> : (
                            <div className="sj-tablewrap" style={{ boxShadow: 'none' }}>
                                <table className="sj-table" style={{ minWidth: 760 }}>
                                    <thead><tr><th>Khối</th><th>Tiết/tuần</th><th>Tiết/năm</th><th>Cột TX</th><th>Hệ số TX</th><th>Hệ số GK</th><th>Hệ số CK</th><th>Bắt buộc</th></tr></thead>
                                    <tbody>{rows.map((r) => (
                                        <tr key={r.grade}>
                                            <td><b>Khối {r.grade}</b></td>
                                            <td><Stepper value={r.periods_per_week} onChange={(n) => upd(r.grade, { periods_per_week: n, periods_total: n * 35 })} /></td>
                                            <td><input className="sj-input" type="number" min={1} max={700} style={{ width: 90 }} value={r.periods_total} onChange={(e) => upd(r.grade, { periods_total: Math.max(1, Math.min(700, Number(e.target.value) || 1)) })} /></td>
                                            <td><Stepper value={r.tx_count} min={0} max={4} onChange={(n) => upd(r.grade, { tx_count: n })} /></td>
                                            <td><Stepper value={r.w_tx} max={5} onChange={(n) => upd(r.grade, { w_tx: n })} /></td>
                                            <td><Stepper value={r.w_gk} max={5} onChange={(n) => upd(r.grade, { w_gk: n })} /></td>
                                            <td><Stepper value={r.w_ck} max={5} onChange={(n) => upd(r.grade, { w_ck: n })} /></td>
                                            <td><Switch on={!!r.is_required} onChange={(v) => upd(r.grade, { is_required: v })} label="Bắt buộc" /></td>
                                        </tr>))}</tbody>
                                </table>
                            </div>)}
                        {subject.kind === 'pass' && <div className="sj-hint sj-mt"><Icon name="info" /><span>Môn đánh giá bằng nhận xét nên không dùng cột điểm TX; hệ số chỉ mang tính tham chiếu.</span></div>}
                        <div className="sj-sticky-save"><button className="sj-btn" disabled={!dirty} onClick={() => { setRows(q.data!.filter((r) => r.subject_id === sid).map((r) => ({ ...r }))); setDirty(false); }}>Hoàn tác</button>
                            <button className="sj-btn primary" disabled={!dirty || busy} onClick={save}><Icon name="check" size={16} /> {busy ? 'Đang lưu…' : 'Lưu cấu hình'}</button></div>
                    </div>)}

                <div className="sj-card">
                    <div className="sj-card-h"><div><h3>Tổng số tiết/tuần theo khối</h3><p>Chương trình THPT thường 28–32 tiết/tuần/lớp</p></div></div>
                    <div className="sj-grid sj-g3">{[10, 11, 12].map((g) => {
                        const v = totals[g] ?? 0; const cls = v > 35 ? 'bad' : v > 32 ? 'warn' : 'ok';
                        return <div key={g}><div style={{ display: 'flex', justifyContent: 'space-between' }}><b>Khối {g}</b><b>{v} tiết</b></div><div className={`sj-prog ${cls}`} style={{ marginTop: 6 }}><i style={{ width: `${Math.min(100, (v / 40) * 100)}%` }} /></div>
                            <small className="sj-muted">{v > 35 ? 'Quá tải — nên giảm bớt' : v > 32 ? 'Gần chạm trần' : 'Trong mức cho phép'}</small></div>;
                    })}</div>
                </div>
            </div>
            <span style={{ display: 'none' }}>{ctx.yearId}</span>
        </div>
    );
}