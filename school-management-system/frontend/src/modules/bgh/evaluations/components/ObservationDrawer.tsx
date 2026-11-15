'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import s from '../../logs/logs.module.css';
import e from '../evaluations.module.css';
import { Icon } from '../../logs/components/Icons';
import { Confirm, ErrorBox, Skeleton, useToast } from '../../logs/components/ui';
import { fmtDate, fmtTime } from '../../logs/format';
import { errorMessage, evApi } from '../api';
import { ACT_STATUS, KIND, OBS_STATUS, PRIORITY, RATING, calcScore, periodTime, rate } from '../format';
import type { Kind, ObsDetail } from '../types';
import { Field, Progress, Ring, RatingChip, Tone } from './bits';
import { useEv } from './ctx';

type Sc = Record<number, { score: number | null; comment: string }>;
const tone = (v: number, max: number) => { const r = v / max; return r < 0.4 ? 'var(--crit)' : r < 0.65 ? 'var(--warn)' : r < 0.85 ? 'var(--info)' : 'var(--ok)'; };

/** Phiếu dự giờ: xem + chấm điểm + nộp + theo dõi phản hồi của giáo viên, trong một khung toàn chiều cao. */
export default function ObservationDrawer({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
    const { lk, settings, me, newAction, openTeacher } = useEv();
    const toast = useToast();
    const router = useRouter();
    const [d, setD] = useState<ObsDetail | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [meta, setMeta] = useState<Record<string, any>>({});
    const [sc, setSc] = useState<Sc>({});
    const [ask, setAsk] = useState<null | { kind: 'dispute' | 'acknowledge' | 'reopen' | 'close' | 'delete' }>(null);

    const hydrate = useCallback((x: ObsDetail) => {
        setD(x);
        const o = x.observation;
        setMeta({ teacher_id: o.teacher_id, observed_on: o.observed_on, period: o.period, kind: o.kind, topic: o.topic ?? '', class_id: o.class_id, subject_id: o.subject_id,
            students_present: o.students_present ?? '', duration_min: o.duration_min ?? 45, strengths: o.strengths ?? '', weaknesses: o.weaknesses ?? '', suggestions: o.suggestions ?? '' });
        const m: Sc = {};
        Object.entries(x.scores || {}).forEach(([k, v]) => { m[Number(k)] = { score: v.score, comment: v.comment ?? '' }; });
        setSc(m); setDirty(false);
    }, []);

    const load = useCallback(async () => {
        setError('');
        try { hydrate(await evApi.observation(id)); } catch (x) { setError(errorMessage(x)); }
    }, [id, hydrate]);
    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        const h = (ev: KeyboardEvent) => { if (ev.key === 'Escape' && !ask && !busy) close(); };
        window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
    }); // eslint-disable-line react-hooks/exhaustive-deps

    const close = () => { if (dirty && !window.confirm('Có thay đổi chưa lưu. Đóng phiếu và bỏ các thay đổi này?')) return; onClose(); };
    const o = d?.observation;
    const editable = o?.status === 'draft';
    const crit = d?.criteria ?? [];

    const plain = useMemo(() => { const m: Record<number, number | null> = {}; Object.entries(sc).forEach(([k, v]) => { m[Number(k)] = v.score; }); return m; }, [sc]);
    const live = useMemo(() => calcScore(crit, plain), [crit, plain]);
    const liveRating = rate(live, settings);
    const done = crit.filter((c) => sc[c.id]?.score !== null && sc[c.id]?.score !== undefined).length;
    const groups = useMemo(() => {
        const g: { name: string; items: typeof crit }[] = [];
        crit.forEach((c) => { let x = g.find((y) => y.name === c.group_name); if (!x) { x = { name: c.group_name, items: [] }; g.push(x); } x.items.push(c); });
        return g;
    }, [crit]);

    const setM = (k: string, v: unknown) => { setMeta((m) => ({ ...m, [k]: v })); setDirty(true); };
    const setScore = (cid: number, v: number) => { setSc((m) => ({ ...m, [cid]: { score: m[cid]?.score === v ? null : v, comment: m[cid]?.comment ?? '' } })); setDirty(true); };
    const setNote = (cid: number, t: string) => { setSc((m) => ({ ...m, [cid]: { score: m[cid]?.score ?? null, comment: t } })); setDirty(true); };

    const payload = () => {
        const scores: Record<number, { score: number; comment: string }> = {};
        Object.entries(sc).forEach(([k, v]) => { if (v.score !== null && v.score !== undefined) scores[Number(k)] = { score: v.score, comment: v.comment }; });
        return { ...meta, scores };
    };

    const save = async (silent = false) => {
        setBusy(true);
        try { const x = await evApi.saveObservation(id, payload()); hydrate(x); onChanged(); if (!silent) toast('ok', 'Đã lưu nháp phiếu dự giờ'); return true; }
        catch (x) { toast('err', errorMessage(x)); return false; } finally { setBusy(false); }
    };
    const submit = async () => {
        if (done < crit.length) { toast('err', `Còn ${crit.length - done} tiêu chí chưa chấm điểm`); return; }
        if (dirty && !(await save(true))) return;
        setBusy(true);
        try { const x = await evApi.obsAction(id, 'submit'); hydrate(x); onChanged(); toast('ok', 'Đã nộp phiếu — chuyển sang chờ giáo viên xác nhận'); }
        catch (x) { toast('err', errorMessage(x)); } finally { setBusy(false); }
    };
    const act = async (kind: 'acknowledge' | 'dispute' | 'reopen' | 'close', body: Record<string, unknown> = {}) => {
        setBusy(true);
        try {
            const x = await evApi.obsAction(id, kind, body); hydrate(x); onChanged();
            toast('ok', { acknowledge: 'Đã ghi nhận giáo viên xác nhận', dispute: 'Đã ghi nhận phản hồi của giáo viên', reopen: 'Đã mở lại phiếu để chỉnh sửa', close: 'Đã chốt phiếu dự giờ' }[kind]);
        } catch (x) { toast('err', errorMessage(x)); } finally { setBusy(false); setAsk(null); }
    };
    const del = async () => {
        setBusy(true);
        try { await evApi.deleteObservation(id); toast('ok', 'Đã xoá phiếu dự giờ'); onChanged(); onClose(); }
        catch (x) { toast('err', errorMessage(x)); setBusy(false); setAsk(null); }
    };

    const myClasses = useMemo(() => {
        const ids = new Set(lk.assignments.filter((a) => a.teacher_id === meta.teacher_id).map((a) => a.class_id));
        return lk.classes.filter((c) => ids.has(c.id));
    }, [lk, meta.teacher_id]);

    return (
        <>
            <div className={s.overlay} onClick={close} style={{ zIndex: 60 }} />
            <aside className={e.wide} role="dialog" aria-modal="true" aria-label="Phiếu dự giờ">
                <div className={e.wideHead}>
                    {o ? (
                        <>
                            <Ring value={live ?? (o.total_score ? Number(o.total_score) : null)} rating={liveRating ?? o.rating} />
                            <div className={e.grow}>
                                <div className={e.flex}>
                                    <span className={s.mono} style={{ fontWeight: 800 }}>{o.code}</span>
                                    <Tone tone={OBS_STATUS[o.status].tone}>{OBS_STATUS[o.status].label}</Tone>
                                    <RatingChip v={liveRating ?? o.rating} />
                                    <Tone tone="muted">{KIND[o.kind as Kind]}</Tone>
                                </div>
                                <h2 style={{ margin: '6px 0 2px', fontSize: 20 }}>
                                    <button className={s.linkBtn} style={{ padding: 0, font: 'inherit', fontWeight: 800, fontSize: 20, color: 'var(--text)' }} onClick={() => openTeacher(o.teacher_id)} title="Mở hồ sơ giáo viên">{o.teacher_name}</button>
                                </h2>
                                <div className={`${s.small} ${s.muted}`}>
                                    {o.subject_name || '—'} · {o.class_name ? 'Lớp ' + o.class_name : 'Chưa chọn lớp'} · {fmtDate(o.observed_on)}{o.period ? ` · Tiết ${o.period} (${periodTime(lk.periods, o.period)})` : ''} · Người dự: {o.observer_name || '—'}
                                </div>
                            </div>
                        </>
                    ) : <div className={e.grow}><Skeleton h={70} /></div>}
                    <button className={s.iconBtn} onClick={close} aria-label="Đóng"><Icon name="x" /></button>
                </div>

                <div className={e.wideBody}>
                    {error && <ErrorBox message={error} onRetry={load} />}
                    {!d && !error && <><Skeleton h={160} /><Skeleton h={320} /></>}
                    {d && o && (
                        <>
                            {!editable && (
                                <div className={e.errLine} style={{ background: 'var(--infoSoft)', color: 'var(--info)' }}>
                                    Phiếu đã nộp nên đang ở chế độ chỉ xem. Muốn chỉnh sửa điểm hãy bấm “Mở lại để sửa” ở cuối trang.
                                </div>
                            )}

                            <section className={e.sec}>
                                <h4 className={e.secTitle}><Icon name="list" size={16} /> Thông tin buổi dự giờ</h4>
                                <div className={e.form}>
                                    <div className={e.fg3}>
                                        <Field label="Giáo viên" required>
                                            <select className={e.input} disabled={!editable} value={meta.teacher_id} onChange={(x) => { setM('teacher_id', Number(x.target.value)); setM('class_id', null); }}>
                                                {lk.teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name} · {t.subject_name}</option>)}
                                            </select>
                                        </Field>
                                        <Field label="Ngày dự" required><input type="date" className={e.input} disabled={!editable} value={meta.observed_on} onChange={(x) => setM('observed_on', x.target.value)} /></Field>
                                        <Field label="Tiết">
                                            <select className={e.input} disabled={!editable} value={meta.period ?? ''} onChange={(x) => setM('period', x.target.value ? Number(x.target.value) : null)}>
                                                <option value="">—</option>{lk.periods.map((p) => <option key={p.id} value={p.id}>Tiết {p.id}</option>)}
                                            </select>
                                        </Field>
                                    </div>
                                    <div className={e.fg3}>
                                        <Field label="Hình thức">
                                            <select className={e.input} disabled={!editable} value={meta.kind} onChange={(x) => setM('kind', x.target.value)}>
                                                {Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                                            </select>
                                        </Field>
                                        <Field label="Lớp">
                                            <select className={e.input} disabled={!editable} value={meta.class_id ?? ''} onChange={(x) => setM('class_id', x.target.value ? Number(x.target.value) : null)}>
                                                <option value="">—</option>{myClasses.map((c) => <option key={c.id} value={c.id}>Lớp {c.name}</option>)}
                                            </select>
                                        </Field>
                                        <Field label="Môn">
                                            <select className={e.input} disabled={!editable} value={meta.subject_id ?? ''} onChange={(x) => setM('subject_id', x.target.value ? Number(x.target.value) : null)}>
                                                <option value="">—</option>{lk.subjects.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                                            </select>
                                        </Field>
                                    </div>
                                    <div className={e.fg3} style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
                                        <Field label="Tên bài dạy"><input className={e.input} disabled={!editable} value={meta.topic} maxLength={200} onChange={(x) => setM('topic', x.target.value)} /></Field>
                                        <Field label="Sĩ số có mặt"><input type="number" min={0} className={e.input} disabled={!editable} value={meta.students_present} onChange={(x) => setM('students_present', x.target.value)} /></Field>
                                        <Field label="Thời lượng (phút)"><input type="number" min={5} className={e.input} disabled={!editable} value={meta.duration_min} onChange={(x) => setM('duration_min', x.target.value)} /></Field>
                                    </div>
                                </div>
                            </section>

                            <section className={e.sec}>
                                <h4 className={e.secTitle}><Icon name="check" size={16} /> Chấm điểm theo tiêu chí — {o.rubric_name}</h4>
                                <div className={`${e.flex} ${e.live}`} style={{ background: 'var(--panel2)', borderRadius: 12, padding: '10px 14px', marginBottom: 6 }}>
                                    <div className={e.grow}><div className={`${s.small} ${s.muted}`} style={{ marginBottom: 5 }}>Đã chấm {done}/{crit.length} tiêu chí</div><Progress value={crit.length ? (done / crit.length) * 100 : 0} /></div>
                                    <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 800, fontSize: 18 }}>{live === null ? '—' : live.toFixed(1)} <span className={`${s.small} ${s.muted}`}>/100</span></div><div>{liveRating ? <RatingChip v={liveRating} /> : null}</div></div>
                                </div>
                                {groups.map((g) => (
                                    <div key={g.name}>
                                        <div className={e.grpHead}>{g.name}<span className={s.faint} style={{ fontWeight: 600 }}>· {g.items.length} tiêu chí</span></div>
                                        {g.items.map((c) => {
                                            const cur = sc[c.id]?.score;
                                            return (
                                                <div key={c.id} className={e.crit}>
                                                    <div>
                                                        <div className={e.critName}>{c.name} <span className={s.faint} style={{ fontWeight: 600, fontSize: 11.5 }}>(×{Number(c.weight)})</span></div>
                                                        {c.description && <div className={e.critDesc}>{c.description}</div>}
                                                    </div>
                                                    <div className={e.scoreBtns} role="group" aria-label={c.name}>
                                                        {Array.from({ length: c.max_score + 1 }, (_, v) => (
                                                            <button key={v} type="button" disabled={!editable} className={`${e.sBtn} ${cur === v ? e.on : ''}`} style={{ ['--sc' as any]: tone(v, c.max_score) }} onClick={() => setScore(c.id, v)}>{v}</button>
                                                        ))}
                                                    </div>
                                                    {(editable || sc[c.id]?.comment) && (
                                                        <input className={`${e.input} ${e.critNote}`} style={{ minHeight: 34, padding: '6px 10px' }} disabled={!editable} placeholder="Ghi chú cho tiêu chí này (không bắt buộc)" value={sc[c.id]?.comment ?? ''} maxLength={300} onChange={(x) => setNote(c.id, x.target.value)} />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                                <div className={e.hint} style={{ marginTop: 10 }}>Thang điểm: 0 = chưa đạt yêu cầu … điểm tối đa = xuất sắc. Xếp loại: Tốt ≥ {settings.rating_excellent}, Khá ≥ {settings.rating_good}, Đạt ≥ {settings.rating_pass}.</div>
                            </section>

                            <section className={e.sec}>
                                <h4 className={e.secTitle}><Icon name="pulse" size={16} /> Nhận xét của người dự giờ</h4>
                                <div className={e.form}>
                                    <Field label="Ưu điểm"><textarea className={e.input} disabled={!editable} value={meta.strengths} onChange={(x) => setM('strengths', x.target.value)} /></Field>
                                    <Field label="Hạn chế cần khắc phục"><textarea className={e.input} disabled={!editable} value={meta.weaknesses} onChange={(x) => setM('weaknesses', x.target.value)} /></Field>
                                    <Field label="Góp ý / đề xuất"><textarea className={e.input} disabled={!editable} value={meta.suggestions} onChange={(x) => setM('suggestions', x.target.value)} /></Field>
                                </div>
                            </section>

                            {(o.teacher_comment || o.status !== 'draft') && (
                                <section className={e.sec}>
                                    <h4 className={e.secTitle}><Icon name="users" size={16} /> Phản hồi của giáo viên</h4>
                                    {o.teacher_comment ? <div style={{ whiteSpace: 'pre-wrap' }}>{o.teacher_comment}</div> : <div className={s.muted}>Giáo viên chưa có ý kiến phản hồi.</div>}
                                    {o.teacher_ack_at && <div className={`${s.small} ${s.muted}`} style={{ marginTop: 6 }}>Xác nhận lúc {fmtTime(o.teacher_ack_at, true)}</div>}
                                </section>
                            )}

                            <section className={e.sec}>
                                <div className={e.flex} style={{ marginBottom: 10 }}>
                                    <h4 className={e.secTitle} style={{ margin: 0 }}><Icon name="bell" size={16} /> Kế hoạch cải tiến sau dự giờ</h4>
                                    <span className={e.right} />
                                    <button className={`${s.btn} ${s.sm}`} onClick={() => newAction({ teacher_id: o.teacher_id, observation_id: o.id, priority: (liveRating ?? o.rating) === 'fail' ? 'high' : 'normal' })}><Icon name="check" size={14} /> Giao cải tiến</button>
                                </div>
                                {d.actions.length ? d.actions.map((a) => (
                                    <div key={a.id} className={s.li}>
                                        <div className={s.liBody}><div className={s.liTitle}>{a.title}</div><div className={`${s.small} ${s.muted}`}>Hạn: {fmtDate(a.due_date)} · Giao bởi {a.assigned_by || '—'}</div></div>
                                        <Tone tone={PRIORITY[a.priority].tone}>{PRIORITY[a.priority].label}</Tone>
                                        <Tone tone={(a.overdue ? ACT_STATUS.overdue : ACT_STATUS[a.status]).tone}>{(a.overdue ? ACT_STATUS.overdue : ACT_STATUS[a.status]).label}</Tone>
                                    </div>
                                )) : <div className={s.muted}>Chưa có kế hoạch cải tiến nào gắn với phiếu này.{(liveRating ?? o.rating) && ['pass', 'fail'].includes(liveRating ?? o.rating ?? '') ? ' Phiếu xếp loại thấp nên cân nhắc giao kế hoạch bồi dưỡng.' : ''}</div>}
                            </section>

                            <section className={e.sec}>
                                <div className={e.flex} style={{ marginBottom: 10 }}>
                                    <h4 className={e.secTitle} style={{ margin: 0 }}><Icon name="fingerprint" size={16} /> Lịch sử thao tác (từ Nhật ký hệ thống)</h4>
                                    <span className={e.right} />
                                    <button className={`${s.btn} ${s.sm} ${s.ghost}`} onClick={() => router.push('/bgh/logs#activity')}><Icon name="link" size={14} /> Mở Nhật ký</button>
                                </div>
                                {d.history.length ? (
                                    <div className={s.timeline}>
                                        {d.history.map((h) => (
                                            <div key={h.id} className={s.tl}>
                                                <div style={{ fontWeight: 600 }}>{h.summary}</div>
                                                <div className={`${s.small} ${s.muted}`}>{fmtTime(h.occurred_at, true)} · {h.actor_name || 'Hệ thống'}</div>
                                            </div>
                                        ))}
                                    </div>
                                ) : <div className={s.muted}>Chưa có lịch sử.</div>}
                            </section>
                        </>
                    )}
                </div>

                {d && o && (
                    <div className={e.wideFoot}>
                        {o.status === 'draft' && <>
                            <button className={`${s.btn} ${s.danger}`} disabled={busy} onClick={() => setAsk({ kind: 'delete' })}><Icon name="trash" size={15} /> Xoá phiếu</button>
                            <span className={e.right} />
                            {dirty && <span className={`${s.small} ${s.muted}`}>Có thay đổi chưa lưu</span>}
                            <button className={s.btn} disabled={busy || !dirty} onClick={() => save()}>Lưu nháp</button>
                            <button className={`${s.btn} ${s.primary}`} disabled={busy || done < crit.length} onClick={submit} title={done < crit.length ? 'Cần chấm đủ tiêu chí' : ''}>Nộp phiếu</button>
                        </>}
                        {o.status === 'submitted' && <>
                            <button className={s.btn} disabled={busy} onClick={() => setAsk({ kind: 'reopen' })}>Mở lại để sửa</button>
                            <span className={e.right} />
                            <button className={`${s.btn} ${s.danger}`} disabled={busy} onClick={() => setAsk({ kind: 'dispute' })}>Ghi nhận phản hồi của GV</button>
                            <button className={`${s.btn} ${s.primary}`} disabled={busy} onClick={() => setAsk({ kind: 'acknowledge' })}>GV đã xác nhận</button>
                        </>}
                        {o.status === 'disputed' && <>
                            <button className={s.btn} disabled={busy} onClick={() => setAsk({ kind: 'reopen' })}>Mở lại để điều chỉnh</button>
                            <span className={e.right} />
                            <button className={`${s.btn} ${s.primary}`} disabled={busy} onClick={() => setAsk({ kind: 'acknowledge' })}>GV đã thống nhất</button>
                        </>}
                        {o.status === 'acknowledged' && <>
                            <button className={s.btn} disabled={busy} onClick={() => setAsk({ kind: 'reopen' })}>Mở lại để sửa</button>
                            <span className={e.right} />
                            <button className={`${s.btn} ${s.primary}`} disabled={busy} onClick={() => setAsk({ kind: 'close' })}>Chốt phiếu</button>
                        </>}
                        {o.status === 'closed' && <>
                            {me.user.can_admin && <button className={`${s.btn} ${s.danger}`} disabled={busy} onClick={() => setAsk({ kind: 'delete' })}><Icon name="trash" size={15} /> Xoá phiếu</button>}
                            <span className={e.right} /><span className={`${s.small} ${s.muted}`}>Phiếu đã chốt {fmtTime(o.closed_at, true)}</span>
                        </>}
                    </div>
                )}
            </aside>

            {ask?.kind === 'dispute' && <Confirm title="Ghi nhận phản hồi của giáo viên" body="Nhập nội dung giáo viên không đồng ý hoặc đề nghị xem lại. Phiếu chuyển sang trạng thái “GV có phản hồi”." input={{ label: 'Nội dung phản hồi', required: true }} confirmText="Ghi nhận" onCancel={() => setAsk(null)} onOk={(t) => act('dispute', { teacher_comment: t })} />}
            {ask?.kind === 'acknowledge' && <Confirm title="Giáo viên đã xác nhận phiếu" body="Ghi nhận giáo viên đã xem và đồng ý với kết quả dự giờ." input={{ label: 'Ý kiến của giáo viên (không bắt buộc)' }} confirmText="Ghi nhận" onCancel={() => setAsk(null)} onOk={(t) => act('acknowledge', { teacher_comment: t })} />}
            {ask?.kind === 'reopen' && <Confirm title="Mở lại phiếu để chỉnh sửa" body="Phiếu quay về bản nháp, giáo viên cần xác nhận lại sau khi nộp. Việc này được ghi vào Nhật ký." input={{ label: 'Lý do mở lại', required: true }} confirmText="Mở lại" onCancel={() => setAsk(null)} onOk={(t) => act('reopen', { reason: t })} />}
            {ask?.kind === 'close' && <Confirm title="Chốt phiếu dự giờ" body="Sau khi chốt, phiếu được tính vào đánh giá định kỳ và không nên sửa nữa." confirmText="Chốt phiếu" onCancel={() => setAsk(null)} onOk={() => act('close')} />}
            {ask?.kind === 'delete' && <Confirm title="Xoá phiếu dự giờ" danger body="Phiếu và toàn bộ điểm chi tiết sẽ bị xoá vĩnh viễn (vẫn lưu dấu vết trong Nhật ký). Lịch dự giờ liên quan quay về trạng thái chờ." confirmText="Xoá phiếu" onCancel={() => setAsk(null)} onOk={del} />}
        </>
    );
}