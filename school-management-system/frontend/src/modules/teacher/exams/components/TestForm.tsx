'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/modules/homeroom/awards/components/Overlay';
import { useToast } from '@/modules/homeroom/awards/components/Toast';
import { Field } from '@/modules/homeroom/awards/components/ui';
import { errMsg, examApi } from '../examsService';
import type { Meta, PaperRow, TestFormState } from '../types';
import { kindLabel } from './shared';

export function emptyTest(meta: Meta, preset?: Partial<TestFormState>): TestFormState {
    const a = meta.assignments.find((x) => x.class_id === preset?.class_id && x.subject_id === preset?.subject_id) ?? meta.assignments[0];
    return {
        class_id: a?.class_id ?? 0, subject_id: a?.subject_id ?? 0, title: '', kind: 'tx15', grade_column: 'tx1',
        test_date: meta.today < meta.school_year.start_date ? meta.school_year.start_date : meta.today > meta.school_year.end_date ? meta.school_year.end_date : meta.today,
        start_time: '07:30', duration_minutes: 15, max_score: 10, paper_id: null, note: '', status: 'scheduled', ...preset,
    };
}

export default function TestForm({ meta, initial, onClose, onSaved }: {
    meta: Meta; initial: TestFormState | null; onClose: () => void; onSaved: () => void;
}) {
    const toast = useToast();
    const [f, setF] = useState<TestFormState | null>(initial);
    const [papers, setPapers] = useState<PaperRow[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => { setF(initial); }, [initial]);
    useEffect(() => { if (initial) examApi.papers().then(setPapers).catch(() => undefined); }, [initial]);

    const kind = useMemo(() => meta.kinds.find((k) => k.key === f?.kind), [meta.kinds, f?.kind]);
    if (!f) return <Modal open={false} onClose={onClose} title="" children={null} />;

    const editing = !!f.id;
    const set = (p: Partial<TestFormState>) => setF((s) => (s ? { ...s, ...p } : s));
    const asg = meta.assignments.find((a) => a.class_id === f.class_id && a.subject_id === f.subject_id);
    const myPapers = papers.filter((p) => p.subject_id === f.subject_id);

    const pickKind = (k: string) => {
        const def = meta.kinds.find((x) => x.key === k)!;
        set({ kind: k, grade_column: def.columns.includes(f.grade_column) ? f.grade_column : def.columns[0], duration_minutes: def.minutes });
    };

    const save = async () => {
        if (!f.title.trim()) { toast.warning('Thiếu tên bài', 'Hãy nhập tên bài kiểm tra.'); return; }
        setSaving(true);
        try {
            const body = {
                title: f.title.trim(), kind: f.kind, grade_column: f.grade_column, test_date: f.test_date, start_time: f.start_time || null,
                duration_minutes: Number(f.duration_minutes), max_score: Number(f.max_score), paper_id: f.paper_id, note: f.note, status: f.status,
            };
            if (editing) await examApi.updateTest(f.id!, body); else await examApi.createTest({ ...body, class_id: f.class_id, subject_id: f.subject_id });
            toast.success(editing ? 'Đã cập nhật bài kiểm tra' : 'Đã tạo bài kiểm tra', f.title);
            onSaved();
        } catch (e) { toast.error('Không lưu được', errMsg(e)); }
        finally { setSaving(false); }
    };

    return (
        <Modal open onClose={onClose} width={640} title={editing ? 'Sửa bài kiểm tra' : 'Tạo bài kiểm tra'} subtitle={asg ? `${asg.subject_name} · lớp ${asg.class_name}` : ''}
               footer={<><button className="emu-btn" onClick={onClose}>Hủy</button><button className="emu-btn primary" disabled={saving} onClick={save}>{saving ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Tạo bài'}</button></>}>
            <Field label="Lớp – Môn học">
                <select className="emu-select" disabled={editing} value={`${f.class_id}:${f.subject_id}`} onChange={(e) => { const [c, s] = e.target.value.split(':').map(Number); set({ class_id: c, subject_id: s, paper_id: null }); }}>
                    {meta.assignments.map((a) => <option key={a.cs_id} value={`${a.class_id}:${a.subject_id}`}>Lớp {a.class_name} — {a.subject_name}</option>)}
                </select>
            </Field>
            <Field label="Tên bài kiểm tra"><input className="emu-input" maxLength={150} value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder={`VD: ${kindLabel(meta, f.kind)} lần 1`} autoFocus /></Field>
            <div className="emu-grid emu-g2">
                <Field label="Loại bài"><select className="emu-select" value={f.kind} onChange={(e) => pickKind(e.target.value)}>{meta.kinds.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select></Field>
                <Field label="Ghi vào cột điểm" hint="Cột tương ứng trong sổ điểm khi đồng bộ"><select className="emu-select" value={f.grade_column} onChange={(e) => set({ grade_column: e.target.value })}>{kind?.columns.map((c) => <option key={c} value={c}>{meta.columns[c]}</option>)}</select></Field>
            </div>
            <div className="emu-grid emu-g3">
                <Field label="Ngày kiểm tra"><input type="date" className="emu-input" min={meta.school_year.start_date} max={meta.school_year.end_date} value={f.test_date} onChange={(e) => set({ test_date: e.target.value })} /></Field>
                <Field label="Giờ bắt đầu"><input type="time" className="emu-input" value={f.start_time} onChange={(e) => set({ start_time: e.target.value })} /></Field>
                <Field label="Thời lượng (phút)"><input type="number" className="emu-input" min={5} max={240} value={f.duration_minutes} onChange={(e) => set({ duration_minutes: Number(e.target.value) })} /></Field>
            </div>
            <div className="emu-grid emu-g2">
                <Field label="Thang điểm tối đa" hint="Điểm sẽ được quy về thang 10 khi đồng bộ"><input type="number" className="emu-input" min={1} max={100} step={0.5} value={f.max_score} onChange={(e) => set({ max_score: Number(e.target.value) })} /></Field>
                <Field label="Gắn với đề đã soạn" hint={myPapers.length ? undefined : 'Chưa có đề cho môn này'}>
                    <select className="emu-select" value={f.paper_id ?? ''} onChange={(e) => set({ paper_id: e.target.value ? Number(e.target.value) : null })}>
                        <option value="">Không gắn đề</option>{myPapers.map((p) => <option key={p.id} value={p.id}>{p.title} ({p.question_count} câu)</option>)}
                    </select>
                </Field>
            </div>
            <Field label="Ghi chú"><textarea className="emu-textarea" maxLength={255} value={f.note} onChange={(e) => set({ note: e.target.value })} /></Field>
            {!editing && <label className="emu-row" style={{ cursor: 'pointer' }}><input type="checkbox" className="emu-check" checked={f.status === 'draft'} onChange={(e) => set({ status: e.target.checked ? 'draft' : 'scheduled' })} /> Lưu dạng nháp (chưa công bố lịch)</label>}
        </Modal>
    );
}