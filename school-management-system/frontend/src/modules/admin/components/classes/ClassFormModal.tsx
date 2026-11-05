'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { classService, getErrorMessage } from '../../services/classService';
import type { ClassFormValues, ClassMeta, SchoolClass } from '../../types/classes';

interface Props {
  open: boolean; onClose: () => void; meta: ClassMeta; yearId: number;
  editing?: SchoolClass | null; onSaved: (c: SchoolClass) => void;
}

const empty = (yearId: number): ClassFormValues => ({
  school_year_id: yearId, grade: 10, name: '', homeroom_teacher_id: null, room: '', capacity: 45, status: 'active', note: '',
});

export function ClassFormModal({ open, onClose, meta, yearId, editing, onSaved }: Props) {
  const toast = useToast();
  const [v, setV] = useState<ClassFormValues>(empty(yearId));
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrs({});
    setV(editing ? {
      school_year_id: editing.school_year_id, grade: editing.grade, name: editing.name,
      homeroom_teacher_id: editing.homeroom_teacher?.id ?? null, room: editing.room ?? '', capacity: editing.capacity,
      status: editing.status, note: editing.note ?? '',
    } : empty(yearId));
  }, [open, editing, yearId]);

  const set = <K extends keyof ClassFormValues>(k: K, val: ClassFormValues[K]) => setV((s) => ({ ...s, [k]: val }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!v.name.trim()) e.name = 'Vui lòng nhập tên lớp.';
    else if (!new RegExp(`^${v.grade}`).test(v.name.trim())) e.name = `Tên lớp nên bắt đầu bằng khối (vd: ${v.grade}A1).`;
    if (v.capacity < 10 || v.capacity > 60) e.capacity = 'Sĩ số tối đa từ 10 đến 60.';
    if (editing && v.capacity < editing.student_count) e.capacity = `Không thấp hơn sĩ số hiện tại (${editing.student_count}).`;
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { ...v, name: v.name.trim().toUpperCase(), room: v.room.trim() || (null as any), note: v.note.trim() || (null as any) };
      const saved = editing ? await classService.update(editing.id, payload) : await classService.create(payload);
      toast.success(editing ? 'Đã cập nhật lớp học' : 'Tạo lớp học thành công', `Lớp ${saved.name} · ${saved.school_year_label}`);
      onSaved(saved);
      onClose();
    } catch (e: any) {
      const fieldErrors = e?.response?.data?.errors;
      if (fieldErrors && typeof fieldErrors === 'object') {
        const m: Record<string, string> = {};
        Object.entries(fieldErrors).forEach(([k, val]) => (m[k] = Array.isArray(val) ? (val as string[])[0] : String(val)));
        setErrs(m);
      }
      toast.error('Không thể lưu lớp học', getErrorMessage(e));
    } finally { setSaving(false); }
  };

  const yearTeachers = v.school_year_id === meta.current_year_id;

  return (
    <Modal open={open} onClose={onClose} title={editing ? `Chỉnh sửa lớp ${editing.name}` : 'Thêm lớp học mới'}
           subtitle="Thông tin cơ bản của lớp trong năm học" footer={
      <>
        <button className="a-btn" onClick={onClose}>Hủy</button>
        <button className="a-btn pri" onClick={submit} disabled={saving}>{saving && <span className="a-spin" />} {editing ? 'Lưu thay đổi' : 'Tạo lớp'}</button>
      </>
    }>
      <div style={{ display: 'grid', gap: 14, paddingTop: 8 }}>
        <div className="a-grid2">
          <div className="a-field">
            <label>Năm học *</label>
            <select className="a-select" value={v.school_year_id} disabled={!!editing} onChange={(e) => set('school_year_id', +e.target.value)}>
              {meta.school_years.map((y) => <option key={y.id} value={y.id}>{y.label}{y.is_current ? ' (hiện tại)' : ''}</option>)}
            </select>
          </div>
          <div className="a-field">
            <label>Khối *</label>
            <select className="a-select" value={v.grade} onChange={(e) => set('grade', +e.target.value)}>
              {meta.grades.map((g) => <option key={g} value={g}>Khối {g}</option>)}
            </select>
          </div>
        </div>
        <div className="a-grid2">
          <div className="a-field">
            <label>Tên lớp *</label>
            <input className="a-input" value={v.name} placeholder={`${v.grade}A1`} maxLength={10} onChange={(e) => set('name', e.target.value)} />
            {errs.name && <span className="err">{errs.name}</span>}
          </div>
          <div className="a-field">
            <label>Phòng học</label>
            <input className="a-input" value={v.room} placeholder="Phòng 201" maxLength={30} onChange={(e) => set('room', e.target.value)} />
          </div>
        </div>
        <div className="a-field">
          <label>Giáo viên chủ nhiệm</label>
          <select className="a-select" value={v.homeroom_teacher_id ?? ''} onChange={(e) => set('homeroom_teacher_id', e.target.value ? +e.target.value : null)}>
            <option value="">— Chưa phân công —</option>
            {meta.teachers.map((t) => {
              const busy = yearTeachers && t.homeroom_class_id && t.homeroom_class_id !== editing?.id;
              return <option key={t.id} value={t.id} disabled={!!busy}>{t.full_name} · {t.main_subject}{busy ? ` (đang CN ${t.homeroom_class_name})` : ''}</option>;
            })}
          </select>
          {errs.homeroom_teacher_id && <span className="err">{errs.homeroom_teacher_id}</span>}
        </div>
        <div className="a-grid2">
          <div className="a-field">
            <label>Sĩ số tối đa *</label>
            <input type="number" className="a-input" value={v.capacity} min={10} max={60} onChange={(e) => set('capacity', +e.target.value)} />
            {errs.capacity && <span className="err">{errs.capacity}</span>}
          </div>
          <div className="a-field">
            <label>Trạng thái</label>
            <select className="a-select" value={v.status} onChange={(e) => set('status', e.target.value as any)}>
              {meta.statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div className="a-field">
          <label>Ghi chú</label>
          <textarea className="a-textarea" rows={2} maxLength={255} value={v.note} onChange={(e) => set('note', e.target.value)} placeholder="Lớp chuyên Toán, lớp CLC…" />
        </div>
      </div>
    </Modal>
  );
}
