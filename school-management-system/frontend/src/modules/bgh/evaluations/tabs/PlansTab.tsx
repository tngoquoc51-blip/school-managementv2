'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import s from '../../logs/logs.module.css';
import e from '../evaluations.module.css';
import { Icon } from '../../logs/components/Icons';
import { Confirm, Empty, ErrorBox, Pager, Skeleton, useAsync, useToast } from '../../logs/components/ui';
import { fmtDate } from '../../logs/format';
import { errorMessage, evApi } from '../api';
import { Avatar, Dialog, Field, SearchBox, StatTabs, Tone, useDebounced } from '../components/bits';
import { useEv } from '../components/ctx';
import { KIND, OBS_STATUS, PLAN_STATUS, iso, periodTime, today, weekdayOf } from '../format';
import type { Paged, Plan } from '../types';

export default function PlansTab() {
    const ev = useEv();
    const toast = useToast();
    const [view, setView] = useState<'list' | 'month'>('list');
    const [status, setStatus] = useState('scheduled');
    const [q, setQ] = useState(''); const dq = useDebounced(q);
    const [kind, setKind] = useState('');
    const [page, setPage] = useState(1);
    const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
    const list = useAsync<Paged<Plan>>();
    const cal = useAsync<Paged<Plan>>();
    const [postpone, setPostpone] = useState<Plan | null>(null);
    const [cancel, setCancel] = useState<Plan | null>(null);
    const [del, setDel] = useState<Plan | null>(null);
    const [edit, setEdit] = useState<Plan | null>(null);
    const [detail, setDetail] = useState<Plan | null>(null);

    const loadList = useCallback(() => list.run(() => evApi.plans({ year: ev.year, semester: ev.semester, status, q: dq, kind, page, per_page: 15 })), [ev.year, ev.semester, status, dq, kind, page]); // eslint-disable-line react-hooks/exhaustive-deps
    const loadCal = useCallback(() => {
        const from = iso(new Date(month.getFullYear(), month.getMonth(), 1)), to = iso(new Date(month.getFullYear(), month.getMonth() + 1, 0));
        return cal.run(() => evApi.plans({ year: ev.year, semester: 3, from, to, per_page: 200, status: 'all', order: 'asc', q: dq, kind }));
    }, [ev.year, month, dq, kind]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { setPage(1); }, [status, dq, kind, ev.semester]);
    useEffect(() => { if (view === 'list') loadList(); else loadCal(); }, [view, loadList, loadCal, ev.tick]);
    const refresh = () => { ev.reload(); };

    const start = async (p: Plan) => {
        try { const r = await evApi.startPlan(p.id); toast('ok', r.existing ? 'Mở phiếu dự giờ đã có' : 'Đã tạo phiếu dự giờ ' + r.code); refresh(); ev.openObs(r.observation_id); }
        catch (x) { toast('err', errorMessage(x)); }
    };
    const doDelete = async () => { if (!del) return; try { await evApi.deletePlan(del.id); toast('ok', 'Đã xoá lịch dự giờ'); setDel(null); refresh(); } catch (x) { toast('err', errorMessage(x)); setDel(null); } };
    const doCancel = async (reason: string) => { if (!cancel) return; try { await evApi.cancelPlan(cancel.id, reason); toast('ok', 'Đã huỷ lịch dự giờ'); setCancel(null); setDetail(null); refresh(); } catch (x) { toast('err', errorMessage(x)); setCancel(null); } };

    const c = list.data?.counts;
    const statusOf = (p: Plan) => (p.overdue ? 'overdue' : p.status);

    return (
        <div className={s.stack}>
            <div className={e.toolbar}>
                <div className={s.seg}>
                    <button className={view === 'list' ? s.on : ''} onClick={() => setView('list')}>Danh sách</button>
                    <button className={view === 'month' ? s.on : ''} onClick={() => setView('month')}>Lịch tháng</button>
                </div>
                <SearchBox value={q} onChange={setQ} placeholder="Tìm giáo viên, bài dạy, người dự…" />
                <select className={s.field} value={kind} onChange={(x) => setKind(x.target.value)} aria-label="Hình thức">
                    <option value="">Mọi hình thức</option>{Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <button className={`${s.btn} ${s.primary}`} onClick={() => ev.newPlan()}><Icon name="clock" size={15} /> Lên lịch dự giờ</button>
            </div>

            {view === 'list' ? (
                <>
                    <StatTabs value={status} onChange={setStatus} items={[['scheduled', 'Chờ thực hiện', c?.scheduled], ['overdue', 'Quá hạn', c?.overdue], ['done', 'Đã thực hiện', c?.done], ['cancelled', 'Đã huỷ', c?.cancelled], ['all', 'Tất cả', c?.all]]} />
                    {list.error ? <ErrorBox message={list.error} onRetry={loadList} /> : !list.data ? <Skeleton h={340} /> : list.data.items.length === 0 ? (
                        <div className={s.card}><Empty icon="clock" title="Không có lịch dự giờ phù hợp" hint="Đổi bộ lọc hoặc bấm “Lên lịch dự giờ”." /></div>
                    ) : (
                        <div className={s.card} style={{ padding: 0 }}>
                            <div className={s.tableWrap} style={{ border: 0 }}>
                                <table className={s.table}>
                                    <thead><tr><th>Ngày</th><th>Giáo viên</th><th>Lớp / Môn</th><th>Hình thức</th><th>Người dự</th><th>Trạng thái</th><th /></tr></thead>
                                    <tbody>
                                    {list.data.items.map((p) => (
                                        <tr key={p.id} onClick={() => setDetail(p)}>
                                            <td><div className={e.tdMain}>{fmtDate(p.plan_date)}</div><div className={e.tdSub}>{weekdayOf(p.plan_date)}{p.period ? ` · Tiết ${p.period} (${periodTime(ev.lk.periods, p.period)})` : ''}</div></td>
                                            <td><div className={s.who}><Avatar name={p.teacher_name} /><div><div className={e.tdMain}>{p.teacher_name}</div><div className={e.tdSub}>{p.teacher_code}</div></div></div></td>
                                            <td><div>{p.class_name ? 'Lớp ' + p.class_name : '—'}</div><div className={e.tdSub}>{p.subject_name || '—'}{p.topic ? ' · ' + p.topic : ''}</div></td>
                                            <td>{KIND[p.kind]}</td>
                                            <td>{p.observer_name || '—'}</td>
                                            <td>
                                                <Tone tone={PLAN_STATUS[statusOf(p)].tone}>{PLAN_STATUS[statusOf(p)].label}</Tone>
                                                {p.postponed_count > 0 && <div className={e.tdSub}>Đã dời {p.postponed_count} lần</div>}
                                                {p.observation_status && <div className={e.tdSub}>Phiếu: {OBS_STATUS[p.observation_status].label}</div>}
                                            </td>
                                            <td onClick={(x) => x.stopPropagation()}>
                                                <div className={e.rowActions}>
                                                    {p.observation_id ? <button className={`${s.btn} ${s.sm}`} onClick={() => ev.openObs(p.observation_id!)}>Mở phiếu</button>
                                                        : p.status === 'scheduled' ? <button className={`${s.btn} ${s.sm} ${s.primary}`} onClick={() => start(p)}>Bắt đầu dự giờ</button> : null}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                            <div style={{ padding: '0 18px 14px' }}><Pager page={list.data.page} last={list.data.last_page} total={list.data.total} per={list.data.per_page} onPage={setPage} /></div>
                        </div>
                    )}
                </>
            ) : (
                <MonthView month={month} setMonth={setMonth} plans={cal.data?.items ?? []} loading={!cal.data && !cal.error} error={cal.error} onRetry={loadCal}
                           onDay={(d) => ev.newPlan({ plan_date: d })} onPlan={setDetail} />
            )}

            {detail && (
                <Dialog title="Chi tiết lịch dự giờ" width={560} onClose={() => setDetail(null)}
                        footer={detail.status === 'scheduled' ? (<>
                            <button className={`${s.btn} ${s.danger}`} onClick={() => setDel(detail)} disabled={!!detail.observation_id}>Xoá</button>
                            <button className={s.btn} onClick={() => setCancel(detail)}>Huỷ lịch</button>
                            <button className={s.btn} onClick={() => setPostpone(detail)}>Dời lịch</button>
                            <button className={s.btn} onClick={() => { setEdit(detail); setDetail(null); }}>Sửa</button>
                            {detail.observation_id ? <button className={`${s.btn} ${s.primary}`} onClick={() => { ev.openObs(detail.observation_id!); setDetail(null); }}>Mở phiếu</button>
                                : <button className={`${s.btn} ${s.primary}`} onClick={() => { start(detail); setDetail(null); }}>Bắt đầu dự giờ</button>}
                        </>) : (detail.observation_id ? <button className={`${s.btn} ${s.primary}`} onClick={() => { ev.openObs(detail.observation_id!); setDetail(null); }}>Mở phiếu dự giờ</button> : undefined)}>
                    <div className={e.cover} style={{ marginBottom: 14 }}>
                        <Avatar name={detail.teacher_name} big />
                        <div><div style={{ fontWeight: 800, fontSize: 17 }}>{detail.teacher_name}</div><div className={s.muted}>{detail.subject_name || '—'} · {detail.teacher_code}</div></div>
                        <span className={e.right}><Tone tone={PLAN_STATUS[statusOf(detail)].tone}>{PLAN_STATUS[statusOf(detail)].label}</Tone></span>
                    </div>
                    <dl className={s.kv}>
                        <dt>Ngày dự</dt><dd>{fmtDate(detail.plan_date)} ({weekdayOf(detail.plan_date)}){detail.period ? ` · Tiết ${detail.period} (${periodTime(ev.lk.periods, detail.period)})` : ''}</dd>
                        <dt>Lớp</dt><dd>{detail.class_name ? 'Lớp ' + detail.class_name : '—'}</dd>
                        <dt>Bài dạy</dt><dd>{detail.topic || '—'}</dd>
                        <dt>Hình thức</dt><dd>{KIND[detail.kind]}</dd>
                        <dt>Mẫu phiếu</dt><dd>{detail.rubric_name || '—'}</dd>
                        <dt>Người dự</dt><dd>{detail.observer_name || '—'}</dd>
                        {detail.note && <><dt>Ghi chú</dt><dd>{detail.note}</dd></>}
                        {detail.cancel_reason && <><dt>Lý do huỷ</dt><dd>{detail.cancel_reason}</dd></>}
                    </dl>
                    <button className={`${s.btn} ${s.sm} ${s.ghost}`} style={{ marginTop: 12 }} onClick={() => { ev.openTeacher(detail.teacher_id); setDetail(null); }}><Icon name="users" size={14} /> Hồ sơ giáo viên</button>
                </Dialog>
            )}
            {edit && <EditHost plan={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); refresh(); }} />}
            {postpone && <PostponeDialog plan={postpone} onClose={() => setPostpone(null)} onDone={() => { setPostpone(null); setDetail(null); refresh(); }} />}
            {cancel && <Confirm title="Huỷ lịch dự giờ" body={`Huỷ lịch dự giờ ${cancel.teacher_name} ngày ${fmtDate(cancel.plan_date)}?`} input={{ label: 'Lý do huỷ', required: true }} confirmText="Huỷ lịch" danger onCancel={() => setCancel(null)} onOk={doCancel} />}
            {del && <Confirm title="Xoá lịch dự giờ" danger body="Lịch sẽ bị xoá hẳn. Nếu chỉ không dự được nữa, nên chọn “Huỷ lịch” để còn lưu vết." confirmText="Xoá" onCancel={() => setDel(null)} onOk={() => { doDelete(); setDetail(null); }} />}
        </div>
    );
}

import PlanDialog from '../components/PlanDialog';
function EditHost({ plan, onClose, onSaved }: { plan: Plan; onClose: () => void; onSaved: () => void }) { return <PlanDialog plan={plan} onClose={onClose} onSaved={onSaved} />; }

function PostponeDialog({ plan, onClose, onDone }: { plan: Plan; onClose: () => void; onDone: () => void }) {
    const { lk } = useEv(); const toast = useToast();
    const [f, setF] = useState({ plan_date: plan.plan_date, period: plan.period as number | null, reason: '' });
    const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
    const go = async () => { setBusy(true); setErr(''); try { await evApi.postponePlan(plan.id, f); toast('ok', 'Đã dời lịch dự giờ'); onDone(); } catch (x) { setErr(errorMessage(x)); } finally { setBusy(false); } };
    return (
        <Dialog title={`Dời lịch dự giờ — ${plan.teacher_name}`} width={520} onClose={onClose} busy={busy}
                footer={<><button className={s.btn} onClick={onClose}>Đóng</button><button className={`${s.btn} ${s.primary}`} disabled={busy} onClick={go}>Dời lịch</button></>}>
            <div className={e.form}>
                {err && <div className={e.errLine}>{err}</div>}
                <div className={e.fg2}>
                    <Field label="Ngày mới" required><input type="date" className={e.input} value={f.plan_date} onChange={(x) => setF({ ...f, plan_date: x.target.value })} /></Field>
                    <Field label="Tiết"><select className={e.input} value={f.period ?? ''} onChange={(x) => setF({ ...f, period: x.target.value ? Number(x.target.value) : null })}><option value="">—</option>{lk.periods.map((p) => <option key={p.id} value={p.id}>Tiết {p.id}</option>)}</select></Field>
                </div>
                <Field label="Lý do dời lịch" required><input className={e.input} value={f.reason} onChange={(x) => setF({ ...f, reason: x.target.value })} placeholder="VD: Giáo viên nghỉ ốm, trùng lịch kiểm tra…" /></Field>
            </div>
        </Dialog>
    );
}

function MonthView({ month, setMonth, plans, loading, error, onRetry, onDay, onPlan }: {
    month: Date; setMonth: (d: Date) => void; plans: Plan[]; loading: boolean; error: string; onRetry: () => void; onDay: (d: string) => void; onPlan: (p: Plan) => void;
}) {
    const cells = useMemo(() => {
        const first = new Date(month.getFullYear(), month.getMonth(), 1);
        const offset = (first.getDay() + 6) % 7; // thứ Hai đầu tuần
        const start = new Date(first); start.setDate(1 - offset);
        return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
    }, [month]);
    const by = useMemo(() => { const m: Record<string, Plan[]> = {}; plans.forEach((p) => { (m[p.plan_date] ||= []).push(p); }); return m; }, [plans]);
    const t = today();
    const tone = (p: Plan) => (p.overdue ? 'crit' : PLAN_STATUS[p.status].tone);
    return (
        <div className={s.card}>
            <div className={e.flex} style={{ marginBottom: 12 }}>
                <button className={s.iconBtn} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Tháng trước"><Icon name="back" /></button>
                <h3 style={{ margin: 0, minWidth: 150, textAlign: 'center' }}>Tháng {month.getMonth() + 1}/{month.getFullYear()}</h3>
                <button className={s.iconBtn} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Tháng sau" style={{ transform: 'scaleX(-1)' }}><Icon name="back" /></button>
                <button className={`${s.btn} ${s.sm}`} onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Hôm nay</button>
                <span className={e.right} />
                <Legend3 />
            </div>
            {error ? <ErrorBox message={error} onRetry={onRetry} /> : (
                <div className={e.cal} style={loading ? { opacity: .5 } : undefined}>
                    {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => <div key={d} className={e.calHead}>{d}</div>)}
                    {cells.map((d) => {
                        const k = iso(d), items = by[k] || [], out = d.getMonth() !== month.getMonth();
                        return (
                            <div key={k} className={`${e.calDay} ${out ? e.out : ''} ${k === t ? e.today : ''}`} onClick={() => onDay(k)} role="button" aria-label={`Ngày ${k}`}>
                                <div className={e.calNum}><span>{d.getDate()}</span>{items.length > 0 && <span className={s.faint}>{items.length}</span>}</div>
                                {items.slice(0, 3).map((p) => (
                                    <button key={p.id} className={`${e.calItem} ${e['c_' + tone(p)]}`} onClick={(x) => { x.stopPropagation(); onPlan(p); }} title={`${p.teacher_name} — ${KIND[p.kind]}`}>
                                        {p.period ? `T${p.period} ` : ''}{p.teacher_name.split(' ').slice(-2).join(' ')}
                                    </button>
                                ))}
                                {items.length > 3 && <div className={e.calMore}>+{items.length - 3} lịch nữa</div>}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
function Legend3() {
    return <div className={s.legend}><span><i style={{ background: 'var(--info)' }} />Chờ</span><span><i style={{ background: 'var(--ok)' }} />Đã dự</span><span><i style={{ background: 'var(--crit)' }} />Quá hạn</span><span><i style={{ background: 'var(--muted)' }} />Huỷ</span></div>;
}