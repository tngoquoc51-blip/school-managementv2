'use client';
import { useMemo, useState } from 'react';
import { GROUPS, SEVERITY, toInputDT } from './constants';
import { disciplineService, errMsg } from './disciplineService';
import StudentPicker from './StudentPicker';
import type { Meta, Scope, StudentHit } from './types';
import { Field, Modal, Sev, useUI } from './ui';

export default function RecordForm({ meta, scope, preset, onClose, onSaved }: {
    meta: Meta; scope: Scope; preset?: StudentHit | null; onClose: () => void; onSaved: () => void;
}) {
    const { toast } = useUI();
    const [student, setStudent] = useState<StudentHit | null>(preset ?? null);
    const [categoryId, setCategoryId] = useState<number | ''>('');
    const [when, setWhen] = useState(toInputDT());
    const [location, setLocation] = useState('');
    const [desc, setDesc] = useState('');
    const [evidence, setEvidence] = useState('');
    const [points, setPoints] = useState<string>('');
    const [saving, setSaving] = useState(false);

    const cats = useMemo(() => meta.categories.filter((c) => c.is_active), [meta.categories]);
    const cat = cats.find((c) => c.id === categoryId);
    const deduct = points !== '' ? Number(points) : cat?.points ?? 0;
    const after = student ? Math.max(0, student.score - deduct) : null;
    const canSubmit = student && cat && desc.trim().length >= 5 && !saving;

    const submit = async () => {
        if (!student || !cat) return;
        setSaving(true);
        try {
            const r = await disciplineService.createRecord({
                student_id: student.id, category_id: cat.id, occurred_at: when, location: location || null,
                description: desc.trim(), evidence_note: evidence || null, points: points !== '' ? Number(points) : undefined, year_id: scope.yearId,
            });
            toast('success', r.status === 'approved' ? 'Đã ghi nhận và duyệt vi phạm' : 'Đã gửi biên bản chờ duyệt', `${student.full_name} – ${cat.name}`);
            onSaved(); onClose();
        } catch (e) { toast('error', 'Không lưu được biên bản', errMsg(e)); } finally { setSaving(false); }
    };

    return (
        <Modal wide title="Ghi nhận vi phạm" onClose={onClose}
               footer={<>
                   <button className="dc-btn" onClick={onClose}>Hủy</button>
                   <button className="dc-btn primary" disabled={!canSubmit} onClick={submit}>{saving ? 'Đang lưu…' : meta.permissions.approve ? 'Lưu và duyệt' : 'Gửi chờ duyệt'}</button>
               </>}>
            <Field label="Học sinh vi phạm *"><StudentPicker scope={scope} value={student} onChange={setStudent} /></Field>
            <div className="dc-grid2">
                <Field label="Lỗi vi phạm *">
                    <select className="dc-select" value={categoryId} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}>
                        <option value="">— Chọn lỗi —</option>
                        {GROUPS.map((g) => (
                            <optgroup key={g} label={g}>
                                {cats.filter((c) => c.group_name === g).map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name} (-{c.points})</option>)}
                            </optgroup>
                        ))}
                    </select>
                </Field>
                <Field label="Thời gian xảy ra *"><input type="datetime-local" className="dc-input" value={when} max={toInputDT()} onChange={(e) => setWhen(e.target.value)} /></Field>
            </div>
            {cat && (
                <div className="dc-note info" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span>Mức độ: <b>{SEVERITY[cat.severity]}</b> <Sev n={cat.severity} /></span>
                    <span>Điểm trừ mặc định: <b>-{cat.points}</b></span>
                    {after !== null && <span>Điểm rèn luyện sau khi duyệt: <b>{student!.score} → {after}</b></span>}
                </div>
            )}
            <div className="dc-grid2">
                <Field label="Địa điểm"><input className="dc-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="VD: Sân trường, phòng 12A1…" /></Field>
                <Field label="Điểm trừ (tuỳ chỉnh)" hint="Để trống để dùng điểm trừ mặc định của lỗi.">
                    <input type="number" min={0} max={100} className="dc-input" value={points} onChange={(e) => setPoints(e.target.value)} placeholder={cat ? String(cat.points) : '0'} />
                </Field>
            </div>
            <Field label="Diễn biến sự việc *" hint="Mô tả khách quan, đủ thông tin để Ban giám hiệu xem xét.">
                <textarea className="dc-textarea" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={1000} />
            </Field>
            <Field label="Minh chứng / người chứng kiến"><input className="dc-input" value={evidence} onChange={(e) => setEvidence(e.target.value)} maxLength={255} placeholder="VD: Camera sân trường, cô Lan chứng kiến…" /></Field>
        </Modal>
    );
}