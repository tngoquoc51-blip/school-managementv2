'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import s from './lessonplan.module.css';
import { lessonPlans, errMsg, type Overview, type PlanRow } from '@/services/teacherLessonPlan';
import { teacherPortal } from '@/services/teacherPortal';
import PlanView from './PlanView';
import { Icon, SEM_LABEL, STATUS_LABEL, ToastProvider, fmtDow, pct, useToast } from './ui';

interface Assign { id: number; class_name: string; grade: number; subject: string }

export default function LessonPlanApp() {
    return <div className={s.app}><ToastProvider><Workspace /></ToastProvider></div>;
}

function Workspace() {
    const toast = useToast();
    const [ov, setOv] = useState<Overview | null>(null);
    const [plans, setPlans] = useState<PlanRow[]>([]);
    const [assigns, setAssigns] = useState<Assign[]>([]);
    const [cs, setCs] = useState(0);
    const [semester, setSemester] = useState(0);
    const [status, setStatus] = useState('');
    const [sel, setSel] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [cloneFrom, setCloneFrom] = useState<PlanRow | null>(null);
    const [mobileOpen, setMobileOpen] = useState(false);

    const loadOv = useCallback(async () => {
        try { const r = await lessonPlans.overview(); setOv(r.data as Overview); } catch (e) { toast.push('error', 'Không tải được tổng quan', errMsg(e)); }
    }, [toast]);

    const loadPlans = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const r = await lessonPlans.list({ class_subject_id: cs || undefined, semester: semester || undefined, status: status || undefined });
            const list = r.data as PlanRow[];
            setPlans(list);
            setSel((cur) => (cur !== null && list.some((p) => p.id === cur) ? cur : list[0]?.id ?? null));
        } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
    }, [cs, semester, status]);

    useEffect(() => { loadPlans(); }, [loadPlans]);
    useEffect(() => { loadOv(); }, [loadOv]);
    useEffect(() => { teacherPortal.assignments().then((r: any) => setAssigns((r?.data ?? []) as Assign[])).catch(() => {}); }, []);

    const refresh = () => { loadPlans(); loadOv(); };
    const kpi = ov ? [
        { label: 'Kế hoạch bài dạy', value: ov.plans.total, warn: false },
        { label: 'Đang chờ duyệt', value: ov.plans.submitted, warn: false },
        { label: 'Cần chỉnh sửa', value: ov.plans.returned, warn: ov.plans.returned > 0 },
        { label: 'Tiến độ dạy', value: `${pct(ov.progress.taught, ov.progress.lessons)}%`, warn: false },
        { label: 'Tiết đã dạy', value: `${ov.progress.taught_periods}/${ov.progress.periods}`, warn: false },
    ] : [];

    return (
        <>
            <header className={s.top}>
                <div>
                    <p className={s.eyebrow}><Icon name="book" size={14} />Cổng giáo viên</p>
                    <h1 className={s.title}>Kế hoạch bài dạy</h1>
                    <p className={s.sub}>Soạn kế hoạch theo mẫu 4 hoạt động, nộp Ban giám hiệu duyệt và theo dõi tiến độ dạy từng lớp.</p>
                </div>
                <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => setCreating(true)} disabled={assigns.length === 0}><Icon name="plus" size={16} />Tạo kế hoạch</button>
            </header>

            <section className={s.kpis} aria-label="Tổng quan">
                {kpi.length === 0
                    ? [0, 1, 2, 3, 4].map((i) => <div key={i} className={s.kpi}><b>–</b><span>Đang tải…</span></div>)
                    : kpi.map((k) => <div key={k.label} className={`${s.kpi} ${k.warn ? s.kpiWarn : ''}`}><b>{k.value}</b><span>{k.label}</span></div>)}
            </section>

            <div className={s.board}>
                <aside className={s.listPane}>
                    <div className={s.filters}>
                        <label><span className={s.srOnly}>Lớp và môn</span>
                            <select value={cs} onChange={(e) => setCs(Number(e.target.value))}>
                                <option value={0}>Tất cả lớp và môn</option>
                                {assigns.map((a) => <option key={a.id} value={a.id}>{a.class_name} – {a.subject}</option>)}
                            </select>
                        </label>
                        <div className={s.filterRow}>
                            <label><span className={s.srOnly}>Học kỳ</span>
                                <select value={semester} onChange={(e) => setSemester(Number(e.target.value))}><option value={0}>Cả năm</option><option value={1}>Học kỳ I</option><option value={2}>Học kỳ II</option></select>
                            </label>
                            <label><span className={s.srOnly}>Trạng thái</span>
                                <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Mọi trạng thái</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                            </label>
                        </div>
                    </div>

                    <div className={s.planList}>
                        {error ? (
                            <div className={s.empty} role="alert"><b>Chưa tải được danh sách</b><p>{error}</p><button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={loadPlans}>Tải lại</button></div>
                        ) : loading && plans.length === 0 ? (
                            <div aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className={s.skelCard} />)}</div>
                        ) : plans.length === 0 ? (
                            <div className={s.empty}><Icon name="doc" size={34} /><b>Chưa có kế hoạch nào</b><p>Bấm “Tạo kế hoạch” để bắt đầu cho một lớp bạn dạy.</p></div>
                        ) : plans.map((p) => (
                            <button key={p.id} type="button" className={`${s.planCard} ${sel === p.id ? s.planCardOn : ''}`} onClick={() => { setSel(p.id); setMobileOpen(true); }}>
                                <span className={s.cardTop}><span className={s.cardTitle}>{p.subject} · Lớp {p.class_name}</span><span className={`${s.badge} ${s['badge_' + p.status]}`}>{STATUS_LABEL[p.status]}</span></span>
                                <span className={s.cardMeta}>{SEM_LABEL[p.semester]}, {p.lessons} bài, {p.total_periods} tiết</span>
                                <span className={s.miniBar}><i style={{ width: `${pct(p.taught, p.lessons)}%` }} /></span>
                                <span className={s.cardMeta}>Đã dạy {p.taught}/{p.lessons} bài</span>
                            </button>
                        ))}
                    </div>

                    {ov && (ov.this_week.length > 0 || ov.returned.length > 0) && (
                        <div className={s.sideBlocks}>
                            {ov.returned.length > 0 && (
                                <details open>
                                    <summary><Icon name="alert" size={15} />Cần chỉnh sửa ({ov.returned.length})</summary>
                                    <ul>{ov.returned.map((r) => <li key={r.id}><button type="button" onClick={() => { setStatus(''); setCs(0); setSemester(0); setSel(r.id); setMobileOpen(true); }}><b>Lớp {r.class_name}</b><span>{r.review_note ?? 'Xem lịch sử để biết nội dung cần sửa.'}</span></button></li>)}</ul>
                                </details>
                            )}
                            {ov.this_week.length > 0 && (
                                <details open>
                                    <summary><Icon name="calendar" size={15} />Lịch dạy tuần này ({ov.this_week.length})</summary>
                                    <ul>{ov.this_week.map((w) => <li key={w.id}><button type="button" onClick={() => { setSel(w.plan_id); setMobileOpen(true); }}><b>{fmtDow(w.planned_date)}, lớp {w.class_name}</b><span>{w.title}</span></button></li>)}</ul>
                                </details>
                            )}
                        </div>
                    )}
                </aside>

                <div className={`${s.detailWrap} ${mobileOpen ? s.detailOpen : ''}`}>
                    {sel === null ? (
                        <div className={s.emptyPane}><Icon name="book" size={40} /><h2>Chọn một kế hoạch</h2><p>Bài học, tiến độ và lịch sử duyệt sẽ hiện ở đây.</p></div>
                    ) : (
                        <PlanView key={sel} id={sel} onChanged={refresh} onClone={setCloneFrom} onBack={() => setMobileOpen(false)} onDeleted={() => { setSel(null); setMobileOpen(false); refresh(); }} />
                    )}
                </div>
            </div>

            {creating && <CreateModal assigns={assigns} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setCs(0); setSemester(0); setStatus(''); setSel(id); setMobileOpen(true); refresh(); }} />}
            {cloneFrom && <CloneModal plan={cloneFrom} assigns={assigns} onClose={() => setCloneFrom(null)} onDone={() => { setCloneFrom(null); refresh(); }} />}
        </>
    );
}

function CreateModal({ assigns, onClose, onCreated }: { assigns: Assign[]; onClose: () => void; onCreated: (id: number) => void }) {
    const toast = useToast();
    const [cs, setCs] = useState(assigns[0]?.id ?? 0);
    const [sem, setSem] = useState(1);
    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');
    const [busy, setBusy] = useState(false);
    const a = assigns.find((x) => x.id === cs);
    const auto = a ? `Kế hoạch dạy học ${a.subject} lớp ${a.class_name} – ${SEM_LABEL[sem]}` : '';

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (!cs) { toast.push('error', 'Chưa chọn lớp và môn'); return; }
        setBusy(true);
        try {
            const r = await lessonPlans.create({ class_subject_id: cs, semester: sem, title: title.trim() || auto, description: desc.trim() || undefined });
            toast.push('success', 'Đã tạo kế hoạch', 'Hãy thêm các bài học vào kế hoạch.');
            onCreated((r.data as { id: number }).id);
        } catch (er) { toast.push('error', 'Chưa tạo được', errMsg(er)); } finally { setBusy(false); }
    };
    return (
        <div className={s.scrim} onClick={onClose}>
            <form className={s.modal} onClick={(e) => e.stopPropagation()} onSubmit={submit} role="dialog" aria-modal="true" aria-label="Tạo kế hoạch">
                <h2>Tạo kế hoạch bài dạy</h2>
                <label className={s.field}><span>Lớp và môn</span><select value={cs} onChange={(e) => setCs(Number(e.target.value))}>{assigns.map((x) => <option key={x.id} value={x.id}>{x.class_name} – {x.subject}</option>)}</select></label>
                <label className={s.field}><span>Học kỳ</span><select value={sem} onChange={(e) => setSem(Number(e.target.value))}><option value={1}>Học kỳ I</option><option value={2}>Học kỳ II</option></select></label>
                <label className={s.field}><span>Tên kế hoạch</span><input value={title} maxLength={180} placeholder={auto} onChange={(e) => setTitle(e.target.value)} /></label>
                <label className={s.field}><span>Mục tiêu chung (không bắt buộc)</span><textarea className={s.ruled} rows={3} value={desc} maxLength={3000} onChange={(e) => setDesc(e.target.value)} /></label>
                <div className={s.formActs}><button type="button" className={s.btn} onClick={onClose}>Hủy</button><button type="submit" className={`${s.btn} ${s.btnPrimary}`} disabled={busy}>{busy ? 'Đang tạo…' : 'Tạo kế hoạch'}</button></div>
            </form>
        </div>
    );
}

function CloneModal({ plan, assigns, onClose, onDone }: { plan: PlanRow; assigns: Assign[]; onClose: () => void; onDone: () => void }) {
    const toast = useToast();
    const targets = assigns.filter((a) => a.subject === plan.subject && a.id !== plan.class_subject_id);
    const [pick, setPick] = useState<number[]>([]);
    const [busy, setBusy] = useState(false);

    const go = async () => {
        if (!pick.length) { toast.push('error', 'Chưa chọn lớp nào'); return; }
        setBusy(true);
        try {
            const r = await lessonPlans.clone(plan.id, pick);
            const { created, skipped } = r.data as { created: { class_name: string }[]; skipped: { class_name?: string; reason: string }[] };
            if (created.length) toast.push('success', `Đã sao chép sang ${created.length} lớp`, created.map((c) => c.class_name).join(', '));
            if (skipped.length) toast.push('info', `${skipped.length} lớp chưa sao chép được`, skipped.map((x) => `${x.class_name ?? ''} ${x.reason}`).join(' '));
            onDone();
        } catch (e) { toast.push('error', 'Chưa sao chép được', errMsg(e)); } finally { setBusy(false); }
    };
    return (
        <div className={s.scrim} onClick={onClose}>
            <div className={s.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Sao chép kế hoạch">
                <h2>Sao chép sang lớp khác</h2>
                <p className={s.muted}>Sao chép toàn bộ bài học của “{plan.title}” sang các lớp cùng môn {plan.subject} mà bạn dạy. Kế hoạch mới ở dạng bản nháp để bạn điều chỉnh.</p>
                {targets.length === 0 ? <p className={s.notice}>Bạn không dạy lớp nào khác cùng môn này.</p> : (
                    <ul className={s.pickList}>{targets.map((t) => (
                        <li key={t.id}><label className={s.check}><input type="checkbox" checked={pick.includes(t.id)} onChange={() => setPick((p) => (p.includes(t.id) ? p.filter((x) => x !== t.id) : [...p, t.id]))} />Lớp {t.class_name}</label></li>
                    ))}</ul>
                )}
                <div className={s.formActs}><button type="button" className={s.btn} onClick={onClose}>Hủy</button><button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={go} disabled={busy || !pick.length}>{busy ? 'Đang sao chép…' : `Sao chép${pick.length ? ` (${pick.length})` : ''}`}</button></div>
            </div>
        </div>
    );
}