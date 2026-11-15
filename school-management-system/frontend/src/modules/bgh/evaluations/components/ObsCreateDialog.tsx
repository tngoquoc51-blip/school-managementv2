'use client';

import { useState } from 'react';
import s from '../../logs/logs.module.css';
import e from '../evaluations.module.css';
import { errorMessage, evApi } from '../api';
import { KIND, today } from '../format';
import { Dialog, Field } from './bits';
import { useEv } from './ctx';
import { useToast } from '../../logs/components/ui';

/** Mở phiếu dự giờ độc lập (không cần lịch trước — dự giờ đột xuất). */
export default function ObsCreateDialog({ prefill, onClose, onCreated }: { prefill?: { teacher_id?: number }; onClose: () => void; onCreated: (id: number) => void }) {
    const { lk, settings } = useEv();
    const toast = useToast();
    const [f, setF] = useState({ teacher_id: prefill?.teacher_id ?? 0, observed_on: today(), kind: 'surprise', period: null as number | null, rubric_id: Number(settings.default_rubric_id), topic: '' });
    const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
    const set = (k: string, v: unknown) => setF((o) => ({ ...o, [k]: v }));
    const t = lk.teachers.find((x) => x.id === f.teacher_id);
    const go = async () => {
        if (!f.teacher_id) return setErr('Hãy chọn giáo viên');
        setBusy(true); setErr('');
        try {
            const r = await evApi.createObservation({ ...f, subject_id: t?.main_subject_id ?? null });
            toast('ok', 'Đã tạo phiếu dự giờ ' + r.observation.code); onCreated(r.observation.id);
        } catch (x) { setErr(errorMessage(x)); } finally { setBusy(false); }
    };
    return (
        <Dialog title="Mở phiếu dự giờ mới" onClose={onClose} busy={busy}
                footer={<><button className={s.btn} onClick={onClose} disabled={busy}>Huỷ</button><button className={`${s.btn} ${s.primary}`} onClick={go} disabled={busy}>{busy ? 'Đang tạo…' : 'Tạo & bắt đầu chấm'}</button></>}>
            <div className={e.form}>
                {err && <div className={e.errLine}>{err}</div>}
                <Field label="Giáo viên" required>
                    <select className={e.input} value={f.teacher_id} onChange={(x) => set('teacher_id', Number(x.target.value))}>
                        <option value={0}>— Chọn giáo viên —</option>{lk.teachers.map((x) => <option key={x.id} value={x.id}>{x.full_name} · {x.subject_name}</option>)}
                    </select>
                </Field>
                <div className={e.fg3}>
                    <Field label="Ngày dự" required><input type="date" className={e.input} value={f.observed_on} onChange={(x) => set('observed_on', x.target.value)} /></Field>
                    <Field label="Tiết"><select className={e.input} value={f.period ?? ''} onChange={(x) => set('period', x.target.value ? Number(x.target.value) : null)}><option value="">—</option>{lk.periods.map((p) => <option key={p.id} value={p.id}>Tiết {p.id}</option>)}</select></Field>
                    <Field label="Hình thức" required><select className={e.input} value={f.kind} onChange={(x) => set('kind', x.target.value)}>{Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
                </div>
                <Field label="Mẫu phiếu"><select className={e.input} value={f.rubric_id} onChange={(x) => set('rubric_id', Number(x.target.value))}>{lk.rubrics.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.criteria_count} tiêu chí)</option>)}</select></Field>
                <Field label="Tên bài dạy"><input className={e.input} value={f.topic} onChange={(x) => set('topic', x.target.value)} /></Field>
            </div>
        </Dialog>
    );
}