'use client';

import { useEffect, useState } from 'react';
import cat from '@/modules/admin/categories/categories.module.css';
import { getErrorMessage, getFieldErrors } from '@/modules/admin/categories/catalogApi';
import { useFeedback } from '@/modules/admin/categories/components/Feedback';
import Icon from '@/modules/admin/categories/components/Icon';
import { Modal } from '@/modules/admin/categories/components/ui';
import { GRADES } from '../constants';
import { rosterApi } from '../rosterApi';
import type { ClassRow, Teacher } from '../types';

export default function ClassFormModal({ open, yearId, editing, teachers, onClose, onSaved }: { open: boolean; yearId: number; editing: ClassRow | null; teachers: Teacher[]; onClose: () => void; onSaved: (id: number) => void }) {
    const fb = useFeedback();
    const [grade, setGrade] = useState(10);
    const [name, setName] = useState('');
    const [teacher, setTeacher] = useState('');
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) return;
        setErrors({}); setBusy(false);
        setGrade(editing?.grade ?? 10); setName(editing?.name ?? ''); setTeacher(editing?.homeroom_teacher_id ? String(editing.homeroom_teacher_id) : '');
    }, [open, editing]);

    const submit = async () => {
        setBusy(true); setErrors({});
        const body = { grade, name: name.trim(), homeroom_teacher_id: teacher ? Number(teacher) : null };
        try {
            const res = editing ? await rosterApi.updateClass(editing.id, body) : await rosterApi.createClass({ ...body, school_year_id: yearId });
            fb.success(editing ? 'Đã cập nhật lớp' : 'Đã tạo lớp mới', body.name);
            onSaved(res.class.id);
        } catch (e) { setErrors(getFieldErrors(e)); fb.error('Chưa lưu được', getErrorMessage(e)); } finally { setBusy(false); }
    };

    return (
        <Modal open={open} title={editing ? `Sửa lớp ${editing.name}` : 'Thêm lớp học'} onClose={onClose}>
            <div className={cat.formGrid}>
                <div className={cat.field}>
                    <label htmlFor="cf-grade">Khối<em>*</em></label>
                    <select id="cf-grade" value={grade} onChange={(e) => setGrade(Number(e.target.value))}>{GRADES.map((g) => <option key={g} value={g}>Khối {g}</option>)}</select>
                </div>
                <div className={`${cat.field} ${errors.name ? cat.fieldError : ''}`}>
                    <label htmlFor="cf-name">Tên lớp<em>*</em></label>
                    <input id="cf-name" value={name} maxLength={10} placeholder="VD: 10A1" onChange={(e) => setName(e.target.value.toUpperCase())} autoComplete="off" />
                    {errors.name && <small className={cat.fieldMsg}>{errors.name[0]}</small>}
                </div>
                <div className={`${cat.field} ${cat.fieldWide}`}>
                    <label htmlFor="cf-teacher">Giáo viên chủ nhiệm</label>
                    <select id="cf-teacher" value={teacher} onChange={(e) => setTeacher(e.target.value)}>
                        <option value="">Chưa phân công</option>
                        {teachers.map((t) => {
                            const taken = t.homeroom_of && t.id !== editing?.homeroom_teacher_id;
                            return <option key={t.id} value={t.id} disabled={Boolean(taken)}>{t.full_name} — {t.subject ?? 'Chưa rõ môn'}{taken ? ` (đang chủ nhiệm ${t.homeroom_of})` : ''}</option>;
                        })}
                    </select>
                </div>
            </div>
            <div className={cat.dialogActions}>
                <button className={cat.btnGhost} onClick={onClose}>Hủy</button>
                <button className={cat.btnPrimary} onClick={submit} disabled={busy || !name.trim()}>{busy ? <span className={cat.spinner} /> : <Icon name="check" size={16} />} {editing ? 'Lưu thay đổi' : 'Tạo lớp'}</button>
            </div>
        </Modal>
    );
}