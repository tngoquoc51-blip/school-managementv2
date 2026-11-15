'use client';

import { useEffect, useMemo, useState } from 'react';
import s from '../../logs/logs.module.css';
import e from '../evaluations.module.css';
import { errorMessage, evApi } from '../api';
import { KIND, periodTime, today, weekdayOf } from '../format';
import type { Kind, Plan } from '../types';
import { Dialog, Field } from './bits';
import { useEv } from './ctx';
import { useToast } from '../../logs/components/ui';

/** Thêm / sửa lịch dự giờ. Gợi ý tiết dạy từ Thời khoá biểu của giáo viên (liên kết phân hệ Học vụ). */
export default function PlanDialog({ plan, prefill, onClose, onSaved }: {
    plan?: Plan | null; prefill?: Partial<{ teacher_id: number; plan_date: string; kind: string }>; onClose: () => void; onSaved: (p: Plan) => void;
}) {
    const { lk, settings, me } = useEv();
    const toast = useToast();
    const [f, setF] = useState({
        teacher_id: plan?.teacher_id ?? prefill?.teacher_id ?? 0,
        plan_date: plan?.plan_date ?? prefill?.plan_date ?? today(),
        period: plan?.period ?? (null as number | null),
        kind: (plan?.kind ?? prefill?.kind ?? 'planned') as Kind,
        topic: plan?.topic ?? '', class_id: plan?.class_id ?? (null as number | null), subject_id: plan?.subject_id ?? (null as number | null),
        rubric_id: plan?.rubric_id ?? Number(settings.default_rubric_id) ?? null, observer_name: plan?.observer_name ?? me.user.full_name, note: plan?.note ?? '',
    });
    const [slots, setSlots] = useState<{ period: number; class_id: number; class_name: string; subject_id: number; subject_name: string }[]>([]);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const set = (k: string, v: unknown) => setF((o) => ({ ...o, [k]: v }));

    useEffect(() => {
        if (!f.teacher_id || !f.plan_date) { setSlots([]); return; }
        let live = true;
        evApi.slots(f.teacher_id, f.plan_date).then((r) => live && setSlots(r)).catch(() => live && setSlots([]));
        return () => { live = false; };
    }, [f.teacher_id, f.plan_date]);

    const teacher = lk.teachers.find((t) => t.id === f.teacher_id);
    const myClasses = useMemo(() => {
        const ids = new Set(lk.assignments.filter((a) => a.teacher_id === f.teacher_id).map((a) => a.class_id));
        return lk.classes.filter((c) => ids.has(c.id));
    }, [lk, f.teacher_id]);

    const pickTeacher = (id: number) => {
        const t = lk.teachers.find((x) => x.id === id);
        setF((o) => ({ ...o, teacher_id: id, class_id: null, subject_id: t?.main_subject_id ?? null, period: null }));
    };
    const pickClass = (id: number | null) => {
        const a = lk.assignments.find((x) => x.teacher_id === f.teacher_id && x.class_id === id);
        setF((o) => ({ ...o, class_id: id, subject_id: a?.subject_id ?? o.subject_id }));
    };
    const pickSlot = (sl: (typeof slots)[number]) => setF((o) => ({ ...o, period: sl.period, class_id: sl.class_id, subject_id: sl.subject_id }));

    const save = async () => {
        if (!f.teacher_id) return setErr('Hãy chọn giáo viên được dự giờ');
        setBusy(true); setErr('');
        try {
            const p = await evApi.savePlan(plan?.id ?? null, f);
            toast('ok', plan ? 'Đã cập nhật lịch dự giờ' : 'Đã lên lịch dự giờ');
            onSaved(p);
        } catch (x) { setErr(errorMessage(x)); } finally { setBusy(false); }
    };

    return (
        <Dialog title={plan ? 'Sửa lịch dự giờ' : 'Lên lịch dự giờ'} width={680} onClose={onClose} busy={busy}
                footer={<><button className={s.btn} onClick={onClose} disabled={busy}>Huỷ</button><button className={`${s.btn} ${s.primary}`} onClick={save} disabled={busy}>{busy ? 'Đang lưu…' : plan ? 'Lưu thay đổi' : 'Lên lịch'}</button></>}>
            <div className={e.form}>
                {err && <div className={e.errLine}>{err}</div>}
                <Field label="Giáo viên được dự giờ" required>
                    <select className={e.input} value={f.teacher_id} onChange={(x) => pickTeacher(Number(x.target.value))}>
                        <option value={0}>— Chọn giáo viên —</option>
                        {lk.teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name} · {t.code} · {t.subject_name}</option>)}
                    </select>
                </Field>
                <div className={e.fg3}>
                    <Field label="Ngày dự" required hint={f.plan_date ? 'Thứ: ' + weekdayOf(f.plan_date) : undefined}>
                        <input type="date" className={e.input} value={f.plan_date} onChange={(x) => set('plan_date', x.target.value)} />
                    </Field>
                    <Field label="Tiết" hint={f.period ? periodTime(lk.periods, f.period) : undefined}>
                        <select className={e.input} value={f.period ?? ''} onChange={(x) => set('period', x.target.value ? Number(x.target.value) : null)}>
                            <option value="">Chưa xác định</option>
                            {lk.periods.map((p) => <option key={p.id} value={p.id}>Tiết {p.id} ({p.start_time.slice(0, 5)})</option>)}
                        </select>
                    </Field>
                    <Field label="Hình thức" required>
                        <select className={e.input} value={f.kind} onChange={(x) => set('kind', x.target.value)}>
                            {Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        </select>
                    </Field>
                </div>
                {f.teacher_id > 0 && (
                    <div>
                        <label className={e.lbl}>Tiết dạy của {teacher?.full_name} ngày {weekdayOf(f.plan_date)} (theo Thời khoá biểu)</label>
                        {slots.length ? (
                            <div className={e.chipPick}>
                                {slots.map((sl) => (
                                    <button key={sl.period + '-' + sl.class_id} type="button" className={`${e.chipBtn} ${f.period === sl.period && f.class_id === sl.class_id ? e.on : ''}`} onClick={() => pickSlot(sl)}>
                                        Tiết {sl.period} · {sl.class_name} · {sl.subject_name}
                                    </button>
                                ))}
                            </div>
                        ) : <div className={e.hint}>Ngày này giáo viên không có tiết dạy trong TKB (hoặc là Chủ nhật).</div>}
                    </div>
                )}
                <div className={e.fg2}>
                    <Field label="Lớp">
                        <select className={e.input} value={f.class_id ?? ''} onChange={(x) => pickClass(x.target.value ? Number(x.target.value) : null)}>
                            <option value="">Chưa chọn</option>
                            {myClasses.map((c) => <option key={c.id} value={c.id}>Lớp {c.name}</option>)}
                        </select>
                    </Field>
                    <Field label="Môn">
                        <select className={e.input} value={f.subject_id ?? ''} onChange={(x) => set('subject_id', x.target.value ? Number(x.target.value) : null)}>
                            <option value="">Chưa chọn</option>
                            {lk.subjects.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </Field>
                </div>
                <Field label="Tên bài / nội dung dự giờ"><input className={e.input} value={f.topic ?? ''} maxLength={200} onChange={(x) => set('topic', x.target.value)} placeholder="VD: Bài 12 — Hàm số bậc hai" /></Field>
                <div className={e.fg2}>
                    <Field label="Mẫu phiếu đánh giá">
                        <select className={e.input} value={f.rubric_id ?? ''} onChange={(x) => set('rubric_id', Number(x.target.value))}>
                            {lk.rubrics.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.criteria_count} tiêu chí)</option>)}
                        </select>
                    </Field>
                    <Field label="Người dự giờ"><input className={e.input} value={f.observer_name ?? ''} maxLength={120} onChange={(x) => set('observer_name', x.target.value)} /></Field>
                </div>
                <Field label="Ghi chú"><textarea className={e.input} value={f.note ?? ''} maxLength={500} onChange={(x) => set('note', x.target.value)} /></Field>
            </div>
        </Dialog>
    );
}