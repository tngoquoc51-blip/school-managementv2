'use client';

import { useState } from 'react';
import s from '../../logs/logs.module.css';
import e from '../evaluations.module.css';
import { errorMessage, evApi } from '../api';
import type { Action } from '../types';
import { Dialog, Field } from './bits';
import { useEv } from './ctx';
import { useToast } from '../../logs/components/ui';

export default function ActionDialog({ action, prefill, onClose, onSaved }: {
    action?: Action | null; prefill?: { teacher_id?: number; observation_id?: number | null; title?: string; priority?: string }; onClose: () => void; onSaved: () => void;
}) {
    const { lk } = useEv();
    const toast = useToast();
    const [f, setF] = useState({
        teacher_id: action?.teacher_id ?? prefill?.teacher_id ?? 0, observation_id: action?.observation_id ?? prefill?.observation_id ?? null,
        title: action?.title ?? prefill?.title ?? '', detail: action?.detail ?? '', priority: action?.priority ?? prefill?.priority ?? 'normal', due_date: action?.due_date ?? '',
    });
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const set = (k: string, v: unknown) => setF((o) => ({ ...o, [k]: v }));
    const quick = (d: number) => { const t = new Date(); t.setDate(t.getDate() + d); set('due_date', `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`); };
    const save = async () => {
        setBusy(true); setErr('');
        try { await evApi.saveAction(action?.id ?? null, f); toast('ok', action ? 'Đã cập nhật kế hoạch cải tiến' : 'Đã giao kế hoạch cải tiến'); onSaved(); }
        catch (x) { setErr(errorMessage(x)); } finally { setBusy(false); }
    };
    const SUGGEST = ['Dự giờ lại sau 2 tuần', 'Dự giờ học hỏi đồng nghiệp cùng tổ', 'Sinh hoạt chuyên đề đổi mới phương pháp', 'Bồi dưỡng ứng dụng CNTT trong dạy học', 'Rà soát và hoàn thiện kế hoạch bài dạy'];
    return (
        <Dialog title={action ? 'Sửa kế hoạch cải tiến' : 'Giao kế hoạch cải tiến / bồi dưỡng'} onClose={onClose} busy={busy}
                footer={<><button className={s.btn} onClick={onClose} disabled={busy}>Huỷ</button><button className={`${s.btn} ${s.primary}`} onClick={save} disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu'}</button></>}>
            <div className={e.form}>
                {err && <div className={e.errLine}>{err}</div>}
                <Field label="Giáo viên" required>
                    <select className={e.input} value={f.teacher_id} disabled={!!action} onChange={(x) => set('teacher_id', Number(x.target.value))}>
                        <option value={0}>— Chọn giáo viên —</option>
                        {lk.teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name} · {t.subject_name}</option>)}
                    </select>
                </Field>
                <Field label="Nội dung cần thực hiện" required>
                    <input className={e.input} value={f.title} maxLength={200} onChange={(x) => set('title', x.target.value)} />
                    {!action && <div className={e.chipPick} style={{ marginTop: 8 }}>{SUGGEST.map((t) => <button key={t} type="button" className={e.chipBtn} onClick={() => set('title', t)}>{t}</button>)}</div>}
                </Field>
                <Field label="Hướng dẫn chi tiết"><textarea className={e.input} value={f.detail ?? ''} onChange={(x) => set('detail', x.target.value)} /></Field>
                <div className={e.fg2}>
                    <Field label="Mức ưu tiên" required>
                        <select className={e.input} value={f.priority} onChange={(x) => set('priority', x.target.value)}>
                            <option value="low">Thấp</option><option value="normal">Bình thường</option><option value="high">Cao</option>
                        </select>
                    </Field>
                    <Field label="Hạn hoàn thành">
                        <input type="date" className={e.input} value={f.due_date ?? ''} onChange={(x) => set('due_date', x.target.value)} />
                        <div className={e.chipPick} style={{ marginTop: 6 }}>{[[7, '1 tuần'], [14, '2 tuần'], [30, '1 tháng']].map(([d, l]) => <button key={d} type="button" className={e.chipBtn} onClick={() => quick(Number(d))}>+{l}</button>)}</div>
                    </Field>
                </div>
                {f.observation_id && <div className={e.hint}>Gắn với phiếu dự giờ #{f.observation_id}</div>}
            </div>
        </Dialog>
    );
}