'use client';

import { useCallback, useEffect, useState } from 'react';
import s from '../../logs/logs.module.css';
import e from '../evaluations.module.css';
import { Icon } from '../../logs/components/Icons';
import { Confirm, Empty, ErrorBox, Skeleton, useAsync, useToast } from '../../logs/components/ui';
import { errorMessage, evApi } from '../api';
import { Avatar, Dialog, Field, RatingChip, SearchBox, StatTabs, Tone, useDebounced } from '../components/bits';
import { useEv } from '../components/ctx';
import { PERIODIC_STATUS, RATING, score } from '../format';
import type { PeriodicRow, Settings } from '../types';

const COMP: [keyof PeriodicRow, string, string][] = [
    ['score_professional', 'Chuyên môn nghiệp vụ', 'weight_professional'], ['score_results', 'Kết quả giảng dạy', 'weight_results'],
    ['score_conduct', 'Phẩm chất, kỷ luật', 'weight_conduct'], ['score_innovation', 'Đổi mới, ứng dụng CNTT', 'weight_innovation'],
];

export default function PeriodicTab() {
    const ev = useEv(); const toast = useToast();
    const [status, setStatus] = useState(''); const [q, setQ] = useState(''); const dq = useDebounced(q);
    const [subject, setSubject] = useState('');
    const st = useAsync<{ items: PeriodicRow[]; counts: Record<string, number>; settings: Settings }>();
    const [edit, setEdit] = useState<PeriodicRow | null>(null);
    const [ask, setAsk] = useState<null | { row: PeriodicRow; kind: 'approve' | 'reopen' | 'submit' }>(null);
    const [busy, setBusy] = useState(false);
    const load = useCallback(() => st.run(() => evApi.periodic({ year: ev.year, semester: ev.semester, status, q: dq, subject_id: subject })), [ev.year, ev.semester, status, dq, subject]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { load(); }, [load, ev.tick]);
    const c = st.data?.counts;
    const semName = ev.semester === 3 ? 'Cả năm' : 'HK' + ev.semester;

    const generate = async () => {
        setBusy(true);
        try { const r = await evApi.generatePeriodic({ year: ev.year, semester: ev.semester }); toast('ok', `Đã tạo ${r.created} bản đánh giá, cập nhật điểm dự giờ cho ${r.refreshed} bản`); load(); }
        catch (x) { toast('err', errorMessage(x)); } finally { setBusy(false); }
    };
    const run = async (row: PeriodicRow, kind: 'approve' | 'reopen' | 'submit', body: Record<string, unknown> = {}) => {
        try { await evApi.periodicAct(row.id!, kind, body); toast('ok', { approve: 'Đã phê duyệt đánh giá', reopen: 'Đã mở lại bản đánh giá', submit: 'Đã trình duyệt' }[kind]); setAsk(null); load(); }
        catch (x) { toast('err', errorMessage(x)); setAsk(null); }
    };
    const exp = async () => { try { await evApi.exportPeriodic({ year: ev.year, semester: ev.semester }); toast('ok', 'Đã xuất bảng đánh giá (CSV)'); } catch (x) { toast('err', errorMessage(x)); } };
    const w = st.data?.settings;

    return (
        <div className={s.stack}>
            <div className={s.card}>
                <div className={e.flex}>
                    <div className={e.grow}>
                        <h3 className={s.cardTitle}>Đánh giá giáo viên {semName} — năm học {ev.lk.year?.label}</h3>
                        <div className={s.cardSub}>Điểm tổng kết = trung bình có trọng số của 5 thành phần{w ? `: Dự giờ ${w.weight_observation}% · Chuyên môn ${w.weight_professional}% · Kết quả ${w.weight_results}% · Phẩm chất ${w.weight_conduct}% · Đổi mới ${w.weight_innovation}%` : ''}. Điểm dự giờ tự lấy từ các phiếu đã nộp.</div>
                    </div>
                    <button className={s.btn} onClick={exp}><Icon name="download" size={15} /> Xuất CSV</button>
                    <button className={`${s.btn} ${s.primary}`} disabled={busy} onClick={generate}><Icon name="refresh" size={15} /> Khởi tạo / cập nhật điểm dự giờ</button>
                </div>
            </div>
            <div className={e.toolbar}>
                <SearchBox value={q} onChange={setQ} placeholder="Tìm giáo viên…" />
                <select className={s.field} value={subject} onChange={(x) => setSubject(x.target.value)} aria-label="Tổ / môn"><option value="">Mọi tổ / môn</option>{ev.lk.subjects.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
            </div>
            <StatTabs value={status} onChange={setStatus} items={[['', 'Tất cả', c?.all], ['none', 'Chưa lập', c?.none], ['draft', 'Đang soạn', c?.draft], ['submitted', 'Chờ duyệt', c?.submitted], ['approved', 'Đã duyệt', c?.approved]]} />
            {st.error ? <ErrorBox message={st.error} onRetry={load} /> : !st.data ? <Skeleton h={380} /> : st.data.items.length === 0 ? <div className={s.card}><Empty title="Không có giáo viên phù hợp" /></div> : (
                <div className={s.card} style={{ padding: 0 }}>
                    <div className={s.tableWrap} style={{ border: 0 }}>
                        <table className={s.table}>
                            <thead><tr><th>Giáo viên</th><th>Dự giờ</th><th>Chuyên môn</th><th>Kết quả</th><th>Phẩm chất</th><th>Đổi mới</th><th>Tổng</th><th>Xếp loại</th><th>Trạng thái</th><th /></tr></thead>
                            <tbody>
                            {st.data.items.map((r) => {
                                const stt = r.status;
                                return (
                                    <tr key={r.teacher_id} onClick={() => setEdit(r)}>
                                        <td><div className={s.who}><Avatar name={r.full_name} /><div><div className={e.tdMain}>{r.full_name}</div><div className={e.tdSub}>{r.subject_name}</div></div></div></td>
                                        <td><b>{score(r.obs_avg)}</b><div className={e.tdSub}>{r.obs_count} phiếu</div></td>
                                        <td>{score(r.score_professional)}</td><td>{score(r.score_results)}</td><td>{score(r.score_conduct)}</td><td>{score(r.score_innovation)}</td>
                                        <td><b>{score(r.total_score)}</b></td><td><RatingChip v={r.rating} /></td>
                                        <td><Tone tone={PERIODIC_STATUS[stt].tone}>{PERIODIC_STATUS[stt].label}</Tone>{r.approved_by && <div className={e.tdSub}>{r.approved_by}</div>}</td>
                                        <td onClick={(x) => x.stopPropagation()}>
                                            <div className={e.rowActions}>
                                                {(stt === 'none' || stt === 'draft') && <button className={`${s.btn} ${s.sm}`} onClick={() => setEdit(r)}>Chấm</button>}
                                                {stt === 'draft' && <button className={`${s.btn} ${s.sm}`} onClick={() => setAsk({ row: r, kind: 'submit' })}>Trình duyệt</button>}
                                                {stt === 'submitted' && <button className={`${s.btn} ${s.sm} ${s.primary}`} onClick={() => setAsk({ row: r, kind: 'approve' })}>Phê duyệt</button>}
                                                {(stt === 'submitted' || stt === 'approved') && <button className={`${s.btn} ${s.sm}`} onClick={() => setAsk({ row: r, kind: 'reopen' })}>Mở lại</button>}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            {edit && st.data && <EditDialog row={edit} settings={st.data.settings} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
            {ask?.kind === 'submit' && <Confirm title="Trình duyệt đánh giá" body={`Trình Hiệu trưởng phê duyệt đánh giá của ${ask.row.full_name}? Cần đủ 5 thành phần điểm.`} confirmText="Trình duyệt" onCancel={() => setAsk(null)} onOk={() => run(ask.row, 'submit')} />}
            {ask?.kind === 'approve' && <Confirm title="Phê duyệt đánh giá" body={`Phê duyệt ${ask.row.total_score} điểm (${ask.row.rating ? RATING[ask.row.rating].label : ''}) cho ${ask.row.full_name}. Chỉ Hiệu trưởng / Quản trị được phê duyệt.`} confirmText="Phê duyệt" onCancel={() => setAsk(null)} onOk={() => run(ask.row, 'approve')} />}
            {ask?.kind === 'reopen' && <Confirm title="Mở lại bản đánh giá" body="Bản đánh giá quay về trạng thái đang soạn để chỉnh sửa." input={{ label: 'Lý do', required: true }} confirmText="Mở lại" onCancel={() => setAsk(null)} onOk={(t) => run(ask.row, 'reopen', { reason: t })} />}
        </div>
    );
}

function EditDialog({ row, settings, onClose, onSaved }: { row: PeriodicRow; settings: Settings; onClose: () => void; onSaved: () => void }) {
    const ev = useEv(); const toast = useToast();
    const locked = row.status === 'submitted' || row.status === 'approved';
    const [f, setF] = useState<Record<string, string>>({
        score_professional: row.score_professional ?? '', score_results: row.score_results ?? '', score_conduct: row.score_conduct ?? '', score_innovation: row.score_innovation ?? '', comment: row.comment ?? '',
    });
    const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
    const obs = row.obs_avg !== null && row.obs_avg !== undefined ? Number(row.obs_avg) : null;
    let num = 0, den = 0;
    const parts: [number | null, number][] = [[obs, Number(settings.weight_observation)], ...COMP.map(([k, , wk]) => [f[k as string] === '' ? null : Number(f[k as string]), Number((settings as any)[wk])] as [number | null, number])];
    parts.forEach(([v, w]) => { if (v !== null && !isNaN(v)) { num += v * w; den += w; } });
    const total = den ? Math.round((num / den) * 100) / 100 : null;
    const rating = total === null ? null : total >= Number(settings.rating_excellent) ? 'excellent' : total >= Number(settings.rating_good) ? 'good' : total >= Number(settings.rating_pass) ? 'pass' : 'fail';
    const save = async () => {
        setBusy(true); setErr('');
        try { await evApi.savePeriodic(row.teacher_id!, { year: ev.year, semester: ev.semester }, f); toast('ok', 'Đã lưu đánh giá của ' + row.full_name); onSaved(); }
        catch (x) { setErr(errorMessage(x)); } finally { setBusy(false); }
    };
    return (
        <Dialog title={`Đánh giá — ${row.full_name}`} width={600} onClose={onClose} busy={busy}
                footer={<><button className={s.btn} onClick={onClose}>Đóng</button>{!locked && <button className={`${s.btn} ${s.primary}`} disabled={busy} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu đánh giá'}</button>}</>}>
            <div className={e.form}>
                {err && <div className={e.errLine}>{err}</div>}
                {locked && <div className={e.errLine} style={{ background: 'var(--infoSoft)', color: 'var(--info)' }}>Bản đánh giá đang ở trạng thái “{PERIODIC_STATUS[row.status].label}”. Hãy mở lại để chỉnh sửa.</div>}
                <div className={e.miniGrid}>
                    <div className={e.mini}><b>{score(obs)}</b><span>Điểm dự giờ ({row.obs_count} phiếu) · {settings.weight_observation}%</span></div>
                    <div className={e.mini}><b>{total === null ? '—' : total.toFixed(1)}</b><span>Điểm tổng kết (xem trước)</span></div>
                    <div className={e.mini}><RatingChip v={rating as any} /><span style={{ display: 'block', marginTop: 6 }}>Xếp loại dự kiến</span></div>
                </div>
                <div className={e.fg2}>
                    {COMP.map(([k, label, wk]) => (
                        <Field key={k as string} label={`${label} (${(settings as any)[wk]}%)`} hint="Thang 0–100">
                            <input type="number" min={0} max={100} step="0.5" className={e.input} disabled={locked} value={f[k as string]} onChange={(x) => setF({ ...f, [k as string]: x.target.value })} />
                        </Field>
                    ))}
                </div>
                <Field label="Nhận xét chung"><textarea className={e.input} disabled={locked} value={f.comment} onChange={(x) => setF({ ...f, comment: x.target.value })} /></Field>
                <button type="button" className={`${s.btn} ${s.sm} ${s.ghost}`} onClick={() => { onClose(); ev.openTeacher(row.teacher_id!); }}><Icon name="users" size={14} /> Xem hồ sơ & các phiếu dự giờ</button>
            </div>
        </Dialog>
    );
}